// Projects node-graph.
//
// A static SVG network diagram: one node per project, edges between
// projects that genuinely share a tool or capability. Deliberately
// mirrors how orchestration tools (Airflow, dbt) draw a pipeline — one
// thing highlighted against the rest — which is authentic to the actual
// work rather than a borrowed aesthetic.
//
// "Static" here means the LAYOUT is fixed (hand-placed coordinates), not
// that it's inert — there's no force simulation to run, which keeps this
// far simpler than a dynamically laid-out graph while looking the same.
//
// No scroll pinning anywhere. The section scrolls normally; the graph
// just fades itself in the first time it comes into view.
//
// Colour discipline (Flight Recorder palette): nodes are neutral — they
// get their presence from LIGHTNESS, not hue. The one accent colour
// appears only on whatever is currently active: the hovered/focused
// node, its halo, its connected edges, and text inside an expanded
// summary. That's what keeps orange feeling like an event rather than
// decoration.
//
// Without JavaScript this file simply never runs, and the plain .jobs
// card grid stays visible as the fallback (see style.css).

(function () {
  var section = document.getElementById('projects');
  var mount = document.getElementById('projectsGraph');
  var panel = document.getElementById('projectsSummary');
  if (!section || !mount || !panel) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // =====================================================================
  // DATA — two tiers, on purpose
  //
  // `tools` are specific and concrete (Python, MATLAB, Databricks).
  // `capabilities` come from one shared, controlled vocabulary
  // (Quantitative Analysis, Pipeline Engineering, ...).
  //
  // Why the split: the first version of this graph tagged everything in
  // one flat list, mixing tools with techniques, and two projects only
  // counted as connected if their tag strings matched exactly. The result
  // was ONE edge across five projects — which read as "these projects are
  // unrelated" when the truth was just that the tags were written at
  // inconsistent levels of detail and left some real tools out entirely.
  //
  // Two corrections were made to the underlying data, both fixing
  // under-reporting rather than inventing anything:
  //   - Delivery now lists Python and Power BI. Databricks/Spark work
  //     here was PySpark, and the reporting layer was Power BI; both were
  //     simply missing from the original tag list.
  //   - MAV's "Quantitative Engineering Analysis" is now "Quantitative
  //     Analysis" — the same skill Trading and F1 were already tagged
  //     with, previously just spelled differently.
  // =====================================================================
  var PROJECTS = [
    {
      id: 'PROJECT-01',
      key: 'mav',
      glyph: 'mav',
      x: 120, y: 130,
      title: 'DC micro-motor selection for a Biologically-Inspired Flapping-Wing MAV',
      context: 'Choosing a DC micro-motor for a biologically-inspired flapping-wing micro aerial vehicle, where mass, power, frequency and efficiency all trade against each other.',
      work: 'Built a computational model in MATLAB to generate and analyse actuator performance data, comparing parameters across the range to find how those four quantities actually relate.',
      outcome: 'Those relationships became the basis for judging the design trade-offs between candidate motors.',
      tools: ['MATLAB'],
      capabilities: ['Quantitative Analysis', 'Computational Modelling', 'Data Visualisation'],
      status: 'live',
      category: 'Aerospace Analysis'
    },
    {
      id: 'PROJECT-02',
      key: 'trading',
      glyph: 'trading',
      x: 390, y: 210,
      title: 'Quantitative Trading Strategy Backtesting',
      context: 'Testing whether technical trading rules hold up when they are replayed against real historical price data, rather than only in description.',
      work: 'Pulled historical financial data with Python and Pandas, engineered technical indicators including moving averages and Bollinger Bands, and built a backtest to run strategies over the series.',
      outcome: 'Each strategy could then be judged on how it would genuinely have performed.',
      tools: ['Python', 'Pandas', 'NumPy', 'yfinance', 'Matplotlib'],
      capabilities: ['Quantitative Analysis', 'API Integration', 'Data Visualisation'],
      status: 'live',
      category: 'Data Analysis'
    },
    {
      id: 'PROJECT-03',
      key: 'delivery',
      glyph: 'delivery',
      x: 330, y: 390,
      title: 'NYC Delivery Service — End-to-End Data Engineering',
      context: 'Restaurant delivery demand moves for reasons that are not in the sales data itself — weather, public holidays, major sporting events.',
      work: 'Built an end-to-end solution moving the delivery data through a Medallion architecture in Databricks, then modelled it for reporting in Power BI.',
      outcome: 'Sales trends could be read against those outside factors, which is what made shifts in demand explainable rather than just visible.',
      tools: ['Python', 'Databricks', 'Apache Spark', 'Microsoft Azure', 'Power BI'],
      capabilities: ['Pipeline Engineering', 'Data Modelling', 'Cloud', 'Data Visualisation'],
      status: 'in progress',
      category: 'Data Engineering'
    },
    {
      id: 'PROJECT-04',
      key: 'f1',
      glyph: 'f1',
      x: 660, y: 120,
      title: 'Formula 1 Performance Analysis',
      context: 'Tyre degradation drives race strategy, but it only becomes visible once lap times are broken down by compound and by stint.',
      work: 'Pulled race data from the FastF1 API, calculated degradation across compounds and stints, and analysed lap-time trends and driver performance.',
      outcome: 'Presented as an interactive Streamlit dashboard, so a race can be explored rather than only summarised.',
      tools: ['Python', 'Pandas', 'NumPy', 'FastF1 API', 'Streamlit'],
      capabilities: ['Quantitative Analysis', 'API Integration', 'Data Visualisation'],
      status: 'archived',
      category: 'Data Analysis'
    },
    {
      // Content deliberately blank — this project is confirmed as going in
      // the graph, but its write-up hasn't been done yet (see
      // portfolio-project-notes.md entry 10). It shows as a normal node;
      // clicking it gets a "coming soon" state rather than empty fields.
      // With no tags it has no edges, which reads honestly as "not wired
      // in yet" rather than as a bug.
      id: 'PROJECT-05',
      key: 'satellite',
      glyph: 'satellite',
      x: 690, y: 360,
      title: '',
      context: '',
      work: '',
      outcome: '',
      tools: [],
      capabilities: [],
      status: '',
      category: '',
      placeholder: true
    }
  ];

  // =====================================================================
  // GLYPHS — a readout of each project's actual output
  //
  // These replace the earlier dot-cloud icons, which were reused from the
  // particle system and simply didn't survive being shrunk to node size —
  // eight scattered dots can't describe a scooter.
  //
  // Rather than switching to stock line icons (a bee, a car), each glyph
  // is a small chart of what the project actually produced: a peak
  // efficiency curve, a backtested price line, the three tiers of a
  // Medallion architecture, a tyre-degradation decay curve, an orbit.
  // They're distinctive, they're informative, and a continuous line reads
  // far better at 40px than scattered points. They also sit naturally in
  // the site's instrument-panel voice — these look like readouts.
  //
  // Drawn in a local 44 x 30 box; centred on the node below.
  // =====================================================================
  var GLYPH_W = 44, GLYPH_H = 30;
  var GLYPHS = {
    // Performance peaks then falls away — the efficiency-vs-frequency
    // relationship the actuator study was looking for.
    mav: [
      { t: 'path', d: 'M1,28 C10,28 12,3 22,3 C32,3 34,28 43,28' },
      { t: 'line', x1: 22, y1: 3, x2: 22, y2: 28, dash: '2 3' }
    ],
    // A volatile price series with a smoother moving average through it —
    // exactly the pair of lines the backtest was comparing.
    trading: [
      { t: 'path', d: 'M1,21 L7,14 L13,24 L19,9 L25,17 L31,6 L37,13 L43,3' },
      { t: 'path', d: 'M1,25 C13,21 21,18 31,13 C37,10 40,8 43,7', dash: '3 3', soft: true }
    ],
    // Bronze, silver, gold: the three ascending tiers of the Medallion
    // architecture the delivery data moves through.
    delivery: [
      { t: 'rect', x: 3, y: 19, width: 10, height: 10, fill: true },
      { t: 'rect', x: 17, y: 11, width: 10, height: 18, fill: true },
      { t: 'rect', x: 31, y: 3, width: 10, height: 26, fill: true }
    ],
    // Lap times decaying as the tyre wears through a stint.
    f1: [
      { t: 'path', d: 'M1,4 C13,7 27,15 43,28' },
      { t: 'line', x1: 1, y1: 4, x2: 43, y2: 4, dash: '2 3' }
    ],
    // An orbit with a body on it.
    satellite: [
      { t: 'path', d: 'M4,23 A22,12 -18 1 1 40,9' },
      { t: 'circle', cx: 40, cy: 9, r: 3.2, fill: true },
      { t: 'circle', cx: 21, cy: 17, r: 2.2, fill: true }
    ]
  };

  var NODE_RADIUS = 36;

  // =====================================================================
  // EDGES — computed, not authored
  //
  // Every pair of projects is checked for tools/capabilities they actually
  // have in common. Only real overlaps get a line, and the line's
  // thickness scales with how much is shared, so the graph shows the
  // STRENGTH of a relationship rather than just its existence.
  //
  // One rule worth understanding: a tag shared by (almost) every project
  // carries no information. "Data Visualisation" is true of all four live
  // projects — leaving it in would connect everything to everything and
  // make the graph noise again, the opposite failure to the one-edge
  // version. So anything that universal is dropped from edge matching. It
  // still shows in a project's summary; it just isn't a distinguishing
  // link between two of them.
  // =====================================================================
  var UNIVERSAL_THRESHOLD = 0.8;

  function tagsOf(p) { return p.tools.concat(p.capabilities); }

  function findUniversalTags(projects) {
    var tagged = projects.filter(function (p) { return tagsOf(p).length > 0; });
    var counts = {};
    tagged.forEach(function (p) {
      tagsOf(p).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
    });
    return Object.keys(counts).filter(function (t) {
      return counts[t] / tagged.length >= UNIVERSAL_THRESHOLD;
    });
  }

  var UNIVERSAL = findUniversalTags(PROJECTS);

  function computeEdges(projects) {
    var edges = [];
    for (var i = 0; i < projects.length; i++) {
      for (var j = i + 1; j < projects.length; j++) {
        var a = projects[i], b = projects[j];
        var bTags = tagsOf(b);
        var shared = tagsOf(a).filter(function (t) {
          return bTags.indexOf(t) !== -1 && UNIVERSAL.indexOf(t) === -1;
        });
        if (shared.length) edges.push({ a: a, b: b, shared: shared });
      }
    }
    return edges;
  }
  var EDGES = computeEdges(PROJECTS);

  // Which projects each project is directly connected to — used to decide
  // what stays sharp vs what gets dimmed/blurred on hover.
  var neighbours = {};
  PROJECTS.forEach(function (p) { neighbours[p.key] = []; });
  EDGES.forEach(function (e) {
    neighbours[e.a.key].push(e.b.key);
    neighbours[e.b.key].push(e.a.key);
  });

  // =====================================================================
  // BUILD THE SVG
  // =====================================================================
  var SVG_NS = 'http://www.w3.org/2000/svg';
  function svgEl(name, attrs) {
    var el = document.createElementNS(SVG_NS, name);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) el.setAttribute(k, attrs[k]);
    return el;
  }

  // The SVG lives inside a scroll wrapper. On a phone the graph would
  // otherwise shrink until the nodes were too small to tap, so below a
  // certain width it keeps a usable minimum size and scrolls sideways
  // instead (see .pgraph__scroll in style.css).
  var scroller = document.createElement('div');
  scroller.className = 'pgraph__scroll';

  var svg = svgEl('svg', {
    'class': 'pgraph__svg',
    viewBox: '0 0 820 470',
    preserveAspectRatio: 'xMidYMid meet',
    role: 'group',
    'aria-label': 'Project network. Projects are connected where they share tools or capabilities.'
  });

  // Edges first so nodes paint on top of them.
  var edgeLayer = svgEl('g', { 'class': 'pgraph__edges' });
  var nodeLayer = svgEl('g', { 'class': 'pgraph__nodes' });
  svg.appendChild(edgeLayer);
  svg.appendChild(nodeLayer);

  EDGES.forEach(function (e, idx) {
    var g = svgEl('g', { 'class': 'pgraph__edge', 'data-a': e.a.key, 'data-b': e.b.key });

    // Edges are gently CURVED rather than straight. In a graph this
    // dense, straight lines inevitably pass close to nodes they have
    // nothing to do with — the PROJECT-01/PROJECT-04 link ran right along
    // the edge of PROJECT-02, which made it look like it terminated there.
    // Bowing each edge slightly pushes it clear of whatever it passes,
    // so the topology stays unambiguous, and it reads more like a flow
    // diagram than a wireframe.
    //
    // The control point is the midpoint, shifted perpendicular to the
    // line by a fraction of its length — so longer edges bow more, and
    // every edge bows consistently.
    var dx = e.b.x - e.a.x, dy = e.b.y - e.a.y;
    var straight = Math.sqrt(dx * dx + dy * dy);
    var bow = straight * 0.11;
    var cx = (e.a.x + e.b.x) / 2 + (-dy / straight) * bow;
    var cy = (e.a.y + e.b.y) / 2 + (dx / straight) * bow;
    var d = 'M' + e.a.x + ',' + e.a.y + ' Q' + cx + ',' + cy + ' ' + e.b.x + ',' + e.b.y;

    // Thickness carries meaning: more shared tools/capabilities means a
    // visibly stronger link. Capped so a very strong pair doesn't turn
    // into a slab.
    var weight = Math.min(1 + e.shared.length * 0.45, 3.4);

    // The visible line. It draws itself in on reveal by starting fully
    // "dashed off" — one dash exactly as long as the curve, pushed
    // entirely out of view — and animating that offset back to 0.
    var line = svgEl('path', { 'class': 'pgraph__edge-line', d: d });
    g.appendChild(line);

    // A second path exactly on top, showing only a short dash. Sliding
    // that dash end to end is what reads as a single pulse of data
    // travelling along the connection.
    var pulse = svgEl('path', { 'class': 'pgraph__edge-pulse', d: d });
    g.appendChild(pulse);

    edgeLayer.appendChild(g);

    // Measured rather than calculated: the curve's true length isn't the
    // straight-line distance, and getting it wrong would leave the
    // draw-in animation short or overshooting. One read at build time,
    // never inside the animation loop.
    var length = line.getTotalLength();
    line.style.strokeWidth = weight;
    line.style.strokeDasharray = length;
    line.style.strokeDashoffset = reduceMotion ? 0 : length;
    line.style.transitionDelay = reduceMotion ? '0s' : (0.55 + idx * 0.1) + 's';

    pulse.style.strokeDasharray = '7 ' + length;
    pulse.style.strokeDashoffset = length;
    // The keyframes need to know how far to slide the dash, and that
    // differs per edge, so it's handed over as a custom property.
    pulse.style.setProperty('--pulse-len', length);

    // What the two projects share, shown right on the connection when
    // it's highlighted. This is what turns the graph from decorative
    // into actually informative — you can see WHY two things are linked
    // without opening either of them. Sat on the curve's own midpoint so
    // labels on different edges naturally separate.
    var mid = line.getPointAtLength(length / 2);
    var label = svgEl('text', { 'class': 'pgraph__edge-label', x: mid.x, y: mid.y - 7 });
    label.textContent = e.shared.length > 1
      ? e.shared[0] + '  +' + (e.shared.length - 1)
      : e.shared[0];
    g.appendChild(label);

    var title = svgEl('title', {});
    title.textContent = e.a.id + ' and ' + e.b.id + ' share: ' + e.shared.join(', ');
    g.appendChild(title);
  });

  PROJECTS.forEach(function (p, idx) {
    var g = svgEl('g', {
      'class': 'pgraph__node',
      'data-key': p.key,
      transform: 'translate(' + p.x + ',' + p.y + ')',
      tabindex: '0',
      role: 'button',
      'aria-expanded': 'false',
      'aria-label': p.placeholder
        ? p.id + ', details coming soon'
        : p.id + ', ' + p.title
    });

    // Everything visual goes inside a SECOND, inner group, and the reveal
    // animation is applied to that rather than to `g` itself.
    //
    // This matters more than it looks: `g` is positioned with an SVG
    // transform ATTRIBUTE (translate(x,y)), and a CSS `transform` on the
    // same element replaces that attribute rather than adding to it.
    // Animating `g` directly threw every node's position away and stacked
    // all five in one spot. Keeping position on the outer group and
    // animation on the inner one means the two can never compete.
    var rise = svgEl('g', { 'class': 'pgraph__rise' });
    rise.style.transitionDelay = reduceMotion ? '0s' : (idx * 0.09) + 's';
    g.appendChild(rise);

    // The halo. A second, larger circle at low opacity behind the node —
    // the same glow technique used elsewhere on the site, and
    // deliberately NOT a blur filter (a plain extra circle is cheaper and
    // holds a cleaner edge).
    //
    // It's faintly visible at rest in neutral steel, and on activation
    // the SAME circle warms to accent and strengthens. So hovering reads
    // as something already there getting hotter, rather than a new object
    // appearing.
    rise.appendChild(svgEl('circle', { 'class': 'pgraph__halo', r: NODE_RADIUS + 16 }));
    rise.appendChild(svgEl('circle', { 'class': 'pgraph__disc', r: NODE_RADIUS }));

    var parts = GLYPHS[p.glyph] || [];
    if (parts.length) {
      var glyphG = svgEl('g', {
        'class': 'pgraph__glyph',
        transform: 'translate(' + (-GLYPH_W / 2) + ',' + (-GLYPH_H / 2) + ')'
      });
      parts.forEach(function (part) {
        var attrs = {};
        for (var k in part) {
          if (k === 't' || k === 'dash' || k === 'fill' || k === 'soft') continue;
          attrs[k] = part[k];
        }
        var el = svgEl(part.t, attrs);
        if (part.dash) el.style.strokeDasharray = part.dash;
        if (part.fill) el.setAttribute('data-fill', 'true');
        if (part.soft) el.setAttribute('data-soft', 'true');
        glyphG.appendChild(el);
      });
      rise.appendChild(glyphG);
    }

    var label = svgEl('text', { 'class': 'pgraph__label', y: NODE_RADIUS + 22 });
    label.textContent = p.id;
    rise.appendChild(label);

    nodeLayer.appendChild(g);
  });

  scroller.appendChild(svg);
  mount.appendChild(scroller);

  // =====================================================================
  // HIGHLIGHT (hover / keyboard focus)
  // =====================================================================
  function setHighlight(key) {
    svg.classList.toggle('is-highlighting', key !== null);

    var near = key ? neighbours[key] : [];
    nodeLayer.querySelectorAll('.pgraph__node').forEach(function (n) {
      var k = n.getAttribute('data-key');
      n.classList.toggle('is-active', k === key);
      n.classList.toggle('is-neighbour', near.indexOf(k) !== -1);
    });

    edgeLayer.querySelectorAll('.pgraph__edge').forEach(function (edge) {
      var connected = key !== null &&
        (edge.getAttribute('data-a') === key || edge.getAttribute('data-b') === key);
      var wasConnected = edge.classList.contains('is-connected');
      edge.classList.toggle('is-connected', connected);

      // Fire the travelling-dot pulse once, only when an edge becomes
      // newly highlighted — not continuously, and not on the way out.
      if (connected && !wasConnected && !reduceMotion) firePulse(edge);
    });
  }

  function firePulse(edge) {
    var pulse = edge.querySelector('.pgraph__edge-pulse');
    if (!pulse) return;
    // Restart cleanly even if a previous pulse is still running: drop the
    // class, force the browser to notice, then re-add it.
    pulse.classList.remove('is-pulsing');
    void pulse.getBoundingClientRect();
    pulse.classList.add('is-pulsing');
  }

  nodeLayer.querySelectorAll('.pgraph__node').forEach(function (n) {
    var key = n.getAttribute('data-key');
    n.addEventListener('pointerenter', function () { setHighlight(key); });
    n.addEventListener('pointerleave', function () { setHighlight(null); });
    n.addEventListener('focus', function () { setHighlight(key); });
    n.addEventListener('blur', function () { setHighlight(null); });
    n.addEventListener('click', function () { toggleSummary(key); });
    n.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        toggleSummary(key);
      }
    });
  });

  // =====================================================================
  // IN-PAGE EDITORIAL REVEAL (click a node to expand that project)
  //
  // Deliberately NOT a card. The previous version was a rounded panel
  // with an accent left border, four orange uppercase labels (WHAT
  // INVOLVED / TOOLS / CAPABILITIES / STATUS), two rows of pill tags, a
  // category badge and a solid orange button — i.e. one micro-template
  // repeated four times inside a container, which is exactly the shape
  // that reads as generated rather than written (see
  // ui-pattern-review.md).
  //
  // What replaces it has no container at all. Hierarchy comes from type
  // size, colour and spacing: quiet mono meta line, a display-size
  // title, a slightly brighter opening line, then supporting prose, then
  // one plain inline technology run and one understated link. It should
  // read as a short project story that happens to be technical, not as a
  // record with labelled fields.
  //
  // EXPAND MECHANIC: the wrapper is a one-row grid animating
  // grid-template-rows 0fr -> 1fr. That resolves to the content's own
  // height, so there is nothing to measure in JS and therefore no
  // wrong-height layout jump — the failure mode a max-height/scrollHeight
  // implementation is prone to when content wraps differently than it did
  // when it was measured.
  // =====================================================================
  var openKey = null;

  // Built once. index.html ships #projectsSummary empty on purpose (so
  // there's nothing to see without JavaScript); these two wrappers are
  // what the grid expand animates, and content is refilled per project.
  var inner = document.createElement('div');
  inner.className = 'psummary__inner';
  var content = document.createElement('div');
  content.className = 'psummary__content';
  inner.appendChild(content);
  panel.appendChild(inner);

  // How long the outgoing project fades before the incoming one is built.
  // Switching directly between two open projects can't animate its own
  // height (the grid row is already 1fr, so the value never changes and
  // there's nothing to transition) — so the swap happens while the text
  // is invisible, and the height settles behind the fade instead of
  // snapping under live text.
  var SWAP_MS = reduceMotion ? 0 : 170;

  function para(cls, text) {
    var el = document.createElement('p');
    el.className = cls;
    el.textContent = text;
    return el;
  }

  function buildSummary(p) {
    content.innerHTML = '';

    // Meta line: ID, and status only as a quiet trailing clause — not a
    // labelled STATUS field. Same "PROJECT-03 · in progress" voice the
    // no-JS fallback cards and the footer's // last_run line already use.
    var meta = document.createElement('p');
    meta.className = 'psummary__meta';
    meta.textContent = p.status ? p.id + '  ·  ' + p.status : p.id;
    content.appendChild(meta);

    if (p.placeholder) {
      content.appendChild(para('psummary__lede', 'Write-up still to come.'));
      content.appendChild(para('psummary__para',
        'This project is confirmed for the graph — the write-up hasn’t been done yet.'));
      return;
    }

    var h = document.createElement('h3');
    h.className = 'psummary__title';
    h.textContent = p.title;
    content.appendChild(h);

    // The story, in order: what it was, what was actually done, what came
    // of it. No labels — the opening line is brighter and larger, which
    // is what marks it as the framing rather than a heading saying so.
    if (p.context) content.appendChild(para('psummary__lede', p.context));
    if (p.work) content.appendChild(para('psummary__para', p.work));
    if (p.outcome) content.appendChild(para('psummary__para', p.outcome));

    // One inline run, not two pill groups. Tools and capabilities stay
    // separate in the DATA (the edge logic matches on both and is not
    // being touched), but a reader doesn't benefit from having them
    // presented as two different kinds of thing.
    var tech = p.tools.concat(p.capabilities);
    if (tech.length) {
      content.appendChild(para('psummary__tech', tech.join('  ·  ')));
    }

    // Detail pages don't exist yet — "#" is the same placeholder
    // convention used for the repo/write-up links elsewhere on the site.
    var link = document.createElement('a');
    link.className = 'psummary__more';
    link.href = '#';
    link.textContent = 'Full write-up →';
    content.appendChild(link);
  }

  function closeSummary() {
    openKey = null;
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    content.classList.remove('is-swapping');
    syncOpenState();
  }

  function syncOpenState() {
    // Everything that isn't the expanded project recedes while one is
    // open — the page is giving that project the floor. Opacity only; the
    // node colour treatment itself is untouched.
    svg.classList.toggle('has-open', openKey !== null);
    nodeLayer.querySelectorAll('.pgraph__node').forEach(function (n) {
      var isOpen = n.getAttribute('data-key') === openKey;
      n.classList.toggle('is-open', isOpen);
      n.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  function toggleSummary(key) {
    var p = PROJECTS.filter(function (q) { return q.key === key; })[0];
    if (!p) return;

    if (openKey === key) {
      closeSummary(); // clicking the open node again closes it
      return;
    }

    var wasOpen = openKey !== null;
    openKey = key;
    syncOpenState();

    if (wasOpen && SWAP_MS) {
      // Already expanded on a different project — cross-fade rather than
      // collapsing and re-opening, which would be a lot of movement for
      // what is really just a change of subject.
      content.classList.add('is-swapping');
      window.setTimeout(function () {
        if (openKey !== key) return; // a newer click already won
        buildSummary(p);
        content.classList.remove('is-swapping');
      }, SWAP_MS);
    } else {
      buildSummary(p);
      content.classList.remove('is-swapping');
      panel.classList.add('is-open');
      panel.setAttribute('aria-hidden', 'false');
    }

    // On a short screen the summary can open below the fold, which makes
    // clicking a node look like it did nothing. Nudge it into view —
    // "nearest" so it only scrolls if it actually needs to.
    panel.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  // Escape closes, and so does clicking away from the section — standard
  // expanded-panel behaviour, and cheap to support.
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && openKey) closeSummary();
  });
  document.addEventListener('pointerdown', function (ev) {
    if (openKey && !section.contains(ev.target)) closeSummary();
  });

  // =====================================================================
  // REVEAL ON SCROLL INTO VIEW
  //
  // The graph starts hidden and reveals itself the first time it actually
  // comes into view — not on page load, so it isn't already over by the
  // time you scroll down to it. Nodes stagger in (their per-node
  // transition-delay is set above), then the edges draw themselves along.
  //
  // With reduced motion on, the whole thing switches straight to its
  // finished state: no stagger, no line-drawing, no pulses (firePulse is
  // skipped above too).
  // =====================================================================
  function reveal() { mount.classList.add('is-revealed'); }

  if (reduceMotion || typeof IntersectionObserver === 'undefined') {
    reveal();
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          reveal();
          io.disconnect(); // one-shot: it should never replay on scroll back
        }
      });
    }, { threshold: 0.25 });
    io.observe(mount);
  }

  // Tells the stylesheet the graph is live, so it can hide the plain
  // fallback card grid. Same convention the particle system uses.
  document.body.classList.add('has-node-graph');
})();
