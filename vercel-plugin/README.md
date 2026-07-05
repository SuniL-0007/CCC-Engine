# Vercel Plugin for Claude Code

Run Vercel operations straight from the chat: deployments, status, build/runtime
logs, and environment variables. Backed by a zero-dependency Node script that
calls the Vercel REST API (and the Vercel CLI for deploys/runtime logs).

## Commands

| Command | What it does |
|---|---|
| `/vercel:status [n]` | Last *n* deployments — state, prod/preview, URL, commit, age. Auto-diagnoses errored deployments. |
| `/vercel:deploy [--prod]` | Local build check, then deploy via Vercel CLI. Preview by default. |
| `/vercel:logs [id] [--runtime]` | Build logs for the latest (or given) deployment; `--runtime` streams function logs. |
| `/vercel:env [ls\|get\|add\|rm]` | List/read/upsert/delete env vars, with redeploy reminders. |

## Setup (one-time)

1. **Token** — create one at <https://vercel.com/account/tokens>, then add to the
   project's `.env.local` (gitignored — never committed):

   ```
   VERCEL_TOKEN=your_token_here
   ```

2. **Project resolution** — the script finds your Vercel project automatically:
   `.vercel/project.json` (created by `npx vercel link`) → `VERCEL_PROJECT_ID` /
   `VERCEL_PROJECT_NAME` in `.env.local` → search by `package.json` name / folder
   name. If lookup picks the wrong project, set `VERCEL_PROJECT_NAME` explicitly.

3. **Verify**:

   ```
   node vercel-plugin/scripts/vercel.mjs whoami
   ```

## Installing the plugin

This repo doubles as a local plugin marketplace (see `.claude-plugin/marketplace.json`).
In Claude Code:

```
/plugin marketplace add d:\Summer Projects\CCCEngine
/plugin install vercel@fabriccash
```

(For other machines, use the GitHub URL instead of the local path.)

## Script usage outside the plugin

Everything works standalone too:

```
node vercel-plugin/scripts/vercel.mjs status 10
node vercel-plugin/scripts/vercel.mjs logs --runtime
node vercel-plugin/scripts/vercel.mjs env add GEMINI_MODEL gemini-2.5-flash production
node vercel-plugin/scripts/vercel.mjs deploy --prod
```

## Security notes

- The token is read from the environment or `.env.local`; it is passed to the
  Vercel CLI via `--token` and never printed.
- `env get` can print secret values — the `/vercel:env` command instructs the
  agent not to echo them into the conversation unless you explicitly ask.
