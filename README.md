# Learning Command Center 🧠

> **Your personal daily learning dashboard — 8 hours, 5 pillars, 30 days.**

Live dashboard tracking your journey across:

| Pillar | Daily Time |
|--------|-----------|
| 🗣️ Articulation & Confidence | 1 hour |
| 🧱 Databricks | 2 hours |
| ⚙️ MEAN Stack | 2 hours |
| 🤖 AI Learning | 1.5 hours |
| 🚀 Own Project | 1.5 hours |

## Features
- 📅 **30-day curriculum** — Day-by-day topics & tasks for all 5 pillars
- 🗂️ **Kanban Board** — Drag-and-drop task management
- ⏱️ **Pomodoro Timers** — 25-min focus sessions per pillar
- 📈 **Progress Rings** — Visual completion tracking
- 🔥 **Streak Tracker** — Daily accountability
- ⭐ **XP & Badges** — Gamification to keep you motivated
- 💾 **localStorage** — No backend needed, data saved in your browser

## 🚀 Live URL
Once deployed to GitHub Pages, your dashboard will be at:
`https://<your-username>.github.io/learning-command-center`

## Setup & Deploy

### 1. Create GitHub Repository
1. Go to [github.com/new](https://github.com/new)
2. Name it `learning-command-center`
3. Set it to **Public**
4. **Don't** initialize with README (we already have one)

### 2. Push to GitHub
```bash
cd /Users/selvakumar/Documents/AINew/learning-command-center
git init
git add .
git commit -m "🚀 Initial commit: Learning Command Center"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/learning-command-center.git
git push -u origin main
```

### 3. Enable GitHub Pages
1. Go to your repo → **Settings** → **Pages**
2. Source: **GitHub Actions**
3. The workflow will auto-deploy on every push!

### 4. Open Your Dashboard
Visit `https://<your-username>.github.io/learning-command-center`

## Local Development
Simply open `index.html` in your browser — no build step required!

```bash
open /Users/selvakumar/Documents/AINew/learning-command-center/index.html
```

## Project Structure
```
learning-command-center/
├── index.html          # Dashboard shell
├── styles.css          # Dark glassmorphism design
├── app.js              # Core logic (timers, kanban, XP, progress)
├── data/
│   └── curriculum.js   # 30-day learning plans for all 5 pillars
└── .github/
    └── workflows/
        └── deploy.yml  # Auto-deploy to GitHub Pages
```

---
*Built with ❤️ — Day 1 starts today!*
