import app from "ags/gtk4/app"
import { Astal } from "ags/gtk4"
import Gtk from "gi://Gtk?version=4.0"
import Network from "gi://AstalNetwork"
import { createBinding, createState, With } from "ags"
import { nmcli, sh } from "../../utils/exec"
import { traffic } from "../../services/network"
import { wifiOpen, setWifiOpen, wifiShow, wifiCloseLater } from "./state"

export default function WifiPopup(monitor = 0) {
  const net = Network.get_default()
  const wifi = net.wifi
  const anchor = Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT

  const [passwordTarget, setPasswordTarget] = createState<string | null>(null)
  const [passwordInput, setPasswordInput] = createState("")
  const [knownNetworks, setKnownNetworks] = createState<string[]>([])

  const updateKnown = () => {
    nmcli(["-t", "-f", "NAME", "connection", "show"])
      .then((out) => setKnownNetworks(String(out).split("\n")))
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
             wifiShow()
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
                                    nmcli(["device", "wifi", "connect", target, "password", passwordInput()])
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
                                       nmcli(["device", "wifi", "connect", target, "password", passwordInput()])
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
                                  nmcli(["device", "wifi", "connect", ap.ssid]).catch(console.error)
                               } else if (ap.rsnFlags || ap.wpaFlags) {
                                  setPasswordTarget(ap.ssid)
                               } else {
                                  nmcli(["device", "wifi", "connect", ap.ssid]).catch(console.error)
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
                                    onClicked={() => sh(`nm-connection-editor --edit='${ap.ssid}'`).catch(console.error)}
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
