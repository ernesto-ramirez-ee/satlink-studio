# SatLink Studio

Visualize antenna radiation patterns, see which real satellites are overhead from your own location, check whether the link closes, and get the pointing or phased-array steering needed to reach them.

> Class project, built by an AI agent (Claude) under the direction of the author. Due November 18, 2026.
> **Agents:** start with [`AGENTS.md`](AGENTS.md).

**Live site:** `https://<your-github-username>.github.io/<repo-name>/` (after the first deploy)

## Features

| Tab | What it shows | Status |
| --- | --- | --- |
| Antenna Lab | 2D and 3D radiation patterns for 8 antenna types, with live sliders | Done |
| Sky View | Your location, satellites overhead, and 24 h pass predictions | Done |
| Link Check | Link margin vs. time over a pass, and the recommended antenna | Done |
| Live Steering | Dish az/el and Doppler, phased-array phase map, and the beam-hop demo | Done |

## Run locally

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

## Publish to GitHub Pages (one-time)

1. Install Git (Windows: `winget install --id Git.Git -e`, then open a new terminal) and set your name and email once: `git config --global user.name "Your Name"` and `git config --global user.email "you@example.com"`.
2. Create an empty **public** repository on GitHub, e.g. `satlink-studio`. Don't add a README, .gitignore or license, because this folder already has them. (Pages on a free account requires a public repo.)
3. In this folder:
   ```bash
   git init -b main
   git add .
   git commit -m "SatLink Studio"
   git remote add origin https://github.com/<you>/satlink-studio.git
   git push -u origin main
   ```
   The first push opens a browser window to sign in to GitHub.
4. On GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions**. Then open **Actions → Deploy to GitHub Pages → Run workflow** (the first run may have started before Pages was enabled).
5. Every push to `main` now runs `npm test` and `npm run build`, then publishes `dist/` (workflows in `.github/workflows/`). The **Update TLE snapshot** workflow refreshes satellite orbits every 6 hours and redeploys.

## Docs

- [Assignment](docs/ASSIGNMENT.md) · [Plan](docs/PLAN.md) · [Progress log](docs/PROGRESS.md)
- [Architecture](docs/ARCHITECTURE.md) · [Physics](docs/PHYSICS.md) · [Data sources](docs/DATA_SOURCES.md) · [Decisions](docs/DECISIONS.md)

## Data credits

Orbital elements from [CelesTrak](https://celestrak.org/). Transmitter frequencies from the [SatNOGS DB](https://db.satnogs.org/) (CC BY-SA 4.0). Earth texture: NASA Blue Marble (public domain), via the three-globe package.
