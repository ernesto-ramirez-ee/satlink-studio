# Data sources

| Need | Source | Access | Used by |
| --- | --- | --- | --- |
| Orbital elements | [CelesTrak GP data](https://celestrak.org/NORAD/elements/) | `gp.php?GROUP=<group>&FORMAT=json`, free, no key | `scripts/fetch-tle.mjs` → `public/data/tle/` |
| Transmitter frequencies | [SatNOGS DB](https://db.satnogs.org/) API (`/api/transmitters/?satellite__norad_cat_id=<id>`) | Free, no key, CC BY-SA 4.0 | `src/data/` (browser, with fallback) |
| Observer location | Browser Geolocation API | Needs HTTPS and the user's permission | Ground-station panel |
| RF specs (EIRP, etc.) | `public/data/satellites.json` (hand-curated) | Static file | Link Check |

## TLE snapshot

`scripts/fetch-tle.mjs` downloads these CelesTrak groups: `stations`, `weather`, `gps-ops`, `iridium-NEXT`, `geo`, `amateur`, `starlink` (the `noaa` group no longer exists, D-013). The browser reads them through `src/data/tle.ts`; Starlink (~11 000 objects, 4.6 MB) is only loaded when switched on. It writes `public/data/tle/<group>.json` and an `index.json` with `fetchedAt`. CelesTrak asks for at most one download of the same data every 2 hours; the workflow runs every 6 hours.

## `satellites.json` schema

Schema version 2 (D-017):

```jsonc
{
  "schemaVersion": 2,
  "satellites": [
    {
      "noradId": 25544,
      "name": "ISS (ZARYA)",
      "orbit": "LEO",                    // LEO | MEO | GEO | HEO
      "tleGroup": "stations",            // which public/data/tle/ group holds its elements
      "downlinks": [
        {
          "id": "iss-fm",
          "label": "ARISS FM voice",
          "modulation": "FM voice",
          "freqHz": 145800000,
          "polarization": "linear",      // linear | rhcp | lhcp
          "eirpDbw": 9,
          "eirpByElevationDeg": [[5, 13.1], [90, 1.2]], // optional, for shaped (isoflux) beams
          "dataRateBps": 15000,
          "requiredEbN0Db": 10,
          "sources": ["https://..."],    // back every field NOT listed in "assumed"
          "assumed": ["eirpDbw", "dataRateBps", "requiredEbN0Db"],
          "notes": "How assumed values were estimated."
        }
      ]
    }
  ]
}
```

Each of `freqHz`, `polarization`, `eirpDbw`, `dataRateBps` and `requiredEbN0Db` is either backed by `sources` or listed in `assumed`; `src/data/satellites.test.ts` enforces this. Assumed values get an "assumed" badge in the UI. FM voice is modelled as a 15 kHz noise bandwidth with a 10 dB CNR threshold.

## Current list (12 satellites)

| Satellite | Orbit | Downlink | Main sources |
| --- | --- | --- | --- |
| ISS | LEO | 145.800 MHz FM voice, 145.825 MHz APRS | ARISS, SatNOGS DB |
| Meteor-M2 3, Meteor-M2 4 | LEO | 137.9 MHz LRPT 72 kbit/s, RHCP | SatNOGS DB, WMO OSCAR |
| SO-50 | LEO | 436.795 MHz FM (250 mW) | AMSAT-UK, SatNOGS DB |
| FUNcube-1 (AO-73) | LEO | 145.935 MHz BPSK 1200 | SatNOGS DB |
| Metop-B | LEO | 1701.3 MHz AHRPT 3.5 Mbit/s, RHCP | EUMETSAT TD 18 |
| NOAA-20 | LEO | 7812 MHz HRD 15 Mbit/s, EIRP vs. elevation | JPSS-1 HRD ICD |
| GOES-19, GOES-18 | GEO | 1694.1 MHz HRIT 400 kbit/s, EIRP 26.7 dBW | NOAA OSPO |
| GPS BIII-1 | MEO | 1575.42 MHz L1 C/A (EIRP derived from the ICD min. power) | IS-GPS-200N |
| Galaxy 19 | GEO | Ku TV (all values assumed) | Satbeams |
| Starlink-1008 | LEO | 11.7 GHz user downlink (EIRP from the filing's density, bandwidth assumed) | SpaceX FCC filing |

EIRP could not be found in an authoritative source for Meteor-M2, Metop, Galaxy 19 or Iridium (Iridium was left out).

## Original starter list (planning, superseded by the table above)

Chosen so each antenna type wins at least once:

- VHF/UHF LEO: ISS (145.8 MHz), Meteor-M2 2/3/4 LRPT (137 MHz; replaces the retired NOAA-15/18/19 APT, D-013), a few amateur CubeSats (435 MHz)
- L-band: Iridium (1.6 GHz), GOES-16/18 HRIT (1.69 GHz)
- S/X-band LEO: NOAA-20 / Metop
- Ku-band: one GEO TV satellite; Starlink (beam-hop demo; typical published EIRP)
- MEO: GPS L1 (1575.42 MHz)
