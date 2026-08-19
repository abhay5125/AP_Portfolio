# Portfolio redesign — project notes

A running log of decisions, in plain language, so you can look back at *why* something is the way it is without re-reading the whole chat. Add to the "Decisions log" and "Questions/things I don't understand yet" sections as we go — this file is yours to edit.

---

## Glossary (plain English, no jargon)

| Term | What it actually means |
|---|---|
| SVG | A picture file made of shapes and lines described in code, instead of pixels. Your current pipeline diagram is one. Good because it can be styled and animated with CSS. |
| CSS | The styling language that controls colors, spacing, fonts, and animation on a webpage. |
| CSS variable / design token | A named value (like `--teal: #4FD1C5`) you define once and reuse everywhere, so changing it in one place updates the whole site. |
| CSS transition | "When this property changes, animate it smoothly instead of snapping instantly." |
| IntersectionObserver | Code that watches your scroll position and says "the user has now scrolled into this section." Already used in your `script.js` for the fade-in effect. |
| State (state 1, 2, 3...) | Which version of something is currently showing — like a light switch with more than 2 positions. |
| Anchor point | A fixed x/y coordinate on the page that doesn't move, even as what's drawn there changes. |
| Easing curve | The "shape" of an animation's speed over time — starts fast and slows down, vs. constant speed, vs. bouncy, etc. |
| Artifact / file | Anything I create for you to download and use — code files, images, this notes doc. |
| Canvas | An HTML element that acts like a blank drawing surface — JavaScript draws shapes onto it frame by frame, which is how the particle dots are drawn. |
| GSAP | A JavaScript animation library. Handles the details of smoothly changing a value over time so you don't have to write that math yourself. |
| ScrollTrigger | A GSAP add-on that connects animations to scroll position — e.g. "pin this section in place, and as the user scrolls through it, animate this value from 0 to 1." |
| Pin (scroll) | Locking a section in place on screen for an extra stretch of scrolling, instead of letting it scroll past normally — what makes the hero feel like it's "responding" as you scroll rather than just sliding away. |
| Cache-busting | Adding something like `?v=2` to the end of a file's link so the browser treats it as a new file and re-downloads it, instead of reusing an old saved copy. |
| `git status` | Command that tells you what's changed in your project folder compared to what's already saved in git — the most useful command for figuring out "did my edit actually take effect." |
| `git add` / `commit` / `push` | The three-step save process: `add` stages your changes, `commit` saves them locally with a message, `push` sends them to GitHub so the live site updates. |

---

## Decisions log

### 1. Overall design direction
**Decided:** "Flight systems → data systems" — the site visually tells the story of your move from aerospace to data engineering, instead of being a generic dev portfolio. Amber = aerospace, teal = data, and one section shows the transition happening.

### 2. Design system
**Decided:** Keep the existing dark palette and font pairing (Space Grotesk / IBM Plex Mono / Inter), but make spacing and type sizes "fluid" (they scale smoothly with screen size using `clamp()` instead of jumping at breakpoints), replace uniform bordered boxes with a more varied card style, and define 5 animation rules so motion feels consistent instead of random. Full detail: `design-system.md` (already generated).

### 3. How the scroll animation is built
**Updated from the original plan.** We originally decided on a small number of fixed "states" that crossfade into each other. In practice, once we picked the particle-field concept (see 4b below), it made more sense to build this as a continuously scroll-scrubbed animation using GSAP + ScrollTrigger — particle positions recalculate every frame based on exact scroll position, so it feels fluid rather than snapping between steps. This was possible without GSAP's paid shape-morphing plugin because we're moving simple individual points, not morphing one complex hand-drawn shape into another.

### 4. What actually transforms (the visual concept)
**Decided: satellite network → pipeline diagram** (a refined version of "Concept A"). Three satellites orbit a globe, connect down to a ground station, which connects out to two mission-control points — the same three-source/one-hub/two-destination shape as the existing pipeline diagram. The trick: six anchor points stay in the same place the whole time; only what's drawn at each point (satellite dot → pipeline box) and the line style (dashed amber orbit link → solid teal data flow) changes between states.

*Why this instead of a plane wing:* it already has the same "dots connected by lines" shape as the pipeline diagram, so the crossfade needs almost no visual translation. It also covers more of the real background (planes, satellites, rockets) instead of committing to one vehicle type.

*Not used, but still relevant:* the robot bee (flapping-wing MAV) project stays in the Projects section as itself — a specific real project — rather than being the abstract visual metaphor for the whole site. F1 was considered but dropped as too niche/personal to represent the professional story.

### 4b. Hero animation concept — refined to a particle field
**Decided:** rather than one fixed wing or satellite drawing crossfading into the pipeline, the hero uses roughly 160 small drifting points ("Concept 2" out of three alternatives we compared — the others were a continuous shape-morph and a layered reveal with a scanning line). Before scrolling, the points drift idly, like a loose scattered data/satellite cluster. As the user scrolls through the pinned hero, each point is pulled toward one of six fixed target positions matching the pipeline diagram's node locations, so the cluster visibly assembles itself into the diagram. This replaced the earlier plan of one static illustration dissolving into another — no hand-drawn in-between artwork is needed, GSAP handles the motion.

### 5. Hero build — stages 1 and 2, complete
- **Stage 1** (idle particle field): added a `<canvas>` inside the hero, and a new `hero-animation.js` file that draws the drifting points. Falls back safely to the original static SVG diagram if JavaScript fails to run or the visitor has "reduce motion" turned on.
- **Stage 2** (scroll-triggered assembly): added GSAP + ScrollTrigger (loaded from a CDN, no install needed). The hero now pins in place for a stretch of scrolling, during which the particles are pulled into the pipeline shape, connecting lines fade in and shift from amber to teal, and the subtitle/description/buttons reveal in sequence.

### 6. Lessons learned along the way
- **Browser caching bit us once.** After updating `style.css`, the live site kept showing the old styling until we did a hard refresh / checked in an incognito window. Fix: added a version marker to the CSS link (`style.css?v=4` now) — bump this number any time `style.css` changes, so browsers always fetch the latest version instead of reusing a stale cached copy.
- **"I replaced the files but nothing changed" turned out to be a files-never-actually-replaced issue, not a code bug.** `git status` saying "nothing to commit, working tree clean" was the giveaway — it meant the files in the repo folder were still identical to the old ones, because the downloaded files landed in the Downloads folder and never actually got copied into the repo folder. Lesson: after downloading updated files, open them directly in a text editor to confirm they're actually the new version *before* touching git at all.

---

## Build order

- [x] Fix small content issues (typo, broken links, missing `https://`) — *done, see "content cleanup" decision above*
- [x] Set up design tokens (colors used consistently; formal CSS-variable cleanup can happen during polish pass)
- [x] Rebuild the hero section
- [x] Build the scroll-driven transition (particle field assembling into the pipeline, stages 1 + 2)
- [x] Content cleanup: typo, empty tag, LinkedIn link fixed; project links deliberately left as "#" pending internal pages
- [x] About stats strip + tiered project cards (three-color category system)
- [x] Sitewide continuous particle system + projects particle-card sequence with signature icons (stage 4)
- [ ] Skills section grouped by depth
- [ ] Curved SVG section dividers
- [ ] Final polish pass (nav scroll "altimeter," asymmetric grid fade, full reduced-motion/no-JS check across the whole site)
- [ ] *(later, not urgent)* Build dedicated project detail pages (`projects/job-01.html` etc.), then switch the project card links over from "#" to these real pages
- [ ] *(later, not urgent)* Satellite and plane projects — waiting on real content before adding

## Decided: project detail pages, not external repo links

You don't currently have these projects uploaded to GitHub, so rather than link out to repos that don't exist yet, each project card will eventually link to a dedicated page on the site itself — e.g. `projects/job-01.html`. This is recorded directly in `index.html` as comments above each project's links (search for "DECIDED" in the file). The links themselves are still `#` for now, since the pages haven't been built — they'll get switched over to real links in the same session where the pages actually get built. Not urgent; added to the build order below as a later step, not blocking the current work on project cards.

## Decided: three-color project category system

Extending the amber/teal "era" idea into a proper category system, since the four projects actually split into three kinds of work, not two:
- **Amber** — aerospace-origin analysis (JOB-01, the flapping-wing MAV project)
- **Teal** — data engineering (JOB-03, the NYC delivery pipeline)
- **Purple** — data analysis / quantitative work (JOB-02 trading backtest, JOB-04 F1 telemetry — kept together as one category rather than split further)

This applies to both the static project cards (left-edge accent + category pill) and, later, the particle-formed cards in the scroll sequence — same three colors either way, so the language stays consistent whether a card is still or assembling.

**Kept separate:** the existing live/work-in-progress/archived status per project is real, different information (is this actively maintained vs. a finished older project) and shouldn't be conflated with category color — it stays as a small muted text label rather than competing for the same color channel.

### 7. Stage 4 — sitewide continuous particle system, complete

The biggest single build so far. Replaced `hero-animation.js` entirely with one new file, `site-particles.js`, and one fixed full-viewport `<canvas>` (`#siteParticles`) instead of a canvas scoped to just the hero.

**How it actually works:**
- One shared pool of particle objects (160 "working" + 60 "always ambient" on desktop; both counts scale down automatically on weaker devices or small screens).
- The hero still assembles the pipeline diagram exactly as before, just drawing from this shared pool.
- Once the hero's pin finishes, those *same* particle objects get reused for the projects section — each project gets a slice of scroll (sized a little by how long its description is), split into assembly → hold → departure. ~120 particles trace the card's outline, ~40 form a small signature icon in the corner.
- Whatever particles aren't currently doing hero or project duty just drift gently in the background everywhere else on the page — margin-biased, capped opacity so they don't fight your reading text, colored to whatever's contextually nearest.
- Near the very bottom of the page, ambient particles drift toward the `// last_run: success` footer line and fade out — a deliberate "the system settles to rest exactly where it tells you it succeeded" touch.

**Per-project signature icons** (particle-drawn, in each card's corner):
- JOB-01 (MAV) — a simplified flying-insect silhouette
- JOB-02 (trading) — a small line-chart trace
- JOB-03 (delivery) — a delivery-scooter silhouette
- JOB-04 (F1) — a simplified F1 car side-profile

**Decided against for now:** adding the satellite and plane aerospace projects — staying at 4 projects until a first full draft exists; can revisit once there's real content for those two.

**Genuinely untested numbers, flagged in the code comments:** the scroll distance for the hero pin (`+=2500`) and for the projects pin (`+=6000`) are both estimates. Almost certainly need adjusting once you actually scroll through it live — that's expected, not a sign something's broken.

## Questions / things I don't understand yet
*(add to this as we go — no question is too basic)*

-
-
