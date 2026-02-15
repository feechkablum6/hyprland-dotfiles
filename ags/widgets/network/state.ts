import { createState } from "ags"
import { timeout } from "ags/time"
import Network from "gi://AstalNetwork"

export const [wifiOpen, setWifiOpen] = createState(false)
let wifiHoverTimer: any = null

export const wifiShow = () => {
  if (wifiHoverTimer) {
    wifiHoverTimer.cancel?.()
    wifiHoverTimer = null
  }
  setWifiOpen(true)
  Network.get_default().wifi.scan()
}

export const wifiCloseLater = () => {
  if (wifiHoverTimer) wifiHoverTimer.cancel?.()
  wifiHoverTimer = timeout(200, () => {
    setWifiOpen(false)
  })
}
