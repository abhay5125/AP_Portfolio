// STAGE2-CHECK: if you can see this comment when you open this file in Notepad, this is the correct updated file.
//
// Hero animation — stage 2: scroll-triggered assembly.
//
// Builds on stage 1's idle particle field. The hero section now pins in
// place with extra scroll room behind it (added automatically by
// ScrollTrigger). As the user scrolls through that pinned zone, the
// particles are pulled from their idle drift toward six fixed target
// points that match the original pipeline diagram's node positions —
// forming the API/Postgres/S3 -> ETL -> Warehouse/Dashboard shape.
// Connecting lines and labels fade in once the nodes are mostly formed.
//
// Safety: if canvas, GSAP, or ScrollTrigger aren't available, or the
// visitor has "reduce motion" turned on, this script does nothing and
// the static SVG fallback (hero__diagram-fallback) stays visible.

(function () {
  var canvas = document.getElementById('heroCanvas');
  if (!canvas || !canvas.getContext) return;

  var prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;
  if (prefersReducedMotion) return;

  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    return; // libraries failed to load — fallback SVG stays visible
  }
  gsap.registerPlugin(ScrollTrigger);

  var ctx = canvas.getContext('2d');
  var container = canvas.parentElement;
  var heroSection = document.querySelector('.hero');
  var navEl = document.querySelector('.nav');

  var subtitleEl = document.querySelector('.hero__subtitle');
  var descEl = document.querySelector('.hero__desc');
  var actionsEl = document.querySelector('.hero__actions');

  var PARTICLE_COUNT = 160;
  var particles = [];
  var progress = 0; // raw scroll progress through the pinned zone, 0-1
  var eased = 0;
  var easeFn = gsap.parseEase('power2.inOut');

  // ---- read design tokens from CSS so colors stay in sync with style.css ----
  function hexToRgb(hex) {
    var clean = hex.trim().replace('#', '');
    var value = parseInt(clean, 16);
    return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
  }
  var rootStyle = getComputedStyle(document.documentElement);
  var amber = hexToRgb(rootStyle.getPropertyValue('--amber').trim() || '#F5A623');
  var teal = hexToRgb(rootStyle.getPropertyValue('--teal').trim() || '#4FD1C5');
  var textRgb = hexToRgb(rootStyle.getPropertyValue('--text').trim() || '#E7ECF5');

  function lerpColor(a, b, t) {
    return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
  }

  // ---- node layout, matching the original pipeline SVG's 640x420 viewBox ----
  var NODES = [
    { key: 'api', label: 'API', vx: 70, vy: 80, count: 20 },
    { key: 'postgres', label: 'Postgres', vx: 70, vy: 190, count: 20 },
    { key: 's3', label: 'S3 logs', vx: 70, vy: 300, count: 20 },
    { key: 'etl', label: 'ETL', vx: 320, vy: 190, count: 40 },
    { key: 'warehouse', label: 'Warehouse', vx: 565, vy: 110, count: 30 },
    { key: 'dashboard', label: 'Dashboard', vx: 565, vy: 300, count: 30 }
  ];
  var EDGES = [
    ['api', 'etl'], ['postgres', 'etl'], ['s3', 'etl'],
    ['etl', 'warehouse'], ['etl', 'dashboard']
  ];

  var scaleX = 1, scaleY = 1;

  function updateScale() {
    var rect = container.getBoundingClientRect();
    scaleX = rect.width / 640;
    scaleY = rect.height / 420;
  }

  function nodeCenter(node) {
    return { x: node.vx * scaleX, y: node.vy * scaleY };
  }

  function assignTargets() {
    var idx = 0;
    NODES.forEach(function (node) {
      var center = nodeCenter(node);
      for (var i = 0; i < node.count; i++) {
        var p = particles[idx];
        if (p) {
          p.targetX = center.x + (Math.random() - 0.5) * 20;
          p.targetY = center.y + (Math.random() - 0.5) * 14;
          p.nodeKey = node.key;
        }
        idx++;
      }
    });
  }

  function resizeCanvas() {
    var rect = container.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    updateScale();
    assignTargets();
  }

  function createParticles() {
    var rect = container.getBoundingClientRect();
    particles = [];
    for (var i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        driftX: Math.random() * rect.width,
        driftY: Math.random() * rect.height,
        drawX: Math.random() * rect.width,
        drawY: Math.random() * rect.height,
        vx: (Math.random() - 0.5) * 0.1,
        vy: (Math.random() - 0.5) * 0.1,
        r: Math.random() * 1.4 + 0.6,
        alpha: Math.random() * 0.5 + 0.3,
        targetX: 0,
        targetY: 0,
        nodeKey: null
      });
    }
    assignTargets();
  }

  function draw() {
    var rect = container.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    var mixed = lerpColor(amber, teal, eased);
    var lineColorPrefix =
      'rgba(' + Math.round(mixed.r) + ',' + Math.round(mixed.g) + ',' + Math.round(mixed.b) + ',';

    // connecting lines, fading in once the clusters have mostly formed
    var linkAlpha = Math.max(0, Math.min(1, (eased - 0.5) / 0.4));
    if (linkAlpha > 0) {
      var centers = {};
      NODES.forEach(function (n) { centers[n.key] = nodeCenter(n); });
      ctx.lineWidth = 1 + eased;
      ctx.setLineDash(eased < 0.999 ? [4, 4] : [8, 6]);
      EDGES.forEach(function (edge) {
        var a = centers[edge[0]], b = centers[edge[1]];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = lineColorPrefix + linkAlpha + ')';
        ctx.stroke();
      });
      ctx.setLineDash([]);
    }

    // particles: drift fades out, pull toward target fades in, as eased -> 1
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var driftFactor = 1 - eased;
      p.driftX += p.vx * driftFactor;
      p.driftY += p.vy * driftFactor;
      if (p.driftX < 0) p.driftX = rect.width;
      if (p.driftX > rect.width) p.driftX = 0;
      if (p.driftY < 0) p.driftY = rect.height;
      if (p.driftY > rect.height) p.driftY = 0;

      var desiredX = p.driftX + (p.targetX - p.driftX) * eased;
      var desiredY = p.driftY + (p.targetY - p.driftY) * eased;
      p.drawX += (desiredX - p.drawX) * 0.08;
      p.drawY += (desiredY - p.drawY) * 0.08;

      ctx.beginPath();
      ctx.arc(p.drawX, p.drawY, p.r, 0, Math.PI * 2);
      ctx.fillStyle =
        'rgba(' + Math.round(mixed.r) + ',' + Math.round(mixed.g) + ',' + Math.round(mixed.b) + ',' + p.alpha + ')';
      ctx.fill();
    }

    // node labels, once the pipeline is nearly resolved
    var labelAlpha = Math.max(0, Math.min(1, (eased - 0.8) / 0.2));
    if (labelAlpha > 0) {
      ctx.font = '11px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle =
        'rgba(' + textRgb.r + ',' + textRgb.g + ',' + textRgb.b + ',' + labelAlpha + ')';
      NODES.forEach(function (n) {
        var c = nodeCenter(n);
        ctx.fillText(n.label, c.x, c.y + 24);
      });
    }

    requestAnimationFrame(draw);
  }

  function updateTextReveals() {
    if (subtitleEl) subtitleEl.classList.toggle('is-revealed', progress > 0.05);
    if (descEl) descEl.classList.toggle('is-revealed', progress > 0.3);
    if (actionsEl) actionsEl.classList.toggle('is-revealed', progress > 0.85);
  }

  function setupScrollTrigger() {
    var navHeight = navEl ? navEl.offsetHeight : 0;
    ScrollTrigger.create({
      trigger: heroSection,
      start: 'top ' + navHeight,
      end: '+=2500',
      pin: true,
      pinSpacing: true,
      scrub: 1,
      onUpdate: function (self) {
        progress = self.progress;
        eased = easeFn(progress);
        updateTextReveals();
      }
    });
  }

  function init() {
    resizeCanvas();
    createParticles();
    document.body.classList.add('has-particle-hero');
    setupScrollTrigger();
    requestAnimationFrame(draw);
  }

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resizeCanvas();
      ScrollTrigger.refresh();
    }, 150);
  });

  init();
})();
