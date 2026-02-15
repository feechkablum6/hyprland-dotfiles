import { sh } from "../../utils/exec"

export default function Launcher() {
  return (
    <button class="pill launcher" onClicked={() => sh("rofi -show drun -show-icons")}>
      <label label="" />
    </button>
  )
}
