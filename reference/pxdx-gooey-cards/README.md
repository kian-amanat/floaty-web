# PXDX Sketch Book — gooey cards

A rebuild of the reference screen capture: two circular photo cards on a dotted
paper ground, with a black metaball that gets thrown out beside a card carrying
a cursor dot and an arrow, flies across to the other card when the pointer
moves, and a price pill whose delta chip counts itself in.

Open `index.html` over any static server:

```bash
python3 -m http.server 4173 --directory pxdx-gooey-cards
```

## It plays itself

On load the capture replays on an 11.3s loop, driven by a scripted pointer path
(`PATH` in `app.js`) timed off the original. Move a real pointer over the stage
and you take over; leave it alone for a couple of seconds and the replay picks
up again from the top.

## How it works

There is **one** metaball for the whole stage. It trails the pointer and lives
in the same `filter: url(#goo)` group as the two discs behind the photographs,
so it melts into whichever disc it is nearest. That single ball explains every
frame of the capture:

| pointer | what the ball does | what you see |
| --- | --- | --- |
| out by a card's rim | extrudes into a lobe | the peanut, dot and arrow |
| parked over a centre | hides under the disc | just the black ring |
| crossing between cards | stretches off, flies, is absorbed | the throw |

The black border is not drawn — it is the disc showing through as the
photograph scales to `0.881`. It belongs to the piece rather than to either
card: **both** avatars carry it, and it opens while the pointer is anywhere on
the stage and closes once it leaves. In the capture you can watch it grow in
over the first 0.6s and fade out again after 10.2s, on both cards at once,
regardless of which one is being pointed at.

The ball always **grows out of the middle of a photo**. While it is invisible it
is parked on the nearest disc's centre, and while it is still swelling it is
held there, so it swells out from under the avatar rather than reaching for
wherever the pointer happened to come in from. In the capture you can watch the
right side of card 1 bulge outward from t 0.66 and stretch into a lobe by 1.3,
with the ball's y pinned to the centre line the whole way.

The dot and arrow only appear once the ball has settled; while it is travelling
they blur away, exactly as in the capture.

A disc also takes the ball's momentum. While the ball is *closing* on a disc it
hands over velocity in proportion to how far it has sunk in, and a spring drags
the disc back onto its mark. That is why card 2 gets visibly shunted sideways as
the thrown ball plows into it, while card 1 never budges — its ball is always
leaving, never arriving.

Everything eases with a plain exponential approach (`1 - e^(-dt/tau)`), never a
CSS transition, so the motion is framerate independent and the pointer can
change its mind mid-flight.

## Numbers taken from the capture

The reference is 672 x 848 at 30fps, which is the stage's design size; the whole
thing is uniformly scaled to the viewport at runtime.

| | value |
| --- | --- |
| paper / ink | `#dddddd` / `#000000` |
| dot grid | 8.15px pitch, ~0.65px dot at 8.5% black |
| card centres | (208, 407) and (465, 407), disc r 67 |
| ball | r 48, engages a card within 130px |
| goo filter | `stdDeviation 7`, alpha row `22 / -10` |
| pill | 89 x 29 at y 497, chip 30 x 19 |
| ball + counter | tau = 0.50s (emergence stretches to ~0.63 as it swells) |
| engage / pill in / pill out | tau = 0.16 / 0.20 / 0.07s |
| border open / close | tau = 0.30 / 0.45s |
| push spring | gain 2.6, stiffness 5.0, damping 4.5 |

`stdDeviation` and the threshold were solved by rendering candidate filters
offscreen and matching the silhouette's column heights against the capture: the
chosen pair puts the neck at h 88 against the capture's 89, in the same column
(x 263), and tracks every sampled column to within 1–3px.

The same fit drove the timings — the ball's right edge lands within 2px of the
capture at 0.5s / 1.0s / 1.5s / 2.5s, and the counter within 2 across its whole
3.5s settle.

The push spring was solved the same way as the goo filter — by replaying the
ball trajectory against a grid of constants and matching card 2's measured
displacement. It lands at +20.9px against the capture's +21 at t 6.3, then
12.6 / 4.9 / -1.2 against 15 / 5 / 1 as it settles, with card 1 held at 0.

## Assets

`assets/avatar-0{1,2}.png` are lifted from the capture itself at 4x, since the
photographs are part of what makes the composition read correctly.
