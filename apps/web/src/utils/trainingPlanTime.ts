const HOUR_MS = 60 * 60 * 1000
const CN_OFFSET_MS = 8 * HOUR_MS
const DAY_MS = 24 * HOUR_MS

/// 训练中心按北京时间(UTC+8, 无夏令时)排计划, 视图一律按北京时间划分日/月, 不受浏览器所在时区影响
export function cnTodayString(): string {
  return new Date(Date.now() + CN_OFFSET_MS).toISOString().slice(0, 10)
}

export function cnDayRange(day: string): { fromIso: string; toIso: string; startMs: number } {
  const [y, m, d] = day.split('-').map(Number)
  const startMs = Date.UTC(y, m - 1, d) - CN_OFFSET_MS
  return { fromIso: new Date(startMs).toISOString(), toIso: new Date(startMs + DAY_MS).toISOString(), startMs }
}

export function cnMonthRange(month: string): { fromIso: string; toIso: string; startMs: number; days: string[] } {
  const [y, m] = month.split('-').map(Number)
  const startMs = Date.UTC(y, m - 1, 1) - CN_OFFSET_MS
  const endMs = Date.UTC(y, m, 1) - CN_OFFSET_MS
  const dayCount = Math.round((endMs - startMs) / DAY_MS)
  const days = Array.from({ length: dayCount }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
  return { fromIso: new Date(startMs).toISOString(), toIso: new Date(endMs).toISOString(), startMs, days }
}

export function cnHourMinute(ms: number): string {
  const d = new Date(ms + CN_OFFSET_MS)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

export function cnDateTimeLabel(iso: string): string {
  const ms = Date.parse(iso)
  return `${new Date(ms + CN_OFFSET_MS).toISOString().slice(0, 10)} ${cnHourMinute(ms)}`
}

export function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10)
}

export function weekdayLabel(day: string, locale: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)))
}

const FALLBACK_PALETTE = ['#4096ff', '#13a8a8', '#d48806', '#9254de', '#cf1322', '#389e0d', '#d4380d', '#08979c', '#531dab', '#7cb305']

/// 未在"客户配置"里设置颜色的客户, 按名称稳定地映射到一个调色板颜色, 保证同一客户每次颜色一致
export function fallbackColor(name?: string | null): string {
  if (!name) return '#8c8c8c'
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length]
}

export function readableTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#1f1f1f' : '#ffffff'
}
