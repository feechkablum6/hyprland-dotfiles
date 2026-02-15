import { createState } from "ags"
import { interval } from "ags/time"
import { execAsync } from "ags/process"
import { VolState } from "../types/audio"

const [volState, setVolState] = createState<VolState>({ vol: 0, muted: false })

export { volState }

export const updateVol = () => {
  execAsync(["wpctl", "get-volume", "@DEFAULT_AUDIO_SINK@"])
    .then((out) => {
      const s = String(out || "").trim()
      const m = s.match(/Volume:\s*([0-9.]+)/)
      const vol = m ? Number(m[1]) : 0
      const muted = /MUTED/i.test(s)
      setVolState({ vol: Number.isFinite(vol) ? vol : 0, muted })
    })
    .catch(() => setVolState({ vol: 0, muted: false }))
}

// Initial update and poll
updateVol()
interval(2000, updateVol)

export const setVolume = (percent: number) => {
    return execAsync(`wpctl set-volume @DEFAULT_AUDIO_SINK@ ${Math.round(percent * 100)}%`).then(updateVol)
}

export const changeVolume = (delta: string) => { // e.g. "5%+" or "5%-"
    return execAsync(`wpctl set-volume @DEFAULT_AUDIO_SINK@ ${delta}`).then(updateVol)
}

export const toggleMute = () => {
    return execAsync("wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle").then(updateVol)
}

export const setMute = (mute: boolean) => {
    return execAsync(`wpctl set-mute @DEFAULT_AUDIO_SINK@ ${mute ? 1 : 0}`).then(updateVol)
}
