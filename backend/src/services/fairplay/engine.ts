import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

/**
 * Minimal UCI client for a local Stockfish binary (GPL engine, run as a separate program).
 * STOCKFISH_PATH can point at the binary; default is `stockfish` on the PATH.
 * One engine process, one request at a time (the analysis queue is sequential).
 */
export interface EngineEval {
  bestMove: string | null; // UCI, e.g. "e2e4"
  cp: number;              // score in centipawns from the side to move (mates mapped to ±10000)
}

const PATH = process.env.STOCKFISH_PATH || 'stockfish';

class Engine {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private buf = '';
  private waiters: Array<{ match: (l: string) => boolean; resolve: (l: string) => void }> = [];
  private lines: string[] = [];

  async start(): Promise<void> {
    if (this.proc) return;
    const p = spawn(PATH, [], { stdio: 'pipe' });
    this.proc = p;
    p.stdout.on('data', (d) => {
      this.buf += d.toString();
      let i;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).trim();
        this.buf = this.buf.slice(i + 1);
        this.lines.push(line);
        if (this.lines.length > 200) this.lines.shift();
        const w = this.waiters.findIndex((x) => x.match(line));
        if (w >= 0) this.waiters.splice(w, 1)[0].resolve(line);
      }
    });
    p.stdin.on('error', () => {}); // binary missing / crashed: never take the server down
    p.on('exit', () => { this.proc = null; });
    p.on('error', () => { this.proc = null; });
    this.send('uci');
    await this.waitFor((l) => l === 'uciok', 5000);
    this.send(`setoption name Threads value ${process.env.FAIRPLAY_THREADS || 1}`);
    this.send('setoption name Hash value 64');
    this.send('isready');
    await this.waitFor((l) => l === 'readyok', 5000);
  }

  private send(cmd: string) { this.proc?.stdin.write(cmd + '\n'); }

  private waitFor(match: (l: string) => boolean, ms: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('engine timeout')), ms);
      this.waiters.push({ match, resolve: (l) => { clearTimeout(t); resolve(l); } });
    });
  }

  async evaluate(fen: string, depth: number): Promise<EngineEval> {
    await this.start();
    this.lines = [];
    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth}`);
    const best = await this.waitFor((l) => l.startsWith('bestmove'), 30000);
    let cp = 0;
    for (let k = this.lines.length - 1; k >= 0; k--) {
      const l = this.lines[k];
      if (!l.startsWith('info') || !l.includes(' score ')) continue;
      const m = l.match(/score (cp|mate) (-?\d+)/);
      if (m) { cp = m[1] === 'cp' ? parseInt(m[2]) : (parseInt(m[2]) > 0 ? 10000 : -10000); break; }
    }
    const bm = best.split(' ')[1];
    return { bestMove: bm && bm !== '(none)' ? bm : null, cp };
  }

  stop() { this.send('quit'); this.proc = null; }
}

export const engine = new Engine();

export async function engineAvailable(): Promise<boolean> {
  try { await engine.start(); return true; } catch { return false; }
}
