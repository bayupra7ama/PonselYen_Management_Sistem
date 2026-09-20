// Shared helpers, constants, and API wrapper for Konter app

export async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  let data = null
  try { data = await res.json() } catch { data = null }
  if (!res.ok) {
    const msg = (data && data.error) || 'Terjadi kesalahan. Silakan coba lagi.'
    const err = new Error(msg)
    err.status = res.status
    throw err
  }
  return data
}

export function rupiah(n) {
  const num = Number(n) || 0
  return 'Rp' + num.toLocaleString('id-ID')
}

export function formatDate(d) {
  if (!d) return '-'
  try {
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return '-' }
}

export function formatDateTime(d) {
  if (!d) return '-'
  try {
    return new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return '-' }
}

export function daysWaiting(d) {
  if (!d) return 0
  const diff = Date.now() - new Date(d).getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

export const STATUSES = [
  { value: 'MENUNGGU', label: 'Menunggu' },
  { value: 'DIAGNOSA', label: 'Diagnosa' },
  { value: 'MENUNGGU_PERSETUJUAN', label: 'Menunggu Persetujuan' },
  { value: 'MENUNGGU_SPAREPART', label: 'Menunggu Sparepart' },
  { value: 'DALAM_PERBAIKAN', label: 'Dalam Perbaikan' },
  { value: 'SELESAI', label: 'Selesai' },
  { value: 'SUDAH_DIAMBIL', label: 'Sudah Diambil' },
  { value: 'BATAL', label: 'Batal' },
]

export const STATUS_META = {
  MENUNGGU: { label: 'Menunggu', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  DIAGNOSA: { label: 'Diagnosa', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  MENUNGGU_PERSETUJUAN: { label: 'Menunggu Persetujuan', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  MENUNGGU_SPAREPART: { label: 'Menunggu Sparepart', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  DALAM_PERBAIKAN: { label: 'Dalam Perbaikan', cls: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  SELESAI: { label: 'Selesai', cls: 'bg-green-100 text-green-700 border-green-200' },
  SUDAH_DIAMBIL: { label: 'Sudah Diambil', cls: 'bg-slate-200 text-slate-600 border-slate-300' },
  BATAL: { label: 'Batal', cls: 'bg-red-100 text-red-700 border-red-200' },
}

export function statusLabel(v) { return STATUS_META[v]?.label || v }
export function statusCls(v) { return STATUS_META[v]?.cls || 'bg-slate-100 text-slate-700' }
