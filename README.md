# 🐍 Neon Snake Pro

> A premium, MNC-level Snake game built with **pure HTML, CSS & JavaScript** — no frameworks, no libraries.

🎮 **[Play Live](https://revanthh04.github.io/neon-snake-pro/)** &nbsp;|&nbsp; ⭐ **[GitHub Repo](https://github.com/revanthh04/neon-snake-pro)**

---

## ✨ Features

| Feature | Details |
|---|---|
| 🤖 **AI Autopilot** | BFS pathfinding finds the shortest route to food |
| 🗺️ **4 Maps** | Classic · Walls · Wrap-around · Maze |
| ⚡ **Power-Ups** | Speed · Shield · Ghost · Shrink |
| 🎨 **3 Themes** | Neon · Inferno · Ocean |
| 🏆 **Leaderboard** | Top 10 scores saved in localStorage |
| 🔊 **Sound Effects** | Web Audio API — synthesized, no audio files |
| 📱 **Mobile Ready** | Touch swipe controls |
| 👁️ **AI Visualization** | See the BFS planned path highlighted in real time |

---

## 🎮 Controls

| Key | Action |
|---|---|
| `↑ ↓ ← →` or `W A S D` | Move snake |
| `Space` / `P` | Pause / Resume |
| `A` | Toggle AI autopilot |
| `M` | Mute / Unmute |

**Mobile:** Swipe in any direction

---

## 🧠 Algorithms & Concepts

- **BFS (Breadth-First Search)** — AI pathfinding on a 20×20 grid graph
- **Set for O(1) lookup** — Wall collision uses `Set<"x,y">` instead of array search
- **Decoupled render/tick loops** — `requestAnimationFrame` (60fps) + `setTimeout` (game speed)
- **CSS Custom Properties** — Theme switching with zero JS DOM manipulation
- **Web Audio API** — Synthesized sound without audio files
- **Particle system** — Physics-based velocity + friction simulation
- **State machine** — `idle → playing → paused → over`

---

## 🚀 Run Locally

No build step needed. Just open the file:

```bash
git clone https://github.com/your-username/neon-snake-pro.git
cd neon-snake-pro
open index.html        # Mac
# or double-click index.html on Windows/Linux
```

---

## 📁 Project Structure

```
neon-snake-pro/
├── index.html   ← Page structure & all UI elements
├── style.css    ← CSS design system (3 themes, animations)
├── game.js      ← All game logic (700+ lines, 24 sections)
└── README.md
```

---

## 📊 Level System

| Level | Score | Speed | Snake Color |
|---|---|---|---|
| 1 | 0–9 | 180ms/tick | 🟢 Neon Green |
| 2 | 10–19 | 140ms/tick | 🟡 Yellow |
| 3 | 20–29 | 110ms/tick | 🟠 Orange |
| 4 | 30+ | 90ms/tick | 🔴 Pink |

---

## ⚡ Power-Ups

| Item | Effect | Duration |
|---|---|---|
| ⚡ Speed | 2× movement speed | 6 seconds |
| 🛡️ Shield | Survive one collision | 8 seconds |
| 👻 Ghost | Pass through walls | 6 seconds |
| ✂️ Shrink | Snake length halved | Instant |

---

## 🛠️ Tech Stack

- **HTML5 Canvas API** — all game rendering
- **Vanilla CSS** — design system with CSS Custom Properties
- **Vanilla JavaScript (ES6+)** — no dependencies
- **localStorage API** — persistent leaderboard
- **Web Audio API** — synthesized sound effects

---

## 👨‍💻 Author

**Revanth** — Built as an MNC portfolio project  
GitHub: [@revanthh04](https://github.com/revanthh04)

---

## 📄 License

MIT License — free to use, modify, and distribute.
