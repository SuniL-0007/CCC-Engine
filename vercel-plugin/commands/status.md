---
description: Show recent Vercel deployments with state, target, URL and commit
argument-hint: "[count]"
allowed-tools: ["Bash"]
---

Show the current Vercel deployment status.

Run:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/vercel.mjs" status $ARGUMENTS
```

Then summarise for the user:
- Whether the latest **production** deployment is READY, BUILDING, or ERROR.
- If any deployment shows ERROR, immediately fetch its build logs with
  `node "${CLAUDE_PLUGIN_ROOT}/scripts/vercel.mjs" logs <deployment-id>` and diagnose the failure —
  quote the exact failing lines (type error, missing env var, etc.) and propose the fix.
- If the newest deployment is older than the latest local git commit (`git log -1 --format=%s`),
  point out that local work has not been deployed yet.

If the script reports that VERCEL_TOKEN is missing or the project can't be resolved, relay its
setup instructions verbatim rather than improvising.
