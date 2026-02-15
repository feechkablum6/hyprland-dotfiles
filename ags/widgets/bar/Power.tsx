import { sh } from "../../utils/exec"

export default function Power() {
  return (
    <button class="pill power" onClicked={() => sh("$HOME/.local/bin/powermenu") }>
      <label label="󰐥" />
    </button>
  )
}
