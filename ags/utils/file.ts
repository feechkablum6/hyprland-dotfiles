import GLib from "gi://GLib?version=2.0"

export const iconPath = (n: string) => `${GLib.get_home_dir()}/.config/ags/icons/${n}`
