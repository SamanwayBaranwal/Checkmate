'use client';

import { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';

type Tab = 'basics' | 'openings' | 'tactics' | 'endgames';

// ─── Static content ────────────────────────────────────────────────────────

const PIECES = [
  { symbol: '♙', name: 'Pawn', value: 1, move: 'Moves 1 square forward (2 from start). Captures diagonally. Promotes on reaching the 8th rank.' },
  { symbol: '♘', name: 'Knight', value: 3, move: 'Moves in an L-shape: 2 squares in one direction then 1 perpendicular. The only piece that jumps over others.' },
  { symbol: '♗', name: 'Bishop', value: 3, move: 'Slides diagonally any number of squares. Each bishop is locked to its starting color.' },
  { symbol: '♖', name: 'Rook', value: 5, move: 'Slides horizontally or vertically any number of squares. Powerful in open files and ranks.' },
  { symbol: '♕', name: 'Queen', value: 9, move: 'Combines rook and bishop. The most powerful piece — handle with care early.' },
  { symbol: '♔', name: 'King', value: '∞', move: 'Moves one square in any direction. Castling moves the king two squares toward a rook.' },
];

const OPENINGS = [
  {
    name: "King's Pawn — e4 e5",
    fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2',
    orientation: 'white' as const,
    idea: 'The most classical opening. Both sides fight for the center immediately. White will develop Nf3 and Bc4 or d4 to contest the e5 pawn.',
    moves: '1. e4 e5',
  },
  {
    name: 'Sicilian Defense',
    fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2',
    orientation: 'black' as const,
    idea: "Black counters e4 with c5 — the most popular response. Black avoids symmetry and fights back asymmetrically, creating imbalances.",
    moves: '1. e4 c5',
  },
  {
    name: "Queen's Gambit",
    fen: 'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq c3 0 2',
    orientation: 'white' as const,
    idea: 'White offers a pawn to gain central control. If Black takes (accepted), White regains the pawn easily. If declined, a solid positional battle ensues.',
    moves: '1. d4 d5 2. c4',
  },
  {
    name: "French Defense",
    fen: 'rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq d3 0 2',
    orientation: 'black' as const,
    idea: 'Black builds a solid pawn chain with e6 and d5. The light-squared bishop is often a weakness, but Black gets a sound structure to counterattack.',
    moves: '1. e4 e6 2. d4 d5',
  },
  {
    name: "London System",
    fen: 'rnbqkbnr/pppppppp/8/8/3P4/5N2/PPP1PPPP/RNBQKB1R b KQkq - 1 2',
    orientation: 'white' as const,
    idea: "A solid, reliable system for White. Develop Nf3, Bf4, e3, and Bd3. Easy to learn, hard to refute — popular at all levels.",
    moves: '1. d4 2. Nf3',
  },
  {
    name: "Ruy López",
    fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
    orientation: 'white' as const,
    idea: "One of the oldest and most analyzed openings. White pins Black's knight (which defends e5) and prepares to fight for central control.",
    moves: '1. e4 e5 2. Nf3 Nc6 3. Bb5',
  },
];

const TACTICS = [
  {
    name: 'Fork',
    fen: '4k3/8/8/3N4/8/8/8/4K3 w - - 0 1',
    orientation: 'white' as const,
    desc: 'A fork attacks two (or more) pieces at once. Knights are the best forkers — they attack in a shape no other piece covers.',
    tip: 'Look for squares where your knight attacks the king and another valuable piece simultaneously.',
  },
  {
    name: 'Pin',
    fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 4 5',
    orientation: 'white' as const,
    desc: 'A pin restricts a piece because moving it would expose a more valuable piece behind it. Absolute pins (king behind) mean the pinned piece cannot legally move.',
    tip: 'Bishops and rooks create powerful pins along diagonals and ranks/files.',
  },
  {
    name: 'Skewer',
    fen: '4k3/4r3/8/8/8/8/4R3/4K3 w - - 0 1',
    orientation: 'white' as const,
    desc: 'The opposite of a pin — you attack a valuable piece, and when it moves, you win the piece behind it.',
    tip: 'Rooks and queens on open files or ranks frequently create skewers.',
  },
  {
    name: 'Discovered Attack',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 4 5',
    orientation: 'white' as const,
    desc: 'Moving one piece reveals an attack from the piece behind it. A discovered check is especially powerful — the opponent must respond to the check, ignoring the other threat.',
    tip: 'When you move a piece and it reveals a rook, bishop, or queen attack, that is a discovered attack.',
  },
  {
    name: 'Back Rank Mate',
    fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
    orientation: 'white' as const,
    desc: "If your opponent's king is trapped behind its own pawns on the back rank, a rook or queen can deliver checkmate instantly.",
    tip: 'Create a "luft" (h3/g3) early to give your king a escape square.',
  },
  {
    name: "Zwischenzug (In-between move)",
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
    orientation: 'white' as const,
    desc: 'Instead of the expected recapture, you play a stronger intermediate move first. This can completely change the evaluation of an exchange.',
    tip: 'Before automatically recapturing, always ask: "Is there a check, capture, or threat I can play first?"',
  },
];

const ENDGAMES = [
  {
    name: 'King Activity',
    fen: '8/8/8/3k4/8/3K4/8/8 w - - 0 1',
    orientation: 'white' as const,
    desc: 'In the endgame the king becomes a fighting piece. Centralize it immediately — a king on d4 or e5 dominates one on the edge.',
    tip: 'Opposition: when kings face each other with one square between them, the side NOT to move has the opposition (advantage).',
  },
  {
    name: 'Passed Pawn',
    fen: '8/8/8/8/3P4/8/8/8 w - - 0 1',
    orientation: 'white' as const,
    desc: 'A passed pawn — one with no enemy pawns in front or on adjacent files — is a winning advantage in endgames. Escort it with your king.',
    tip: 'The "rule of the square": if the king can step inside the pawn\'s promotion square diagonally, it catches the pawn.',
  },
  {
    name: 'Rook + King vs King',
    fen: '8/8/8/3k4/8/8/8/R3K3 w - - 0 1',
    orientation: 'white' as const,
    desc: 'Basic K+R vs K is always a win. Use the "box method": cut the enemy king to smaller and smaller regions with your rook, then deliver checkmate on the edge.',
    tip: 'Keep the rook on a rank/file to cut the king. When the enemy king moves to the edge, bring your king in to assist the mating attack.',
  },
  {
    name: 'Pawn Endgame — Key Squares',
    fen: '8/8/8/8/3P4/3K4/8/3k4 w - - 0 1',
    orientation: 'white' as const,
    desc: 'For a center/knight pawn, the "key squares" are two ranks ahead. If your king reaches one, the pawn promotes regardless of where the opposing king is.',
    tip: 'Centralize your king before pushing the pawn. Active king + passed pawn = winning endgame formula.',
  },
];

// ─── Component ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'checkmate_learn_completed';

function getCompleted(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

function markCompleted(key: string) {
  const set = getCompleted();
  set.add(key);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

const TAB_LABELS: Record<Tab, string> = {
  basics: '♟ Basics',
  openings: '📖 Openings',
  tactics: '⚔️ Tactics',
  endgames: '🏁 Endgames',
};

export default function LearnPage() {
  const [tab, setTab] = useState<Tab>('basics');
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    setCompleted(getCompleted());
  }, []);

  useEffect(() => {
    setSelected(0);
  }, [tab]);

  const complete = (key: string) => {
    markCompleted(key);
    setCompleted((prev) => new Set([...prev, key]));
  };

  const items = tab === 'openings' ? OPENINGS : tab === 'tactics' ? TACTICS : ENDGAMES;
  const totalLessons = OPENINGS.length + TACTICS.length + ENDGAMES.length;
  const doneCount = OPENINGS.filter((o) => completed.has(`opening_${o.name}`)).length
    + TACTICS.filter((t) => completed.has(`tactic_${t.name}`)).length
    + ENDGAMES.filter((e) => completed.has(`endgame_${e.name}`)).length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Learn Chess</h1>
          <p className="text-white/50 text-sm mt-1">Master the fundamentals before you bet.</p>
        </div>
        <div className="card text-center px-4 py-2">
          <div className="text-xl font-bold text-[#46a883]">{doneCount}/{totalLessons}</div>
          <div className="text-xs text-white/40">Lessons done</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-white/10 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#46a883] to-[#f0b232] rounded-full transition-all"
          style={{ width: `${totalLessons > 0 ? (doneCount / totalLessons) * 100 : 0}%` }}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${tab === t ? 'bg-[#f0b232] text-black' : 'btn-secondary'}`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Basics tab */}
      {tab === 'basics' && (
        <div className="space-y-6">
          {/* Ash tip */}
          <div className="card border border-[#f0b232]/30 bg-[#f0b232]/5 flex gap-4 items-start">
            <div className="text-4xl shrink-0">🤖</div>
            <div>
              <p className="font-bold text-[#f0b232] mb-1">Ash says:</p>
              <p className="text-sm text-white/70">
                Every chess piece has a job. Learn their moves and values first — then you'll know when a trade is worth it.
                Material counts, but activity matters more. A well-placed knight beats a sleeping rook!
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PIECES.map((p) => (
              <div key={p.name} className="card flex gap-4 items-start">
                <div className="text-4xl shrink-0 leading-none">{p.symbol}</div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold">{p.name}</span>
                    <span className="text-xs text-[#f0b232] bg-[#f0b232]/10 border border-[#f0b232]/20 px-1.5 py-0.5 rounded-full">
                      {p.value} {p.value !== '∞' ? 'pt' : ''}
                    </span>
                  </div>
                  <p className="text-sm text-white/60">{p.move}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="card border border-white/10">
            <h3 className="font-bold mb-3">Key Principles</h3>
            <div className="space-y-3">
              {[
                { icon: '1️⃣', tip: 'Control the center — place pawns on e4/d4 or fight for those squares with pieces.' },
                { icon: '2️⃣', tip: "Develop your pieces — don't move the same piece twice in the opening. Knights before bishops." },
                { icon: '3️⃣', tip: "Castle early — your king is safest behind pawns. Connect your rooks." },
                { icon: '4️⃣', tip: "Don't bring your queen out too early — it can be chased and you'll waste moves." },
                { icon: '5️⃣', tip: "Every move should have a purpose — threat, development, king safety, or pawn structure." },
              ].map((p) => (
                <div key={p.icon} className="flex gap-3 text-sm text-white/70">
                  <span className="shrink-0">{p.icon}</span>
                  <p>{p.tip}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Board-based tabs (openings, tactics, endgames) */}
      {tab !== 'basics' && (
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
          {/* Sidebar list */}
          <div className="space-y-1">
            {items.map((item, i) => {
              const key = `${tab}_${item.name}`;
              const done = completed.has(key);
              return (
                <button
                  key={item.name}
                  onClick={() => setSelected(i)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition flex items-center gap-2 ${
                    i === selected ? 'bg-[#f0b232]/20 text-[#f0b232] border border-[#f0b232]/30' : 'hover:bg-white/5 text-white/70'
                  }`}
                >
                  {done ? (
                    <span className="text-[#46a883] shrink-0">✓</span>
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-white/20 shrink-0 inline-block" />
                  )}
                  {item.name}
                </button>
              );
            })}
          </div>

          {/* Main content */}
          {(() => {
            const item = items[selected];
            const key = `${tab}_${item.name}`;
            const done = completed.has(key);
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-xl font-bold">{item.name}</h2>
                  {done && (
                    <span className="text-xs text-[#46a883] bg-[#46a883]/10 border border-[#46a883]/30 px-2 py-0.5 rounded-full">
                      ✓ Completed
                    </span>
                  )}
                </div>

                {/* Board */}
                <div className="rounded-xl overflow-hidden border border-white/10" style={{ maxWidth: 420 }}>
                  <Chessboard
                    position={item.fen}
                    boardOrientation={item.orientation}
                    arePiecesDraggable={false}
                    customBoardStyle={{ borderRadius: 0 }}
                  />
                </div>

                {/* Description */}
                <div className="card border border-white/10 space-y-3">
                  {'moves' in item && (
                    <div className="font-mono text-sm text-[#f0b232] bg-[#f0b232]/5 border border-[#f0b232]/20 px-3 py-1.5 rounded-lg inline-block">
                      {item.moves}
                    </div>
                  )}
                  <p className="text-sm text-white/70 leading-relaxed">{'idea' in item ? item.idea : item.desc}</p>
                  {'tip' in item && (
                    <div className="flex gap-3 bg-white/5 rounded-lg p-3">
                      <span className="text-lg shrink-0">💡</span>
                      <p className="text-sm text-white/60">{item.tip}</p>
                    </div>
                  )}
                </div>

                {/* Ash mascot tip */}
                <div className="card border border-[#f0b232]/20 bg-[#f0b232]/5 flex gap-3 items-start">
                  <span className="text-2xl shrink-0">🤖</span>
                  <div>
                    <p className="text-xs font-bold text-[#f0b232] mb-1">Ash says:</p>
                    <p className="text-xs text-white/60">
                      {tab === 'openings' && 'Study one opening system deeply rather than dabbling in many. Consistency builds pattern recognition faster.'}
                      {tab === 'tactics' && 'Tactics are the vocabulary of chess. Drill puzzles daily — even 5 minutes before a game sharpens your eye.'}
                      {tab === 'endgames' && 'Most beginners skip endgame study. Don\'t. Converting a winning endgame is where games are actually won.'}
                    </p>
                  </div>
                </div>

                {!done && (
                  <button onClick={() => complete(key)} className="btn-primary text-sm">
                    ✓ Mark as Learned
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
