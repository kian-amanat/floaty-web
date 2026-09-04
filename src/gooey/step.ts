/* ---------------------------------------------------------------------------
   One frame of the gooey stage.

   Kept apart from the screen and free of anything Reanimated so the motion can
   be stepped in a plain Node process and checked against the original (see
   scripts/gooey-parity.mjs).

   The pointer is an argument, never something this generates: the gesture is
   the only thing that drives the piece. Passing null is the pointer being away,
   and every quantity then eases back down. Nothing here is on a clock — dt only
   sets how far each value gets toward where the finger already is, so a finger
   that stops leaves the state where it stopped, and one that moves back drags
   it back.
--------------------------------------------------------------------------- */

import {
  CARDS, TRANSFER, ABSORB,
  DISC_R, BALL_R, R_HIT, SHOW_ARROW, SETTLE_REF,
  PUSH_GAIN, PUSH_STIFF, PUSH_DAMP, PUSH_MAX,
  TAU_BALL, TAU_ACT, TAU_WAKE_IN, TAU_WAKE_OUT, TAU_SCALE, TAU_REVEAL,
  TAU_PILL_IN, TAU_PILL_OUT, TAU_DONE_OUT, HOLD_AFTER_THROW,
} from './constants';
import { clamp, lerp, window01, approach } from './sim';

export type Pointer = { x: number; y: number } | null;

export type State = {
  /* painted */
  ballX: number; ballY: number; ballScale: number; reveal: number; awake: number;
  act: number[]; pill: number[]; pushX: number[]; pushY: number[]; count: number[];
  /* integrator */
  vx: number; vy: number; pushVX: number[]; pushVY: number[];
  /* what each card is holding — a throw moves TRANSFER from one to the other */
  values: number[];
  /* the card the bubble actually belongs to — only changes once it arrives */
  holder: number;
  /* the card the finger has taken, which is the aim rather than the result */
  active: number;
  /* a throw has just landed; the piece is finished and should go back to rest
     until the next gesture picks it up */
  done: boolean;
  /* seconds since it landed, so the catch can play before the piece is put away */
  doneFor: number;
};

export function initialState(): State {
  'worklet';
  return {
    ballX: CARDS[0].cx, ballY: CARDS[0].cy, ballScale: 0, reveal: 0, awake: 0,
    act: [0, 0], pill: [0, 0], pushX: [0, 0], pushY: [0, 0], count: [0, 0],
    vx: 0, vy: 0, pushVX: [0, 0], pushVY: [0, 0],
    values: [CARDS[0].value, CARDS[1].value],
    holder: -1, active: -1, done: false, doneFor: 0,
  };
}

/** Advances `s` by `dt` seconds against wherever the pointer is, in place. */
export function step(s: State, dt: number, ptr: Pointer): void {
  'worklet';

  const on = ptr !== null;
  if (s.done) s.doneFor += dt;
  /* the landing is still being watched, so nothing starts leaving yet */
  const watching = s.done && s.doneFor < HOLD_AFTER_THROW;
  const px = on ? ptr!.x : 0;
  const py = on ? ptr!.y : 0;

  const kBall = approach(dt, TAU_BALL);
  const kAct = approach(dt, TAU_ACT);

  /* whichever disc the ball belongs to right now */
  let homeX = CARDS[0].cx;
  let homeY = CARDS[0].cy;
  let best = Infinity;
  const refX = on ? px : s.ballX;
  const refY = on ? py : s.ballY;
  for (let i = 0; i < CARDS.length; i++) {
    const d = Math.hypot(refX - CARDS[i].cx, refY - CARDS[i].cy);
    if (d < best) { best = d; homeX = CARDS[i].cx; homeY = CARDS[i].cy; }
  }
  /* while it is invisible, park it there outright, so it never flies in across
     the stage from wherever it was last put down */
  if (s.ballScale < 0.05) { s.ballX = homeX; s.ballY = homeY; }

  /* The ball chases the pointer — but while it is still swelling it is held to
     the middle of that photo, so it grows out from under the avatar instead of
     reaching for the pointer's approach path. */
  const emerge = s.ballScale;
  const wasX = s.ballX;
  const wasY = s.ballY;
  if (on) {
    s.ballX += (lerp(homeX, px, emerge) - s.ballX) * kBall;
    s.ballY += (lerp(homeY, py, emerge) - s.ballY) * kBall;
  } else if (s.done && s.holder >= 0) {
    /* A landed throw keeps sinking into the avatar that caught it. Without
       this the bubble stops dead the moment it counts as arrived, and the disc
       only ever feels the run-up rather than the arrival itself. */
    s.ballX += (CARDS[s.holder].cx - s.ballX) * kBall;
    s.ballY += (CARDS[s.holder].cy - s.ballY) * kBall;
  }
  s.vx = dt > 0 ? (s.ballX - wasX) / dt : 0;
  s.vy = dt > 0 ? (s.ballY - wasY) / dt : 0;

  /* the borders belong to the piece, not to either card: they open while the
     pointer is anywhere on the stage and close again once it leaves */
  const awakeAim = on || watching ? 1 : 0;
  s.awake += (awakeAim - s.awake) *
    approach(dt, awakeAim ? TAU_WAKE_IN : (s.done ? TAU_DONE_OUT : TAU_WAKE_OUT));
  const lag = on ? Math.hypot(px - s.ballX, py - s.ballY) : 0;

  /* The two reaches overlap in the middle, so "within R_HIT" can be true of
     both cards at once — and a per-card test then hands the bubble over twice
     in the one frame, once each way, which cancels out and loses the throw.
     Only the closest card inside the reach can hold it. */
  let taken = -1;
  let takenD = R_HIT;
  if (on) {
    for (let i = 0; i < CARDS.length; i++) {
      const d = Math.hypot(px - CARDS[i].cx, py - CARDS[i].cy);
      if (d <= takenD) { takenD = d; taken = i; }
    }
  }

  let engagedAny = false;
  let nearest = Infinity;

  for (let i = 0; i < CARDS.length; i++) {
    const card = CARDS[i];
    const engaged = i === taken;
    if (engaged) {
      engagedAny = true;
      s.active = i;
      /* the first card touched simply picks the bubble up */
      if (s.holder < 0) s.holder = i;
    }

    const bx = card.cx - s.ballX;
    const by = card.cy - s.ballY;
    const d = Math.hypot(bx, by) || 0.0001;
    if (d < nearest) nearest = d;

    /* momentum handed over while the ball is closing on the disc, then a spring
       drags the disc back onto its mark */
    const overlap = clamp(1 - d / (DISC_R + BALL_R), 0, 1);
    const closing = (s.vx * bx + s.vy * by) / d;
    if (closing > 0 && overlap > 0) {
      const g = PUSH_GAIN * overlap * s.ballScale * dt;
      s.pushVX[i] += s.vx * g;
      s.pushVY[i] += s.vy * g;
    }
    s.pushVX[i] += (-PUSH_STIFF * s.pushX[i] - PUSH_DAMP * s.pushVX[i]) * dt;
    s.pushVY[i] += (-PUSH_STIFF * s.pushY[i] - PUSH_DAMP * s.pushVY[i]) * dt;
    s.pushX[i] = clamp(s.pushX[i] + s.pushVX[i] * dt, -PUSH_MAX, PUSH_MAX);
    s.pushY[i] = clamp(s.pushY[i] + s.pushVY[i] * dt, -PUSH_MAX, PUSH_MAX);

    s.act[i] += ((engaged ? 1 : 0) - s.act[i]) * kAct;
    /* the catching card keeps its pill up for the length of the hold */
    const pillAim = engaged || (watching && i === s.holder) ? 1 : 0;
    s.pill[i] += (pillAim - s.pill[i]) *
      approach(dt, pillAim ? TAU_PILL_IN : (s.done ? TAU_DONE_OUT : TAU_PILL_OUT));

    const countAim = engaged ? TRANSFER : 0;
    s.count[i] += (countAim - s.count[i]) * kBall;
  }

  /* The throw lands when the bubble gets there, not when the finger does. Aim
     it at the far card and it is still in the air; carry it in and the amount
     changes hands, which is what finishes the piece. */
  if (s.holder >= 0 && s.active >= 0 && s.active !== s.holder) {
    const to = CARDS[s.active];
    if (Math.hypot(to.cx - s.ballX, to.cy - s.ballY) < ABSORB) {
      s.values[s.holder] -= TRANSFER;
      s.values[s.active] += TRANSFER;
      s.holder = s.active;
      s.done = true;
    }
  }

  s.ballScale += ((engagedAny ? 1 : 0) - s.ballScale) * approach(dt, TAU_SCALE);

  /* dot + arrow: clear of the photo, ball settled, ball actually on stage */
  const revealAim = window01(nearest, SHOW_ARROW[0], SHOW_ARROW[1]) *
    clamp(1 - lag / SETTLE_REF, 0, 1) *
    clamp(s.ballScale * 1.4 - 0.4, 0, 1);
  s.reveal += (revealAim - s.reveal) * approach(dt, TAU_REVEAL);
}
