# Deployment

## Vercel frontend

Environment variables:

- `VITE_API_BASE_URL=https://YOUR-RAILWAY-BACKEND`

Do not put backend secrets in Vercel:

- `DATABASE_URL`
- `JWT_SECRET`
- `OCR_PROVIDER`
- `PADDLE_OCR_URL`
- `AWS_*`
- `GOOGLE_*`

Commands:

- Build: `npm run build`

The frontend is a Vite SPA and must serve `dist/index.html` with the root `vercel.json` rewrite in place.

## Railway backend

Environment variables:

- `DATABASE_URL`
- `JWT_SECRET`
- `CLIENT_ORIGIN=https://YOUR-VERCEL-FRONTEND`
- `APP_BASE_URL=https://YOUR-VERCEL-FRONTEND`
- `PUBLIC_APP_URL=https://YOUR-VERCEL-FRONTEND`
- `OCR_PROVIDER=manual`
- `NODE_ENV=production`

Commands:

- Build: `npm run build`
- Start: `npm run start:prod`

`start:prod` runs Prisma migrations first:

```bash
npx prisma migrate deploy && node dist/server/index.js
```

## Seed admin

Run once or whenever you need to create the admin user:

```bash
npx tsx scripts/seed-admin.ts
```

The seed script is idempotent.

## Checklist

- `vercel.json` exists in the repository root.
- `dist/index.html` is created after build.
- Direct routes like `/login`, `/dashboard`, `/reports/release`, `/parent/r/:token`, and `/verify/:code` load through Vercel.
- Parent report links point at the Vercel frontend URL, not `localhost`.
- Frontend never receives `DATABASE_URL`.
- Railway serves the API and PostgreSQL database only.
