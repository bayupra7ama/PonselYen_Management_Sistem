// ESC/POS receipt generator for 58mm thermal printers (32 columns).
// Pure JS, no dependencies. Output: Uint8Array of raw printer bytes.

const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a

const STATUS_LABEL = {
  MENUNGGU: 'Menunggu Diperiksa', DIAGNOSA: 'Diagnosa', MENUNGGU_SPAREPART: 'Menunggu Sparepart',
  DALAM_PERBAIKAN: 'Dalam Perbaikan', SELESAI: 'Selesai', SUDAH_DIAMBIL: 'Sudah Diambil', BATAL: 'Batal',
}

export function rupiahPlain(n) {
  const num = Math.round(Number(n) || 0)
  return 'Rp' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function dateID(d) {
  if (!d) return '-'
  try {
    const dt = new Date(d)
    const dd = String(dt.getDate()).padStart(2, '0')
    const mm = String(dt.getMonth() + 1).padStart(2, '0')
    const yy = dt.getFullYear()
    const hh = String(dt.getHours()).padStart(2, '0')
    const mi = String(dt.getMinutes()).padStart(2, '0')
    return `${dd}/${mm}/${yy} ${hh}:${mi}`
  } catch { return '-' }
}

// Strip non-ASCII (most cheap thermal printers only support CP437-ish charsets)
function ascii(str) {
  return String(str ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[×]/g, 'x')
    .replace(/[^\x20-\x7e]/g, '?')
}

function wrap(text, width) {
  const words = ascii(text).split(/\s+/).filter(Boolean)
  const lines = []
  let cur = ''
  for (const w of words) {
    if (w.length > width) {
      if (cur) { lines.push(cur); cur = '' }
      for (let i = 0; i < w.length; i += width) lines.push(w.slice(i, i + width))
      continue
    }
    if ((cur + ' ' + w).trim().length > width) { lines.push(cur); cur = w }
    else cur = (cur ? cur + ' ' : '') + w
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : ['']
}

// left ... right on one line; wraps left part if needed
function lr(left, right, width) {
  const l = ascii(left); const r = ascii(right)
  if (l.length + r.length + 1 <= width) return l + ' '.repeat(width - l.length - r.length) + r
  const lines = wrap(l, width - r.length - 1)
  const last = lines.pop()
  return [...lines, last + ' '.repeat(Math.max(1, width - last.length - r.length)) + r].join('\n')
}

class Builder {
  constructor(width) { this.width = width; this.buf = [] }
  raw(...bytes) { this.buf.push(...bytes); return this }
  init() { return this.raw(ESC, 0x40) }
  align(n) { return this.raw(ESC, 0x61, n) } // 0 left 1 center 2 right
  bold(on) { return this.raw(ESC, 0x45, on ? 1 : 0) }
  size(w = 0, h = 0) { return this.raw(GS, 0x21, ((w & 0x7) << 4) | (h & 0x7)) }
  text(str) { for (const ch of ascii(str)) this.buf.push(ch.charCodeAt(0)); return this }
  line(str = '') { return this.text(str).raw(LF) }
  lines(str) { for (const l of String(str).split('\n')) this.line(l); return this }
  center(str) { this.align(1); for (const l of wrap(str, this.width)) this.line(l); return this.align(0) }
  dashes() { return this.line('-'.repeat(this.width)) }
  feed(n = 3) { return this.raw(ESC, 0x64, n) }
  cut() { return this.raw(GS, 0x56, 0x42, 0x00) }
  bytes() { return Uint8Array.from(this.buf) }
}

export function widthCols() { return 32 }

// Build service receipt (nota service) bytes
export function buildServiceReceipt(service, settings = {}) {
  const cols = widthCols()
  const s = service || {}
  const b = new Builder(cols)
  const total = s.payment?.total || 0
  const paid = s.payment?.paid || 0
  const sisa = Math.max(0, total - paid)

  b.init()
  b.align(1).bold(true).size(1, 1).line(ascii(settings.shopName || 'Konter Ponsel').slice(0, Math.floor(cols / 2))).size(0, 0).bold(false)
  if (settings.address) b.center(settings.address)
  if (settings.phone) b.center(settings.phone)
  b.align(0).dashes()
  b.bold(true).line('NOTA SERVICE').bold(false)
  b.lines(lr('No.', s.serviceNumber || '-', cols))
  b.lines(lr('Tanggal', dateID(s.createdAt), cols))
  b.lines(lr('Pelanggan', s.customerName || '-', cols))
  if (s.customerPhone) b.lines(lr('No. HP', s.customerPhone, cols))
  b.lines(lr('HP', `${s.brand || ''} ${s.model || ''}`.trim() || '-', cols))
  b.line('Keluhan:')
  for (const l of wrap(s.complaint || '-', cols - 2)) b.line('  ' + l)
  b.lines(lr('Status', STATUS_LABEL[s.status] || s.status || '-', cols))

  const c = s.condition || {}
  const deliveredBy = s.deliveredBy?.type === 'other' ? `Orang lain: ${s.deliveredBy?.name || '-'}` : 'Pemilik'
  b.lines(lr('Diantar', deliveredBy, cols))

  b.dashes()
  b.bold(true).line('KONDISI SAAT DITERIMA').bold(false)
  b.lines(lr('SIM Card', c.simCard || '-', cols))
  b.lines(lr('SD Card', c.sdCard || '-', cols))
  b.lines(lr('Casing', c.casing || '-', cols))
  b.lines(lr('Power', c.powerButton || '-', cols))
  b.lines(lr('Volume +', c.volumeUp || '-', cols))
  b.lines(lr('Volume -', c.volumeDown || '-', cols))
  if (c.note) {
    b.line('Catatan:')
    for (const l of wrap(c.note, cols - 2)) b.line('  ' + l)
  }

  if (Array.isArray(s.items) && s.items.length) {
    b.dashes()
    for (const it of s.items) {
      const desc = `${it.description || it.sparepartName || 'Item'}${it.qty > 1 ? ` x${it.qty}` : ''}`
      b.lines(lr(desc, rupiahPlain(it.total), cols))
    }
  }
  b.dashes()
  b.bold(true).lines(lr('TOTAL', rupiahPlain(total), cols)).bold(false)
  b.lines(lr('Dibayar', rupiahPlain(paid), cols))
  b.lines(lr('Sisa', rupiahPlain(sisa), cols))
  b.lines(lr('Status Bayar', s.payment?.status || '-', cols))
  b.dashes()
  b.center('Simpan nota ini dan tunjukkan saat pengambilan perangkat.')
  if (settings.receiptFooter) { b.line(); b.center(settings.receiptFooter) }
  b.feed(4).cut()
  return b.bytes()
}

// Build sales receipt (nota penjualan) bytes
export function buildSaleReceipt(sale, settings = {}) {
  const cols = widthCols()
  const s = sale || {}
  const b = new Builder(cols)
  b.init()
  b.align(1).bold(true).size(1, 1).line(ascii(settings.shopName || 'Konter Ponsel').slice(0, Math.floor(cols / 2))).size(0, 0).bold(false)
  if (settings.address) b.center(settings.address)
  if (settings.phone) b.center(settings.phone)
  b.align(0).dashes()
  b.bold(true).line('NOTA PENJUALAN').bold(false)
  b.lines(lr('No.', s.saleNumber || '-', cols))
  b.lines(lr('Tanggal', dateID(s.createdAt), cols))
  b.dashes()
  for (const it of s.items || []) {
    b.line(ascii(it.name).slice(0, cols))
    b.lines(lr(`  ${it.qty} x ${rupiahPlain(it.price)}`, rupiahPlain((it.qty || 0) * (it.price || 0)), cols))
  }
  b.dashes()
  b.bold(true).lines(lr('TOTAL', rupiahPlain(s.total), cols)).bold(false)
  b.dashes()
  b.center('Terima kasih atas kunjungan Anda.')
  if (settings.receiptFooter) { b.line(); b.center(settings.receiptFooter) }
  b.feed(4).cut()
  return b.bytes()
}

// Human-readable preview (same layout, no control bytes)
export function bytesToPreview(bytes) {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i]
    if (c === ESC) { i += bytes[i + 1] === 0x40 ? 1 : 2; continue } // ESC @ (2 bytes) or ESC x n (3 bytes)
    if (c === GS) { i += bytes[i + 1] === 0x56 ? 3 : 2; continue } // GS V m n (4 bytes) or GS ! n (3 bytes)
    if (c === LF) { out += '\n'; continue }
    if (c >= 0x20 && c <= 0x7e) out += String.fromCharCode(c)
  }
  return out
}

export function toBase64(bytes) { return Buffer.from(bytes).toString('base64') }
