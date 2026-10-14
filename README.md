# Pocket Desk

One source-labelled Scriptable widget for your iPhone Home Screen or Today View.

**Install and preview:** https://kush0511.github.io/pocket-desk/

The large widget combines four cards:

- **SORA:** overnight rate, 1M and 3M compounded rates, and observation date, using the public sheet behind [SORA Rates](https://kush0511.github.io/sora-rates/).
- **S&P 500:** next-12-month forward P/E and a valuation-band reference, using the dated snapshot behind [Valuation Bands](https://kush0511.github.io/spy-valuation-bands/). Bands are earnings scenarios, not price targets.
- **Last train:** nearest mapped MRT exit → Lakeside by default, calculated using the [Last Train Home](https://kush0511.github.io/sg-last-train-home/) routing engine. Manual origin/destination and transfer buffer are configurable.
- **Air quality:** US AQI model estimate for your selected location, with source time and CAMS/Open-Meteo attribution. This is not a nearby sensor reading or Singapore PSI.

## Install on iPhone

1. Install [Scriptable](https://apps.apple.com/app/scriptable/id1405459188).
2. Open the Pocket Desk site, tap **Copy script**, create a script in Scriptable with **+**, paste, and name it **Pocket Desk**. The download is `public/scriptable/pocket-desk.js`.
3. Run it once in Scriptable. Choose **Set up last train** to enable nearest-MRT location or enter stations manually. Lakeside is the default destination. Enable air quality separately after reviewing its location-sharing prompt.
4. Long-press your Home Screen or Today View, add a **Scriptable** widget, choose **Large**, and set its script to Pocket Desk in **Edit Widget**.
5. To update later, replace the script contents. Settings are kept separately in Scriptable's local documents, so replacing code does not erase them.

### Sizes and parameters

Set **Parameter** in the installed widget's **Edit Widget** panel:

| Size | Parameter | Cards |
| --- | --- | --- |
| Large | blank | All four |
| Medium | blank or `markets` | SORA + S&P 500 |
| Medium | `local` | Last train + air quality |
| Medium | `sora,air` (or any two supported card names) | Your chosen pair |
| Small | `sora`, `spx`, `train`, or `air` | One focused card |

Medium/large cards link separately. Small widgets have one tap target. The site preview is a web illustration with sample values, not an iPhone screenshot or a live financial/transport display.

## Location and reliability

- Automatic nearest-MRT matching happens **on the phone**, against public station-exit coordinates. Precise coordinates are not embedded in this repository or sent to a station-search service.
- Scriptable requests iOS location permission in the app. Widget updates are best-effort, not continuous tracking. A failed location update may use a clearly labelled saved fix for up to six hours; older fixes are rejected.
- Nearest means straight-line distance to an official exit, not walking distance or confirmed exit availability. Manual station selection remains available. No nearby MRT is shown when mapped exits are more than 5 km away.
- If you enable air quality, coordinates rounded to two decimal places are sent to Open-Meteo. Air caches are keyed by location. You can use a manual air-quality location or turn the feature off.
- iOS controls refresh timing. The requested refresh interval is not a guarantee. Each card carries its own observation date/time; failures and stale data are visible.
- Last-train results exclude your walk to the station and are not live departures or guaranteed connections. Singapore's service day runs through 03:59 the next morning.
- The current upstream timetable snapshot is **29 July 2026**. Tables older than 45 days are labelled **Historical estimate**; after 180 days the script suppresses the time. Station-coordinate freshness does not make timetables fresh. Check operator notices before relying on a late journey.
- Air quality is modelled US AQI; CAMS global resolution around Singapore is coarse. It is not a street-level sensor.

## Data provenance

- SORA: public Google Sheet used by the existing `sora-rates` dashboard; inspect that project's sourcing before financial decisions.
- S&P 500: `spy-valuation-bands/src/data/valuation-data.json`, sourced by that dashboard from StreetStats. Observation date is distinct from retrieval time.
- Train routing: MIT-licensed `sg-last-train-home` engine, adapted to Scriptable with source notice retained. Versioned network, timetable and transfer JSON are checked before use.
- Station coordinates: Contains information from **LTA MRT Station Exit (GEOJSON)**, accessed on 2026-10-14 from [data.gov.sg](https://data.gov.sg/datasets/d_b39d3a0871985372d7e1637193335da5/view), made available under the [Singapore Open Data Licence 1.0](https://data.gov.sg/open-data-licence). 146 operating MRT stations and 537 exits matched to the routing-network whitelist. No LRT-only/future station is selected automatically.
- Air quality: [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api), CAMS model data.

## Development and verification

```sh
npm ci
npm run lint
npm run test:pocket
npm run test:stations
PAGES_BASE_PATH=/pocket-desk npm run build
```

`test:pocket` uses a mocked Scriptable runtime, deterministic data and routing fixtures. It checks API use, supported point-size layout budgets, offline/invalid data, location fallbacks, privacy choices and service-day logic. `test:stations` validates coordinate bounds, uniqueness, all exit matches and optional sibling-network coverage. These tests do not reproduce Apple's actual rendering or refresh scheduler: an iPhone check is still needed after installation.

The existing standalone SORA/SPX scripts remain available for users who already installed them. `npm run test:widgets` is their older live-network harness, not the new deterministic suite.

GitHub Pages uses the existing deployment workflow. The static export is produced in `out/`. No server, Apple developer account, Mac build or API key is required for this widget.
