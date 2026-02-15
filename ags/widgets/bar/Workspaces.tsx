import Hyprland from "gi://AstalHyprland"
import { createBinding } from "ags"
import Pill from "../common/Pill"

export default function Workspaces() {
  const hypr = Hyprland.get_default()
  const focused = createBinding(hypr, "focused-workspace")
  const focusedId = focused((ws: Hyprland.Workspace) => (ws ? Number(ws.id) : 0))

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
