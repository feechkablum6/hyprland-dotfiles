import app from "ags/gtk4/app"
import { Astal } from "ags/gtk4"
import Gtk from "gi://Gtk?version=4.0"
import Pango from "gi://Pango?version=1.0"
import { With } from "ags"
import { mediaSnap, mediaTime, mediaOpen, mediaCover, mediaPlayPause, mediaNext, mediaPrev, setPosition, setVolume, notifyHover } from "../../services/media"
import { fmtTime } from "../../utils/time"
import { iconPath } from "../../utils/file"
import { sh } from "../../utils/exec"

const COVER_SIZE = 200

export default function MediaPopup(monitor = 0) {
  const anchor = Astal.WindowAnchor.TOP | Astal.WindowAnchor.LEFT
  const MEDIA_POPUP_LEFT = 90

  return (
    <window
      visible={mediaOpen}
      name="media"
      class="media-popup-window"
      monitor={monitor}
      layer={Astal.Layer.OVERLAY}
      exclusivity={Astal.Exclusivity.NORMAL}
      anchor={anchor}
      marginTop={0}
      marginLeft={MEDIA_POPUP_LEFT}
      application={app}
    >
      <box
        class="media-popup"
        spacing={20}
        widthRequest={560}
        halign={Gtk.Align.START}
        $={(self) => {
          const m = new Gtk.EventControllerMotion()
          m.connect("enter", () => notifyHover("popup", true))
          m.connect("leave", () => notifyHover("popup", false))
          self.add_controller(m)
        }}
      >
        <box
          class="media-cover"
          widthRequest={COVER_SIZE}
          heightRequest={COVER_SIZE}
          hexpand={false}
          vexpand={false}
          $={(self) => {
            self.set_size_request(COVER_SIZE, COVER_SIZE)
            self.set_hexpand(false)
            self.set_vexpand(false)
            self.set_halign(Gtk.Align.START)
            self.set_valign(Gtk.Align.START)
            self.set_overflow(Gtk.Overflow.HIDDEN)
          }}
        >
            <With value={mediaCover}>
                {(tex) => (
                    <picture
                        hexpand={false}
                        vexpand={false}
                        halign={Gtk.Align.FILL}
                        valign={Gtk.Align.FILL}
                        widthRequest={COVER_SIZE}
                        heightRequest={COVER_SIZE}
                        canShrink={true}
                        keepAspectRatio={true}
                        contentFit={Gtk.ContentFit.COVER}
                        paintable={tex}
                    />
                )}
            </With>
        </box>

        <box orientation={Gtk.Orientation.VERTICAL} hexpand spacing={10}>
          {/* Controls - Top */}
          <With value={mediaSnap}>
            {(m) =>
              m.has && (
                <box orientation={Gtk.Orientation.VERTICAL} spacing={10} valign={Gtk.Align.CENTER} vexpand>

                  {m.status === "Stopped" ? (
                    <box orientation={Gtk.Orientation.VERTICAL} spacing={20} halign={Gtk.Align.CENTER}>
                      <label class="media-title" label="Ничего не играет" />
                      <box class="media-controls" spacing={20} halign={Gtk.Align.CENTER}>
                        <button
                          class="media-circ-btn"
                          onClicked={() => sh("google-chrome-beta https://twitch.tv")}
                        >
                          <image file={iconPath("services/twitch.png")} pixelSize={24} />
                        </button>
                        <button
                          class="media-circ-btn"
                          onClicked={() => sh("google-chrome-beta https://youtube.com")}
                        >
                          <image file={iconPath("services/youtube.png")} pixelSize={24} />
                        </button>
                        <button
                          class="media-circ-btn"
                          onClicked={() => sh("google-chrome-beta https://music.yandex.ru/playlists/lk.f6addeb0-d363-4a3e-ae0a-9d1244b40481")}
                        >
                          <image file={iconPath("services/yandex-music.png")} pixelSize={24} />
                        </button>
                      </box>
                    </box>
                  ) : (
                    <box orientation={Gtk.Orientation.VERTICAL} spacing={10} valign={Gtk.Align.CENTER} vexpand>
                      {/* Title and Artist */}
                      <box orientation={Gtk.Orientation.VERTICAL} spacing={4} halign={Gtk.Align.CENTER}>
                        <label
                          class="media-title"
                          label={m.title}
                          ellipsize={Pango.EllipsizeMode.END}
                          maxWidthChars={30}
                        />
                        <label
                          class="media-artist"
                          label={m.artist}
                          ellipsize={Pango.EllipsizeMode.END}
                          maxWidthChars={30}
                        />
                      </box>

                      <box class="media-controls" spacing={20} halign={Gtk.Align.CENTER}>
                        <button
                          class="media-circ-btn"
                          sensitive={mediaSnap((mm) => !!mm.canPrev)}
                          onClicked={() => mediaPrev()}
                        >
                          <image iconName="media-skip-backward-symbolic" pixelSize={20} />
                        </button>
                        <button
                          class={mediaSnap((mm) => (mm.status === "Playing" ? "media-circ-btn-play is-playing" : "media-circ-btn-play"))}
                          sensitive={mediaSnap((mm) => !!mm.canControl)}
                          onClicked={() => mediaPlayPause()}
                        >
                          <image
                            iconName={mediaSnap((mm) =>
                              mm.status === "Playing" ? "media-playback-pause-symbolic" : "media-playback-start-symbolic",
                            )}
                            pixelSize={28}
                          />
                        </button>
                        <button
                          class="media-circ-btn"
                          sensitive={mediaSnap((mm) => !!mm.canNext)}
                          onClicked={() => mediaNext()}
                        >
                          <image iconName="media-skip-forward-symbolic" pixelSize={20} />
                        </button>
                      </box>

                      {/* Duration */}
                      <box orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                        <box spacing={10}>
                          <label class="media-sub-label" label="DURATION" hexpand xalign={0} />
                          <image iconName="audio-input-microphone-symbolic" pixelSize={12} class="media-wave" />
                          <label class="media-sub-label" label={mediaTime((t) => `${fmtTime(t.pos)} / ${fmtTime(t.len)}`)} xalign={1} />
                        </box>
                        <slider
                          class="media-slider"
                          hexpand
                          min={0}
                          max={mediaTime((t) => t.len)}
                          value={mediaTime((t) => t.pos)}
                          sensitive={mediaSnap((mm) => !!mm.canSeek)}
                          onChangeValue={({ value }) => {
                            setPosition(Number(value))
                          }}
                        />
                      </box>

                      {/* Volume */}
                      <box orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                        <box spacing={10}>
                          <label class="media-sub-label" label="VOLUME" hexpand xalign={0} />
                          <label class="media-sub-label" label={mediaSnap((mm) => `${Math.round((Number.isFinite(mm.volume) ? mm.volume : 0.5) * 100)}%`)} xalign={1} />
                        </box>
                        <box spacing={10}>
                          <image class="media-vol-icon" iconName="audio-volume-high-symbolic" pixelSize={16} />
                          <slider
                            class="media-vol"
                            hexpand
                            min={0}
                            max={1}
                            value={mediaSnap((mm) => (Number.isFinite(mm.volume) ? mm.volume : 0.5))}
                            onChangeValue={({ value }) => {
                              setVolume(Number(value))
                            }}
                          />
                        </box>
                      </box>
                    </box>
                  )}
                </box>
              )
            }
          </With>
        </box>
      </box>
    </window>
  )
}
