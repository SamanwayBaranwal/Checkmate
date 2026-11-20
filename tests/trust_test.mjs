// Money-safety test: stake limits, one-person-one-account (device), banned devices, locked winnings, payout approval.
import { createRequire } from 'module';
const require = createRequire('/Users/samanwaybaranwal/Desktop/Samanway/checkmate-project/Checkmate/frontend/package.json');
const { io } = require('socket.io-client');
const API = 'http://localhost:4000', ADMIN = 'local-admin';
const PSQL = '/opt/homebrew/opt/postgresql@16/bin/psql';
import { execFileSync } from 'child_process';
const sql = (q) => execFileSync(PSQL, ['-qAt', 'postgres://postgres:postgres@localhost:5432/checkmate', '-c', q]).toString().trim();
const out = []; const ok = (n, p, i = '') => { out.push(p); console.log(p ? 'PASS' : 'FAIL', '|', n, '|', i); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function j(method, path, token, body, admin) {
  try {
    const r = await fetch(API + path, { method, signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(admin ? { 'x-admin-secret': ADMIN } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, d: await r.json().catch(() => null) };
  } catch (e) { return { status: 'ERR', d: e.message }; }
}
const rnd = Math.random().toString(36).slice(2, 7);
const hex = (s) => '0x' + [...s].map((c) => c.charCodeAt(0).toString(16)).join('').padEnd(40, '0').slice(0, 40);
async function login(name, deviceId) {
  return j('POST', '/api/auth/verify', null, { privyUserId: `did:privy:tr-${rnd}-${name}`, wallet: hex(rnd + name), deviceId, fingerprint: 'fp-' + deviceId });
}
async function user(name, deviceId) {
  const r = await login(name, deviceId);
  if (r.status !== 200) return { name, status: r.status, err: r.d };
  const s = io(API, { auth: { token: r.d.token }, transports: ['websocket'] });
  await new Promise((res) => s.once('connect', res));
  return { name, id: r.d.user.id, token: r.d.token, s };
}
const once = (s, ev, ms = 6000) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout ' + ev)), ms); s.once(ev, (d) => { clearTimeout(t); res(d); }); });

const devA = `devA-${rnd}`, devB = `devB-${rnd}`;
const A = await user('a', devA), A2 = await user('a2', devA), B = await user('b', devB);

// starter credits once per device
const sa = await j('POST', '/api/dev/claim-starter', A.token);
const sa2 = await j('POST', '/api/dev/claim-starter', A2.token);
const sb = await j('POST', '/api/dev/claim-starter', B.token);
ok('starter credits: first account on device gets them', sa.status === 200);
ok('starter credits: second account on SAME device refused', sa2.status === 400, sa2.d?.error);
ok('starter credits: different device gets them', sb.status === 200);

// stake limit for new accounts
const lim = await j('GET', '/api/users/me/limits', A.token);
ok('new account limit is $5', lim.d?.level === 'new' && lim.d?.maxStake === 5, JSON.stringify(lim.d));
const e10 = once(A.s, 'error'); A.s.emit('join_queue', { tier: 10, timeControl: '5+0' });
try { const e = await e10; ok('new account cannot queue for $10', /limit is \$5/.test(e.message), e.message); } catch (e) { ok('new account cannot queue for $10', false, e.message); }

// same device never paired: A (devA) and A2 (devA) — give A2 credits directly so it can queue
sql(`update users set usdc_balance = 10 where id = '${A2.id}'`);
let paired = false; const pf = () => { paired = true; };
A.s.on('match_found', pf); A2.s.on('match_found', pf);
A.s.emit('join_queue', { tier: 1, timeControl: '5+0' }); await sleep(300);
A2.s.emit('join_queue', { tier: 1, timeControl: '5+0' }); await sleep(2500);
ok('two accounts on the same device are NEVER matched', !paired);
A2.s.emit('leave_queue'); A.s.off('match_found', pf); A2.s.off('match_found', pf);

// different devices are matched; play a quick game, winner's money is locked
const mA = once(A.s, 'match_found'), mB = once(B.s, 'match_found');
B.s.emit('join_queue', { tier: 1, timeControl: '5+0' });
let m; try { [m] = await Promise.all([mA, mB]); ok('different devices are matched', true); } catch (e) { ok('different devices are matched', false, e.message); }
if (m) {
  const gid = m.gameId;
  await Promise.all([once(A.s, 'game_state'), once(B.s, 'game_state'), (A.s.emit('rejoin_game', { gameId: gid }), B.s.emit('rejoin_game', { gameId: gid }))]);
  const white = m.color === 'white' ? A : B, black = m.color === 'white' ? B : A;
  const over = once(A.s, 'game_over', 10000);
  for (const [p, f, t] of [[white, 'e2', 'e4'], [black, 'e7', 'e5'], [white, 'f1', 'c4'], [black, 'b8', 'c6'], [white, 'd1', 'h5'], [black, 'g8', 'f6'], [white, 'h5', 'f7']]) {
    const mm = once(A.s, 'move_made').catch(() => null); p.s.emit('move', { gameId: gid, from: f, to: t }); await mm;
  }
  const g = await over.catch(() => null);
  await sleep(1000);
  const wb = await j('GET', '/api/wallet/balance', white.token);
  ok('winner\'s payout is LOCKED, not withdrawable', wb.d?.locked > 1.9 && wb.d?.withdrawable < wb.d?.balance, JSON.stringify(wb.d));
  const hold = sql(`select status from winnings_holds where game_id = '${gid}'`);
  ok('hold created for the win', hold === 'held', hold);
  // fast-forward the cooling period; wait for game analysis and the 60s releaser
  sql(`update winnings_holds set release_at = now() - interval '1 minute' where game_id = '${gid}'`);
  let st = '';
  for (let i = 0; i < 40; i++) { st = sql(`select status from winnings_holds where game_id = '${gid}'`); if (st !== 'held') break; await sleep(2000); }
  ok('after check + cooling period the win is RELEASED', st === 'released', st);
}

// big win needs admin approval
sql(`insert into winnings_holds (user_id, amount, status, release_at) values ('${B.id}', 48.75, 'held', now() - interval '1 minute')`);
let big = '';
for (let i = 0; i < 40; i++) { big = sql(`select status from winnings_holds where user_id = '${B.id}' and amount = 48.75`); if (big !== 'held') break; await sleep(2000); }
ok('win above $25 waits for ADMIN approval', big === 'needs_approval', big);
const list = await j('GET', '/api/admin/payouts?status=needs_approval', null, null, true);
const mine = (list.d || []).find((r) => r.user_id === B.id);
ok('admin sees it in the payout queue', !!mine);
if (mine) {
  await j('POST', `/api/admin/payouts/${mine.id}/approve`, null, null, true);
  ok('admin approve releases it', sql(`select status from winnings_holds where id = '${mine.id}'`) === 'released');
}

// linked accounts visible to admin; banned device cannot come back
const ev = await j('GET', `/api/admin/fairplay/${A.id}`, null, null, true);
ok('admin evidence shows linked account on same device', (ev.d?.linkedAccounts || []).some((l) => l.id === A2.id && l.shared.includes('device')), JSON.stringify(ev.d?.linkedAccounts));
await j('POST', `/api/admin/users/${A.id}/ban`, null, { reason: 'test' }, true);
const fresh = await login('fresh', devA);
ok('banned device cannot create/login a NEW account', fresh.status === 403, `${fresh.status} ${fresh.d?.error}`);
const other = await login('fresh2', `devC-${rnd}`);
ok('other devices unaffected', other.status === 200);

[A, A2, B].forEach((u) => u.s?.close());
console.log(`\n${out.filter(Boolean).length}/${out.length} passed`);
process.exit(0);
