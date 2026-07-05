---
description: Deploy the project to Vercel (preview by default, --prod for production)
argument-hint: "[--prod]"
allowed-tools: ["Bash"]
---

Deploy this project to Vercel. Arguments given: `$ARGUMENTS`

Steps:

1. **Pre-flight** — run `npm run build` locally first. If the local build fails, STOP and report
   the errors instead of deploying; a broken build will only fail slower on Vercel.
2. If there are uncommitted changes (`git status --short`), warn the user that the deploy will
   include them (Vercel CLI uploads the working directory, not the last commit) — then proceed.
3. Deploy:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/vercel.mjs" deploy $ARGUMENTS
```

4. Report the deployment URL from the output. If `--prod` was used, confirm it is the production
   deployment; otherwise explain it is a preview URL and that `--prod` promotes to production.
5. If the deploy errors, fetch logs with
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/vercel.mjs" logs` and diagnose.

Note: if this repo deploys automatically from GitHub pushes, mention that `git push` on main is
the alternative deploy path and CLI deploys bypass the GitHub commit link.
