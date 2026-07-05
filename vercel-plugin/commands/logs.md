---
description: Fetch Vercel build logs (default) or runtime logs for a deployment
argument-hint: "[deployment-url-or-id] [--runtime]"
allowed-tools: ["Bash"]
---

Fetch Vercel logs. Arguments given: `$ARGUMENTS`

Run:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/vercel.mjs" logs $ARGUMENTS
```

Behaviour:
- With no arguments this fetches **build logs for the latest deployment**.
- Pass a deployment URL or id to target a specific deployment (get ids from `/vercel:status`).
- `--runtime` streams runtime (function/server) logs via the Vercel CLI instead — use this when
  debugging live API errors rather than build failures. Runtime streaming follows the live
  deployment; stop it once enough output is captured (run it in the background with a timeout
  rather than blocking indefinitely).

After fetching, do not dump raw logs at the user. Summarise: what failed (or that the build was
clean), quote only the decisive lines (the first error, not the cascade), and state the concrete
fix. Common Vercel failures worth recognising: missing environment variables, type/lint errors
that pass locally in dev but fail `next build`, and out-of-date lockfiles.
