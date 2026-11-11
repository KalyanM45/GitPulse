# GitPulse Documentation

How GitPulse is designed and how it works, for anyone curious about the system
behind it.

## Start here

| Document | Read it for |
|---|---|
| [High-Level Design](hld.md) | The problem, requirements, components, deployment and key design decisions |
| [Low-Level Design](lld.md) | Code structure, the full API reference, database schemas and core algorithms |
| [Workflows](workflows.md) | Every journey step by step: demo, requesting access, onboarding, syncing |

## System design deep-dives

| Subsystem | Covers |
|---|---|
| [Authentication](system-design/authentication.md) | Firebase sign-in, token verification, the browser's session state |
| [Multi-tenancy & GitHub connections](system-design/multi-tenancy.md) | Keeping users' data apart; connecting GitHub; encrypted tokens |
| [Sync engine](system-design/sync-engine.md) | How GitHub's current-state APIs become a growing history |
| [Invite-only access](system-design/access-control.md) | Requests, invites, the admin page, request emails |
| [Live demo](system-design/demo.md) | A read-only real dashboard, with private data filtered out |
| [Security](system-design/security.md) | Threats and the control for each |

## Suggested reading order

1. **[HLD](hld.md)** for the shape of the system.
2. **[Workflows](workflows.md)** to see it in motion.
3. **[LLD](lld.md)** and the deep-dives for the parts you care about.

Diagrams are written in [Mermaid](https://mermaid.js.org/) and render directly on GitHub.
