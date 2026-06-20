# AISEOS — signup frontend

A single static page (no build step) for the hosted AISEOS gateway. Visitors enter an email, receive a token + personal MCP URL, and get a copy-paste MCP client config.

## Configure

Set the gateway origin the page calls. Either edit `API_BASE` in `index.html`, or inject it at runtime before the main script:

```html
<script>window.SEOS_API_BASE = "https://api.your-vps.example";</script>
```

It must match the `@seos/cloud` gateway's public URL, and that gateway must allow this site's origin via `SEOS_FRONTEND_ORIGIN` (CORS).

## Deploy to Vercel

```bash
cd apps/web
vercel deploy --prod
```

Vercel serves `index.html` statically — no framework, no build. (Locally: `npx serve apps/web` or open `index.html`.)

## What it does

`POST {API_BASE}/api/signup { email }` → renders the returned `token` + `mcpUrl` and a ready-to-paste config:

```json
{ "mcpServers": { "aiseos": { "url": "<mcpUrl>", "headers": { "Authorization": "Bearer <token>" } } } }
```

No data is stored client-side; the token is shown once.
