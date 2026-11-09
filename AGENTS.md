# AGENTS.md

## MenuPro conventions

- Use pnpm exclusively for dependencies, scripts, and package execution. Never use npm, npx, yarn, or Bun.
- This directory is the single Next.js application: landing, panel, and BFF.
- Every application table, view, function, index, and policy must use the `menupro_` prefix. Do not change objects in the former DieGui Dev backend.
- Use user-scoped Neon queries and RLS. Keep all credentials in ignored local configuration.
- Keep SQL migrations under `migrations/` and apply them with `pnpm db:migrate`.
- Read version-matched Next.js documentation under `node_modules/next/dist/docs/` before changing framework behavior.

## Neon backend

- Project: bitter-heart-68907011, organization org-snowy-haze-69666506. The app uses the production branch.
- PostgreSQL, managed Neon Auth and private fiscal PDFs use Neon. InsForge is no longer a runtime dependency.
- Credentials live only in ignored local configuration or hosting secrets. Never print connection strings, cookies or keys.
- Use the pooled DATABASE_URL for the BFF and DATABASE_URL_UNPOOLED for migrations.
- The BFF validates Neon Auth sessions, maps identities to menupro_users and runs every application query in a transaction with SET LOCAL ROLE and a local user ID. Never run application CRUD as the table owner or trust a user ID from a request.
- Keep row permissions and SQL grants. Runtime roles are menupro_anon and menupro_authenticated, with no BYPASSRLS.
- Historical InsForge migrations are kept intact; scripts/neon-migrations.mjs maps their platform references. Add future SQL under migrations/neon/, then run pnpm db:migrate.
- Test schema and permissions on an isolated Neon branch before production. The auth/browser suite refuses any branch other than menupro-migration-validation.
- Never restore a full InsForge platform dump into this app's database. Only explicitly requested MenuPro data belongs here.
<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
