# Connecting the two laptops

PilotPane only needs both laptops on the **same local IPv4 network**. Pick whichever of these you can use. The host shows every address it can be reached on; use the one that matches your connection.

Examples below call the laptop being controlled the **host** (Windows 10/11) and the other one the **viewer**. Addresses like `192.168.1.12` are examples; use the ones PilotPane shows.

## Firewall

The first time PilotPane starts, Windows Defender Firewall asks whether "PilotPane" (or "Electron" when run from source with `pnpm start`) may communicate on networks.

- Tick **Private networks** and click **Allow access**.
- If you'll use a **direct cable** or Bluetooth, Windows usually labels that network "Unidentified network" and treats it as **Public**. Either tick Public too, or set that network to Private:
  Settings > Network & internet > Ethernet (or the adapter) > **Network profile type: Private**.
- PilotPane still listens only on private LAN addresses, whatever the firewall allows.

Missed the prompt? Windows Security > Firewall & network protection > Allow an app through firewall > find Electron > tick Private (and Public if needed).

## 1. Same router (Wi-Fi or cable): easiest

1. Connect the host to the router (Wi-Fi or cable) and the viewer to the same router (cable if its Wi-Fi is broken).
2. Start PilotPane on the host. Use the address marked **Wi-Fi** or **Ethernet**, e.g. `192.168.1.12:7420`.
3. On the viewer, open Chrome and type that address.

If the page never loads: some routers have "AP isolation" or "client isolation" (common on guest networks) that blocks devices from seeing each other. Turn it off or use the main network.

## 2. Direct Ethernet cable

Modern network ports work with any Ethernet cable between two laptops (no special crossover cable needed).

Without a router there is no DHCP, so give each laptop a fixed address once:

**Host (Windows 11)**

1. Settings > Network & internet > Ethernet > IP assignment > **Edit** > Manual > IPv4 **On**.
2. IP address `192.168.50.1`, Subnet mask `255.255.255.0` (or prefix length `24`). Leave gateway and DNS empty. Save.
3. Network profile type: **Private**.

**Viewer (Windows 8)**

1. Control Panel > Network and Sharing Center > **Change adapter settings**.
2. Right-click **Ethernet** > Properties > **Internet Protocol Version 4 (TCP/IPv4)** > Properties.
3. **Use the following IP address**: `192.168.50.2`, subnet mask `255.255.255.0`. Leave the rest empty. OK.

Then open `http://192.168.50.1:7420` on the viewer.

> Without fixed addresses Windows picks automatic `169.254.x.x` addresses after about a minute. PilotPane lists those too and they often work, but fixed addresses are faster and more reliable. To undo later, set both back to "Obtain an IP address automatically".

## 3. Windows Mobile hotspot on the host

Settings > Network & internet > **Mobile hotspot** on the host.

- **Share over Wi-Fi**: the viewer joins the hotspot's Wi-Fi. (Not possible if the viewer's Wi-Fi is broken.)
- **Share over Bluetooth**: pair the viewer by Bluetooth, then on the viewer join the host's Bluetooth network (see section 5). Slow, but needs no Wi-Fi on the viewer.

The hotspot address is usually `192.168.137.1`; PilotPane labels it **Mobile hotspot**.

## 4. Phone USB tethering: may work, depends on the phone

A phone can put both laptops on its network: for example the viewer on **USB tethering** and the host on the phone's **Wi-Fi hotspot** at the same time. Whether the two can reach each other depends on the phone (some keep tethered devices apart). Try it; if the page doesn't load, use another option. Uses no mobile data for PilotPane itself, since traffic stays between the devices.

## 5. Bluetooth network (PAN): slow fallback

Use this only when nothing else works. Expect low frame rates; choose **Low** in the viewer toolbar (720p if the link turns out to be faster than expected).

1. Pair the two laptops over Bluetooth (both sides: Bluetooth settings > Add device).
2. **Host (Windows 11)**: easiest is Mobile hotspot > Share over **Bluetooth** (section 3). Otherwise: Control Panel > Devices and Printers, right-click the viewer > Connect using > **Direct connection** (or Access point).
3. **Viewer (Windows 8)**: Control Panel > Devices and Printers, right-click the host > Connect using > **Access point** (or Direct connection, matching the host).
4. Both laptops now have a "Bluetooth Network Connection" adapter. If they show only `169.254.x.x` addresses, give them fixed ones as in section 2 (e.g. `192.168.60.1` and `192.168.60.2`).
5. Open the address PilotPane shows under **Bluetooth**.

Bluetooth PAN support varies between laptops and drivers. If "Connect using" is missing, the driver doesn't support PAN.

## Checking the connection

On the viewer, press Win+R, type `cmd`, then `ping 192.168.50.1` (the host address). Replies mean the network is fine; if the page still doesn't load, it's the firewall (see the top of this page).

## When the host sleeps

If the host laptop sleeps or loses the network, the viewer keeps the last picture and keeps trying. When the host is awake again and has an address, the picture comes back without a PIN. If the host got a new PIN or restarted in between, the viewer asks for the new PIN. A sleeping laptop cannot be woken from the viewer.
