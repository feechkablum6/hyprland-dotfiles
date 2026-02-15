import css from "./style.css"

import app from "ags/gtk4/app"
import { Astal } from "ags/gtk4"

import Gtk from "gi://Gtk?version=4.0"
import Pango from "gi://Pango?version=1.0"
import GLib from "gi://GLib?version=2.0"
import Gdk from "gi://Gdk?version=4.0"
import GdkPixbuf from "gi://GdkPixbuf?version=2.0"

import Hyprland from "gi://AstalHyprland"
import Mpris from "gi://AstalMpris"
import Network from "gi://AstalNetwork"
import Battery from "gi://AstalBattery"

import { createBinding, createState, With } from "ags"
import { interval, timeout, createPoll } from "ags/time"
import { execAsync } from "ags/process"

const sh = (cmd: string) =>
  execAsync(["bash", "-lc", cmd]).catch(() => "")

const playerctl = (args: string[]) =>
  execAsync(["playerctl", ...args]).catch(() => "")

const wpctl = (cmd: string) => sh(`LC_ALL=C wpctl ${cmd} 2>/dev/null`)

const fmtTime = (sec: number) => {
  const s = Math.max(0, Math.floor(sec || 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

function Pill({ className, children }: { className?: string; children: JSX.Element }) {
  return <box class={className ? `pill ${className}` : "pill"}>{children}</box>
}

function Launcher() {
  return (
    <button class="pill launcher" onClicked={() => sh("rofi -show drun -show-icons")}>
      <label label="" />
    </button>
  )
}

function Workspaces() {
  const hypr = Hyprland.get_default()
  const focused = createBinding(hypr, "focused-workspace")
  const focusedId = focused((ws: any) => (ws ? Number(ws.id) : 0))

  const Dot = (id: number) => (
    <button
      class={focusedId((fid) => (fid === id ? "ws-dot active" : "ws-dot"))}
      onClicked={() => hypr.dispatch("workspace", String(id))}
    >
      <label label={focusedId((fid) => (fid === id ? "●" : "○"))} />
    </button>
  )

  return (
    <Pill className="workspaces">
      <box spacing={6}>
        {Dot(1)}
        {Dot(2)}
        {Dot(3)}
        {Dot(4)}
        {Dot(5)}
      </box>
    </Pill>
  )
}

function Media() {
  return <box />
}

// Media model (shared between pill and popup window)
const mpris = Mpris.get_default()

const pickPlayer = () => {
  const ps = (mpris as any)?.players
  if (!Array.isArray(ps) || ps.length === 0) return null

  // Prefer the most recent PLAYING player first.
  // Chrome can keep stale players around (old tabs), so scan from the end.
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i]
    const st = Number(p?.playback_status ?? p?.["playback-status"]) // 0 playing, 1 paused, 2 stopped
    const title = String(p?.title ?? "").trim()
    if (st === 0 && title) return p
  }
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i]
    const st = Number(p?.playback_status ?? p?.["playback-status"]) // 0 playing, 1 paused, 2 stopped
    if (st === 0) return p
  }

  // Then prefer the most recent non-stopped with a title.
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i]
    const st = Number(p?.playback_status ?? p?.["playback-status"]) // 0 playing, 1 paused, 2 stopped
    const title = String(p?.title ?? "").trim()
    if (st !== 2 && title) return p
  }

  // Then any non-stopped.
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i]
    const st = Number(p?.playback_status ?? p?.["playback-status"]) // 0 playing, 1 paused, 2 stopped
    if (st !== 2) return p
  }

  return ps[ps.length - 1] || null
}

type MediaService = "yandex-music" | "youtube" | "twitch" | "unknown"

type MediaSnapshot = {
  has: boolean
  title: string
  artist: string
  album: string
  line: string
  cover: string
  status: "Playing" | "Paused" | "Stopped"
  service: MediaService
  appIcon: string
  volume: number
  canSeek: boolean
  canPrev: boolean
  canNext: boolean
  canControl: boolean
}

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

const [mediaSnap, setMediaSnap] = createState<MediaSnapshot>(emptySnap)

let mediaP: any = null
let lastLogKey = ""
let lastTrackKey = ""

// Popup cover widgets (Gtk.Picture scales properly; Gtk.Image does not).
let coverPic: Gtk.Picture | null = null
// Last cover path applied to the GTK widgets.
let lastCoverPath = ""

const EMPTY_COVER = `${GLib.get_home_dir()}/.config/ags/assets/empty-cover.png`
const COVER_SIZE = 200

let lastCoverTexturePath = ""
let lastCoverTexture: Gdk.Texture | null = null

// A scaled texture prevents Gtk.Picture from requesting huge natural sizes
// (e.g. when the placeholder image is a large wallpaper-like PNG).
let lastScaledTextureKey = ""
let lastScaledTexture: Gdk.Texture | null = null

const getTextureAtScale = (filePath: string, size: number) => {
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

const getCoverTexture = (filePath: string) => {
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

const showPlaceholderCover = () => {
  if (!coverPic) return
  const placeholderTex = GLib.file_test(EMPTY_COVER, GLib.FileTest.EXISTS) ? getTextureAtScale(EMPTY_COVER, COVER_SIZE) : null
  try {
    coverPic.set_paintable(placeholderTex)
  } catch {
    // ignore
  }
  coverPic.set_visible(true)
  // Avoid caching shortcuts preventing placeholder updates.
  lastCoverPath = "__idle__"
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

const applyCoverToWidgets = (cover: string) => {
  const fn = coverToFilename(cover)
  const coverTex = fn && GLib.file_test(fn, GLib.FileTest.EXISTS) ? getTextureAtScale(fn, COVER_SIZE) : null
  const placeholderTex = GLib.file_test(EMPTY_COVER, GLib.FileTest.EXISTS) ? getTextureAtScale(EMPTY_COVER, COVER_SIZE) : null
  const tex = coverTex || placeholderTex

  const widgetsReady = !!coverPic
  if (widgetsReady && fn === lastCoverPath) return
  if (widgetsReady) lastCoverPath = fn

  if (coverPic) {
    try {
      coverPic.set_paintable(tex)
    } catch {
      // ignore
    }
    // Keep the widget visible; if tex is null, the container background stays.
    coverPic.set_visible(true)
  }
}

// Use the last synced player for actions/position; fall back to a fresh pick.
const mediaPlayer = () => mediaP ?? pickPlayer()

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

  // PWA desktop entries can include the app name.
  if (entry.includes("yandex") && entry.includes("music")) return "yandex-music"
  if (entry.includes("youtube")) return "youtube"
  if (entry.includes("twitch")) return "twitch"

  // Chrome/Chromium PWA: desktop entry is often generic, so detect via metadata.
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

  // Chrome heuristic: try to detect service from URL or specific patterns
  if (url.includes("twitch.tv") || name.includes("twitch") || cover.includes("twitch")) return "twitch"
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube"
  if (url.includes("music.yandex.ru")) return "yandex-music"

  // Fallback heuristics
  if (album) return "yandex-music"
  return "youtube"
}

const clamp01 = (n: any, fallback = 0.5) => {
  const v = Number(n)
  if (!Number.isFinite(v)) return fallback
  return Math.max(0, Math.min(1, v))
}

// Service logo files (local, no network, stable).
const iconPath = (n: string) => `${GLib.get_home_dir()}/.config/ags/icons/${n}`

const syncMedia = () => {
  const p = pickPlayer()
  mediaP = p

  if (!p) {
    // Keep pill available but show idle cover/text.
    showPlaceholderCover()
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

  // If the active track changes while the popup is closed, drop old timeline values.
  // Timeline will be re-synced on popup open.
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

  const st = Number(p?.playback_status ?? p?.["playback-status"]) // 0 playing, 1 paused, 2 stopped
  const status: MediaSnapshot["status"] = st === 0 ? "Playing" : st === 1 ? "Paused" : "Stopped"

  // When a player is STOPPED, Chrome often reports a generic app icon artUrl.
  // Show the idle placeholder instead of the Google/Chrome icon.
  if (status === "Stopped") {
    showPlaceholderCover()
  } else {
    applyCoverToWidgets(rawCover)
  }

  const service = status === "Stopped" ? "unknown" : resolveService(p, album)

  // Debug (low-noise): log when the active track changes.
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

let cachedPlayerctlName = ""
let cachedPlayerctlKey = ""

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

  // Try to match by title if multiple players are present.
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

const mediaPlayPause = () => {
  const snap = mediaSnap()
  const p = mediaP

  // Deterministic play/pause for Chrome/YouTube: toggling can fail or double-toggle.
  // Use explicit commands when possible.
  void (async () => {
    const name = await resolvePlayerctlName()
    if (name) {
      if (snap.status === "Playing") await playerctl(["-p", name, "pause"])
      else await playerctl(["-p", name, "play"])
      return
    }

    // Fallback to MPRIS method.
    if (p && (p?.can_control || p?.["can-control"])) p?.play_pause?.()
  })()
}

let cachedStreamId = 0
let cachedStreamAt = 0

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
      // Stop when we leave the audio section.
      if (/^\s*Video\b/.test(line) || /^\s*Settings\b/.test(line)) break

      // Match stream header lines like: "       116. Google Chrome"
      // Skip port lines containing ">".
      if (line.includes(">")) continue

      // Match ID and Name. Relaxed regex to handle "123. Name [vol: 1.00]"
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

let volTimer: any = null
let lastVolumeSetAt = 0

const queueSetVolume = (value: number) => {
  const v = Math.max(0, Math.min(1, Number(value) || 0))
  // Update UI immediately.
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
      // Fallback: system sink volume only if no stream found AND MPRIS failed/was skipped.
      if (!mprisSet) {
        await wpctl(`set-volume @DEFAULT_AUDIO_SINK@ ${Math.round(v * 100)}%`)
      }
    })()
  })
}

timeout(100, syncMedia)
interval(1000, syncMedia)

// NOTE: Chrome MPRIS usually does not expose the current URL, so we cannot fetch
// per-site favicons reliably. We instead show a stable service logo in the bar
// (YouTube/Yandex Music), and keep the real cover art in the popup.

// MPRIS position/length are typically in microseconds.
// Some backends may already expose seconds, so normalize by magnitude.
const toSec = (v: any) => {
  const n = Number(v || 0)
  if (!Number.isFinite(n) || n <= 0) return 0
  return n > 10_000 ? n / 1_000_000 : n
}

const toUs = (sec: number) => Math.round(Math.max(0, Number(sec) || 0) * 1_000_000)

const [mediaTime, setMediaTime] = createState({ pos: 0, len: 1 })
const [mediaOpen, setMediaOpen] = createState(false)

// Popup positioning: tune this if your bar spacing changes.
// This is the distance from the left screen edge to the popup.
const MEDIA_POPUP_LEFT = 90

let mediaHideTimer: any = null
let mediaPosTimer: any = null
let pillHover = false
let popupHover = false

const mediaUpdatePos = () => {
  if (mediaSnap().status === "Stopped") {
    // Keep timeline in a sane default for idle state.
    setMediaTime({ pos: 0, len: 1 })
    return
  }
  const p = mediaPlayer()
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

const mediaShow = () => {
  if (mediaHideTimer) {
    mediaHideTimer.cancel?.()
    mediaHideTimer = null
  }

  // Force a fresh snapshot + timeline sync on open.
  syncMedia()
  mediaUpdatePos()
  timeout(140, mediaUpdatePos)

  setMediaOpen(true)
  mediaStartPolling()
}

const mediaCloseLater = () => {
  if (mediaHideTimer) mediaHideTimer.cancel?.()
  mediaHideTimer = timeout(160, () => {
    if (pillHover || popupHover) return
    setMediaOpen(false)
    mediaStopPolling()
  })
}

const mediaEnterPill = () => {
  pillHover = true
  mediaShow()
}

const mediaLeavePill = () => {
  pillHover = false
  mediaCloseLater()
}

const mediaEnterPopup = () => {
  popupHover = true
  mediaShow()
}

const mediaLeavePopup = () => {
  popupHover = false
  mediaCloseLater()
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

function MediaServiceLogo({ size = 16 }: { size?: number }) {
  const filePath = mediaSnap((m) => {
    if (m.service === "youtube") return iconPath("services/youtube.png")
    if (m.service === "yandex-music") return iconPath("services/yandex-music.png")
    if (m.service === "twitch") return iconPath("services/twitch.png")
    return ""
  })

  return (
    <With value={filePath}>
      {(p) =>
        p && GLib.file_test(p, GLib.FileTest.EXISTS) ? (
          <image file={p} widthRequest={size} heightRequest={size} />
        ) : (
          <box widthRequest={size} heightRequest={size} />
        )
      }
    </With>
  )
}

// (old MediaSourceIcon/derived bindings removed; mediaSnap drives UI now)

const mediaSetPosition = (p: any, value: number) => {
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

const mediaSetVolume = (p: any, value: number) => {
  if (!p) return
  if (Number(p.volume) >= 0) {
    try {
      p.volume = value
      return
    } catch {
      // fallthrough
    }
  }
  // fallback: system volume
  sh(`wpctl set-volume @DEFAULT_AUDIO_SINK@ ${Math.round(value * 100)}%`)
}

function MediaPill() {
  return (
    <button
      class={mediaSnap((m) => (m.has ? "pill media" : "pill media hidden"))}
      visible={mediaSnap((m) => m.has)}
      onClicked={() => {
        mediaPlayPause()
      }}
      $={(self) => {
        const m = new Gtk.EventControllerMotion()
        m.connect("enter", mediaEnterPill)
        m.connect("leave", mediaLeavePill)
        self.add_controller(m)
      }}
    >
      <box spacing={10}>
        <box class="media-source-icon" valign={Gtk.Align.CENTER}>
          <MediaServiceLogo size={16} />
        </box>
        <label
          class="media-text"
          label={mediaSnap((m) => (String(m.line || "").trim() ? m.line : "…"))}
          ellipsize={Pango.EllipsizeMode.END}
          maxWidthChars={24}
          widthChars={24}
          xalign={0}
        />
        <box
          class={mediaSnap((m) => (m.status === "Playing" ? "media-dot is-playing" : "media-dot"))}
          widthRequest={7}
          heightRequest={7}
          valign={Gtk.Align.CENTER}
        />
      </box>
    </button>
  )
}

function MediaPopup(monitor = 0) {
  const anchor = Astal.WindowAnchor.TOP | Astal.WindowAnchor.LEFT
  return (
    <window
      visible={mediaOpen}
      name="media"
      class="media-popup-window"
      monitor={monitor}
      layer={Astal.Layer.OVERLAY}
      exclusivity={Astal.Exclusivity.NORMAL}
      anchor={anchor}
      marginTop={0}
      marginLeft={MEDIA_POPUP_LEFT}
      application={app}
    >
      <box
        class="media-popup"
        spacing={20}
        widthRequest={560}
        halign={Gtk.Align.START}
        $={(self) => {
          const m = new Gtk.EventControllerMotion()
          m.connect("enter", mediaEnterPopup)
          m.connect("leave", mediaLeavePopup)
          self.add_controller(m)
        }}
      >
        <box
          class="media-cover"
          widthRequest={COVER_SIZE}
          heightRequest={COVER_SIZE}
          hexpand={false}
          vexpand={false}
          $={(self) => {
            // Hard clamp: widthRequest is a minimum; size_request enforces the box size.
            self.set_size_request(COVER_SIZE, COVER_SIZE)
            self.set_hexpand(false)
            self.set_vexpand(false)
            self.set_halign(Gtk.Align.START)
            self.set_valign(Gtk.Align.START)

            // Clip child to rounded corners.
            self.set_overflow(Gtk.Overflow.HIDDEN)

            // Create a scalable picture once; update it from syncMedia().
            const pic = new Gtk.Picture()
            pic.set_can_shrink(true)
            pic.set_keep_aspect_ratio(true)
            pic.set_content_fit(Gtk.ContentFit.COVER)
            pic.set_hexpand(false)
            pic.set_vexpand(false)
            pic.set_halign(Gtk.Align.FILL)
            pic.set_valign(Gtk.Align.FILL)
            pic.set_size_request(COVER_SIZE, COVER_SIZE)

            // Prefer showing the placeholder initially.
            try {
              if (GLib.file_test(EMPTY_COVER, GLib.FileTest.EXISTS)) {
                const ptex = getTextureAtScale(EMPTY_COVER, COVER_SIZE)
                if (ptex) pic.set_paintable(ptex)
              }
            } catch {
              // ignore
            }

            self.append(pic)

            coverPic = pic

            // Initial state.
            applyCoverToWidgets(mediaSnap().cover)
          }}
        />

        <box orientation={Gtk.Orientation.VERTICAL} hexpand spacing={10}>
          {/* Controls - Top */}
          <With value={mediaSnap}>
            {(m) =>
              m.has && (
                <box orientation={Gtk.Orientation.VERTICAL} spacing={10} valign={Gtk.Align.CENTER} vexpand>

                  {m.status === "Stopped" ? (
                    <box orientation={Gtk.Orientation.VERTICAL} spacing={20} halign={Gtk.Align.CENTER}>
                      <label class="media-title" label="Ничего не играет" />
                      <box class="media-controls" spacing={20} halign={Gtk.Align.CENTER}>
                        <button
                          class="media-circ-btn"
                          onClicked={() => execAsync(["google-chrome-beta", "https://twitch.tv"]).catch(console.error)}
                        >
                          <image file={iconPath("services/twitch.png")} pixelSize={24} />
                        </button>
                        <button
                          class="media-circ-btn"
                          onClicked={() => execAsync(["google-chrome-beta", "https://youtube.com"]).catch(console.error)}
                        >
                          <image file={iconPath("services/youtube.png")} pixelSize={24} />
                        </button>
                        <button
                          class="media-circ-btn"
                          onClicked={() => execAsync(["google-chrome-beta", "https://music.yandex.ru/playlists/lk.f6addeb0-d363-4a3e-ae0a-9d1244b40481"]).catch(console.error)}
                        >
                          <image file={iconPath("services/yandex-music.png")} pixelSize={24} />
                        </button>
                      </box>
                    </box>
                  ) : (
                    <box orientation={Gtk.Orientation.VERTICAL} spacing={10} valign={Gtk.Align.CENTER} vexpand>
                      {/* Title and Artist */}
                      <box orientation={Gtk.Orientation.VERTICAL} spacing={4} halign={Gtk.Align.CENTER}>
                        <label
                          class="media-title"
                          label={m.title}
                          ellipsize={Pango.EllipsizeMode.END}
                          maxWidthChars={30}
                        />
                        <label
                          class="media-artist"
                          label={m.artist}
                          ellipsize={Pango.EllipsizeMode.END}
                          maxWidthChars={30}
                        />
                      </box>

                      <box class="media-controls" spacing={20} halign={Gtk.Align.CENTER}>
                        <button
                          class="media-circ-btn"
                          sensitive={mediaSnap((mm) => !!mm.canPrev)}
                          onClicked={() => mediaP?.previous?.()}
                        >
                          <image iconName="media-skip-backward-symbolic" pixelSize={20} />
                        </button>
                        <button
                          class={mediaSnap((mm) => (mm.status === "Playing" ? "media-circ-btn-play is-playing" : "media-circ-btn-play"))}
                          sensitive={mediaSnap((mm) => !!mm.canControl)}
                          onClicked={() => mediaPlayPause()}
                        >
                          <image
                            iconName={mediaSnap((mm) =>
                              mm.status === "Playing" ? "media-playback-pause-symbolic" : "media-playback-start-symbolic",
                            )}
                            pixelSize={28}
                          />
                        </button>
                        <button
                          class="media-circ-btn"
                          sensitive={mediaSnap((mm) => !!mm.canNext)}
                          onClicked={() => mediaP?.next?.()}
                        >
                          <image iconName="media-skip-forward-symbolic" pixelSize={20} />
                        </button>
                      </box>

                      {/* Duration */}
                      <box orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                        <box spacing={10}>
                          <label class="media-sub-label" label="DURATION" hexpand xalign={0} />
                          <image iconName="audio-input-microphone-symbolic" pixelSize={12} class="media-wave" />
                          <label class="media-sub-label" label={mediaTime((t) => `${fmtTime(t.pos)} / ${fmtTime(t.len)}`)} xalign={1} />
                        </box>
                        <slider
                          class="media-slider"
                          hexpand
                          min={0}
                          max={mediaTime((t) => t.len)}
                          value={mediaTime((t) => t.pos)}
                          sensitive={mediaSnap((mm) => !!mm.canSeek)}
                          onChangeValue={({ value }) => {
                            const pp = mediaP
                            if (!pp) return
                            const newPos = Number(value)
                            setMediaTime({ ...mediaTime(), pos: newPos })
                            mediaSetPosition(pp, newPos)
                          }}
                        />
                      </box>

                      {/* Volume */}
                      <box orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                        <box spacing={10}>
                          <label class="media-sub-label" label="VOLUME" hexpand xalign={0} />
                          <label class="media-sub-label" label={mediaSnap((mm) => `${Math.round((Number.isFinite(mm.volume) ? mm.volume : 0.5) * 100)}%`)} xalign={1} />
                        </box>
                        <box spacing={10}>
                          <image class="media-vol-icon" iconName="audio-volume-high-symbolic" pixelSize={16} />
                          <slider
                            class="media-vol"
                            hexpand
                            min={0}
                            max={1}
                            value={mediaSnap((mm) => (Number.isFinite(mm.volume) ? mm.volume : 0.5))}
                            onChangeValue={({ value }) => {
                              queueSetVolume(Number(value))
                            }}
                          />
                        </box>
                      </box>
                    </box>
                  )}
                </box>
              )
            }
          </With>
        </box>
      </box>
    </window>
  )
}

function Clock() {
  const clock = createPoll("", 1000, () => {
    const d = new Date()
    const hh = String(d.getHours()).padStart(2, "0")
    const mm = String(d.getMinutes()).padStart(2, "0")
    const wd = d.toLocaleString(undefined, { weekday: "short" })
    const day = String(d.getDate()).padStart(2, "0")
    const mon = d.toLocaleString(undefined, { month: "short" })
    return `${hh}:${mm}  ${wd} ${day} ${mon}`
  })

  return (
    <Pill className="clock">
      <label label={clock} />
    </Pill>
  )
}

function Net() {
  const net = Network.get_default()
  const wifi = net.wifi
  const icon = createBinding(wifi, "icon-name")
  const strength = createBinding(wifi, "strength")
  return (
    <button class="pill net" onClicked={() => sh("nm-connection-editor || true")}>
      <box spacing={8}>
        <image iconName={icon} pixelSize={16} />
        <label label={strength((s: number) => (Number.isFinite(s) ? `${Math.round(s)}%` : ""))} />
      </box>
    </button>
  )
}

function Volume() {
  const state = createPoll(
    { vol: 0, muted: false },
    2000,
    ["wpctl", "get-volume", "@DEFAULT_AUDIO_SINK@"],
    (out) => {
      const s = String(out || "").trim()
      const m = s.match(/Volume:\s*([0-9.]+)/)
      const vol = m ? Number(m[1]) : 0
      const muted = /MUTED/i.test(s)
      return { vol: Number.isFinite(vol) ? vol : 0, muted }
    },
  )

  const iconName = state((st) => {
    const p = Math.round((st.vol || 0) * 100)
    if (st.muted || p === 0) return "audio-volume-muted-symbolic"
    if (p >= 67) return "audio-volume-high-symbolic"
    if (p >= 34) return "audio-volume-medium-symbolic"
    return "audio-volume-low-symbolic"
  })

  return (
    <button
      class="pill vol"
      onClicked={() => sh("wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle")}
    >
      <box spacing={8}>
        <image iconName={iconName} pixelSize={16} />
        <label label={state((st) => `${Math.round((st.vol || 0) * 100)}%`)} />
      </box>
    </button>
  )
}

function Bat() {
  const bat = Battery.get_default()
  const pct = createBinding(bat, "percentage")
  const icon = createBinding(bat, "battery-icon-name")
  return (
    <Pill className="bat">
      <box spacing={8}>
        <image iconName={icon} pixelSize={16} />
        <label label={pct((p: number) => `${Math.round((p || 0) * 100)}%`)} />
      </box>
    </Pill>
  )
}

function Notifs() {
  return (
    <button class="pill notifs" onClicked={() => sh("swaync-client -t")}>
      <label label="󰂚" />
    </button>
  )
}

function Power() {
  return (
    <button class="pill power" onClicked={() => sh("$HOME/.local/bin/powermenu") }>
      <label label="󰐥" />
    </button>
  )
}

function Bar(monitor = 0) {
  const anchor = Astal.WindowAnchor.TOP | Astal.WindowAnchor.LEFT | Astal.WindowAnchor.RIGHT
  return (
    <window
      visible
      name="bar"
      class="bar-window"
      monitor={monitor}
      layer={Astal.Layer.TOP}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      anchor={anchor}
      marginTop={10}
      marginLeft={12}
      marginRight={12}
      application={app}
    >
        <centerbox class="bar">
          <box $type="start" spacing={8}>
            <Launcher />
            <Workspaces />
            <MediaPill />
          </box>
          <box $type="center">
            <Clock />
          </box>
          <box $type="end" spacing={8}>
            <Net />
            <Volume />
            <Bat />
            <Notifs />
            <Power />
          </box>
        </centerbox>
      </window>
  )
}

app.start({
  css,
  main() {
    Bar(0)
    MediaPopup(0)
  },
})
