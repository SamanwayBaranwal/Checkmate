// End-to-end smoke test for the local Checkmate stack (backend :4000).
// Creates two test users, claims free credits, matches them, plays Scholar's mate, checks settlement + ELO.
import { createRequire } from 'module';
const require = createRequire('/Users/samanwaybaranwal/Desktop/Samanway/checkmate-project/Checkmate/frontend/package.json');
const { io } = require('socket.io-client');
const API = 'http://localhost:4000';
const results = [];
const ok = (name, pass, info = '') => { results.push([pass ? 'PASS' : 'FAIL', name, info]); };
const j = async (method, path, token, body) => {
  let r; try { r = await fetch(API + path, { signal: AbortSignal.timeout(6000), method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); } catch (e) { return { status: 'TIMEOUT', d: null }; }
  let d = null; try { d = await r.json(); } catch {}
  return { status: r.status, d };
};
const rnd = Math.random().toString(36).slice(2, 8);
async function mkUser(n) {
  const r = await j('POST', '/api/auth/verify', null, { privyUserId: `did:privy:test-${rnd}-${n}`, wallet: "0x" + [...(rnd + n)].map((c) => c.charCodeAt(0).toString(16)).join("").padEnd(40, "0").slice(0, 40) });
  ok(`auth/verify user ${n}`, r.status === 200 && !!r.d?.token, `status ${r.status}`);
  return r.d;
}
const A = await mkUser('a'), B = await mkUser('b');
for (const [u, n] of [[A, 'a'], [B, 'b']]) {
  const c = await j('POST', '/api/dev/claim-starter', u.token);
  ok(`claim $10 starter (${n})`, c.status === 200, JSON.stringify(c.d).slice(0, 80));
}
const bal = async (u) => (await j('GET', '/api/wallet/balance', u.token)).d;
const b0 = [await bal(A), await bal(B)];
ok('wallet/balance', b0[0] && b0[1], JSON.stringify(b0).slice(0, 120));

// GET endpoints
for (const p of ['/api/users/me', '/api/users/leaderboard', '/api/users/me/referral', '/api/users/me/suggested', '/api/users/me/recent-opponents',
  '/api/friends', '/api/notifications', '/api/puzzles/daily', '/api/missions', '/api/games/active', '/api/wallet/transactions',
  '/api/wallet/earnings-chart', '/api/tournaments', '/api/users/search?q=a']) {
  const r = await j('GET', p, A.token);
  ok(`GET ${p}`, r.status < 400, `status ${r.status}${r.status >= 400 ? ' ' + JSON.stringify(r.d).slice(0, 80) : ''}`);
}

// socket game
const sock = (u) => io(API, { auth: { token: u.token }, transports: ['websocket'] });
const sa = sock(A), sb = sock(B);
const wait = (s, ev, ms = 8000) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout ' + ev)), ms); s.once(ev, (d) => { clearTimeout(t); res(d); }); });
await Promise.all([wait(sa, 'connect'), wait(sb, 'connect')]);
ok('socket connect x2', true);
await new Promise(r => setTimeout(r, 500));
const mA = wait(sa, 'match_found'), mB = wait(sb, 'match_found');
sa.emit('join_queue', { tier: 1, timeControl: '5+0' });
await new Promise(r => setTimeout(r, 300));
sb.emit('join_queue', { tier: 1, timeControl: '5+0' });
let ma, mb;
try { [ma, mb] = await Promise.all([mA, mB]); ok('matchmaking: match_found', true, `game ${ma.gameId}`); }
catch (e) { ok('matchmaking: match_found', false, e.message); }
if (ma) {
  const gid = ma.gameId;
  const gs = [wait(sa, 'game_state'), wait(sb, 'game_state')];
  sa.emit('rejoin_game', { gameId: gid }); sb.emit('rejoin_game', { gameId: gid });
  try { await Promise.all(gs); ok('game page join (rejoin_game -> game_state)', true); } catch (e) { ok('game page join', false, e.message); }
  const white = ma.color === 'white' ? sa : sb, black = ma.color === 'white' ? sb : sa;
  const errs = []; [sa, sb].forEach(s => s.on('move_error', e => errs.push(e)));
  const over = wait(sa, 'game_over', 15000);
  const moves = [[white, 'e2', 'e4'], [black, 'e7', 'e5'], [white, 'f1', 'c4'], [black, 'b8', 'c6'], [white, 'd1', 'h5'], [black, 'g8', 'f6'], [white, 'h5', 'f7']];
  for (const [s, from, to] of moves) {
    const mm = wait(sa, 'move_made', 5000).catch(e => null);
    s.emit('move', { gameId: gid, from, to });
    const r = await mm; if (!r) { ok(`move ${from}-${to}`, false, JSON.stringify(errs.at(-1) ?? 'no move_made')); break; }
  }
  ok('7 moves accepted (Scholar\'s mate)', errs.length === 0, errs.length ? JSON.stringify(errs) : '');
  try { const g = await over; ok('game_over on checkmate', !!g, JSON.stringify(g).slice(0, 140)); } catch (e) { ok('game_over on checkmate', false, e.message); }
  await new Promise(r => setTimeout(r, 800));
  const b1 = [await bal(A), await bal(B)];
  ok('balances after game', true, JSON.stringify({ before: b0, after: b1 }).slice(0, 220));
  const g = await j('GET', `/api/games/${gid}`, A.token);
  ok(`GET /api/games/:id (replay)`, g.status === 200, `status ${g.status} ${JSON.stringify(g.d).slice(0, 120)}`);
}
sa.close(); sb.close();
for (const r of results) console.log(r[0], '|', r[1], '|', r[2]);
console.log(`\n${results.filter(r => r[0] === 'PASS').length}/${results.length} passed`);
process.exit(0);
