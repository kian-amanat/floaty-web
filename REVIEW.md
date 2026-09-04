# Reviewing this build

Five screens live in one Expo app, addressed by URL. This is what to open, at
what size, and what to do on each one to see it move.

```bash
cd surface-scan
npm install
npm run web        # what everything here was verified against
```

Then open `http://localhost:8081/`.

---

## Read this first — animation needs a visible tab

Every screen animates through `requestAnimationFrame`, which browsers pause for
a hidden tab. **A backgrounded tab, a collapsed dev-tools preview pane, or a
window behind another window will render the first frame and then freeze.**

It does not look like a freeze. It looks like a bug: the gooey blob sits at
zero, the auth form sticks half-faded, the scan column never deals in. All of
that is a paused clock, not broken code.

So: keep the tab **focused and in front** while reviewing. If a screen looks
dead, click the page once and reload before writing it up.

Two ways to check you are not being fooled:

```js
document.visibilityState        // must be "visible"
```

and the scan screen (`/`) should visibly deal its cards in on load — if it does
not, nothing else on any screen will move either.

---

## Size

**Use 430 × 932 (iPhone 14 Pro Max).** That is the reference frame two of the
five screens were authored against, and the one the rest were checked at.

In Chrome: DevTools → device toolbar (⌘⇧M) → *iPhone 14 Pro Max*. Set zoom to
**100%**, not "fit" — the dev-tools zoom control scales the screenshot, which
makes hairlines and glow falloff read wrongly.

| screen | authored against | behaviour off-size |
| --- | --- | --- |
| `/` scan | 430 × 932 | scales by width; very short windows crop the column |
| `/login`, `#signup` | 430 × 932 | scales by width; the form scrolls |
| `/weight` | 342 × 486 canvas | letterboxed, keeps aspect — safe at any size |
| `/gooey` | 672 × 848 stage | letterboxed, keeps aspect — safe at any size |

The last two are aspect-fit and honest at any window. The first two are phone
layouts and will look wrong stretched to a desktop width — that is the layout
being asked to do something it was not designed for, not a defect.

---

## Routes

Both the path and the hash work. The hash is the reliable one if the dev server
ever fails to serve a sub-path.

| screen | URL |
| --- | --- |
| Scan (default) | `localhost:8081/` |
| Weight dial | `localhost:8081/weight` |
| Gooey cards | `localhost:8081/#gooey` |
| Sign in | `localhost:8081/login` |
| Create account | `localhost:8081/login#signup` |

Anything unrecognised falls through to the scan screen.

---

## `/` — Scan

The original screen. Paper ground, a column of circular records, the focused one
swollen into a squircle.

**Plays itself on load.** No input needed:

- the left rail and badge fade up over **1.5s**
- cards deal in from the bottom edge, **390ms** apart, each taking **1.3s**
- at **2.0s** a scripted sweep walks the focus 3 → 1 → 5 → 4 and settles on 3,
  finishing around **5.9s**

**To drive it yourself:** scroll the column — the card nearest the focus line
grows. **Tap a card** to open it full-bleed into the read-out; tap again to
close.

Watch for: the deal-in should not stutter, and the sweep should settle without
a velocity jump between steps.

---

## `/weight` — Weight dial

A vertical ruler with a bend in it, a glowing accent line, and a large readout.
Opens at **17 lbs**, range **0–36**.

**Nothing happens until you drag.** There is no intro.

**Drag the knob vertically.** The ruler bends around it, the accent hue shifts
across the range (lime at the bottom through to orange at the top), and the
readout follows. Press-and-hold alone is enough to see the thumb change state:
the bezel ring lights and the chevrons brighten over **320ms**, and fade back
over **380ms** on release.

Watch for:

- the glow is three blurred passes — a hot core, a halo, and a wide spill. It
  should read as a lamp lighting the ticks, not a shadow clinging to the line
- labels dim with distance from the thumb and cut out entirely past a threshold,
  which is why the far end of the ruler goes dark
- the label the thumb is on grows

---

## `/#gooey` — Gooey cards

Two circular photographs on dotted paper, and one black metaball that is thrown
between them.

**Nothing happens until you touch it.** No intro, no autoplay, no loop.

**Put a finger (or the cursor, held down) on an avatar and drag.** The blob
grows out from under the photograph, stretches into a lobe carrying a dot and an
arrow, and follows you. Drag across to the other avatar and it detaches, flies,
and is absorbed — one continuous object throughout.

Watch for:

- **no seam** between photograph and blob at any point
- the dot and arrow blur away while it is travelling and return once it settles
- the receiving disc is shoved sideways by the arriving blob and springs back
- the price pill's delta counts up as the chip hatches open from a circle
- lift off and the whole piece goes back to sleep — ring closes, pill goes

The motion is entirely gesture-driven: **stop moving and it comes to rest where
you stopped; move back and it follows back.** The same path travelled fast or
slow ends in the same place. Nothing is on a timer.

This one is held to the reference capture frame by frame — see *Checks* below.

---

## `/login` and `#signup` — Auth

A dark form under a warm aurora wash. The two modes are one surface: switching
morphs it in place rather than swapping screens.

**Plays itself on load:** the light comes up at **260ms**, then rows stagger in
**115ms** apart, each running **760ms**.

**To exercise it:**

- **Press Continue with the fields empty.** Each field's hairline turns red and
  a message opens beneath it — the space opens *with* the message rather than
  being reserved for it. Then fill a field and submit again: the message should
  fade **out** as smoothly as it came in. An instant disappearance is a bug.
- **Switch between Sign in / Create account.** The tab underline slides and the
  form morphs over **460ms**.
- **Type a password on `#signup`.** The five strength segments fill, the caption
  changes, and the requirement list ticks off as each rule is met.
- **Tap the eye** to reveal a password — the slash scales away on a spring.

`prefers-reduced-motion: reduce` is honoured here: the entrance and the morph
are skipped and states are applied directly. Worth one pass with it on.

---

## Checks

Two harnesses, both plain Node, no browser:

```bash
node scripts/gooey-parity.mjs     # holds the gooey physics to the reference
node scripts/gooey-gesture.mjs    # gesture properties
```

`gooey-parity` runs the original web implementation inside a VM alongside the
React Native port, steps both for the full 11.3s at 1/60, and fails if they
drift. Current worst-case divergence is **0.15px** on a 672px stage.

`gooey-gesture` asserts the things parity cannot see, because parity replays a
fixed path: that a stopped finger leaves the state where it stopped, that a slow
drag and a fast drag to the same point rest identically, and that nothing moves
on its own.

Run both after touching anything in `src/gooey/`.

Type checking:

```bash
npx tsc --noEmit
```

---

## Known limits

- **The gooey screen has never been watched moving by its author.** It is
  verified by simulation, by pixel measurements against the reference video, and
  by DOM inspection — the browser pane was hidden throughout its development. If
  something reads wrong in motion, that is the gap.
- **The weight dial's glow was matched by eye**, not measured. There is no
  capture of that screen in the repo, unlike the gooey one. `SPILL_OPACITY` and
  `SPILL_SD` in `WeightSlider.tsx` are the dials.
- **The auth error animation was not seen running** for the same reason as the
  gooey screen. The layout numbers are measured; the transition is not.
- `reference/pxdx-gooey-cards/` is the original web implementation. It is not
  dead code — `gooey-parity.mjs` executes it. Do not delete it.
