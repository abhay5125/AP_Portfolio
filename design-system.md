# Design system — Abhay Patel portfolio
### "Flight instruments, not dev-portfolio boxes"

The core problem with most developer portfolios: everything is a bordered rectangle in a grid, everything eases the same generic way, and nothing feels like it belongs to a single object in motion. This system fixes that by treating the whole site as one continuous instrument — a flight path that becomes a data path — so every typographic, spacing, and motion decision reinforces that one idea instead of decorating independently.

---

## 1. Typography

Keep the existing three-typeface system — it's already doing real work — but tighten the roles and add a fluid scale so nothing feels like static, boxed-in dev-portfolio type.

| Role | Typeface | Usage |
|---|---|---|
| Display | Space Grotesk (600/700) | H1/H2 only. Never body text. |
| Label / system voice | IBM Plex Mono (400/500) | Eyebrows, job IDs, status pills, stat labels, telemetry readouts, nav CTA |
| Body | Inter (400/500) | Paragraphs, descriptions, nav links |

**Fluid type scale** (replace fixed `clamp()` ad hoc values with a defined ramp — base 1rem = 16px, ratio 1.25):

```css
--fs-xs:   clamp(0.72rem, 0.7rem + 0.1vw, 0.78rem);   /* mono labels, tags */
--fs-sm:   clamp(0.85rem, 0.82rem + 0.15vw, 0.95rem);  /* body small, nav */
--fs-base: clamp(1rem, 0.96rem + 0.2vw, 1.05rem);      /* body */
--fs-lg:   clamp(1.15rem, 1.05rem + 0.5vw, 1.3rem);    /* subtitle */
--fs-xl:   clamp(1.6rem, 1.3rem + 1.5vw, 2.2rem);      /* section titles */
--fs-2xl:  clamp(2.4rem, 1.8rem + 3vw, 4.4rem);        /* hero H1 */
```

**Rules that keep it from feeling generic:**
- **Mono is a system, not decoration.** Every mono string on the page should read like it could be a real log line: lowercase, `//` prefixed, or a `key: value` pair. Never use mono just for stylistic contrast on a word that isn't functioning as a label.
- **One weight jump only.** Display type: 600 for section titles, 700 reserved for the H1 alone — that reservation is what makes the hero feel heavier than everything else.
- **Tracking:** mono labels get `letter-spacing: 0.03em`; display type gets `-0.01em` to `-0.02em` (tightens as size increases — bigger type needs *negative* tracking to avoid feeling loose).
- **Line-length discipline:** body copy stays 42–58ch max width (you already do this in `.hero__desc` and `.about__copy p` — extend the same measure to every text block, including project descriptions, which currently aren't constrained).

---

## 2. Spacing

Replace the implicit spacing values scattered through the current CSS with a single fluid scale, 8px base unit:

```css
--space-1: clamp(0.5rem, 0.45rem + 0.2vw, 0.65rem);
--space-2: clamp(1rem, 0.9rem + 0.4vw, 1.25rem);
--space-3: clamp(1.5rem, 1.3rem + 0.8vw, 2rem);
--space-4: clamp(2.5rem, 2rem + 2vw, 3.5rem);
--space-5: clamp(4rem, 3rem + 4vw, 6.5rem);
--space-6: clamp(6rem, 4.5rem + 6vw, 9rem);
```

**What makes spacing feel "fluid" instead of gridded:**
- **Break the 2-column symmetry.** The current hero and about sections are both rigid `1.05fr 0.95fr` / `1.4fr 1fr` splits — visually correct but reads as a template. Introduce one asymmetric section where content deliberately overlaps or bleeds past the grid column (e.g. the transition-story SVG extending slightly past the text column's edge, or a stat card overlapping the section boundary by `--space-2`). One controlled break in the grid per page is enough to signal "designed," not "templated."
- **Vertical rhythm scales with viewport, not just section padding.** Right now every `.section` gets flat `5rem` padding regardless of what's inside it. Let padding scale to content density: the transition-story section (visually heavy) gets `--space-6` above/below; text-only sections like Contact get `--space-4`.
- **No two adjacent elements share the exact same gap value.** Micro-rule, but it's what separates "spaced with a ruler" from "spaced by hand" — vary between `--space-2` and `--space-3` for related-but-distinct groupings (e.g. gap between a job title and its description vs. gap between the description and its tag list).

---

## 3. Color

Keep the palette family, extend it with the amber/teal narrative role and light-touch atmosphere — restrained, not flat-corporate.

```css
--ink:         #0B0F19;   /* base */
--panel:       #121826;   /* card surface */
--panel-alt:   #161D2E;   /* secondary surface, for depth without a border */
--panel-border:#232B3D;
--text:        #E7ECF5;
--text-muted:  #8C97AD;

--amber:       #F5A623;   /* aerospace / origin signal */
--amber-dim:   rgba(245, 166, 35, 0.12);
--teal:        #4FD1C5;   /* data / present signal */
--teal-dim:    rgba(79, 209, 197, 0.14);
```

- **Amber and teal are not decorative accents — they're a timeline.** Amber = aerospace-era content, teal = data-era content. Apply this consistently: JOB-01 (MATLAB/aerospace) gets an amber status pill and amber hover-glow, JOB-03/04 (data engineering) get teal. Right now all four jobs use the same teal/amber/gray status system based on *project status* (live/wip/archived) — keep that system for status, but layer a second, subtler amber↔teal cue (e.g. a 2px left border or a small corner mark) for *era*. Two encodings on the same object, not competing, both legible.
- **One permitted soft glow, used sparingly.** A radial gradient (`radial-gradient(ellipse at center, var(--teal-dim), transparent 70%)`) behind the hero SVG and behind the transition-story pin only — nowhere else. This is what pushes the site from "flat dev-portfolio" toward "fluid" without opening the door to gradients everywhere.
- **Never introduce a third hue.** If you need a semantic red/green (e.g. for a future "error" status), pull it from the same desaturation logic as amber/teal (test against the ink background at the same lightness), don't reach for a stock red.

---

## 4. Borders, radius & structure

The current 1px hairline + `rx: 8–10px` system on everything is the single biggest "generic dev portfolio" tell. Fix:

- **Retire the uniform bordered-box card.** Full 1px borders on every element (nav CTA, stat, job card, tag) is what makes the site read as boxes-in-a-grid. Replace with a tiered system:
  - **Tier 1 (primary content — job cards, hero diagram frame):** no border at all. Separation comes from a subtle background shift (`--panel` vs `--ink`) plus the accent-colored left edge described above. Border-radius `12px`.
  - **Tier 2 (secondary — stat cards, tags):** keep a hairline border, but only `border-bottom` or `border-left`, never all four sides. `border-radius` on these should be asymmetric (`8px 8px 8px 2px` style — one corner sharp) rather than uniform, which reads as more considered/less templated.
  - **Tier 3 (interactive — nav CTA, buttons):** full border is fine here, since it needs to read as a clickable boundary.
- **Section dividers stop being straight lines.** Replace `border-top: 1px solid var(--panel-border)` between sections with a thin SVG path (a single gently curved line, echoing the flight-path/pipeline motif) that runs the width of the page. Cheap to implement, and it's the detail that most reinforces "one continuous object" rather than "stacked sections."
- **Grid overlay gets asymmetry.** Currently a uniform 64px grid, full opacity everywhere. Let its opacity fall off unevenly (denser near the hero, thinning toward contact) using the existing `mask-image` approach — this alone makes the page feel like it has a gradient of intensity rather than uniform wallpaper.

---

## 5. Card style (jobs, stats, skills)

- **Job cards:** drop the uniform bordered-box treatment (§4). On hover, replace the current `translateY(-3px)` + border-color swap with a **path-draw**: a thin accent-colored line animates in from the card's edge (as if a connector from the pipeline diagram is reaching it), using `stroke-dashoffset`. This ties every hover state back to the site's one visual motif instead of being a generic "card lift."
- **Stat cards (About section):** keep the compact `dt`/`dd` structure, but let the four stats sit on a shared baseline "instrument strip" rather than a symmetric 2×2 grid — a single row (wrapping on mobile) reads more like a dashboard readout than a grid of boxes.
- **Skill tags:** current flat pill-per-skill loses all hierarchy. Group by proficiency depth within each category (e.g. size or weight varies slightly for "daily driver" vs "familiar with") rather than every tag being visually identical — this is a small change that adds real information density instead of decoration.

---

## 6. Animation principles

These five rules should be checked against *every* motion decision on the site. If a proposed animation doesn't clearly serve one of them, cut it — that discipline is what prevents the "random effects" feeling.

1. **One easing family, everywhere.** Define a single custom cubic-bezier that reads as *momentum/thrust*, not bounce or elastic — e.g. `--ease-flight: cubic-bezier(0.16, 1, 0.3, 1)` (fast start, long settle — like a craft decelerating, not a UI element bouncing). Every transition on the site — hover states, reveals, the scroll-story — uses this one curve. No `ease-in-out`, no spring/bounce anywhere.
2. **Scroll position is the only autonomous driver.** Nothing animates on a timer or on page-load for its own sake (no auto-playing carousels, no idle pulsing icons). Motion is triggered by scroll position or direct user interaction (hover/click) only. This is what stops the site feeling like a demo reel of effects.
3. **Everything enters along the implied path, in one direction.** Reveal animations shouldn't be generic "fade up" on every element independently. Pick a single directional logic tied to the flight-path/pipeline motif (e.g. content enters left-to-right along the same axis the hero diagram flows) and apply it consistently — sections, cards, and text blocks all animate along that one axis, never a mix of up/down/left/right/scale across different elements.
4. **Stagger is rhythmic, not decorative.** When multiple elements reveal together (job cards, stat cards, tag lists), the delay between them should be a fixed multiple of one base unit (e.g. `80ms` increments) — never eyeballed per-element. This is subtle but it's the difference between a sequence that feels *engineered* and one that feels like each element got a random delay.
5. **Motion always represents a state change, never just flourish.** Every animation should be answerable with "what changed?" — a hover reveals a connection (§5), a scroll advances the transition story (previous message), a status pill's color is load-bearing information. If an animation's only purpose is "look nice," it doesn't belong — this rule is what keeps the terminal/telemetry voice (`// last_run: success`) consistent with the motion design, not just the copy.

---

## 7. Image treatment

You currently have no photography on the site at all — worth being deliberate about this rather than defaulting to a headshot in a rounded square, which is the single most generic developer-portfolio move.

- **Default to diagram over photo wherever possible.** The site's strength is that it explains itself visually through system diagrams (pipeline, and soon the flight→data transition). Prefer extending that visual language over inserting conventional photography.
- **If you do use a headshot** (About section is the natural spot): treat it as an instrument readout, not a magazine photo — duotone it into ink/teal or ink/amber (matching whichever era the surrounding content is discussing), crop inside a frame with corner brackets (`⌐ ¬` style HUD marks) rather than a plain rounded rect, and keep it small — a supporting element, not a hero image.
- **Any screenshots of real dashboards/projects** (Power BI, Streamlit, F1 dashboard): crop tightly to the meaningful chart/result, apply a thin `1px` teal-tinted border consistent with §4's tier-2 treatment, and strip any surrounding browser chrome — the goal is that a project screenshot reads as "data," not as "a picture of a website."
- **No stock imagery, ever.** Nothing generic (laptop-on-desk, abstract "data" stock photos) — it's the fastest way to undercut everything else this system is doing.

---

## Quick reference: what changes vs. what stays

| Element | Current | Redesigned |
|---|---|---|
| Palette | ink/panel/teal/amber | Same, + amber↔teal timeline encoding + one restrained glow |
| Type | Space Grotesk / Plex Mono / Inter | Same faces, fluid scale, stricter role discipline |
| Cards | Uniform 1px border + rx 8–10 on everything | Tiered: borderless/accent-edge, hairline-partial, full-border only on interactive elements |
| Section dividers | Straight `border-top` | Thin curved SVG path |
| Reveal animation | Fade + translateY, per-element | Single directional axis, rhythmic stagger, one easing curve |
| Hover | translateY + border-color swap | Path-draw connector animation |
| Images | None | Diagram-first; duotone + HUD-frame treatment if photography is used |
