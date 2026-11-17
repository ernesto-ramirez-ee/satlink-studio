# Assignment

## Context

This is a class assignment: *create something using Claude*. The project owner, an electrical engineering student, chose a satellite-communications web app. The rule of the assignment is that **Claude builds the app under the owner's direction**. The owner sets the requirements and makes the decisions; the agent writes the code and docs.

- **Deadline:** Wednesday, November 18, 2026
- **Delivery:** a public website on GitHub Pages, plus this repository
- **Plan doc (shared, editable):** "SatLink Studio — Design & Build Plan" in the owner's Claude workspace. `docs/PLAN.md` is the in-repo copy agents work from.

## Goal

From where I stand, which satellites can I talk to right now, with which antenna, and how do I point it?

## Required features (owner's priorities)

1. **Radiation pattern visualizer.** Different antennas and settings.
2. **Real satellites.** Different orbits (LEO, MEO, GEO), from online databases.
3. **Own location.** The browser's location sets the ground station. *(owner favourite)*
4. **Link margin.** Plotted vs. time over a pass, with failures shown clearly. *(owner favourite)*
5. **Optimal antenna.** A recommendation for the selected satellite, with its reason.
6. **Real-time parameters.** Pointing for movable antennas (dish), and element phases for phased arrays.
7. **Beam-hop demo.** A phased array handing over between LEO satellites. *(owner favourite)*

## Out of scope

- Controlling real hardware, or transmitting (uplinks require a licence; the app is receive/simulation only).
- Full-wave EM simulation. Patterns are analytic models.
- User accounts, servers, and paid APIs.

## Definition of done

- All four tabs work on the live GitHub Pages site in a current desktop browser.
- `npm test` passes, and physics tests match textbook values (`docs/PHYSICS.md`).
- Link Check works for at least 3 real satellites from the user's own location (MVP gate).
- The README explains the app and credits data sources.
- Simplifications and assumed values are stated in the UI and in `docs/PHYSICS.md`.
