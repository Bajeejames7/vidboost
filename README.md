# VidBoost

A small Chrome / Edge extension (Manifest V3) for smoother video streaming on slow or unstable internet.

It hooks into the web video players that most sites use (hls.js, Shaka, video.js) and tunes them:

- **Bigger buffer.** It downloads up to 3 minutes ahead by default, adjustable from 30 s to 10 min. A short dip in your connection then doesn't stall playback.
- **Quick rewinds.** It keeps the last 2 minutes behind the playhead, so jumping back a little doesn't reload.
- **Smarter quality.** It starts on auto quality and keeps the buffer short until quality settles, then raises it to your setting. Without that wait, it could fill minutes of video at a blurry quality.
- **Quality cap.** It limits playback to 1080p / 720p / 480p / 360p to save data or keep a weak connection steady. The cap applies live.
- **Self-healing.** After a network or media error it retries automatically instead of freezing.
- **Fewer ads.** It blocks about 30 common ad and popunder networks with `declarativeNetRequest`.
- **On-video HUD.** A small overlay shows the buffer ahead, the quality playing and loading, measured Mbps, and the number of stalls. It also has buttons to change the quality cap.

## Install

VidBoost isn't on the Chrome Web Store, so you load it unpacked:

1. Download this repo: **Code → Download ZIP** and extract it, or `git clone` it.
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Turn on **Developer mode** (toggle at the top right).
4. Click **Load unpacked** and pick the `vidboost` folder (the one containing `manifest.json`).
5. Pin it: click the puzzle icon in the toolbar, then the pin next to VidBoost.

### Updating

Pull or re-download the files. Then click the **↻ reload** icon on the VidBoost card in `chrome://extensions` and refresh any open video tabs.

## How to use

1. Open a video page and start playing. VidBoost works automatically.
2. **Tip for slow connections:** pause for a minute at the start. It keeps buffering while paused, so you build a cushion before watching.
3. Press **Alt+B** to show or hide the HUD in the top-left corner of the video.

### Popup settings (click the toolbar icon)

| Setting | What it does | When it applies |
|---|---|---|
| Enabled | Turns all tuning on or off | Reload the page |
| Buffer ahead | How much video to download ahead (30 s – 10 min, default 3 min) | Reload the page |
| Max quality | Auto, or cap at 1080p / 720p / 480p / 360p | Live |
| Fast start | Starts at the lowest quality so playback begins instantly, then climbs up | Reload the page |
| On-video HUD | Shows or hides the overlay | Live |

### Reading the HUD

```
VidBoost buffer 2:08 · 720p → 1080p · 6.2 Mbps · stalls 0
auto 1080p 720p 480p 360p
```

- **buffer**: how much video is downloaded ahead of where you are. Green means over 30 s, yellow over 8 s, red is close to stalling.
- **720p → 1080p**: the quality playing now → the quality being downloaded.
- **Mbps**: the download speed the player measured.
- **stalls**: how many times playback paused to buffer.
- The bottom row sets the quality cap. Click one to switch.

## Limitations

- It only tunes players it can reach. Some sites bundle their player privately (no global `Hls` / `shaka` / `videojs`). There VidBoost still blocks ads, but the HUD shows no Mbps and the buffer settings have no effect.
- Jumping back more than 2 minutes, or to a part you skipped over, still has to download that part.
- A buffer can't fix an overloaded server. If the buffer stays at 0 while your connection is fine, the source is the problem. Try another server or quality.
- VPNs (e.g. Cloudflare WARP) can make streaming much worse: they add latency, route you through distant exits and trigger CAPTCHAs. If playback is bad, try with the VPN off.
- Very large buffers at high quality use RAM. 10 minutes of 1080p is about 400 MB, and the browser may evict data past its own limits.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Extension manifest (MV3) |
| `boost.js` | Runs in the page's main world. Hooks the hls.js / Shaka / video.js players, applies the buffer, quality and recovery tuning, and draws the HUD |
| `bridge.js` | Runs in the isolated world. Syncs settings between `chrome.storage` and the page |
| `popup.html`, `popup.js` | Settings popup |
| `rules.json` | Ad-blocking rules (generated) |
| `gen_rules.js` | Regenerates `rules.json`. Edit the domain list, then run `node gen_rules.js` |

## License

MIT
