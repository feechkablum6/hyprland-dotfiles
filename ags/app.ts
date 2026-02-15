import css from "./style.css"
import wifiCss from "./wifi.css"

import app from "ags/gtk4/app"

import Bar from "./widgets/bar/Bar"
import MediaPopup from "./widgets/media/MediaPopup"
import WifiPopup from "./widgets/network/WifiPopup"

app.start({
  css: css + "\n" + wifiCss,
  main() {
    Bar(0)
    MediaPopup(0)
    WifiPopup(0)
  },
})
