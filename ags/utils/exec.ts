import { execAsync } from "ags/process"

export const sh = (cmd: string) =>
  execAsync(["bash", "-lc", cmd]).catch(() => "")

export const playerctl = (args: string[]) =>
  execAsync(["playerctl", ...args]).catch(() => "")

export const wpctl = (cmd: string) => sh(`LC_ALL=C wpctl ${cmd} 2>/dev/null`)
