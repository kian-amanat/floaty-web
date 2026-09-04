/* ---------------------------------------------------------------------------
   Gooey cards — parity check against the web original.

   The React Native port and reference/pxdx-gooey-cards/app.js are meant to be
   the same simulation. This steps both at a fixed 1/60 for the whole 11.3s loop
   and fails if they drift apart: the original runs in a vm with just enough of
   a DOM stub to reach its internals, the port through its own step().

   The port has no scripted path of its own — a finger drives it — so the
   original's PATH is read back out of the vm and replayed into step() as if it
   were the pointer. That is exactly what the original is doing to itself, so
   the two stay comparable.

   The delta counter is compared as a fraction of its own target rather than by
   value. The two happen to agree at the moment, but the original hardcodes its
   figure per card where the port moves a real amount between the cards, so the
   normalised form is what actually holds the easing to the original.

       node scripts/gooey-parity.mjs

   Run it after touching anything in src/gooey.
--------------------------------------------------------------------------- */

import { createRequire } from 'module';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* the port is TypeScript, so build the three modules somewhere disposable */
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'gooey-parity-'));
execFileSync('npx', ['tsc',
  path.join(ROOT, 'src/gooey/step.ts'),
  path.join(ROOT, 'src/gooey/constants.ts'),
  path.join(ROOT, 'src/gooey/sim.ts'),
  '--ignoreConfig', '--outDir', OUT,
  '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck',
], { cwd: ROOT, stdio: 'inherit' });
const { step, initialState } = require(path.join(OUT, 'step.js'));

/* Replaying the original's own path is a thing only this check does, so the
   sampler lives here rather than in the app. */
const lerp = (a, b, t) => a + (b - a) * t;
function samplePath(pathKeys, t, loop) {
  const now = ((t % loop) + loop) % loop;
  for (let i = pathKeys.length - 1; i >= 0; i--) {
    if (now < pathKeys[i].t) continue;
    const a = pathKeys[i];
    const b = pathKeys[i + 1];
    if (a.x === null || a.y === null) return null;
    if (!b || b.x === null || b.y === null || b.t === a.t) return { x: a.x, y: a.y };
    const u = (now - a.t) / (b.t - a.t);
    return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) };
  }
  return null;
}

const ORIG = path.join(ROOT, 'reference/pxdx-gooey-cards/app.js');
let src = fs.readFileSync(ORIG, 'utf8');
src += '\nglobalThis.__probe = () => ({ ball, cards, awake, PATH, LOOP });\n';

const CENTRES = [[208, 407], [465, 407]];
const stub = (i = 0) => ({
  _i: i,
  style: { setProperty() {} },
  classList: { toggle() {} },
  addEventListener() {},
  querySelector: () => stub(i),
  offsetWidth: 30,                 // '-56' measured -> chipWide = 40
  textContent: '',
});
const cardEls = [stub(0), stub(1)];
const stage = {
  ...stub(0),
  querySelectorAll: (sel) => (sel === '.card' ? cardEls : [stub(0)]),
  querySelector: (sel) => {
    const m = /data-card="(\d)"/.exec(sel);
    return stub(m ? +m[1] : 0);
  },
  getBoundingClientRect: () => ({ left: 0, top: 0 }),
  addEventListener() {},
  style: { setProperty() {} },
  classList: { toggle() {} },
};
let rafCb = null;
const ctx = {
  document: {
    getElementById: (id) => (id === 'stage' ? stage : stub(0)),
    addEventListener() {},
    hidden: false,
  },
  window: { innerWidth: 1200, innerHeight: 900, addEventListener() {} },
  performance: { now: () => 0 },
  requestAnimationFrame: (cb) => { rafCb = cb; return 1; },
  /* keyed off the element, not call order, so the two cards cannot swap */
  getComputedStyle: (el) => ({
    getPropertyValue: (p) => {
      const c = CENTRES[el._i ?? 0];
      return (p.trim() === '--cx' ? c[0] : c[1]) + 'px';
    },
  }),
  Math, console,
};
vm.createContext(ctx);
ctx.globalThis = ctx;
new vm.Script(src, { filename: 'app.js' }).runInContext(ctx);

const probe = ctx.__probe;
if (!probe) { console.error('could not reach the original internals'); process.exit(1); }
const chk = probe();
console.log('stub sanity — card centres the original parsed:',
  JSON.stringify(chk.cards.map(c => [c.cx, c.cy])),
  ' chipWide:', JSON.stringify(chk.cards.map(c => c.chipWide)));

const { PATH, LOOP } = probe();
const { TRANSFER: MINE_TARGET0 } = require(path.join(OUT, 'constants.js'));
console.log(`counter targets — original ${Math.abs(chk.cards[0].spec.delta)}, port ${MINE_TARGET0}` +
  ' (compared as a fraction of each)');
const DT = 1 / 60;
const mine = initialState();
let mineT = 0;
let now = 0;
const rows = [];
const N = Math.round(11.3 / DT);
const maxErr = { ball: 0, scale: 0, awake: 0, push1: 0, count0: 0, reveal: 0 };
const seriesO = [], seriesM = [];

for (let i = 0; i < N; i++) {
  now += DT * 1000;
  ctx.performance.now = () => now;
  const cb = rafCb; rafCb = null;
  if (cb) cb(now);
  /* the original advances its playhead then samples; do the same, then hand
     the result to step() as the pointer */
  mineT += DT;
  step(mine, DT, samplePath(PATH, mineT, LOOP));

  const o = probe();
  const t = (i + 1) * DT;
  seriesO.push({ x: o.ball.x, s: o.ball.scale, a: o.awake });
  seriesM.push({ x: mine.ballX, s: mine.ballScale, a: mine.awake });
  const e = {
    ball: Math.hypot(o.ball.x - mine.ballX, o.ball.y - mine.ballY),
    scale: Math.abs(o.ball.scale - mine.ballScale),
    awake: Math.abs(o.awake - mine.awake),
    push1: Math.abs(o.cards[1].pushX - mine.pushX[1]),
    /* as a fraction of each one's own target — the magnitudes differ by design */
    count0: Math.abs(
      o.cards[0].count / Math.abs(o.cards[0].spec.delta) -
      mine.count[0] / MINE_TARGET0),
    reveal: Math.abs(o.ball.reveal - mine.reveal),
  };
  for (const k of Object.keys(maxErr)) if (e[k] > maxErr[k]) maxErr[k] = e[k];

  if (Math.abs(t * 2 - Math.round(t * 2)) < 1e-9) {
    rows.push([+t.toFixed(1), +o.ball.x.toFixed(2), +mine.ballX.toFixed(2),
      +o.cards[1].pushX.toFixed(2), +mine.pushX[1].toFixed(2),
      +(o.cards[0].count / Math.abs(o.cards[0].spec.delta)).toFixed(3),
      +(mine.count[0] / MINE_TARGET0).toFixed(3)]);
  }
}

console.log('\nt     origBallX  mineBallX | origPush1  minePush1 | origCnt0% mineCnt0%');
for (const r of rows) {
  console.log(String(r[0]).padEnd(5), String(r[1]).padEnd(10), String(r[2]).padEnd(10),
    '|', String(r[3]).padEnd(10), String(r[4]).padEnd(9),
    '|', String(r[5]).padEnd(9), r[6]);
}
console.log('\nmax abs divergence over the full 11.3s loop @1/60:');
for (const [k, v] of Object.entries(maxErr)) console.log(`  ${k.padEnd(8)}: ${v.toExponential(3)}`);

fs.rmSync(OUT, { recursive: true, force: true });

/* Generous next to what actually comes out (~0.15px on a 672px stage) but
   tight enough that a changed constant or a dropped term cannot slip past. */
const LIMIT = { ball: 1, scale: 0.2, awake: 0.1, push1: 0.5, count0: 0.01, reveal: 0.05 };
const bad = Object.entries(maxErr).filter(([k, v]) => v > LIMIT[k]);
if (bad.length) {
  console.error('\nFAIL — the port has drifted from the original:');
  for (const [k, v] of bad) console.error(`  ${k}: ${v.toExponential(3)} > ${LIMIT[k]}`);
  process.exit(1);
}
console.log('\nPASS — port and original agree across the loop.');
