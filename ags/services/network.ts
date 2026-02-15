import Network from "gi://AstalNetwork"
import { createState } from "ags"
import { interval } from "ags/time"
import { execAsync } from "ags/process"
import { TrafficState } from "../types/network"

const [traffic, setTraffic] = createState<TrafficState>({ rx: 0, tx: 0, rxSpeed: 0, txSpeed: 0 })
let lastRx = 0
let lastTx = 0
let lastTime = 0

const updateTraffic = async () => {
  const net = Network.get_default()
  if (!net || !net.wifi || !net.wifi.enabled) return

  // Get interface
  const iface = net.wifi.device?.interface
  if (!iface) return

  try {
    const raw = await execAsync(["cat", `/sys/class/net/${iface}/statistics/rx_bytes`])
    const rx = Number(raw)
    const rawTx = await execAsync(["cat", `/sys/class/net/${iface}/statistics/tx_bytes`])
    const tx = Number(rawTx)

    const now = Date.now()
    if (lastTime > 0) {
      const dt = (now - lastTime) / 1000
      if (dt > 0) {
        setTraffic({
          rx,
          tx,
          rxSpeed: (rx - lastRx) / dt,
          txSpeed: (tx - lastTx) / dt,
        })
      }
    }
    lastRx = rx
    lastTx = tx
    lastTime = now
  } catch {
    // ignore
  }
}

interval(2000, updateTraffic)

export { traffic, updateTraffic }
