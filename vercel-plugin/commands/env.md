---
description: List, read, set, or remove Vercel environment variables
argument-hint: "[ls | get NAME | add NAME VALUE [targets] | rm NAME [target]]"
allowed-tools: ["Bash"]
---

Manage Vercel environment variables. Arguments given: `$ARGUMENTS`

Run the matching subcommand:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/vercel.mjs" env ls
node "${CLAUDE_PLUGIN_ROOT}/scripts/vercel.mjs" env get NAME
node "${CLAUDE_PLUGIN_ROOT}/scripts/vercel.mjs" env add NAME VALUE production,preview,development
node "${CLAUDE_PLUGIN_ROOT}/scripts/vercel.mjs" env rm NAME [target]
```

Rules:
- With no arguments, default to `env ls`.
- `add` upserts (overwrites an existing value for the same targets). Targets default to all
  three environments; pass a comma-separated subset as the third argument to scope it.
- **Never print secret values into the conversation unless the user explicitly asked to see
  one** — after `get`, prefer confirming shape/prefix (e.g. "starts with AQ., 53 chars") unless
  they asked for the value itself.
- After any `add` or `rm`, remind the user (the script also prints this) that env changes only
  apply to NEW deployments, and offer to redeploy now via
  `node "${CLAUDE_PLUGIN_ROOT}/scripts/vercel.mjs" redeploy` or `/vercel:deploy --prod`.
- When the user reports "works locally, broken in production", diff `env ls` output against the
  local `.env.local` keys and call out anything missing or mismatched (compare keys, not values).
