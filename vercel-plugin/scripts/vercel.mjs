#!/usr/bin/env node
/**
 * Vercel helper for the "vercel" Claude Code plugin.
 * Zero dependencies — talks to the Vercel REST API directly and shells out
 * to the Vercel CLI only for actions the API can't do simply (deploys, runtime logs).
 *
 * Auth: VERCEL_TOKEN from the environment or from .env.local / .env in the
 * working directory (create one at https://vercel.com/account/tokens).
 *
 * Usage:
 *   node vercel.mjs whoami
 *   node vercel.mjs status [n]
 *   node vercel.mjs logs [deployment-url-or-id] [--runtime] [--n=100]
 *   node vercel.mjs env ls
 *   node vercel.mjs env get NAME
 *   node vercel.mjs env add NAME VALUE [production,preview,development]
 *   node vercel.mjs env rm NAME [target]
 *   node vercel.mjs deploy [--prod]
 *   node vercel.mjs redeploy [deployment-url]
 *   node vercel.mjs promote <deployment-url-or-id>
 */
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const API = 'https://api.vercel.com';
const CWD = process.cwd();

loadDotEnv(path.join(CWD, '.env.local'));
loadDotEnv(path.join(CWD, '.env'));

const [, , command, ...args] = process.argv;

try {
  switch (command) {
    case 'whoami':    await whoami(); break;
    case 'status':    await status(args); break;
    case 'logs':      await logs(args); break;
    case 'env':       await env(args); break;
    case 'deploy':    deployCli(args); break;
    case 'redeploy':  vercelCli(['redeploy', ...args]); break;
    case 'promote':   vercelCli(['promote', ...args]); break;
    default:
      fail(
        `Unknown command: ${command ?? '(none)'}\n` +
        'Commands: whoami | status [n] | logs [id] [--runtime] | env ls|get|add|rm | deploy [--prod] | redeploy | promote'
      );
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

// ---------------------------------------------------------------- commands

async function whoami() {
  const user = await api('/v2/user');
  console.log(`Token OK — logged in as ${user.user?.username ?? user.user?.email ?? 'unknown'}`);
  const project = await resolveProject();
  console.log(`Project: ${project.name} (${project.id})${project.teamId ? ` · team ${project.teamId}` : ''}`);
}

async function status(argv) {
  const limit = Number(argv[0]) > 0 ? Number(argv[0]) : 5;
  const project = await resolveProject();
  const data = await api(`/v6/deployments?projectId=${project.id}&limit=${limit}${teamQS(project, '&')}`);
  const deployments = data.deployments ?? [];

  if (deployments.length === 0) {
    console.log('No deployments found.');
    return;
  }

  console.log(`Latest ${deployments.length} deployment(s) for ${project.name}:\n`);
  for (const d of deployments) {
    const age = formatAge(Date.now() - d.createdAt);
    const commit = d.meta?.githubCommitMessage
      ? ` · "${truncate(d.meta.githubCommitMessage, 60)}"`
      : '';
    console.log(
      `${stateIcon(d.state)} ${(d.state ?? '?').padEnd(9)} ${d.target === 'production' ? 'PROD   ' : 'preview'}` +
      ` · https://${d.url} · ${age} ago${commit}\n    id: ${d.uid}`
    );
  }
}

async function logs(argv) {
  const flags = argv.filter((a) => a.startsWith('--'));
  const positional = argv.filter((a) => !a.startsWith('--'));
  const runtime = flags.includes('--runtime');
  const limit = Number((flags.find((f) => f.startsWith('--n=')) ?? '').split('=')[1]) || 100;

  const project = await resolveProject();
  let target = positional[0];

  if (!target) {
    const data = await api(`/v6/deployments?projectId=${project.id}&limit=1${teamQS(project, '&')}`);
    const latest = data.deployments?.[0];
    if (!latest) fail('No deployments found for this project.');
    target = latest.uid;
    console.log(`(latest deployment: https://${latest.url} · ${latest.state})\n`);
  }

  if (runtime) {
    // Runtime logs stream via the CLI; the REST endpoint is plan-restricted.
    vercelCli(['logs', target]);
    return;
  }

  const events = await api(
    `/v3/deployments/${encodeURIComponent(target)}/events?builds=1&limit=${limit}${teamQS(await projectForTeam(), '&')}`
  );
  const list = Array.isArray(events) ? events : events.events ?? [];
  if (list.length === 0) {
    console.log('No build log events. For runtime logs use --runtime.');
    return;
  }
  for (const event of list) {
    const text = event.payload?.text ?? event.text;
    if (text) console.log(text);
  }
}

async function env(argv) {
  const [action, name, value, targetsArg] = argv;
  const project = await resolveProject();
  const base = `/v9/projects/${project.id}/env`;

  if (action === 'ls' || action === undefined) {
    const data = await api(`${base}${teamQS(project, '?')}`);
    const vars = data.envs ?? [];
    if (vars.length === 0) return console.log('No environment variables set.');
    console.log(`${'KEY'.padEnd(32)} ${'TARGETS'.padEnd(34)} TYPE`);
    for (const v of vars.sort((a, b) => a.key.localeCompare(b.key))) {
      console.log(`${v.key.padEnd(32)} ${(v.target ?? []).join(',').padEnd(34)} ${v.type}`);
    }
    return;
  }

  if (action === 'get') {
    if (!name) fail('Usage: env get NAME');
    const data = await api(`${base}?decrypt=true${teamQS(project, '&')}`);
    const matches = (data.envs ?? []).filter((v) => v.key === name);
    if (matches.length === 0) fail(`No env var named ${name}.`);
    for (const v of matches) {
      const shown = v.value !== undefined && v.value !== null ? v.value : '(sensitive — value not readable via API)';
      console.log(`${v.key} [${(v.target ?? []).join(',')}] = ${shown}`);
    }
    return;
  }

  if (action === 'add') {
    if (!name || value === undefined) fail('Usage: env add NAME VALUE [production,preview,development]');
    const target = (targetsArg ?? 'production,preview,development').split(',').map((t) => t.trim());
    await api(`/v10/projects/${project.id}/env?upsert=true${teamQS(project, '&')}`, {
      method: 'POST',
      body: { key: name, value, type: 'encrypted', target },
    });
    console.log(`Set ${name} for [${target.join(', ')}].`);
    console.log('NOTE: env changes only apply to NEW deployments — redeploy for them to take effect.');
    return;
  }

  if (action === 'rm') {
    if (!name) fail('Usage: env rm NAME [target]');
    const data = await api(`${base}${teamQS(project, '?')}`);
    const matches = (data.envs ?? []).filter(
      (v) => v.key === name && (!targetsArg || (v.target ?? []).includes(targetsArg))
    );
    if (matches.length === 0) fail(`No env var named ${name}${targetsArg ? ` for target ${targetsArg}` : ''}.`);
    for (const v of matches) {
      await api(`${base}/${v.id}${teamQS(project, '?')}`, { method: 'DELETE' });
      console.log(`Removed ${v.key} [${(v.target ?? []).join(',')}].`);
    }
    console.log('NOTE: env changes only apply to NEW deployments — redeploy for them to take effect.');
    return;
  }

  fail(`Unknown env action: ${action}. Use ls | get | add | rm.`);
}

function deployCli(argv) {
  const prod = argv.includes('--prod');
  vercelCli(['deploy', ...(prod ? ['--prod'] : []), '--yes']);
}

// ---------------------------------------------------------------- plumbing

function vercelCli(cliArgs) {
  const token = requireToken();
  const project = projectHint();
  const extra = [];
  if (project?.teamId) extra.push('--scope', project.teamId);

  const result = spawnSync('npx', ['vercel', ...cliArgs, ...extra, '--token', token], {
    stdio: 'inherit',
    shell: true,
    cwd: CWD,
  });
  process.exit(result.status ?? 1);
}

async function api(pathname, { method = 'GET', body } = {}) {
  const token = requireToken();
  const response = await fetch(`${API}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return {};
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message ?? `HTTP ${response.status}`;
    if (response.status === 403 || response.status === 401) {
      throw new Error(`Vercel API auth failed (${message}). Check VERCEL_TOKEN in .env.local.`);
    }
    throw new Error(`Vercel API error on ${pathname}: ${message}`);
  }
  return data;
}

let cachedProject = null;

async function resolveProject() {
  if (cachedProject) return cachedProject;

  // 1. Explicit env overrides
  if (process.env.VERCEL_PROJECT_ID) {
    cachedProject = {
      id: process.env.VERCEL_PROJECT_ID,
      name: process.env.VERCEL_PROJECT_NAME ?? process.env.VERCEL_PROJECT_ID,
      teamId: normalizeTeam(process.env.VERCEL_ORG_ID),
    };
    return cachedProject;
  }

  // 2. `vercel link` metadata
  const linkFile = path.join(CWD, '.vercel', 'project.json');
  if (existsSync(linkFile)) {
    const link = JSON.parse(readFileSync(linkFile, 'utf8'));
    cachedProject = { id: link.projectId, name: link.projectId, teamId: normalizeTeam(link.orgId) };
    return cachedProject;
  }

  // 3. Search the API by name (VERCEL_PROJECT_NAME, else package.json name, else repo dir name)
  const guesses = [
    process.env.VERCEL_PROJECT_NAME,
    readPackageName(),
    path.basename(CWD),
  ].filter(Boolean);

  for (const guess of guesses) {
    const data = await api(`/v9/projects?search=${encodeURIComponent(guess)}&limit=5`);
    const projects = data.projects ?? [];
    const exact = projects.find((p) => p.name === guess) ?? projects[0];
    if (exact) {
      cachedProject = { id: exact.id, name: exact.name, teamId: normalizeTeam(exact.accountId) };
      return cachedProject;
    }
  }

  fail(
    'Could not resolve the Vercel project. Fix one of:\n' +
    '  - run `npx vercel link` once in this repo, or\n' +
    '  - set VERCEL_PROJECT_NAME=<name-on-vercel> in .env.local, or\n' +
    '  - set VERCEL_PROJECT_ID (and VERCEL_ORG_ID for teams) in .env.local'
  );
}

async function projectForTeam() {
  return resolveProject();
}

function projectHint() {
  try {
    const linkFile = path.join(CWD, '.vercel', 'project.json');
    if (existsSync(linkFile)) {
      const link = JSON.parse(readFileSync(linkFile, 'utf8'));
      return { teamId: normalizeTeam(link.orgId) };
    }
  } catch {
    // fall through
  }
  return { teamId: normalizeTeam(process.env.VERCEL_ORG_ID) };
}

function normalizeTeam(orgId) {
  return orgId && orgId.startsWith('team_') ? orgId : undefined;
}

function teamQS(project, prefix) {
  return project?.teamId ? `${prefix}teamId=${project.teamId}` : '';
}

function readPackageName() {
  try {
    return JSON.parse(readFileSync(path.join(CWD, 'package.json'), 'utf8')).name;
  } catch {
    return undefined;
  }
}

function requireToken() {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    fail(
      'VERCEL_TOKEN is not set.\n' +
      '  1. Create a token at https://vercel.com/account/tokens\n' +
      '  2. Add a line to .env.local in this project:  VERCEL_TOKEN=xxxxxxxx\n' +
      '(.env.local is gitignored — the token never leaves this machine.)'
    );
  }
  return token;
}

function loadDotEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const [, key, raw] = match;
    if (process.env[key] !== undefined) continue; // real env wins
    process.env[key] = raw.replace(/^["']|["']$/g, '');
  }
}

function stateIcon(state) {
  return { READY: '[ok]', ERROR: '[!!]', BUILDING: '[..]', QUEUED: '[..]', CANCELED: '[--]' }[state] ?? '[??]';
}

function formatAge(ms) {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function truncate(text, n) {
  return text.length > n ? `${text.slice(0, n - 1)}…` : text;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
