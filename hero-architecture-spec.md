# Hero rebuild — architecture spec

Handoff document for building the new particle hero. Written to be given
directly to Claude Code (or Opus) as context, alongside
`portfolio-project-notes.md`.

---

## Goal

The hero must communicate, without explanation:

> "I take raw, chaotic data, transform and structure it, and turn it into
> useful insight."

Visual story: **CHAOS → TRANSFORMATION → STRUCTURE → INSIGHT**
(Bronze → Silver → Gold, expressed abstractly, never as literal boxes.)

---

## Composition — read this first

The particle system **is** the hero. This is not a two-column layout with
text on the left and a visual on the right.

- Hero occupies the full viewport as one interactive scene.
- Canvas is `position: fixed`, full viewport, behind the text in z-order.
- Typography (`ABHAY PATEL` / `DATA & AI ENGINEERING`) sits inside the
  scene as a DOM element above the canvas.
- Particles flow *around* and *behind* the typography.
- Readability of the name and role is non-negotiable and outranks any
  animation effect.

Visual hierarchy, in priority order:
1. Identity must be readable
2. Particle system creates environment and movement
3. Medallion transformation provides narrative
4. Scroll controls progression
5. Final state transitions into the next section

---

## Core architectural principle

**Particles have lifecycles, not destinations.**

The previous implementation eased every particle toward a fixed target
coordinate. That is the single root cause of the animation feeling
mechanical, parking when it finished, and looking wrong on a second pass.

New model — every particle continuously:
```
spawn at left edge → flow right → exit right edge → respawn at left
```

It never arrives anywhere. What changes is how much **order** the system
imposes on it:

```
order = xFraction × scrollProgress
```
- `xFraction` = particle's x position as a fraction of viewport width
- `scrollProgress` = 0…1 from ScrollTrigger

At `scrollProgress = 0`: order is 0 everywhere → total chaos.
At `scrollProgress = 1`: order ramps 0→1 left to right → full pipeline.

Scrolling therefore feels like *powering up the pipeline*.

---

## Two independent systems (this is what fixes "everything parks")

| System | Driven by | Responsibility |
|---|---|---|
| Animation loop | `requestAnimationFrame` | continuous motion, always running |
| State | ScrollTrigger `onUpdate` | sets one `scrollProgress` variable |

The loop never stops. Scroll only changes *how* particles behave, never
*whether* they move. Do not tie particle movement itself to scroll.

**Exception:** the protagonist entity's x-position IS tied directly to
`scrollProgress`, so the user's scroll physically drags it through the
pipeline while ambient flow continues around it.

---

## Behaviour table — how the tiers are expressed

All driven by the single `order` value. No boxes, no labels required.

| Property | Bronze (order≈0) | Silver (order≈0.5) | Gold (order≈1) |
|---|---|---|---|
| Turbulence | high | damping | none |
| Y position | random | snapping to lanes | converging to few points |
| Speed | highly varied | uniform | uniform |
| Spacing | uneven, clumped | even | deliberate |
| Size / opacity | varied | consistent | consistent |
| Visible count | many | many | **fewer** |
| Colour | `--amber` | `--text-muted` | `--teal` |

The density drop in Gold is the "many records → fewer metrics"
aggregation idea. It is also a useful performance win.

Optional: low-opacity mono labels near the left edge
(`api · sql · csv · json · events`) fading out as order rises. Cue only,
must not dominate.

---

## Key techniques

### Motion trails
The canvas is transparent (the page's grid overlay shows through), so
painting a translucent background rect will not work. Erase instead:

```js
ctx.globalCompositeOperation = 'destination-out';
ctx.fillStyle = 'rgba(0,0,0,0.12)';  // alpha = trail length; lower = longer
ctx.fillRect(0, 0, w, h);
ctx.globalCompositeOperation = 'source-over';
```

### Turbulence (no library needed)
Sum-of-sines gives a smooth organic flow field:
```js
var drift = Math.sin(p.x * 0.01 + time) * Math.cos(p.y * 0.013 - time * 0.7);
p.vy += drift * turbulenceAmount;   // turbulenceAmount = (1 - order)
```

### Spring motion with overshoot
Exponential easing (`p.y += (target - p.y) * 0.1`) can never overshoot,
which is why the old version felt mechanical. Use velocity:
```js
p.vy += (targetY - p.y) * stiffness;
p.vy *= damping;      // ~0.88, below 1 so it settles
p.y  += p.vy;
```
Vary `stiffness` per particle to get staggered arrival for free.

### Typography repulsion
Cache text bounding boxes on load and resize. **Never** call
`getBoundingClientRect()` inside the animation loop — it forces layout
recalculation every frame.
```js
if (particle near cached text box) push away from centre, strength ∝ 1/distance
```
This creates a natural clear zone around the name: protects readability
and looks intentional.

---

## Performance constraints

- The trail `fillRect` covers the whole viewport every frame — now the
  most expensive single operation. Cap `devicePixelRatio` at 2 (retina
  reports 3); use 1.5 on low-power devices.
- **Never use `shadowBlur`** for glow — use a second larger circle at low
  alpha instead.
- Particle budget: ~250 desktop, ~100 mobile.
- Canvas must be `position: fixed` so pinning doesn't move or repaint it.
- Pause the loop on `visibilitychange` when the tab is hidden.

**WebGL is not required.** A few hundred 2D canvas particles is well
within budget. WebGL would only be justified at thousands of particles
with per-pixel shader work, and would cost code readability — which
matters here because this project is also a learning exercise.

---

## Preserve from the existing `site-particles.js`

- Canvas setup with `devicePixelRatio` handling
- Reading colours from CSS custom properties (`hexToRgb`, `lerpColor`,
  `rgba` helpers) — keeps JS and `style.css` in sync
- Guard clauses: `prefers-reduced-motion`, GSAP-missing, device capability
- `requestAnimationFrame` loop + `visibilitychange` pause
- ScrollTrigger pin + `scrub` + `onUpdate` → single progress variable

## Discard from the existing `site-particles.js`

- The target-point convergence model (root cause of all motion complaints)
- The shared "claim" particle pool (root cause of the stage-4 bugs)
- `clearRect()` per frame (replaced by the trail technique)
- Coupling to the `.hero__diagram` bounding box (hero is now full viewport)

---

## Hero content

Three text elements only. More than this fights the animation for
attention in a full-viewport scene.

```
ABHAY PATEL                                    (display, largest)
DATA & AI ENGINEERING                          (mono or display, secondary)
Aerospace engineer turned data engineer —      (one line, muted)
I turn raw, messy data into decisions.
```

The degree is folded into the one-liner rather than given its own line.
The one-liner deliberately describes what the particles are doing on
screen — copy and animation reinforcing each other.

---

## Colour — "Warm Archive"

Superseded from the original amber/muted/teal-on-navy proposal after a
palette review. **Same dark register, same token names — only the hex
values changed.** Nothing else in this spec needed rethinking: the halo
technique, the trail-erase technique, and the turbulence-on-dark feel all
carry over unchanged.

**Rationale for the shift:** warm instead of cool reads like an aged
cockpit instrument panel rather than a monitor. The verdigris insight
colour is a deliberate double meaning — verdigris is literally what
bronze and copper turn as they age, so "raw → verdigris" reinforces the
Bronze→Gold metaphor instead of just being a nice colour.

| Token | Role | Hex |
|---|---|---|
| `--ink` | page background | `#14100D` |
| `--panel` | card/panel surface | `#1E1712` |
| `--text` | primary text | `#F1E9DD` |
| `--text-muted` | Silver / transforming | `#A89A87` |
| `--amber` | Bronze / raw | `#D97D4A` |
| `--teal` | Gold / insight | `#4F9C8C` |
| `--purple` | analysis category | `#8E5A6B` |

`--purple` is a new addition at this step — the original Warm Archive
sketch reused the grey for "analysis," which would have collapsed two
distinct project categories into one colour. A muted dusty plum keeps it
in the same warm/archival family while staying clearly distinct from
both the terracotta and the verdigris.

Compute `-dim` variants (used for soft background washes, e.g.
`--amber-dim`) the same way as before: same hue, ~12-14% alpha.

**Protagonist entity and final insight formation:** near-white core
(`--text`, #F1E9DD) with a `--teal` halo — this still works exactly as
designed, since Warm Archive stays in the dark register. (Note for
later: this glow technique would need to invert — dark core instead of
light — if the site ever moves to the light "Warm Stone" palette. Not a
concern for the current build.)

**Deferred, not discarded — "Warm Stone" as a planned v2.** A light,
warm, editorial palette (cream background, deep ink text, terracotta +
deep pine accents) was seriously considered and is genuinely more
distinctive than either dark option. Explicitly not built now: it would
mean redesigning every section for light mode, not just swapping hero
tokens, and doing that properly deserves its own scoped pass once the
current site exists and works — not squeezed in as an afterthought here.
Full palette values are preserved in `palette-comparison.html` if this
gets picked up later.

---

## Stage G — exit transition: "The Cascade"

Chosen over two alternatives (radial "Broadcast" — too close to an
explosion; slow "Sediment" — too subtle to read as a deliberate
conclusion).

Sequence, all driven by scroll progress:

1. **Hold** — the insight formation reaches its most organised state and
   becomes the clear focal point of the screen.
2. **Pulse** — one single, restrained pulse. The beat that says "this is
   the payoff." Borrowed from the Broadcast variation.
3. **Tip and pour** — the formation releases downward in *ordered
   columns*, not a scatter. This is literally what a pipeline does at the
   end: it writes its output somewhere.
4. **Lateral peel** — a small minority of particles travel out to the
   viewport edges so the motion isn't purely vertical.
5. **Typography** — fades and drifts slightly, or gets carried by the
   particle movement. Must not simply cut out.
6. **Bridge** — downward-flowing particles continue past the hero
   boundary and fade out over roughly the first screen-height of the
   About section, so About feels revealed by the hero rather than
   starting separately.
7. **Unpin** — only after the visual transition has resolved.

Target duration ~1–2 seconds of scroll. Elegant and restrained; not an
exaggerated effect.

### Making it scrubbable (critical)

The exit must live inside the **same** scroll progress range as the rest
of the hero:

```
progress 0.00 – 0.85   pipeline (bronze → silver → gold)
progress 0.85 – 1.00   exit cascade
```

Because every particle's behaviour is a pure function of `progress`,
scrolling backwards reverses the whole thing for free. This only works if
the exit is never implemented as a triggered one-shot GSAP timeline.
Do not use `onEnter`/`onLeave` callbacks for the exit.

---

## Nav bar

The nav is hidden over the hero and fades in during the exit phase,
driven by the same `scrollProgress` (0.85 → 1.00). Use `opacity` plus
`pointer-events: none` while hidden so it can't be clicked invisibly.

This also means the nav and the flight-plan strip (see
`portfolio-project-notes.md`, Concept 1 plan) appear together as one
coordinated moment rather than as two unrelated elements.

---

## Build stages

Build and verify one at a time. Do not attempt this as a single rewrite.

**A — Composition.** Full-viewport hero, typography layout, fixed canvas
behind text. No animation changes yet. Verify readability and that the
existing site below still scrolls correctly.

**B — Core flow.** Particles spawn left, flow right, respawn. Continuous,
no scroll dependency yet. Include motion trails from the start. Target:
it should already look good as an ambient effect before any state logic.

**C — The order gradient.** Wire up `scrollProgress`. Implement turbulence
damping and lane snapping. This is Bronze → Silver. The biggest single
step; verify it thoroughly before moving on.

**D — Aggregation and insight.** Clustering in the right third, density
reduction, the Gold end state.

**E — Protagonist entity.** One larger, brighter particle with a longer
trail, x tied directly to `scrollProgress`.

**F — Typography interaction.** Cached bounding boxes, repulsion field,
particles flowing around the name.

**G — Exit transition.** The Cascade — see the dedicated section above.
Must be a pure function of scroll progress (0.85–1.00), never a triggered
timeline, so it scrubs backwards correctly. Includes the nav fade-in.

**H — Hardening.** Performance pass, reduced-motion fallback, mobile
simplification, cross-browser check.

Stages C and D are the architecturally hard parts — worth using the
strongest available model for those specifically. A, F, G, H are more
mechanical.

---

## Anti-goals

Explicitly avoid:
- three obvious boxes
- generic glowing particle backgrounds
- excessive neon, "AI" clichés
- unnecessary 3D
- animation for its own sake
- sacrificing readability for visual complexity
- a two-column "text + graphic" hero layout
