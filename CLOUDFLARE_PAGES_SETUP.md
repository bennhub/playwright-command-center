# Cloudflare Pages Setup

This repo is prepared for a Cloudflare Pages frontend deployment of the Playwright Command Center UI.

## What Pages Can Host
Cloudflare Pages can host the static frontend from:

`scripts/test-launcher/`

That frontend now supports a configurable backend base via:

`scripts/test-launcher/config.js`

## What Pages Cannot Run
The current backend in:

`scripts/test-launcher/server.mjs`

uses Node `child_process` to launch Playwright runs. That is not compatible with Cloudflare Pages.

## Recommended Deployment Model

1. Deploy the frontend to Cloudflare Pages
2. Deploy the backend somewhere Node-friendly
3. Set `API_BASE` in `scripts/test-launcher/config.js` to that backend URL

Example:

```js
window.__PWCC_CONFIG__ = {
  API_BASE: "https://your-command-center-api.example.com"
};
```

## Pages Settings

- Framework preset: `None`
- Build command: leave blank
- Build output directory: `scripts/test-launcher`

## Full Cloudflare-Only Future State

If you want both frontend and backend on Cloudflare, the backend needs a rewrite to Workers / Browser Rendering.

## Easier Alternative

For the current codebase, the simplest production path is:

- host the full app on Railway
- keep Cloudflare Pages for your portfolio
- embed the Railway URL inside the portfolio automation window
