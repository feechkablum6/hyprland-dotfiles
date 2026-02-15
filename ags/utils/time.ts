export const fmtTime = (sec: number) => {
  const s = Math.max(0, Math.floor(sec || 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

export const toSec = (v: any) => {
  const n = Number(v || 0)
  if (!Number.isFinite(n) || n <= 0) return 0
  return n > 10_000 ? n / 1_000_000 : n
}

export const toUs = (sec: number) => Math.round(Math.max(0, Number(sec) || 0) * 1_000_000)
