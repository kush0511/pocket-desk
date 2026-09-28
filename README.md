# Pocket Desk

Native iPhone widgets for two GitHub Pages dashboards:

- [SORA Rates](https://kush0511.github.io/sora-rates/): overnight SORA plus 1M and 3M compounded rates
- [S&P 500 Valuation Bands](https://kush0511.github.io/spy-valuation-bands/): forward P/E, the 16×–26× earnings bands, and a 1-year chart

The widgets run in [Scriptable](https://scriptable.app), a free iOS app. They read the same public data the dashboards use, so you don't need a server or API keys:

| Widget | Data source |
| --- | --- |
| `public/scriptable/sora-rates-widget.js` | The public Google Sheet CSV used by `sora-rates/script.js` |
| `public/scriptable/spx-valuation-widget.js` | `src/data/valuation-data.json` in `spy-valuation-bands`, refreshed daily by that repo's GitHub Action |

Each script supports the small, medium and large Home Screen sizes and the Lock Screen slots (rectangular, inline, circular). If a fetch fails, it falls back to its last good copy and marks the data "offline". Tapping a widget opens the full dashboard.

This repo also contains a small Next.js site. It shows live previews of each widget, has copy and download buttons for the scripts, and compares other ways to get this data onto an iPhone.

## Install on your iPhone

1. Install **Scriptable** from the App Store.
2. Open the Pocket Desk site on your phone and tap **Copy script**. In Scriptable, tap **+**, paste the script and give it a name. Alternatively, download the `.js` file and open it in Scriptable.
3. Long-press your Home Screen, then tap **Edit → Add Widget → Scriptable**. Pick a size, long-press the new widget, choose **Edit Widget** and select the script.
4. Optional: set **Parameter** on the widget.
   - SORA widget: `sora` (default), `1m` or `3m` chooses which rate is shown large.
   - SPX widget: `16`–`26` chooses the band to compare against (default `20`).

iOS decides when widgets refresh, usually every 15–60 minutes. Both data sources only update once per business day.

## Run locally

```bash
npm install
npm run dev          # http://localhost:4317
npm run test:widgets # runs both scripts against live data in a mocked Scriptable runtime
npm run lint
npm run build        # static export to ./out
```

## Deploy to GitHub Pages

The site is a static export. `.github/workflows/pages.yml` builds it with `PAGES_BASE_PATH=/<repo-name>` and publishes `out/`. To use it, push this repo to GitHub and set **Settings → Pages → Source** to "GitHub Actions".
