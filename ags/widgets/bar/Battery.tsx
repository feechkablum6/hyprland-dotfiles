import Battery from "gi://AstalBattery"
import { createBinding } from "ags"
import Pill from "../common/Pill"

export default function Bat() {
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
