# Talaria UI

Talaria's own front end (Phase 2) — one product, two faces over the two-plane
fleet brain. **Vite + TanStack Start** (React 19 + TypeScript), the same stack as
hermes-workspace, so its chat/agent components lift with minimal friction.

- **Design system: Mercury.** A hand-rolled Tailwind v4 token system in the same
  cyberpunk-HUD family as hermes-workspace (so lifts drop in), but Talaria's own
  identity: Mercury-the-planet neutrals (graphite / basalt / regolith) with a
  violet→magenta neon accent. Two modes — `mercury` (dark) and `mercury-light`.
  Tokens live in [`src/styles.css`](./src/styles.css); the `--theme-*` variable
  names match hermes-workspace's contract on purpose.
- **Auth: pluggable + independently toggleable.** Each provider is enabled only
  when its flag is on and its secrets are present. Google OAuth and
  username/password ship first; the registry ([`src/server/auth/config.ts`](./src/server/auth/config.ts))
  makes adding GitHub/Microsoft/etc. a small change.

## Run it

```bash
cp .env.example .env      # set AUTH_SECRET + enable a provider (Google first)
npm install
npm run dev               # http://localhost:5273
```

For Google: create OAuth credentials, set the authorized redirect URI to
`<origin>/api/auth/google/callback`, and put the client id/secret in `.env`.

## Auth surface

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/providers` | GET | Which providers are enabled (drives the login screen) |
| `/api/auth/session` | GET | The current user (or `null`) |
| `/api/auth/google` | GET | Start Google OAuth (302 → consent) |
| `/api/auth/google/callback` | GET | OAuth callback → session cookie → `/` |
| `/api/auth/password` | POST | Username/password login |
| `/api/auth/logout` | POST | Clear the session |

Sessions are stateless HMAC-signed cookies (`src/server/auth/session.ts`); rotate
`AUTH_SECRET` to invalidate everything.

## Where this is headed (Phase 2 milestones)

- **P2.1 — Simple view MVP:** agent picker + streaming chat over the gateway
  plane (`/v1/models`, model-routed chat). Lands in the cockpit shell.
- **P2.2 — Advanced view:** fleet dashboard + task board over mission-control REST.
- **P2.3 / P2.4:** missions, sessions, activity, then identity + one deployable image.

## TODO / backlog

- **More auth providers:** GitHub, Microsoft/Entra, generic OIDC — each drops into
  the provider registry.
- **Hash password credentials** (bcrypt/argon2) instead of plaintext `AUTH_USERS`.
- **Local-inference monitoring:** surface self-hosted inference stacks
  (Ollama, vLLM, llama.cpp, LM Studio, TGI, …) — health, loaded models, GPU/VRAM,
  tokens/sec — so Talaria becomes an all-in-one self-hosted Hermes super-dashboard.
- **BFF decision:** whether the UI hits the gateway plane + MC REST directly or via
  a thin backend-for-frontend (these auth server routes are the seed of that BFF).
