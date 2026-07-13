# School Connect Reports Lab

Focused reports-generation rebuild for School Connect ideas. This repo is intentionally reports-only: academic report generation, marks import, verification, report cards, previews, and print-friendly output.

The old School Connect repo is a behavioral reference only. Do not copy its source, schema, environment, or production database into this lab.

## Production Readiness / Pre-Onboarding Gate

Before onboarding any real school, read and follow:
[SCHOOL_CONNECT_REPORT_LAB_PINNED_PRE_ONBOARDING_MASTER.md](./SCHOOL_CONNECT_REPORT_LAB_PINNED_PRE_ONBOARDING_MASTER.md)

Current production verdict: not ready for real school onboarding until all blocker phases are complete.

## Stack

- React, TypeScript, Vite
- Tailwind CSS through `@tailwindcss/vite`
- React Router
- Node.js, TypeScript, Express
- Zod request validation
- PostgreSQL only
- Prisma ORM
- `csv-parse` for CSV import parsing
- Vitest, React Testing Library, Supertest
- npm

## PostgreSQL Setup

Create a local development database named:

```bash
createdb school_connect_reports_lab
```

If your local PostgreSQL user/password differs, edit `.env` after copying from `.env.example`.

Required environment:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/school_connect_reports_lab?schema=public"
PORT=4300
VITE_API_BASE_URL="http://localhost:4300"
APP_PUBLIC_URL="http://localhost:5173"
```

This lab must use its own local database. Do not point `DATABASE_URL` at the old School Connect database or any production database.

Authentication emails use Resend when configured:

```env
RESEND_API_KEY=""
AUTH_EMAIL_FROM="SSAMENJ Report Lab <support@ssamenj.online>"
AUTH_EMAIL_REPLY_TO=""
APP_PUBLIC_URL="http://localhost:5173"
PUBLIC_SITE_URL="https://ssamenj.online"
PUBLIC_COMPANY_LOGO_URL="https://ssamenj.online/ssamenj-logo.png"
```

Production senders must use a verified Resend domain. Do not use a Gmail address as the production sender.

## Commands

Install dependencies:

```bash
npm install
```

Generate Prisma Client:

```bash
npm run db:generate
```

Run migrations:

```bash
npm run db:migrate
```

Seed preview school/classes/students/subjects:

```bash
npm run seed:preview
```

Seed deterministic S1 BOT/EOT marks:

```bash
npm run seed:s1-marks:test
```

Verify the S1 report dataset:

```bash
npm run verify:s1-marks:test
```

Run API and web app:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Build:

```bash
npm run build
```

## Browser Routes

- `/reports`
- `/imports/marks`

## Architecture

- React components call `src/client/*` API clients.
- API routes live in `src/server/routes`.
- Prisma is isolated to repositories, scripts, and the database client.
- Report calculations live in pure TypeScript services under `src/server/services`.
- CSV parsing lives in `src/server/adapters/csvMarksParser.ts`.
- Import parsing, validation, and database commit are separate steps.

## Seeded Preview Data

- School: `SCU-PREVIEW`
- Academic year: `2025/2026`
- Active term: `Term 1`
- Classes: `Senior 1 A`, `Senior 1 B`
- Streams: `A`, `B`
- Subjects: 15 O-Level subjects including English Language, Mathematics, sciences, humanities, Kiswahili, ICT, PE, and Fine Art
- Marks: deterministic finalized BOT and EOT marks for every seeded S1 student and subject

## Intentionally Excluded

- Finance
- Wallet
- Communication
- Attendance, except possible report-summary placeholders later
- Gate/security
- Parent portal
- Payments
- School onboarding
- Full admin/RBAC system
