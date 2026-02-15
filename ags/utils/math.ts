export const clamp01 = (n: any, fallback = 0.5) => {
  const v = Number(n)
  if (!Number.isFinite(v)) return fallback
  return Math.max(0, Math.min(1, v))
}
