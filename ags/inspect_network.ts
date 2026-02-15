import Network from "gi://AstalNetwork";
const wifi = Network.get_default().wifi;
console.log("Wifi Enabled:", wifi.enabled);
console.log("Active AP:", wifi.activeAccessPoint?.ssid);
console.log("APs:", wifi.accessPoints.map(ap => ap.ssid).join(", "));
