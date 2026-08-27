# UI pattern review — stats block and project expansion

Written as a design review, not a restyle. No code in this document —
diagnosis, alternatives, and a recommendation only, per the brief.

---

# Part 1 — Diagnosis

## What's actually creating the "AI-generated" impression

It isn't "too many boxes." It's **identical structural rhythm, repeated
without variation.**

### The stats block specifically
- **Small mono label → large bold value, repeated five times with zero
  variation between instances.** This exact rhythm (label-then-value,
  same size, same weight, same spacing, every single time) is the
  literal template for "stat card" components in nearly every UI kit
  and dashboard generator. The moment a human eye detects that a
  component repeats itself identically N times, it reads as generated
  rather than composed — a person writing about themselves doesn't
  naturally produce five facts in perfectly identical grammatical and
  visual shape.
- **The accent colour is applied to every single value, indiscriminately.**
  Five things in the same orange isn't emphasis, it's just the "value"
  styling — the colour has stopped meaning anything. (This is exactly
  the failure mode the Flight Recorder palette was built to prevent
  elsewhere on the site; this component doesn't follow that rule.)
- **The vertical divider forcing a rigid 2-column grid** is a dashboard
  convention specifically, not an editorial one — it exists to align
  unrelated metrics, not to compose a personal introduction.
- **"Current Project: ~"** reads as an unfinished placeholder rather
  than a considered piece of content, which reinforces the generated
  feeling even though it's probably just genuinely still in progress.

### The project expansion specifically
- Same root cause, same tell: **four section labels (WHAT INVOLVED /
  TOOLS / CAPABILITIES / STATUS) in identical orange-uppercase-mono
  styling, each followed by content in an identical pattern.** Four
  repetitions of one template.
- **Left accent border + rounded dark container** is about as
  recognisable as UI patterns get — it's the default "Card" component
  in most component libraries, frequently reached for by AI-assisted
  builds specifically because it's the path of least resistance for
  "here is a labeled bundle of related data."
- **Two separate pill-tag groups back to back** (Tools, then
  Capabilities) reads like an auto-generated props table more than a
  written project summary — the distinction between "tool" and
  "capability" isn't obvious to a reader and doubling the pill pattern
  makes it feel systematic rather than communicative.
- **`PIPE-01` top-left + a pill badge top-right** is a literal
  card-header metadata convention — ID and category tag flanking a
  title is exactly how generated project/ticket cards are laid out.
- **Solid orange rounded CTA button** is the single most generic
  "primary action" styling that exists — every component library's
  default button looks close to this.

**The unifying diagnosis:** both components take a bundle of loosely
related facts and force them into one repeating micro-template, then
wrap that template in a bordered container to signal "this is a
component." That combination — repetition + containment — is what reads
as generated, regardless of the specific colours or spacing used.

---

# Part 2 — Alternatives: personal stats block

## A. Fold into prose
Remove the component entirely. Years-in-data, current role, and degree
already substantially overlap with what the hero and About copy already
say — this is largely redundant information wearing a UI component.
Where genuinely new, fold as a clause into existing prose.

- **Structure:** none — no new component, existing paragraphs absorb it
- **Interaction:** none
- **Kept:** whichever facts aren't already stated elsewhere
- **Removed:** the "1 year in data" framing specifically — reads as a
  slightly awkward stat to lead with, especially as the number climbs
- **Why less generic:** prose has no repeating structure to read as
  generated
- **Complexity:** trivial — content edit, zero engineering risk

## B. One oversized editorial line
A single large typographic statement — pull-quote scale, the site's
display font, no border, no grid — standing alone between hero and
About. Forces prioritisation to one or two facts instead of five.

- **Structure:** one or two oversized text elements, generous whitespace
- **Interaction:** optional one-time fade/rise on scroll into view
- **Kept:** the single most interesting true thing, phrased as a line
- **Removed:** everything else — folded into prose or cut
- **Why less generic:** an oversized single statement is the structural
  opposite of a repeated-field grid — reads as authored
- **Complexity:** low, pure typography/CSS

## C. Marginal annotation
Small, quiet facts running down the page margin near hero/About — like
footnotes, not headline content. Demotes these facts to supporting
detail rather than a featured block.

- **Structure:** thin vertical column of small mono annotations in the
  page margin
- **Interaction:** none needed
- **Kept:** all facts, since low visual weight means more can be
  included without clutter
- **Removed:** nothing content-wise, just de-emphasised
- **Why less generic:** correctly weights these facts as supporting
  rather than headline information
- **Complexity:** low-medium — needs a real mobile collapse plan, true
  margins don't exist on narrow screens

## D. A single status line
Keep only "currently exploring" and "current project" — the two facts
that actually change over time — as one quiet line in the site's
existing mono/terminal voice, the same device already used for the
footer's `// last_run: success`.

- **Structure:** one line of text, no box
- **Interaction:** optionally genuinely dynamic, reinforcing "currently"
- **Kept:** only the two "alive" facts
- **Removed:** years/role/degree entirely — already stated in the hero
  one-liner and About copy, repeating them here is pure redundancy
- **Why less generic:** reuses a device that's already proven to work
  on this specific site, rather than introducing a new template
- **Complexity:** trivial

## Recommendation: D, combined with A for the rest

Check the hero copy: role and degree are already stated there
("Aerospace engineer turned data engineer..."), and years-in-data is
close to redundant with that framing too. **This block is mostly
repeating information the page already states elsewhere** — the
strongest move is cutting years/role/degree entirely rather than
re-presenting them, and keeping only a small `//`-style status line for
the two facts that are genuinely new and alive. This is the option that
best matches "decide some of this information doesn't need to be
displayed at all," and it's the lowest-risk, smallest change of the
four.

---

# Part 3 — Alternatives: project expansion

## A. Full-bleed editorial takeover
Clicking a node expands the projects section into a large in-page
editorial spread — big title, generous-width body prose for "what
involved," tools and capabilities merged into one relaxed inline list
separated by `·` rather than pill groups, status as a quiet mono note,
CTA as a plain text link with an arrow. No container, no border — other
nodes dim/recede rather than the expansion sitting in a box.

- **Structure:** no container at all, typography and spacing do the
  organising
- **Interaction:** click → smooth in-place height expansion, other
  nodes fade/shrink; click again to collapse
- **Kept:** everything, but as continuous read rather than discrete
  labeled fields
- **Removed:** card container, pill tags, button styling, badge
- **Why less generic:** reads like an article revealing itself, not a
  panel opening — the most editorial of the four
- **Complexity:** medium — height-transition animation needs care to
  avoid layout jump, but no new visual language required

## B. Split layout
On expand, the area splits into two columns — left stays compact
(title, ID, status, a short plain tools list), right carries the "what
involved" prose full-width in larger body type. No shared border; two
zones of page working together, like a magazine spread.

- **Structure:** CSS grid, two columns, no card boundary
- **Interaction:** same click-to-expand trigger
- **Kept:** everything, separated by *role* (fact vs. narrative) instead
  of arbitrary section labels
- **Removed:** pill tags, CTA button, bordered container, badge
- **Why less generic:** the layout does real structural work instead of
  just restyling the same stack
- **Complexity:** medium — needs a genuine single-column collapse on
  mobile

## C. Minimal inline reveal
The expansion stays small and close to the clicked node — title, one
sentence, a text link to the (future) detail page. Nothing else shown
inline at all; tools, capabilities, and status move entirely to the
detail page.

- **Structure:** tiny, at most a single thin rule, no container styling
- **Interaction:** fast, low-key inline reveal
- **Kept:** title + one sentence only
- **Removed:** everything else, deferred to the detail page
- **Why less generic:** showing almost nothing is the confident,
  anti-template move — most generated UIs default to showing everything
  at once
- **Complexity:** lowest of the four — least new UI, safest bet if time
  is tight

## D. Typographic overlay
Clicking a node dims the page and a very large treatment of the title
appears, with two or three key facts as small annotations positioned
loosely around it rather than stacked in a list — closer to a film
title card than a UI panel.

- **Structure:** large centred/off-centre typography, satellite text
  elements, no shared bounding box
- **Interaction:** overlay-style dim + title entrance, dismiss on
  outside click
- **Kept:** title (large), 2–3 headline facts, link to detail page
- **Removed:** full tools/capabilities lists, all pill/badge/button
  styling
- **Why less generic:** the most visually distinctive and boldest of
  the four
- **Complexity:** medium-high — positioning "satellite" annotations so
  they read as intentional rather than scattered takes real care;
  highest execution risk here

## Recommendation: A, with C as the pragmatic fallback

**A — full-bleed editorial takeover — is the strongest fit** for what
you actually asked for: "I want these sections to feel like they belong
to [the] experimental/immersive experience." A page that visibly
*transforms* when you click a project is a genuinely immersive gesture;
a box that appears is not, no matter how it's styled. It also directly
matches your own suggestion of "a project becoming a larger section of
the page rather than opening a conventional UI component." It keeps
real content depth inline, which C deliberately doesn't.

**If build time is a real constraint given you're close to finished, C
is the honest fallback** — least new code, lowest risk, and it has a
strategic argument in its favour too: since detail pages are already
planned as separate later work, C is the only option that doesn't
duplicate that future effort. A is the better site; C is the faster one.

---

# Part 4 — What stays untouched either way

- Colour palette, typography, and the site's animation language —
  unchanged
- The flow-field particle system — unchanged, still runs behind
  everything as-is
- Actual project content (descriptions, tool lists, status) — reused
  as-is, only its *presentation* changes
- The click-to-expand interaction concept and the eventual link to a
  detail page — preserved, just restyled

Nothing here touches the node-graph itself, the hero, skills, or
dividers — this review is scoped exactly to the two components in the
screenshots.
