import { createPoll } from "ags/time"
import Pill from "../common/Pill"

export default function Clock() {
  const clock = createPoll("", 1000, () => {
    const d = new Date()
    const hh = String(d.getHours()).padStart(2, "0")
    const mm = String(d.getMinutes()).padStart(2, "0")
    const wd = d.toLocaleString(undefined, { weekday: "short" })
    const day = String(d.getDate()).padStart(2, "0")
    const mon = d.toLocaleString(undefined, { month: "short" })
    return `${hh}:${mm}  ${wd} ${day} ${mon}`
  })

  return (
    <Pill className="clock">
      <label label={clock} />
    </Pill>
  )
}
