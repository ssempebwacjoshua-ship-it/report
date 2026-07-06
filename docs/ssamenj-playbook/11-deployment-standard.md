# Deployment Standard

## Current Report Lab deployment shape

- Frontend build target: Vercel
- Backend runtime: Railway
- Database: PostgreSQL
- Production server start: `npm run start:prod`
- Client build output: `dist`
- SPA fallback: `/index.html`

## Current config facts

- `vercel.json` builds with `npm run build:client`.
- `vercel.json` rewrites all routes to `/index.html`.
- `railway.json` starts the server with `npm run start:prod`.
- `src/server/index.ts` runs `prisma migrate deploy` before server startup in production.
- `src/server/index.ts` validates environment variables at boot.

## Required env var rules

- Keep production secrets server-side only.
- Do not expose backend secrets to the Vercel frontend.
- Keep `.env.example` up to date with every required production variable.
- Include the actual production secret names, but not their values.

## Example env vars seen in this repo

- `DATABASE_URL`
- `PORT`
- `VITE_API_BASE_URL`
- `CLIENT_ORIGIN`
- `APP_BASE_URL`
- `JWT_SECRET`
- `OCR_ENABLED`
- `OCR_PROVIDER`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `SMART_PAGES_GEMINI_FAST_MODEL`
- `SMART_PAGES_GEMINI_HIGH_ACCURACY_MODEL`
- `SMART_PAGES_GEMINI_STABLE_ACCURACY_MODEL`
- `INTERNAL_TEST_KEY`
- `PLATFORM_ADMIN_KEY`
- `SSAMENJ_PLATFORM_INTEGRATION_ENABLED`
- `SSAMENJ_PLATFORM_URL`
- `SSAMENJ_PLATFORM_SERVICE_TOKEN`

## Production checklist

- Build passes.
- Migrations are deployed.
- Required env vars exist.
- Health endpoint responds.
- Public URL matches the deployed origin.
- SPA routes resolve correctly.
- Upload storage is configured.
- Auth and tenant boundaries are verified.
- Rollback path is documented.

## Rollback notes

- Keep the previous deploy available until the new one is stable.
- Keep migration rollbacks and data-fix procedures documented when schema changes are not reversible.
- If a deployment changes auth, uploads, or tenant logic, verify the smoke flows before promoting it.

