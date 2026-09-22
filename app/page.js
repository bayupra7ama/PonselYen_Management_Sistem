'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'
import {
  LayoutDashboard, Wrench, Package, ShoppingCart, Users, FileBarChart, Settings as SettingsIcon,
  LogOut, Plus, Search, Printer, ChevronLeft, Phone, Trash2, MapPin, AlertTriangle, PackageX,
  Menu as MenuIcon, Smartphone, CheckCircle2, Loader2, Clock, TrendingUp, PackageCheck, X, Boxes,
} from 'lucide-react'
import { api, rupiah, formatDate, formatDateTime, daysWaiting, STATUSES, statusLabel, statusCls } from '@/lib/konter'

const BRAND_OPTIONS = ['Samsung', 'Xiaomi', 'Oppo', 'Vivo', 'Infinix/Itel/Tecno']
const INVENTORY_CATEGORIES = ['Sparepart', 'Aksesoris']

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'service', label: 'Service', icon: Wrench },
  { key: 'inventory', label: 'Inventory', icon: Package },
  { key: 'sale', label: 'Penjualan', icon: ShoppingCart },
  { key: 'customer', label: 'Pelanggan', icon: Users },
  { key: 'report', label: 'Laporan', icon: FileBarChart },
  { key: 'setting', label: 'Pengaturan', icon: SettingsIcon },
]

// ---------------- small helpers ----------------
function ToggleField({ value, onChange, options }) {
  return (
    <div className="inline-flex rounded-lg border border-border overflow-hidden">
      {options.map((o) => (
        <button key={o} type="button" onClick={() => onChange(o)}
          className={`px-4 py-2 text-sm font-medium transition-colors ${value === o ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
          {o}
        </button>
      ))}
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || '-'}</span>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, tone = 'default', onClick }) {
  const tones = {
    default: 'text-foreground', primary: 'text-sky-600', warn: 'text-amber-600',
    danger: 'text-red-600', success: 'text-green-600',
  }
  return (
    <Card className={`shadow-sm ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`} onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
          {Icon && <Icon className="h-4 w-4" />} {label}
        </div>
        <div className={`mt-2 font-bold leading-tight break-words ${typeof value === 'string' && value.length > 9 ? 'text-lg sm:text-xl' : 'text-2xl'} ${tones[tone]}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  )
}

// ---------------- Login ----------------
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await api('/auth/login', { method: 'POST', body: { email, password } })
      onLogin(data.token, data.user)
    } catch (err) {
      toast.error(err.message || 'Gagal masuk.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 p-4">
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-slate-900 flex items-center justify-center">
            <Smartphone className="h-7 w-7 text-sky-400" />
          </div>
          <CardTitle className="text-2xl">Konter</CardTitle>
          <p className="text-sm text-muted-foreground">Sistem Operasional Konter HP</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@konter.com" required />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Masuk
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------- Dashboard ----------------
function Dashboard({ token, go }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api('/dashboard', { token }).then(setData).catch(() => toast.error('Gagal memuat dashboard.')).finally(() => setLoading(false))
  }, [token])

  if (loading) return <Loading />
  if (!data) return null
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3">
        <Button className="h-12" onClick={() => go('service', { new: true })}>
          <Plus className="h-4 w-4 mr-2" /> Service Baru
        </Button>
        <Button className="h-12" variant="outline" onClick={() => go('sale', { new: true })}>
          <ShoppingCart className="h-4 w-4 mr-2" /> Penjualan
        </Button>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Ringkasan</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Wrench} label="Service Aktif" value={data.service.active} tone="primary" onClick={() => go('service')} />
          <StatCard icon={PackageCheck} label="Belum Diambil" value={data.service.unclaimed} tone="warn" onClick={() => go('service', { unclaimed: true })} />
          <StatCard icon={AlertTriangle} label="Stok Menipis" value={data.inventory.low} tone="warn" onClick={() => go('inventory', { status: 'low' })} />
          <StatCard icon={PackageX} label="Stok Habis" value={data.inventory.out} tone="danger" onClick={() => go('inventory', { status: 'out' })} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Pendapatan Hari Ini</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard icon={TrendingUp} label="Total Pendapatan" value={rupiah(data.revenue?.todayTotal || 0)} tone="primary" />
          <StatCard icon={Wrench} label="Dari Service" value={rupiah(data.revenue?.todayService || 0)} sub={`${data.revenue?.todayServiceCount || 0} HP diambil`} tone="success" />
          <StatCard icon={ShoppingCart} label="Dari Penjualan" value={rupiah(data.sales.todayTotal)} sub={`${data.sales.todayCount} transaksi`} tone="success" onClick={() => go('sale')} />
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">Service Terbaru</h2>
          <Button variant="ghost" size="sm" onClick={() => go('service')}>Lihat semua</Button>
        </div>
        <div className="space-y-2">
          {data.recent.length === 0 && <EmptyState text="Belum ada service." />}
          {data.recent.map((s) => (
            <Card key={s.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => go('service-detail', { id: s.id })}>
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{s.serviceNumber}</div>
                  <div className="text-xs text-muted-foreground truncate">{s.customerName} · {s.brand} {s.model}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(s.createdAt)}</div>
                </div>
                <Badge variant="outline" className={statusCls(s.status)}>{statusLabel(s.status)}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}

// ---------------- Item Search (dropdown dengan pencarian, ramah HP) ----------------
function ItemSearch({ items, onPick, placeholder = 'Cari barang...', renderMeta, emptyText = 'Barang tidak ditemukan.', autoFocus = false, limit = 40 }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(!!initial?.new)
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    const list = !s ? items : items.filter((x) => [x.name, x.sku, x.category, x.brand, x.model, x.location].filter(Boolean).some((v) => String(v).toLowerCase().includes(s)))
    return list.slice(0, limit)
  }, [items, q, limit])
  const pick = (x) => { onPick(x); setQ(''); setOpen(false) }
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9 pr-9"
          value={q}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
        />
        {(q || open) && (
          <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground" onClick={() => { setQ(''); setOpen(false) }} aria-label="Tutup">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {open && (
        <div className="rounded-md border bg-card max-h-56 overflow-y-auto divide-y" data-testid="item-search-list">
          {filtered.length === 0 && <div className="p-3 text-sm text-muted-foreground text-center">{emptyText}</div>}
          {filtered.map((x) => (
            <button key={x.id} type="button" onClick={() => pick(x)} className="w-full text-left px-3 py-2.5 hover:bg-accent active:bg-accent focus:bg-accent focus:outline-none">
              <div className="text-sm font-medium leading-tight">{x.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{renderMeta ? renderMeta(x) : `stok ${x.stock}`}</div>
            </button>
          ))}
          {items.length > filtered.length && q.trim() === '' && <div className="p-2 text-[11px] text-muted-foreground text-center">Menampilkan {filtered.length} dari {items.length} — ketik untuk mencari</div>}
        </div>
      )}
    </div>
  )
}

// ---------------- Service List ----------------
function ServiceList({ token, go, initial }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(initial?.unclaimed ? 'UNCLAIMED' : 'ALL')
  const [openNew, setOpenNew] = useState(!!initial?.new)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let q = '/services'
      const params = []
      if (search) params.push(`search=${encodeURIComponent(search)}`)
      if (status === 'UNCLAIMED') params.push('unclaimed=1')
      else if (status !== 'ALL') params.push(`status=${status}`)
      if (params.length) q += '?' + params.join('&')
      const data = await api(q, { token })
      setItems(data)
    } catch { toast.error('Gagal memuat service.') } finally { setLoading(false) }
  }, [token, search, status])

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Service</h1>
        <Button onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-1" /> Service Baru</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Cari no. service / nama / no. HP / merek..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Status</SelectItem>
            <SelectItem value="UNCLAIMED">Belum Diambil</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? <Loading /> : (
        <div className="space-y-2">
          {items.length === 0 && <EmptyState text="Tidak ada service." />}
          {items.map((s) => (
            <Card key={s.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => go('service-detail', { id: s.id })}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-sm">{s.serviceNumber}</div>
                  <Badge variant="outline" className={statusCls(s.status)}>{statusLabel(s.status)}</Badge>
                </div>
                <div className="mt-1 text-sm">{s.customerName} · {s.customerPhone || 'tanpa no. HP'}</div>
                <div className="text-xs text-muted-foreground">{s.brand} {s.model} — {s.complaint}</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{formatDate(s.createdAt)}</span>
                  <span className="text-sm font-semibold">{rupiah(s.payment?.total)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NewServiceDialog token={token} open={openNew} onOpenChange={setOpenNew} onCreated={(svc) => { setOpenNew(false); go('service-detail', { id: svc.id }) }} />
    </div>
  )
}

// ---------------- New Service Dialog ----------------
function NewServiceDialog({ token, open, onOpenChange, onCreated }) {
  const empty = {
    customerName: '', customerPhone: '', brand: '', model: '', complaint: '',
    condition: { simCard: 'Tidak Ada', sdCard: 'Tidak Ada', casing: 'Tidak Ada', powerButton: 'Normal', volumeUp: 'Normal', volumeDown: 'Normal', note: '' },
    deliveredBy: { type: 'owner', name: '' },
  }
  const [f, setF] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [showExtra, setShowExtra] = useState(false)

  useEffect(() => { if (open) { setF(empty); setShowExtra(false) } }, [open])

  const setCond = (k, v) => setF((p) => ({ ...p, condition: { ...p.condition, [k]: v } }))

  const lookupPhone = async () => {
    if (!f.customerPhone) return
    try {
      const c = await api(`/customers/search?phone=${encodeURIComponent(f.customerPhone)}`, { token })
      if (c) { setF((p) => ({ ...p, customerName: c.name })); toast.success(`Pelanggan ditemukan: ${c.name}`) }
    } catch {}
  }

  const submit = async () => {
    if (!f.customerName.trim()) return toast.error('Nama pelanggan wajib diisi.')
    if (!f.brand.trim()) return toast.error('Merek HP wajib diisi.')
    if (!f.model.trim()) return toast.error('Model HP wajib diisi.')
    if (!f.complaint.trim()) return toast.error('Keluhan wajib diisi.')
    setSaving(true)
    try {
      const svc = await api('/services', { method: 'POST', token, body: f })
      toast.success(`Service dibuat: ${svc.serviceNumber}`)
      onCreated(svc)
    } catch (err) { toast.error(err.message) } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-lg p-4 sm:p-6">
        <DialogHeader><DialogTitle>Service Baru</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <SectionLabel>Data Pelanggan</SectionLabel>
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <Label>Nomor HP</Label>
              <div className="flex gap-2">
                <Input value={f.customerPhone} onChange={(e) => setF({ ...f, customerPhone: e.target.value })} onBlur={lookupPhone} placeholder="0812xxxx" inputMode="tel" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nama Pelanggan *</Label>
              <Input value={f.customerName} onChange={(e) => setF({ ...f, customerName: e.target.value })} placeholder="Andi" />
            </div>
          </div>

          <SectionLabel>Data Perangkat</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Merek *</Label>
              <Select value={f.brand} onValueChange={(value) => setF({ ...f, brand: value })}>
                <SelectTrigger><SelectValue placeholder="Pilih merek" /></SelectTrigger>
                <SelectContent>
                  {BRAND_OPTIONS.map((brand) => <SelectItem key={brand} value={brand}>{brand}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Model/Tipe *</Label><Input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} placeholder="A52" /></div>
          </div>
          <div className="space-y-1.5"><Label>Keluhan *</Label><Textarea value={f.complaint} onChange={(e) => setF({ ...f, complaint: e.target.value })} placeholder="Layar pecah" rows={2} /></div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setShowExtra((v) => !v)}
          >
            {showExtra ? 'Sembunyikan Kondisi Tambahan' : 'Kondisi Tambahan (opsional)'}
          </Button>

          {showExtra && (
            <div className="space-y-4 rounded-lg border p-3 bg-muted/20">
              <SectionLabel>Kondisi Saat Diterima</SectionLabel>
              <div className="grid grid-cols-1 gap-3">
                <CondRow label="SIM Card"><ToggleField value={f.condition.simCard} onChange={(v) => setCond('simCard', v)} options={['Ada', 'Tidak Ada']} /></CondRow>
                <CondRow label="SD Card"><ToggleField value={f.condition.sdCard} onChange={(v) => setCond('sdCard', v)} options={['Ada', 'Tidak Ada']} /></CondRow>
                <CondRow label="Silikon/Casing"><ToggleField value={f.condition.casing} onChange={(v) => setCond('casing', v)} options={['Ada', 'Tidak Ada']} /></CondRow>
                <CondRow label="Tombol Power"><ToggleField value={f.condition.powerButton} onChange={(v) => setCond('powerButton', v)} options={['Normal', 'Rusak']} /></CondRow>
                <CondRow label="Volume Up"><ToggleField value={f.condition.volumeUp} onChange={(v) => setCond('volumeUp', v)} options={['Normal', 'Rusak']} /></CondRow>
                <CondRow label="Volume Down"><ToggleField value={f.condition.volumeDown} onChange={(v) => setCond('volumeDown', v)} options={['Normal', 'Rusak']} /></CondRow>
              </div>
              <div className="space-y-1.5">
                <Label>Catatan Tambahan</Label>
                <Textarea value={f.condition.note} onChange={(e) => setCond('note', e.target.value)} placeholder="LCD retak bagian kanan / barang lain yang ditinggalkan" rows={2} />
              </div>

              <SectionLabel>Diantar Oleh</SectionLabel>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <ToggleField value={f.deliveredBy.type === 'owner' ? 'Pemilik' : 'Orang Lain'} onChange={(v) => setF({ ...f, deliveredBy: { ...f.deliveredBy, type: v === 'Pemilik' ? 'owner' : 'other' } })} options={['Pemilik', 'Orang Lain']} />
                {f.deliveredBy.type === 'other' && (
                  <Input className="flex-1" value={f.deliveredBy.name} onChange={(e) => setF({ ...f, deliveredBy: { ...f.deliveredBy, name: e.target.value } })} placeholder="Nama pengantar" />
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={submit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Simpan Service</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CondRow({ label, children }) {
  return <div className="flex items-center justify-between"><span className="text-sm">{label}</span>{children}</div>
}
function SectionLabel({ children }) {
  return <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-1">{children}</div>
}

// ---------------- Service Detail ----------------
function ServiceDetail({ token, id, go, onPrint }) {
  const [s, setS] = useState(null)
  const [loading, setLoading] = useState(true)
  const [diagnosis, setDiagnosis] = useState('')
  const [paid, setPaid] = useState(0)
  const [openItem, setOpenItem] = useState(false)
  const [openHandover, setOpenHandover] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api(`/services/${id}`, { token })
      setS(data); setDiagnosis(data.diagnosis || ''); setPaid(data.payment?.paid || 0)
    } catch { toast.error('Data tidak ditemukan.') } finally { setLoading(false) }
  }, [token, id])
  useEffect(() => { load() }, [load])

  const update = async (body, msg) => {
    try { const d = await api(`/services/${id}`, { method: 'PUT', token, body }); setS(d); if (msg) toast.success(msg) }
    catch (err) { toast.error(err.message) }
  }

  const removeItem = async (itemId) => {
    try { const d = await api(`/services/${id}/items/${itemId}`, { method: 'DELETE', token }); setS(d); toast.success('Item dihapus, stok dikembalikan.') }
    catch (err) { toast.error(err.message) }
  }

  if (loading) return <Loading />
  if (!s) return <EmptyState text="Data tidak ditemukan." />

  const c = s.condition || {}
  const sisa = (s.payment?.total || 0) - (s.payment?.paid || 0)

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => go('service')}><ChevronLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-lg font-bold leading-tight">{s.serviceNumber}</h1>
          <div className="text-xs text-muted-foreground">{formatDate(s.createdAt)}</div>
        </div>
        <Button variant="outline" size="sm" onClick={() => onPrint(s)}><Printer className="h-4 w-4 mr-1" /> Nota</Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={statusCls(s.status)}>{statusLabel(s.status)}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {!['DALAM_PERBAIKAN', 'SELESAI', 'SUDAH_DIAMBIL', 'BATAL'].includes(s.status) && (
            <Button size="sm" onClick={() => update({ status: 'DALAM_PERBAIKAN' }, 'Perbaikan dimulai.')}>
              <Wrench className="h-4 w-4 mr-1" /> Mulai Perbaikan
            </Button>
          )}
          {s.status === 'DALAM_PERBAIKAN' && (
            <Button size="sm" onClick={() => update({ status: 'SELESAI' }, 'Service selesai.')}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Tandai Selesai
            </Button>
          )}
          {s.status === 'SELESAI' && (
            <Button size="sm" onClick={() => setOpenHandover(true)}>
              <PackageCheck className="h-4 w-4 mr-1" /> Serahkan HP
            </Button>
          )}
          {s.status !== 'SUDAH_DIAMBIL' && (
            <Select key={s.status} onValueChange={(v) => v === 'BATAL' ? setConfirmCancel(true) : update({ status: v }, 'Status diperbarui.')}>
              <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Status Lainnya" /></SelectTrigger>
              <SelectContent>{STATUSES.map((x) => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Pelanggan & Perangkat</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <InfoRow label="Nama" value={s.customerName} />
            <InfoRow label="No. HP" value={s.customerPhone} />
            <InfoRow label="Diantar" value={s.deliveredBy?.type === 'other' ? `Orang lain: ${s.deliveredBy?.name || '-'}` : 'Pemilik'} />
            <Separator className="my-2" />
            <InfoRow label="Merek" value={s.brand} />
            <InfoRow label="Model" value={s.model} />
            <InfoRow label="Keluhan" value={s.complaint} />
          </CardContent>
        </Card>

        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Kondisi Saat Masuk</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <InfoRow label="SIM Card" value={c.simCard} />
            <InfoRow label="SD Card" value={c.sdCard} />
            <InfoRow label="Silikon/Casing" value={c.casing} />
            <InfoRow label="Tombol Power" value={c.powerButton} />
            <InfoRow label="Volume Up" value={c.volumeUp} />
            <InfoRow label="Volume Down" value={c.volumeDown} />
            {c.note && <><Separator className="my-2" /><div className="text-sm"><span className="text-muted-foreground">Catatan: </span>{c.note}</div></>}
          </CardContent>
        </Card>
      </div>

      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Hasil Diagnosa</CardTitle></CardHeader>
        <CardContent className="pt-0 space-y-2">
          <Textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="Contoh: IC Power bermasalah" rows={2} />
          <Button size="sm" variant="secondary" onClick={() => update({ diagnosis }, 'Diagnosa disimpan.')}>Simpan Diagnosa</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Pekerjaan / Perbaikan</CardTitle>
          <Button size="sm" onClick={() => setOpenItem(true)}><Plus className="h-4 w-4 mr-1" /> Tambah</Button>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {(!s.items || s.items.length === 0) && <EmptyState text="Belum ada pekerjaan." />}
          {(s.items || []).map((it) => (
            <div key={it.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-sm">{it.description}</div>
                  {it.sparepartName && <div className="text-xs text-muted-foreground">Sparepart: {it.sparepartName} × {it.qty} {it.inventoryId ? '(dari stok)' : ''}</div>}
                  <div className="text-xs text-muted-foreground">Sparepart {rupiah(it.sparepartPrice)} · Jasa {rupiah(it.servicePrice)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold text-sm">{rupiah(it.total)}</div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeItem(it.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          ))}
          <div className="flex justify-between pt-1 text-base font-bold"><span>Total Biaya</span><span>{rupiah(s.payment?.total)}</span></div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Persetujuan Pelanggan</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <Select value={s.approval} onValueChange={(v) => update({ approval: v }, 'Persetujuan diperbarui.')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BELUM">Belum</SelectItem>
                <SelectItem value="DISETUJUI">Disetujui</SelectItem>
                <SelectItem value="DITOLAK">Ditolak</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Pembayaran</CardTitle></CardHeader>
          <CardContent className="pt-0 space-y-2">
            <InfoRow label="Total" value={rupiah(s.payment?.total)} />
            <div className="flex items-center gap-2">
              <Label className="text-muted-foreground text-sm w-24">Dibayar</Label>
              <Input type="number" value={paid} onChange={(e) => setPaid(e.target.value)} className="flex-1" />
              <Button size="sm" variant="secondary" onClick={() => update({ payment: { paid: Number(paid) } }, 'Pembayaran diperbarui.')}>Simpan</Button>
            </div>
            <InfoRow label="Sisa" value={rupiah(sisa)} />
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Status Bayar</span>
              <Badge variant="outline" className={s.payment?.status === 'Lunas' ? 'bg-green-100 text-green-700' : s.payment?.status === 'DP' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}>{s.payment?.status}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {s.status === 'SUDAH_DIAMBIL' && s.handover && (
        <Card className="bg-slate-50"><CardContent className="p-3 text-sm">
          <div className="font-medium flex items-center gap-2 text-green-700"><CheckCircle2 className="h-4 w-4" /> HP sudah diambil</div>
          <div className="text-muted-foreground mt-1">Waktu: {formatDateTime(s.handover.pickedUpAt)}</div>
          {s.handover.note && <div className="text-muted-foreground">Catatan: {s.handover.note}</div>}
        </CardContent></Card>
      )}

      <AddItemDialog token={token} serviceId={id} open={openItem} onOpenChange={setOpenItem} onDone={(d) => { setS(d); setOpenItem(false) }} />
      <HandoverDialog token={token} service={s} open={openHandover} onOpenChange={setOpenHandover} onDone={(d) => { setS(d); setOpenHandover(false) }} />

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Batalkan service ini?</AlertDialogTitle>
            <AlertDialogDescription>Sparepart yang sudah digunakan akan dikembalikan ke stok.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Tidak</AlertDialogCancel>
            <AlertDialogAction onClick={() => { update({ status: 'BATAL' }, 'Service dibatalkan.'); setConfirmCancel(false) }}>Ya, Batalkan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---------------- Add work item dialog ----------------
function AddItemDialog({ token, serviceId, open, onOpenChange, onDone }) {
  const [inv, setInv] = useState([])
  const [f, setF] = useState({ description: '', inventoryId: 'none', sparepartName: '', qty: 1, sparepartPrice: 0, servicePrice: 0 })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setF({ description: '', inventoryId: 'none', sparepartName: '', qty: 1, sparepartPrice: 0, servicePrice: 0 })
      api('/inventory', { token }).then(setInv).catch(() => {})
    }
  }, [open, token])

  const pickInv = (item) => {
    if (!item) { setF((p) => ({ ...p, inventoryId: 'none', sparepartName: '', sparepartPrice: 0 })); return }
    setF((p) => ({ ...p, inventoryId: item.id, sparepartName: item.name || '', sparepartPrice: item.sellPrice || 0, description: p.description || `Ganti ${item.name || ''}` }))
  }
  const selectedInv = f.inventoryId !== 'none' ? inv.find((x) => x.id === f.inventoryId) : null

  const submit = async () => {
    if (!f.description.trim() && !f.sparepartName.trim()) return toast.error('Isi deskripsi pekerjaan.')
    if (Number(f.qty) <= 0) return toast.error('Quantity harus lebih dari 0.')
    setSaving(true)
    try {
      const body = {
        description: f.description, qty: Number(f.qty), servicePrice: Number(f.servicePrice),
        sparepartPrice: Number(f.sparepartPrice), sparepartName: f.sparepartName,
        inventoryId: f.inventoryId === 'none' ? null : f.inventoryId,
      }
      const d = await api(`/services/${serviceId}/items`, { method: 'POST', token, body })
      toast.success('Pekerjaan ditambahkan.')
      onDone(d)
    } catch (err) { toast.error(err.message) } finally { setSaving(false) }
  }

  const total = (Number(f.sparepartPrice) || 0) * (Number(f.qty) || 0) + (Number(f.servicePrice) || 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-md max-h-[92vh] overflow-y-auto rounded-lg p-4 sm:p-6" data-testid="add-item-dialog">
        <DialogHeader><DialogTitle>Tambah Perbaikan</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Deskripsi Pekerjaan *</Label><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Ganti LCD" /></div>
          <div className="space-y-1.5">
            <Label>Sparepart dari Inventory</Label>
            {selectedInv ? (
              <div className="flex items-center justify-between gap-2 border rounded-md px-3 py-2 bg-accent/40" data-testid="selected-sparepart">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{selectedInv.name}</div>
                  <div className="text-xs text-muted-foreground">{rupiah(selectedInv.sellPrice)} · stok {selectedInv.stock}</div>
                </div>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs shrink-0" onClick={() => pickInv(null)}>Ganti</Button>
              </div>
            ) : (
              <>
                <ItemSearch
                  items={inv}
                  onPick={pickInv}
                  placeholder="Cari sparepart (nama / SKU)..."
                  renderMeta={(x) => `${rupiah(x.sellPrice)} · stok ${x.stock}${x.category ? ` · ${x.category}` : ''}`}
                />
                <p className="text-[11px] text-muted-foreground">Kosongkan jika tanpa stok / sparepart manual.</p>
                <Input value={f.sparepartName} onChange={(e) => setF({ ...f, sparepartName: e.target.value })} placeholder="Nama sparepart manual (opsional)" />
              </>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5"><Label>Qty</Label><Input type="number" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Hrg Sparepart</Label><Input type="number" value={f.sparepartPrice} onChange={(e) => setF({ ...f, sparepartPrice: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Jasa</Label><Input type="number" value={f.servicePrice} onChange={(e) => setF({ ...f, servicePrice: e.target.value })} /></div>
          </div>
          <div className="flex justify-between font-semibold"><span>Total</span><span>{rupiah(total)}</span></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={submit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Tambah</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------- Handover dialog ----------------
function HandoverDialog({ token, service, open, onOpenChange, onDone }) {
  const [chk, setChk] = useState({ sim: false, sd: false, casing: false, buttons: false })
  const [note, setNote] = useState('')
  const [markPaid, setMarkPaid] = useState(true)
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (open) { setChk({ sim: false, sd: false, casing: false, buttons: false }); setNote(''); setMarkPaid(true) } }, [open])

  const total = service?.payment?.total || 0
  const paid = service?.payment?.paid || 0
  const remaining = Math.max(0, total - paid)

  const submit = async () => {
    setSaving(true)
    try {
      const d = await api(`/services/${service.id}/handover`, { method: 'POST', token, body: { checklist: chk, note, markPaid } })
      toast.success(markPaid && remaining > 0 ? `HP diserahkan. Pembayaran ${rupiah(remaining)} dicatat lunas.` : 'HP diserahkan ke pelanggan.')
      onDone(d)
    } catch (err) { toast.error(err.message) } finally { setSaving(false) }
  }
  const Row = ({ k, label }) => (
    <label className="flex items-center gap-3 py-2 cursor-pointer">
      <input type="checkbox" checked={chk[k]} onChange={(e) => setChk({ ...chk, [k]: e.target.checked })} className="h-5 w-5 accent-sky-600" />
      <span className="text-sm">{label}</span>
    </label>
  )
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-md max-h-[92vh] overflow-y-auto rounded-lg p-4 sm:p-6" data-testid="handover-dialog">
        <DialogHeader><DialogTitle>Serahkan HP</DialogTitle></DialogHeader>
        <div className="space-y-1">
          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1 mb-2">
            <div className="flex justify-between"><span className="text-muted-foreground">Total Biaya</span><span className="font-semibold">{rupiah(total)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Sudah Dibayar</span><span>{rupiah(paid)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Sisa Bayar</span><span className={`font-bold ${remaining > 0 ? 'text-amber-600' : 'text-green-600'}`}>{rupiah(remaining)}</span></div>
            {total > 0 && remaining > 0 && (
              <label className="flex items-center gap-3 pt-2 cursor-pointer">
                <input type="checkbox" checked={markPaid} onChange={(e) => setMarkPaid(e.target.checked)} className="h-5 w-5 accent-green-600" data-testid="mark-paid-checkbox" />
                <span className="text-sm">Pelanggan bayar sisa {rupiah(remaining)} — tandai <b>Lunas</b> (masuk pendapatan)</span>
              </label>
            )}
            {total > 0 && remaining === 0 && <div className="text-xs text-green-600 pt-1">Pembayaran sudah lunas.</div>}
          </div>
          <p className="text-sm text-muted-foreground mb-2">Cek kelengkapan sebelum menyerahkan:</p>
          <Row k="sim" label="SIM Card dikembalikan" />
          <Row k="sd" label="SD Card dikembalikan" />
          <Row k="casing" label="Silikon/Casing dikembalikan" />
          <Row k="buttons" label="Tombol diperiksa" />
          <div className="space-y-1.5 pt-2"><Label>Catatan (opsional)</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="HP sudah diterima pelanggan." rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={submit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Serahkan HP</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------- Inventory ----------------
function InventoryList({ token, initial }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(initial?.status || 'all')
  const [openForm, setOpenForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [adjustItem, setAdjustItem] = useState(null)
  const [detailItem, setDetailItem] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let q = '/inventory'; const p = []
      if (search) p.push(`search=${encodeURIComponent(search)}`)
      if (status !== 'all') p.push(`status=${status}`)
      if (p.length) q += '?' + p.join('&')
      setItems(await api(q, { token }))
    } catch { toast.error('Gagal memuat inventory.') } finally { setLoading(false) }
  }, [token, search, status])
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Inventory</h1>
        <Button onClick={() => { setEditItem(null); setOpenForm(true) }}><Plus className="h-4 w-4 mr-1" /> Barang</Button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Cari nama / kategori / merek / lokasi..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <Tabs value={status} onValueChange={setStatus}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="all">Semua</TabsTrigger>
          <TabsTrigger value="low">Menipis</TabsTrigger>
          <TabsTrigger value="out">Habis</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? <Loading /> : (
        <div className="space-y-2">
          {items.length === 0 && <EmptyState text="Tidak ada barang." />}
          {items.map((it) => {
            const low = it.stock > 0 && it.stock <= it.minStock
            const out = it.stock <= 0
            return (
              <Card key={it.id}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm">{it.name}</div>
                      <div className="text-xs text-muted-foreground">{it.category}{it.brand ? ` · ${it.brand} ${it.model || ''}` : ''}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" /> {it.location || '-'}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-lg font-bold ${out ? 'text-red-600' : low ? 'text-amber-600' : ''}`}>{it.stock}</div>
                      <div className="text-[11px] text-muted-foreground">min {it.minStock}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-medium">{rupiah(it.sellPrice)}</span>
                    <div className="flex gap-1">
                      {out && <Badge variant="outline" className="bg-red-100 text-red-700">Habis</Badge>}
                      {low && <Badge variant="outline" className="bg-amber-100 text-amber-700">Menipis</Badge>}
                      <Button size="sm" variant="outline" onClick={() => setAdjustItem(it)}>Stok</Button>
                      <Button size="sm" variant="ghost" onClick={() => setDetailItem(it)}>Riwayat</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditItem(it); setOpenForm(true) }}>Edit</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <InventoryFormDialog token={token} open={openForm} onOpenChange={setOpenForm} item={editItem} onDone={() => { setOpenForm(false); load() }} />
      <AdjustDialog token={token} item={adjustItem} onOpenChange={(v) => !v && setAdjustItem(null)} onDone={() => { setAdjustItem(null); load() }} />
      <MovementSheet token={token} item={detailItem} onOpenChange={(v) => !v && setDetailItem(null)} />
    </div>
  )
}

function InventoryFormDialog({ token, open, onOpenChange, item, onDone }) {
  const empty = { name: '', sku: '', category: 'Sparepart', brand: '', model: '', stock: 0, minStock: 0, buyPrice: 0, sellPrice: 0, location: '', note: '' }
  const [f, setF] = useState(empty)
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (open) setF(item ? { ...empty, ...item } : empty) }, [open, item])

  const submit = async () => {
    if (!f.name.trim()) return toast.error('Nama barang wajib diisi.')
    setSaving(true)
    try {
      if (item) { await api(`/inventory/${item.id}`, { method: 'PUT', token, body: f }); toast.success('Barang diperbarui.') }
      else { await api('/inventory', { method: 'POST', token, body: f }); toast.success('Barang ditambahkan.') }
      onDone()
    } catch (err) { toast.error(err.message) } finally { setSaving(false) }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-lg p-4 sm:p-6">
        <DialogHeader><DialogTitle>{item ? 'Edit Barang' : 'Barang Baru'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Nama *</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Tombol Power Samsung A52" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kategori</Label>
              <Select value={f.category} onValueChange={(value) => setF({ ...f, category: value })}>
                <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                <SelectContent>
                  {INVENTORY_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>SKU/Kode</Label><Input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Merek</Label>
              <Select value={f.brand} onValueChange={(value) => setF({ ...f, brand: value })}>
                <SelectTrigger><SelectValue placeholder="Pilih merek" /></SelectTrigger>
                <SelectContent>
                  {BRAND_OPTIONS.map((brand) => <SelectItem key={brand} value={brand}>{brand}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Model/Kompatibilitas</Label><Input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} placeholder="A52" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {!item && <div className="space-y-1.5"><Label>Stok Awal</Label><Input type="number" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} /></div>}
            <div className="space-y-1.5"><Label>Stok Minimum</Label><Input type="number" value={f.minStock} onChange={(e) => setF({ ...f, minStock: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Harga Beli</Label><Input type="number" value={f.buyPrice} onChange={(e) => setF({ ...f, buyPrice: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Harga Jual</Label><Input type="number" value={f.sellPrice} onChange={(e) => setF({ ...f, sellPrice: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Lokasi</Label><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="B-04" /></div>
          </div>
          <div className="space-y-1.5"><Label>Catatan</Label><Textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={submit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AdjustDialog({ token, item, onOpenChange, onDone }) {
  const [type, setType] = useState('STOK_MASUK')
  const [qty, setQty] = useState(1)
  const [setTo, setSetTo] = useState(0)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (item) { setType('STOK_MASUK'); setQty(1); setSetTo(item.stock); setNote('') } }, [item])
  if (!item) return null
  const submit = async () => {
    setSaving(true)
    try {
      const body = { type, qty: Number(qty), note }
      if (type === 'PENYESUAIAN') body.setTo = Number(setTo)
      await api(`/inventory/${item.id}/adjust`, { method: 'POST', token, body })
      toast.success('Stok diperbarui.')
      onDone()
    } catch (err) { toast.error(err.message) } finally { setSaving(false) }
  }
  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-sm rounded-lg p-4 sm:p-6">
        <DialogHeader><DialogTitle>Ubah Stok — {item.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">Stok saat ini: <span className="font-semibold text-foreground">{item.stock}</span></div>
          <div className="space-y-1.5"><Label>Jenis</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="STOK_MASUK">Stok Masuk (+)</SelectItem>
                <SelectItem value="STOK_KELUAR">Stok Keluar (−)</SelectItem>
                <SelectItem value="PENYESUAIAN">Penyesuaian (set jumlah)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {type === 'PENYESUAIAN'
            ? <div className="space-y-1.5"><Label>Set Stok Menjadi</Label><Input type="number" value={setTo} onChange={(e) => setSetTo(e.target.value)} /></div>
            : <div className="space-y-1.5"><Label>Jumlah</Label><Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></div>}
          <div className="space-y-1.5"><Label>Catatan</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="opsional" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={submit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const MOVE_LABEL = { STOK_AWAL: 'Stok Awal', STOK_MASUK: 'Stok Masuk', STOK_KELUAR: 'Stok Keluar', SERVICE: 'Digunakan Service', PENJUALAN: 'Penjualan', PENYESUAIAN: 'Penyesuaian' }
function MovementSheet({ token, item, onOpenChange }) {
  const [data, setData] = useState(null)
  useEffect(() => { if (item) { setData(null); api(`/inventory/${item.id}`, { token }).then(setData).catch(() => {}) } }, [item, token])
  return (
    <Sheet open={!!item} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle>Riwayat Stok</SheetTitle></SheetHeader>
        {!data ? <Loading /> : (
          <div className="mt-4 space-y-2">
            <div className="text-sm"><span className="font-semibold">{data.name}</span> — stok saat ini {data.stock}</div>
            <Separator />
            {(!data.movements || data.movements.length === 0) && <EmptyState text="Belum ada pergerakan." />}
            {(data.movements || []).map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm border-b py-2">
                <div>
                  <div className="font-medium">{MOVE_LABEL[m.type] || m.type}</div>
                  <div className="text-xs text-muted-foreground">{formatDateTime(m.createdAt)}{m.reference ? ` · ${m.reference}` : ''}</div>
                  {m.note && <div className="text-xs text-muted-foreground">{m.note}</div>}
                </div>
                <div className={`font-bold ${m.qty < 0 ? 'text-red-600' : 'text-green-600'}`}>{m.qty > 0 ? '+' : ''}{m.qty}</div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ---------------- Sales ----------------
function SaleList({ token, onPrint, initial }) {
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const load = useCallback(async () => {
    setLoading(true)
    try { setSales(await api('/sales', { token })) } catch { toast.error('Gagal memuat penjualan.') } finally { setLoading(false) }
  }, [token])
  useEffect(() => { load() }, [load])
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Penjualan</h1>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Transaksi Baru</Button>
      </div>
      {loading ? <Loading /> : (
        <div className="space-y-2">
          {sales.length === 0 && <EmptyState text="Belum ada penjualan." />}
          {sales.map((s) => (
            <Card key={s.id}><CardContent className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-sm">{s.saleNumber}</div>
                <div className="flex items-center gap-2">
                  <div className="font-bold">{rupiah(s.total)}</div>
                  {onPrint && <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onPrint(s)} aria-label="Cetak nota" data-testid="sale-print-btn"><Printer className="h-4 w-4" /></Button>}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">{formatDateTime(s.createdAt)}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.items.map((i) => `${i.name} ×${i.qty}`).join(', ')}</div>
            </CardContent></Card>
          ))}
        </div>
      )}
      <NewSaleDialog token={token} open={open} onOpenChange={setOpen} onDone={() => { setOpen(false); load() }} />
    </div>
  )
}

function NewSaleDialog({ token, open, onOpenChange, onDone }) {
  const [inv, setInv] = useState([])
  const [cart, setCart] = useState([])
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (open) { setCart([]); api('/inventory', { token }).then(setInv).catch(() => {}) } }, [open, token])

  const addToCart = (item) => {
    if (!item) return
    if (item.stock <= 0) return toast.error('Stok barang habis.')
    const existing = cart.find((c) => c.inventoryId === item.id)
    if (existing) {
      if (Number(existing.qty) + 1 > item.stock) return toast.error(`Stok ${item.name} hanya ${item.stock}.`)
      setCart(cart.map((c) => c.inventoryId === item.id ? { ...c, qty: Number(c.qty) + 1 } : c))
      return
    }
    setCart([...cart, { inventoryId: item.id, name: item.name, price: item.sellPrice, qty: 1, stock: item.stock }])
  }
  const setQty = (id, q) => setCart(cart.map((c) => c.inventoryId === id ? { ...c, qty: q } : c))
  const step = (id, d) => setCart(cart.map((c) => c.inventoryId === id ? { ...c, qty: Math.max(1, Math.min(c.stock, (Number(c.qty) || 0) + d)) } : c))
  const remove = (id) => setCart(cart.filter((c) => c.inventoryId !== id))
  const total = cart.reduce((s, c) => s + (Number(c.price) || 0) * (Number(c.qty) || 0), 0)
  const available = useMemo(() => inv.filter((x) => x.stock > 0), [inv])

  const submit = async () => {
    if (!cart.length) return toast.error('Keranjang kosong.')
    for (const c of cart) { if (Number(c.qty) <= 0) return toast.error('Quantity harus lebih dari 0.'); if (Number(c.qty) > c.stock) return toast.error(`Stok ${c.name} tidak cukup.`) }
    setSaving(true)
    try {
      await api('/sales', { method: 'POST', token, body: { items: cart.map((c) => ({ inventoryId: c.inventoryId, name: c.name, qty: Number(c.qty), price: Number(c.price) })) } })
      toast.success('Penjualan tersimpan, stok berkurang.')
      onDone()
    } catch (err) { toast.error(err.message) } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-md max-h-[92vh] overflow-y-auto rounded-lg p-4 sm:p-6" data-testid="new-sale-dialog">
        <DialogHeader><DialogTitle>Transaksi Baru</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <ItemSearch
            items={available}
            onPick={addToCart}
            placeholder="Cari barang (nama / SKU / kategori)..."
            renderMeta={(x) => `${rupiah(x.sellPrice)} · stok ${x.stock}${x.category ? ` · ${x.category}` : ''}`}
            emptyText="Barang tidak ditemukan atau stok habis."
          />
          <div className="space-y-2">
            {cart.length === 0 && <EmptyState text="Keranjang masih kosong. Cari lalu ketuk barang untuk menambahkan." />}
            {cart.map((c) => (
              <div key={c.inventoryId} className="border rounded-lg p-2.5 space-y-2" data-testid="cart-row">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-tight break-words">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{rupiah(c.price)} · stok {c.stock}</div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 -mr-1 -mt-1 text-red-500 shrink-0" onClick={() => remove(c.inventoryId)} aria-label="Hapus"><X className="h-4 w-4" /></Button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => step(c.inventoryId, -1)} aria-label="Kurangi">−</Button>
                    <Input type="number" inputMode="numeric" className="w-14 h-8 text-center px-1" value={c.qty} onChange={(e) => setQty(c.inventoryId, e.target.value)} />
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => step(c.inventoryId, 1)} aria-label="Tambah">+</Button>
                  </div>
                  <div className="text-sm font-semibold text-right">{rupiah((Number(c.price) || 0) * (Number(c.qty) || 0))}</div>
                </div>
              </div>
            ))}
          </div>
          <Separator />
          <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{rupiah(total)}</span></div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={submit} disabled={saving || cart.length === 0}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Simpan Transaksi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------- Customers ----------------
function CustomerList({ token, go }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    try { setItems(await api(`/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`, { token })) }
    catch { toast.error('Gagal memuat pelanggan.') } finally { setLoading(false) }
  }, [token, search])
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Pelanggan</h1>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Cari nama / no. HP..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {loading ? <Loading /> : (
        <div className="space-y-2">
          {items.length === 0 && <EmptyState text="Belum ada pelanggan." />}
          {items.map((c) => (
            <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => go('customer-detail', { id: c.id })}>
              <CardContent className="p-3 flex items-center justify-between">
                <div><div className="font-semibold text-sm">{c.name}</div><div className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone || '-'}</div></div>
                <Badge variant="secondary">{c.serviceCount} service</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function CustomerDetail({ token, id, go }) {
  const [data, setData] = useState(null)
  useEffect(() => { api(`/customers/${id}`, { token }).then(setData).catch(() => toast.error('Data tidak ditemukan.')) }, [id, token])
  if (!data) return <Loading />
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => go('customer')}><ChevronLeft className="h-5 w-5" /></Button>
        <div><h1 className="text-lg font-bold">{data.name}</h1><div className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {data.phone || '-'}</div></div>
      </div>
      <h2 className="text-sm font-semibold text-muted-foreground">Riwayat Service ({data.services?.length || 0})</h2>
      <div className="space-y-2">
        {(!data.services || data.services.length === 0) && <EmptyState text="Belum ada service." />}
        {(data.services || []).map((s) => (
          <Card key={s.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => go('service-detail', { id: s.id })}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between"><span className="font-semibold text-sm">{s.serviceNumber}</span><Badge variant="outline" className={statusCls(s.status)}>{statusLabel(s.status)}</Badge></div>
              <div className="text-xs text-muted-foreground">{s.brand} {s.model} — {s.complaint}</div>
              <div className="flex justify-between mt-1"><span className="text-xs text-muted-foreground">{formatDate(s.createdAt)}</span><span className="text-sm font-semibold">{rupiah(s.payment?.total)}</span></div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ---------------- Reports ----------------
function Reports({ token }) {
  const [tab, setTab] = useState('service')
  const [period, setPeriod] = useState('month')
  const [svc, setSvc] = useState(null)
  const [sale, setSale] = useState(null)
  const [invRep, setInvRep] = useState(null)

  useEffect(() => {
    if (tab === 'service') api(`/reports/services?period=${period}`, { token }).then(setSvc).catch(() => {})
    if (tab === 'sale') api(`/reports/sales?period=${period}`, { token }).then(setSale).catch(() => {})
    if (tab === 'inventory') api('/reports/inventory', { token }).then(setInvRep).catch(() => {})
  }, [tab, period, token])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Laporan</h1>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="service">Service</TabsTrigger>
          <TabsTrigger value="sale">Penjualan</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>

        {tab !== 'inventory' && (
          <div className="mt-3">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hari Ini</SelectItem>
                <SelectItem value="week">Minggu Ini</SelectItem>
                <SelectItem value="month">Bulan Ini</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <TabsContent value="service" className="mt-4 space-y-3">
          {!svc ? <Loading /> : (<>
            <StatCard icon={TrendingUp} label="Pendapatan Service Terkumpul" value={rupiah(svc.collected)} sub={`${svc.collectedCount || 0} service selesai & diambil`} tone="success" />
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Total Service Masuk" value={svc.total} />
              <StatCard label="Selesai" value={svc.done} tone="success" />
              <StatCard label="Belum Selesai" value={svc.notDone} tone="warn" />
              <StatCard label="Belum Diambil" value={svc.unclaimed} tone="warn" />
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Rincian Service Terkumpul</h3>
              {(!svc.collectedServices || svc.collectedServices.length === 0) && <EmptyState text="Belum ada service yang diambil pada periode ini." />}
              {(svc.collectedServices || []).map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm border-b py-2 gap-2" data-testid="collected-row">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{s.serviceNumber} · {s.brand} {s.model}</div>
                    <div className="text-xs text-muted-foreground truncate">{s.customerName || s.customer?.name || ''}{s.handover?.pickedUpAt ? ` · diambil ${formatDate(s.handover.pickedUpAt)}` : ''}</div>
                  </div>
                  <span className="font-semibold text-green-600 shrink-0">{rupiah(s.payment?.paid)}</span>
                </div>
              ))}
            </div>
          </>)}
        </TabsContent>

        <TabsContent value="sale" className="mt-4 space-y-3">
          {!sale ? <Loading /> : (
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Jumlah Transaksi" value={sale.count} />
              <StatCard label="Total Penjualan" value={rupiah(sale.total)} tone="success" />
            </div>
          )}
        </TabsContent>

        <TabsContent value="inventory" className="mt-4 space-y-3">
          {!invRep ? <Loading /> : (<>
            <div>
              <h3 className="text-sm font-semibold mb-2 text-amber-600">Stok Menipis ({invRep.low.length})</h3>
              {invRep.low.length === 0 && <EmptyState text="Tidak ada." />}
              {invRep.low.map((i) => <div key={i.id} className="flex justify-between text-sm border-b py-1.5"><span>{i.name}</span><span className="font-semibold text-amber-600">{i.stock} / min {i.minStock}</span></div>)}
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2 text-red-600">Stok Habis ({invRep.out.length})</h3>
              {invRep.out.length === 0 && <EmptyState text="Tidak ada." />}
              {invRep.out.map((i) => <div key={i.id} className="flex justify-between text-sm border-b py-1.5"><span>{i.name}</span><span className="font-semibold text-red-600">Habis</span></div>)}
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Pergerakan Stok Terbaru</h3>
              {invRep.movements.slice(0, 20).map((m) => (
                <div key={m.id} className="flex justify-between text-sm border-b py-1.5">
                  <div><div>{m.inventoryName}</div><div className="text-xs text-muted-foreground">{MOVE_LABEL[m.type] || m.type} · {formatDate(m.createdAt)}</div></div>
                  <span className={`font-semibold ${m.qty < 0 ? 'text-red-600' : 'text-green-600'}`}>{m.qty > 0 ? '+' : ''}{m.qty}</span>
                </div>
              ))}
            </div>
          </>)}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ---------------- Settings ----------------
function SettingsView({ token, settings, onSaved }) {
  const [f, setF] = useState(settings || {})
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  useEffect(() => { setF(settings || {}) }, [settings])
  const save = async () => {
    setSaving(true)
    try { const d = await api('/settings', { method: 'PUT', token, body: f }); onSaved(d); toast.success('Pengaturan disimpan.') }
    catch (err) { toast.error(err.message) } finally { setSaving(false) }
  }
  const seed = async () => { setSeeding(true); try { await api('/seed', { method: 'POST', token }); toast.success('Data contoh dibuat.') } catch (e) { toast.error('Gagal.') } finally { setSeeding(false) } }
  const unseed = async () => { setSeeding(true); try { await api('/seed', { method: 'DELETE', token }); toast.success('Data contoh dihapus.') } catch (e) { toast.error('Gagal.') } finally { setSeeding(false) } }
  return (
    <div className="space-y-4 max-w-lg">
      <h1 className="text-xl font-bold">Pengaturan</h1>
      <Card><CardContent className="p-4 space-y-3">
        <div className="space-y-1.5"><Label>Nama Konter</Label><Input value={f.shopName || ''} onChange={(e) => setF({ ...f, shopName: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Alamat</Label><Input value={f.address || ''} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Nomor Telepon</Label><Input value={f.phone || ''} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Footer Nota</Label><Textarea value={f.receiptFooter || ''} onChange={(e) => setF({ ...f, receiptFooter: e.target.value })} rows={2} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Prefix No. Service</Label><Input value={f.servicePrefix || ''} onChange={(e) => setF({ ...f, servicePrefix: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Prefix No. Penjualan</Label><Input value={f.salePrefix || ''} onChange={(e) => setF({ ...f, salePrefix: e.target.value })} /></div>
        </div>
        <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Simpan Pengaturan</Button>
      </CardContent></Card>
      <Card><CardContent className="p-4 space-y-2">
        <h2 className="text-sm font-semibold">Data Contoh (development)</h2>
        <p className="text-xs text-muted-foreground">Buat / hapus data contoh untuk mencoba aplikasi.</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={seed} disabled={seeding}>Buat Data Contoh</Button>
          <Button variant="outline" onClick={unseed} disabled={seeding}>Hapus Data Contoh</Button>
        </div>
      </CardContent></Card>
    </div>
  )
}

// ---------------- Receipt (print) ----------------
function Receipt({ service, settings, width }) {
  const s = service; const sisa = (s.payment?.total || 0) - (s.payment?.paid || 0)
  return (
    <div id="print-receipt" style={{ width: width === '58' ? '58mm' : '80mm' }}>
      <style>{`
        #print-receipt{position:absolute;left:-9999px;top:0;background:#fff;color:#000;padding:6px;font-family:'Courier New',monospace;font-size:${width === '58' ? '10px' : '11px'};line-height:1.4}
        #print-receipt .c{text-align:center}
        #print-receipt .b{font-weight:bold}
        #print-receipt hr{border:none;border-top:1px dashed #000;margin:4px 0}
        #print-receipt table{width:100%;border-collapse:collapse}
        #print-receipt td{vertical-align:top;padding:1px 0}
        #print-receipt .r{text-align:right}
        @media print{
          body *{visibility:hidden !important}
          #print-receipt,#print-receipt *{visibility:visible !important}
          #print-receipt{left:0 !important;position:absolute !important}
          @page{margin:0}
        }
      `}</style>
      <div className="c b" style={{ fontSize: width === '58' ? '13px' : '15px' }}>{settings?.shopName || 'Konter Ponsel'}</div>
      {settings?.address && <div className="c">{settings.address}</div>}
      {settings?.phone && <div className="c">{settings.phone}</div>}
      <hr />
      <table>
        <tbody>
          <tr><td>No.</td><td className="r b">{s.serviceNumber}</td></tr>
          <tr><td>Tanggal</td><td className="r">{formatDate(s.createdAt)}</td></tr>
          <tr><td>Pelanggan</td><td className="r">{s.customerName}</td></tr>
          {s.customerPhone && <tr><td>No. HP</td><td className="r">{s.customerPhone}</td></tr>}
          <tr><td>HP</td><td className="r">{s.brand} {s.model}</td></tr>
          <tr><td>Keluhan</td><td className="r">{s.complaint}</td></tr>
          <tr><td>Status</td><td className="r">{statusLabel(s.status)}</td></tr>
        </tbody>
      </table>
      {(s.items && s.items.length > 0) && (<>
        <hr />
        <table><tbody>
          {s.items.map((it) => (
            <tr key={it.id}><td>{it.description}{it.qty > 1 ? ` x${it.qty}` : ''}</td><td className="r">{rupiah(it.total)}</td></tr>
          ))}
        </tbody></table>
      </>)}
      <hr />
      <table><tbody>
        <tr><td className="b">TOTAL</td><td className="r b">{rupiah(s.payment?.total)}</td></tr>
        <tr><td>Dibayar</td><td className="r">{rupiah(s.payment?.paid)}</td></tr>
        <tr><td>Sisa</td><td className="r">{rupiah(sisa)}</td></tr>
      </tbody></table>
      <hr />
      <div className="c">Simpan nota ini dan tunjukkan saat pengambilan perangkat.</div>
      {settings?.receiptFooter && <div className="c" style={{ marginTop: 4 }}>{settings.receiptFooter}</div>}
    </div>
  )
}

function SaleReceipt({ sale, settings, width }) {
  const s = sale
  return (
    <div id="print-receipt" style={{ width: width === '58' ? '58mm' : '80mm' }}>
      <style>{`
        #print-receipt{position:absolute;left:-9999px;top:0;background:#fff;color:#000;padding:6px;font-family:'Courier New',monospace;font-size:${width === '58' ? '10px' : '11px'};line-height:1.4}
        #print-receipt .c{text-align:center}
        #print-receipt .b{font-weight:bold}
        #print-receipt hr{border:none;border-top:1px dashed #000;margin:4px 0}
        #print-receipt table{width:100%;border-collapse:collapse}
        #print-receipt td{vertical-align:top;padding:1px 0}
        #print-receipt .r{text-align:right}
        @media print{
          body *{visibility:hidden !important}
          #print-receipt,#print-receipt *{visibility:visible !important}
          #print-receipt{left:0 !important;position:absolute !important}
          @page{margin:0}
        }
      `}</style>
      <div className="c b" style={{ fontSize: width === '58' ? '13px' : '15px' }}>{settings?.shopName || 'Konter Ponsel'}</div>
      {settings?.address && <div className="c">{settings.address}</div>}
      {settings?.phone && <div className="c">{settings.phone}</div>}
      <hr />
      <table><tbody>
        <tr><td>No.</td><td className="r b">{s.saleNumber}</td></tr>
        <tr><td>Tanggal</td><td className="r">{formatDateTime(s.createdAt)}</td></tr>
      </tbody></table>
      <hr />
      <table><tbody>
        {(s.items || []).map((it, i) => (
          <tr key={i}><td>{it.name} <span style={{ whiteSpace: 'nowrap' }}>{it.qty} x {rupiah(it.price)}</span></td><td className="r">{rupiah((it.qty || 0) * (it.price || 0))}</td></tr>
        ))}
      </tbody></table>
      <hr />
      <table><tbody><tr><td className="b">TOTAL</td><td className="r b">{rupiah(s.total)}</td></tr></tbody></table>
      <hr />
      <div className="c">Terima kasih atas kunjungan Anda.</div>
      {settings?.receiptFooter && <div className="c" style={{ marginTop: 4 }}>{settings.receiptFooter}</div>}
    </div>
  )
}

// ---------------- shared UI ----------------
function Loading() { return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> }
function EmptyState({ text }) { return <div className="text-center py-8 text-sm text-muted-foreground">{text}</div> }

// ---------------- Shell ----------------
function Shell({ me, settings, tab, go, onLogout, children }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const bottomNav = NAV.slice(0, 4)
  const NavBtn = ({ item, active, onClick }) => (
    <button onClick={onClick} className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-slate-300 hover:bg-slate-800'}`}>
      <item.icon className="h-5 w-5" /> {item.label}
    </button>
  )
  return (
    <div className="min-h-screen bg-muted/30">
      {/* desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 bg-slate-900 flex-col p-3 gap-1 z-20">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="h-9 w-9 rounded-xl bg-slate-800 flex items-center justify-center"><Smartphone className="h-5 w-5 text-sky-400" /></div>
          <div><div className="text-white font-bold leading-tight">Konter</div><div className="text-[11px] text-slate-400 truncate max-w-[150px]">{settings?.shopName}</div></div>
        </div>
        <div className="flex-1 space-y-1 mt-2">
          {NAV.map((item) => <NavBtn key={item.key} item={item} active={tab === item.key} onClick={() => go(item.key)} />)}
        </div>
        <div className="text-[11px] text-slate-400 px-2 truncate">{me?.email}</div>
        <button onClick={onLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:bg-slate-800"><LogOut className="h-5 w-5" /> Keluar</button>
      </aside>

      {/* main */}
      <div className="md:pl-60">
        <header className="md:hidden sticky top-0 z-10 bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2"><Smartphone className="h-5 w-5 text-sky-400" /><span className="font-bold">Konter</span></div>
          <button onClick={onLogout}><LogOut className="h-5 w-5" /></button>
        </header>
        <main className="p-4 pb-24 md:pb-8 max-w-5xl mx-auto">{children}</main>
      </div>

      {/* mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t z-20 grid grid-cols-5">
        {bottomNav.map((item) => (
          <button key={item.key} onClick={() => go(item.key)} className={`flex flex-col items-center py-2 text-[11px] ${tab === item.key ? 'text-sky-600' : 'text-slate-500'}`}>
            <item.icon className="h-5 w-5 mb-0.5" /> {item.label}
          </button>
        ))}
        <button onClick={() => setMoreOpen(true)} className={`flex flex-col items-center py-2 text-[11px] ${['customer', 'report', 'setting'].includes(tab) ? 'text-sky-600' : 'text-slate-500'}`}>
          <MenuIcon className="h-5 w-5 mb-0.5" /> Lainnya
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader><SheetTitle>Menu Lainnya</SheetTitle></SheetHeader>
          <div className="grid grid-cols-3 gap-3 py-4">
            {NAV.slice(4).map((item) => (
              <button key={item.key} onClick={() => { go(item.key); setMoreOpen(false) }} className="flex flex-col items-center gap-2 p-4 rounded-xl border hover:bg-muted">
                <item.icon className="h-6 w-6 text-sky-600" /><span className="text-xs font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ---------------- Printing helpers (Bluetooth thermal) ----------------
const BT_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000ff00-0000-1000-8000-00805f9b34fb', '0000ffe0-0000-1000-8000-00805f9b34fb', '0000ae30-0000-1000-8000-00805f9b34fb',
  '0000fff0-0000-1000-8000-00805f9b34fb', '0000ff12-0000-1000-8000-00805f9b34fb',
]
let btDevice = null
let btChar = null
function b64ToBytes(b64) { const bin = atob(b64); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out }

async function btConnect(onStatus) {
  if (typeof navigator === 'undefined' || !navigator.bluetooth) throw new Error('Browser ini tidak mendukung Web Bluetooth. Gunakan Chrome di Android/Windows, atau pakai cara RawBT.')
  if (!btDevice) {
    onStatus('Pilih printer dari daftar...')
    btDevice = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: BT_SERVICES })
    btDevice.addEventListener('gattserverdisconnected', () => { btChar = null })
  }
  if (!btChar || !btDevice.gatt.connected) {
    onStatus(`Menghubungkan ke ${btDevice.name || 'printer'}...`)
    const server = await btDevice.gatt.connect()
    const services = await server.getPrimaryServices()
    btChar = null
    for (const svc of services) {
      const chars = await svc.getCharacteristics()
      const c = chars.find((x) => x.properties.writeWithoutResponse) || chars.find((x) => x.properties.write)
      if (c) { btChar = c; break }
    }
    if (!btChar) { try { btDevice.gatt.disconnect() } catch {} ; btDevice = null; throw new Error('Printer tidak punya jalur tulis Bluetooth LE (kemungkinan hanya Bluetooth klasik). Gunakan cara RawBT.') }
  }
  return btChar
}

async function btPrint(bytes, onStatus) {
  const ch = await btConnect(onStatus)
  onStatus('Mengirim data ke printer...')
  const CHUNK = 100
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const part = bytes.slice(i, i + CHUNK)
    if (ch.properties.writeWithoutResponse) await ch.writeValueWithoutResponse(part)
    else await ch.writeValue(part)
    await new Promise((r) => setTimeout(r, 40))
  }
}

function rawbtPrint(b64) {
  const fallback = encodeURIComponent('https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter')
  const isAndroid = /android/i.test(navigator.userAgent)
  if (isAndroid) window.location.href = `intent:base64,${b64}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;S.browser_fallback_url=${fallback};end`
  else window.location.href = `rawbt:base64,${b64}`
}

function PrintDialog({ target, token, onClose, onBrowserPrint }) {
  const [width, setWidth] = useState(() => (typeof window !== 'undefined' && localStorage.getItem('konter_print_width')) || '58')
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const hasBt = typeof navigator !== 'undefined' && !!navigator.bluetooth
  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)

  useEffect(() => {
    if (!target) return
    setData(null)
    const path = target.kind === 'sale' ? `/sales/${target.data.id}/escpos?width=${width}` : `/services/${target.data.id}/escpos?width=${width}`
    api(path, { token }).then(setData).catch(() => toast.error('Gagal menyiapkan data nota.'))
  }, [target, width, token])

  const pickWidth = (w) => { setWidth(w); localStorage.setItem('konter_print_width', w) }

  const doBt = async () => {
    if (!data) return
    setBusy(true)
    try {
      await btPrint(b64ToBytes(data.base64), setStatus)
      toast.success('Nota terkirim ke printer.')
      onClose()
    } catch (err) {
      if (err?.name === 'NotFoundError') toast.info('Pemilihan printer dibatalkan.')
      else { toast.error(err?.message || 'Gagal mencetak via Bluetooth.'); if (!btChar) btDevice = null }
    } finally { setBusy(false); setStatus('') }
  }
  const doRawbt = () => { if (!data) return; rawbtPrint(data.base64); toast.info('Membuka RawBT...') }
  const disconnectBt = () => { try { btDevice?.gatt?.disconnect() } catch {} ; btDevice = null; btChar = null; toast.success('Printer Bluetooth dilepas. Pilih ulang saat cetak berikutnya.') }

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-md max-h-[92vh] overflow-y-auto rounded-lg p-4 sm:p-6" data-testid="print-dialog">
        <DialogHeader><DialogTitle>Cetak Nota {target?.kind === 'sale' ? 'Penjualan' : 'Service'}</DialogTitle></DialogHeader>
        <div className="space-y-4 min-w-0 max-w-full overflow-hidden">
          <div className="space-y-1.5">
            <Label>Ukuran kertas</Label>
            <div className="flex gap-2">
              <Button className="flex-1" variant={width === '58' ? 'default' : 'outline'} onClick={() => pickWidth('58')}>58mm</Button>
              <Button className="flex-1" variant={width === '80' ? 'default' : 'outline'} onClick={() => pickWidth('80')}>80mm</Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cara cetak</Label>
            <Button className="w-full justify-start h-auto py-3 whitespace-normal min-w-0" onClick={doRawbt} disabled={!data || busy} data-testid="print-rawbt">
              <Printer className="h-5 w-5 mr-3 shrink-0" />
              <span className="text-left min-w-0"><span className="block font-semibold">Printer Bluetooth via RawBT</span><span className="block text-xs opacity-80 font-normal">Cara paling andal untuk RPP02N &amp; printer 58mm Bluetooth (aplikasi gratis)</span></span>
            </Button>
            <Button className="w-full justify-start h-auto py-3 whitespace-normal min-w-0" variant="outline" onClick={doBt} disabled={!data || busy || !hasBt} data-testid="print-bluetooth">
              {busy ? <Loader2 className="h-5 w-5 mr-3 animate-spin shrink-0" /> : <Smartphone className="h-5 w-5 mr-3 shrink-0" />}
              <span className="text-left"><span className="block font-semibold">Bluetooth langsung (Web Bluetooth)</span><span className="block text-xs text-muted-foreground font-normal">{hasBt ? (busy && status ? status : 'Tanpa aplikasi tambahan. Hanya untuk printer yang mendukung Bluetooth LE.') : 'Tidak didukung browser ini (pakai Chrome Android/Windows).'}</span></span>
            </Button>
            <Button className="w-full justify-start h-auto py-3 whitespace-normal min-w-0" variant="outline" onClick={() => onBrowserPrint(width)} disabled={busy} data-testid="print-browser">
              <FileBarChart className="h-5 w-5 mr-3 shrink-0" />
              <span className="text-left"><span className="block font-semibold">Print browser (laptop / printer USB / WiFi)</span><span className="block text-xs text-muted-foreground font-normal">Membuka dialog print biasa.</span></span>
            </Button>
          </div>

          {isAndroid && (
            <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
              <div className="font-semibold text-foreground">Setting sekali saja untuk RawBT:</div>
              <div>1. Install <b>RawBT</b> dari Play Store (gratis).</div>
              <div>2. Pairing printer di Bluetooth HP (PIN biasanya 0000 / 1234).</div>
              <div>3. Buka RawBT → Settings → Connection: <b>Bluetooth</b> → pilih printer → Paper width <b>58mm</b>.</div>
              <div>4. Kembali ke sini, tekan tombol RawBT di atas. Selanjutnya cukup 1 ketukan.</div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setShowPreview((v) => !v)}>{showPreview ? 'Sembunyikan' : 'Lihat'} pratinjau</Button>
            {btDevice && <Button variant="ghost" size="sm" className="text-red-500" onClick={disconnectBt}>Lepas printer BT</Button>}
          </div>
          {showPreview && (
            <pre className="text-[10px] leading-tight bg-white text-black border rounded p-2 overflow-x-auto font-mono w-full max-w-full" data-testid="print-preview">{data ? data.preview : 'Menyiapkan...'}</pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------- Root App ----------------
function App() {
  const [token, setToken] = useState(null)
  const [me, setMe] = useState(null)
  const [ready, setReady] = useState(false)
  const [settings, setSettings] = useState(null)
  const [nav, setNav] = useState({ tab: 'dashboard', params: {} })
  const [printService, setPrintService] = useState(null)
  const [printWidth, setPrintWidth] = useState('80')
  const [printAsk, setPrintAsk] = useState(null)

  const go = (tab, params = {}) => setNav({ tab, params })

  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('konter_token') : null
    if (!t) { setReady(true); return }
    api('/auth/me', { token: t }).then((d) => { setToken(t); setMe(d.user) })
      .catch(() => localStorage.removeItem('konter_token')).finally(() => setReady(true))
  }, [])

  useEffect(() => { if (token) api('/settings', { token }).then(setSettings).catch(() => {}) }, [token])

  useEffect(() => {
    const h = () => setPrintService(null)
    window.addEventListener('afterprint', h)
    return () => window.removeEventListener('afterprint', h)
  }, [])

  const onLogin = (t, u) => { localStorage.setItem('konter_token', t); setToken(t); setMe(u) }
  const onLogout = () => { localStorage.removeItem('konter_token'); setToken(null); setMe(null); go('dashboard') }

  const askPrint = (svc) => setPrintAsk({ kind: 'service', data: svc })
  const askPrintSale = (sale) => setPrintAsk({ kind: 'sale', data: sale })
  const doBrowserPrint = (w) => { const t = printAsk; setPrintWidth(w); setPrintAsk(null); setPrintService(t); setTimeout(() => window.print(), 300) }

  if (!ready) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
  if (!token) return (<><LoginScreen onLogin={onLogin} /><Toaster richColors position="top-center" /></>)

  let content = null
  const { tab, params } = nav
  if (tab === 'dashboard') content = <Dashboard token={token} go={go} />
  else if (tab === 'service') content = <ServiceList token={token} go={go} initial={params} />
  else if (tab === 'service-detail') content = <ServiceDetail token={token} id={params.id} go={go} onPrint={askPrint} />
  else if (tab === 'inventory') content = <InventoryList token={token} initial={params} />
  else if (tab === 'sale') content = <SaleList token={token} onPrint={askPrintSale} initial={params} />
  else if (tab === 'customer') content = <CustomerList token={token} go={go} />
  else if (tab === 'customer-detail') content = <CustomerDetail token={token} id={params.id} go={go} />
  else if (tab === 'report') content = <Reports token={token} />
  else if (tab === 'setting') content = <SettingsView token={token} settings={settings} onSaved={setSettings} />

  const shellTab = tab.replace('-detail', '')
  return (
    <>
      <Shell me={me} settings={settings} tab={shellTab} go={go} onLogout={onLogout}>{content}</Shell>
      {printService && (printService.kind === 'sale'
        ? <SaleReceipt sale={printService.data} settings={settings} width={printWidth} />
        : <Receipt service={printService.data} settings={settings} width={printWidth} />)}
      <PrintDialog target={printAsk} token={token} onClose={() => setPrintAsk(null)} onBrowserPrint={doBrowserPrint} />
      <Toaster richColors position="top-center" />
    </>
  )
}

export default App
