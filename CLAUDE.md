# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start Vite dev server
npm run build    # production build
npm run lint     # ESLint check
npm run preview  # preview production build locally
```

No test suite exists in this project.

## Architecture overview

MyTrack is a time-tracking SPA for XUL (a Spanish agency), built with React 19 + Vite + Tailwind CSS and backed by Supabase (PostgreSQL). It is deployed to Vercel.

### Two workspaces

All data is scoped to one of two workspaces:
- `xul-ws-1` — XUL agency (`@xul.es` emails)
- `fundacion-ws-1` — Fundación XUL (`@fundacionxul.org` emails)

`getWsId()` in `src/lib/db.js` resolves the active workspace from localStorage. Admins can switch workspaces; the override is stored under `mytrack-active-workspace`. Email domain determines workspace: `@fundacionxul.org` → `fundacion-ws-1`, everything else → `xul-ws-1`.

### Authentication

`DEMO_MODE = true` in `AuthContext.jsx` means **Supabase Auth is never used**. Login checks the `password` column in `workspace_members` directly. The session is stored in localStorage under `mytrack-demo-user`. There is a hardcoded `FALLBACK_USERS` array used only when Supabase is unreachable (network/timeout).

### Role system

Roles (`admin`, `manager`, `employee`) come from the `role` column in `workspace_members`. `isAdmin` is determined by `ADMIN_EMAILS` (a hardcoded list in `RoleContext.jsx`), not just the DB role. `isManager = isAdmin || role === 'manager'`. `costProjects` on `RoleContext` is a comma-separated list from `workspace_members.cost_projects` that restricts which cost-view projects an employee can see.

### Context provider tree

Providers wrap in this order (see `App.jsx`):
```
ThemeProvider → TimerProvider → AuthProvider → [ProtectedRoute] → WorkspaceProvider → RoleProvider
```
`WorkspaceProvider` and `RoleProvider` are only mounted after auth succeeds.

- **ThemeContext** — dark/light via `data-theme` on `<html>`; persisted to localStorage
- **TimerContext** — global running timer; persisted to localStorage (`mytrack-timer-state`)
- **AuthContext** — session, signIn/signOut, workspace switching
- **WorkspaceContext** — projects, clients, tasks, members for the active workspace
- **RoleContext** — role, notifications, `costProjects`, `markRead`/`markAllRead`

### Data layer (`src/lib/db.js`)

All DB operations go through `supabaseClient` (a `@supabase/supabase-js` client). The `sql()` helper calls the `exec_sql` RPC for queries that need SQL aggregates (EXTRACT, GROUP BY, etc.) — used mainly in `Costs.jsx` and a few report pages. Native Supabase client methods are used everywhere else.

`initDB()` is a no-op (was a Neon bootstrap script; schema is now managed via Supabase migrations). It is called at many sites; do not remove those calls.

**Clockify mirroring**: entries with a `client_name` containing "fundaci" are inserted twice — once in the owning workspace, once with an `__f` suffix ID in `fundacion-ws-1`. The `deleted_entries` table tracks deleted IDs so bulk re-imports don't resurrect them.

**Pagination**: `dbGetEntries` and `dbGetEntriesForPeriod` paginate 1000 rows at a time. Supabase's default 1000-row limit would silently truncate large result sets without this.

### Clockify integration (`src/lib/clockify.js`)

Syncs time entries from the Clockify API into Supabase. The `isClockifyUser()` helper accepts an email string (legacy) or a user object with `clockify_user_id`. Only users with a `clockify_user_id` in `workspace_members` have their entries synced.

### Vercel serverless functions (`/api`)

- `sync-clockify.js` — manual trigger; fetches last 7 days from Clockify and upserts to Supabase
- `weekly-notifications.js` — cron: Mon 06:00 UTC
- `auto-imputacion.js` — cron: Mon–Fri 20:00 UTC
- `ical-vacations.js` — manual trigger; imports Google Calendar vacation events
- `team-costs.js` — manual trigger

### Theming

All colors use CSS custom properties (`--c-bg-app`, `--c-text-1`, etc.) defined in `src/index.css`. Dark mode flips these via `[data-theme="dark"]`. Never use hardcoded color values in new UI — always use the `--c-*` variables.

### Environment variables

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```
