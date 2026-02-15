import GLib from "gi://GLib?version=2.0"
import Gdk from "gi://Gdk?version=4.0"
import GdkPixbuf from "gi://GdkPixbuf?version=2.0"

let lastCoverTexturePath = ""
let lastCoverTexture: Gdk.Texture | null = null

let lastScaledTextureKey = ""
let lastScaledTexture: Gdk.Texture | null = null

export const getCoverTexture = (filePath: string) => {
  if (!filePath) return null
  if (filePath === lastCoverTexturePath && lastCoverTexture) return lastCoverTexture
  try {
    const tex = Gdk.Texture.new_from_filename(filePath)
    lastCoverTexturePath = filePath
    lastCoverTexture = tex
    return tex
  } catch {
    lastCoverTexturePath = filePath
    lastCoverTexture = null
    return null
  }
}

export const getTextureAtScale = (filePath: string, size: number) => {
  const p = String(filePath || "")
  const s = Math.max(1, Math.floor(Number(size) || 0))
  if (!p) return null
  const key = `${p}|${s}`
  if (key === lastScaledTextureKey) return lastScaledTexture

  try {
    const pb = GdkPixbuf.Pixbuf.new_from_file_at_scale(p, s, s, true)
    const tex = Gdk.Texture.new_for_pixbuf(pb)
    lastScaledTextureKey = key
    lastScaledTexture = tex
    return tex
  } catch {
    // Fallback: load raw texture if pixbuf scaling fails.
    const tex = getCoverTexture(p)
    lastScaledTextureKey = key
    lastScaledTexture = tex
    return tex
  }
}
