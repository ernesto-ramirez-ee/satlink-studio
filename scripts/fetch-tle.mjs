// Downloads orbital elements (OMM JSON) from CelesTrak into public/data/tle/.
// Run by .github/workflows/update-tle.yml every 6 hours, or locally with:
//   node scripts/fetch-tle.mjs                 (all groups)
//   node scripts/fetch-tle.mjs weather geo     (only these groups, e.g. to retry failures)
// CelesTrak asks users not to download the same data more than once every
// 2 hours, so do not call this in a tight loop.
//
// index.json keeps one entry per group with its own fetchedAt. A group that fails keeps its
// previous file and entry, and the top-level fetchedAt is the OLDEST group date, so the app
// never claims data is fresher than it is.
import { mkdir, readFile, writeFile } from 'node:fs/promises'

// Keep this list in sync with docs/DATA_SOURCES.md and src/data/tle.ts.
// ('noaa' was removed: CelesTrak dropped that group after NOAA-15/18/19 were retired in 2025.)
const GROUPS = ['stations', 'weather', 'gps-ops', 'iridium-NEXT', 'geo', 'amateur', 'starlink']

const requested = process.argv.slice(2)
const unknown = requested.filter((g) => !GROUPS.includes(g))
if (unknown.length) {
  console.error(`Unknown group(s): ${unknown.join(', ')}. Known: ${GROUPS.join(', ')}`)
  process.exit(2)
}
const toFetch = requested.length ? requested : GROUPS

const OUT_DIR = new URL('../public/data/tle/', import.meta.url)
await mkdir(OUT_DIR, { recursive: true })

// Start from the previous index so failed or skipped groups keep their entry.
let previous = { fetchedAt: null, groups: {} }
try {
  previous = JSON.parse(await readFile(new URL('index.json', OUT_DIR), 'utf8'))
} catch {
  // First run: no index yet.
}
const groups = {}
for (const [g, e] of Object.entries(previous.groups ?? {})) {
  groups[g] = { ...e, fetchedAt: e.fetchedAt ?? previous.fetchedAt ?? null }
}

let failures = 0
for (const group of toFetch) {
  const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(group)}&FORMAT=json`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'SatLink-Studio (class project)' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const records = await res.json()
    await writeFile(new URL(`${group}.json`, OUT_DIR), JSON.stringify(records))
    groups[group] = { count: records.length, file: `${group}.json`, fetchedAt: new Date().toISOString() }
    console.log(`${group}: ${records.length} objects`)
  } catch (err) {
    failures++
    console.error(`${group}: failed (${err.message})${groups[group] ? `; keeping the copy from ${groups[group].fetchedAt}` : ''}`)
  }
}

// If every requested group failed, leave the snapshot (and its index) untouched.
if (failures === toFetch.length) process.exit(1)

const dates = Object.values(groups)
  .map((e) => e.fetchedAt)
  .filter(Boolean)
  .sort()
const index = { fetchedAt: dates[0] ?? null, newestFetchedAt: dates.at(-1) ?? null, groups }
await writeFile(new URL('index.json', OUT_DIR), JSON.stringify(index, null, 2) + '\n')
if (failures) console.error(`${failures} group(s) failed; rerun later with: node scripts/fetch-tle.mjs <group> ...`)
