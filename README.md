# Word MVP Cloudflare Monorepo

## Apps
- `apps/api`: Cloudflare Workers API (Hono + D1 + Drizzle)
- `apps/web`: React web app for Cloudflare Pages

## Quick Start
1. `npm install`
2. `npm run dev:api`
3. `npm run dev:web`

## Auto Deploy
- Web app deploys via Cloudflare Pages native GitHub integration.
- API deploys to Cloudflare Workers on every push to `main` that touches `apps/api`.

### Required GitHub Secrets
- `CLOUDFLARE_API_TOKEN`: Cloudflare API token with Workers deploy permission.
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account id.

## Cloudflare Pages Native GitHub Setup
1. Cloudflare Dashboard -> Workers & Pages -> Create -> Pages -> Connect to Git.
2. Choose repository: `yedu-AI/word-mvp-cf`.
3. Build settings:
   - Framework preset: `Vite`
   - Build command: `npm run build -w @word-mvp/web`
   - Build output directory: `apps/web/dist`
   - Root directory: `/`
4. Environment variable:
   - `VITE_API_BASE`: your Worker API URL

## Reusable Assets
- Human guide: `docs/HUMAN_PLAYBOOK.md`
- Quick checklist: `docs/HUMAN_CHECKLIST.md`
- Business flow (beginner): `docs/BUSINESS_FLOW_FOR_BEGINNER.md`
- AI ops assets: `ai-ops-kit/README.md`
