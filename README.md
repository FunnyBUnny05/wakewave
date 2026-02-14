# 🌊 WakeWave — Spotify Alarm Clock

Wake up to your favorite Spotify songs. A beautiful, modern alarm clock web app with Spotify integration.

![WakeWave](https://img.shields.io/badge/WakeWave-Spotify%20Alarm%20Clock-1DB954?style=for-the-badge&logo=spotify&logoColor=white)

## ✨ Features

- **🎵 Spotify Integration** — Search and select any song from Spotify's catalog
- **⏰ Multiple Alarms** — Set as many alarms as you need
- **🔁 Repeat Days** — Set alarms for specific days of the week
- **🌅 Gentle Wake-Up** — Volume gradually fades in over 30 seconds
- **😴 Snooze** — 5-minute snooze when you need just a bit more sleep
- **🌙 Premium Dark UI** — Beautiful glassmorphism design with Spotify green accents
- **💾 Persistent** — Alarms saved locally, survive page refreshes
- **📱 Responsive** — Works on desktop and mobile browsers

## 🚀 Quick Start

### 1. Set Up Spotify Developer App

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Click **Create an App**
3. Name it "WakeWave" (or anything you like)
4. Add your deployed URL (e.g., `https://yourusername.github.io/outer-equinox/`) as a **Redirect URI**
5. Copy the **Client ID**

### 2. Deploy

Push to GitHub and enable GitHub Pages (Settings → Pages → Source: GitHub Actions).

### 3. Use

1. Open the deployed site
2. Paste your Spotify Client ID
3. Connect your Spotify account
4. Create alarms and choose your wake-up songs!

## 🛠️ Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

> **Note:** For local development, add `http://localhost:5173/` as a Redirect URI in your Spotify Developer App.

## ⚠️ Requirements

- **Spotify Premium** — Required for in-browser playback via Web Playback SDK
- **Browser Tab** — Must stay open for alarms to work
- **Modern Browser** — Chrome, Firefox, Safari, Edge (latest versions)

## 📄 License

MIT
