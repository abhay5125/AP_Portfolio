// Hero animation — stage 1: idle particle field.
//
// This draws a quiet drifting cluster of points on a canvas inside the
// hero diagram area, standing in for "satellites in orbit" before the
// user has scrolled. A later stage will add GSAP + ScrollTrigger to pull
// these same points into the pipeline diagram shape as the page scrolls.
//
// Safety: if the browser has no canvas support, or the visitor has
// "reduce motion" turned on, this script does nothing and the existing
// static SVG pipeline diagram (hero__diagram-fallback) stays visible,
// exactly as it is today.

(function () {
  var canvas = document.getElementById('heroCanvas');
  if (!canvas || !canvas.getContext) return;

  var prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;
  if (prefersReducedMotion) return;

  var ctx = canvas.getContext('2d');
  var container = canvas.parentElement;

  var PARTICLE_COUNT = 160;
  var particles = [];

  // Read the amber color from the site's existing CSS variables, so the
  // particle color stays in sync with the design tokens in style.css
  // instead of being hardcoded separately here.
  function hexToRgb(hex) {
    var clean = hex.trim().replace('#', '');
    var value = parseInt(clean, 16);
    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255
    };
  }

  var amberHex = getComputedStyle(document.documentElement)
    .getPropertyValue('--amber')
    .trim() || '#F5A623';
  var amber = hexToRgb(amberHex);

  function resizeCanvas() {
    var rect = container.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function createParticles() {
    var rect = container.getBoundingClientRect();
    particles = [];
    for (var i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.08,
        r: Math.random() * 1.4 + 0.6,
        alpha: Math.random() * 0.5 + 0.3
      });
    }
  }

  function step() {
    var rect = container.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.x += p.vx;
      p.y += p.vy;

      // wrap around the edges so the drift never runs out of particles
      if (p.x < 0) p.x = rect.width;
      if (p.x > rect.width) p.x = 0;
      if (p.y < 0) p.y = rect.height;
      if (p.y > rect.height) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle =
        'rgba(' + amber.r + ',' + amber.g + ',' + amber.b + ',' + p.alpha + ')';
      ctx.fill();
    }

    requestAnimationFrame(step);
  }

  function init() {
    resizeCanvas();
    createParticles();
    // Only now, once everything is ready, do we swap the fallback SVG
    // out for the canvas — see the body.has-particle-hero rules in
    // style.css.
    document.body.classList.add('has-particle-hero');
    requestAnimationFrame(step);
  }

  window.addEventListener('resize', function () {
    resizeCanvas();
  });

  init();
})();
