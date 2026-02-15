import { sh } from "../../utils/exec"

export default function Notifs() {
  return (
    <button class="pill notifs" onClicked={() => sh("swaync-client -t")}>
      <label label="󰂚" />
    </button>
  )
}
