import css from "./style.css"
import wifiCss from "./wifi.css"

import app from "ags/gtk4/app"
import { Astal } from "ags/gtk4"

import Gtk from "gi://Gtk?version=4.0"
import Pango from "gi://Pango?version=1.0"
import GLib from "gi://GLib?version=2.0"

import Hyprland from "gi://AstalHyprland"
import Network from "gi://AstalNetwork"
import Battery from "gi://AstalBattery"

import { createBinding, createState, With } from "ags"
import { createPoll, timeout } from "ags/time"
import { execAsync } from "ags/process"

import { sh } from "./utils/exec"
import { fmtTime } from "./utils/time"
import { iconPath } from "./utils/file"
import { traffic } from "./services/network"
import { volState, setVolume as setVol, changeVolume, toggleMute, setMute } from "./services/audio"
import {
    mediaSnap, mediaTime, mediaOpen, mediaCover, notifyHover,
    mediaPlayPause, mediaNext, mediaPrev, setPosition, setVolume as setMediaVolume
} from "./services/media"

const COVER_SIZE = 200

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
        m.connect("enter", () => notifyHover("pill", true))
        m.connect("leave", () => notifyHover("pill", false))
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
  // This is the distance from the left screen edge to the popup.
  const MEDIA_POPUP_LEFT = 90

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
          m.connect("enter", () => notifyHover("popup", true))
          m.connect("leave", () => notifyHover("popup", false))
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
            self.set_size_request(COVER_SIZE, COVER_SIZE)
            self.set_hexpand(false)
            self.set_vexpand(false)
            self.set_halign(Gtk.Align.START)
            self.set_valign(Gtk.Align.START)
            self.set_overflow(Gtk.Overflow.HIDDEN)
          }}
        >
            <With value={mediaCover}>
                {(tex) => (
                    <picture
                        hexpand={false}
                        vexpand={false}
                        halign={Gtk.Align.FILL}
                        valign={Gtk.Align.FILL}
                        widthRequest={COVER_SIZE}
                        heightRequest={COVER_SIZE}
                        canShrink={true}
                        keepAspectRatio={true}
                        contentFit={Gtk.ContentFit.COVER}
                        paintable={tex}
                    />
                )}
            </With>
        </box>

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
                          onClicked={() => mediaPrev()}
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
                          onClicked={() => mediaNext()}
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
                            setPosition(Number(value))
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
                              setMediaVolume(Number(value))
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

const [wifiOpen, setWifiOpen] = createState(false)
let wifiHoverTimer: any = null

const wifiShow = () => {
  if (wifiHoverTimer) {
    wifiHoverTimer.cancel?.()
    wifiHoverTimer = null
  }
  setWifiOpen(true)
  Network.get_default().wifi.scan()
}

const wifiCloseLater = () => {
  if (wifiHoverTimer) wifiHoverTimer.cancel?.()
  wifiHoverTimer = timeout(200, () => {
    setWifiOpen(false)
  })
}

// Wifi Popup
function WifiPopup(monitor = 0) {
  const net = Network.get_default()
  const wifi = net.wifi
  const anchor = Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT

  const [passwordTarget, setPasswordTarget] = createState<string | null>(null)
  const [passwordInput, setPasswordInput] = createState("")
  const [knownNetworks, setKnownNetworks] = createState<string[]>([])

  const updateKnown = () => {
    execAsync(["nmcli", "-t", "-f", "NAME", "connection", "show"])
      .then((out) => setKnownNetworks(out.split("\n")))
      .catch(() => {})
  }

  return (
    <window
      visible={wifiOpen}
      name="wifi"
      class="wifi-popup-window"
      monitor={monitor}
      layer={Astal.Layer.OVERLAY}
      exclusivity={Astal.Exclusivity.NORMAL}
      anchor={anchor}
      marginTop={0}
      marginRight={12}
      application={app}
    >
      <box
        class="wifi-popup"
        vertical
        spacing={10}
        $={(self) => {
          const m = new Gtk.EventControllerMotion()
          m.connect("enter", () => {
            if (wifiHoverTimer) {
              wifiHoverTimer.cancel?.()
              wifiHoverTimer = null
            }
            setWifiOpen(true)
            updateKnown()
          })
          m.connect("leave", wifiCloseLater)
          self.add_controller(m)
        }}
      >
        {/* Header */}
        <box class="wifi-header" spacing={10}>
          <label class="wifi-title" label="Wi-Fi" hexpand xalign={0} />
          <button
            class="wifi-refresh-btn"
            onClicked={() => {
              wifi.scan()
              updateKnown()
            }}
          >
            <image iconName="view-refresh-symbolic" pixelSize={16} />
          </button>
          <button
            class={createBinding(wifi, "enabled")((e) => (e ? "wifi-toggle checked" : "wifi-toggle"))}
            onClicked={() => (wifi.enabled = !wifi.enabled)}
          >
            <box class="wifi-toggle-handle" halign={createBinding(wifi, "enabled")((e) => (e ? Gtk.Align.END : Gtk.Align.START))} />
          </button>
        </box>

        {/* Content */}
        <With value={createBinding(wifi, "enabled")}>
          {(enabled) =>
            enabled ? (
              <box vertical spacing={10}>
                {/* Active Connection Stats */}
                <With value={createBinding(wifi, "active-access-point")}>
                  {(ap) =>
                    ap ? (
                      <box vertical spacing={4} class="wifi-item active">
                        <box spacing={10}>
                          <image iconName={createBinding(ap, "icon-name")} pixelSize={16} />
                          <label class="wifi-ssid" label={ap.ssid} hexpand xalign={0} />
                          <label class="wifi-strength" label={createBinding(ap, "strength")(s => `${s}%`)} />
                        </box>
                        <box spacing={20} marginTop={6}>
                           <box spacing={6}>
                              <label class="wifi-stats-label" label="IP" />
                              <label class="wifi-stats-value" label={createBinding(net.wifi, "device")(d => d?.ip4Config?.addresses?.[0]?.address || "...")} />
                           </box>
                           <box spacing={6}>
                              <label class="wifi-stats-label" label="СКОР" />
                              <label class="wifi-stats-value" label={`${ap.frequency > 3000 ? "5GHz" : "2.4GHz"} ${Math.round(ap.maxBitrate / 1000)}Mb/s`} />
                           </box>
                        </box>
                        <box spacing={20}>
                           <box spacing={6}>
                              <label class="wifi-stats-label" label="ЗАГР" />
                              <label class="wifi-stats-value" label={traffic((t) => `${(t.rxSpeed / 1024 / 1024).toFixed(1)} MB/s`)} />
                           </box>
                           <box spacing={6}>
                              <label class="wifi-stats-label" label="ВЫГР" />
                              <label class="wifi-stats-value" label={traffic((t) => `${(t.txSpeed / 1024 / 1024).toFixed(1)} MB/s`)} />
                           </box>
                        </box>
                      </box>
                    ) : (
                      <label label="Не подключено" class="wifi-stats-label" />
                    )
                  }
                </With>

                {/* Password Entry Overlay */}
                <With value={passwordTarget}>
                  {(target) =>
                     target && (
                        <box vertical spacing={8} class="wifi-item active">
                           <label class="wifi-ssid" label={`Пароль для ${target}`} xalign={0} />
                           <entry
                              class="wifi-entry"
                              visibility={false}
                              placeholderText="Введите пароль..."
                              onChanged={({ text }) => setPasswordInput(text)}
                              onActivate={() => {
                                 if (passwordInput()) {
                                    execAsync(["nmcli", "device", "wifi", "connect", target, "password", passwordInput()])
                                       .catch(console.error)
                                    setPasswordTarget(null)
                                    setPasswordInput("")
                                 }
                              }}
                           />
                           <box spacing={10}>
                              <button
                                 class="wifi-item"
                                 onClicked={() => {
                                    setPasswordTarget(null)
                                    setPasswordInput("")
                                 }}
                              >
                                 <label label="Отмена" />
                              </button>
                              <button
                                 class="wifi-item active"
                                 onClicked={() => {
                                    if (passwordInput()) {
                                       execAsync(["nmcli", "device", "wifi", "connect", target, "password", passwordInput()])
                                          .catch(console.error)
                                       setPasswordTarget(null)
                                       setPasswordInput("")
                                    }
                                 }}
                              >
                                 <label label="Подключиться" />
                              </button>
                           </box>
                        </box>
                     )
                  }
                </With>

                {/* Network List */}
                <scrollable hscroll={Astal.Policy.NEVER} vscroll={Astal.Policy.AUTOMATIC} heightRequest={300} class="wifi-list">
                  <box vertical spacing={4}>
                    {createBinding(wifi, "access-points")((aps) => {
                      const unique = new Map()
                      aps.forEach((ap) => {
                         if (ap.ssid && !unique.has(ap.ssid)) unique.set(ap.ssid, ap)
                      })
                      return Array.from(unique.values())
                        .sort((a, b) => b.strength - a.strength)
                        .map((ap) => (
                          <button
                            class="wifi-item"
                            onClicked={() => {
                               if (knownNetworks().includes(ap.ssid)) {
                                  execAsync(["nmcli", "device", "wifi", "connect", ap.ssid]).catch(console.error)
                               } else if (ap.rsnFlags || ap.wpaFlags) {
                                  setPasswordTarget(ap.ssid)
                               } else {
                                  execAsync(["nmcli", "device", "wifi", "connect", ap.ssid]).catch(console.error)
                               }
                            }}
                          >
                            <box spacing={10}>
                              <image iconName={ap.iconName} pixelSize={16} />
                              <label class="wifi-ssid" label={ap.ssid} hexpand xalign={0} />
                              {(ap.rsnFlags || ap.wpaFlags) ? <image iconName="network-wireless-encrypted-symbolic" pixelSize={12} class="wifi-strength" /> : <box />}
                              {knownNetworks().includes(ap.ssid) && (
                                 <button
                                    class="wifi-item-gear"
                                    onClicked={() => execAsync(["nm-connection-editor", `--edit=${ap.ssid}`]).catch(console.error)}
                                 >
                                    <image iconName="emblem-system-symbolic" pixelSize={12} />
                                 </button>
                              )}
                            </box>
                          </button>
                        ))
                    })}
                  </box>
                </scrollable>
              </box>
            ) : (
              <label label="Wi-Fi выключен" halign={Gtk.Align.CENTER} />
            )
          }
        </With>
      </box>
    </window>
  )
}

function Net() {
  const net = Network.get_default()
  const wifi = net.wifi

  return (
    <button
      class={createBinding(wifi, "enabled")(e => e ? "pill net" : "pill net disabled")}
      onClicked={() => {
          // Toggle wifi on click
          wifi.enabled = !wifi.enabled
      }}
      $={(self) => {
        const m = new Gtk.EventControllerMotion()
        m.connect("enter", wifiShow)
        m.connect("leave", wifiCloseLater)
        self.add_controller(m)
      }}
    >
      <box spacing={8}>
        <image iconName={createBinding(wifi, "icon-name")} pixelSize={16} />
        <label label={createBinding(wifi, "strength")((s: number) => (Number.isFinite(s) && wifi.enabled ? `${Math.round(s)}%` : ""))} />
      </box>
    </button>
  )
}

function Volume() {
  const [hovered, setHovered] = createState(false)

  return (
    <box
      class={hovered(h => h ? "pill vol hovered" : "pill vol")}
      $={(self) => {
        const m = new Gtk.EventControllerMotion()
        m.connect("enter", () => setHovered(true))
        m.connect("leave", () => setHovered(false))
        self.add_controller(m)

        const s = new Gtk.EventControllerScroll({ flags: Gtk.EventControllerScrollFlags.VERTICAL })
        s.connect("scroll", (_, dx, dy) => {
           const cmd = dy > 0 ? "5%-" : "5%+"
           changeVolume(cmd)
           return true
        })
        self.add_controller(s)
      }}
    >
      <revealer
        revealChild={hovered()}
        transitionType={Gtk.RevealerTransitionType.SLIDE_RIGHT}
        transitionDuration={300}
      >
        <box class="vol-slider-box">
           <slider
             class="vol-slider"
             hexpand
             min={0}
             max={1}
             value={volState((s) => (s.muted ? 0 : s.vol))}
             onChangeValue={({ value }) => {
               setVol(Number(value))
               if (volState().muted) {
                 setMute(false)
               }
             }}
           />
        </box>
      </revealer>

      <box spacing={8}>
        <label label={volState((s) => `${Math.round(s.vol * 100)}%`)} />
        <button
          class={volState((s) => (s.muted ? "vol-icon muted" : "vol-icon"))}
          onClicked={() => {
             toggleMute()
          }}
        >
          <image
            iconName={volState((s) => {
              if (s.muted) return "audio-volume-muted-symbolic"
              const p = Math.round(s.vol * 100)
              if (p >= 67) return "audio-volume-high-symbolic"
              if (p >= 34) return "audio-volume-medium-symbolic"
              return "audio-volume-low-symbolic"
            })}
            pixelSize={16}
          />
        </button>
      </box>
    </box>
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
  css: css + "\n" + wifiCss,
  main() {
    Bar(0)
    MediaPopup(0)
    WifiPopup(0)
  },
})
