// STAGE4-CHECK (site-particles.js), bugfix pass: if you can see this
// comment when you open this file in Notepad, this is the correct
// updated file. Fixed: hero/ambient particle pool conflict, permanent
// footer-settle dimming, projects segment-boundary flicker.
//
// Sitewide particle system — stage 4.
//
// Replaces hero-animation.js entirely. One fixed canvas, one shared pool
// of particle objects, drawn in viewport coordinates the whole time (the
// canvas never scrolls with the page — see .site-particles in style.css).
// A "frame pool" of particles does the choreographed work (hero pipeline,
// then later the project cards); everything else in that pool drifts as
// ambient background whenever it isn't currently claimed. A smaller
// "ambient-only" pool is always drifting, so the page never feels like
// the particles switch off between the big moments.
//
// Safety: if canvas, GSAP, or ScrollTrigger aren't available, or the
// visitor has "reduce motion" turned on, this script does nothing and
// the static fallbacks (hero__diagram-fallback SVG, .jobs cards) stay
// visible exactly as they are without JavaScript.

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
  var heroDiagramEl = document.querySelector('.hero__diagram');
  var projectsSection = document.querySelector('#projects');
  var projectStageEl = document.getElementById('projectStage');
  var footerLogEl = document.querySelector('.footer__log');

  var subtitleEl = document.querySelector('.hero__subtitle');
  var descEl = document.querySelector('.hero__desc');
  var actionsEl = document.querySelector('.hero__actions');

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
  // HERO — pipeline node layout, matching the fallback SVG's 640x420 viewBox
  // =====================================================================
  var HERO_NODES = [
    { key: 'api', vx: 70, vy: 80, count: 20 },
    { key: 'postgres', vx: 70, vy: 190, count: 20 },
    { key: 's3', vx: 70, vy: 300, count: 20 },
    { key: 'etl', vx: 320, vy: 190, count: 40 },
    { key: 'warehouse', vx: 565, vy: 110, count: 30 },
    { key: 'dashboard', vx: 565, vy: 300, count: 30 }
  ];
  var HERO_LABELS = { api: 'API', postgres: 'Postgres', s3: 'S3 logs', etl: 'ETL', warehouse: 'Warehouse', dashboard: 'Dashboard' };
  var HERO_EDGES = [['api', 'etl'], ['postgres', 'etl'], ['s3', 'etl'], ['etl', 'warehouse'], ['etl', 'dashboard']];
  // scale the reference counts above to whatever FRAME_COUNT actually is
  var heroCountScale = FRAME_COUNT / 160;
  HERO_NODES.forEach(function (n) { n.count = Math.max(4, Math.round(n.count * heroCountScale)); });

  function heroNodeCenter(node, rect) {
    return { x: rect.left + (node.vx / 640) * rect.width, y: rect.top + (node.vy / 420) * rect.height };
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

  // =====================================================================
  // HERO SCROLL TRIGGER (same mechanism as stage 2)
  // =====================================================================
  var heroProgress = 0, heroEased = 0;
  function updateHeroTextReveals() {
    if (subtitleEl) subtitleEl.classList.toggle('is-revealed', heroProgress > 0.05);
    if (descEl) descEl.classList.toggle('is-revealed', heroProgress > 0.3);
    if (actionsEl) actionsEl.classList.toggle('is-revealed', heroProgress > 0.85);
  }

  var navHeight = navEl ? navEl.offsetHeight : 0;
  ScrollTrigger.create({
    trigger: heroSection,
    start: 'top ' + navHeight,
    end: '+=2500', // tune after seeing it live — same as stage 2
    pin: true,
    pinSpacing: true,
    scrub: 1,
    onUpdate: function (self) {
      heroProgress = self.progress;
      heroEased = easeInOut(heroProgress);
      updateHeroTextReveals();
    }
  });

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
    end: '+=6000', // rough guess for 4 projects — tune after seeing it live
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
  function drawHeroFrame() {
    if (!heroDiagramEl) return;
    var rect = heroDiagramEl.getBoundingClientRect();
    var mixed = lerpColor(COLORS.amber, COLORS.teal, heroEased);
    var linkAlpha = Math.max(0, Math.min(1, (heroEased - 0.5) / 0.4));

    if (linkAlpha > 0) {
      var centers = {};
      HERO_NODES.forEach(function (n) { centers[n.key] = heroNodeCenter(n, rect); });
      ctx.lineWidth = 1 + heroEased;
      ctx.setLineDash(heroEased < 0.999 ? [4, 4] : [8, 6]);
      HERO_EDGES.forEach(function (edge) {
        var a = centers[edge[0]], b = centers[edge[1]];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = rgba(mixed, linkAlpha);
        ctx.stroke();
      });
      ctx.setLineDash([]);
    }

    var idx = 0;
    HERO_NODES.forEach(function (node) {
      var center = heroNodeCenter(node, rect);
      for (var i = 0; i < node.count && idx < FRAME_COUNT; i++, idx++) {
        var p = particles[idx];
        p.targetX = center.x + (Math.random() - 0.5) * 0.4; // near-static jitter
        p.targetY = center.y + (Math.random() - 0.5) * 0.3;
        drawFrameParticle(p, heroEased, mixed);
      }
    });

    var labelAlpha = Math.max(0, Math.min(1, (heroEased - 0.8) / 0.2));
    if (labelAlpha > 0) {
      ctx.font = '11px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = rgba(COLORS.text, labelAlpha);
      HERO_NODES.forEach(function (n) {
        var c = heroNodeCenter(n, rect);
        ctx.fillText(HERO_LABELS[n.key], c.x, c.y + 24);
      });
    }
  }

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
    if (heroEased < 1) return lerpColor(COLORS.amber, COLORS.teal, heroEased);
    return COLORS.teal;
  }

  // Whether hero/projects currently have exclusive claim on the first
  // FRAME_COUNT particles. Computed once here and reused everywhere else
  // (previously this was recomputed slightly differently inside
  // drawAmbient, and that second copy incorrectly required
  // heroProgress < 1 — which becomes false at the exact moment the hero
  // finishes converging, right when it should still hold the claim. That
  // let ambient drift fight over the same particles the hero was using,
  // which is why convergence looked incomplete.)
  var heroClaimsFrame = false;
  var projectsClaimFrame = false;

  function drawAmbient() {
    var color = currentAmbientColor();
    var footerRect = footerLogEl ? footerLogEl.getBoundingClientRect() : null;
    var scrollFrac = window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    var settling = scrollFrac > 0.97 && footerRect;

    var startIdx = (heroClaimsFrame || projectsClaimFrame) ? FRAME_COUNT : 0;
    for (var i = startIdx; i < TOTAL_COUNT; i++) {
      var p = particles[i];
      if (settling) {
        p.x += (footerRect.left + footerRect.width / 2 - p.x) * 0.01;
        p.y += (footerRect.top - p.y) * 0.01;
        // Transient fade, not a permanent one — settleFade resets to 1
        // the moment you're not in the settling zone (see the else
        // branch), so scrolling back up and revisiting later doesn't
        // compound into dimmer and dimmer particles each time.
        p.settleFade = Math.max(0, (p.settleFade === undefined ? 1 : p.settleFade) - 0.01);
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
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    heroClaimsFrame = heroEased > 0.001 && heroSection.getBoundingClientRect().bottom > 0;
    projectsClaimFrame = currentProjectIndex >= 0 && projectsRawProgress < 1 && frameEased > 0.001;

    if (heroClaimsFrame) {
      drawHeroFrame();
    }
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
