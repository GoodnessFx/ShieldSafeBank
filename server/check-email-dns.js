/**
 * Email deliverability diagnostics for Shield Safe Bank.
 *
 * Answers the one question that blocks verification codes and password-reset
 * links: are the Resend DNS records for the sending domain live yet?
 *
 * Usage (from server/):
 *   node check-email-dns.js                              # check the sending domain
 *   node check-email-dns.js --domain shieldsafebank.com   # check another domain
 *   node check-email-dns.js --send-test me@gmail.com      # prove end-to-end delivery
 *   node check-email-dns.js --resolver 8.8.8.8            # query a specific resolver
 *   node check-email-dns.js --help
 *
 * RESEND_API_KEY is read from the environment or from the git-ignored
 * server/.env — the same convention migrate-store.js uses. A **Full access**
 * key lets the script read Resend's own record list and verification status,
 * so the expected DKIM/SPF values are the real ones rather than a copy of this
 * file. A **Sending access** key (or no key at all) still runs every DNS check
 * — and still allows --send-test — it just falls back to the standard record
 * set below.
 *
 * TXT, MX *and* CNAME records are checked: newer Resend regions publish the
 * return-path/SPF as CNAMEs (`send`, `rsend` → *.forge.rmta.net) instead of
 * the older MX + TXT pair, and the legacy form is accepted as an alternative.
 *
 * Exit code 0 → every record is live and Resend reports the domain verified.
 * Exit code 1 → at least one record is missing, wrong, or still pending.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resolver } from 'node:dns/promises';
import { MAIL_FROM, SENDING_DOMAIN } from './email-config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Loads KEY=VALUE pairs from a git-ignored .env next to this script (or in the
 * working directory) when the variable is not already in the environment, so
 * RESEND_API_KEY never has to be pasted into the shell (or into a chat window).
 */
function loadEnvFile() {
  for (const candidate of [join(__dirname, '.env'), join(process.cwd(), '.env')]) {
    if (!existsSync(candidate)) continue;
    for (const line of readFileSync(candidate, 'utf-8').split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      const value = m[2].trim().replace(/^["']|["']$/g, '');
      if (value && !process.env[m[1]]) process.env[m[1]] = value;
    }
    return candidate;
  }
  return '';
}

function printHelp() {
  console.log(`
Shield Safe Bank — email DNS diagnostics

  node check-email-dns.js [options]

  --domain <name>       domain to check (default: ${SENDING_DOMAIN})
  --send-test <email>   after the checks, send one real email through Resend
  --resolver <ip>       DNS server to query (repeatable; default 1.1.1.1, 8.8.8.8)
  --help                show this text

Reads RESEND_API_KEY from the environment or from server/.env. With a key it
uses Resend's own record list and verification status; without one it checks
the standard records (us-east-1 region) from the outside.
`);
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

/** Value that follows a `--flag`, or '' when the flag is absent. */
function flagValue(name) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : '';
}

const envFile = loadEnvFile();
const DOMAIN = (flagValue('--domain') || SENDING_DOMAIN).toLowerCase();
const API_KEY = (process.env.RESEND_API_KEY || '').trim();
const SEND_TEST_TO = flagValue('--send-test');
const resolvers = args.flatMap((a, i) => (a === '--resolver' && args[i + 1] ? [args[i + 1]] : []));
if (!resolvers.length) resolvers.push('1.1.1.1', '8.8.8.8');
// A dedicated resolver with a hard timeout, so one unresponsive DNS server can
// never leave the whole check hanging.
const dns = new Resolver({ timeout: 4000, tries: 2 });
dns.setServers(resolvers);

/* Colours are cosmetic — skipped when piped or when NO_COLOR is set. */
const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const paint = (code, text) => (useColor ? `\u001b[${code}m${text}\u001b[0m` : String(text));
const green = t => paint('32', t);
const red = t => paint('31', t);
const yellow = t => paint('33', t);
const dim = t => paint('2', t);
const bold = t => paint('1', t);

/**
 * The records Resend asks for on this account (Region **EU / eu-west-1**):
 *
 *   TXT   resend._domainkey   the DKIM key — unique per domain, checked for presence
 *   CNAME send                -> send.forge.rmta.net   (return path / SPF)
 *   CNAME rsend               -> rsend-euw1.forge.rmta.net (SPF)
 *   TXT   _dmarc              optional, recommended
 *
 * Older / other regions use an MX + TXT pair on `send` instead of the CNAMEs;
 * those are kept as alternatives so the check still works if the region ever
 * changes. A Resend **Full access** key replaces this whole list with the real
 * one straight from the API — a Sending-only key cannot read it.
 */
function fallbackRecords(domain) {
  return [
    { record: 'DKIM', type: 'TXT', name: `resend._domainkey.${domain}`, value: '', status: 'unknown' },
    {
      record: 'SPF',
      type: 'CNAME',
      name: `send.${domain}`,
      valueEndsWith: '.forge.rmta.net',
      example: 'send.forge.rmta.net',
      status: 'unknown',
      alternatives: [
        { record: 'SPF', type: 'MX', name: `send.${domain}`, valueEndsWith: 'amazonses.com', priority: 10 },
        { record: 'SPF', type: 'TXT', name: `send.${domain}`, valueIncludes: 'amazonses.com' },
      ],
    },
    {
      record: 'SPF',
      type: 'CNAME',
      name: `rsend.${domain}`,
      valueEndsWith: '.forge.rmta.net',
      example: 'rsend-euw1.forge.rmta.net',
      status: 'unknown',
    },
    { record: 'DMARC', type: 'TXT', name: `_dmarc.${domain}`, value: 'v=DMARC1; p=none;', status: 'unknown' },
  ];
}

/** Thin wrapper around the Resend REST API so failures never throw. */
async function resendRequest(pathname, init = {}) {
  try {
    const res = await fetch(`https://api.resend.com${pathname}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
      signal: AbortSignal.timeout(20000),
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, status: 0, body: { message: err.name === 'TimeoutError' ? 'Request timed out.' : String(err.message || err) } };
  }
}

/* --------------------------------------------------------------------------- *
 * DNS probes
 *
 * Both helpers resolve to a value list plus the DNS error code, so a lookup
 * that finds nothing ("ENODATA"/"ENOTFOUND") can be reported as "nothing
 * published" instead of looking like a crash.
 * ------------------------------------------------------------------------- */
async function lookupTxt(name) {
  try {
    const records = await dns.resolveTxt(name);
    // A long DKIM value arrives split into 255-byte chunks; rejoining them
    // restores the single string that was pasted into the DNS panel.
    return { values: records.map(chunks => chunks.join('')), code: '' };
  } catch (err) {
    return { values: [], code: err.code || String(err.message || err) };
  }
}

async function lookupMx(name) {
  try {
    const records = await dns.resolveMx(name);
    return {
      values: records.map(r => ({ exchange: String(r.exchange).replace(/\.$/, ''), priority: r.priority })),
      code: '',
    };
  } catch (err) {
    return { values: [], code: err.code || String(err.message || err) };
  }
}

/** DNS CNAME lookups (Resend's newer return-path/SPF records are CNAMEs). */
async function lookupCname(name) {
  try {
    const records = await dns.resolveCname(name);
    return { values: records.map(v => String(v).replace(/\.$/, '')), code: '' };
  } catch (err) {
    return { values: [], code: err.code || String(err.message || err) };
  }
}

/** Whitespace/punctuation-insensitive form, for DKIM keys and quoted TXT values. */
const squash = v => String(v).replace(/[\s"']/g, '').toLowerCase();
/** Readable form: single-spaced, trimmed, unquoted. */
const tidy = v => String(v).replace(/["']/g, '').replace(/\s+/g, ' ').trim();

/** Compares a host-style value (MX exchange, CNAME target) against a rule. */
function valueMatches(want, actual) {
  const a = String(actual).toLowerCase().replace(/\.$/, '');
  if (!a) return false;
  if (want.value && a === String(want.value).toLowerCase().replace(/\.$/, '')) return true;
  if (want.valueEndsWith && a.endsWith(String(want.valueEndsWith).toLowerCase())) return true;
  return false;
}

function explain(code) {
  if (code === 'ENOTFOUND' || code === 'ENODATA' || code === 'NXDOMAIN') return 'nothing published';
  if (code === 'ETIMEOUT' || code === 'ETIMEDOUT') return 'DNS server did not answer';
  return code || 'lookup failed';
}

/** A second lookup under `<name>.<domain>` catches the classic paste mistake. */
async function doubledNameHint(want) {
  const doubled = `${want.name}.${DOMAIN}`;
  const found = want.type === 'MX' ? await lookupMx(doubled)
    : want.type === 'CNAME' ? await lookupCname(doubled)
      : await lookupTxt(doubled);
  if (!found.values.length) return '';
  const shortName = want.name.slice(0, want.name.length - DOMAIN.length - 1);
  return `A record for ${doubled} DOES exist — the full name was pasted into a field that already appends .${DOMAIN}. Delete it and enter just "${shortName}".`;
}

/** DMARC lives at `_dmarc.<domain>` and is recommended rather than required. */
const isDmarcRecord = r => String(r.record || '').toUpperCase() === 'DMARC' || String(r.name || '').startsWith('_dmarc');
const isSpfRecord = r => String(r.record || '').toUpperCase() === 'SPF'
  || (r.value ? tidy(r.value).toLowerCase().startsWith('v=spf1') : false);
/** Records Resend needs before the domain verifies; DMARC is not one of them. */
const isOptionalRecord = r => isDmarcRecord(r);

/** Checks a single rule — a record, or one of its acceptable alternatives. */
async function matchCandidate(want) {
  if (want.type === 'MX') {
    const { values, code } = await lookupMx(want.name);
    if (!values.length) return { ok: false, note: explain(code) };
    const hit = values.find(v => valueMatches(want, v.exchange));
    if (!hit) return { ok: false, note: `points at ${values.map(v => v.exchange).join(', ')} instead` };
    if (want.priority != null && hit.priority !== want.priority) {
      return { ok: false, note: `host correct but priority ${hit.priority} (Resend wants ${want.priority})` };
    }
    return { ok: true, note: `${hit.exchange} (priority ${hit.priority})` };
  }

  if (want.type === 'CNAME') {
    const { values, code } = await lookupCname(want.name);
    if (!values.length) return { ok: false, note: explain(code) };
    const hit = values.find(v => valueMatches(want, v));
    if (!hit) return { ok: false, note: `points at ${values.join(', ')} instead` };
    return { ok: true, note: hit };
  }

  const { values, code } = await lookupTxt(want.name);
  if (!values.length) return { ok: false, note: explain(code) };
  if (isDmarcRecord(want)) {
    // Any DMARC policy satisfies Resend — the dashboard suggests p=none to
    // start with, so a stricter p=quarantine/p=reject is a pass, not a problem.
    const existing = values.find(v => tidy(v).toLowerCase().startsWith('v=dmarc1'));
    if (!existing) return { ok: false, note: 'no DMARC policy published' };
    const policy = /p=([a-z]+)/i.exec(tidy(existing));
    const shown = tidy(existing);
    return { ok: true, note: `${shown.slice(0, 46)}${shown.length > 46 ? '…' : ''} ${dim(`(policy ${policy ? policy[1] : 'set'})`)}` };
  }
  if (want.value && values.some(v => tidy(v) === tidy(want.value))) return { ok: true, note: tidy(want.value) };
  if (want.value && values.some(v => squash(v) === squash(want.value))) {
    return { ok: true, note: `${tidy(want.value)} ${dim('(matches apart from whitespace)')}` };
  }
  if (want.value) {
    const shorter = values.find(v => squash(want.value).length > 40 && squash(v).startsWith(squash(want.value).slice(0, 40)));
    if (shorter) {
      return { ok: false, note: 'starts correctly but is shorter than the value Resend expects — the key looks truncated, re-copy the whole value' };
    }
  }
  if (want.valueIncludes) {
    const needle = String(want.valueIncludes).toLowerCase();
    const hit = values.find(v => tidy(v).toLowerCase().includes(needle));
    if (hit) return { ok: true, note: tidy(hit) };
  }
  if (!want.value && !want.valueIncludes) {
    // DKIM: Resend only shows the exact key in the dashboard, so presence is
    // all this script can prove — Resend itself is the judge of the value.
    return { ok: true, note: `${tidy(values[0]).slice(0, 48)}… present (value not checked)` };
  }
  if (isSpfRecord(want)) {
    const shown = tidy(values[0]);
    return { ok: false, note: `${shown.slice(0, 46)}… — this name already publishes SPF, so merge the Resend include into that ONE record (two SPF records break SPF)` };
  }
  return { ok: false, note: `published value does not match (${tidy(values[0]).slice(0, 56)}…)` };
}

/** Checks one expected record, passing if any acceptable form is published. */
async function checkRecord(want) {
  const primary = await matchCandidate(want);
  if (primary.ok) return primary;
  const alternatives = want.alternatives || [];
  for (const alt of alternatives) {
    const result = await matchCandidate(alt);
    if (result.ok) return result;
  }
  if (!alternatives.length) return primary;
  return { ok: false, note: `${primary.note} — the equivalent ${alternatives.map(a => a.type).join(' / ')} form is not published either` };
}

/* --------------------------------------------------------------------------- *
 * Output
 * ------------------------------------------------------------------------- */
function statusLabel(status) {
  if (status === 'verified') return green('verified');
  if (status === 'pending') return yellow('pending');
  if (status === 'failed' || status === 'temporary_failure') return red(status);
  return dim(status || 'unknown');
}

/** Best available value text for a record: exact, documented example, or a pointer. */
function displayValue(r, fallback = '(copy from the Resend dashboard)') {
  if (r.value) return tidy(r.value);
  if (r.example) return r.example;
  return fallback;
}

/** Prints the records as a copy-paste table: short host + full record name. */
function printRecordTable(records) {
  const rows = records.map(r => {
    const full = String(r.name).toLowerCase();
    const host = full.endsWith(`.${DOMAIN}`) ? full.slice(0, full.length - DOMAIN.length - 1) : full;
    return {
      type: String(r.type),
      host,
      full,
      value: displayValue(r),
      priority: r.priority != null ? String(r.priority) : '—',
    };
  });
  const width = { type: 4, host: 4, full: 4, value: 5 };
  for (const row of rows) {
    width.type = Math.max(width.type, row.type.length);
    width.host = Math.max(width.host, row.host.length);
    width.full = Math.max(width.full, row.full.length);
    width.value = Math.min(58, Math.max(width.value, row.value.length));
  }
  const clip = v => (v.length > width.value ? `${v.slice(0, width.value - 1)}…` : v);
  const line = row => [
    row.type.padEnd(width.type),
    row.host.padEnd(width.host),
    row.full.padEnd(width.full),
    clip(row.value).padEnd(width.value),
    row.priority,
  ].join('  ');
  console.log(`  ${dim(line({ type: 'TYPE', host: 'HOST (paste)', full: 'FULL NAME', value: 'VALUE', priority: 'PRIO' }))}`);
  for (const row of rows) console.log(`  ${line(row)}`);
}

/* --------------------------------------------------------------------------- *
 * main
 * ------------------------------------------------------------------------- */
async function main() {
  console.log(bold('\nShield Safe Bank — email DNS diagnostics'));
  console.log(`  Sending from : ${MAIL_FROM}`);
  console.log(`  Domain       : ${DOMAIN}`);
  console.log(`  Resolvers    : ${resolvers.join(', ')}`);
  console.log(`  Env file     : ${envFile ? envFile : dim('none found')}`);
  console.log(`  Resend key   : ${API_KEY ? 'found' : yellow('RESEND_API_KEY not set — public DNS checks only')}`);

  let records = fallbackRecords(DOMAIN);
  let domainStatus = null;
  let domainAdded = null;

  if (API_KEY) {
    const list = await resendRequest('/domains');
    if (!list.ok) {
      const detail = list.body.message || list.body.error || 'no message';
      const restricted = list.body.name === 'restricted_api_key';
      console.log(`  Resend API   : ${red(`HTTP ${list.status}: ${detail}`)}`);
      if (restricted) {
        console.log(`                 This key is allowed to send only, so Resend cannot be asked for the`);
        console.log(`                 record list. Falling back to the standard set below.`);
        console.log(`                 ${dim('For exact values and Resend\'s own status, use a Full access key in server/.env. --send-test works either way.')}`);
      }
    } else {
      const found = (list.body.data || []).find(d => String(d.name).toLowerCase() === DOMAIN);
      if (!found) {
        domainAdded = false;
        console.log(`  Resend API   : ${red(`${DOMAIN} is not added to this Resend account yet.`)}`);
        console.log(`                 Add it at https://resend.com/domains → Add Domain, then re-run this script.`);
      } else {
        domainAdded = true;
        domainStatus = found.status;
        if (Array.isArray(found.records) && found.records.length) records = found.records;
        console.log(`  Resend API   : domain found — status ${statusLabel(found.status)}${found.region ? dim(` (region ${found.region})`) : ''}`);
      }
    }
  }

  console.log(bold(`\nExpected records${API_KEY && domainAdded ? ' (from Resend)' : ' (standard Resend setup)'}`));
  printRecordTable(records);
  console.log(dim(`  Use HOST when your DNS panel already appends .${DOMAIN}; use FULL NAME when it asks for the whole record.`));

  console.log(bold('\nRecord checks'));
  const missing = [];      // records Resend needs before the domain verifies
  const recommended = [];  // DMARC: good practice, never blocks verification
  for (const want of records) {
    const result = await checkRecord(want);
    const optional = isOptionalRecord(want);
    const tag = result.ok ? green('[ OK ]') : optional ? yellow('[WARN]') : red('[FAIL]');
    const suffix = !result.ok && optional ? dim(' (recommended, not required)') : '';
    console.log(`  ${tag} ${String(want.type).padEnd(4)} ${String(want.name).padEnd(38)} ${result.note}${suffix}`);
    if (result.ok) continue;
    (optional ? recommended : missing).push(want);
    const hint = await doubledNameHint(want);
    if (hint) console.log(`         ${yellow(hint)}`);
  }

  const toAdd = [...missing, ...recommended];
  if (toAdd.length) {
    const unique = [...new Map(toAdd.map(r => [`${r.type}|${r.name}`, r])).values()];
    console.log(bold('\nCopy these values into your DNS provider (verbatim — do not retype):'));
    for (const r of unique) {
      const priority = r.priority != null ? `  →  priority ${r.priority}` : '';
      const note = isOptionalRecord(r) ? dim('  (optional)') : '';
      console.log(`  • ${r.type}  ${String(r.name).toLowerCase()}${priority}${note}`);
      console.log(`    ${displayValue(r, `(get the value from https://resend.com/domains → ${DOMAIN})`)}`);
    }
  }

  const requiredRecords = records.filter(r => !isOptionalRecord(r));
  const liveRequired = requiredRecords.length - missing.length;
  const verified = domainAdded !== false && (domainStatus === null || domainStatus === 'verified');
  const allGood = missing.length === 0 && verified;
  console.log(bold('\nSummary'));
  console.log(`  ${liveRequired} of ${requiredRecords.length} required records live${domainStatus ? ` · Resend status: ${statusLabel(domainStatus)}` : ''}`);
  if (recommended.length) console.log(`  ${yellow('DMARC not published')} — recommended (it blocks spoofing) but Resend does not require it.`);
  if (allGood) {
    console.log(`  ${green('Everything Resend needs is in place.')} Verification codes and password-reset emails will deliver.`);
    if (domainStatus === null) console.log(`  Confirm the domain shows ${bold('Verified')} at https://resend.com/domains (it re-checks automatically).`);
    console.log(`  Final proof: ${bold('node check-email-dns.js --send-test you@example.com')}`);
  } else {
    console.log('  Next:');
    if (missing.length) {
      console.log('   • Add the missing records above at your DNS provider (Global Domain Group / your registrar panel).');
      console.log('   • Paste values exactly; a trailing dot on the value makes it a different record.');
    }
    if (domainAdded === false) console.log('   • Add the domain at https://resend.com/domains → Add Domain first.');
    console.log('   • Click "Verify DNS Records" at https://resend.com/domains (it also re-checks on its own).');
    console.log('   • DNS usually propagates in a few minutes; Resend allows up to 72 hours.');
  }

  return allGood;
}

main()
  .then(allGood => {
    if (!SEND_TEST_TO) process.exit(allGood ? 0 : 1);
    console.log(bold(`\nTest send to ${SEND_TEST_TO}`));
    if (!API_KEY) {
      console.log(`  ${red('RESEND_API_KEY is not set — cannot send.')}`);
      process.exit(1);
    }
    return resendRequest('/emails', {
      method: 'POST',
      body: JSON.stringify({
        from: MAIL_FROM,
        to: SEND_TEST_TO,
        subject: 'Shield Safe Bank email test',
        html: '<p>If you can read this, Shield Safe Bank can deliver mail to your inbox.</p>',
      }),
    }).then(result => {
      if (result.ok) {
        console.log(`  ${green('Sent.')} Resend id ${result.body.id} — check ${SEND_TEST_TO} (and the spam folder).`);
        process.exit(0);
      }
      console.log(`  ${red(`Failed (HTTP ${result.status}): ${result.body.message || 'no message'}`)}`);
      process.exit(1);
    });
  })
  .catch(err => {
    console.error(`\n${red('Diagnostics failed to run:')} ${err && err.message ? err.message : err}`);
    process.exit(1);
  });



