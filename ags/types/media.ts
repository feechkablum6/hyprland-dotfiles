export type MediaService = "yandex-music" | "youtube" | "twitch" | "unknown"

export interface MediaSnapshot {
  has: boolean
  title: string
  artist: string
  album: string
  line: string
  cover: string
  status: "Playing" | "Paused" | "Stopped"
  service: MediaService
  appIcon: string
  volume: number
  canSeek: boolean
  canPrev: boolean
  canNext: boolean
  canControl: boolean
}

export interface MediaTime {
  pos: number
  len: number
}
