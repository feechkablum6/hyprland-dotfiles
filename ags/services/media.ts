import Mpris from "gi://AstalMpris"
import GLib from "gi://GLib?version=2.0"
import Gdk from "gi://Gdk?version=4.0"
import { createState } from "ags"
import { interval, timeout } from "ags/time"
import { MediaSnapshot, MediaTime, MediaService } from "../types/media"
import { sh, playerctl, wpctl } from "../utils/exec"
import { toSec, toUs } from "../utils/time"
import { getTextureAtScale, getCoverTexture } from "../utils/image"
import { clamp01 } from "../utils/math"
import { iconPath } from "../utils/file"

const mpris = Mpris.get_default()

const emptySnap: MediaSnapshot = {
  has: false,
  title: "",
  artist: "",
  album: "",
  line: "",
  cover: "",
  status: "Stopped",
  service: "unknown",
  appIcon: "multimedia-player-symbolic",
  volume: 0.5,
  canSeek: false,
  canPrev: false,
  canNext: false,
  canControl: false,
}

export const [mediaSnap, setMediaSnap] = createState<MediaSnapshot>(emptySnap)
export const [mediaTime, setMediaTime] = createState<MediaTime>({ pos: 0, len: 1 })
export const [mediaOpen, setMediaOpen] = createState(false)
export const [mediaCover, setMediaCover] = createState<Gdk.Paintable | null>(null)

let mediaP: any = null
let lastLogKey = ""
let lastTrackKey = ""
let lastCoverPath = ""
let lastVolumeSetAt = 0
let volTimer: any = null
let mediaPosTimer: any = null
let mediaHideTimer: any = null
let cachedPlayerctlName = ""
let cachedPlayerctlKey = ""
let cachedStreamId = 0
let cachedStreamAt = 0

const EMPTY_COVER = `${GLib.get_home_dir()}/.config/ags/assets/empty-cover.png`
const COVER_SIZE = 200

const hoverState = { pill: false, popup: false }

const readXesamAlbum = (p: any) => {
  let album = String(p?.album ?? "").trim()
  if (album) return album
  const md = p?.metadata ?? p?.["metadata"]
  try {
    if (md && typeof md.deepUnpack === "function") {
      const obj = md.deepUnpack()
      const v = obj?.["xesam:album"]
      if (typeof v === "string") return v.trim()
    }
  } catch {
    // ignore
  }
  return ""
}

const readTrackId = (p: any) => {
  const md = p?.metadata ?? p?.["metadata"]
  try {
    if (md && typeof md.deepUnpack === "function") {
      const obj = md.deepUnpack()
      const v = obj?.["mpris:trackid"]
      if (typeof v === "string") return v
    }
  } catch {
    // ignore
  }
  return ""
}

const resolveService = (p: any, album: string): MediaService => {
  const entry = String(p?.desktop_entry ?? p?.["desktop-entry"] ?? p?.entry ?? p?.identity ?? "").toLowerCase()
  const name = String(p?.name ?? "").toLowerCase()

  if (entry.includes("yandex") && entry.includes("music")) return "yandex-music"
  if (entry.includes("youtube")) return "youtube"
  if (entry.includes("twitch")) return "twitch"

  const cover = String(p?.cover_art ?? p?.["cover-art"] ?? "").toLowerCase()
  let trackid = ""
  let url = ""
  try {
    const md = p?.metadata ?? p?.["metadata"]
    if (md && typeof md.deepUnpack === "function") {
      const obj = md.deepUnpack()
      const v = obj?.["mpris:trackid"]
      if (typeof v === "string") trackid = v.toLowerCase()
      const u = obj?.["xesam:url"]
      if (typeof u === "string") url = u.toLowerCase()
    }
  } catch {
    // ignore
  }

  const isChromeLike =
    /chrom|chrome|brave|vivaldi|edge/.test(entry) ||
    /chrom|chrome|brave|vivaldi|edge/.test(name) ||
    cover.includes(".com.google.chrome") ||
    cover.includes("chrome") ||
    trackid.includes("/org/chromium/")

  if (!isChromeLike) return "unknown"

  if (url.includes("twitch.tv") || name.includes("twitch") || cover.includes("twitch")) return "twitch"
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube"
  if (url.includes("music.yandex.ru")) return "yandex-music"

  if (album) return "yandex-music"
  return "youtube"
}

const resolveAppIconName = (p: any): string => {
  const entry = String(p?.desktop_entry ?? p?.["desktop-entry"] ?? p?.entry ?? p?.identity ?? p?.["identity"] ?? "").toLowerCase()
  const name = String(p?.name ?? "").toLowerCase()

  const id = entry || name
  if (id.includes("spotify")) return "spotify"
  if (id.includes("firefox")) return "firefox"
  if (id.includes("chromium")) return "chromium"
  if (id.includes("chrome")) return "google-chrome"
  if (id.includes("brave")) return "brave-browser"
  return "multimedia-player-symbolic"
}

const pickPlayer = () => {
  const ps = (mpris as any)?.players
  if (!Array.isArray(ps) || ps.length === 0) return null

  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i]
    const st = Number(p?.playback_status ?? p?.["playback-status"])
    const title = String(p?.title ?? "").trim()
    if (st === 0 && title) return p
  }
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i]
    const st = Number(p?.playback_status ?? p?.["playback-status"])
    if (st === 0) return p
  }
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i]
    const st = Number(p?.playback_status ?? p?.["playback-status"])
    const title = String(p?.title ?? "").trim()
    if (st !== 2 && title) return p
  }
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i]
    const st = Number(p?.playback_status ?? p?.["playback-status"])
    if (st !== 2) return p
  }
  return ps[ps.length - 1] || null
}

const coverToFilename = (s: string) => {
  const v = String(s || "")
  if (!v) return ""
  if (v.startsWith("file://")) {
    try {
      const [path] = GLib.filename_from_uri(v)
      return path || ""
    } catch {
      return ""
    }
  }
  return v
}

const updateCover = (cover: string, isStopped: boolean) => {
    if (isStopped) {
        if (lastCoverPath !== "__idle__") {
            const placeholderTex = GLib.file_test(EMPTY_COVER, GLib.FileTest.EXISTS) ? getTextureAtScale(EMPTY_COVER, COVER_SIZE) : null
            setMediaCover(placeholderTex)
            lastCoverPath = "__idle__"
        }
        return
    }

    const fn = coverToFilename(cover)
    if (fn === lastCoverPath && mediaCover()) return

    const coverTex = fn && GLib.file_test(fn, GLib.FileTest.EXISTS) ? getTextureAtScale(fn, COVER_SIZE) : null
    const placeholderTex = GLib.file_test(EMPTY_COVER, GLib.FileTest.EXISTS) ? getTextureAtScale(EMPTY_COVER, COVER_SIZE) : null
    const tex = coverTex || placeholderTex

    setMediaCover(tex)
    lastCoverPath = fn
}

const resolveWpctlStreamId = async () => {
  const now = Date.now()
  if (cachedStreamId && now - cachedStreamAt < 10_000) return cachedStreamId

  const out = String(await wpctl("status")).split("\n")
  let inStreams = false
  const streams: Array<{ id: number; name: string }> = []

  for (const raw of out) {
    const line = raw.replace(/\t/g, " ")
    if (line.includes("└─ Streams:") || line.includes("|- Streams:") || line.trim() === "Streams:") {
      inStreams = true
      continue
    }
    if (inStreams) {
      if (/^\s*Video\b/.test(line) || /^\s*Settings\b/.test(line)) break
      if (line.includes(">")) continue
      const m = line.match(/^\s*(\d+)\.\s+(.*)$/)
      if (!m) continue
      const id = Number(m[1])
      const name = String(m[2] || "").trim()
      if (!Number.isFinite(id) || id <= 0 || !name) continue
      streams.push({ id, name })
    }
  }

  const snap = mediaSnap()
  const wantChrome = snap.service === "youtube" || snap.service === "yandex-music"

  const prefer = (s: { id: number; name: string }) => {
    const n = s.name.toLowerCase()
    if (wantChrome) {
      if (n.includes("google chrome")) return 3
      if (n.includes("chromium") || n.includes("chrome")) return 2
      if (n.includes("brave") || n.includes("vivaldi") || n.includes("edge")) return 1
      return 0
    }
    return 0
  }

  streams.sort((a, b) => prefer(b) - prefer(a))
  cachedStreamId = streams[0]?.id || 0
  cachedStreamAt = now
  return cachedStreamId
}

const syncMedia = () => {
  const p = pickPlayer()
  mediaP = p

  if (!p) {
    updateCover("", true)
    setMediaSnap({
      ...emptySnap,
      has: true,
      line: "Ничего не играет",
    })
    return
  }

  const title = String(p?.title ?? "")
  const artist = String(p?.artist ?? "")
  const album = readXesamAlbum(p)
  const line = [artist, title].filter((s) => String(s || "").trim()).join(" - ")
  const rawCover = String(p?.cover_art ?? p?.["cover-art"] ?? "")

  const trackId = readTrackId(p)
  const trackKey = trackId || `${artist}|${title}|${rawCover}`
  if (trackKey && trackKey !== lastTrackKey) {
    lastTrackKey = trackKey
    if (mediaPosTimer) {
      timeout(0, mediaUpdatePos)
    } else {
      setMediaTime({ pos: 0, len: 1 })
    }
  }

  const st = Number(p?.playback_status ?? p?.["playback-status"])
  const status: MediaSnapshot["status"] = st === 0 ? "Playing" : st === 1 ? "Paused" : "Stopped"

  updateCover(rawCover, status === "Stopped")

  const service = status === "Stopped" ? "unknown" : resolveService(p, album)

  const logKey = `${service}|${status}|${artist}|${title}`
  if (logKey !== lastLogKey) {
    lastLogKey = logKey
    const logo = service === "youtube" ? iconPath("services/youtube.png") : service === "yandex-music" ? iconPath("services/yandex-music.png") : ""
    console.log("media:", {
      service,
      status,
      title,
      artist,
      album,
      cover: rawCover ? rawCover.slice(0, 80) : "",
      logoExists: logo ? GLib.file_test(logo, GLib.FileTest.EXISTS) : false,
      logoPath: logo,
    })
  }

  const prev = mediaSnap()
  const pv = Number((p as any)?.volume)
  const recentlySet = Date.now() - lastVolumeSetAt < 2000
  const vol = (Number.isFinite(pv) && pv >= 0 && !recentlySet) ? clamp01(pv, prev.volume) : prev.volume

  if (status === "Stopped") {
    setMediaSnap({
      ...emptySnap,
      has: true,
      status,
      line: "Ничего не играет",
      appIcon: resolveAppIconName(p),
    })
    return
  }

  setMediaSnap({
    has: true,
    title,
    artist,
    album,
    line: line || "Ничего не играет",
    cover: rawCover,
    status,
    service,
    appIcon: resolveAppIconName(p),
    volume: vol,
    canSeek: !!(p?.can_seek ?? p?.["can-seek"]),
    canPrev: !!(p?.can_go_previous ?? p?.["can-go-previous"]),
    canNext: !!(p?.can_go_next ?? p?.["can-go-next"]),
    canControl: !!(p?.can_control ?? p?.["can-control"]),
  })
}

const mediaUpdatePos = () => {
  if (mediaSnap().status === "Stopped") {
    setMediaTime({ pos: 0, len: 1 })
    return
  }
  const p = mediaP ?? pickPlayer()
  if (!p) {
    setMediaOpen(false)
    mediaStopPolling()
    return
  }
  setMediaTime({
    pos: toSec(p.position),
    len: Math.max(1, toSec(p.length))
  })
}

const mediaStartPolling = () => {
  if (mediaPosTimer) return
  mediaPosTimer = interval(1000, mediaUpdatePos)
}

const mediaStopPolling = () => {
  if (!mediaPosTimer) return
  mediaPosTimer.cancel?.()
  mediaPosTimer = null
}

export const mediaShow = () => {
  if (mediaHideTimer) {
    mediaHideTimer.cancel?.()
    mediaHideTimer = null
  }
  syncMedia()
  mediaUpdatePos()
  timeout(140, mediaUpdatePos)
  setMediaOpen(true)
  mediaStartPolling()
}

export const mediaCloseLater = () => {
  if (mediaHideTimer) mediaHideTimer.cancel?.()
  mediaHideTimer = timeout(160, () => {
    if (hoverState.pill || hoverState.popup) return
    setMediaOpen(false)
    mediaStopPolling()
  })
}

export const notifyHover = (source: "pill" | "popup", isHovered: boolean) => {
    hoverState[source] = isHovered
    if (isHovered) {
        mediaShow()
    } else {
        mediaCloseLater()
    }
}

const resolvePlayerctlName = async () => {
  const snap = mediaSnap()
  const key = `${snap.artist}|${snap.title}`
  if (cachedPlayerctlName && cachedPlayerctlKey === key) return cachedPlayerctlName

  const list = String(await playerctl(["-l"])).trim()
  const names = list.split("\n").map((s) => s.trim()).filter(Boolean)
  if (names.length === 1) {
    cachedPlayerctlName = names[0]
    cachedPlayerctlKey = key
    return cachedPlayerctlName
  }

  for (const n of names) {
    const t = String(await playerctl(["-p", n, "metadata", "xesam:title"])).trim()
    if (t && t === snap.title) {
      cachedPlayerctlName = n
      cachedPlayerctlKey = key
      return cachedPlayerctlName
    }
  }

  return ""
}

export const mediaPlayPause = () => {
  const snap = mediaSnap()
  const p = mediaP

  void (async () => {
    const name = await resolvePlayerctlName()
    if (name) {
      if (snap.status === "Playing") await playerctl(["-p", name, "pause"])
      else await playerctl(["-p", name, "play"])
      return
    }
    if (p && (p?.can_control || p?.["can-control"])) p?.play_pause?.()
  })()
}

export const mediaNext = () => mediaP?.next?.()
export const mediaPrev = () => mediaP?.previous?.()

export const setPosition = (value: number) => {
  const p = mediaP
  if (!p) return
  const rawPos = Number(p.position || 0)
  const rawLen = Number(p.length || 0)
  const useUs = Math.max(rawPos, rawLen) > 10_000
  const v = useUs ? toUs(value) : Math.round(Math.max(0, Number(value) || 0))
  try {
    p.position = v
  } catch {
    try {
      p.set_position(v)
    } catch {
      // ignore
    }
  }
}

export const setVolume = (value: number) => {
  const v = Math.max(0, Math.min(1, Number(value) || 0))
  setMediaSnap({ ...mediaSnap(), volume: v })
  lastVolumeSetAt = Date.now()

  if (volTimer) volTimer.cancel?.()
  volTimer = timeout(90, () => {
    const p = mediaP
    let mprisSet = false
    if (p && Number((p as any)?.volume) >= 0) {
      try {
        ;(p as any).volume = v
        mprisSet = true
      } catch {
        // fallthrough
      }
    }

    void (async () => {
      const sid = await resolveWpctlStreamId()
      if (sid) {
        await wpctl(`set-volume ${sid} ${v.toFixed(2)}`)
        return
      }
      if (!mprisSet) {
        await wpctl(`set-volume @DEFAULT_AUDIO_SINK@ ${Math.round(v * 100)}%`)
      }
    })()
  })
}

timeout(100, syncMedia)
interval(1000, syncMedia)
