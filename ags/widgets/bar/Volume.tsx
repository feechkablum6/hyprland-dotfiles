import Gtk from "gi://Gtk?version=4.0"
import { createState } from "ags"
import { volState, setVolume as setVol, changeVolume, toggleMute, setMute } from "../../services/audio"

export default function Volume() {
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
