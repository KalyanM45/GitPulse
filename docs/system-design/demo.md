# System Design: Live Demo

## Goal

Show visitors a **real** GitPulse dashboard (the owner's) before they request
access: always current, never editable, and without exposing anything private.

## Approach: reuse, don't duplicate

The demo is the real dashboard, mounted a second time:

| Layer | Real dashboard | Demo |
|---|---|---|
| Pages | `/dashboard`, `/audience`, `/repositories` | `/demo/dashboard`, … (the same components, re-exported) |
| API | `/api/*` | `/demo/api/*` (the same routers, included again with a different guard) |
| Guard | `require_tenant`: invited, own data | `require_demo_tenant`: anyone (no sign-in), GET only, demo account's data |
| Query cache | Persisted per browser | Separate and in memory only, so demo data never mixes with the visitor's own |

The API client chooses `/api` or `/demo/api` from the current URL, so pages and
hooks need no demo-specific code.

## Guard rules (`backend/app/demo.py`)

1. **Public:** no sign-in or invite needed.
2. **Read-only:** any method other than GET → `403 demo_read_only`. This blocks
   sync endpoints and any future write route automatically.
3. **Fixed tenant:** the data always belongs to `DEMO_GITHUB_LOGIN`, never the visitor.
4. **Private repositories hidden** (`DEMO_HIDE_PRIVATE_REPOS`, on by default).

## Hiding private repositories at the data layer

Hiding them in the UI wouldn't be enough: the API would still send them. Instead,
the demo tenant carries the set of **public** repository names, and the scoped
collection wrapper adds a visibility filter to every query:

| Collection | Extra filter in the demo |
|---|---|
| `repo_snapshots` | `is_private = false` |
| `traffic_daily`, `star_snapshots` | `repo ∈ public repositories` |

So private repositories are missing from lists, totals, aggregations, top-10s and
direct lookups (`/demo/api/repos/<private>` → 404). The banner says how many are
hidden.

The demo account is resolved once a minute (cached), not on every request.

## User experience

- **View demo** on the landing page opens the demo directly; no sign-in.
- A banner names whose dashboard it is and offers the next step: **Request access
  for your account** (not invited) or **Open my dashboard** (invited).
- No Sync button, and no admin link. Visitors who aren't signed in see **Sign in** in
  place of Sign out.

## Verification

`backend/tests/test_demo.py`: only the demo account's public repositories are
visible, private ones are unreachable by name, writes are refused, no sign-in is
needed, and the real API still refuses uninvited visitors.
