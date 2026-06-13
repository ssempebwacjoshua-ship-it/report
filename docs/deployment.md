# Deployment

## How the build works

`npm run build` runs two steps in sequence:

1. **`build:client`** — Vite builds the React SPA → `dist/index.html` + `dist/assets/`
2. **`build:server`** — esbuild bundles `src/server/index.ts` (all local TS, npm packages kept external) → `dist/server/index.js`

The server bundle is ~211 KB. npm packages are NOT bundled — they must be installed in production (`npm install` without `--omit=dev`, or ensure devDependencies are available for the esbuild step).

## Vercel (frontend)

**Build command:** `npm run build:client`  
(or `npm run build` if you want the server bundle too, which Vercel ignores)

**Output directory:** `dist`

**Environment variables:**

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://YOUR-RAILWAY-APP.railway.app` |

Do NOT put these in Vercel:

- `DATABASE_URL`, `JWT_SECRET`, `OCR_PROVIDER`, `OCR_ENABLED`, `AZURE_OCR_FUNCTION_URL`

The SPA requires `vercel.json` with a catch-all rewrite so all routes serve `dist/index.html`.

## Railway (backend)

**Build command:** `npm run build` or `npm run build:server`

**Start command:** `npm run start:prod`

`start:prod` is:
```bash
npx prisma migrate deploy && node dist/server/index.js
```

**Environment variables:**

| Variable | Value |
|---|---|
| `DATABASE_URL` | Provided by Railway PostgreSQL addon |
| `JWT_SECRET` | A long random string |
| `CLIENT_ORIGIN` | `https://YOUR-VERCEL-APP.vercel.app` |
| `NODE_ENV` | `production` |
| `OCR_ENABLED` | `true` |
| `OCR_PROVIDER` | `azure` |
| `AZURE_OCR_FUNCTION_URL` | Private Azure Function URL stored only in Railway |
| `PORT` | Set automatically by Railway — do not override |

`CLIENT_ORIGIN` controls CORS. Parent report links use `CLIENT_ORIGIN` as the base URL.

The server binds to `0.0.0.0` and the port from `process.env.PORT`, which Railway injects automatically.

The health endpoint is `GET /health` (no `/api` prefix). Returns `{"ok":true}`.

## Seed admin

Run once after deploying the Railway service to create the first admin user:

```bash
npx tsx scripts/seed-admin.ts
```

The script is idempotent.

## Migration strategy

- **Production (Railway):** `npx prisma migrate deploy` — applies pending migrations from `prisma/migrations/`
- **Development:** `prisma db push` — push schema changes directly, no migration history required (avoids drift issues in dev)

## Checklist

- `vercel.json` exists in the repository root with the SPA catch-all rewrite.
- `dist/index.html` is created after `build:client`.
- `dist/server/index.js` is created after `build:server`.
- Direct routes (`/login`, `/dashboard`, `/reports/release`, `/parent/r/:token`, `/verify/:code`) load through Vercel.
- Parent report links point at the Vercel frontend URL, never `localhost`.
- Frontend never receives `DATABASE_URL`.
- Railway serves the API and PostgreSQL only.
