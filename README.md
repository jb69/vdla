# VDLA

VESC Data Log Analyzer is a browser-based viewer for VESC telemetry logs. It
parses supported VESC text/CSV exports locally, displays the route and
telemetry, and provides summary and performance analysis without uploading log
data to a server.

## Quick Start

The app is static HTML, CSS, and JavaScript. Serve the repository over HTTP so
the browser can load the local uPlot assets and external map assets:

```sh
cd /path/to/vdla
python3 -m http.server 8000
```

Open [http://localhost:8000/index.html](http://localhost:8000/index.html),
choose a board profile, and select one or more VESC log files. A local HTTP
server is recommended over opening `index.html` directly because browser file
and cross-origin rules vary by browser.

There is no package install or build step for the application. The vendored
uPlot submodule is already included in the repository.

## Supported Workflows

### Board Profiles

- **E-skateboard** uses tachometer speed and distance.
- **Efoil** uses GNSS speed and distance because wheel/tachometer values are
	not meaningful for an efoil. GNSS-derived altitude, vertical speed, and
	horizontal accuracy are also available when present in the log.
	Enter the wing area in the hamburger menu to calculate the efoil lift
	coefficient from average logged power and GNSS speed.

The selected profile is saved in browser `localStorage` and restored on the
next visit.

### Views

- **Overview** provides a quick summary of the loaded session and a compact
	chart.
- **Log** combines the Leaflet route map, uPlot telemetry chart, playback
	controls, and metric visibility controls. Drag the separator between the
	map and chart to change their heights; the chart follows container and
	viewport resizing.
- **Performance** reports heuristic findings and session, speed, power,
	battery, and drive metrics. See [PERFORMANCE.md](PERFORMANCE.md) for the
	calculations and interpretation guidance.

### Playback and Visibility

The Log view can play the log from the current cursor position at 0.25x, 1x,
2x, 4x, or 10x speed. The map marker, chart cursor, and telemetry readout are
updated together.

Series visibility and per-metric legend visibility are persisted by metric
name in `localStorage`. To reset those settings, clear the site data for the
local server in the browser, or run:

```js
localStorage.removeItem("vdla-series-visibility");
localStorage.removeItem("vdla-legend-visibility");
localStorage.removeItem("vdla-board-mode");
```

## Log Files

The analyzer accepts text-based VESC log exports using the supported comma- or
semicolon-separated layouts implemented in `vdla.js`. Multiple selected files
are read, ordered by the timestamp encoded in their filenames when available,
and combined into one session.

For reliable results:

- Export the complete telemetry log from VESC Tool.
- Keep the original header and column order.
- Include GNSS latitude, longitude, altitude, speed, and accuracy fields for
	efoil route and distance analysis.
- Check the Performance tab's GNSS accuracy findings before treating GNSS
	speed, distance, or efficiency as precise.

Invalid or non-text files are rejected in the upload flow. Logs with missing
or zero GNSS coordinates cannot contribute valid route distance.

## Repository Layout

```text
index.html              Application markup and external asset references
vdla.js                 Log parsing, profiles, charts, map, playback, and UI
vdla.css                Application and responsive layout styles
PERFORMANCE.md          Performance calculations and thresholds
uPlot/                  Vendored uPlot Git submodule
```

## Dependencies

- [uPlot](https://github.com/leeoniya/uPlot) `1.6.32`, vendored under `uPlot/`
- [Leaflet](https://leafletjs.com/) `1.9.4`, loaded from unpkg with SRI
- Map tiles and attribution from the configured Mapbox/OpenStreetMap sources

If the uPlot submodule is missing after cloning, initialize it with:

```sh
git submodule update --init --recursive
```

## Development Checks

Useful checks after changing the app:

```sh
node --check vdla.js
git diff --check
```

For UI changes, load a representative log and verify the map, chart, legend,
playback, tab switching, profile switching, and map/chart resize behavior in a
browser.

# Credits
Special Thanks to:

@leeoniya for his awesome fast [uPlot Library](https://github.com/leeoniya/uPlot)

@Leaflet for the super simple to use [Map API](https://github.com/Leaflet/Leaflet)
