// Sitewide particle system.
//
// One fixed <canvas> (#siteParticles, see .site-particles in style.css),
// drawn in viewport coordinates the whole time — it never scrolls with
// the page. Three independent things share it:
//
//   1. HERO FLOW — see the big comment block further down for the full
//      story. Short version: a pool of particles that just drift around
//      like smoke, no scroll involvement, no pinning. Following the plan
//      in hero-architecture-spec.md's AMENDMENT at the top of that file
//      (the original pinned/lane-based plan further down that doc was
//      tried, looked worse, and got dropped — the amendment is the real
//      plan now).
//   2. PROJECTS — a separate pool of particles that assembles into each
//      project's card outline + signature icon as you scroll through the
//      projects section. Built earlier, unrelated to the hero flow, not
//      touched by any of this.
//   3. AMBIENT — a small pool that just drifts gently in the background
//      everywhere on the page, whenever it isn't needed for #2.
//
// Every frame also erases the canvas a little instead of clearing it
// outright, which is what gives every particle its short motion trail —
// see the top of draw() below. (Known issue with this specific technique,
// not being fixed yet — see portfolio-project-notes.md.)
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
  // HERO — flow field particles (Stage 2 of the new plan)
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
  // No scroll involvement at all yet — that's Stage 3, which will bring
  // in one `intensity` number driven by how far down the page you've
  // scrolled, and use it to turn the turbulence/speed/density up or down.
  // For now this just needs to look good sitting still, which is exactly
  // what Stage 2 is asking for.
  // =====================================================================

  // Budget from the spec's "Performance constraints": ~250 particles on
  // desktop, ~100 on lower-power devices/small screens (isLowPower is
  // computed above, next to FRAME_COUNT/AMBIENT_COUNT).
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
  function resetHeroParticle(p, spawnAtLeftEdge) {
    p.x = spawnAtLeftEdge ? -HERO_EDGE_MARGIN - Math.random() * 60 : Math.random() * window.innerWidth;
    p.y = Math.random() * window.innerHeight;
    p.r = Math.random() * 1.4 + 0.6;
    p.alpha = Math.random() * 0.35 + 0.35;
    p.phase = Math.random() * Math.PI * 2; // offsets each particle's turbulence so they don't all wobble in sync
    return p;
  }

  function createHeroParticles() {
    heroParticles = [];
    for (var i = 0; i < HERO_PARTICLE_COUNT; i++) {
      heroParticles.push(resetHeroParticle({}, false));
    }
  }
  createHeroParticles();

  // How strong the swirling "wind" is versus the constant rightward
  // push. Turbulence deliberately outweighs the bias — that's what lets
  // paths curve and even briefly reverse, rather than every particle
  // just sliding rightward in a straight line. One tuning knob each, so
  // it's easy to nudge the balance later without hunting through the
  // maths below.
  var HERO_TURBULENCE_STRENGTH = 0.85; // px/frame, roughly — the wind
  var HERO_RIGHTWARD_BIAS = 0.35;      // px/frame, constant — the current

  function drawHeroParticles() {
    for (var i = 0; i < heroParticles.length; i++) {
      var p = heroParticles[i];

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

      // ---- VELOCITY = WIND + CURRENT ----
      // Worked out completely fresh, every frame, from this particle's
      // position right now — nothing here is added to or carried over
      // from last frame. That might sound like it should look jerky, but
      // it doesn't: the sine/cosine waves above only change gradually as
      // x, y and time creep forward a tiny bit each frame, so the numbers
      // they produce only creep too. Smooth inputs, smooth outputs — no
      // momentum/carry-over needed to make it look fluid.
      var vx = windX * HERO_TURBULENCE_STRENGTH + HERO_RIGHTWARD_BIAS;
      var vy = windY * HERO_TURBULENCE_STRENGTH;

      p.x += vx;
      p.y += vy;

      // Wrap vertically. The hero is a self-contained scene (not a tall
      // page section), so a particle that drifts off the top/bottom just
      // reappears on the opposite edge rather than being lost.
      if (p.y < 0) p.y = window.innerHeight;
      if (p.y > window.innerHeight) p.y = 0;

      // Once a particle has drifted past the right edge, respawn it at
      // the left and let it start the same wandering loop again — it
      // never "arrives" anywhere, it just keeps flowing.
      if (p.x > window.innerWidth + HERO_EDGE_MARGIN) {
        resetHeroParticle(p, true);
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      // Plain amber for now — no scroll-driven colour shift yet, that's
      // Stage 3+ territory once the `intensity` parameter exists.
      ctx.fillStyle = rgba(COLORS.amber, p.alpha);
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
    var dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeCanvas();

  // Stage B has no hero ScrollTrigger yet, deliberately — see the spec's
  // "Two independent systems" section: the animation loop always runs on
  // its own via requestAnimationFrame (see drawHeroParticles() above and
  // draw() below), and scroll only ever changes *how* particles behave,
  // never *whether* they move. Stage C is what introduces a single
  // `scrollProgress` variable (via a ScrollTrigger pin on the hero,
  // mirroring the pattern below for the projects section) and uses it to
  // make the flow feel more "ordered" from left to right.
  var navHeight = navEl ? navEl.offsetHeight : 0;

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
    // Motion trails (see hero-architecture-spec.md's "Motion trails"
    // technique) replace the old per-frame ctx.clearRect(). Instead of
    // wiping the canvas blank every frame, this erases just a little bit
    // of what's already there, so every moving particle leaves a short
    // fading trail behind it. `destination-out` compositing subtracts
    // alpha from existing pixels — a plain translucent fillRect would NOT
    // work here, because the canvas itself is transparent (the page's
    // grid-overlay shows through it), so "painting black at 12% opacity"
    // would tint everything grey instead of fading it out.
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)'; // lower alpha = longer trails, higher = shorter
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.globalCompositeOperation = 'source-over'; // back to normal drawing for everything below

    heroTime += 1 / 60; // fixed step, not real elapsed time — see heroTime's declaration above
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
