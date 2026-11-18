# SatLink Studio — User Guide

How to use **[SatLink Studio](https://ernesto-ramirez-ee.github.io/satlink-studio/)**, tab by tab. No installation or account is needed; it runs entirely in your browser.

**Contents:** [Getting started](#getting-started) · [Antenna Lab](#1-antenna-lab) · [Sky View](#2-sky-view) · [Link Check](#3-link-check) · [Live Steering](#4-live-steering) · [Demo tips](#demo-tips) · [Troubleshooting](#troubleshooting) · [Glossary](#glossary)

---

## Getting started

The page has three parts:

- **Tabs** at the top: *Antenna Lab*, *Sky View*, *Link Check* and *Live Steering*.
- **Clock controls** in the top-right corner: ▶ / ❚❚ (play / pause), **×60** (run time 60× faster) and **Now** (back to real time). Every tab follows this clock.
- **Ground station panel** on the left: your location, your antenna, your receiver and the clock.

### Set your location

1. Click **Use my location** and allow the browser's location prompt.
2. Or click **Enter manually** and type a latitude and longitude in decimal degrees (south and west are negative), plus an altitude in metres.

Until you choose, the app uses Notre Dame, Indiana. Your location is remembered in your browser only and is never sent anywhere.

### Receiver noise figure

The **LNA noise figure** slider in the left panel sets how noisy your receiver's preamplifier is (1 dB is a good low-cost LNA). Link Check uses it.

---

## 1. Antenna Lab

Explore how eight antenna types radiate.

1. Pick an antenna from **Antenna**: half-wave dipole, quarter-wave monopole, QFH/turnstile, Yagi-Uda, axial-mode helix, microstrip patch, parabolic dish or planar phased array.
2. Move the **Frequency** slider and the antenna's own sliders (for example dish diameter, Yagi boom length, helix turns, or array size, spacing and steering angle).
3. Read the results:
   - **Pattern cuts** (left plot): two slices through the pattern in dBi. For narrow beams, tick **Zoom to main lobe**.
   - **3D pattern** (right plot): drag to rotate. Distance and colour both show gain.
   - **Readouts**: peak gain, half-power beamwidth (HPBW) in each cut, first sidelobe level, polarization and physical size.

Things to try:

- Make the dish bigger and watch the gain rise and the beam narrow.
- Set the phased array spacing above 0.6 λ and steer it to 40°. A red **grating lobe** warning appears and a second beam shows up in the 3D plot.

The antenna and settings you leave here are **"your antenna"** in the other tabs.

---

## 2. Sky View

See which real satellites are above you right now.

- **Show:** tick the groups to display: space stations, weather, amateur, GPS, Iridium, geostationary and Starlink. Starlink has about 11 000 satellites, so it takes a moment to load.
- **Sky now:** a dome seen from below. The centre is straight overhead, the edge is the horizon, and north is up. Colours mark the orbit type (LEO, MEO, GEO, HEO). **Click a dot** to select that satellite.
- **Selected satellite:** azimuth and elevation, distance, range rate, the point on Earth below it, and the **element set age**. The age turns red after 3 days, when predictions get less accurate.
- **Passes, next 24 h:** when the satellite rises, its highest point and when it sets. Use **Min. elevation** to hide low passes. Click a pass to draw its path on the sky plot.
- **Above the horizon:** every visible satellite, highest first. Click a row to select it.
- **Globe:** a 3D Earth with you (yellow pin), every satellite shown, and one orbit of the selected satellite in red.

Pass predictions match the independent tracker Heavens-Above to within a second.

---

## 3. Link Check

Can you actually receive a satellite from where you are, and with which antenna?

1. Choose a **Satellite**. There are 12 with radio data, including the ISS, weather satellites, GOES, GPS, a TV satellite and Starlink.
2. Choose its **Downlink** (the signal to receive) and a **Pass**. Geostationary satellites show the next hour instead of a pass.
3. Read the **Link margin vs. time** plot:
   - One line per antenna. **Your** antenna (from the Antenna Lab) is the thick line.
   - Above the dashed **3 dB** line the link is comfortable, between 0 and 3 dB it's marginal, and **below 0 dB it fails** (red area). Red bands mark the times when your antenna fails.
   - The dotted grey line is the satellite's elevation (right axis).
4. The **Recommended antenna** card names the simplest antenna that keeps at least 3 dB of margin for the whole pass above 10° elevation. It also gives a runner-up and explains why simpler antennas don't work.

Below the plot:

- **All antennas:** each antenna's mount, gain toward the satellite, noise temperature, worst margin and a verdict. "Not practical" means that antenna makes no sense at this frequency (for example a 1 m dish at 137 MHz).
- **Link budget:** the step-by-step calculation for your antenna at the highest point of the pass.
- **Downlink data:** the satellite's frequency, power and data rate with links to their sources. Values marked **assumed** are estimates.

Try it: change the dish diameter in the Antenna Lab, then come back and see whether NOAA 20's X-band link starts to work.

---

## 4. Live Steering

How to point an antenna at a satellite, live.

### 3D pass animation

1. Choose what to follow: the selected satellite's **pass** (the button is named after the satellite chosen at the top of the tab) or **Starlink beam-hop**.
2. Choose the antenna: **Dish** (turns and tilts to track) or **Phased array** (stays still while its beam steers electronically).
3. Drag the **time slider** or press ▶ to play the pass. Tick **Follow the clock** to follow the header clock instead.
4. Drag in the scene to rotate it, and scroll to zoom.

The antenna is drawn about 200 km wide so it can be seen next to the planet. The coloured lobe is its real radiation pattern. The green line of sight turns orange when the array has to steer beyond its 60° limit and disappears when the satellite is below the horizon.

In **Starlink beam-hop** mode, the slider covers 30 minutes and has a tick at each **hand-over**: the moment the beam jumps to a new satellite because the current one dropped below 25°.

### Dish pointing

The azimuth and elevation to send to a dish, how fast it must turn, the **Doppler shift**, and the exact frequency to tune your radio to. A **keyhole** warning appears for passes that go almost straight overhead, where an az/el mount can't keep up.

### Phased-array phases

- A colour map of the phase applied to each element of your array.
- **Steer toward:** the 3D animation's current moment (default), the selected satellite now, or the beam-hop's serving satellite.
- **Phase shifters:** continuous or 1–6 bits. Fewer bits cost some gain (the quantization loss shown).
- **Element weights:** the exact amplitude and phase (and real/imaginary parts) of every element. **Download weights (CSV)** or **Copy CSV** to use them elsewhere. The file records the satellite, time and steering angles.

### Starlink beam-hop demo

Click **Load Starlink and start**. The sky plot shows the Starlink satellites above you, with a ring at 25° and the satellite currently serving you. The timeline shows the serving satellite's elevation, with a dashed line at each hand-over.

---

## Demo tips

- Press **×60** in the header: 30 minutes of Starlink hand-overs play in 30 seconds.
- In the 3D animation, pick the ISS's highest pass, switch between **Dish** and **Phased array** and press ▶: the dish moves, the array doesn't.
- In Link Check, compare the ISS (a simple whip antenna is enough) with GOES 18 (needs a dish).
- Press **Now** to return to real time.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| "Location permission was denied" | Allow location for this site in your browser's site settings, or use **Enter manually**. |
| The globe or 3D animation stays blank | It needs WebGL. Use a current Chrome, Edge, Firefox or Safari and make sure hardware acceleration is on. |
| The 3D animation is frozen | Browsers pause animations in background tabs; bring the tab to the front. |
| A satellite has no passes | Some satellites aren't visible from every location within 24 hours; try lowering **Min. elevation** or pick another. |
| Link Check says the selected satellite has no RF data | Only 12 satellites have radio data; pick one from the Link Check list. |
| "Not a practical dish here" | The dish is too small for that frequency. Pointing still applies to any tracking antenna, such as a Yagi. |

---

## Glossary

| Term | Meaning |
| --- | --- |
| **Azimuth / elevation** | Compass direction (0° = north, clockwise) and angle above the horizon. |
| **dBi / dBic** | Antenna gain relative to an ideal isotropic antenna (linear / circular polarization). |
| **HPBW** | Half-power beamwidth: the angle over which the beam is within 3 dB of its peak. |
| **Sidelobe** | A smaller, unwanted lobe beside the main beam. |
| **Grating lobe** | A second full-strength beam in a phased array whose elements are too far apart. |
| **EIRP** | How much power the satellite effectively radiates toward you (dBW). |
| **G/T** | Receive gain divided by system noise temperature: the station's sensitivity. |
| **C/N0, Eb/N0** | Signal-to-noise ratios; Eb/N0 is per bit of data. |
| **Link margin** | How much better the signal is than the minimum needed. Below 0 dB the link fails. |
| **Doppler shift** | Frequency change caused by the satellite moving toward or away from you. |
| **Keyhole** | Near the zenith, an az/el mount must spin in azimuth faster than it can. |
| **Hand-over** | Switching from one satellite to the next. |
| **TLE / element set** | The orbit description used to predict a satellite's position. |
| **LEO / MEO / GEO / HEO** | Low, medium, geostationary and highly elliptical orbits. |

For the formulas and test values behind the app, see [PHYSICS.md](PHYSICS.md).
