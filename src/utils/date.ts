export function formatDateBR(value?: string | null): string {
  if (!value) return ""

  const raw = String(value).trim()
  if (!raw) return ""

  const datePart = raw.slice(0, 10)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart)

  if (m) {
    const [, y, mo, d] = m
    return `${d}/${mo}/${y}`
  }

  return raw
}

export function formatDateTimeBR(value?: string | null): string {
  if (!value) return ""

  const raw = String(value).trim()
  if (!raw) return ""

  const m = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/.exec(raw)
  if (m) {
    const [, y, mo, d, h, mi] = m
    return `${d}/${mo}/${y} ${h}:${mi}`
  }

  try {
    const dt = new Date(raw)
    if (Number.isNaN(dt.getTime())) return raw
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
  } catch {
    return raw
  }
}