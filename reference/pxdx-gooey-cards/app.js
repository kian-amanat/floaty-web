/* ---------------------------------------------------------------------------
   PXDX Sketch Book — gooey card interaction

   Model (reverse-engineered from the reference capture, frame by frame):

   * There is ONE black metaball for the whole stage. It trails the pointer and
     lives in the same `filter:url(#goo)` group as the two discs behind the
     photographs, so it melts into whichever disc it is closest to — and when
     the pointer crosses from one card to the other you watch it stretch off
     the first card, fly across the gap, and get absorbed into the second.
   * Sitting out by a card's rim it reads as an extruded lobe carrying the
     cursor dot and the arrow. Parked over the centre it hides under the disc
     and all you see is the black ring opened up by the photo scaling down.
   * Everything eases with a plain exponential approach. Fitting the capture
     gave tau ~= 0.5 s for the ball and for the counter, which is why the blob
     keeps creeping for a couple of seconds and the delta takes ~3.5 s to land.
   * The dot and arrow are only shown once the ball has settled: while it is
     travelling they blur out, exactly as in the capture.

   On load the whole capture replays itself on a loop from a scripted pointer
   path. Moving a real pointer over the stage takes over; leave it alone for a
   few seconds and the replay picks up again from the top.
--------------------------------------------------------------------------- */

const DESIGN = { w: 672, h: 848 };

const R_HIT      = 130;      // pointer radius that engages a card
const SHOW_ARROW = [45, 26]; // dot + arrow fade in as the ball clears the photo
const SETTLE_REF = 110;      // ball lag beyond which the dot + arrow blur away

/* the ball shoves a disc off its mark as it plows into it, and the disc
   springs back. Only a *closing* ball pushes, which is why card 1 never budges
   (its ball is always leaving) while card 2 takes the throw square on. */
const PUSH_GAIN  = 2.6;
const PUSH_STIFF = 5.0;
const PUSH_DAMP  = 4.5;
const PUSH_MAX   = 34;   // a fast flick must not launch a disc off its mark

const TAU_BALL     = 0.50;
const TAU_ACT      = 0.16;
const TAU_WAKE_IN  = 0.30;
const TAU_WAKE_OUT = 0.45;
const TAU_SCALE    = 0.18;
const TAU_REVEAL   = 0.10;
const TAU_PILL_IN  = 0.20;
const TAU_PILL_OUT = 0.07;

const CHIP_IDLE_BG = [0x55, 0x55, 0x55];
const CHIP_IDLE_FG = [0xff, 0xff, 0xff];

/* Scripted pointer path, timed off the capture. x only; y stays on the cards'
   centre line. `null` means the pointer is away and the ball is put down. */
const LOOP = 11.3;
const PATH = [
  { t: 0.00,  x: null, y: null },
  { t: 0.15,  x: 336,  y: 120 },  // pointer arrives on the stage; borders wake
  { t: 0.63,  x: 336,  y: 120 },  // ... but clear of both cards, so no ball yet
  { t: 0.66,  x: 288,  y: 407 },  // takes card 1; ball grows out of the middle
  { t: 3.10,  x: 288,  y: 407 },
  { t: 4.20,  x: 255,  y: 407 },  // eases back in
  { t: 5.02,  x: 255,  y: 407 },
  { t: 5.30,  x: 505,  y: 407 },  // sweeps across; ball flies to card 2
  { t: 6.30,  x: 487,  y: 407 },
  { t: 8.60,  x: 465,  y: 407 },  // settles on card 2's centre
  { t: 10.10, x: 465,  y: 407 },
  { t: 10.30, x: null, y: null }, // and leaves; borders go back to sleep
  { t: LOOP,  x: null, y: null },
];
const IDLE_BEFORE_REPLAY = 2.5;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const window01 = (v, [start, span]) => clamp((v - start) / span, 0, 1);
/* exponential approach: framerate independent, no overshoot */
const approach = (dt, tau) => 1 - Math.exp(-dt / tau);
const rgb = (c) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
const mixRgb = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

const stage = document.getElementById('stage');
const measure = document.getElementById('measure');
const ballContent = stage.querySelector('.ball-content');

const CARD_SPEC = [
  { delta: -56, chipBg: [0x55, 0x55, 0x55], chipFg: [0xff, 0xff, 0xff] },
  { delta: +56, chipBg: [0xff, 0xff, 0xff], chipFg: [0x00, 0x00, 0x00] },
];

const cards = [...stage.querySelectorAll('.card')].map((el, i) => {
  const spec = CARD_SPEC[i];
  const cs = getComputedStyle(el);
  const card = {
    el,
    spec,
    cx: parseFloat(cs.getPropertyValue('--cx')),
    cy: parseFloat(cs.getPropertyValue('--cy')),
    disc: stage.querySelector(`.disc[data-card="${i}"]`),
    chip: el.querySelector('.chip'),
    chipText: el.querySelector('.chip-text'),
    engaged: false,
    act: 0,
    pushX: 0, pushY: 0, pushVX: 0, pushVY: 0,
    pill: 0,
    count: 0,
  };
  measure.textContent = (spec.delta < 0 ? '-' : '+') + Math.abs(spec.delta);
  card.chipWide = Math.max(19, Math.round(measure.offsetWidth) + 10);
  return card;
});

const ball = { x: cards[0].cx, y: cards[0].cy, vx: 0, vy: 0, scale: 0, reveal: 0 };
let awake = 0;   /* pointer is somewhere on the stage */

/* --- layout --------------------------------------------------------------- */

let scale = 1;

function fit() {
  scale = Math.min(
    (window.innerWidth * 0.96) / DESIGN.w,
    (window.innerHeight * 0.96) / DESIGN.h
  );
  stage.style.setProperty('--s', scale);
}

/* --- pointer, real and scripted ------------------------------------------- */

let pointer = null;      // { x, y } in design units, or null
let autoplay = true;
let autoT = 0;           // playhead into PATH
let idleFor = 0;         // seconds since the user last moved

function samplePath(t) {
  const now = ((t % LOOP) + LOOP) % LOOP;
  for (let i = PATH.length - 1; i >= 0; i--) {
    if (now < PATH[i].t) continue;
    const a = PATH[i], b = PATH[i + 1];
    if (a.x === null) return null;
    if (!b || b.x === null || b.t === a.t) return { x: a.x, y: a.y };
    const u = (now - a.t) / (b.t - a.t);
    return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) };
  }
  return null;
}

function toStage(ev) {
  const r = stage.getBoundingClientRect();
  return { x: (ev.clientX - r.left) / scale, y: (ev.clientY - r.top) / scale };
}

function track(ev) {
  autoplay = false;
  idleFor = 0;
  pointer = toStage(ev);
  wake();
}

function release() {
  if (!autoplay) { pointer = null; idleFor = 0; }
  wake();
}

stage.addEventListener('pointermove', track);
stage.addEventListener('pointerdown', track);
stage.addEventListener('pointerleave', release);
stage.addEventListener('pointercancel', release);
/* touch has no "leave": lifting the finger is what ends the gesture */
stage.addEventListener('pointerup', (ev) => { if (ev.pointerType !== 'mouse') release(); });
window.addEventListener('blur', release);
window.addEventListener('resize', fit);
document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });

/* --- frame ---------------------------------------------------------------- */

let last = 0;
let running = false;

function wake() {
  if (running) return;
  running = true;
  last = performance.now();
  requestAnimationFrame(frame);
}

function frame(now) {
  /* clamped low as well as high: a backwards clock must never feed a
     negative dt into the approach() terms, which would blow them up */
  const dt = clamp((now - last) / 1000, 0, 1 / 20);
  last = now;

  /* hand control back to the replay once the user has been still a while */
  if (!autoplay) {
    idleFor += dt;
    if (idleFor > IDLE_BEFORE_REPLAY && !pointer) { autoplay = true; autoT = 0; }
  }
  if (autoplay) {
    autoT += dt;
    pointer = samplePath(autoT);
  }

  const kBall = approach(dt, TAU_BALL);
  const kAct = approach(dt, TAU_ACT);

  /* whichever disc the ball belongs to right now */
  let home = cards[0], best = Infinity;
  const ref = pointer || ball;
  for (const card of cards) {
    const d = Math.hypot(ref.x - card.cx, ref.y - card.cy);
    if (d < best) { best = d; home = card; }
  }
  /* while it is invisible, park it there outright, so it never flies in across
     the stage from wherever it was last put down */
  if (ball.scale < 0.05) { ball.x = home.cx; ball.y = home.cy; }

  /* The ball chases the pointer — but while it is still swelling it is held to
     the middle of that photo, so it grows out from under the avatar instead of
     reaching for the pointer's approach path. */
  const emerge = ball.scale;
  const wasX = ball.x, wasY = ball.y;
  if (pointer) {
    ball.x += (lerp(home.cx, pointer.x, emerge) - ball.x) * kBall;
    ball.y += (lerp(home.cy, pointer.y, emerge) - ball.y) * kBall;
  }
  ball.vx = dt > 0 ? (ball.x - wasX) / dt : 0;
  ball.vy = dt > 0 ? (ball.y - wasY) / dt : 0;

  /* the borders belong to the piece, not to either card: they open while the
     pointer is anywhere on the stage and close again once it leaves */
  awake += ((pointer ? 1 : 0) - awake) * approach(dt, pointer ? TAU_WAKE_IN : TAU_WAKE_OUT);
  const lag = pointer ? Math.hypot(pointer.x - ball.x, pointer.y - ball.y) : 0;

  let engagedAny = false;
  let nearest = Infinity;

  for (const card of cards) {
    card.engaged = !!pointer &&
      Math.hypot(pointer.x - card.cx, pointer.y - card.cy) <= R_HIT;
    if (card.engaged) engagedAny = true;

    const bx = card.cx - ball.x, by = card.cy - ball.y;
    const d = Math.hypot(bx, by) || 0.0001;
    nearest = Math.min(nearest, d);

    /* momentum handed over while the ball is closing on the disc, then a
       spring drags the disc back onto its mark */
    const overlap = clamp(1 - d / (67 + 48), 0, 1);
    const closing = (ball.vx * bx + ball.vy * by) / d;
    if (closing > 0 && overlap > 0) {
      const g = PUSH_GAIN * overlap * ball.scale * dt;
      card.pushVX += ball.vx * g;
      card.pushVY += ball.vy * g;
    }
    card.pushVX += (-PUSH_STIFF * card.pushX - PUSH_DAMP * card.pushVX) * dt;
    card.pushVY += (-PUSH_STIFF * card.pushY - PUSH_DAMP * card.pushVY) * dt;
    card.pushX = clamp(card.pushX + card.pushVX * dt, -PUSH_MAX, PUSH_MAX);
    card.pushY = clamp(card.pushY + card.pushVY * dt, -PUSH_MAX, PUSH_MAX);

    card.act += ((card.engaged ? 1 : 0) - card.act) * kAct;
    card.pill += ((card.engaged ? 1 : 0) - card.pill) *
      approach(dt, card.engaged ? TAU_PILL_IN : TAU_PILL_OUT);

    const countAim = card.engaged ? Math.abs(card.spec.delta) : 0;
    card.count += (countAim - card.count) * kBall;
  }

  ball.scale += ((engagedAny ? 1 : 0) - ball.scale) * approach(dt, TAU_SCALE);

  /* dot + arrow: clear of the photo, ball settled, ball actually on stage */
  const revealAim = window01(nearest, SHOW_ARROW) *
                    clamp(1 - lag / SETTLE_REF, 0, 1) *
                    clamp(ball.scale * 1.4 - 0.4, 0, 1);
  ball.reveal += (revealAim - ball.reveal) * approach(dt, TAU_REVEAL);

  paint();

  const restless = autoplay || !!pointer || lag > 0.05 || ball.scale > 0.002 ||
    awake > 0.002 ||
    cards.some((c) => c.act > 0.002 || c.pill > 0.002 || c.count > 0.02 ||
                      Math.abs(c.pushX) > 0.05 || Math.abs(c.pushY) > 0.05 ||
                      Math.abs(c.pushVX) > 0.5 || Math.abs(c.pushVY) > 0.5);

  if (restless) requestAnimationFrame(frame);
  else running = false;
}

function paint() {
  const s = stage.style;
  s.setProperty('--ball-x', ball.x.toFixed(2) + 'px');
  s.setProperty('--ball-y', ball.y.toFixed(2) + 'px');
  s.setProperty('--ball-s', ball.scale.toFixed(4));
  s.setProperty('--reveal', ball.reveal.toFixed(4));
  s.setProperty('--awake', awake.toFixed(4));

  /* only steal the cursor while the visitor is the one driving */
  stage.classList.toggle('is-engaged', !autoplay && ball.scale > 0.5);

  for (const card of cards) {
    const cs = card.el.style;
    cs.setProperty('--act', card.act.toFixed(4));
    cs.setProperty('--pill', card.pill.toFixed(4));
    cs.setProperty('--push-x', card.pushX.toFixed(2) + 'px');
    cs.setProperty('--push-y', card.pushY.toFixed(2) + 'px');

    const ds = card.disc.style;
    ds.setProperty('--push-x', card.pushX.toFixed(2) + 'px');
    ds.setProperty('--push-y', card.pushY.toFixed(2) + 'px');

    /* the chip hatches out of a circle as the counter fills in */
    const target = Math.abs(card.spec.delta);
    const p = target ? clamp(card.count / target, 0, 1) : 0;
    const grow = clamp(p * 1.35, 0, 1);

    card.chip.style.setProperty('--chip-w', lerp(19, card.chipWide, grow).toFixed(2) + 'px');
    card.chip.style.setProperty('--chip-bg', rgb(mixRgb(CHIP_IDLE_BG, card.spec.chipBg, p)));
    card.chipText.style.setProperty('--chip-fg', rgb(mixRgb(CHIP_IDLE_FG, card.spec.chipFg, p)));
    card.chipText.style.setProperty('--chip-o', clamp(p * 3.2 - 0.25, 0, 1).toFixed(3));
    card.chipText.textContent =
      (card.spec.delta < 0 ? '-' : '+') + Math.round(card.count);
  }
}

fit();
paint();
wake();
