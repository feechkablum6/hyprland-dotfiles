import Gtk from "gi://Gtk?version=4.0"
import Network from "gi://AstalNetwork"
import { createBinding } from "ags"
import { wifiShow, wifiCloseLater } from "../network/state"

export default function Net() {
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
