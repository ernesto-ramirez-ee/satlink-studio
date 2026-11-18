# 🛰️ SatLink Studio

**From where I stand, which satellites can I talk to right now, with which antenna, and how do I point it?**

SatLink Studio is a browser app that answers that question with real satellite data and real antenna physics: no installation, no account, no server.

### **[▶ Open SatLink Studio](https://ernesto-ramirez-ee.github.io/satlink-studio/)** · [User guide](docs/USER_GUIDE.md)

---

## Features

| | Tab | What you can do |
| --- | --- | --- |
| 📡 | **Antenna Lab** | Explore 2D and 3D radiation patterns of 8 antennas (dipole, monopole, QFH, Yagi, helix, patch, dish, phased array) with live sliders, and read gain, beamwidth and sidelobes. |
| 🌍 | **Sky View** | Share your location and see which real satellites are overhead, their passes over the next 24 hours, and a 3D globe. |
| 📶 | **Link Check** | Plot link margin vs. time over a pass for every antenna, see where the link fails, and get the simplest antenna that works. |
| 🎯 | **Live Steering** | Get dish pointing and Doppler, phased-array element phases and weights (CSV export), a 3D pass animation, and a Starlink-style beam-hop demo. |

A shared clock (play, pause, ×60) drives every tab, so a 30-minute pass plays in 30 seconds.

New here? The **[user guide](docs/USER_GUIDE.md)** walks through each tab.

## How it works

- **Real satellites.** Orbits come from [CelesTrak](https://celestrak.org/) and refresh automatically every 6 hours. Positions are computed in the browser with SGP4; ISS pass predictions match [Heavens-Above](https://www.heavens-above.com/) to within a second.
- **Real radio data.** 12 satellites (ISS, Meteor-M2, GOES, NOAA 20, Metop, GPS, Starlink and more) have frequencies, power and data rates, each cited to a source or clearly marked as assumed.
- **Textbook physics.** Antenna patterns, link budgets, noise, Doppler and phased-array steering follow standard formulas. 152 automated tests check them against textbook values. The details are in [PHYSICS.md](docs/PHYSICS.md).
- **Private by design.** Everything runs in your browser; your location never leaves it.

## Run it locally

Requires [Node.js](https://nodejs.org/) 22 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm test           # run the test suite
npm run build      # production build into dist/
npm run fetch-tle  # refresh orbit data from CelesTrak
```

Built with TypeScript, React, Vite, [satellite.js](https://github.com/shashwatak/satellite-js), [Plotly](https://plotly.com/javascript/), [three.js](https://threejs.org/) and [globe.gl](https://globe.gl/). Every push to `main` is tested, built and published to GitHub Pages automatically.

## Project docs

[User guide](docs/USER_GUIDE.md) · [Physics & formulas](docs/PHYSICS.md) · [Data sources](docs/DATA_SOURCES.md) · [Architecture](docs/ARCHITECTURE.md) · [Design decisions](docs/DECISIONS.md) · [Build plan](docs/PLAN.md) · [Progress log](docs/PROGRESS.md) · [Assignment](docs/ASSIGNMENT.md)

## About

A class project for the assignment *"create something using Claude"*: the app was built by Claude (Anthropic's AI) under the direction of Ernesto, an electrical engineering student, who set the requirements and made the design decisions. Every decision, and who made it, is recorded in the [decision log](docs/DECISIONS.md). AI agents working on the code start with [AGENTS.md](AGENTS.md).

## Credits

- Orbital elements: [CelesTrak](https://celestrak.org/)
- Transmitter frequencies: [SatNOGS DB](https://db.satnogs.org/) (CC BY-SA 4.0)
- Satellite specifications: NOAA, EUMETSAT, GPS.gov (IS-GPS-200), ARISS, AMSAT-UK and SpaceX FCC filings, linked per value in the app
- Earth texture: NASA Blue Marble (public domain), via the three-globe package
