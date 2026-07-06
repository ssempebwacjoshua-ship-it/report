# Tech Stack

## Current Report Lab stack

- Frontend: React 19 + Vite
- Language: TypeScript
- Backend: Node.js + Express 5
- ORM: Prisma 6
- Database: PostgreSQL
- Validation: Zod
- Tests: Vitest, React Testing Library, Supertest, jsdom
- Styling: Tailwind CSS v4 plus a global CSS layer in `src/index.css`
- Icons: `@fluentui/react-icons` and `lucide-react`
- File handling: multer, sharp, xlsx, csv-parse
- Auth: JWT via `jsonwebtoken` + password hashing via `bcryptjs`

## Current commands

- `npm run dev` - runs API and Vite together
- `npm run dev:web` - Vite only
- `npm run dev:api` - Express API only
- `npm run build` - builds client and server
- `npm run build:client` - Vite production build
- `npm run build:server` - esbuild server bundle targeting Node 20
- `npm run start` - runs the built server
- `npm run start:prod` - runs Prisma migrate deploy, then starts the server
- `npm run test` - Vitest
- `npm run test:critical` - critical smoke suite
- `npm run typecheck` - TypeScript build check
- `npm run lint` - ESLint
- `npm run verify:report-lab` - report-lab smoke path plus build

## Default SSAMENJ stack

- Use React, Vite, TypeScript, Node/Express, Prisma, PostgreSQL, and Vitest by default.
- Use React Testing Library for UI behavior.
- Use PWA features only when the module needs mobile install or offline behavior.
- Keep shared business logic in `src/shared`.
- Keep business services in `src/server/services`.
- Keep HTTP routing in `src/server/routes`.
- Keep auth, tenant resolution, and permission checks in middleware.

## Code organization rules

- Do not hardcode tenant IDs.
- Do not put secrets in source code.
- Do not let the frontend bypass the API for database access.
- Keep route handlers thin.
- Put business logic in services and repositories.
- Keep reusable types in `src/shared/types`.
- Keep reusable validation and utility helpers in `src/shared/utils`.

## TypeScript rules

- Use strict, explicit types at boundaries.
- Keep route payloads and API responses typed.
- Prefer `zod` for runtime validation where the request can fail.
- Use `node20` as the server runtime target unless a project specifically needs something else.

