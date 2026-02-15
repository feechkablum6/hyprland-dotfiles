import app from "ags/gtk4/app"
import { Astal } from "ags/gtk4"
import Launcher from "./Launcher"
import Workspaces from "./Workspaces"
import Clock from "./Clock"
import Net from "./Network"
import Volume from "./Volume"
import Bat from "./Battery"
import Notifs from "./Notifications"
import Power from "./Power"
import MediaPill from "../media/MediaPill"

export default function Bar(monitor = 0) {
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
