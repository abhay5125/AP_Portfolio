// Sitewide particle system.
//
// One fixed <canvas> (#siteParticles, see .site-particles in style.css),
// drawn in viewport coordinates the whole time — it never scrolls with
// the page. Two independent things share it:
//
//   1. HERO FLOW — see the big comment block further down for the full
//      story. Short version: a pool of particles that drift around like
//      smoke, with no pinning anywhere — but their overall energy
//      (turbulence, speed, how many are visible, how much their size
//      varies) is tied to how far down the page you've scrolled.
//      Following the plan in hero-architecture-spec.md's AMENDMENT at
//      the top of that file (the original pinned/lane-based plan
//      further down that doc was tried, looked worse, and got dropped —
//      the amendment is the real plan now).
//   2. AMBIENT — a small pool that just drifts gently in the background
//      everywhere on the page.
//
// There used to be a third: a pool that assembled into each project's
// card outline as you scrolled through a PINNED projects section. That's
// gone — projects are a plain-scrolling SVG node graph now (see
// projects-graph.js), and nothing on the site pins any more.
//
// Each hero particle draws its own short trail from its own remembered
// recent positions, then the canvas gets a full, proper clear every
// frame — see the top of draw() below for why (a fading-instead-of-
// clearing trick used to live there, and turned out to be broken).
//
// Safety: if canvas, GSAP, or ScrollTrigger aren't available, or the
// visitor has "reduce motion" turned on, this script does nothing and
// the static fallbacks (.jobs cards) stay visible exactly as they are
// without JavaScript.

(function () {
  var canvas = document.getElementById('siteParticles');
  if (!canvas || !canvas.getContext) return;

  var prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;
  if (prefersReducedMotion) return;

  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    return; // libraries failed to load — fallbacks stay visible
  }
  gsap.registerPlugin(ScrollTrigger);

  var ctx = canvas.getContext('2d');
  var navEl = document.querySelector('.nav');
  var projectsSection = document.querySelector('#projects');
  var footerLogEl = document.querySelector('.footer__log');
  var heroTextEl = document.querySelector('.hero__content');

  // ---- device capability check — fewer particles on weaker devices ----
  var isLowPower =
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
    window.innerWidth < 700;
  // Background drifting particles (separate from the hero flow field,
  // which has its own budget further down).
  var AMBIENT_COUNT = isLowPower ? 120 : 220;

  // ---- design tokens, read from CSS so colors stay in sync with style.css ----
  function hexToRgb(hex) {
    var clean = hex.trim().replace('#', '');
    var value = parseInt(clean, 16);
    return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
  }
  var rootStyle = getComputedStyle(document.documentElement);
  // Flight Recorder palette (see hero-architecture-spec.md's amendment).
  // steel/bone are the neutral range almost every particle draws from;
  // accent is the ONE saturated colour, used sparingly (see drawHeroParticles).
  var COLORS = {
    steel: hexToRgb(rootStyle.getPropertyValue('--steel').trim() || '#55524B'),
    bone: hexToRgb(rootStyle.getPropertyValue('--bone').trim() || '#C7C0B2'),
    accent: hexToRgb(rootStyle.getPropertyValue('--accent').trim() || '#F04E1B'),
    text: hexToRgb(rootStyle.getPropertyValue('--text').trim() || '#EDEBE6'),
    muted: hexToRgb(rootStyle.getPropertyValue('--text-muted').trim() || '#8A867E')
  };
  function lerpColor(a, b, t) {
    return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
  }
  function rgba(c, a) {
    return 'rgba(' + Math.round(c.r) + ',' + Math.round(c.g) + ',' + Math.round(c.b) + ',' + a + ')';
  }
  // Same idea as lerpColor above, but for a plain number instead of a
  // colour: t=0 gives a, t=1 gives b, anything between blends the two.
  // Used a lot below to say "this value at the top of the page, that
  // value at the bottom, blended by how far down you've scrolled."
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // =====================================================================
  // HERO — flow field particles (Stages 2 + 3)
  //
  // This follows the "one motion rule" from the amendment at the top of
  // hero-architecture-spec.md:
  //
  //     velocity = turbulence(x, y, time) + rightward_bias
  //
  // In plain terms: every particle is nudged around by the same swirling
  // "wind" pattern (the turbulence part), and on top of that, everything
  // gets a small constant push to the right (the bias part). Nothing
  // pulls a particle toward a destination — it just keeps drifting
  // forever, spawning on the left and fading back in on the left again
  // once it wanders off the right-hand side.
  //
  // What that looks like: short-term, a particle's path curves and loops
  // — the swirl is usually stronger than the constant push, so it can
  // even drift backwards for a moment. But the rightward push never lets
  // up, while the swirl averages out to roughly nothing over time, so
  // zoom out a few seconds and every particle has clearly drifted
  // rightward. That's the "smoke in moving air" feel the amendment asks
  // for, rather than particles all marching right in a straight line
  // like items on a conveyor belt.
  //
  // On top of that base motion, one further number — `intensity` — now
  // ties the whole field's character to how far down the page you've
  // scrolled (0 at the top, 1 at the bottom). See currentIntensity() and
  // the constants just below it for exactly how that works and why it's
  // recalculated fresh every frame rather than stored anywhere.
  // =====================================================================

  // Budget from the spec's "Performance constraints": ~250 particles on
  // desktop, ~100 on lower-power devices/small screens (isLowPower is
  // computed above, next to AMBIENT_COUNT).
  var HERO_PARTICLE_COUNT = isLowPower ? 100 : 250;
  var heroParticles = [];

  // How far off-screen a particle spawns/exits, in pixels — kept as one
  // constant so the left (spawn) and right (exit) edges always agree;
  // used by both resetHeroParticle() and drawHeroParticles() below.
  var HERO_EDGE_MARGIN = 40;

  // A running clock, advanced by a fixed small step every frame (see
  // draw() below) rather than real elapsed time — simple, and matches
  // how every other motion in this file already works (nothing here is
  // frame-rate-corrected). It only exists to feed the turbulence formula
  // below; nothing else reads it.
  var heroTime = 0;

  // How many recent positions each particle remembers, for drawing its
  // trail — see p.trail in resetHeroParticle() and the drawing code in
  // drawHeroParticles() below. 24 frames of history at roughly 1px of
  // movement per frame gives a tail around 25px long.
  var HERO_TRAIL_LENGTH = 24;

  // Resets one particle object in place — used both to build the initial
  // set and to "respawn" a particle once it exits off the right edge.
  // Mutating the existing object (instead of creating a new one each
  // time) avoids constantly allocating fresh objects while the loop runs.
  //
  // spawnAtLeftEdge: true when a particle is respawning after exiting —
  // it appears just off the left edge of the screen so the re-entry isn't
  // an abrupt pop-in. false is only used for the very first fill, so the
  // hero doesn't look empty for a moment while everything walks in from
  // the left on page load.
  //
  // Note there's no vx/vy stored on the particle any more. Under the old
  // spring-based motion, velocity had to persist and build up between
  // frames. Under the flow field, velocity is worked out completely
  // fresh every single frame from the particle's current position — see
  // drawHeroParticles() below — so there's nothing to store here.
  //
  // p.densityThreshold and p.trail ARE stored on the particle, and it's
  // worth being clear about why that doesn't break the "no memory of
  // previous frames" rule. densityThreshold is a fixed personal trait —
  // picked once at spawn and never changed — exactly like p.r or p.phase
  // already were. It's not history, it's identity. p.trail is a short,
  // fixed-length rolling window of this particle's own last ~24
  // positions, purely for drawing its comet tail; it doesn't affect how
  // the particle behaves, isn't tied to scroll in any way, and can't
  // build up or get stuck the way the old bugs did.
  // Collapses a particle's whole trail onto its CURRENT x/y — used any
  // time a particle's position jumps discontinuously (edge wrap, or a
  // full respawn), so the trail never draws a line between the old spot
  // and the new one.
  function collapseHeroTrail(p) {
    if (!p.trail) {
      p.trail = [];
      for (var t = 0; t < HERO_TRAIL_LENGTH; t++) p.trail.push({ x: p.x, y: p.y });
      return;
    }
    for (var t2 = 0; t2 < p.trail.length; t2++) {
      p.trail[t2].x = p.x;
      p.trail[t2].y = p.y;
    }
  }

  function resetHeroParticle(p, spawnAtLeftEdge) {
    p.x = spawnAtLeftEdge ? -HERO_EDGE_MARGIN - Math.random() * 60 : Math.random() * window.innerWidth;
    p.y = Math.random() * window.innerHeight;
    p.r = Math.random() * 1.4 + 0.6;
    p.alpha = Math.random() * 0.35 + 0.35;
    p.phase = Math.random() * Math.PI * 2; // offsets each particle's turbulence so they don't all wobble in sync
    p.densityThreshold = Math.random(); // the intensity level at which this particle fades out (see drawHeroParticles)

    // Colour identity (Stage 5). tone picks this particle's own spot
    // between --steel (dark) and --bone (light) — every particle gets a
    // slightly different value, which is what gives the neutral field
    // real tonal range instead of every particle being one flat grey.
    // isSpark is a rare (~5%) flag that makes a particle render in the
    // one --accent colour instead — a rare flash, not a common colour.
    p.tone = Math.random();
    p.isSpark = Math.random() < 0.05;

    // Footer touch (Stage 6) — see the bottom-edge check in
    // drawHeroParticles(). Only matters once intensity is already high
    // (i.e. near the very bottom of the page); does nothing anywhere else.
    p.exitsDown = Math.random() < 0.12;

    collapseHeroTrail(p); // see above — avoids a streak from the old position to the new one
    return p;
  }

  function createHeroParticles() {
    heroParticles = [];
    for (var i = 0; i < HERO_PARTICLE_COUNT; i++) {
      heroParticles.push(resetHeroParticle({}, false));
    }
  }
  createHeroParticles();

  // =====================================================================
  // INTENSITY (Stage 3)
  //
  // One number, 0 at the very top of the page, 1 at the very bottom.
  // Everything about how "energetic" the flow looks — how strong the
  // wind is, how fast particles move, how many are visible, how much
  // their size varies — is just this one number blended between a "top
  // of page" value and a "bottom of page" value. Nothing is tuned
  // per-section; scrolling from the hero into About into Projects just
  // slides this one dial down continuously the whole way.
  //
  // CRITICAL: this is worked out FRESH, every single frame, directly
  // from window.scrollY. There is no variable anywhere holding "the
  // current intensity" between frames — it's recalculated from scratch
  // each time this function runs. That's not a style choice, it's the
  // spec's hard rule: nothing here is allowed to remember what happened
  // last frame or which way you were last scrolling. That exact kind of
  // leftover state is what caused two real bugs earlier in this project
  // (particles that dimmed near the footer and never brightened back up,
  // and a hero that formed differently the second time you scrolled
  // through it) — both were some value quietly carrying over between
  // frames instead of being read fresh. Reading window.scrollY directly
  // can't have that problem, because there's nothing to carry over.
  function currentIntensity() {
    var scrollable = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollable <= 0) return 0; // page is shorter than the screen — nowhere to scroll, stay calm
    return Math.max(0, Math.min(1, window.scrollY / scrollable));
  }

  // ---------------------------------------------------------------
  // The "top of page" / "bottom of page" ends of every blend below.
  // Grouped here so the whole behaviour table is readable in one place
  // instead of scattered through the loop.
  // ---------------------------------------------------------------

  // Turbulence: how strong the wind is. Energetic up top, calmer down
  // the bottom — but never fully still, so it always reads as "smoke,"
  // just quieter smoke.
  var HERO_TURBULENCE_MAX = 0.85; // top of page
  var HERO_TURBULENCE_MIN = 0.25; // bottom of page

  // Speed: the constant rightward push. Same top/bottom idea.
  var HERO_SPEED_MAX = 0.35; // top of page
  var HERO_SPEED_MIN = 0.12; // bottom of page

  // Size variance: every particle has its own random radius (p.r, set
  // once at spawn). Near the top, particles are drawn at their own true
  // size — lots of variety. Near the bottom, every particle's drawn size
  // blends toward this one shared value instead, so the variety settles
  // out into something more uniform.
  var HERO_UNIFORM_RADIUS = 1.0;

  // Density: how wide a band of intensity a particle takes to fade out
  // (see densityThreshold below). Wider = a gentler, more gradual thinning.
  var HERO_DENSITY_FADE_BAND = 0.18;

  // Stage 4 tuning knobs — kept together so they're easy to find/adjust.
  var HERO_PROJECT_EFFECT_RADIUS = 160; // extra reach beyond the project card's own edge
  var HERO_PROJECT_TURBULENCE_BOOST = 0.6; // up to +60% wind right at the card
  var HERO_CURSOR_RADIUS = 90;
  var HERO_CURSOR_STRENGTH = 0.6; // secondary to ambient flow (top-of-page turbulence maxes at 0.85)
  var HERO_TEXT_REPEL_RADIUS = 260;
  var HERO_TEXT_REPEL_STRENGTH = 14; // divided by distance below — spec says "strength proportional to 1/distance"

  function drawHeroParticles(intensity) {
    var turbulenceStrength = lerp(HERO_TURBULENCE_MAX, HERO_TURBULENCE_MIN, intensity);
    var rightwardBias = lerp(HERO_SPEED_MAX, HERO_SPEED_MIN, intensity);

    // ---- PROJECT-PROXIMITY EFFECT SETUP ----
    // The ONLY section-specific behaviour in the whole system, per the
    // spec. Worked out once per frame (not per particle) from
    // projectsBox, a plain cached object — see cacheProjectsBox() above
    // draw(). No DOM read happens here at all.
    //
    // This used to key off the old pinned project card. That card is gone
    // (the projects section is a node graph now, and nothing on the site
    // pins any more), so it keys off the projects SECTION instead — same
    // effect, just anchored to something that still exists.
    //
    // The glow always tints toward --accent, not a per-category hue —
    // --accent is "the one striking colour" in the finalised palette, so
    // this is exactly where it gets spent rather than being split up.
    var projectGlowActive = false, projectCx = 0, projectCy = 0, projectRadius = 0;
    if (projectsBox) {
      projectCx = projectsBox.cx;
      projectCy = projectsBox.docCy - window.scrollY; // document position -> on-screen position
      projectRadius = projectsBox.radius + HERO_PROJECT_EFFECT_RADIUS;
      projectGlowActive = true;
    }

    for (var i = 0; i < heroParticles.length; i++) {
      var p = heroParticles[i];

      // How close this particle is to the project card right now, 0
      // (far away, or no card showing) to 1 (right on top of it). Purely
      // a function of this particle's current position and the card's
      // current position — nothing stored, nothing scroll-direction
      // dependent.
      var projectBoost = 0;
      if (projectGlowActive) {
        var pdx = p.x - projectCx, pdy = p.y - projectCy;
        var pdist = Math.sqrt(pdx * pdx + pdy * pdy);
        projectBoost = Math.max(0, 1 - pdist / projectRadius);
      }

      // ---- THE WIND: turbulence(x, y, time), as two numbers ----
      // This is the exact same sum-of-sines shape used in the old
      // vertical-only version — Math.sin(...) * Math.cos(...) — just
      // sampled twice, once to push sideways and once to push up/down.
      //
      // The two samples deliberately don't use identical numbers: X and
      // Y are swapped between them, and the speed each one moves at over
      // time is different (heroTime * 0.8 vs heroTime plain). If both
      // used the exact same formula, sideways and up/down motion would
      // rise and fall in lockstep and the whole thing would just look
      // like the field breathing in and out together. Making them
      // slightly different is what breaks that symmetry and turns it
      // into the individual loops and curls that read as "smoke."
      var windX = Math.sin(p.y * 0.013 + heroTime * 0.8 + p.phase) * Math.cos(p.x * 0.010 - heroTime * 0.5 + p.phase);
      var windY = Math.sin(p.x * 0.010 + heroTime + p.phase) * Math.cos(p.y * 0.013 - heroTime * 0.7 + p.phase);

      // Local turbulence bump near the project card — the "brief
      // density/turbulence bump" the spec asks for. Everywhere else on
      // the page projectBoost is 0, so this is a no-op there.
      var localTurbulence = turbulenceStrength * (1 + projectBoost * HERO_PROJECT_TURBULENCE_BOOST);

      // ---- VELOCITY = WIND + CURRENT ----
      // Worked out completely fresh, every frame, from this particle's
      // position right now — nothing here is added to or carried over
      // from last frame. That might sound like it should look jerky, but
      // it doesn't: the sine/cosine waves above only change gradually as
      // x, y and time creep forward a tiny bit each frame, so the numbers
      // they produce only creep too. Smooth inputs, smooth outputs — no
      // momentum/carry-over needed to make it look fluid.
      var vx = windX * localTurbulence + rightwardBias;
      var vy = windY * localTurbulence;

      // ---- CURSOR REPULSION ----
      // Small, local, always secondary to the flow above — this only
      // ever nudges the velocity the wind already produced, never
      // replaces it. Pushes AWAY from the cursor (particle position
      // minus cursor position), never toward it.
      if (mouseX !== null) {
        var cdx = p.x - mouseX, cdy = p.y - mouseY;
        var cdist = Math.sqrt(cdx * cdx + cdy * cdy);
        if (cdist < HERO_CURSOR_RADIUS && cdist > 0.01) {
          var cursorPush = (1 - cdist / HERO_CURSOR_RADIUS) * HERO_CURSOR_STRENGTH;
          vx += (cdx / cdist) * cursorPush;
          vy += (cdy / cdist) * cursorPush;
        }
      }

      // ---- TYPOGRAPHY REPULSION ----
      // Reads the box cached once at load/resize (see cacheHeroTextBox
      // above draw()) — no layout read here, just arithmetic. Pushes
      // away from the text block's centre, strength inversely
      // proportional to distance, exactly as the spec's technique
      // describes, so particles curve around the name instead of
      // passing straight through it.
      if (heroTextBox) {
        var tdx = p.x - heroTextBox.cx, tdy = p.y - heroTextBox.cy;
        var tdist = Math.sqrt(tdx * tdx + tdy * tdy);
        if (tdist < HERO_TEXT_REPEL_RADIUS && tdist > 0.01) {
          var textPush = HERO_TEXT_REPEL_STRENGTH / Math.max(tdist, 20);
          vx += (tdx / tdist) * textPush;
          vy += (tdy / tdist) * textPush;
        }
      }

      p.x += vx;
      p.y += vy;

      // Wrap vertically. The hero is a self-contained scene (not a tall
      // page section), so a particle that drifts off the top/bottom just
      // reappears on the opposite edge rather than being lost.
      //
      // The trail gets collapsed to the new position on a wrap, same as
      // a respawn does. Without this, the trail array would still hold
      // positions from the old edge (e.g. near y=900) right next to the
      // new one (y=0), and drawing a line through both would streak a
      // random vertical line across the whole screen — that streak is
      // exactly the bug reported and fixed here.
      if (p.y < 0) { p.y = window.innerHeight; collapseHeroTrail(p); }

      if (p.y > window.innerHeight) {
        // Optional footer touch (Stage 6, per the spec's footer bullet):
        // near the very bottom of the page, a small fixed fraction of
        // particles (p.exitsDown, ~12%, picked once at spawn) exit
        // through the bottom edge instead of wrapping back to the top —
        // a small nod to the flow "continuing beyond what's visible,"
        // rather than every particle only ever exiting right. Everyone
        // else wraps exactly as before.
        //
        // Respawns the instant it crosses the edge, with no extra margin
        // to travel first (unlike the right-edge exit, which waits
        // HERO_EDGE_MARGIN px). An earlier version tried to make it
        // travel that same extra distance first, but nothing in this
        // flow field pushes particles in a fixed direction — velocity
        // here is pure side-to-side/up-down wind (see the "one motion
        // rule" above), so a particle sitting right at the bottom edge
        // just wanders in place rather than reliably continuing on
        // through. Respawning immediately sidesteps that without
        // inventing a separate "falling" motion mode just for this
        // decorative touch.
        if (p.exitsDown && intensity > 0.85) {
          resetHeroParticle(p, true);
        } else {
          p.y = 0;
          collapseHeroTrail(p);
        }
      }

      // Once a particle has drifted past the right edge, respawn it at
      // the left and let it start the same wandering loop again — it
      // never "arrives" anywhere, it just keeps flowing.
      if (p.x > window.innerWidth + HERO_EDGE_MARGIN) {
        resetHeroParticle(p, true);
      }

      // ---- RECORD THIS FRAME'S POSITION INTO THE TRAIL ----
      // Slide every remembered position down one slot, then write the
      // current position into the last slot — trail[0] is the oldest
      // point remembered, the last entry is where the particle is right
      // now. Drawn below as a short comet tail. This is the fix for the
      // trail-residue bug: each particle owns its own short, bounded
      // history and draws it explicitly, rather than the canvas relying
      // on an old frame slowly (and, it turned out, never completely)
      // fading away on its own.
      var trail = p.trail;
      for (var t = 0; t < trail.length - 1; t++) {
        trail[t].x = trail[t + 1].x;
        trail[t].y = trail[t + 1].y;
      }
      trail[trail.length - 1].x = p.x;
      trail[trail.length - 1].y = p.y;

      // ---- DENSITY: does this particle even get drawn right now? ----
      // Every particle has its own fixed densityThreshold (0-1, picked
      // once at spawn — see resetHeroParticle). As intensity climbs past
      // that threshold, this particle's opacity ramps smoothly down to 0
      // over a band HERO_DENSITY_FADE_BAND wide, centred on its own
      // threshold. Because every particle has a different threshold,
      // they don't all vanish at once — the field thins out gradually,
      // particle by particle, rather than the whole thing dimming or
      // popping as one block. This is a pure function of (this
      // particle's fixed threshold, the current intensity) — nothing
      // here depends on whether this particle was visible last frame.
      var densityFade = Math.max(0, Math.min(1,
        (p.densityThreshold - intensity) / HERO_DENSITY_FADE_BAND + 0.5
      ));
      // Project proximity also brings faded particles back — part of
      // the same "density bump" as the turbulence boost above.
      densityFade = Math.max(densityFade, projectBoost);
      if (densityFade <= 0.01) continue; // fully faded — not worth drawing

      // ---- SIZE VARIANCE: this particle's own size -> one shared size ----
      var radius = lerp(p.r, HERO_UNIFORM_RADIUS, intensity);
      var alpha = p.alpha * densityFade;
      // ---- COLOUR (Stage 5) ----
      // Every particle's resting colour is its own personal spot between
      // --steel and --bone (p.tone, picked once at spawn) — that's what
      // gives the neutral field real tonal range instead of one flat
      // grey. A rare "spark" particle (~5%, see resetHeroParticle) skips
      // that and always renders in --accent instead. Either way, close
      // to the project card, colour blends the rest of the way toward
      // --accent — the ONE place in the whole system that colour reacts
      // to anything other than intensity.
      var baseColor = p.isSpark ? COLORS.accent : lerpColor(COLORS.steel, COLORS.bone, p.tone);
      var color = projectBoost > 0 ? lerpColor(baseColor, COLORS.accent, projectBoost) : baseColor;

      // ---- DRAW THE TRAIL ----
      // Two overlapping strokes: faint and thin along the whole tail,
      // brighter and thicker over just the most recent third. That's
      // what creates the tapered "comet" look without needing one draw
      // call per segment (which, at ~250 particles, would add up).
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(trail[0].x, trail[0].y);
      for (var s = 1; s < trail.length; s++) ctx.lineTo(trail[s].x, trail[s].y);
      ctx.strokeStyle = rgba(color, alpha * 0.18);
      ctx.lineWidth = radius * 0.9;
      ctx.stroke();

      var recentFrom = Math.floor(trail.length * 0.66);
      ctx.beginPath();
      ctx.moveTo(trail[recentFrom].x, trail[recentFrom].y);
      for (var s2 = recentFrom + 1; s2 < trail.length; s2++) ctx.lineTo(trail[s2].x, trail[s2].y);
      ctx.strokeStyle = rgba(color, alpha * 0.45);
      ctx.lineWidth = radius * 1.4;
      ctx.stroke();

      // ---- DRAW THE HEAD ----
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = rgba(color, alpha);
      ctx.fill();
    }
  }

  // =====================================================================
  // SHARED PARTICLE POOL
  // =====================================================================
  var particles = [];
  function createParticles() {
    particles = [];
    for (var i = 0; i < AMBIENT_COUNT; i++) {
      var marginBias = Math.random() < 0.5 ? Math.random() * 0.28 : 0.72 + Math.random() * 0.28;
      particles.push({
        x: marginBias * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.1,
        vy: 0.03 + Math.random() * 0.05,
        r: Math.random() * 1.4 + 0.6,
        alpha: Math.random() * 0.4 + 0.25,
        tone: Math.random(), // this particle's own spot between --steel and --bone — see drawAmbient
        targetX: 0, targetY: 0
      });
    }
  }
  createParticles();

  function resizeCanvas() {
    // devicePixelRatio is how many real screen pixels there are per CSS
    // pixel — 1 on a normal display, 2 or 3 on high-density/retina ones.
    // Matching it keeps the canvas sharp instead of blurry, but it's
    // CAPPED here per the spec's performance constraints: this canvas
    // repaints its full area every single frame, and that cost scales
    // with the SQUARE of this number — uncapped on a 3x display means
    // painting 9x as many pixels per frame as on a 1x one, for sharpness
    // nobody can actually see the difference in. 2 (1.5 on weaker
    // devices) is the spec's chosen ceiling.
    var dpr = Math.min(window.devicePixelRatio || 1, isLowPower ? 1.5 : 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeCanvas();

  // ---- typography repulsion (Stage 4) ----
  // Cached ONCE here and again only on resize — never read inside the
  // animation loop, per the spec ("never call getBoundingClientRect()
  // inside the animation loop — it forces layout recalculation every
  // frame"). heroTextBox is just four numbers the per-particle loop
  // reads; nothing about it is recomputed per frame or per particle.
  var heroTextBox = null;
  function cacheHeroTextBox() {
    if (!heroTextEl) return;
    var r = heroTextEl.getBoundingClientRect();
    var pad = 36; // a little breathing room beyond the literal text box
    heroTextBox = {
      left: r.left - pad, right: r.right + pad,
      top: r.top - pad, bottom: r.bottom + pad,
      cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2
    };
  }
  cacheHeroTextBox();

  // ---- projects section position (Stage 6 performance pass) ----
  // The hero flow gives particles a local turbulence/colour bump when
  // they're near the projects section (see drawHeroParticles). That needs
  // the section's position, and reading it with getBoundingClientRect()
  // every frame is exactly the layout-forcing cost the spec forbids
  // inside the animation loop.
  //
  // Same trick as the footer below: cache the section's position relative
  // to the whole DOCUMENT once (that never changes), then convert it to a
  // current on-screen position each frame with a subtraction.
  var projectsBox = null;
  function cacheProjectsBox() {
    if (!projectsSection) { projectsBox = null; return; }
    var r = projectsSection.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) { projectsBox = null; return; }
    projectsBox = {
      cx: r.left + r.width / 2,
      docCy: r.top + window.scrollY + r.height / 2,
      radius: Math.max(r.width, r.height) / 2
    };
  }
  cacheProjectsBox();

  // ---- footer position (Stage 6 performance pass) ----
  // The footer is trickier: unlike the two boxes above, it's an ordinary
  // (non-pinned) element, so its position relative to the VIEWPORT
  // genuinely does change every frame while scrolling — that's the one
  // real obstacle to just caching it once. The fix is to cache its
  // position relative to the whole DOCUMENT instead (which never
  // changes), and turn that into a viewport position with plain
  // subtraction against window.scrollY each frame — arithmetic, not a
  // layout-forcing DOM read.
  var footerBox = null;
  function cacheFooterBox() {
    if (!footerLogEl) return;
    var r = footerLogEl.getBoundingClientRect();
    footerBox = { left: r.left, width: r.width, docTop: r.top + window.scrollY };
  }
  cacheFooterBox();

  // ---- cursor repulsion (Stage 4) ----
  // Just the current mouse position, updated by the browser whenever the
  // mouse moves. Nothing to compute here — the actual repulsion math
  // lives in drawHeroParticles(), reading these two numbers fresh each
  // frame.
  var mouseX = null, mouseY = null;
  window.addEventListener('mousemove', function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  // The hero has no ScrollTrigger at all — per the amendment's "no pin,
  // anywhere" rule, it doesn't need one. currentIntensity() above reads
  // window.scrollY directly, every frame, with nothing pinned or
  // scroll-jacked. Nothing on this site pins any more — the projects
  // section is a plain-scrolling node graph (see projects-graph.js).
  var navHeight = navEl ? navEl.offsetHeight : 0;

  // =====================================================================
  // DRAW LOOP
  // =====================================================================
  // Returns null to mean "use this particle's own steel<->bone tone"
  // rather than one shared colour — see drawAmbient(). Only the
  // footer-settling state overrides that with one flat colour, since
  // that's a deliberate, singular moment.
  function currentAmbientColor() {
    var scrollFrac = window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    if (scrollFrac > 0.95) return COLORS.muted; // settling near the footer
    return null;
  }

  function drawAmbient() {
    var color = currentAmbientColor();
    // footerBox.docTop is cached once (see cacheFooterBox() above draw())
    // as a position relative to the whole DOCUMENT, which never changes.
    // Turning that into a current on-screen position is just subtracting
    // the current scroll offset — arithmetic, not a getBoundingClientRect()
    // call, so this can run every frame for free.
    var footerRect = footerBox ? {
      left: footerBox.left,
      width: footerBox.width,
      top: footerBox.docTop - window.scrollY
    } : null;
    var scrollFrac = window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    var settling = scrollFrac > 0.97 && footerRect;

    for (var i = 0; i < AMBIENT_COUNT; i++) {
      var p = particles[i];
      if (settling) {
        p.x += (footerRect.left + footerRect.width / 2 - p.x) * 0.01;
        p.y += (footerRect.top - p.y) * 0.01;
        // Transient fade, not a permanent one — settleFade resets to 1
        // the moment you're not in the settling zone (see the else
        // branch), so scrolling back up and revisiting later doesn't
        // compound into dimmer and dimmer particles each time.
        p.settleFade = Math.max(0.25, (p.settleFade === undefined ? 1 : p.settleFade) - 0.01);
      } else {
        p.settleFade = 1;
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = window.innerWidth;
        if (p.x > window.innerWidth) p.x = 0;
        if (p.y < 0) p.y = window.innerHeight;
        if (p.y > window.innerHeight) { p.y = 0; p.x = Math.random() < 0.5 ? Math.random() * 0.28 * window.innerWidth : (0.72 + Math.random() * 0.28) * window.innerWidth; }
      }
      var displayAlpha = Math.min(p.alpha, 0.4) * (p.settleFade === undefined ? 1 : p.settleFade);
      // color is null in the normal case — that means "no single shared
      // colour," so each particle uses its own steel<->bone tone instead
      // (real tonal range, not a flat grey). It's only a fixed colour
      // during the footer-settle and viewing-a-project moments above.
      var particleColor = color || lerpColor(COLORS.steel, COLORS.bone, p.tone);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = rgba(particleColor, displayAlpha); // capped opacity — content comes first
      ctx.fill();
    }
  }

  var rafId = null;
  function draw() {
    // Wipe the canvas completely every frame. We used to erase just a
    // little bit each frame instead (destination-out at low alpha) to
    // get a fading-trail look for free — but that technique turned out
    // to be broken: canvas transparency is stored as a whole number
    // 0-255, and fading by a percentage mathematically can't reach zero
    // (it gets stuck at 1 and stays there), so every path a particle
    // had ever crossed left a permanent faint ghost. Measured it once —
    // stuck pixels climbed for as long as the tab stayed open, no matter
    // how hard the fade was tuned.
    //
    // Trails are now drawn on purpose, per-particle, from each one's own
    // remembered recent positions (see drawHeroParticles()), so a full,
    // proper clear here is not just safe but necessary — it's what
    // guarantees nothing lingers on the canvas that isn't something a
    // particle is deliberately drawing right now.
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    heroTime += 1 / 60; // fixed step, not real elapsed time — see heroTime's declaration above
    drawHeroParticles(currentIntensity());

    drawAmbient();

    rafId = requestAnimationFrame(draw);
  }

  // ---- pause when the tab isn't visible — a fixed full-page canvas is
  // worth being a good citizen about ----
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    } else if (!rafId) {
      draw();
    }
  });

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resizeCanvas();
      cacheHeroTextBox();
      cacheProjectsBox();
      cacheFooterBox();
      ScrollTrigger.refresh();
    }, 150);
  });

  document.body.classList.add('has-particle-system');
  draw();
})();
