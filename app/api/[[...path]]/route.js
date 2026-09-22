import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { buildServiceReceipt, buildSaleReceipt, bytesToPreview, toBase64 } from '@/lib/escpos'

// ---------- MongoDB ----------
let client
let db
let seeded = false

async function connectToMongo() {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME)
  }
  if (!seeded) {
    await ensureSeed(db)
    seeded = true
  }
  return db
}

// ---------- CORS ----------
function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

function json(data, status = 200) {
  return handleCORS(NextResponse.json(data, { status }))
}

// ---------- Auth helpers (crypto only) ----------
const SECRET = process.env.AUTH_SECRET || 'dev_secret'

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
function b64urlJSON(obj) { return b64url(JSON.stringify(obj)) }

function signToken(payload) {
  const header = b64urlJSON({ alg: 'HS256', typ: 'JWT' })
  const body = b64urlJSON(payload)
  const data = `${header}.${body}`
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${data}.${sig}`
}

function verifyToken(token) {
  try {
    const [header, body, sig] = token.split('.')
    const data = `${header}.${body}`
    const expected = crypto.createHmac('sha256', SECRET).update(data).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    if (sig !== expected) return null
    const payload = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString())
    if (payload.exp && Date.now() > payload.exp) return null
    return payload
  } catch { return null }
}

function hashPassword(password, salt) {
  const s = salt || crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, s, 100000, 64, 'sha512').toString('hex')
  return { salt: s, hash }
}

function getAuth(request) {
  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return null
  return verifyToken(token)
}

// ---------- Seed default account & settings ----------
async function ensureSeed(db) {
  const email = (process.env.SEED_EMAIL || 'admin@konter.com').toLowerCase()
  const existing = await db.collection('users').findOne({ email })
  if (!existing) {
    const { salt, hash } = hashPassword(process.env.SEED_PASSWORD || 'admin123')
    await db.collection('users').insertOne({ id: uuidv4(), email, salt, hash, createdAt: new Date() })
  }
  const settings = await db.collection('settings').findOne({ id: 'main' })
  if (!settings) {
    await db.collection('settings').insertOne({
      id: 'main',
      shopName: 'Konter Ponsel',
      address: '',
      phone: '',
      receiptFooter: 'Terima kasih telah mempercayakan servis pada kami.',
      servicePrefix: 'SRV',
      salePrefix: 'SALE',
    })
  }
}

// ---------- Utilities ----------
function dateCode(d = new Date()) {
  const yy = String(d.getFullYear()).slice(2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}${mm}${dd}`
}

async function nextNumber(db, collection, prefix, field) {
  const code = dateCode()
  const regex = new RegExp(`^${prefix}-${code}-`)
  const count = await db.collection(collection).countDocuments({ [field]: { $regex: regex } })
  const seq = String(count + 1).padStart(3, '0')
  return `${prefix}-${code}-${seq}`
}

function clean(doc) {
  if (!doc) return doc
  const { _id, ...rest } = doc
  return rest
}

function computeTotals(items = []) {
  return items.reduce((sum, it) => sum + (Number(it.total) || 0), 0)
}

function startOfPeriod(period, from, to) {
  const now = new Date()
  let start, end
  end = new Date()
  if (period === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  } else if (period === 'week') {
    start = new Date(now); start.setDate(now.getDate() - 6); start.setHours(0, 0, 0, 0)
  } else if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1)
  } else if (period === 'custom' && from) {
    start = new Date(from)
    end = to ? new Date(new Date(to).setHours(23, 59, 59, 999)) : new Date()
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1)
  }
  return { start, end }
}

const READY_STATUS = 'SELESAI'

// ---------- Main handler ----------
async function handleRoute(request, { params }) {
  const { path = [] } = await params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    const db = await connectToMongo()

    // ===== Public =====
    if (route === '/' || route === '/root') return json({ message: 'Konter API' })

    // ===== Auth: login =====
    if (route === '/auth/login' && method === 'POST') {
      const body = await request.json()
      const email = (body.email || '').toLowerCase().trim()
      const user = await db.collection('users').findOne({ email })
      if (!user) return json({ error: 'Email atau password salah.' }, 401)
      const { hash } = hashPassword(body.password || '', user.salt)
      if (hash !== user.hash) return json({ error: 'Email atau password salah.' }, 401)
      const token = signToken({ sub: user.id, email: user.email, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 })
      return json({ token, user: { id: user.id, email: user.email } })
    }

    // ===== All routes below require auth =====
    const auth = getAuth(request)
    if (!auth) return json({ error: 'Tidak terautentikasi.' }, 401)

    if (route === '/auth/me' && method === 'GET') {
      return json({ user: { id: auth.sub, email: auth.email } })
    }

    // ===== Settings =====
    if (route === '/settings' && method === 'GET') {
      const s = await db.collection('settings').findOne({ id: 'main' })
      return json(clean(s))
    }
    if (route === '/settings' && method === 'PUT') {
      const body = await request.json()
      const allowed = ['shopName', 'address', 'phone', 'receiptFooter', 'servicePrefix', 'salePrefix']
      const update = {}
      for (const k of allowed) if (body[k] !== undefined) update[k] = body[k]
      await db.collection('settings').updateOne({ id: 'main' }, { $set: update })
      const s = await db.collection('settings').findOne({ id: 'main' })
      return json(clean(s))
    }

    // ===== Categories =====
    if (route === '/categories' && method === 'GET') {
      const cats = await db.collection('categories').find({}).sort({ name: 1 }).toArray()
      return json(cats.map(clean))
    }
    if (route === '/categories' && method === 'POST') {
      const body = await request.json()
      if (!body.name) return json({ error: 'Nama kategori wajib diisi.' }, 400)
      const exists = await db.collection('categories').findOne({ name: body.name })
      if (exists) return json(clean(exists))
      const cat = { id: uuidv4(), name: body.name, type: body.type || 'Sparepart' }
      await db.collection('categories').insertOne(cat)
      return json(clean(cat))
    }

    // ===== Customers =====
    if (route === '/customers' && method === 'GET') {
      const url = new URL(request.url)
      const search = (url.searchParams.get('search') || '').trim()
      let query = {}
      if (search) {
        const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        query = { $or: [{ name: rx }, { phone: rx }] }
      }
      const customers = await db.collection('customers').find(query).sort({ createdAt: -1 }).limit(500).toArray()
      // attach service count
      const result = []
      for (const c of customers) {
        const count = await db.collection('services').countDocuments({ customerId: c.id })
        result.push({ ...clean(c), serviceCount: count })
      }
      return json(result)
    }
    if (route === '/customers/search' && method === 'GET') {
      const url = new URL(request.url)
      const phone = (url.searchParams.get('phone') || '').trim()
      if (!phone) return json(null)
      const c = await db.collection('customers').findOne({ phone })
      return json(clean(c))
    }
    if (route === '/customers' && method === 'POST') {
      const body = await request.json()
      if (!body.name) return json({ error: 'Nama pelanggan wajib diisi.' }, 400)
      let existing = body.phone ? await db.collection('customers').findOne({ phone: body.phone }) : null
      if (existing) return json(clean(existing))
      const c = { id: uuidv4(), name: body.name, phone: body.phone || '', createdAt: new Date() }
      await db.collection('customers').insertOne(c)
      return json(clean(c))
    }
    if (path[0] === 'customers' && path[1] && method === 'GET') {
      const c = await db.collection('customers').findOne({ id: path[1] })
      if (!c) return json({ error: 'Data tidak ditemukan.' }, 404)
      const services = await db.collection('services').find({ customerId: c.id }).sort({ createdAt: -1 }).toArray()
      return json({ ...clean(c), services: services.map(clean) })
    }
    if (path[0] === 'customers' && path[1] && method === 'PUT') {
      const body = await request.json()
      await db.collection('customers').updateOne({ id: path[1] }, { $set: { name: body.name, phone: body.phone } })
      const c = await db.collection('customers').findOne({ id: path[1] })
      return json(clean(c))
    }

    // ===== Services =====
    if (route === '/services' && method === 'GET') {
      const url = new URL(request.url)
      const search = (url.searchParams.get('search') || '').trim()
      const status = url.searchParams.get('status')
      const unclaimed = url.searchParams.get('unclaimed')
      let query = {}
      if (status) query.status = status
      if (unclaimed === '1') query.status = READY_STATUS
      if (search) {
        const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        query.$or = [
          { serviceNumber: rx }, { customerName: rx }, { customerPhone: rx },
          { brand: rx }, { model: rx },
        ]
      }
      const services = await db.collection('services').find(query).sort({ createdAt: -1 }).limit(500).toArray()
      return json(services.map(clean))
    }
    if (route === '/services' && method === 'POST') {
      const body = await request.json()
      if (!body.customerName) return json({ error: 'Nama pelanggan wajib diisi.' }, 400)
      if (!body.brand) return json({ error: 'Merek HP wajib diisi.' }, 400)
      if (!body.model) return json({ error: 'Model HP wajib diisi.' }, 400)
      if (!body.complaint) return json({ error: 'Keluhan wajib diisi.' }, 400)

      // find or create customer
      let customer = null
      if (body.customerPhone) customer = await db.collection('customers').findOne({ phone: body.customerPhone })
      if (!customer) {
        customer = { id: uuidv4(), name: body.customerName, phone: body.customerPhone || '', createdAt: new Date() }
        await db.collection('customers').insertOne(customer)
      }

      const serviceNumber = await nextNumber(db, 'services', (await db.collection('settings').findOne({ id: 'main' }))?.servicePrefix || 'SRV', 'serviceNumber')
      const now = new Date()
      const service = {
        id: uuidv4(),
        serviceNumber,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        brand: body.brand,
        model: body.model,
        complaint: body.complaint,
        condition: {
          simCard: body.condition?.simCard ?? 'Tidak Ada',
          sdCard: body.condition?.sdCard ?? 'Tidak Ada',
          casing: body.condition?.casing ?? 'Tidak Ada',
          powerButton: body.condition?.powerButton ?? 'Normal',
          volumeUp: body.condition?.volumeUp ?? 'Normal',
          volumeDown: body.condition?.volumeDown ?? 'Normal',
          note: body.condition?.note || '',
        },
        deliveredBy: {
          type: body.deliveredBy?.type || 'owner',
          name: body.deliveredBy?.name || '',
        },
        status: 'MENUNGGU',
        diagnosis: '',
        items: [],
        approval: 'BELUM',
        payment: { total: 0, paid: 0, status: 'Belum Bayar' },
        handover: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      }
      await db.collection('services').insertOne(service)
      return json(clean(service))
    }
    if (path[0] === 'services' && path[1] && !path[2] && method === 'GET') {
      const s = await db.collection('services').findOne({ id: path[1] })
      if (!s) return json({ error: 'Data tidak ditemukan.' }, 404)
      return json(clean(s))
    }
    if (path[0] === 'services' && path[1] && !path[2] && method === 'PUT') {
      const body = await request.json()
      const s = await db.collection('services').findOne({ id: path[1] })
      if (!s) return json({ error: 'Data tidak ditemukan.' }, 404)
      const update = { updatedAt: new Date() }
      if (body.status !== undefined) {
        update.status = body.status
        if (body.status === 'SELESAI' && !s.completedAt) update.completedAt = new Date()
      }
      if (body.diagnosis !== undefined) update.diagnosis = body.diagnosis
      if (body.approval !== undefined) update.approval = body.approval
      if (body.condition !== undefined) update.condition = { ...s.condition, ...body.condition }
      if (body.deliveredBy !== undefined) update.deliveredBy = { ...s.deliveredBy, ...body.deliveredBy }
      if (body.payment !== undefined) {
        const total = s.payment.total
        const paid = Number(body.payment.paid) || 0
        let st = 'Belum Bayar'
        if (paid >= total && total > 0) st = 'Lunas'
        else if (paid > 0) st = 'DP'
        update.payment = { total, paid, status: st }
      }

      // Handle cancellation -> restore stock for items using inventory
      if (body.status === 'BATAL' && s.status !== 'BATAL') {
        for (const it of s.items || []) {
          if (it.inventoryId && !it.stockReturned) {
            await restoreStock(db, it.inventoryId, it.qty, `Batal ${s.serviceNumber}`)
            it.stockReturned = true
          }
        }
        update.items = s.items
      }

      await db.collection('services').updateOne({ id: path[1] }, { $set: update })
      const updated = await db.collection('services').findOne({ id: path[1] })
      return json(clean(updated))
    }

    // Add work item
    if (path[0] === 'services' && path[1] && path[2] === 'items' && !path[3] && method === 'POST') {
      const body = await request.json()
      const s = await db.collection('services').findOne({ id: path[1] })
      if (!s) return json({ error: 'Data tidak ditemukan.' }, 404)
      const qty = Number(body.qty) || 1
      if (qty <= 0) return json({ error: 'Quantity harus lebih dari 0.' }, 400)
      const sparepartPrice = Number(body.sparepartPrice) || 0
      const servicePrice = Number(body.servicePrice) || 0
      if (sparepartPrice < 0 || servicePrice < 0) return json({ error: 'Harga tidak boleh negatif.' }, 400)

      // Inventory deduction
      let inventoryId = body.inventoryId || null
      let sparepartName = body.sparepartName || ''
      let finalSparepartPrice = sparepartPrice
      if (inventoryId) {
        const inv = await db.collection('inventory').findOne({ id: inventoryId })
        if (!inv) return json({ error: 'Sparepart tidak ditemukan di inventory.' }, 404)
        if (inv.stock < qty) return json({ error: `Stok ${inv.name} tidak cukup (tersisa ${inv.stock}).` }, 400)
        sparepartName = inv.name
        if (!body.sparepartPrice && body.sparepartPrice !== 0) finalSparepartPrice = inv.sellPrice || 0
        await deductStock(db, inventoryId, qty, 'SERVICE', s.serviceNumber, `Digunakan untuk Service ${s.serviceNumber}`)
      }

      const total = finalSparepartPrice * qty + servicePrice
      const item = {
        id: uuidv4(),
        description: body.description || sparepartName || 'Pekerjaan',
        inventoryId,
        sparepartName,
        qty,
        sparepartPrice: finalSparepartPrice,
        servicePrice,
        total,
        stockReturned: false,
        createdAt: new Date(),
      }
      const items = [...(s.items || []), item]
      const totalBiaya = computeTotals(items)
      const paid = s.payment?.paid || 0
      let payStatus = 'Belum Bayar'
      if (paid >= totalBiaya && totalBiaya > 0) payStatus = 'Lunas'
      else if (paid > 0) payStatus = 'DP'
      await db.collection('services').updateOne({ id: path[1] }, { $set: { items, 'payment.total': totalBiaya, 'payment.status': payStatus, updatedAt: new Date() } })
      const updated = await db.collection('services').findOne({ id: path[1] })
      return json(clean(updated))
    }

    // Remove work item -> restore stock
    if (path[0] === 'services' && path[1] && path[2] === 'items' && path[3] && method === 'DELETE') {
      const s = await db.collection('services').findOne({ id: path[1] })
      if (!s) return json({ error: 'Data tidak ditemukan.' }, 404)
      const item = (s.items || []).find(i => i.id === path[3])
      if (!item) return json({ error: 'Item tidak ditemukan.' }, 404)
      if (item.inventoryId && !item.stockReturned) {
        await restoreStock(db, item.inventoryId, item.qty, `Batal item ${s.serviceNumber}`)
      }
      const items = (s.items || []).filter(i => i.id !== path[3])
      const totalBiaya = computeTotals(items)
      const paid = s.payment?.paid || 0
      let payStatus = 'Belum Bayar'
      if (paid >= totalBiaya && totalBiaya > 0) payStatus = 'Lunas'
      else if (paid > 0) payStatus = 'DP'
      await db.collection('services').updateOne({ id: path[1] }, { $set: { items, 'payment.total': totalBiaya, 'payment.status': payStatus, updatedAt: new Date() } })
      const updated = await db.collection('services').findOne({ id: path[1] })
      return json(clean(updated))
    }

    // ESC/POS bytes untuk printer thermal Bluetooth (nota service)
    if (path[0] === 'services' && path[1] && path[2] === 'escpos' && method === 'GET') {
      const width = '58'
      const s = await db.collection('services').findOne({ id: path[1] })
      if (!s) return json({ error: 'Data tidak ditemukan.' }, 404)
      const settings = (await db.collection('settings').findOne({ id: 'main' })) || {}
      const bytes = buildServiceReceipt(s, settings)
      return json({ width, length: bytes.length, base64: toBase64(bytes), preview: bytesToPreview(bytes) })
    }

    // Handover (serahkan HP)
    if (path[0] === 'services' && path[1] && path[2] === 'handover' && method === 'POST') {
      const body = await request.json()
      const s = await db.collection('services').findOne({ id: path[1] })
      if (!s) return json({ error: 'Data tidak ditemukan.' }, 404)
      const handover = {
        pickedUpAt: new Date(),
        checklist: body.checklist || {},
        note: body.note || '',
      }
      const set = { status: 'SUDAH_DIAMBIL', handover, updatedAt: new Date() }
      // Saat HP diambil, pembayaran otomatis dianggap lunas (kecuali markPaid=false) sehingga pendapatan bertambah
      const markPaid = body.markPaid !== false
      const total = s.payment?.total || 0
      if (markPaid && total > 0) {
        set.payment = { total, paid: total, status: 'Lunas', paidAt: new Date() }
      }
      await db.collection('services').updateOne({ id: path[1] }, { $set: set })
      const updated = await db.collection('services').findOne({ id: path[1] })
      return json(clean(updated))
    }

    // ===== Inventory =====
    if (route === '/inventory' && method === 'GET') {
      const url = new URL(request.url)
      const search = (url.searchParams.get('search') || '').trim()
      const category = url.searchParams.get('category')
      const statusFilter = url.searchParams.get('status')
      let query = {}
      if (category) query.category = category
      if (search) {
        const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        query.$or = [{ name: rx }, { sku: rx }, { category: rx }, { brand: rx }, { model: rx }, { location: rx }]
      }
      let items = await db.collection('inventory').find(query).sort({ name: 1 }).limit(1000).toArray()
      if (statusFilter === 'low') items = items.filter(i => i.stock > 0 && i.stock <= i.minStock)
      if (statusFilter === 'out') items = items.filter(i => i.stock <= 0)
      return json(items.map(clean))
    }
    if (route === '/inventory' && method === 'POST') {
      const body = await request.json()
      if (!body.name) return json({ error: 'Nama barang wajib diisi.' }, 400)
      const stock = Number(body.stock) || 0
      if (stock < 0) return json({ error: 'Stok tidak boleh negatif.' }, 400)
      const item = {
        id: uuidv4(),
        name: body.name,
        sku: body.sku || '',
        category: body.category || 'Sparepart',
        brand: body.brand || '',
        model: body.model || '',
        stock,
        minStock: Number(body.minStock) || 0,
        buyPrice: Number(body.buyPrice) || 0,
        sellPrice: Number(body.sellPrice) || 0,
        location: body.location || '',
        note: body.note || '',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await db.collection('inventory').insertOne(item)
      if (stock > 0) {
        await addMovement(db, item.id, item.name, 'STOK_AWAL', stock, stock, '', 'Stok awal')
      }
      return json(clean(item))
    }
    if (route === '/inventory/movements' && method === 'GET') {
      const moves = await db.collection('inventory_movements').find({}).sort({ createdAt: -1 }).limit(300).toArray()
      return json(moves.map(clean))
    }
    if (path[0] === 'inventory' && path[1] && !path[2] && method === 'GET') {
      const item = await db.collection('inventory').findOne({ id: path[1] })
      if (!item) return json({ error: 'Data tidak ditemukan.' }, 404)
      const moves = await db.collection('inventory_movements').find({ inventoryId: item.id }).sort({ createdAt: -1 }).limit(100).toArray()
      return json({ ...clean(item), movements: moves.map(clean) })
    }
    if (path[0] === 'inventory' && path[1] && !path[2] && method === 'PUT') {
      const body = await request.json()
      const allowed = ['name', 'sku', 'category', 'brand', 'model', 'minStock', 'buyPrice', 'sellPrice', 'location', 'note']
      const update = { updatedAt: new Date() }
      for (const k of allowed) if (body[k] !== undefined) update[k] = ['minStock', 'buyPrice', 'sellPrice'].includes(k) ? Number(body[k]) || 0 : body[k]
      await db.collection('inventory').updateOne({ id: path[1] }, { $set: update })
      const item = await db.collection('inventory').findOne({ id: path[1] })
      return json(clean(item))
    }
    if (path[0] === 'inventory' && path[1] && path[2] === 'adjust' && method === 'POST') {
      const body = await request.json()
      const item = await db.collection('inventory').findOne({ id: path[1] })
      if (!item) return json({ error: 'Data tidak ditemukan.' }, 404)
      const qty = Number(body.qty)
      if (!qty || qty <= 0) return json({ error: 'Jumlah harus lebih dari 0.' }, 400)
      const type = body.type // STOK_MASUK, STOK_KELUAR, PENYESUAIAN
      let delta = 0
      if (type === 'STOK_MASUK') delta = qty
      else if (type === 'STOK_KELUAR') delta = -qty
      else if (type === 'PENYESUAIAN') delta = Number(body.setTo) !== undefined ? (Number(body.setTo) - item.stock) : qty
      const newStock = item.stock + delta
      if (newStock < 0) return json({ error: 'Stok tidak boleh negatif.' }, 400)
      await db.collection('inventory').updateOne({ id: item.id }, { $set: { stock: newStock, updatedAt: new Date() } })
      await addMovement(db, item.id, item.name, type, delta, newStock, body.reference || '', body.note || '')
      const updated = await db.collection('inventory').findOne({ id: item.id })
      return json(clean(updated))
    }

    // ===== Sales =====
    if (route === '/sales' && method === 'GET') {
      const sales = await db.collection('sales').find({}).sort({ createdAt: -1 }).limit(500).toArray()
      return json(sales.map(clean))
    }
    if (path[0] === 'sales' && path[1] && path[2] === 'escpos' && method === 'GET') {
      const width = '58'
      const s = await db.collection('sales').findOne({ id: path[1] })
      if (!s) return json({ error: 'Data tidak ditemukan.' }, 404)
      const settings = (await db.collection('settings').findOne({ id: 'main' })) || {}
      const bytes = buildSaleReceipt(s, settings)
      return json({ width, length: bytes.length, base64: toBase64(bytes), preview: bytesToPreview(bytes) })
    }
    if (route === '/sales' && method === 'POST') {
      const body = await request.json()
      const items = body.items || []
      if (!items.length) return json({ error: 'Minimal 1 barang.' }, 400)
      // validate stock
      for (const it of items) {
        const inv = await db.collection('inventory').findOne({ id: it.inventoryId })
        if (!inv) return json({ error: `Barang ${it.name} tidak ditemukan.` }, 404)
        if ((Number(it.qty) || 0) <= 0) return json({ error: 'Quantity harus lebih dari 0.' }, 400)
        if (inv.stock < it.qty) return json({ error: `Stok ${inv.name} tidak cukup (tersisa ${inv.stock}).` }, 400)
      }
      const saleNumber = await nextNumber(db, 'sales', (await db.collection('settings').findOne({ id: 'main' }))?.salePrefix || 'SALE', 'saleNumber')
      const saleItems = items.map(it => ({
        inventoryId: it.inventoryId,
        name: it.name,
        qty: Number(it.qty),
        price: Number(it.price) || 0,
        total: (Number(it.price) || 0) * Number(it.qty),
      }))
      const total = saleItems.reduce((s, i) => s + i.total, 0)
      const sale = { id: uuidv4(), saleNumber, items: saleItems, total, createdAt: new Date() }
      await db.collection('sales').insertOne(sale)
      // deduct stock
      for (const it of saleItems) {
        await deductStock(db, it.inventoryId, it.qty, 'PENJUALAN', saleNumber, `Penjualan ${saleNumber}`)
      }
      return json(clean(sale))
    }

    // ===== Dashboard =====
    if (route === '/dashboard' && method === 'GET') {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const services = await db.collection('services').find({}).toArray()
      const active = services.filter(s => !['SUDAH_DIAMBIL', 'BATAL'].includes(s.status))
      const byStatus = (st) => services.filter(s => s.status === st).length
      const todayServices = services.filter(s => new Date(s.createdAt) >= todayStart).length
      const unclaimed = services.filter(s => s.status === READY_STATUS).length

      const inventory = await db.collection('inventory').find({}).toArray()
      const lowStock = inventory.filter(i => i.stock > 0 && i.stock <= i.minStock).length
      const outStock = inventory.filter(i => i.stock <= 0).length

      const sales = await db.collection('sales').find({ createdAt: { $gte: todayStart } }).toArray()
      const salesTotal = sales.reduce((s, x) => s + (x.total || 0), 0)

      // Pendapatan service hari ini = service yang sudah diambil hari ini (dibayar)
      const pickedToday = services.filter(s => s.status === 'SUDAH_DIAMBIL' && s.handover?.pickedUpAt && new Date(s.handover.pickedUpAt) >= todayStart)
      const serviceRevenueToday = pickedToday.reduce((sum, s) => sum + (s.payment?.paid || 0), 0)

      const recent = await db.collection('services').find({}).sort({ createdAt: -1 }).limit(6).toArray()

      return json({
        revenue: { todayService: serviceRevenueToday, todayServiceCount: pickedToday.length, todaySales: salesTotal, todayTotal: serviceRevenueToday + salesTotal },
        service: {
          active: active.length,
          waiting: byStatus('MENUNGGU'),
          diagnosa: byStatus('DIAGNOSA'),
          repairing: byStatus('DALAM_PERBAIKAN'),
          ready: unclaimed,
          today: todayServices,
          unclaimed,
        },
        inventory: { total: inventory.length, low: lowStock, out: outStock },
        sales: { todayTotal: salesTotal, todayCount: sales.length },
        recent: recent.map(clean),
      })
    }

    // ===== Reports =====
    if (route === '/reports/services' && method === 'GET') {
      const url = new URL(request.url)
      const { start, end } = startOfPeriod(url.searchParams.get('period') || 'month', url.searchParams.get('from'), url.searchParams.get('to'))
      const services = await db.collection('services').find({ createdAt: { $gte: start, $lte: end } }).toArray()
      const done = services.filter(s => ['SELESAI', 'SUDAH_DIAMBIL'].includes(s.status)).length
      const notDone = services.filter(s => !['SELESAI', 'SUDAH_DIAMBIL', 'BATAL'].includes(s.status)).length
      const unclaimed = services.filter(s => s.status === READY_STATUS).length
      // Pendapatan terkumpul = service yang sudah selesai & diambil (dibayar) pada periode ini, berdasarkan tanggal pengambilan
      const collectedServices = await db.collection('services')
        .find({ status: 'SUDAH_DIAMBIL', 'handover.pickedUpAt': { $gte: start, $lte: end } })
        .sort({ 'handover.pickedUpAt': -1 }).toArray()
      const collected = collectedServices.reduce((sum, s) => sum + (s.payment?.paid || 0), 0)
      return json({ total: services.length, done, notDone, unclaimed, collected, collectedCount: collectedServices.length, collectedServices: collectedServices.map(clean), services: services.map(clean) })
    }
    if (route === '/reports/sales' && method === 'GET') {
      const url = new URL(request.url)
      const { start, end } = startOfPeriod(url.searchParams.get('period') || 'month', url.searchParams.get('from'), url.searchParams.get('to'))
      const sales = await db.collection('sales').find({ createdAt: { $gte: start, $lte: end } }).sort({ createdAt: -1 }).toArray()
      const total = sales.reduce((s, x) => s + (x.total || 0), 0)
      return json({ count: sales.length, total, sales: sales.map(clean) })
    }
    if (route === '/reports/inventory' && method === 'GET') {
      const inventory = await db.collection('inventory').find({}).toArray()
      const low = inventory.filter(i => i.stock > 0 && i.stock <= i.minStock).map(clean)
      const out = inventory.filter(i => i.stock <= 0).map(clean)
      const moves = await db.collection('inventory_movements').find({}).sort({ createdAt: -1 }).limit(100).toArray()
      return json({ low, out, movements: moves.map(clean) })
    }

    // ===== Seed sample data =====
    if (route === '/seed' && method === 'POST') {
      await seedSample(db)
      return json({ ok: true })
    }
    if (route === '/seed' && method === 'DELETE') {
      await db.collection('customers').deleteMany({ sample: true })
      await db.collection('services').deleteMany({ sample: true })
      await db.collection('inventory').deleteMany({ sample: true })
      await db.collection('inventory_movements').deleteMany({ sample: true })
      await db.collection('categories').deleteMany({ sample: true })
      await db.collection('sales').deleteMany({ sample: true })
      return json({ ok: true })
    }

    return json({ error: `Route ${route} not found` }, 404)
  } catch (error) {
    console.error('API Error:', error)
    return json({ error: 'Terjadi kesalahan pada server. Silakan coba lagi.' }, 500)
  }
}

// ---------- Stock helpers ----------
async function addMovement(db, inventoryId, inventoryName, type, qty, stockAfter, reference, note) {
  await db.collection('inventory_movements').insertOne({
    id: uuidv4(), inventoryId, inventoryName, type, qty, stockAfter,
    reference: reference || '', note: note || '', createdAt: new Date(),
  })
}
async function deductStock(db, inventoryId, qty, type, reference, note) {
  const inv = await db.collection('inventory').findOne({ id: inventoryId })
  if (!inv) return
  const newStock = inv.stock - qty
  await db.collection('inventory').updateOne({ id: inventoryId }, { $set: { stock: newStock, updatedAt: new Date() } })
  await addMovement(db, inventoryId, inv.name, type, -qty, newStock, reference, note)
}
async function restoreStock(db, inventoryId, qty, note) {
  const inv = await db.collection('inventory').findOne({ id: inventoryId })
  if (!inv) return
  const newStock = inv.stock + qty
  await db.collection('inventory').updateOne({ id: inventoryId }, { $set: { stock: newStock, updatedAt: new Date() } })
  await addMovement(db, inventoryId, inv.name, 'PENYESUAIAN', qty, newStock, '', note)
}

// ---------- Sample data ----------
async function seedSample(db) {
  const cats = [
    { id: uuidv4(), name: 'LCD', type: 'Sparepart', sample: true },
    { id: uuidv4(), name: 'Baterai', type: 'Sparepart', sample: true },
    { id: uuidv4(), name: 'Accessories', type: 'Accessories', sample: true },
  ]
  await db.collection('categories').insertMany(cats)

  const invSpecs = [
    { name: 'LCD Samsung A52', category: 'LCD', brand: 'Samsung', model: 'A52', stock: 5, minStock: 2, buyPrice: 400000, sellPrice: 500000, location: 'A-01' },
    { name: 'Baterai iPhone 7', category: 'Baterai', brand: 'Apple', model: 'iPhone 7', stock: 3, minStock: 3, buyPrice: 90000, sellPrice: 150000, location: 'A-02' },
    { name: 'Tombol Power Samsung A52', category: 'Sparepart', brand: 'Samsung', model: 'A52', stock: 12, minStock: 3, buyPrice: 15000, sellPrice: 35000, location: 'B-04' },
    { name: 'Konektor Charger Oppo A5s', category: 'Sparepart', brand: 'Oppo', model: 'A5s', stock: 1, minStock: 3, buyPrice: 20000, sellPrice: 45000, location: 'B-05' },
    { name: 'IC Power Xiaomi', category: 'Sparepart', brand: 'Xiaomi', model: 'Umum', stock: 0, minStock: 2, buyPrice: 25000, sellPrice: 60000, location: 'C-01' },
    { name: 'Silikon Case Samsung A52', category: 'Accessories', brand: 'Samsung', model: 'A52', stock: 20, minStock: 5, buyPrice: 8000, sellPrice: 25000, location: 'D-01' },
    { name: 'Tempered Glass Universal', category: 'Accessories', brand: 'Universal', model: '-', stock: 40, minStock: 10, buyPrice: 3000, sellPrice: 15000, location: 'D-02' },
    { name: 'Kabel Charger Type-C', category: 'Accessories', brand: 'Universal', model: '-', stock: 15, minStock: 5, buyPrice: 7000, sellPrice: 20000, location: 'D-03' },
    { name: 'Speaker Realme C2', category: 'Sparepart', brand: 'Realme', model: 'C2', stock: 4, minStock: 2, buyPrice: 18000, sellPrice: 40000, location: 'B-06' },
    { name: 'Flexible Charger Vivo Y12', category: 'Sparepart', brand: 'Vivo', model: 'Y12', stock: 6, minStock: 2, buyPrice: 22000, sellPrice: 50000, location: 'B-07' },
  ]
  for (const spec of invSpecs) {
    const item = { id: uuidv4(), sku: '', note: '', ...spec, createdAt: new Date(), updatedAt: new Date(), sample: true }
    await db.collection('inventory').insertOne(item)
    if (item.stock > 0) await addMovement(db, item.id, item.name, 'STOK_AWAL', item.stock, item.stock, '', 'Stok awal (sample)')
  }

  const customers = [
    { id: uuidv4(), name: 'Andi', phone: '081234567890', createdAt: new Date(), sample: true },
    { id: uuidv4(), name: 'Budi', phone: '081298765432', createdAt: new Date(), sample: true },
    { id: uuidv4(), name: 'Citra', phone: '081211112222', createdAt: new Date(), sample: true },
  ]
  await db.collection('customers').insertMany(customers)

  const svcSpecs = [
    { c: customers[0], brand: 'Samsung', model: 'A52', complaint: 'Layar pecah', status: 'SELESAI', total: 650000, paid: 650000 },
    { c: customers[0], brand: 'Samsung', model: 'A52', complaint: 'Baterai boros', status: 'SUDAH_DIAMBIL', total: 250000, paid: 250000 },
    { c: customers[1], brand: 'Oppo', model: 'A5s', complaint: 'Tidak bisa dicas', status: 'DALAM_PERBAIKAN', total: 90000, paid: 0 },
    { c: customers[2], brand: 'Xiaomi', model: 'Redmi 9', complaint: 'Mati total', status: 'DIAGNOSA', total: 0, paid: 0 },
    { c: customers[1], brand: 'Vivo', model: 'Y12', complaint: 'Speaker tidak bunyi', status: 'MENUNGGU', total: 0, paid: 0 },
  ]
  let seq = 1
  for (const sp of svcSpecs) {
    const num = `SRV-${dateCode()}-${String(seq++).padStart(3, '0')}`
    const now = new Date()
    let payStatus = 'Belum Bayar'
    if (sp.paid >= sp.total && sp.total > 0) payStatus = 'Lunas'
    else if (sp.paid > 0) payStatus = 'DP'
    await db.collection('services').insertOne({
      id: uuidv4(), serviceNumber: num, customerId: sp.c.id, customerName: sp.c.name, customerPhone: sp.c.phone,
      brand: sp.brand, model: sp.model, complaint: sp.complaint,
      condition: { simCard: 'Ada', sdCard: 'Tidak Ada', casing: 'Ada', powerButton: 'Normal', volumeUp: 'Normal', volumeDown: 'Normal', note: '' },
      deliveredBy: { type: 'owner', name: '' },
      status: sp.status, diagnosis: '', items: [], approval: 'BELUM',
      payment: { total: sp.total, paid: sp.paid, status: payStatus },
      handover: sp.status === 'SUDAH_DIAMBIL' ? { pickedUpAt: new Date(), checklist: {}, note: '' } : null,
      createdAt: now, updatedAt: now, completedAt: ['SELESAI', 'SUDAH_DIAMBIL'].includes(sp.status) ? now : null,
      sample: true,
    })
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
