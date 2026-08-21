// STAGE5-CHECK (hero-medallion.js): if you can see this comment when you open
// this file in Notepad, this is the correct updated file. Stage 5 = medallion
// hero. This file REPLACES site-particles.js, which should be deleted.
//
// =====================================================================
// HERO — MEDALLION TRAVELLING ENTITY
// =====================================================================
//
// WHAT THIS DOES
// The hero pins in place while you scroll through it. During that pin, a
// single glowing dot travels left-to-right along an invisible track that
// runs through three stage boxes (Bronze, Silver, Gold). As the dot
// reaches each stage, that stage lights up in its own colour and its
// blurb text fades in. The hero's own text (subtitle, description,
// buttons) also reveals in sequence.
//
// WHY THIS IS BUILT THIS WAY
// The previous version used a <canvas> and redrew ~220 particles by hand
// every single frame. That was heavy and fiddly. This version instead
// moves ONE existing SVG element and toggles a few CSS classes — the
// browser handles all the actual drawing, which is dramatically smoother
// and far less code to get wrong.
//
// THE KEY TRICK
// SVG paths have two built-in methods that do the hard maths for us:
//   path.getTotalLength()        -> how long the path is
//   path.getPointAtLength(dist)  -> the {x, y} at that distance along it
// So "move the dot to 40% along the track" is just:
//   path.getPointAtLength(0.4 * path.getTotalLength())
// This works for ANY path shape — if you later curve the track, this code
// needs no changes at all.
//
// SAFETY / PROGRESSIVE ENHANCEMENT
// If GSAP fails to load, or the visitor has "reduce motion" turned on,
// this script exits early and does nothing. Because the CSS defaults show
// every stage already lit (see style.css), the diagram still reads fine —
// it just doesn't animate. Nothing breaks.

(function () {
  // ---------------------------------------------------------------
  // 1. GRAB THE ELEMENTS WE NEED
  // ---------------------------------------------------------------
  var heroSection = document.querySelector('.hero');
  var flowPath = document.getElementById('flowPath');
  var flowEntity = document.getElementById('flowEntity');
  var stages = document.querySelectorAll('.stage');
  var navEl = document.querySelector('.nav');

  // Hero text elements that reveal progressively as you scroll
  var subtitleEl = document.querySelector('.hero__subtitle');
  var descEl = document.querySelector('.hero__desc');
  var actionsEl = document.querySelector('.hero__actions');

  // If any core piece is missing, bail out quietly rather than throwing
  // errors — the static diagram is still perfectly readable.
  if (!heroSection || !flowPath || !flowEntity || !stages.length) return;

  // ---------------------------------------------------------------
  // 2. SAFETY CHECKS
  // ---------------------------------------------------------------
  var prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;
  if (prefersReducedMotion) return;

  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    return; // libraries didn't load — static diagram stays visible
  }
  gsap.registerPlugin(ScrollTrigger);

  // ---------------------------------------------------------------
  // 3. WHEN DOES EACH STAGE LIGHT UP?
  // ---------------------------------------------------------------
  // These are positions along the scroll (0 = start of pin, 1 = end).
  // A stage switches on once the entity has travelled past its number.
  //
  // The track runs from x=20 to x=620 in the SVG, and the three boxes
  // start at x=20, x=235 and x=450. Converting those box positions into
  // fractions of the track gives roughly 0.00, 0.36 and 0.72 — the small
  // offsets below just make each stage light up a touch *before* the dot
  // fully arrives, which feels more anticipatory and less mechanical.
  //
  // TWEAK THESE if the timing feels off — they're the main "feel" dial.
  var STAGE_TRIGGERS = [0.06, 0.38, 0.72];

  // Same idea for the hero's own text.
  var TEXT_TRIGGERS = {
    subtitle: 0.05,
    desc: 0.28,
    actions: 0.82
  };

  // How far you scroll (in pixels) before the pin releases.
  // Lesson from the previous build: long pins make scrolling back UP feel
  // tedious, because a scrubbed animation reverses through every frame.
  // 1400 is deliberately shorter than the 2500 we started with.
  var PIN_DISTANCE = 1400;

  // ---------------------------------------------------------------
  // 4. POSITION THE ENTITY ALONG THE TRACK
  // ---------------------------------------------------------------
  var pathLength = flowPath.getTotalLength();

  function moveEntity(progress) {
    // progress is 0 to 1. Multiply by the path length to get a distance,
    // then ask the path where that distance actually is in x/y space.
    var point = flowPath.getPointAtLength(progress * pathLength);

    // Move the entity group there. Note we set an SVG "transform"
    // attribute rather than CSS left/top — SVG coordinates are their own
    // system, unrelated to page pixels.
    flowEntity.setAttribute('transform', 'translate(' + point.x + ',' + point.y + ')');
  }

  // ---------------------------------------------------------------
  // 5. LIGHT UP STAGES AND REVEAL TEXT
  // ---------------------------------------------------------------
  function updateStages(progress) {
    stages.forEach(function (stage, i) {
      // classList.toggle(name, condition) adds the class when the
      // condition is true and removes it when false — so this
      // automatically handles scrolling back up as well as down.
      stage.classList.toggle('is-active', progress >= STAGE_TRIGGERS[i]);
    });
  }

  function updateHeroText(progress) {
    if (subtitleEl) subtitleEl.classList.toggle('is-revealed', progress > TEXT_TRIGGERS.subtitle);
    if (descEl) descEl.classList.toggle('is-revealed', progress > TEXT_TRIGGERS.desc);
    if (actionsEl) actionsEl.classList.toggle('is-revealed', progress > TEXT_TRIGGERS.actions);
  }

  // ---------------------------------------------------------------
  // 6. WIRE IT ALL TO SCROLL
  // ---------------------------------------------------------------
  function init() {
    // Tell the CSS that JS is running. This dims the stages down to their
    // "not yet reached" state — without this class, everything stays lit,
    // which is exactly what we want if this script never runs.
    document.body.classList.add('medallion-ready');

    // Put the entity at the very start before anything scrolls.
    moveEntity(0);
    updateStages(0);
    updateHeroText(0);

    var navHeight = navEl ? navEl.offsetHeight : 0;

    ScrollTrigger.create({
      trigger: heroSection,
      start: 'top ' + navHeight,   // pin once the hero reaches the navbar
      end: '+=' + PIN_DISTANCE,    // ...and release this far down
      pin: true,
      pinSpacing: true,
      scrub: 1,                    // tie animation to scroll, with 1s of smoothing

      // onUpdate fires whenever the scroll position changes.
      // self.progress is 0 at the start of the pin, 1 at the end.
      onUpdate: function (self) {
        moveEntity(self.progress);
        updateStages(self.progress);
        updateHeroText(self.progress);
      }
    });
  }

  // ---------------------------------------------------------------
  // 7. HANDLE WINDOW RESIZING
  // ---------------------------------------------------------------
  // The SVG scales itself, so the entity's position stays correct without
  // recalculating. But ScrollTrigger caches page measurements, so it needs
  // telling to re-measure. The timeout avoids doing this on every single
  // pixel of a drag-resize.
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      ScrollTrigger.refresh();
    }, 150);
  });

  init();
})();
