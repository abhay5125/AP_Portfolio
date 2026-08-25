// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const nav = document.querySelector('.nav');

navToggle.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('nav--open');
  navToggle.setAttribute('aria-expanded', String(isOpen));
});

// Close mobile menu on link click
document.querySelectorAll('.nav__links a').forEach(link => {
  link.addEventListener('click', () => {
    nav.classList.remove('nav--open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

// Scroll-reveal for sections and job cards
const revealTargets = document.querySelectorAll(
  '.section__title, .section__intro, .about__copy, .about__stats, .job'
);
revealTargets.forEach(el => el.classList.add('reveal'));

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

revealTargets.forEach(el => observer.observe(el));

// Skills: staggered reveal.
//
// The stack groups are watched by the SAME observer as everything above,
// so they get the same "you've scrolled to this" signal — but they're
// deliberately not given the shared .reveal class, because that fades a
// whole block as one unit. Here each tag should arrive just behind the
// one before it, so the group assembles rather than appearing at once.
//
// .stagger-item is added here rather than baked into the HTML, so a
// visitor without JavaScript sees the finished tag cloud immediately
// instead of a block permanently stuck at opacity: 0 (there'd be no
// observer left to ever add .is-visible and reveal it).
//
// The delays are set here rather than as nth-child rules in CSS because
// a hardcoded per-position delay would silently go stale the moment a
// tag moved between groups, whereas this just re-counts.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.querySelectorAll('.stack-group').forEach(group => {
  const h3 = group.querySelector('h3');
  if (h3) h3.classList.add('stagger-item');
  group.querySelectorAll('.tags li').forEach((item, i) => {
    item.classList.add('stagger-item');
    if (!reduceMotion) {
      // Small head start so the group heading (delay 0) lands first.
      item.style.transitionDelay = (0.08 + i * 0.045) + 's';
    }
  });
  observer.observe(group);
});
