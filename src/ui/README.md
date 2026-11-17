# ui/

React components only. No physics here: import it from `src/engine/`.

- `tabs/` — one component per tab: `AntennaLab`, `SkyView`, `LinkCheck`, `LiveSteering`
- `components/` — shared pieces (`GroundStationPanel`, plot wrappers, sliders)

Plotting: Plotly (`plotly.js-dist-min`) for polar, 3D and line plots. Lazy-load heavy libraries (`import()`) so the first page load stays fast.
