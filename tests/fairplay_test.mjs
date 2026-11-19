// Fair-play end-to-end test against the local backend (:4000, AUTH_DEV_BYPASS=true).
// A "cheater" plays every move with Stockfish (constant timing, switches tab every move) vs a weak human-like player.
// Two honest weak players play each other. Then: analysis -> statuses -> withdrawal hold -> admin confirm (refunds).
import { createRequire } from 'module';
import { spawn } from 'child_process';
const require = createRequire('/Users/samanwaybaranwal/Desktop/Samanway/checkmate-project/Checkmate/frontend/package.json');
const { io } = require('socket.io-client');
const { Chess } = require('chess.js');
const API = 'http://localhost:4000', ADMIN = 'local-admin';
const out = []; const ok = (n, p, i = '') => { out.push([p ? 'PASS' : 'FAIL', n, i]); console.log(p ? 'PASS' : 'FAIL', '|', n, '|', i); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function j(method, path, token, body, admin) {
  try {
    const r = await fetch(API + path, { method, signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(admin ? { 'x-admin-secret': ADMIN } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, d: await r.json().catch(() => null) };
  } catch (e) { return { status: 'ERR', d: e.message }; }
}

// --- tiny Stockfish client for the cheater
const sf = spawn('stockfish'); let sfBuf = ''; let sfWait = null;
sf.stdout.on('data', (d) => { sfBuf += d; const m = sfBuf.match(/bestmove (\S+)/); if (m && sfWait) { const w = sfWait; sfWait = null; sfBuf = ''; w(m[1]); } });
const best = (fen, depth) => new Promise((r) => { sfBuf = ''; sfWait = r; sf.stdin.write(`position fen ${fen}\ngo depth ${depth}\n`); });

const rnd = Math.random().toString(36).slice(2, 7);
async function user(n) {
  const r = await j('POST', '/api/auth/verify', null, { privyUserId: `did:privy:fp-${rnd}-${n}`, wallet: '0x' + (rnd + n).split('').map((c) => c.charCodeAt(0).toString(16)).join('').padEnd(40, '0').slice(0, 40) });
  if (r.status !== 200) throw new Error('auth failed ' + JSON.stringify(r.d));
  await j('POST', '/api/dev/claim-starter', r.d.token);
  const s = io(API, { auth: { token: r.d.token }, transports: ['websocket'] });
  await new Promise((res) => s.once('connect', res));
  return { name: n, id: r.d.user.id, token: r.d.token, s };
}
const once = (s, ev, ms = 10000) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout ' + ev)), ms); s.once(ev, (d) => { clearTimeout(t); res(d); }); });

async function weakMove(chess) {
  const moves = chess.moves({ verbose: true });
  if (Math.random() < 0.25) return moves[Math.floor(Math.random() * moves.length)];
  const uci = await best(chess.fen(), 3);
  return moves.find((m) => m.from + m.to + (m.promotion || '') === uci) || moves[0];
}

async function playGame(A, B, styleOf, maxPlies = 160) {
  const fA = once(A.s, 'match_found'), fB = once(B.s, 'match_found');
  A.s.emit('join_queue', { tier: 1, timeControl: '5+0' }); await sleep(200);
  B.s.emit('join_queue', { tier: 1, timeControl: '5+0' });
  const [ma] = await Promise.all([fA, fB]);
  const gid = ma.gameId;
  await Promise.all([once(A.s, 'game_state'), once(B.s, 'game_state'), (A.s.emit('rejoin_game', { gameId: gid }), B.s.emit('rejoin_game', { gameId: gid }))]);
  const white = ma.color === 'white' ? A : B, black = ma.color === 'white' ? B : A;
  const chess = new Chess(); let over = null;
  const onOver = (g) => { over = g; }; A.s.on('game_over', onOver);
  for (let ply = 0; ply < maxPlies && !over; ply++) {
    if (chess.isGameOver()) { await once(A.s, 'game_over', 5000).catch(() => null); over = over || {}; break; }
    const p = chess.turn() === 'w' ? white : black;
    let mv, blurred = false;
    if (styleOf(p) === 'engine') { await sleep(250); mv = await best(chess.fen(), 12); blurred = true;
      mv = chess.moves({ verbose: true }).find((m) => m.from + m.to + (m.promotion || '') === mv) || chess.moves({ verbose: true })[0]; }
    else { await sleep(30 + Math.random() * 500); mv = await weakMove(chess); }
    const made = once(A.s, 'move_made', 8000).catch(() => null);
    p.s.emit('move', { gameId: gid, from: mv.from, to: mv.to, promotion: mv.promotion, blurred });
    chess.move({ from: mv.from, to: mv.to, promotion: mv.promotion });
    if (!(await made)) break;
    await sleep(20);
  }
  if (!over && !chess.isGameOver()) { const g = once(A.s, 'game_over', 8000).catch(() => null); (chess.turn() === 'w' ? white : black).s.emit('resign', { gameId: gid }); await g; }
  A.s.off('game_over', onOver);
  return { gid, plies: chess.history().length };
}

sf.stdin.write('uci\nisready\n'); await sleep(800); sfBuf = '';
const C = await user('cheater'), V = await user('victim'), H1 = await user('honest1'), H2 = await user('honest2');
const style = (p) => (p === C ? 'engine' : 'weak');

// ---- exploit checks (fake draw + spectator resign) on one game
{
  const fA = once(V.s, 'match_found'), fB = once(H1.s, 'match_found');
  V.s.emit('join_queue', { tier: 1, timeControl: '5+0' }); await sleep(200); H1.s.emit('join_queue', { tier: 1, timeControl: '5+0' });
  const [m] = await Promise.all([fA, fB]);
  await Promise.all([once(V.s, 'game_state'), once(H1.s, 'game_state'), (V.s.emit('rejoin_game', { gameId: m.gameId }), H1.s.emit('rejoin_game', { gameId: m.gameId }))]);
  let ended = false; const f = () => { ended = true; }; V.s.on('game_over', f);
  V.s.emit('accept_draw', { gameId: m.gameId }); await sleep(1500);
  ok('EXPLOIT fixed: accept_draw without an offer does nothing', !ended);
  H2.s.emit('spectate', { gameId: m.gameId }); await sleep(300); H2.s.emit('resign', { gameId: m.gameId }); await sleep(1500);
  ok('EXPLOIT fixed: spectator cannot resign for a player', !ended);
  V.s.emit('offer_draw', { gameId: m.gameId }); await sleep(300); H1.s.emit('accept_draw', { gameId: m.gameId }); await sleep(1500);
  ok('real draw still works (offer by one, accept by other)', ended);
  V.s.off('game_over', f);
}

const t0 = Date.now();
for (let g = 0; g < 5; g++) { const r = await playGame(C, V, style); console.log(`  cheater game ${g + 1}: ${r.plies} plies`); }
for (let g = 0; g < 3; g++) { const r = await playGame(H1, H2, style); console.log(`  honest game ${g + 1}: ${r.plies} plies`); }
console.log(`  games played in ${((Date.now() - t0) / 1000).toFixed(0)}s, waiting for analysis…`);
for (let i = 0; i < 120; i++) { const r = await j('GET', '/api/admin/fairplay?status=all', null, null, true); if (r.d?.pendingAnalysis === 0) break; await sleep(2000); }

const ev = async (u) => (await j('GET', `/api/admin/fairplay/${u.id}`, null, null, true)).d;
const ec = await ev(C), evv = await ev(V), e1 = await ev(H1), e2 = await ev(H2);
const fmt = (e) => `[${(e.user.fairplay_reasons || []).join('; ')}]\n      ` + e.games.map((g) => `s${g.suspicion}/nb${g.engine_match}%/acpl${g.acpl}/blur${Math.round(g.blur_rate * 100)}%/n${g.analysed_moves}`).join('  ');
console.log('  cheater :', ec.user.fairplay_status, ec.user.fairplay_score, fmt(ec));
console.log('  victim  :', evv.user.fairplay_status, evv.user.fairplay_score, fmt(evv));
console.log('  honest1 :', e1.user.fairplay_status, e1.user.fairplay_score, fmt(e1));
console.log('  honest2 :', e2.user.fairplay_status, e2.user.fairplay_score, fmt(e2));
ok('every game analysed by Stockfish', ec.games.length >= 5 && e1.games.length >= 3, `${ec.games.length} cheater, ${e1.games.length} honest`);
ok('cheater moved to REVIEW', ec.user.fairplay_status === 'review', `${ec.user.fairplay_status} score ${ec.user.fairplay_score}`);
ok('victim NOT flagged', evv.user.fairplay_status === 'clean', evv.user.fairplay_status);
ok('honest players NOT flagged', e1.user.fairplay_status === 'clean' && e2.user.fairplay_status === 'clean', `${e1.user.fairplay_status}/${e2.user.fairplay_status}`);

const w = await j('POST', '/api/wallet/withdraw', C.token, { amount: 1, toAddress: '0x' + '2'.repeat(40) });
ok('cheater withdrawal blocked (fair-play review)', w.status === 403 && /review/i.test(w.d?.error || ''), `${w.status} ${w.d?.error}`);
const wv = await j('POST', '/api/wallet/withdraw', V.token, { amount: 1, toAddress: '0x' + '3'.repeat(40) });
ok('new account withdrawal held (min games / 72h)', wv.status === 403, `${wv.status} ${wv.d?.error}`);

const bal = async (u) => (await j('GET', '/api/wallet/balance', u.token)).d?.balance;
const [cb, vb] = [await bal(C), await bal(V)];
const conf = await j('POST', `/api/admin/fairplay/${C.id}/confirm`, null, { days: 30 }, true);
const [ca, va] = [await bal(C), await bal(V)];
ok('admin confirm: ban + refund victim + claw back', conf.status === 200 && va > vb && ca < cb,
  `victim $${vb} -> $${va}, cheater $${cb} -> $${ca}, ${JSON.stringify(conf.d?.summary)}`);
const relog = await j('POST', '/api/auth/verify', null, { privyUserId: `did:privy:fp-${rnd}-cheater`, wallet: '0x' + rnd.split('').map((c) => c.charCodeAt(0).toString(16)).join('').padEnd(40, 'a').slice(0, 40) });
ok('banned cheater cannot log in again', relog.status === 403, `${relog.status} ${relog.d?.error}`);

[C, V, H1, H2].forEach((u) => u.s.close()); sf.kill();
console.log(`\n${out.filter((r) => r[0] === 'PASS').length}/${out.length} passed`);
process.exit(0);
