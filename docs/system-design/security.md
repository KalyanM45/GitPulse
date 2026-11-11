# System Design: Security

A summary of the threats GitPulse is designed against and the control for each.
Details live in the linked design docs.

## Assets

| Asset | Why it matters |
|---|---|
| Users' GitHub tokens | With the `repo` scope they can read private code |
| Users' GitHub data | Private repository names and traffic |
| Account access | Who may use the app (invite-only) |
| Personal data | Email addresses, access-request notes |

## Threats and controls

| Threat | Control |
|---|---|
| Forged or tampered login token | Firebase ID tokens verified against Google's keys; algorithm pinned to RS256; audience, issuer, expiry and `auth_time` checked ([authentication](authentication.md)) |
| Unverified email used to impersonate someone | Every protected route requires `email_verified` |
| One user reading another's data | All per-user queries go through the scoped collection wrapper; it fails closed with no user in scope ([multi-tenancy](multi-tenancy.md)) |
| Database leak exposing GitHub access | Tokens encrypted with Fernet (AES + HMAC) using a key kept outside the database |
| Uninvited user reaching the dashboard | Invite check on every request; removal is immediate ([access control](access-control.md)) |
| Discovering who is a member | The request form and Firebase's sign-in/reset flows answer identically either way |
| Spam through the request form | Per-IP rate limit, one request per email, input length limits |
| Demo exposing private data or being modified | GET-only guard; private repositories filtered at the query layer ([demo](demo.md)) |
| Taking over someone's GitHub link | One GitPulse account per GitHub account (unique index); the token is verified with GitHub before saving |
| Search input used as a regex attack | User input is escaped before it's used in a database regex |
| Leaking internals in errors | API errors return a code and a safe message; details go to server logs |
| Secrets in the repository | Secrets only in environment variables or a secret manager; `.env` files and Terraform state are gitignored; the frontend only receives public `NEXT_PUBLIC_*` identifiers |
| Cross-site requests | CORS limited to the app's own origins in production; auth is a bearer token, not a cookie |

## Least privilege

- **GitHub scopes:** `repo` (required by GitHub for traffic data) and `read:user`.
  GitPulse only reads; it never writes to GitHub.
- **Cloud (Terraform setup):** the runtime service account can read only its two
  secrets; the scheduler's account can only start the sync job.
- **Firebase:** no service-account key is used at all.

## Known limitations

- Approved users aren't notified automatically; the owner tells them.
- A user's token stays valid until they disconnect, or revoke GitPulse in their
  GitHub settings.
- The free hosting tier sleeps when idle, so the first request can be slow (an
  availability limit, not a security one).
