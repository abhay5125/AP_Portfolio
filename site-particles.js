// Sitewide particle system.
//
// One fixed <canvas> (#siteParticles, see .site-particles in style.css),
// drawn in viewport coordinates the whole time — it never scrolls with
// the page. Three independent things share it:
//
//   1. HERO FLOW (Stage B — see hero-architecture-spec.md). A dedicated
//      pool of particles that continuously spawn at the left edge, drift
//      right, and respawn at the left once they exit the right edge.
//      They never ease toward a fixed target — see "Core architectural
//      principle" in the spec for why that matters. No scroll dependency
//      yet: that's Stage C, which will use scroll position to make the
//      flow feel more "ordered" from left to right.
//   2. PROJECTS — a separate pool of particles that assembles into each
//      project's card outline + signature icon as you scroll through the
//      projects section, built in an earlier stage and unrelated to the
//      hero rebuild.
//   3. AMBIENT — a small pool that just drifts gently in the background
//      everywhere on the page, whenever it isn't needed for #2.
//
// These used to share one combined pool with the *old* hero animation
// (see git history / hero-architecture-spec.md's "Discard" list) — that
// coupling was the root cause of a class of bugs, so Stage B gives hero
// its own independent pool instead of reusing the projects/ambient one.
//
// Every frame also erases the canvas a little instead of clearing it
// outright, which is what gives every particle its short motion trail —
// see the top of draw() below.
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
  var heroSection = document.querySelector('.hero');
  var projectsSection = document.querySelector('#projects');
  var projectStageEl = document.getElementById('projectStage');
  var footerLogEl = document.querySelector('.footer__log');

  var stageIdEl = document.getElementById('stageId');
  var stageCategoryEl = document.getElementById('stageCategory');
  var stageTitleEl = document.getElementById('stageTitle');
  var stageDescEl = document.getElementById('stageDesc');
  var stageStackEl = document.getElementById('stageStack');
  var stageLinksEl = document.getElementById('stageLinks');
  var progressDots = document.querySelectorAll('.progress-dot');

  // ---- device capability check — fewer particles on weaker devices ----
  var isLowPower =
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
    window.innerWidth < 700;
  var FRAME_COUNT = isLowPower ? 90 : 160;
  var AMBIENT_COUNT = isLowPower ? 30 : 60;
  var TOTAL_COUNT = FRAME_COUNT + AMBIENT_COUNT;

  // ---- design tokens, read from CSS so colors stay in sync with style.css ----
  function hexToRgb(hex) {
    var clean = hex.trim().replace('#', '');
    var value = parseInt(clean, 16);
    return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
  }
  var rootStyle = getComputedStyle(document.documentElement);
  var COLORS = {
    amber: hexToRgb(rootStyle.getPropertyValue('--amber').trim() || '#F5A623'),
    teal: hexToRgb(rootStyle.getPropertyValue('--teal').trim() || '#4FD1C5'),
    purple: hexToRgb(rootStyle.getPropertyValue('--purple').trim() || '#A78BFA'),
    text: hexToRgb(rootStyle.getPropertyValue('--text').trim() || '#E7ECF5'),
    muted: hexToRgb(rootStyle.getPropertyValue('--text-muted').trim() || '#8C97AD')
  };
  function lerpColor(a, b, t) {
    return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
  }
  function rgba(c, a) {
    return 'rgba(' + Math.round(c.r) + ',' + Math.round(c.g) + ',' + Math.round(c.b) + ',' + a + ')';
  }

  var easeInOut = gsap.parseEase('power2.inOut');

  // =====================================================================
  // HERO — continuous flow particles (Stages B + C)
  //
  // ---------------------------------------------------------------
  // THE ONE IDEA THIS WHOLE SECTION IS BUILT ON
  // ---------------------------------------------------------------
  // From hero-architecture-spec.md's "Core architectural principle":
  // particles have LIFECYCLES, not DESTINATIONS. Every particle just
  // repeats the same loop forever:
  //
  //     spawn at left edge -> flow right -> exit right edge -> respawn at left
  //
  // It never eases toward a fixed (x, y) target and stop. (The old hero
  // animation did exactly that, and it's why it felt mechanical and
  // "parked" once it finished — the spec calls that the "target-point
  // convergence model" and says to discard it.)
  //
  // What changes as you scroll isn't WHETHER particles move — it's how
  // much ORDER the system imposes on them. Every frame, each particle
  // works out one single number:
  //
  //     order = xFraction * scrollProgress
  //
  //     xFraction      = how far across the screen this particle is (0 = left
  //                      edge, 1 = right edge)
  //     scrollProgress = how far through the hero you've scrolled (0 to 1)
  //
  // Then EVERY visual property is just a blend between a "chaos" value
  // and an "ordered" value, dialled by that one number. Turbulence,
  // speed, size, opacity, colour, and the pull toward a lane all read
  // the same `order`. Nothing else decides anything.
  //
  // Read off what that gives you:
  //   scrollProgress = 0  -> order is 0 for every particle, everywhere.
  //                          Total chaos across the whole screen.
  //   scrollProgress = 1  -> order ramps 0 -> 1 from left to right.
  //                          A particle enters chaotic on the left and
  //                          progressively resolves as it travels right.
  //
  // So scrolling feels like *powering up a pipeline*, which is the whole
  // point of the hero.
  //
  // Stage C (this stage) implements the Bronze -> Silver half of the
  // spec's behaviour table: chaos resolving into ordered lanes. Stage D
  // adds the Gold end state (clustering + thinning out on the right).
  // =====================================================================

  // Budget from the spec's "Performance constraints": ~250 particles on
  // desktop, ~100 on lower-power devices/small screens (isLowPower is
  // computed above, next to FRAME_COUNT/AMBIENT_COUNT).
  var HERO_PARTICLE_COUNT = isLowPower ? 100 : 250;
  var heroParticles = [];

  // How far off-screen a particle spawns/exits, in pixels — kept as one
  // constant so the left (spawn) and right (exit) edges always agree.
  var HERO_EDGE_MARGIN = 40;

  // A running clock, advanced by a fixed small step every frame (see
  // draw() below) rather than real elapsed time. It only exists to feed
  // the turbulence formula; nothing else reads it.
  var heroTime = 0;

  // ---------------------------------------------------------------
  // The two ends of every blend
  //
  // Each pair below is "what this property looks like in CHAOS" and
  // "what it looks like when ORDERED". Every particle sits somewhere
  // between the two, positioned by its own `order` value. Grouping them
  // here means the behaviour table from the spec is readable in one
  // place instead of being scattered through the loop.
  // ---------------------------------------------------------------

  // Turbulence — spec: "high" at Bronze, damping toward Silver.
  var HERO_TURBULENCE = 0.03;

  // Damping is how much vertical velocity survives each frame. Below 1
  // so movement always settles rather than accelerating forever.
  // Higher = looser and more wandery; lower = snappier and calmer.
  // The spec's spring snippet suggests ~0.88 for the settled end.
  var HERO_DAMPING_CHAOS = 0.94;
  var HERO_DAMPING_ORDER = 0.88;

  // Speed — spec: "highly varied" at Bronze, "uniform" at Silver. Each
  // particle keeps its own random baseVx and blends toward this shared
  // conveyor-belt speed as order rises.
  var HERO_UNIFORM_VX = 1.15;

  // Size and opacity — spec: "varied" at Bronze, "consistent" at Silver.
  var HERO_UNIFORM_RADIUS = 1.15;
  var HERO_UNIFORM_ALPHA = 0.5;

  // ---------------------------------------------------------------
  // Motion trails
  //
  // How many recent positions each particle remembers. The trail is
  // drawn by joining these up, so this number IS the trail length —
  // raise it for longer comet tails, lower it for shorter ones.
  //
  // WHY IT WORKS THIS WAY (this is a deliberate change from the
  // technique in hero-architecture-spec.md, so it's worth explaining):
  //
  // The spec suggests getting trails by never fully clearing the canvas
  // — instead erasing ~12% of it each frame, so old frames fade out and
  // leave a smear. That's a well-known trick, but it has a flaw that
  // shows up badly here. Canvas stores transparency as a whole number
  // from 0-255, and erasing 12% MULTIPLIES it (x0.88). Once a pixel
  // reaches 1/255, 1 x 0.88 = 0.88, which rounds back up to 1. It gets
  // stuck there and never reaches 0.
  //
  // The result: every pixel a particle has ever crossed keeps a faint
  // permanent ghost, and after a minute or two the hero is covered in a
  // cobweb of every path ever traced. Measured it: the count of stuck
  // pixels grew steadily with no sign of levelling off, and — the
  // giveaway — erasing harder (25%, 40%) changed nothing at all, because
  // the problem is the rounding, not the strength.
  //
  // So instead: fully clear the canvas every frame (no history can
  // survive, so residue is impossible by construction) and draw each
  // trail explicitly from the positions the particle remembers.
  //
  // Two bonuses fall out of this. It's cheaper — repainting the whole
  // viewport every frame was the single most expensive operation, and a
  // clear is cheaper than a fill. And trail length becomes per-particle
  // rather than one global setting, which Stage E needs anyway (the spec
  // asks for one "protagonist" particle with a noticeably longer trail —
  // impossible when a single canvas-wide fade governs every trail at
  // once).
  //
  // 24 frames of history at roughly 1px of movement per frame gives a
  // tail around 25px long.
  var HERO_TRAIL_LENGTH = 24;

  // ---------------------------------------------------------------
  // Lanes — the spec's "Y position: random -> snapping to lanes"
  //
  // A set of evenly spaced horizontal tracks down the viewport. As order
  // rises, each particle is pulled toward its own assigned lane, which
  // is what turns a chaotic cloud into readable parallel streams.
  // ---------------------------------------------------------------
  var HERO_LANE_COUNT = isLowPower ? 5 : 9;

  // Returns the y pixel position of a given lane. Computed fresh from
  // window.innerHeight on every call rather than cached, so lanes follow
  // the window when it's resized with no extra bookkeeping.
  //
  // The 8% inset top and bottom keeps the outermost lanes clear of the
  // very edges of the screen, where they'd be half cut off.
  function heroLaneY(laneIndex) {
    var inset = 0.08;
    var span = 1 - inset * 2;
    var t = HERO_LANE_COUNT > 1 ? laneIndex / (HERO_LANE_COUNT - 1) : 0.5;
    return (inset + t * span) * window.innerHeight;
  }

  // Resets one particle in place — used both for the initial fill and to
  // "respawn" a particle once it exits past the right edge. Reusing the
  // same object instead of creating a new one avoids allocating garbage
  // on every respawn while the loop is running.
  //
  // spawnAtLeftEdge: true when respawning — the particle reappears just
  // off the left edge so re-entry isn't an abrupt pop-in. false is only
  // used for the very first fill, so the hero isn't empty on page load
  // while everything walks in from the left.
  function resetHeroParticle(p, spawnAtLeftEdge) {
    p.x = spawnAtLeftEdge ? -HERO_EDGE_MARGIN - Math.random() * 60 : Math.random() * window.innerWidth;
    p.y = Math.random() * window.innerHeight;
    p.vy = 0; // vertical velocity — built up by turbulence and the lane spring below

    // "base" values are this particle's personal CHAOS values. They stay
    // fixed for its whole lifetime; the blending toward the shared
    // ordered values happens per-frame in drawHeroParticles().
    p.baseVx = 0.4 + Math.random() * 0.8;
    p.baseRadius = Math.random() * 1.4 + 0.6;
    p.baseAlpha = Math.random() * 0.35 + 0.35;

    // Offsets this particle's turbulence so the whole field doesn't
    // wobble in unison.
    p.phase = Math.random() * Math.PI * 2;

    // The lane this particle will head for, picked ONCE at spawn and kept
    // for its entire trip across the screen.
    //
    // Worth understanding why it's fixed rather than "whichever lane is
    // nearest right now": a particle wobbling near the boundary between
    // two lanes would keep flipping which one it considers nearest, and
    // get yanked back and forth. That reads as jitter. Choosing once and
    // committing gives clean, stable streams. The particle gets a fresh
    // random lane next time it respawns, so the assignment still varies.
    p.lane = Math.floor(Math.random() * HERO_LANE_COUNT);

    // How strongly this particle is pulled toward its lane. Randomised
    // per particle so they don't all arrive at the same instant — the
    // spec calls this "staggered arrival for free". Kept small: paired
    // with the damping values above it produces a spring that overshoots
    // its lane very slightly before settling, rather than snapping to it
    // rigidly or bouncing like a spring toy.
    p.stiffness = 0.002 + Math.random() * 0.004;

    // The remembered recent positions that get drawn as this particle's
    // trail, oldest first, newest last.
    //
    // Created once and then only ever overwritten in place — never
    // rebuilt — so the animation loop doesn't generate throwaway objects
    // 60 times a second for the browser to clean up.
    if (!p.trail) {
      p.trail = [];
      for (var t = 0; t < HERO_TRAIL_LENGTH; t++) p.trail.push({ x: p.x, y: p.y });
    } else {
      // On respawn, collapse the whole trail onto the new spawn point.
      // This matters: without it the trail would still hold the
      // particle's old positions over on the right of the screen, and
      // joining those to its new position on the left would draw one
      // long streak straight across the viewport on every respawn.
      for (var t2 = 0; t2 < p.trail.length; t2++) {
        p.trail[t2].x = p.x;
        p.trail[t2].y = p.y;
      }
    }

    return p;
  }

  function createHeroParticles() {
    heroParticles = [];
    for (var i = 0; i < HERO_PARTICLE_COUNT; i++) {
      heroParticles.push(resetHeroParticle({}, false));
    }
  }
  createHeroParticles();

  function drawHeroParticles() {
    var w = window.innerWidth;
    var h = window.innerHeight;

    for (var i = 0; i < heroParticles.length; i++) {
      var p = heroParticles[i];

      // ---- THE ORDER VALUE ----
      // Everything below is a consequence of this one line. `xFraction`
      // is clamped because particles briefly live just off-screen on
      // either side (see HERO_EDGE_MARGIN), and we don't want order
      // going negative or above 1 there.
      var xFraction = Math.max(0, Math.min(1, p.x / w));
      var order = xFraction * heroProgress;

      // ---- HORIZONTAL: speed, varied -> uniform ----
      // Blend this particle's own random speed toward the shared speed.
      // Note this blends a *setting*, not a position — the particle is
      // still just moving right at some speed, never easing toward a
      // destination.
      var vx = p.baseVx + (HERO_UNIFORM_VX - p.baseVx) * order;
      p.x += vx;

      // ---- VERTICAL: turbulence AND lane-pull, blended together ----
      // Both of these write to the same vertical velocity. Turbulence
      // fades out as order rises; the lane spring fades in. They aren't
      // an either/or switch — around mid-screen both are partly active,
      // and that overlap is what makes chaos resolve into structure
      // smoothly instead of visibly changing mode.

      // Turbulence: the spec's sum-of-sines flow field. Multiplying two
      // waves that vary with x, y and time gives a smooth, organic,
      // non-repeating drift — far more natural-looking than random
      // jitter, and it costs almost nothing to compute.
      var drift = Math.sin(p.x * 0.01 + heroTime + p.phase) * Math.cos(p.y * 0.013 - heroTime * 0.7);
      p.vy += drift * HERO_TURBULENCE * (1 - order);

      // Lane spring. This is the spec's "spring motion with overshoot":
      //     vy += (target - y) * stiffness   <- accelerate toward the lane
      //     vy *= damping                    <- bleed off speed
      //     y  += vy                         <- move
      //
      // The important detail is that the pull changes VELOCITY, not
      // position. That's what lets a particle build up momentum, sail
      // very slightly past its lane, and drift back — which is what
      // reads as alive. The rejected alternative (`y += (target - y) *
      // 0.1`) can only ever approach the target and slow down, and that
      // asymptotic crawl is what made the old version feel mechanical.
      p.vy += (heroLaneY(p.lane) - p.y) * p.stiffness * order;

      // Damping also blends: loose and wandering in chaos, tighter and
      // settling as order rises.
      var damping = HERO_DAMPING_CHAOS + (HERO_DAMPING_ORDER - HERO_DAMPING_CHAOS) * order;
      p.vy *= damping;
      p.y += p.vy;

      // Soft bounce off the top and bottom of the viewport.
      //
      // Stage B wrapped particles around (off the top -> back on at the
      // bottom). That can't work now: a wrapped particle would be a full
      // screen-height away from its lane, and the spring would haul it
      // straight back across, drawing a long vertical streak. Bouncing
      // keeps it in view and continuous. Halving the velocity stops it
      // pinballing.
      if (p.y < 0) {
        p.y = 0;
        p.vy = Math.abs(p.vy) * 0.5;
      } else if (p.y > h) {
        p.y = h;
        p.vy = -Math.abs(p.vy) * 0.5;
      }

      // ---- LIFECYCLE ----
      // Past the right edge? Respawn at the left and start over. This is
      // the "never arrives anywhere" rule in practice.
      if (p.x > w + HERO_EDGE_MARGIN) {
        resetHeroParticle(p, true);
      }

      // ---- APPEARANCE: size, opacity, colour ----
      // Same blend pattern as speed: this particle's own varied value,
      // blended toward the shared consistent one by order.
      var radius = p.baseRadius + (HERO_UNIFORM_RADIUS - p.baseRadius) * order;
      var alpha = p.baseAlpha + (HERO_UNIFORM_ALPHA - p.baseAlpha) * order;

      // Colour: Bronze (--amber, raw) -> Silver (--text-muted,
      // transforming), per the spec's behaviour table. Stage D extends
      // this into Gold (--teal) for the final insight state.
      var color = lerpColor(COLORS.amber, COLORS.muted, order);

      // ---- RECORD THIS FRAME'S POSITION INTO THE TRAIL ----
      // Slide every remembered position down one slot, then write the
      // current position into the last slot. So trail[0] is the oldest
      // point and the last entry is where the particle is right now.
      var trail = p.trail;
      for (var t = 0; t < trail.length - 1; t++) {
        trail[t].x = trail[t + 1].x;
        trail[t].y = trail[t + 1].y;
      }
      trail[trail.length - 1].x = p.x;
      trail[trail.length - 1].y = p.y;

      // ---- DRAW THE TRAIL ----
      // Drawn as two overlapping strokes rather than one line per pair of
      // points. Faint and thin along the whole tail, brighter and thicker
      // over just the most recent third, then the solid head on top.
      // Three tiers of brightness is enough to read as a tapered comet.
      //
      // Why not fade every segment individually for a perfectly smooth
      // taper: that would be one stroke call per segment, so 23 per
      // particle, about 5,750 per frame at 250 particles. Stroke calls
      // are not cheap. This version is 3 draw calls per particle and
      // looks near-identical in motion.
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Whole tail, faint.
      ctx.beginPath();
      ctx.moveTo(trail[0].x, trail[0].y);
      for (var s = 1; s < trail.length; s++) ctx.lineTo(trail[s].x, trail[s].y);
      ctx.strokeStyle = rgba(color, alpha * 0.18);
      ctx.lineWidth = radius * 0.9;
      ctx.stroke();

      // Most recent third, brighter — this is what creates the taper.
      var recentFrom = Math.floor(trail.length * 0.66);
      ctx.beginPath();
      ctx.moveTo(trail[recentFrom].x, trail[recentFrom].y);
      for (var s2 = recentFrom + 1; s2 < trail.length; s2++) ctx.lineTo(trail[s2].x, trail[s2].y);
      ctx.strokeStyle = rgba(color, alpha * 0.45);
      ctx.lineWidth = radius * 1.4;
      ctx.stroke();

      // ---- DRAW THE HEAD ----
      // Full opacity, so the particle itself always reads as brighter
      // than the tail behind it.
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = rgba(color, alpha);
      ctx.fill();
    }
  }

  // =====================================================================
  // PROJECTS — content + per-project signature icon (normalized local points)
  // =====================================================================
  var PROJECTS = [
    {
      id: 'JOB-01', lifecycle: 'live', category: 'aerospace', categoryLabel: 'Aerospace Analysis',
      title: 'DC micro-motor selection for the design of a Biologically-Inspired Flapping-Wing MAV',
      desc: 'Developed a computational model in MATLAB to generate and analyse performance data for flapping-wing Micro Aerial Vehicles. Conducted quantitative analysis across multiple actuator parameters, identifying trends and relationships between mass, power, frequency and efficiency to evaluate system performance and design trade-offs.',
      stack: ['MATLAB', 'Computational Modelling', 'Quantitative Engineering Analysis'],
      links: [{ label: 'Repo ↗', href: '#' }, { label: 'Write-up ↗', href: '#' }],
      icon: 'insect'
    },
    {
      id: 'JOB-02', lifecycle: 'live', category: 'analysis', categoryLabel: 'Data Analysis',
      title: 'Quantitative Trading Strategy Backtesting',
      desc: 'Analysed historical financial data using Python and Pandas to develop and backtest quantitative trading strategies. Engineered technical indicators including moving averages and Bollinger Bands, evaluating historical performance and identifying patterns and trading signals through data analysis and visualisation.',
      stack: ['Python', 'Pandas', 'NumPy', 'yfinance', 'Matplotlib', 'Quantitative Analysis'],
      links: [{ label: 'Repo ↗', href: '#' }, { label: 'Write-up ↗', href: '#' }],
      icon: 'chart'
    },
    {
      id: 'JOB-03', lifecycle: 'in progress', category: 'engineering', categoryLabel: 'Data Engineering',
      title: 'NYC Delivery Service - End-to-End Data Engineering',
      desc: 'Built an end-to-end data analytics solution using Databricks and Power BI, transforming restaurant delivery data through a Medallion Architecture. Analysed sales trends and external factors including weather, public holidays and major sporting events to identify patterns in customer demand and support data-driven business decisions.',
      stack: ['Databricks', 'Apache Spark', 'Microsoft Azure', 'ETL'],
      links: [{ label: 'Repo ↗', href: '#' }],
      icon: 'scooter'
    },
    {
      id: 'JOB-04', lifecycle: 'archived', category: 'analysis', categoryLabel: 'Data Analysis',
      title: 'Formula 1 Performance Analysis',
      desc: 'Collected and analysed Formula 1 race data using the FastF1 API, developing analysis to calculate tyre degradation across compounds and race stints. Analysed lap-time trends and driver performance, presenting findings through an interactive Streamlit dashboard.',
      stack: ['Python', 'Pandas', 'NumPy', 'API', 'Streamlit'],
      links: [{ label: 'Write-up ↗', href: '#' }],
      icon: 'car'
    }
  ];

  // Each icon is a set of local points (small coordinate space, roughly
  // 0-90 x, 0-95 y) — scaled and positioned into the card's top-right
  // corner at draw time. Kept deliberately simple: a recognizable
  // silhouette, not a detailed illustration (particles are small dots in
  // motion — detail would just read as noise).
  var ICONS = {
    insect: [
      [5, 45], [20, 40], [35, 50], [40, 70], [30, 90], [13, 93], [0, 75],
      [20, 25], [40, 7], [53, 20], [40, 35]
    ],
    chart: [
      [0, 45], [0, 5], [15, 20], [30, 35], [45, 10], [60, 30], [75, 15], [90, 25]
    ],
    scooter: [
      [10, 45], [15, 25], [35, 20], [45, 10], [50, 20], [55, 45],
      [15, 48], [50, 48]
    ],
    car: [
      [0, 27], [20, 12], [40, 10], [60, 2], [75, 0], [78, 10], [60, 22], [30, 27],
      [15, 34], [65, 34]
    ]
  };

  // ---- weight each project's hold time roughly by how much there is to read ----
  var descLengths = PROJECTS.map(function (p) { return p.desc.length; });
  var totalDescLen = descLengths.reduce(function (a, b) { return a + b; }, 0);
  var segmentBounds = [0];
  descLengths.forEach(function (len) {
    segmentBounds.push(segmentBounds[segmentBounds.length - 1] + len / totalDescLen);
  });
  segmentBounds[segmentBounds.length - 1] = 1; // guard against float drift

  // =====================================================================
  // SHARED PARTICLE POOL
  // =====================================================================
  var particles = [];
  function createParticles() {
    particles = [];
    for (var i = 0; i < TOTAL_COUNT; i++) {
      var marginBias = Math.random() < 0.5 ? Math.random() * 0.28 : 0.72 + Math.random() * 0.28;
      particles.push({
        x: marginBias * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.1,
        vy: 0.03 + Math.random() * 0.05,
        r: Math.random() * 1.4 + 0.6,
        alpha: Math.random() * 0.4 + 0.25,
        targetX: 0, targetY: 0
      });
    }
  }
  createParticles();

  function resizeCanvas() {
    // devicePixelRatio is how many real screen pixels there are per CSS
    // pixel — 1 on a normal display, 2 or 3 on high-density/retina ones.
    // Matching it keeps the canvas sharp instead of blurry.
    //
    // But it's CAPPED here, per the spec's performance constraints. The
    // trail effect repaints the entire viewport every single frame, and
    // that cost scales with the square of this number: uncapped on a
    // 3x display it means painting 9x as many pixels per frame as on a
    // 1x one, for a sharpness difference nobody can see. 2 (or 1.5 on
    // weaker devices) is the sweet spot.
    var dpr = Math.min(window.devicePixelRatio || 1, isLowPower ? 1.5 : 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeCanvas();

  var navHeight = navEl ? navEl.offsetHeight : 0;

  // =====================================================================
  // HERO SCROLL TRIGGER (Stage C)
  //
  // This is the ENTIRE connection between scrolling and the hero
  // animation. It sets one number. That's deliberate, and it's the
  // spec's "Two independent systems" rule:
  //
  //   the animation loop   -> driven by requestAnimationFrame, ALWAYS runs
  //   scroll position      -> sets one variable, nothing more
  //
  // The loop never asks "have we scrolled?" or "is the hero visible?"
  // before deciding to move particles. It just moves them, every frame,
  // forever. Scroll only changes HOW they behave, never WHETHER they
  // move. That separation is what stops the animation freezing/"parking"
  // when you stop scrolling — the failure mode that sank earlier
  // versions of this hero.
  //
  // A consequence worth knowing: scroll past the hero and heroProgress
  // simply stays at 1. The flow keeps running in its ordered state
  // rather than stopping. Stage G ("The Cascade") is what gives it a
  // proper exit.
  // =====================================================================

  // How many pixels of scrolling the hero stays pinned for. This is the
  // single number that controls how long the Bronze -> Silver
  // transformation takes to play out — raise it for a slower, more
  // drawn-out reveal, lower it for a snappier one. Kept deliberately
  // short-ish: a long pin also means a long scroll back UP past it.
  var HERO_PIN_DISTANCE = 1600;

  // The raw value ScrollTrigger writes, and the smoothed value the
  // particles actually read. See the smoothing step in draw() for why
  // there are two.
  var heroProgressTarget = 0;
  var heroProgress = 0;

  if (heroSection) {
    ScrollTrigger.create({
      trigger: heroSection,
      start: 'top ' + navHeight, // pin once the hero's top reaches just under the nav
      end: '+=' + HERO_PIN_DISTANCE,
      pin: true,        // hold the hero on screen while its scroll range plays out
      pinSpacing: true, // reserve that scroll distance so later sections aren't overlapped
      scrub: 1,         // tie progress to scroll position rather than playing on a timer
      onUpdate: function (self) {
        // self.progress is 0 at the start of the pinned range and 1 at
        // the end. This assignment is the whole job.
        heroProgressTarget = self.progress;
      }
    });
  }

  // =====================================================================
  // PROJECTS SCROLL TRIGGER
  // =====================================================================
  var projectsRawProgress = 0;
  var currentProjectIndex = -1; // -1 = not started yet
  var frameEased = 0; // 0 = dispersed, 1 = fully formed card
  var lastCategoryColorKey = null;

  function categoryColor(key) {
    if (key === 'aerospace') return COLORS.amber;
    if (key === 'engineering') return COLORS.teal;
    return COLORS.purple;
  }

  function populateProjectStage(project) {
    if (stageIdEl) stageIdEl.innerHTML = project.id + ' <span class="job__lifecycle">· ' + project.lifecycle + '</span>';
    if (stageCategoryEl) stageCategoryEl.textContent = project.categoryLabel;
    if (stageTitleEl) stageTitleEl.textContent = project.title;
    if (stageDescEl) stageDescEl.textContent = project.desc;
    if (stageStackEl) {
      stageStackEl.innerHTML = '';
      project.stack.forEach(function (tag) {
        var li = document.createElement('li');
        li.textContent = tag;
        stageStackEl.appendChild(li);
      });
    }
    if (stageLinksEl) {
      stageLinksEl.innerHTML = '';
      project.links.forEach(function (link) {
        var a = document.createElement('a');
        a.href = link.href;
        a.textContent = link.label;
        stageLinksEl.appendChild(a);
      });
    }
    if (projectStageEl) projectStageEl.setAttribute('data-category', project.category);
  }

  function updateProgressDots(index) {
    progressDots.forEach(function (dot, i) {
      dot.classList.toggle('is-active', i === index);
    });
  }

  var projectsNavHeight = navHeight;
  ScrollTrigger.create({
    trigger: projectsSection,
    start: 'top ' + projectsNavHeight,
    end: '+=3200', // shortened from 6000 — ~800px/project, still tune-able
    pin: true,
    pinSpacing: true,
    scrub: 1,
    onUpdate: function (self) {
      projectsRawProgress = self.progress;

      // find which project's segment we're in, and local progress within it.
      // Half-open intervals ([start, end) rather than [start, end]) so a
      // progress value sitting exactly on a boundary can't match two
      // segments at once — that ambiguity could otherwise make the index
      // flicker between two projects for a frame, which kept resetting
      // is-content-visible before the reveal ever finished (looking like
      // the card "stopped early" / stayed cut off).
      var idx = PROJECTS.length - 1;
      for (var i = 0; i < PROJECTS.length; i++) {
        if (projectsRawProgress < segmentBounds[i + 1]) {
          idx = i;
          break;
        }
      }
      var segStart = segmentBounds[idx], segEnd = segmentBounds[idx + 1];
      var local = segEnd > segStart ? (projectsRawProgress - segStart) / (segEnd - segStart) : 0;

      if (idx !== currentProjectIndex) {
        currentProjectIndex = idx;
        populateProjectStage(PROJECTS[idx]);
        updateProgressDots(idx);
        projectStageEl.classList.remove('is-content-visible');
      }

      // assembly 0-0.20 -> full 1, hold, departure 0.80-1.00 -> back to 0
      var raw;
      if (local < 0.2) raw = local / 0.2;
      else if (local > 0.8) raw = 1 - (local - 0.8) / 0.2;
      else raw = 1;
      frameEased = easeInOut(Math.max(0, Math.min(1, raw)));

      if (projectStageEl) {
        projectStageEl.classList.toggle('is-content-visible', frameEased > 0.98);
      }
    }
  });

  // =====================================================================
  // DRAW LOOP
  // =====================================================================
  function drawFrameParticle(p, eased, color) {
    var driftFactor = 1 - eased;
    p.x += p.vx * driftFactor;
    p.y += p.vy * driftFactor * 0.3;
    var desiredX = p.x + (p.targetX - p.x) * eased;
    var desiredY = p.y + (p.targetY - p.y) * eased;
    p._drawX = (p._drawX === undefined ? desiredX : p._drawX) + (desiredX - (p._drawX === undefined ? desiredX : p._drawX)) * 0.12;
    p._drawY = (p._drawY === undefined ? desiredY : p._drawY) + (desiredY - (p._drawY === undefined ? desiredY : p._drawY)) * 0.12;
    ctx.beginPath();
    ctx.arc(p._drawX, p._drawY, p.r, 0, Math.PI * 2);
    ctx.fillStyle = rgba(color, p.alpha);
    ctx.fill();
  }

  function drawProjectFrame() {
    if (!projectStageEl || currentProjectIndex < 0) return;
    var project = PROJECTS[currentProjectIndex];
    var rect = projectStageEl.getBoundingClientRect();
    var color = categoryColor(project.category);

    // outline points along the card's perimeter (straight edges — corner
    // rounding is small relative to card size, not worth the complexity)
    var outlineCount = Math.round(FRAME_COUNT * 0.75);
    var perimeter = 2 * (rect.width + rect.height);
    var iconCount = FRAME_COUNT - outlineCount;

    for (var i = 0; i < outlineCount; i++) {
      var t = i / outlineCount;
      var d = t * perimeter;
      var x, y;
      if (d < rect.width) { x = rect.left + d; y = rect.top; }
      else if (d < rect.width + rect.height) { x = rect.right; y = rect.top + (d - rect.width); }
      else if (d < 2 * rect.width + rect.height) { x = rect.right - (d - rect.width - rect.height); y = rect.bottom; }
      else { x = rect.left; y = rect.bottom - (d - 2 * rect.width - rect.height); }
      var p = particles[i];
      p.targetX = x; p.targetY = y;
      drawFrameParticle(p, frameEased, color);
    }

    // signature icon in the top-right corner, scaled from local coords
    var iconPoints = ICONS[project.icon] || [];
    var iconScale = 0.9;
    var iconOffsetX = rect.right - 100;
    var iconOffsetY = rect.top + 20;
    for (var j = 0; j < iconCount; j++) {
      var pt = iconPoints[j % iconPoints.length];
      var p2 = particles[outlineCount + j];
      p2.targetX = iconOffsetX + pt[0] * iconScale;
      p2.targetY = iconOffsetY + pt[1] * iconScale;
      drawFrameParticle(p2, frameEased, color);
    }
  }

  function currentAmbientColor() {
    var scrollFrac = window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    if (currentProjectIndex >= 0 && projectsRawProgress < 1) {
      return categoryColor(PROJECTS[currentProjectIndex].category);
    }
    if (scrollFrac > 0.95) return COLORS.muted; // settling near the footer
    // Default background tone elsewhere on the page: amber, matching the
    // hero flow's Bronze/raw-data colour (see the spec's colour table).
    // Stage C will introduce a proper progress-driven amber -> teal
    // gradient here too; Stage B has no such progress value yet.
    return COLORS.amber;
  }

  // Whether the projects section currently has exclusive claim on the
  // first FRAME_COUNT particles (ambient drift is paused on those
  // particles while the projects card sequence is using them).
  var projectsClaimFrame = false;

  function drawAmbient() {
    var color = currentAmbientColor();
    var footerRect = footerLogEl ? footerLogEl.getBoundingClientRect() : null;
    var scrollFrac = window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    var settling = scrollFrac > 0.97 && footerRect;

    var startIdx = projectsClaimFrame ? FRAME_COUNT : 0;
    for (var i = startIdx; i < TOTAL_COUNT; i++) {
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
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = rgba(color, displayAlpha); // capped opacity — content comes first
      ctx.fill();
    }
  }

  var rafId = null;
  function draw() {
    // Wipe the canvas completely. Nothing from the previous frame
    // survives, which is exactly what we want: it makes the leftover-
    // ghost-pixel problem described up at HERO_TRAIL_LENGTH structurally
    // impossible. Trails are drawn deliberately by drawHeroParticles()
    // from each particle's own remembered positions, not left behind as
    // canvas residue.
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    heroTime += 1 / 60; // fixed step, not real elapsed time — see heroTime's declaration above

    // Smooth the scroll progress before the particles read it.
    //
    // Scroll events arrive in coarse jumps (especially with a mouse
    // wheel or a trackpad flick), so using the raw value directly makes
    // the whole field lurch between states. Easing toward it here spreads
    // each jump over several frames.
    //
    // Worth being clear about what this is and isn't: it smooths a
    // SETTING — one number describing how ordered the system should be.
    // It is NOT easing a particle toward a position, which is the thing
    // the spec warns against. Particles still move by their own velocity
    // every frame; this only softens how quickly the dial they read gets
    // turned. Raise 0.08 for a more immediate response, lower it for a
    // more languid one.
    heroProgress += (heroProgressTarget - heroProgress) * 0.08;

    drawHeroParticles();

    projectsClaimFrame = currentProjectIndex >= 0 && projectsRawProgress < 1 && frameEased > 0.001;
    if (currentProjectIndex >= 0) {
      drawProjectFrame();
    }
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
      ScrollTrigger.refresh();
    }, 150);
  });

  document.body.classList.add('has-particle-system');
  draw();
})();
