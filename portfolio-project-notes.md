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

### 8. End-of-session review — critique and open decisions (stopped here for today)

**What's working well, don't touch further:** the hero particle assembly. Convergence looks good after the bugfix pass, motif is clear, appropriately impressive for the effort.

**What isn't working — honest critique:** the projects particle-card. Root cause diagnosed as more than just bugs: tracing a full rectangle *perimeter* with particles spreads them thin along boring straight edges, which doesn't give the same satisfying "gathering into a blob" feeling the hero's six clustered nodes have. This is likely the real reason it reads as "not fluid," more than any single bug.

**Bugs still open, with causes understood (not yet fixed):**
- **Projects card still clips at the bottom of the viewport** (improved by the padding/max-height fix, but not solved). Real fix identified: the pin currently covers the *entire* projects section (heading, intro, dots, card together) — should instead pin a smaller wrapper containing just the dots + card, letting the heading/intro scroll away normally first, reclaiming much more vertical space.
- **Particles disperse very slowly after settling at the footer, and don't reconverge the same way on a second pass.** Root cause: the shared particle pool means particles that got pulled into a tight cluster at the footer keep that clustered starting position next time they're needed for the hero or a project — so the second convergence looks like a small blob migrating into place, not the original organic scattered-field-converging look. This is a sign the "one shared pool touches literally everything, including the footer" design is now costing more than it's giving.

**Brainstormed directions for the projects section** (see chat for full detail on each):
1. Icon-only focus — drop particle-formed card outline entirely, keep the DOM card fully static/CSS-driven, particles only morph the small signature icon between projects.
2. Add motion trails — stop fully clearing the canvas each frame, let old positions fade instead of vanish. Cheap, big fluidity improvement, compatible with any other option.
3. Constellation/graph view — show all four project icons at once as a connected diagram, particles flow along connecting lines rather than forming outlines. Biggest structural change, leans hardest into the original "data flowing through a system" idea.
4. SVG icon morphing instead of canvas particles — trades organic particle feel for reliability and simplicity.
5. Spring-physics particle motion — organic "flocking" instead of each dot easing independently to its target. Best paired with option 1.

**My recommendation, not yet decided on:** combine option 1 + option 2 — best ratio of fixing the actual complaint to build effort, and structurally prevents the clipping bug rather than just patching around it.

**Open questions for next session:**
- Which brainstormed direction (or combination) to pursue?
- Okay to drop "particles form the whole card outline" as a concept?
- How important is literal particle continuity (same dots traveling the whole page) vs. same visual language without literal continuity? Relaxing this would let the footer use its own small dedicated particle set instead of reaching into the shared pool — fixes the reconvergence bug, less architecturally ambitious.
- Primary screen size/browser being used to test, to design layout fixes realistically.

**Also discussed:** whether to move to Claude Code for the remaining build items, since the download/replace/push loop is slow for this kind of iterative debugging. Decided to finish the current debugging round here; worth reconsidering Claude Code for Skills section / dividers / polish once projects is settled.

### 9. Strategic pivot — moving away from the continuous particle system

After the stage 4 debugging session, decided to step back rather than keep patching. Explicit new constraints for the next direction:
- Stay 2D — confirmed again, no WebGL (this was prompted by looking at an extremely ambitious WebGL/Three.js reference portfolio for inspiration; decided the *structural* ideas were worth adopting, not the tech stack).
- Drop the "one shared particle pool touches the whole page" architecture — it was the root cause of most of the stage 4 bugs.
- Drop particles forming the full project card outline — the actual complaint was that it didn't look fluid, not just that it was buggy.
- Keep wanting *some* animation throughout the site — just lighter-weight and more reliable.
- Liked ideas: the flight-plan/mission nav concept, and especially the orbit/constellation idea for projects.
- Motion trails, from the earlier brainstorm list, specifically requested as a replacement for the old ambient background particles.
- Project detail pages: still planned, but explicitly *after* the main layout/animation rework is settled, not before.
- **Smoothness is the top priority** for whatever direction gets chosen next — explicitly more important than visual ambition.

**Three new concepts proposed** (full detail in chat):
1. Flight-plan nav strip + orbiting projects diagram, CSS-driven transitions, trail accents on project-to-project movement. Hero mostly untouched.
2. Vertical mission-timeline rail + short triggered-once "docking sequence" animations per project (not scroll-scrubbed), sitewide cursor-trail effect. Flagged as the safest choice for smoothness specifically.
3. One persistent small orbit widget as both the sitewide nav and the animation system, unifying hero/nav/projects into one object. Most elegant, most structurally ambitious/risky.

**Not yet decided** — user is bringing follow-up ideas before committing to one.

### 10. Concept 1 — locked plan (before build starts)

**Decided:**
- Satellite-node click → inline summary brief → button to full project detail page (built later, placeholder for now)
- Flight-plan strip appears once scrolled past hero, separate from main nav
- Jump-nav enabled — relies on the site's existing `scroll-behavior: smooth`, so clicks animate rather than snap
- Mobile: simplified version is fine, not full parity with desktop
- Placeholder content system for now, real copy swapped in later
- ~1 week of non-consecutive effort budgeted; prioritize build speed without losing understanding
- Documentation style: tighter prose, teaching happens mainly through well-commented code, notes file kept current throughout
- Mid-build adjustments and multiple drafts expected and fine

**Hero rework — direction chosen:** combine "traveling entity" + "medallion architecture." Instead of particles converging into a generic pipeline, a single glowing entity travels along a path through real Bronze/Silver/Gold stages (a pattern actually used in the NYC delivery project), with each stage lighting up and revealing a short blurb as the entity arrives, tied to scroll position. Rejected: star schema layout (too visually similar to the projects node-graph, would feel repetitive).

**Projects — direction chosen:** a node-graph/network diagram (not a literal orbit) — deliberately chosen because it mirrors how orchestration tools like Airflow actually visualize pipelines, which is more authentic for a data engineer's site than a solar-system metaphor. Per-project icons (bee/insect for MAV, line chart for trading, scooter for delivery, F1 car silhouette) sit at each node, reusing icon designs from the earlier particle-card work.

**Immersion ideas for the node-graph, to build in:**
- Edges represent real shared skills/tools between projects, not decoration
- Hovering a node/edge highlights shared tags across the graph
- Depth-of-field: active node full clarity, others dimmed/blurred (CSS filter, cheap)
- A slow idle "scan" sweep across the graph as ambient motion, tying into the telemetry voice already used sitewide

**Resolved:** satellite project confirmed added — now 5 nodes in the projects graph, not 4. Hero direction (medallion architecture + traveling entity) confirmed, no changes wanted.

**Card field structure, confirmed:** Title, What involved, Tools, Status, Category — same fields for all five project summary briefs. Detail pages (results, images) stay deferred; main page comes first for a working base.

**Satellite project content:** placeholder for now (Title / What involved / Tools / Status / Category all blank), same treatment as the future detail pages — to be filled in later. Icon plan: a simplified satellite silhouette, reusing/simplifying the satellite concept sketched earlier in this project during hero-concept brainstorming (before medallion architecture was chosen instead).

**PLAN FULLY LOCKED as of this point.** Every open item from the Concept 1 discovery process is resolved. Next step is building, in whichever tool is chosen (this chat / Claude Code / Opus — see tooling plan above).

**Tooling plan:** Claude Code once active iterative building starts (skips the download/replace/push loop, matters more given the non-consecutive time budget). Opus specifically reserved for the projects node-graph system — the most architecturally complex remaining piece, worth getting right on a strong first pass.

### 11. Stage 5 — medallion hero built, old particle system retired

First build step of the locked Concept 1 plan. Two things in one step, because tearing out the old system alone would have left the site with no animation at all.

**Removed:**
- `site-particles.js` — deleted entirely (delete this from your repo too, it's no longer referenced)
- The full-viewport `<canvas>`, the `project-stage` content-swap element, the progress dots, and all their CSS
- The old generic API/Postgres/S3 → ETL → Warehouse pipeline SVG

**Built:** the new hero — Bronze/Silver/Gold medallion stages with one glowing entity travelling through them as you scroll. Each stage lights up in its own colour and reveals its blurb as the entity arrives.

**Why this is a much better foundation than the old version:** the previous system hand-drew ~220 particles on a canvas every frame. This moves ONE existing SVG element and toggles a few CSS classes — the browser does all the actual drawing. Far smoother, far less code that can go wrong, and it directly serves the "smoothness is the top priority" constraint.

**The key technique, worth remembering:** SVG paths have built-in `getTotalLength()` and `getPointAtLength()` methods. "Put the dot 40% along this track" is one line of code, and it works for any path shape — if the track is curved later, the code needs no changes.

**Also added:** the `--ease-flight` easing token (from design-system.md, animation principle 1) and `--amber-dim`, both of which were referenced in the design system but never actually existed in the CSS until now.

**Pin distance set to 1400px** (down from 2500 in the old build) — deliberately shorter, because long pins make scrolling back *up* tedious with scrubbed animations. It's a single number at the top of `hero-medallion.js` (`PIN_DISTANCE`), easy to tune.

**Still to come:** flight-plan nav strip, projects node-graph (5 nodes, Opus-recommended), skills section, dividers, polish, detail pages.

### 12. Medallion boxes rejected — hero rebuilt around particles again

The stage 5 medallion hero (three stage boxes + a dot travelling through) was rejected as less impressive than the particle version. Git reverted to the particle build. Stage 5's files are abandoned.

**Key realisation:** the particle hero was never the thing that was broken. The stage-4 failures were the *projects* card and the shared-pool architecture. The hero's convergence was explicitly signed off earlier as "looks good, don't touch further."

**New direction — full spec in `hero-architecture-spec.md`.** Headlines:
- The particle system *is* the hero. No two-column "text + graphic" layout — full-viewport interactive scene with typography living inside it.
- Particles get **lifecycles, not destinations** — they continuously spawn left, flow right, exit, respawn. This is the single change that fixes "everything parks and feels mechanical."
- Bronze/Silver/Gold expressed purely through particle *behaviour* (turbulence, lane snapping, speed uniformity, density) rather than any boxes or UI.
- `order = xFraction × scrollProgress` — one formula drives everything. Scroll feels like powering up the pipeline.
- Two independent systems: the rAF loop always runs (motion), ScrollTrigger only sets state. This separation is what guarantees continuous motion.
- Motion trails via `globalCompositeOperation = 'destination-out'` (erasing, not painting — required because the canvas is transparent over the grid overlay).
- Spring physics with velocity + damping instead of exponential easing, which mathematically can never overshoot — that was why the old motion felt mechanical.
- Turbulence via sum-of-sines, no noise library needed.
- WebGL explicitly ruled out as unnecessary at this particle count, and counterproductive for the learning goal.

**Build split into 8 stages (A–H)** in the spec. Stages C and D are the architecturally hard parts.

### 13. Creative-direction detour — explored and closed

Briefly explored moving away from the "tech portfolio" aesthetic entirely: five alternative creative directions were worked up (Drafting Table, Logbook, Route, Feature, Reel), plus a niche space/mission-documentation angle and a full asset/scope/roadmap assessment. Documents kept for reference: `five-creative-directions.md`, `direction-decision-and-roadmap.md`.

**Outcome: not pursued.** Returned to the particle hero direction. The detour was still worthwhile — it produced a much sharper brief for the particle hero than existed before it, and the two governing documents (`hero-architecture-spec.md`, `claude-code-prompts.md`) were written *before* the detour and remain fully valid.

**Current position:**
- Repo is on the stage-4 particle build (`site-particles.js`), which is exactly what the spec's preserve/discard lists were written against.
- The stage-5 medallion-box files are abandoned and have been deleted so they can't be used by mistake.
- `hero-architecture-spec.md` is complete and covers composition, hero content, colour, the Cascade exit transition, nav behaviour, performance constraints, and all eight build stages.
- `claude-code-prompts.md` has a ready-to-paste prompt per stage.

**Small content task noted:** now that the hero is only name + role + one-liner, the longer descriptive paragraph that used to live in the hero should move into the About section. Not blocking — handle during stage 6 of the Concept 1 plan.

**After the hero (stages A–H) completes,** the locked Concept 1 plan resumes: flight-plan nav strip, projects node-graph (5 nodes), skills section, curved dividers, polish pass, then project detail pages.

### 14. Palette decision — Warm Archive locked in

Explored three alternatives to the original amber/teal/purple-on-navy palette: Warm Archive (dark, warm-toned), Cool Precision (dark, blueprint blue with one warm accent), Warm Stone (light, cream/terracotta, editorial). Full swatch comparison built for reference: `palette-comparison.html`.

**Decided: Warm Archive.** Same dark register as before — same token *names*, only the hex values changed. `hero-architecture-spec.md`'s colour section is fully updated with the new values:
- `--ink` #14100D, `--panel` #1E1712, `--text` #F1E9DD, `--text-muted` #A89A87
- `--amber` (raw/Bronze) #D97D4A, `--teal` (insight/Gold) #4F9C8C, `--purple` (analysis category) #8E5A6B — new addition, needed because Warm Archive's original sketch reused grey for "analysis," which would have collapsed two project categories into one colour.

**Why this and not the others:** lowest technical risk — nothing in the hero spec needed rethinking, it's a token-value swap not a redesign. Verdigris-as-insight is a nice double meaning (verdigris is literally aged bronze/copper), reinforcing the Bronze→Gold metaphor.

**Warm Stone — deferred to v2, not discarded.** The genuinely most distinctive of the three, but adopting it now would mean redesigning every section for light mode, not just the hero — a bigger scope change than made sense right before starting the build. Full values preserved in `palette-comparison.html` for whenever this gets picked up properly.

**One technical note surfaced during this discussion, worth remembering:** the motion-trail technique (canvas alpha erase) is background-colour-agnostic and needs no changes either way. The insight-stage glow (near-white core) does NOT need to change for Warm Archive since it's still a dark palette — it WOULD need to invert (dark core instead of light) if Warm Stone is ever built.

**Status: ready to build.** All decisions closed. Next action is opening Claude Code and starting Stage A using `claude-code-prompts.md`.

### 15. Final particle direction — sitewide ambient flow, no pin

Supersedes the Orbital Migration recommendation from entry 14/`particle-system-concepts.md`. Revised, not just deferred to — new evidence changed the analysis: continuous flow (Stage B) had already been tested and loved, while Orbital was untested and hypothetical. Given the user has explicitly said visual result matters more than conceptual depth, "known to look beautiful" beat "theoretically more original."

**Decided:**
- No pin, anywhere on the site. Fixed full-page canvas, ambient the entire time.
- One motion rule: turbulence + a constant rightward bias (organic curved paths with a net left-to-right drift, not a straight line).
- One continuous `intensity` parameter driven by overall scroll fraction — controls turbulence amplitude, density, speed, size variance together. Explicitly rejected: six separately authored per-section behavioural states (too complex, risks looking choppy rather than continuous).
- One local effect layered on top: brief density/turbulence bump near project sections, tinted with that project's category colour. Nothing else is section-specific.
- Cursor: gentle repulsion/deflection, never attraction.
- Colour: majority neutral, accent reserved for project-proximity tint + rare "spark" particles.
- Bottom of page: no special handling needed — naturally sparse since `intensity` has been decreasing the whole way down. Optional: a few particles exit the bottom edge near the footer.
- **Hard rule:** no particle property may depend on the previous frame or scroll direction — everything recomputed fresh from current scroll position every frame. This is the rule that prevents repeating the dimming/reconvergence bugs hit twice already.

**Still reused from the pinned-hero spec:** turbulence technique, per-particle trail technique (the fixed version, not the flawed destination-out approach), colour-token reading, device-capability scaling, typography repulsion (particles still avoid the name, just not tied to a pin).

**No longer applicable:** pin distance tuning, the Cascade exit transition, nav fade tied to pin progress, medallion stage-trigger thresholds.

`hero-architecture-spec.md` has been amended with a notice at the top pointing to this decision — the original pinned-hero content below it is kept for reference but should not be built from.

### 16. Revert decision, rewritten prompts, palette finalised

**Revert:** clean revert to the Stage B commit (continuous flow, before lane-convergence), not a surgical removal of just the convergence code — lower risk of leftover dead code or subtle bugs from an incomplete strip-out. Build the new flow-field architecture fresh from that known-good point.

**`claude-code-prompts.md` fully rewritten** — six stages instead of the old eight (A–H), matching the simpler unpinned architecture:
1. Clean revert to Stage B
2. Core flow motion (turbulence + rightward bias)
3. Intensity parameter tied to scroll fraction, no pin
4. Interactions (project-proximity tint, cursor deflection, typography repulsion)
5. Colour (finalised Flight Recorder tokens)
6. Footer touch + hardening/performance pass

**Palette finalised: Flight Recorder, with two neutrals added for tonal range** (`--panel-alt` #201D19, `--bone` #C7C0B2), specifically to address a real concern — that a single-accent system could read as monotone rather than restrained. Fix wasn't adding more hues, it was giving the neutral family actual tonal range (steel → mid greys → bone) plus relying on the particle motion itself to keep ambient areas visually alive. Full token table now lives directly in `hero-architecture-spec.md`'s amendment section.

**Status: ready to build again.** Next action is Stage 1 in Claude Code.

### 17. Stage 1 (revert) and Stage 2 (flow field) — both done

**Stage 1, confirmed working.** Wiped `site-particles.js` back to exactly the Stage B commit — no picking-and-choosing which bits of the old lane/pin code to remove, just a clean reset to the last version we know looked good. Checked it against that old commit line by line to be sure it actually matched, and ran the site to confirm nothing broke.

**Stage 2: the actual motion is rewritten.** This is the "one motion rule" from the spec amendment — `velocity = turbulence(x, y, time) + rightward_bias` — replacing the old spring/vertical-wobble approach.

What changed, in normal words: before, particles had a fixed sideways speed picked once when they spawned, and only bounced up and down. Now there's no fixed speed at all — every frame, each particle looks at where it currently is and works out two things: which way the "wind" is blowing right there (using the same wavy sine/cosine trick that was already in the code, just used for both directions now instead of one), and a small constant push to the right. Add those together and that's the speed and direction it moves for that frame. Next frame, same thing again from scratch.

Why that matters: the wind is stronger than the constant push, so short bursts of moving backwards or sideways happen naturally — it's not gliding in a dead straight line. But the wind evens out over time (it swings positive and negative), while the rightward push never stops, so if you watch any one particle for a few seconds it's clearly drifted right overall. That's the "smoke in moving air" look instead of "conveyor belt."

Checked this properly rather than just eyeballing it — tracked a bunch of particles for 8 seconds each: all of them ended up further right than they started, and all but one of them moved backwards at some point along the way. So both halves of the brief are actually true, not just visually plausible.

**Left alone on purpose:** the trail-residue bug is back (it always comes back whenever we revert to Stage B, since the fix for it was part of the newer work we un-did). Not fixing it now — we said we'd deal with it once every stage is built, so leaving it as a known thing for later, not forgetting about it.

**What's next:** Stage 3 — tying an `intensity` number to how far down the page you've scrolled, so the whole field visibly calms down or livens up as you scroll, still with no pin anywhere.

### 18. Trail residue actually fixed this time, plus Stage 3 (scroll-tied intensity)

**Residue bug — fixed for real, not deferred.** Changed my mind on leaving it for later, decided to just kill it now instead. The old approach faded the whole canvas a tiny bit each frame instead of clearing it, and that can never fully fade to nothing (screen transparency is a whole number, so it gets stuck at "1" forever) — so every path a particle ever took stuck around as a faint permanent mark. New approach: every particle just remembers its own last 24 spots and draws its own little tail from those, and the screen gets a proper full wipe every frame. Ran it for 32 seconds this time (used to blow past 14,000 stuck pixels in 30 seconds) and it stayed under 35 the whole way through, no climbing. Actually fixed, not just less broken.

**Stage 3 — scrolling now changes the mood of the whole thing.** One number, `intensity`, goes from 0 at the very top of the page to 1 at the very bottom. Four things are tied to it, all blending smoothly from "top of page" to "bottom of page":
- **How strong the wind is** — energetic swirls up top, gentle drift by the bottom.
- **How fast things move** — same idea, brisk up top, slow by the bottom.
- **How many particles you can see** — each one has its own personal "I disappear around here" point picked when it's born, so they thin out gradually and individually rather than the whole screen dimming at once. Measured it: 100/100 visible at the top, 60/100 halfway down, down to about 5/100 at the very bottom.
- **How much sizes vary** — all different sizes up top, settling toward one consistent size by the bottom.

**The important bit — the number is never stored anywhere.** Every single frame, it's worked out fresh, directly from how far you've scrolled right now. Nothing is remembered between frames. This is the exact rule that got broken twice before in this project (see entry 8 — the footer particles that stayed dim forever, and the hero that formed differently the second time round) — both of those happened because some value was quietly carrying over instead of being recalculated properly. Tested this specifically: scrolled all the way to the bottom, then straight back to the top, and the top now looks exactly like a fresh page load did — no leftover dimness, no "it remembers where you've been" weirdness.

**Left alone on purpose (same as always):** the Projects section's own scroll-lock is a separate, older feature and hasn't been touched by any of this. Colour is still on the old orange/teal values — that's a deliberate later job, not forgotten.

**What's next:** Stage 4 — the "Interactions" stage: a colour/density bump near project sections, and gentle cursor deflection.

## Questions / things I don't understand yet
*(add to this as we go — no question is too basic)*

-
-
