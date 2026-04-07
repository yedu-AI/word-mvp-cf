# Word MVP Cloudflare Monorepo

## Apps
- `apps/api`: Cloudflare Workers API (Hono + D1 + Drizzle)
- `apps/web`: React web app for Cloudflare Pages

## Quick Start
1. `npm install`
2. `npm run dev:api`
3. `npm run dev:web`

## Auto Deploy
- Web app deploys to GitHub Pages on every push to `main` that touches `apps/web`.
- API deploys to Cloudflare Workers on every push to `main` that touches `apps/api`.

### Required GitHub Secrets
- `CLOUDFLARE_API_TOKEN`: Cloudflare API token with Workers deploy permission.
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account id.
