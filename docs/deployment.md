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
- `GEMINI_API_KEY`, `PLATFORM_ADMIN_KEY`, `INTERNAL_TEST_KEY`

The SPA requires `vercel.json` with a catch-all rewrite so all routes serve `dist/index.html`.

## Railway (backend)

**Build command:** `npm run build` or `npm run build:server`

**Start command:** `npm run start:prod`

`railway.json` pins this start command for Railway so production does not accidentally run plain `npm start` and skip migrations.

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
| `APP_BASE_URL` | Branded parent report URL, for example `https://reports.schoolconnect.example` |
| `APP_PUBLIC_URL` | `https://ssamenj.online/report-lab` |
| `PUBLIC_APP_URL` | Alias for `APP_PUBLIC_URL` if you prefer the public-facing name |
| `APP_URL` | Alias for `APP_PUBLIC_URL` used by auth link helpers |
| `AUTH_EMAIL_PROVIDER` | `RESEND` |
| `RESEND_API_KEY` | Server-only Resend API key for authentication emails |
| `AUTH_EMAIL_FROM` | `SSAMENJ Team <no-reply@notify.ssamenj.online>` |
| `EMAIL_FROM` | Alias for `AUTH_EMAIL_FROM` |
| `RESEND_FROM_EMAIL` | Alias for `AUTH_EMAIL_FROM` |
| `AUTH_EMAIL_REPLY_TO` | `support@ssamenj.online` |
| `NODE_ENV` | `production` |
| `OCR_ENABLED` | `true` |
| `OCR_PROVIDER` | `azure` |
| `AZURE_OCR_FUNCTION_URL` | Private Azure Function URL stored only in Railway |
| `WHATSAPP_PROVIDER_ENABLED` | `false` until Meta Cloud WhatsApp sending is approved |
| `WHATSAPP_META_VERIFY_TOKEN` | Server-only Meta webhook verify token |
| `WHATSAPP_META_APP_SECRET` | Server-only Meta app secret used for webhook signatures |
| `WHATSAPP_META_ACCESS_TOKEN` | Server-only Meta Cloud API token |
| `WHATSAPP_META_PHONE_NUMBER_ID` | Meta WhatsApp phone number ID used for outbound sends |
| `SMS_PROVIDER` | `mock` or `twilio` |
| `SMS_PROVIDER_ENABLED` | `false` until SMS sending is approved |
| `SMS_API_KEY` | Server-only SMS provider key or Twilio Account SID |
| `SMS_AUTH_TOKEN` | Server-only SMS provider token |
| `SMS_SENDER_ID` | Approved SMS sender ID or Twilio number |
| `PORT` | Set automatically by Railway — do not override |

`CLIENT_ORIGIN` controls CORS. Parent report links use `APP_BASE_URL` when set, then fall back to `PUBLIC_APP_URL` or `CLIENT_ORIGIN`. Replace any Vercel preview URL with the production branded report domain before releasing reports to parents.

Account setup and password reset links use `APP_PUBLIC_URL` first, then `PUBLIC_APP_URL`, then `APP_URL`, then `APP_BASE_URL`. In production it must be HTTPS. Do not send production auth emails until `AUTH_EMAIL_PROVIDER=RESEND`, the sender domain is verified in Resend, and the sender address plus public app URL are configured.

The server binds to `0.0.0.0` and the port from `process.env.PORT`, which Railway injects automatically.

The health endpoint is `GET /health` (no `/api` prefix). It returns a minimal payload such as `{"ok":true,"service":"school-connect-reports-lab"}`.

Internal env-status diagnostics are exposed at `GET /api/health/env` and require the `x-internal-test-key` header. The route reports only `SET` / `MISSING` status, never actual secret values.

Communication sending is disabled by default. Do not set `WHATSAPP_PROVIDER_ENABLED=true` or `SMS_PROVIDER_ENABLED=true` until the provider credentials, approved sender/phone number, school permissions, and operator confirmation workflow have been reviewed. These variables belong only on Railway/backend, never Vercel/frontend.

## Seed admin

Run once after deploying the Railway service to create the first admin user:

```bash
npx tsx scripts/seed-admin.ts
```

The script is idempotent.

## Migration strategy

- **Production (Railway):** `npx prisma migrate deploy` — applies pending migrations from `prisma/migrations/`
- **Development:** use reviewed local migrations for schema work. Never run `prisma db push` against production.

## Checklist

- `vercel.json` exists in the repository root with the SPA catch-all rewrite.
- `dist/index.html` is created after `build:client`.
- `dist/server/index.js` is created after `build:server`.
- Direct routes (`/login`, `/dashboard`, `/reports/release`, `/parent/r/:token`, `/verify/:code`) load through Vercel.
- Parent report links point at the branded production report domain, never `localhost` or a Vercel preview URL.
- Frontend never receives `DATABASE_URL`.
- Frontend never receives `JWT_SECRET`, `GEMINI_API_KEY`, `PLATFORM_ADMIN_KEY`, or `INTERNAL_TEST_KEY`.
- Railway serves the API and PostgreSQL only.
