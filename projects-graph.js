// Projects node-graph.
//
// A static SVG network diagram: one node per project, edges between
// projects that genuinely share a tool/tag. Deliberately mirrors how
// orchestration tools (Airflow, dbt) draw a pipeline — one thing
// highlighted against the rest — which is authentic to the actual work
// rather than a borrowed aesthetic.
//
// "Static" here means the LAYOUT is fixed (hand-placed coordinates), not
// that it's inert — there's no force simulation to run, which keeps this
// far simpler than a dynamically laid-out graph while looking the same.
//
// No scroll pinning anywhere. The section scrolls normally; the graph
// just fades itself in the first time it comes into view.
//
// Colour discipline (Flight Recorder palette): nodes are neutral
// steel/bone by default. The one accent colour appears ONLY on whatever
// is currently active — the hovered/focused node, its halo, its directly
// connected edges, and text inside an expanded summary. Nothing else in
// this section uses it. Projects are told apart by their icon, not by
// colour.
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
  // DATA
  //
  // `tools` here is the real tag list for each project — the same lists
  // shown on the fallback .job cards in index.html. Edges are computed
  // from these below by actual set intersection, so a line between two
  // nodes always means "these two genuinely share this tool", never a
  // decorative connection.
  // =====================================================================
  var PROJECTS = [
    {
      id: 'JOB-01',
      key: 'mav',
      icon: 'insect',
      x: 130, y: 150,
      title: 'DC micro-motor selection for a Biologically-Inspired Flapping-Wing MAV',
      involved: 'Built a computational model in MATLAB to generate and analyse performance data for flapping-wing Micro Aerial Vehicles. Compared actuator parameters to find the relationships between mass, power, frequency and efficiency, and used those to judge design trade-offs.',
      tools: ['MATLAB', 'Computational Modelling', 'Quantitative Engineering Analysis'],
      status: 'live',
      category: 'Aerospace Analysis'
    },
    {
      id: 'JOB-02',
      key: 'trading',
      icon: 'chart',
      x: 395, y: 100,
      title: 'Quantitative Trading Strategy Backtesting',
      involved: 'Analysed historical financial data with Python and Pandas to build and backtest trading strategies. Engineered technical indicators including moving averages and Bollinger Bands, then evaluated how they would actually have performed.',
      tools: ['Python', 'Pandas', 'NumPy', 'yfinance', 'Matplotlib', 'Quantitative Analysis'],
      status: 'live',
      category: 'Data Analysis'
    },
    {
      id: 'JOB-03',
      key: 'delivery',
      icon: 'scooter',
      x: 255, y: 350,
      title: 'NYC Delivery Service — End-to-End Data Engineering',
      involved: 'Built an end-to-end analytics solution in Databricks and Power BI, moving restaurant delivery data through a Medallion architecture. Looked at sales trends against outside factors like weather, public holidays and major sporting events to explain shifts in demand.',
      tools: ['Databricks', 'Apache Spark', 'Microsoft Azure', 'ETL'],
      status: 'in progress',
      category: 'Data Engineering'
    },
    {
      id: 'JOB-04',
      key: 'f1',
      icon: 'car',
      x: 655, y: 170,
      title: 'Formula 1 Performance Analysis',
      involved: 'Pulled Formula 1 race data from the FastF1 API and worked out tyre degradation across compounds and race stints. Analysed lap-time trends and driver performance, and presented it through an interactive Streamlit dashboard.',
      tools: ['Python', 'Pandas', 'NumPy', 'API', 'Streamlit'],
      status: 'archived',
      category: 'Data Analysis'
    },
    {
      // Content deliberately blank — this project is confirmed as going in
      // the graph, but its write-up hasn't been done yet (see
      // portfolio-project-notes.md entry 10). The node and icon show
      // normally; clicking it gets a "coming soon" state rather than a
      // card full of empty fields.
      id: 'JOB-05',
      key: 'satellite',
      icon: 'satellite',
      x: 665, y: 375,
      title: '',
      involved: '',
      tools: [],
      status: '',
      category: '',
      placeholder: true
    }
  ];

  // ---- icons ----
  // Point clouds, drawn as small dots. These are the SAME coordinates the
  // particle system uses for its project icons, reused here so the two
  // parts of the site are visibly speaking the same language — the icon
  // is literally made of dots in both places. Roughly a 0-90 x, 0-95 y
  // space; scaled to fit each node below.
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
    ],
    // New, drawn in the same style as the four above: a body, two solar
    // panels either side, and an antenna.
    satellite: [
      [45, 12], [45, 26], [37, 38], [53, 38], [37, 56], [53, 56],
      [24, 40], [10, 44], [24, 54], [66, 40], [80, 44], [66, 54]
    ]
  };

  var NODE_RADIUS = 34;
  var ICON_SIZE = 38;

  // =====================================================================
  // EDGES — computed, not authored
  //
  // Every pair of projects is checked for tools they actually have in
  // common. Only pairs with at least one shared tool get a line.
  //
  // Worth saying plainly: this produces a SPARSE graph, and that's the
  // honest result rather than a bug. Comparison is exact — two tags count
  // as shared only if they're the same string. Anything looser would mean
  // inventing a connection the underlying data doesn't actually support.
  // =====================================================================
  function computeEdges(projects) {
    var edges = [];
    for (var i = 0; i < projects.length; i++) {
      for (var j = i + 1; j < projects.length; j++) {
        var a = projects[i], b = projects[j];
        var shared = a.tools.filter(function (t) { return b.tools.indexOf(t) !== -1; });
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

  var svg = svgEl('svg', {
    'class': 'pgraph__svg',
    viewBox: '0 0 820 470',
    preserveAspectRatio: 'xMidYMid meet',
    role: 'group',
    'aria-label': 'Project network. Projects connected by shared tools.'
  });

  // Edges go in first so nodes paint on top of them.
  var edgeLayer = svgEl('g', { 'class': 'pgraph__edges' });
  var nodeLayer = svgEl('g', { 'class': 'pgraph__nodes' });
  svg.appendChild(edgeLayer);
  svg.appendChild(nodeLayer);

  EDGES.forEach(function (e, idx) {
    var length = Math.sqrt(Math.pow(e.b.x - e.a.x, 2) + Math.pow(e.b.y - e.a.y, 2));
    var g = svgEl('g', { 'class': 'pgraph__edge', 'data-a': e.a.key, 'data-b': e.b.key });

    // The visible line. It draws itself in on reveal by starting fully
    // "dashed off" — one dash exactly as long as the line, pushed
    // entirely out of view — and animating that offset back to 0.
    var line = svgEl('line', {
      'class': 'pgraph__edge-line',
      x1: e.a.x, y1: e.a.y, x2: e.b.x, y2: e.b.y
    });
    line.style.strokeDasharray = length;
    line.style.strokeDashoffset = reduceMotion ? 0 : length;
    line.style.transitionDelay = reduceMotion ? '0s' : (0.55 + idx * 0.12) + 's';

    // A second line sitting exactly on top, showing only a short dash.
    // Sliding that dash from one end to the other is what reads as a
    // single pulse of data travelling along the connection.
    var pulse = svgEl('line', {
      'class': 'pgraph__edge-pulse',
      x1: e.a.x, y1: e.a.y, x2: e.b.x, y2: e.b.y
    });
    pulse.style.strokeDasharray = '7 ' + length;
    pulse.style.strokeDashoffset = length;
    // The keyframes need to know how far to slide the dash, and that
    // differs per edge, so it's handed over as a custom property rather
    // than hardcoded in the stylesheet.
    pulse.style.setProperty('--pulse-len', length);

    g.appendChild(line);
    g.appendChild(pulse);

    var title = svgEl('title', {});
    title.textContent = e.a.id + ' and ' + e.b.id + ' share: ' + e.shared.join(', ');
    g.appendChild(title);

    edgeLayer.appendChild(g);
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
    // Everything visual goes inside a SECOND, inner group, and the
    // reveal animation is applied to that rather than to `g` itself.
    //
    // This matters more than it looks: `g` is positioned with an SVG
    // transform ATTRIBUTE (translate(x,y)), and a CSS `transform` on the
    // same element replaces that attribute outright rather than adding to
    // it. Animating `g` directly therefore threw every node's position
    // away and stacked all five in the same spot. Keeping position on the
    // outer group and animation on the inner one means the two can never
    // compete.
    var rise = svgEl('g', { 'class': 'pgraph__rise' });
    rise.style.transitionDelay = reduceMotion ? '0s' : (idx * 0.09) + 's';
    g.appendChild(rise);

    // The halo. This is the glow technique used everywhere else on the
    // site: a second, larger circle at low opacity sitting behind the
    // real one. Deliberately NOT a blur filter — a plain extra circle is
    // far cheaper and gives a cleaner edge.
    rise.appendChild(svgEl('circle', { 'class': 'pgraph__halo', r: NODE_RADIUS + 16 }));
    rise.appendChild(svgEl('circle', { 'class': 'pgraph__disc', r: NODE_RADIUS }));

    // Icon, drawn as dots. Scaled from its own coordinate space into a
    // box centred on the node, so every icon ends up optically similar in
    // size regardless of the raw numbers it was drawn with.
    var pts = ICONS[p.icon] || [];
    if (pts.length) {
      var xs = pts.map(function (q) { return q[0]; });
      var ys = pts.map(function (q) { return q[1]; });
      var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
      var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
      var scale = ICON_SIZE / Math.max(maxX - minX, maxY - minY, 1);
      var iconG = svgEl('g', { 'class': 'pgraph__icon' });
      pts.forEach(function (q) {
        iconG.appendChild(svgEl('circle', {
          cx: (q[0] - (minX + maxX) / 2) * scale,
          cy: (q[1] - (minY + maxY) / 2) * scale,
          r: 2.1
        }));
      });
      rise.appendChild(iconG);
    }

    var label = svgEl('text', { 'class': 'pgraph__label', y: NODE_RADIUS + 22 });
    label.textContent = p.id;
    rise.appendChild(label);

    nodeLayer.appendChild(g);
  });

  mount.appendChild(svg);

  // =====================================================================
  // HIGHLIGHT (hover / keyboard focus)
  // =====================================================================
  var activeKey = null;

  function setHighlight(key) {
    activeKey = key;
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
  // INLINE SUMMARY (click to expand)
  // =====================================================================
  var openKey = null;

  function fieldRow(label, valueNode) {
    var row = document.createElement('div');
    row.className = 'psummary__row';
    var dt = document.createElement('span');
    dt.className = 'psummary__label';
    dt.textContent = label;
    row.appendChild(dt);
    row.appendChild(valueNode);
    return row;
  }

  function textNode(cls, text) {
    var el = document.createElement('p');
    el.className = cls;
    el.textContent = text;
    return el;
  }

  function buildSummary(p) {
    panel.innerHTML = '';

    var head = document.createElement('div');
    head.className = 'psummary__head';
    var id = document.createElement('span');
    id.className = 'psummary__id';
    id.textContent = p.id;
    head.appendChild(id);
    if (p.category) {
      var cat = document.createElement('span');
      cat.className = 'psummary__category';
      cat.textContent = p.category;
      head.appendChild(cat);
    }
    panel.appendChild(head);

    if (p.placeholder) {
      panel.appendChild(textNode('psummary__coming', 'Details coming soon.'));
      panel.appendChild(textNode('psummary__coming-note',
        'This project is confirmed but the write-up is still to be done.'));
      return;
    }

    var h = document.createElement('h3');
    h.className = 'psummary__title';
    h.textContent = p.title;
    panel.appendChild(h);

    panel.appendChild(fieldRow('What involved', textNode('psummary__text', p.involved)));

    var tools = document.createElement('ul');
    tools.className = 'psummary__tools';
    p.tools.forEach(function (t) {
      var li = document.createElement('li');
      li.textContent = t;
      tools.appendChild(li);
    });
    panel.appendChild(fieldRow('Tools', tools));

    panel.appendChild(fieldRow('Status', textNode('psummary__status', p.status)));

    // Detail pages don't exist yet — "#" is the same placeholder
    // convention used for the repo/write-up links elsewhere on the site.
    var link = document.createElement('a');
    link.className = 'btn btn--primary psummary__cta';
    link.href = '#';
    link.textContent = 'View full project ↗';
    panel.appendChild(link);
  }

  function toggleSummary(key) {
    var p = PROJECTS.filter(function (q) { return q.key === key; })[0];
    if (!p) return;

    if (openKey === key) {
      // Clicking the already-open node closes it again.
      openKey = null;
      panel.classList.remove('is-open');
      panel.setAttribute('aria-hidden', 'true');
    } else {
      openKey = key;
      buildSummary(p);
      panel.classList.add('is-open');
      panel.setAttribute('aria-hidden', 'false');
    }

    nodeLayer.querySelectorAll('.pgraph__node').forEach(function (n) {
      var isOpen = n.getAttribute('data-key') === openKey;
      n.classList.toggle('is-open', isOpen);
      n.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  // =====================================================================
  // REVEAL ON SCROLL INTO VIEW
  //
  // The graph starts hidden and reveals itself the first time it actually
  // comes into view — not on page load, so it isn't already over and done
  // with by the time you scroll down to it. Nodes stagger in (their
  // per-node transition-delay is set above), then the edges draw
  // themselves along.
  //
  // With reduced motion turned on, the whole thing is just switched to
  // its finished state immediately: no stagger, no line-drawing, no
  // pulses (firePulse is skipped above too).
  // =====================================================================
  function reveal() {
    mount.classList.add('is-revealed');
  }

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
  // fallback card grid. Same convention the particle system already uses.
  document.body.classList.add('has-node-graph');
})();
