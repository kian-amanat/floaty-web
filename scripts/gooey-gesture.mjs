/* ---------------------------------------------------------------------------
   Gooey cards — gesture behaviour.

   The piece is driven by a finger and nothing else, so these drive step() with
   synthetic gestures and assert the properties that distinguish an interaction
   from a timeline: the same gesture path gives the same state whatever speed it
   was travelled at, a finger that stops leaves the state where it stopped, and
   a finger that goes back drags it back.

       node scripts/gooey-gesture.mjs
--------------------------------------------------------------------------- */

import { createRequire } from 'module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'gooey-gesture-'));
execFileSync('npx', ['tsc',
  path.join(ROOT, 'src/gooey/step.ts'),
  path.join(ROOT, 'src/gooey/constants.ts'),
  path.join(ROOT, 'src/gooey/sim.ts'),
  '--ignoreConfig', '--outDir', OUT,
  '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck',
], { cwd: ROOT, stdio: 'inherit' });
const { step, initialState } = require(path.join(OUT, 'step.js'));
const { CARDS, TRANSFER, ABSORB } = require(path.join(OUT, 'constants.js'));

const DT = 1 / 60;
const C0 = CARDS[0], C1 = CARDS[1];

/* the screen's own rule: a landed throw finishes the piece regardless of the
   finger; short of that, lifting off settles onto the card the gesture took */
const held = (s, on, x, y) => {
  if (s.done) return null;
  if (on) return { x, y };
  return s.active >= 0 ? { x: CARDS[s.active].cx, y: CARDS[s.active].cy } : null;
};

/** hold at one point for `secs` */
function hold(s, x, y, secs, on = true) {
  for (let i = 0; i < Math.round(secs / DT); i++) step(s, DT, held(s, on, x, y));
  return s;
}
/** Hold until it stops moving. The easing is an exponential approach, so it
 *  converges on the finger rather than snapping to it — "stopped" means the
 *  per-frame movement has fallen away, not that some deadline passed. */
function settle(s, x, y, on = true, max = 20) {
  for (let i = 0; i < Math.round(max / DT); i++) {
    const was = s.ballX, wasS = s.ballScale, wasA = s.awake, wasP = s.pill[0] + s.pill[1];
    step(s, DT, held(s, on, x, y));
    const d = Math.abs(s.ballX - was) + Math.abs(s.ballScale - wasS) +
              Math.abs(s.awake - wasA) + Math.abs(s.pill[0] + s.pill[1] - wasP);
    if (d < 1e-6) return (i + 1) * DT;
  }
  return null;   // never came to rest
}
/** drag in a straight line over `secs` — the gesture's speed is secs */
function drag(s, from, to, secs) {
  const n = Math.round(secs / DT);
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    const p = { x: from[0] + (to[0] - from[0]) * u, y: from[1] + (to[1] - from[1]) * u };
    step(s, DT, s.done ? null : p);
  }
  return s;
}
const snap = (s) => ({
  ballX: +s.ballX.toFixed(2), scale: +s.ballScale.toFixed(3), awake: +s.awake.toFixed(3),
  pill0: +s.pill[0].toFixed(3), pill1: +s.pill[1].toFixed(3),
  cnt0: Math.round(s.count[0]), cnt1: Math.round(s.count[1]), active: s.active,
  values: [s.values[0], s.values[1]], holder: s.holder, done: s.done,
});

let failures = 0;
const ok = (name, cond, detail = '') => {
  console.log(`${cond ? '  pass' : '  FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!cond) failures++;
};

// 1 -------------------------------------------------------------------------
console.log('\n1. nothing moves on its own');
{
  const s = initialState();
  const before = JSON.stringify(snap(s));
  for (let i = 0; i < Math.round(5 / DT); i++) step(s, DT, null);
  ok('5s with no pointer leaves the resting state untouched',
    JSON.stringify(snap(s)) === before, before);
  ok('both avatars still perfectly circular (awake 0)', s.awake === 0);
  ok('no blob (scale 0)', s.ballScale === 0);
  ok('no pill', s.pill[0] === 0 && s.pill[1] === 0);
}

// 2 -------------------------------------------------------------------------
console.log('\n2. a finger that stops leaves the state where it stopped');
{
  const s = initialState();
  drag(s, [C0.cx, C0.cy], [288, 407], 0.5);
  const t = settle(s, 288, 407);
  ok('comes to rest while the finger is still', t !== null,
    t === null ? 'still moving' : `after ${t.toFixed(2)}s`);
  const a = snap(s);
  hold(s, 288, 407, 3.0);
  ok('and then holds that state', JSON.stringify(a) === JSON.stringify(snap(s)),
    JSON.stringify(a));
  ok('rests on the finger, not drifting past it',
    Math.abs(s.ballX - 288) < 0.5, `ballX ${s.ballX.toFixed(2)}`);
}

// 3 -------------------------------------------------------------------------
console.log('\n3. speed of the gesture does not change where it ends up');
{
  const slow = initialState(); drag(slow, [C0.cx, C0.cy], [300, 407], 3.0); settle(slow, 300, 407);
  const fast = initialState(); drag(fast, [C0.cx, C0.cy], [300, 407], 0.15); settle(fast, 300, 407);
  const a = snap(slow), b = snap(fast);
  ok('a 3s drag and a 0.15s drag to the same point rest identically',
    JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  /* the point of the whole exercise: where it ends up is the finger's
     position, never how long the gesture took */
  ok('and that rest point is the finger', Math.abs(slow.ballX - 300) < 0.5);
}

// 4 -------------------------------------------------------------------------
console.log('\n4. going back drags the state back');
{
  const s = initialState();
  drag(s, [C0.cx, C0.cy], [300, 407], 0.6); settle(s, 300, 407);
  const out = s.ballX;
  drag(s, [300, 407], [C0.cx, C0.cy], 0.6); settle(s, C0.cx, C0.cy);
  ok('blob follows the finger back in', s.ballX < out - 50,
    `${out.toFixed(1)} -> ${s.ballX.toFixed(1)}`);
  ok('and lands back on the avatar centre', Math.abs(s.ballX - C0.cx) < 0.5,
    `ballX ${s.ballX.toFixed(2)}`);
}

// 5 -------------------------------------------------------------------------
console.log('\n5. one continuous object crosses to the second avatar');
{
  const s = initialState();
  drag(s, [C0.cx, C0.cy], [300, 407], 0.5); hold(s, 300, 407, 1.0);
  let maxJump = 0, prev = s.ballX;
  const between = new Set();
  const n = Math.round(0.9 / DT);
  for (let i = 1; i <= n; i++) {
    step(s, DT, { x: 300 + (C1.cx - 300) * (i / n), y: 407 });
    maxJump = Math.max(maxJump, Math.abs(s.ballX - prev));
    prev = s.ballX;
    if (s.ballX > 280 && s.ballX < 400) between.add(1);
    ok.lastScale = s.ballScale;
  }
  hold(s, C1.cx, C1.cy, 2.5);
  ok('blob travelled through the gap rather than jumping', between.size === 1);
  ok('no teleport — largest single-frame move stays small',
    maxJump < 12, `max ${maxJump.toFixed(2)}px/frame`);
  ok('it stayed one object the whole way (never re-formed from nothing)',
    ok.lastScale > 0.5, `min scale in flight ${(+ok.lastScale).toFixed(3)}`);
  ok('second avatar is now the active one', s.active === 1);
  /* what the arrival does to the pills and the amounts is 5c and 5d's job */
  ok('the throw landed', s.done === true);
}

// 5c ------------------------------------------------------------------------
console.log('\n5c. the amount moves with the throw, whichever way it goes');
{
  const open = [CARDS[0].value, CARDS[1].value];
  const s = initialState();
  ok('opens holding what the cards were given', 
    s.values[0] === open[0] && s.values[1] === open[1], `${s.values}`);

  /* left -> right, then let it land: the bubble trails the finger, so the
     hand-over is on its arrival rather than on the finger getting there */
  drag(s, [C0.cx, C0.cy], [C0.cx, C0.cy], 0.2);
  drag(s, [C0.cx, C0.cy], [C1.cx, C1.cy], 0.9); settle(s, C1.cx, C1.cy);
  ok('thrower went down, receiver went up',
    s.values[0] === open[0] - TRANSFER && s.values[1] === open[1] + TRANSFER,
    `${open} -> ${s.values}`);
  ok('nothing was created or destroyed',
    s.values[0] + s.values[1] === open[0] + open[1]);

  /* and back the other way — the roles are the gesture's, not the side's */
  const mid = [s.values[0], s.values[1]];
  settle(s, 0, 0, false);            // finish, finger up
  const back = initialState();
  back.values = [mid[0], mid[1]];
  drag(back, [C1.cx, C1.cy], [C1.cx, C1.cy], 0.2);
  drag(back, [C1.cx, C1.cy], [C0.cx, C0.cy], 0.9); settle(back, C0.cx, C0.cy);
  ok('throwing back reverses who loses and who gains',
    back.values[0] === mid[0] + TRANSFER && back.values[1] === mid[1] - TRANSFER,
    `${mid} -> ${back.values}`);
  ok('so neither side is fixed as the loser',
    open[0] > s.values[0] && back.values[0] > s.values[0]);
}

// 5c2 -----------------------------------------------------------------------
console.log('\n5c2. the throw is not cut short at the midpoint');
{
  const MID = (C0.cx + C1.cx) / 2;
  const s = initialState();
  drag(s, [C0.cx, C0.cy], [C0.cx, C0.cy], 0.2); settle(s, C0.cx, C0.cy);

  /* carry it across slowly, watching the crossing itself */
  let cutAt = null, sawPastMid = false;
  const n = Math.round(1.4 / DT);
  for (let i = 1; i <= n; i++) {
    const x = C0.cx + (C1.cx - C0.cx) * (i / n);
    step(s, DT, s.done ? null : { x, y: 407 });
    if (s.ballX > MID) sawPastMid = true;
    if (s.done && cutAt === null) cutAt = s.ballX;
  }
  ok('the bubble gets past the midpoint at all', sawPastMid,
    `furthest ${s.ballX.toFixed(0)}, midpoint ${MID.toFixed(0)}`);
  ok('nothing completed while it was still in the air',
    cutAt === null || cutAt > C1.cx - ABSORB - 1,
    cutAt === null ? 'nothing completed early' : `completed at x ${cutAt.toFixed(0)}`);
  /* let go over the far card — it has to carry the rest of the way in */
  settle(s, 0, 0, false);
  ok('it arrives and hands over', s.done === true && s.holder === 1,
    `holder ${s.holder}`);
  ok('and the amounts moved', s.values[1] === CARDS[1].value + TRANSFER,
    `${s.values}`);
}

// 5c3 -----------------------------------------------------------------------
console.log('\n5c3. aiming at the far card without carrying it there does nothing');
{
  const s = initialState();
  drag(s, [C0.cx, C0.cy], [C0.cx, C0.cy], 0.2); settle(s, C0.cx, C0.cy);
  /* stop just inside the far card's reach — the finger is there, the bubble is
     not, so there is no transfer */
  drag(s, [C0.cx, C0.cy], [C1.cx - 120, 407], 0.8); settle(s, C1.cx - 120, 407);
  ok('no hand-over from aim alone', s.done === false && s.holder === 0,
    `holder ${s.holder}, done ${s.done}`);
  ok('amounts untouched',
    s.values[0] === CARDS[0].value && s.values[1] === CARDS[1].value, `${s.values}`);
  ok('and the piece is still live to finish the throw', s.awake > 0.99);
}

// 5d ------------------------------------------------------------------------
console.log('\n5d. once the throw lands the piece puts itself away');
{
  const s = initialState();
  drag(s, [C0.cx, C0.cy], [C0.cx, C0.cy], 0.2); settle(s, C0.cx, C0.cy);
  ok('ring and pill are up while holding the bubble',
    s.awake > 0.99 && s.pill[0] > 0.99);

  drag(s, [C0.cx, C0.cy], [C1.cx, C1.cy], 0.9);
  ok('not finished while the bubble is still in the air', s.done === false);
  settle(s, C1.cx, C1.cy);
  ok('finished once it lands', s.done === true);

  /* the finger is still down on the receiving card the whole time */
  settle(s, C1.cx, C1.cy, true);
  ok('black outline gone', s.awake < 0.01, `awake ${s.awake.toFixed(4)}`);
  ok('value container gone',
    s.pill[0] < 0.01 && s.pill[1] < 0.01,
    `pill ${s.pill[0].toFixed(4)}/${s.pill[1].toFixed(4)}`);
  ok('bubble gone', s.ballScale < 0.01, `scale ${s.ballScale.toFixed(4)}`);
  ok('but the amounts it moved stayed moved',
    s.values[0] === CARDS[0].value - TRANSFER);

  /* a new gesture clears the latch, which is what the screen does on touch */
  s.done = false;
  drag(s, [C1.cx, C1.cy], [C1.cx, C1.cy], 0.4);
  ok('and it comes back for the next throw', s.awake > 0.5 && s.pill[1] > 0.5,
    `awake ${s.awake.toFixed(2)}`);
}

// 6 -------------------------------------------------------------------------
console.log('\n6. releasing part-way leaves the first avatar active');
{
  const s = initialState();
  drag(s, [C0.cx, C0.cy], [330, 407], 0.5);   // still within card 1's reach
  ok('first avatar is the active one before release', s.active === 0);
  const t = settle(s, 0, 0, false);            // finger up
  ok('comes to rest after the release', t !== null,
    t === null ? 'still moving' : `after ${t.toFixed(2)}s`);
  ok('stays on the first avatar', s.active === 0);
  ok('blob settled back under its disc', Math.abs(s.ballX - C0.cx) < 1,
    `ballX ${s.ballX.toFixed(2)}`);
  ok('its pill is still shown', s.pill[0] > 0.99);
  ok('ring still open', s.awake > 0.99);
  const a = snap(s); hold(s, 0, 0, 5.0, false); const b = snap(s);
  ok('and it stays there — no replay', JSON.stringify(a) === JSON.stringify(b),
    JSON.stringify(a));
}

// 7 -------------------------------------------------------------------------
console.log('\n7. a gesture that never reached a card eases all the way down');
{
  const s = initialState();
  drag(s, [336, 120], [336, 140], 0.4);       // on the stage, clear of both
  ok('no card taken', s.active === -1);
  hold(s, 0, 0, 3.0, false);
  ok('everything back to rest', s.awake < 0.01 && s.ballScale < 0.01 && s.pill[0] < 0.01);
}

fs.rmSync(OUT, { recursive: true, force: true });
console.log(failures ? `\n${failures} FAILED` : '\nall gesture checks passed');
process.exit(failures ? 1 : 0);
