import Gtk from "gi://Gtk?version=4.0"
import Pango from "gi://Pango?version=1.0"
import GLib from "gi://GLib?version=2.0"
import { With } from "ags"
import { mediaSnap, mediaPlayPause, notifyHover } from "../../services/media"
import { iconPath } from "../../utils/file"

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

export default function MediaPill() {
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
