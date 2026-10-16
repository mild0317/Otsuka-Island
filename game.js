(() => {
  'use strict';
  const canvas = document.querySelector('#world');
  const ctx = canvas.getContext('2d');
  const $ = (selector) => document.querySelector(selector);
  const W = 1143, H = 2048;
  const WALK_SPEED = 200;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // This is an animated game by explicit request. OS preferences must not silently
  // disable its core behavior; the visible control lets the visitor pause it.
  let motionEnabled = true, animationTime = 0;
  const island = new Image(), islandMask = new Image(), sprites = new Image(), cloud = new Image(), edaArt = new Image(), birdSheet = new Image(), validationArt = new Image(), designArt = new Image();
  let life;
  const islandView = { x: 562.5, y: 1004.5, width: 1085, height: 1879 };
  const camera = { x: islandView.x, y: islandView.y, zoom: 1, scale: 1, follow: false };
  const actor = { x: 625, y: 1540, route: [], phase: 0, gait: 0, facing: 0, heading: 0, wave: 0, nextWave: 4, idle: 0, destination: '', turn: 0 };
  let width = 0, height = 0, baseScale = 1, ready = false, clock = 0, lastTime = 0;
  let toastUntil = 0, marker = null, pendingGreeting = false, lastStatus = '';
  const pointers = new Map();
  let gesture = null;
  let selectedBuilding = null, hoverBuilding = null, selectionTime = 0;
  let pendingRoom = null, entry = null;
  const roomExperience = new IslandRooms({ onClose(key) {
    entry = null; pendingRoom = null; actor.idle = 0; actor.nextWave = rand(4, 8);
    status(`已走出${places[key].name}`); $('#wave').disabled = false;
    $('#ui-toggle').focus({ preventScroll: true });
  } });
  let previewHour = null, timeStamp = -1;
  const localTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  let lighting = { hour: 12, minute: 0, second: 0, shadowX: 0, shadowY: 20, length: 1, opacity: .14 };
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const P = (x, y) => ({ x, y });

  // Ground anchors follow the stair treads and bridge decks in the original illustration.
  const nodes = [
    P(450, 635), P(423, 662), P(397, 681), P(351, 716), P(324, 757),
    P(323, 799), P(340, 839), P(371, 870), P(412, 895), P(460, 918),
    P(505, 942), P(540, 978), P(563, 1011), P(584, 1047),
    P(663, 1060), P(751, 1070), P(845, 1050), P(899, 1031),
    P(548, 1082), P(513, 1124), P(479, 1164), P(439, 1201),
    P(385, 1236), P(337, 1224), P(302, 1218), P(400, 1284),
    P(421, 1332), P(452, 1381), P(484, 1430), P(516, 1475),
    P(554, 1517), P(625, 1540), P(697, 1536), P(748, 1490)
  ];
  const links = [
    ...Array.from({ length: 13 }, (_, i) => [i, i + 1]),
    [13, 14], [14, 15], [15, 16], [16, 17], [13, 18], [18, 19],
    [19, 20], [20, 21], [21, 22], [22, 23], [23, 24], [22, 25],
    [25, 26], [26, 27], [27, 28], [28, 29], [29, 30], [30, 31], [31, 32], [32, 33]
  ];
  const areas = [
    { name: '研究室前庭', anchor: 2, poly: [[373, 671], [393, 661], [421, 679], [448, 691], [436, 706], [403, 694], [383, 684]] },
    { name: '工坊前石板廣場', anchor: 15, poly: [[657, 1046], [739, 1058], [822, 1041], [847, 1063], [744, 1091], [663, 1071]] },
    { name: '驗証工作室前庭', anchor: 22, poly: [[304, 1200], [348, 1199], [385, 1204], [439, 1226], [449, 1260], [397, 1292], [342, 1272], [306, 1245], [284, 1225]] },
    { name: '模擬實驗室前廣場', anchor: 31, poly: [[552, 1514], [598, 1493], [644, 1497], [687, 1487], [723, 1499], [745, 1526], [718, 1549], [641, 1572], [592, 1553]] }
  ];
  const places = {
    clock: { name: '設計工作室', node: 0, door: P(487, 591), hit: [[546, 78], [550, 111], [578, 126], [607, 177], [621, 192], [643, 210], [649, 232], [647, 348], [662, 368], [696, 421], [698, 583], [681, 605], [558, 654], [415, 605], [396, 472], [393, 420], [433, 367], [445, 354], [441, 225], [459, 214], [451, 199], [461, 173], [478, 194], [514, 135], [535, 119], [542, 111]] },
    workshop: { name: '製作工坊', node: 15, door: P(797, 1000), hit: [[593, 804], [831, 645], [1008, 760], [1031, 795], [1027, 827], [1016, 824], [1027, 981], [978, 1018], [843, 1076], [616, 965], [619, 899], [604, 906], [601, 824]] },
    library: { name: '驗証工作室', node: 24, door: P(293, 1159), hit: [[106, 985], [170, 858], [434, 985], [431, 1015], [417, 1011], [421, 1150], [390, 1180], [277, 1223], [115, 1150], [114, 1020], [103, 1020]] },
    lab: { name: '模擬實驗室', node: 33, door: P(777, 1432), hit: [[691, 1279], [707, 1230], [739, 1178], [802, 1147], [851, 1135], [856, 1114], [865, 1135], [917, 1154], [977, 1191], [1014, 1249], [1035, 1302], [1027, 1457], [974, 1490], [891, 1503], [788, 1490], [725, 1470], [696, 1438]] }
  };
  const adjacency = nodes.map(() => []);
  links.forEach(([a, b]) => {
    const cost = distance(nodes[a], nodes[b]);
    adjacency[a].push([b, cost]); adjacency[b].push([a, cost]);
  });
  function inside(p, poly) {
    let result = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > p.y) !== (yj > p.y) && p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi) result = !result;
    }
    return result;
  }
  function project(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return P(a.x + t * dx, a.y + t * dy);
  }
  function ground(p, snap = 22) {
    const area = areas.find(a => inside(p, a.poly));
    if (area) return { point: P(p.x, p.y), anchors: [area.anchor], area, name: area.name };
    let best = null;
    for (const [a, b] of links) {
      const point = project(p, nodes[a], nodes[b]);
      const d = distance(p, point);
      if (!best || d < best.d) best = { point, anchors: [a, b], d, name: '島上的石階' };
    }
    return best.d <= snap ? best : null;
  }
  function resolveTarget(p) {
    const floor = ground(p);
    if (floor) return floor;
    for (const [key, place] of Object.entries(places)) {
      if (inside(p, place.hit)) return { point: { ...nodes[place.node] }, anchors: [place.node], name: place.name, key };
    }
    return null;
  }
  function findPath(start, target) {
    const origin = ground(start, Infinity);
    if (origin.area && origin.area === target.area) return [target.point];
    // A point already on a staircase can continue along that same edge without backtracking.
    if (!origin.area && !target.area && origin.anchors.join() === target.anchors.join()) return [target.point];
    const costs = nodes.map(() => Infinity), prev = nodes.map(() => -1), visited = new Set();
    origin.anchors.forEach(i => { costs[i] = distance(start, nodes[i]); });
    for (let step = 0; step < nodes.length; step++) {
      let current = -1;
      for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (current < 0 || costs[i] < costs[current])) current = i;
      if (current < 0 || !Number.isFinite(costs[current])) break;
      visited.add(current);
      for (const [next, cost] of adjacency[current]) if (costs[current] + cost < costs[next]) { costs[next] = costs[current] + cost; prev[next] = current; }
    }
    const end = target.anchors.reduce((best, i) => costs[i] + distance(nodes[i], target.point) < costs[best] + distance(nodes[best], target.point) ? i : best);
    const route = [];
    for (let i = end; i !== -1; i = prev[i]) route.unshift({ ...nodes[i] });
    route.push({ ...target.point });
    return route.filter((p, i) => distance(p, i ? route[i - 1] : start) > 1);
  }
  function toast(message) {
    $('#toast').textContent = message; $('#toast').classList.add('show'); toastUntil = clock + 3.5;
  }
  function status(message, moving = false) {
    if (message === lastStatus) return;
    lastStatus = message; $('#status').textContent = message;
    $('#status-dot').style.background = moving ? '#bd704d' : '#6d8a69';
  }
  function goTo(target) {
    if (!ready || roomExperience.key) return;
    entry = null; pendingRoom = target.key || null;
    const nextSelection = target.key || null;
    if (selectedBuilding !== nextSelection) selectionTime = clock;
    selectedBuilding = nextSelection;
    actor.route = []; actor.destination = target.name;
    document.querySelectorAll('.place').forEach(b => b.classList.toggle('active', b.dataset.place === target.key));
    if (distance(actor, target.point) < 3) { if (target.key) beginEntry(target.key); else greet(); return; }
    actor.route = findPath(actor, target);
    actor.wave = 0; actor.idle = 0; pendingGreeting = false;
    marker = { ...target.point, time: clock };
    status(`正在走向${target.name}`, true);
    $('#wave').disabled = false;
  }
  function visit(key) {
    const place = places[key];
    goTo({ point: { ...nodes[place.node] }, anchors: [place.node], area: areas.find(a => a.anchor === place.node), name: place.name, key });
    setControls(false, true);
  }
  function greet() {
    if (!ready || actor.wave || entry || roomExperience.key) return;
    if (actor.route.length) { pendingGreeting = true; toast('等博士走到目的地，再和你打招呼！'); return; }
    if (!motionEnabled) setMotion(true);
    actor.wave = 3.2; actor.idle = 0; actor.nextWave = rand(8, 14);
    status('嗨！很高興和你一起散步'); $('#wave').disabled = true;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width; height = rect.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    baseScale = Math.min((height - 32) / islandView.height, (width - (width <= 760 ? 20 : 40)) / islandView.width);
    camera.scale = baseScale * camera.zoom;
    $('#zoom-hint').textContent = width <= 760 ? '雙指縮放' : '滾輪縮放';
  }
  const screenCenter = () => P(width / 2, height / 2);
  function worldPoint(x, y) { const c = screenCenter(); return P((x - c.x) / camera.scale + camera.x, (y - c.y) / camera.scale + camera.y); }
  function zoomBy(factor, at = screenCenter()) {
    const before = worldPoint(at.x, at.y);
    camera.zoom = clamp(camera.zoom * factor, .8, 4);
    camera.scale = baseScale * camera.zoom;
    const after = worldPoint(at.x, at.y);
    camera.x += before.x - after.x; camera.y += before.y - after.y;
    $('#zoom-value').textContent = `${Math.round(camera.zoom * 100)}%`;
    $('.experience').classList.toggle('exploring', camera.zoom > 1.18);
  }
  function fit() { camera.x = islandView.x; camera.y = islandView.y; camera.zoom = 1; camera.scale = baseScale; setFollow(false); $('#zoom-value').textContent = '100%'; $('.experience').classList.remove('exploring'); }
  function setControls(open, restoreFocus = false) {
    $('#island-controls').hidden = !open;
    $('#ui-toggle').setAttribute('aria-expanded', String(open));
    $('#ui-toggle').setAttribute('aria-label', open ? '收起工具與地點' : '開啟工具與地點');
    if (open) $('#controls-close').focus({ preventScroll: true });
    else if (restoreFocus) $('#ui-toggle').focus({ preventScroll: true });
  }
  $('#ui-toggle').addEventListener('click', () => setControls($('#island-controls').hidden, true));
  $('#controls-close').addEventListener('click', () => setControls(false, true));
  document.addEventListener('pointerdown', event => {
    if (!$('#island-controls').hidden && !$('#island-controls').contains(event.target) && !$('#ui-toggle').contains(event.target)) setControls(false);
  });
  function setFollow(value) { camera.follow = value; $('#follow').setAttribute('aria-pressed', String(value)); }
  function localPoint(event) { const r = canvas.getBoundingClientRect(); return P(event.clientX - r.left, event.clientY - r.top); }
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    hoverBuilding = null;
    canvas.setPointerCapture(event.pointerId); const p = localPoint(event); pointers.set(event.pointerId, p);
    if (pointers.size === 1) gesture = { start: p, last: p, moved: false, pinched: false };
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; gesture.pinched = true; gesture.pinchDistance = distance(a, b); }
  });
  canvas.addEventListener('pointermove', event => {
    const p = localPoint(event);
    if (!pointers.has(event.pointerId)) {
      if (ready) {
        const target = resolveTarget(worldPoint(p.x, p.y));
        hoverBuilding = target?.key || null;
        canvas.style.cursor = hoverBuilding || distance(worldPoint(p.x, p.y), actor) < 75 ? 'pointer' : target ? 'crosshair' : 'grab';
      }
      return;
    }
    pointers.set(event.pointerId, p);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()], d = distance(a, b);
      zoomBy(d / (gesture.pinchDistance || d), P((a.x + b.x) / 2, (a.y + b.y) / 2));
      gesture.pinchDistance = d; gesture.moved = true; setFollow(false); return;
    }
    if (gesture.pinched) return;
    if (distance(p, gesture.start) > 5) gesture.moved = true;
    if (gesture.moved) {
      camera.x -= (p.x - gesture.last.x) / camera.scale;
      camera.y -= (p.y - gesture.last.y) / camera.scale;
      camera.x = clamp(camera.x, -W * .3, W * 1.3); camera.y = clamp(camera.y, 0, H);
      setFollow(false); canvas.classList.add('dragging');
    }
    gesture.last = p;
  });
  function endPointer(event) {
    if (!pointers.has(event.pointerId)) return;
    const p = localPoint(event), wasClick = gesture && !gesture.moved && !gesture.pinched && event.type === 'pointerup';
    pointers.delete(event.pointerId);
    if (!pointers.size) {
      if (wasClick && ready) {
        const point = worldPoint(p.x, p.y);
        if (Math.abs(point.x - actor.x) < 38 && point.y < actor.y - 20 && point.y > actor.y - 155) greet();
        else { const target = resolveTarget(point); if (target) goTo(target); else toast('博士只走石板路與廣場。請點石階、廣場或四棟建築。'); }
      }
      gesture = null; canvas.classList.remove('dragging');
    }
  }
  canvas.addEventListener('pointerleave', () => { hoverBuilding = null; });
  canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', event => { event.preventDefault(); zoomBy(Math.exp(-event.deltaY * .0014), localPoint(event)); }, { passive: false });
  $('#zoom-in').addEventListener('click', () => zoomBy(1.25));
  $('#zoom-out').addEventListener('click', () => zoomBy(.8));
  $('#fit').addEventListener('click', () => { fit(); setControls(false); });
  $('#follow').addEventListener('click', () => { setFollow(!camera.follow); if (camera.follow && camera.zoom < 1.7) zoomBy(1.8 / camera.zoom); setControls(false, true); });
  $('#wave').addEventListener('click', () => { greet(); setControls(false, true); });
  function setMotion(enabled) {
    motionEnabled = enabled;
    roomExperience.setMotion(enabled);
    $('#motion-toggle').setAttribute('aria-pressed', String(enabled));
    $('#motion-toggle').textContent = enabled ? '動態 開' : '動態 暫停';
  }
  $('#motion-toggle').addEventListener('click', () => setMotion(!motionEnabled));
  $('#light-time').addEventListener('input', event => { previewHour = Number(event.target.value); timeStamp = -1; updateLighting(); });
  $('#live-time').addEventListener('click', () => { previewHour = null; timeStamp = -1; updateLighting(); });
  document.querySelectorAll('[data-place]').forEach(button => button.addEventListener('click', () => visit(button.dataset.place)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('#island-controls').hidden) { setControls(false, true); return; }
    if (roomExperience.key) return;
    if (event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (event.key === '+' || event.key === '=') zoomBy(1.25);
    if (event.key === '-') zoomBy(.8);
    if (event.key.toLowerCase() === 'r') fit();
    if (event.key.toLowerCase() === 'g') greet();
    if (event.target === canvas && event.key.startsWith('Arrow')) {
      event.preventDefault();
      const delta = { ArrowLeft: [-50, 0], ArrowRight: [50, 0], ArrowUp: [0, -50], ArrowDown: [0, 50] }[event.key];
      const target = resolveTarget(P(actor.x + delta[0], actor.y + delta[1])); if (target) goTo(target);
    }
  });
  window.addEventListener('resize', resize);

  // Individual polygons form a small articulated puppet. The original sprite is never
  // translated as one rigid card: feet, arms, coat tails, torso and head each have joints.
  const FRONT = {
    cx: 430, foot: 672,
    head: [[218, 0], [652, 0], [652, 386], [538, 415], [326, 416], [218, 377]],
    body: [[225, 395], [640, 395], [640, 603], [225, 603]],
    arms: [
      { pivot: [326, 420], poly: [[329, 399], [298, 409], [267, 439], [241, 467], [228, 503], [230, 531], [252, 552], [276, 550], [294, 530], [313, 484], [328, 454]] },
      { pivot: [531, 420], poly: [[528, 397], [562, 410], [592, 437], [613, 465], [629, 502], [628, 530], [606, 552], [582, 552], [563, 534], [545, 485], [531, 452]] }
    ],
    legs: [
      { pivot: [372, 589], poly: [[329, 590], [418, 590], [418, 641], [411, 674], [324, 674], [324, 640]] },
      { pivot: [487, 589], poly: [[442, 590], [528, 590], [536, 674], [445, 674], [441, 641]] }
    ],
    tails: [
      { pivot: [339, 523], poly: [[306, 520], [375, 520], [369, 596], [297, 596]] },
      { pivot: [515, 523], poly: [[481, 520], [547, 516], [563, 596], [488, 600]] }
    ]
  };
  const BACK = {
    cx: 1624, foot: 672,
    head: [[1419, 0], [1844, 0], [1844, 385], [1724, 405], [1516, 405], [1419, 377]],
    body: [[1425, 386], [1820, 386], [1820, 599], [1425, 599]],
    arms: [
      { pivot: [1516, 416], poly: [[1521, 390], [1481, 412], [1452, 446], [1436, 477], [1428, 510], [1435, 541], [1461, 556], [1486, 545], [1505, 495], [1518, 452]] },
      { pivot: [1728, 416], poly: [[1725, 391], [1766, 413], [1794, 449], [1810, 479], [1818, 510], [1811, 542], [1786, 556], [1761, 545], [1742, 497], [1730, 452]] }
    ],
    legs: [
      { pivot: [1562, 590], poly: [[1516, 589], [1607, 589], [1607, 674], [1516, 674]] },
      { pivot: [1680, 590], poly: [[1635, 589], [1728, 589], [1728, 674], [1635, 674]] }
    ],
    tails: [
      { pivot: [1555, 526], poly: [[1505, 523], [1620, 523], [1611, 597], [1493, 597]] },
      { pivot: [1682, 526], poly: [[1621, 523], [1735, 523], [1751, 597], [1632, 597]] }
    ]
  };
  const SIDE = {
    cx: 1034, foot: 672,
    head: [[824, 0], [1210, 0], [1210, 386], [1107, 410], [956, 403], [824, 364]],
    body: [[919, 388], [1145, 388], [1145, 599], [919, 599]],
    arms: [{ pivot: [1000, 419], poly: [[982, 403], [1016, 410], [1040, 444], [1048, 479], [1044, 522], [1021, 548], [996, 548], [974, 530], [969, 501], [974, 461]] }],
    legs: [
      { pivot: [1066, 587], poly: [[1025, 589], [1114, 589], [1122, 671], [1025, 674]] },
      { pivot: [1022, 588], poly: [[973, 589], [1060, 589], [1085, 674], [968, 674]] }
    ],
    tails: [{ pivot: [1004, 526], poly: [[935, 523], [1102, 523], [1094, 597], [919, 590]] }]
  };
  function polygon(points) { ctx.moveTo(...points[0]); for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]); ctx.closePath(); }
  function piece(poly, pivot, rotation = 0, dx = 0, dy = 0, holes = []) {
    ctx.save();
    ctx.translate(pivot[0] + dx, pivot[1] + dy); ctx.rotate(rotation); ctx.translate(-pivot[0], -pivot[1]);
    ctx.beginPath(); polygon(poly); holes.forEach(polygon); ctx.clip('evenodd');
    ctx.drawImage(sprites, 0, 0, 2048, 683); ctx.restore();
  }
  let spriteTexture, activeClothing = null;
  const smooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
  function distanceToOutline(p, outline) {
    let nearest = Infinity;
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i], b = outline[(i + 1) % outline.length];
      nearest = Math.min(nearest, distance(p, project(p, P(...a), P(...b))));
    }
    return nearest;
  }
  function createClothingMesh(view) {
    const left = view.body[0][0], top = view.body[0][1] - 8;
    const right = view.body[1][0], bottom = view.body[2][1];
    const layer = document.createElement('canvas');
    const origin = P(left - 160, top - 180);
    layer.width = right - left + 320; layer.height = bottom - top + 230;
    const columns = Math.ceil((right - left) / 13), rows = Math.ceil((bottom - top) / 13);
    const vertices = [], triangles = [];
    for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
      const p = P(left + (right - left) * column / columns, top + (bottom - top) * row / rows);
      const weights = view.arms.map(arm => {
        const edge = inside(p, arm.poly) ? 1 : 1 - smooth(distanceToOutline(p, arm.poly) / 16);
        return edge * smooth((p.y - arm.pivot[1] + 8) / 46);
      });
      vertices.push({ u: p.x, v: p.y, x: p.x, y: p.y, weights });
    }
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const a = row * (columns + 1) + column, b = a + 1, c = a + columns + 1, d = c + 1;
      triangles.push([a, b, d], [a, d, c]);
    }
    return { canvas: layer, context: layer.getContext('2d'), origin, vertices, triangles, stamp: -1, direction: view === SIDE ? 'side' : view === BACK ? 'back' : 'front' };
  }
  function texturedTriangle(g, a, b, c, origin) {
    const du1 = b.u - a.u, dv1 = b.v - a.v, du2 = c.u - a.u, dv2 = c.v - a.v;
    const determinant = du1 * dv2 - du2 * dv1;
    const ax = ((b.x - a.x) * dv2 - (c.x - a.x) * dv1) / determinant;
    const cx = ((c.x - a.x) * du1 - (b.x - a.x) * du2) / determinant;
    const by = ((b.y - a.y) * dv2 - (c.y - a.y) * dv1) / determinant;
    const dy = ((c.y - a.y) * du1 - (b.y - a.y) * du2) / determinant;
    const center = P((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3);
    g.save(); g.beginPath();
    [a, b, c].forEach((p, i) => {
      const radius = Math.hypot(p.x - center.x, p.y - center.y) || 1;
      const x = p.x - origin.x + (p.x - center.x) / radius * .75;
      const y = p.y - origin.y + (p.y - center.y) / radius * .75;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    });
    g.closePath(); g.clip();
    g.transform(ax, by, cx, dy, a.x - ax * a.u - cx * a.v - origin.x, a.y - by * a.u - dy * a.v - origin.y);
    const u = Math.max(0, Math.min(a.u, b.u, c.u) - 1), v = Math.max(0, Math.min(a.v, b.v, c.v) - 1);
    const w = Math.max(a.u, b.u, c.u) - u + 1, h = Math.max(a.v, b.v, c.v) - v + 1;
    g.drawImage(spriteTexture, u, v, w, h, u, v, w, h); g.restore();
  }
  function drawClothing(view, angles, gait) {
    const mesh = view.mesh || (view.mesh = createClothingMesh(view));
    const stamp = Math.floor(clock * 30);
    if (mesh.stamp !== stamp) {
      mesh.stamp = stamp;
      for (const vertex of mesh.vertices) {
        const hem = smooth((vertex.v - 465) / 138);
        const panel = view === FRONT ? smooth((Math.abs(vertex.u - view.cx) - 36) / 65) : 1;
        const wind = Math.sin(animationTime * 2.2 + (vertex.u - view.cx) * .013) * (8 + gait * 7);
        vertex.x = vertex.u + wind * hem * panel;
        vertex.y = vertex.v + Math.sin(animationTime * 2.8 + vertex.u * .01) * (2.5 + gait * 2) * hem * panel;
        view.arms.forEach((arm, i) => {
          const weight = vertex.weights[i]; if (!weight) return;
          const [px, py] = arm.pivot, angle = angles[i], cosine = Math.cos(angle), sine = Math.sin(angle);
          const x = vertex.u - px, y = vertex.v - py;
          vertex.x += ((x * cosine - y * sine + px) - vertex.u) * weight;
          vertex.y += ((x * sine + y * cosine + py) - vertex.v) * weight;
        });
      }
      mesh.context.clearRect(0, 0, mesh.canvas.width, mesh.canvas.height);
      for (const indices of mesh.triangles) texturedTriangle(mesh.context, ...indices.map(i => mesh.vertices[i]), mesh.origin);
    }
    activeClothing = mesh;
    ctx.drawImage(mesh.canvas, mesh.origin.x, mesh.origin.y);
  }
  function drawDoctor() {
    if (roomExperience.key) return;
    const moving = actor.route.length > 0 || !!entry;
    const stride = Math.sin(actor.phase), gait = actor.gait;
    const perspective = .84 + (actor.y / H) * .22;
    const size = 155 * perspective / 660;
    const waving = actor.wave > 0;
    const waveElapsed = 3.2 - actor.wave;
    const waveEnvelope = waving ? Math.min(1, waveElapsed / .45, actor.wave / .55) : 0;
    let view = FRONT, mirror = 1;
    if (!waving && moving) {
      const dx = Math.cos(actor.facing), dy = Math.sin(actor.facing);
      if (Math.abs(dx) > .52) { view = SIDE; mirror = dx < 0 ? -1 : 1; }
      else if (dy < -.2) view = BACK;
    }
    // The brief asks for a visible turn: blend the width during the initial change of heading.
    const turnWidth = 1 - Math.sin(actor.turn * Math.PI) * .16;
    const into = entry ? smooth(entry.progress) : 0;
    const door = entry ? places[entry.key].door : actor;
    ctx.save();
    ctx.globalAlpha = 1 - smooth((into - .55) / .45);
    ctx.translate(actor.x + (door.x - actor.x) * into, actor.y + (door.y - actor.y) * into);
    ctx.scale(1 - into * .22, 1 - into * .22);
    ctx.fillStyle = '#263b3438'; ctx.beginPath(); ctx.ellipse(0, -1, 30 * perspective, 9 * perspective, -.12, 0, Math.PI * 2); ctx.fill();
    ctx.scale(size * mirror * turnWidth, size);
    ctx.translate(-view.cx, -view.foot);
    // Alternating feet lift while the body follows a two-step rhythm, with no idle drift.
    view.legs.forEach((leg, i) => {
      const phase = actor.phase + i * Math.PI;
      piece(leg.poly, leg.pivot, Math.sin(phase) * .23 * gait,
        view === SIDE ? Math.sin(phase) * 13 * gait : 0, -Math.max(0, Math.cos(phase)) * 22 * gait);
    });
    const breath = (1 + Math.sin(animationTime * Math.PI * 2 / 3.6)) / 2;
    const bob = Math.cos(actor.phase * 2) * 4 * gait;
    ctx.translate(view.cx, 592); ctx.rotate(stride * .018 * gait + waveEnvelope * .12);
    ctx.scale(1 + breath * .018, 1 + breath * .028); ctx.translate(-view.cx, -592 + bob - breath * 4);
    const armAngles = view.arms.map((arm, i) => {
      const swing = view === BACK ? .085 : .2;
      let rotation = Math.sin(actor.phase + (i ? Math.PI : 0)) * swing * gait + Math.sin(animationTime * 1.75 + i * 1.2) * .025;
      if (i === 0 && waving) rotation = waveEnvelope * (1.42 + Math.sin(waveElapsed * 10) * .22);
      return rotation;
    });
    // Sleeves, torso and hem share vertices in one continuous textured surface.
    // There are no punched-out arm/coat polygons that can expose the background.
    drawClothing(view, armAngles, gait);
    piece(view.head, [view.cx, 401], Math.sin(animationTime * 1.75 + .5) * .009 - waveEnvelope * .065, 0, -breath * 4);
    ctx.restore();
    if (waving) {
      ctx.save(); ctx.font = '500 18px "Microsoft JhengHei", sans-serif';
      ctx.textAlign = 'center'; ctx.fillStyle = '#fffdf5';
      ctx.beginPath(); ctx.roundRect(actor.x - 56, actor.y - 197, 112, 34, 17); ctx.fill();
      ctx.fillStyle = '#44634b'; ctx.fillText('嗨，你好呀！', actor.x, actor.y - 174); ctx.restore();
    }
  }
  function beginEntry(key) {
    pendingRoom = null; pendingGreeting = false; actor.route = []; actor.wave = 0; actor.idle = 0;
    const door = places[key].door;
    actor.facing = actor.heading = Math.atan2(door.y-actor.y, door.x-actor.x);
    entry = { key, progress: 0 }; marker = null;
    status(`正在走進${places[key].name}`, true); $('#wave').disabled = true;
  }
  function update(dt) {
    updateLighting();
    life.update(animationTime, actor);
    if (roomExperience.key) return;
    if (entry) {
      entry.progress = Math.min(1, entry.progress + dt / 1.05);
      actor.phase += dt * 9; actor.gait = 1;
      if (entry.progress === 1) {
        const key = entry.key; entry = null; actor.gait = 0;
        roomExperience.open(key); status(`正在${places[key].name}內探索`);
        $('#toast').classList.remove('show');
      }
      return;
    }
    const moving = actor.route.length > 0;
    actor.gait += ((moving ? 1 : 0) - actor.gait) * Math.min(1, dt * 10);
    actor.turn = Math.max(0, actor.turn - dt * 3.5);
    if (moving) {
      let budget = dt * WALK_SPEED;
      while (budget > 0 && actor.route.length) {
        const goal = actor.route[0], d = distance(actor, goal);
        if (d < .1) { actor.route.shift(); continue; }
        const heading = Math.atan2(goal.y - actor.y, goal.x - actor.x);
        const delta = Math.atan2(Math.sin(heading - actor.heading), Math.cos(heading - actor.heading));
        if (Math.abs(delta) > .65) actor.turn = 1;
        actor.heading = heading;
        actor.facing += Math.atan2(Math.sin(heading - actor.facing), Math.cos(heading - actor.facing)) * Math.min(1, dt * 12);
        const step = Math.min(budget, d);
        const next = P(actor.x + (goal.x - actor.x) * step / d, actor.y + (goal.y - actor.y) * step / d);
        if (!ground(next, 22)) {
          actor.route = []; pendingRoom = null; marker = null; status('在安全的石板路上休息'); toast('這裡是路的邊緣，換一個安全的目的地吧。'); break;
        }
        actor.x = next.x; actor.y = next.y;
        actor.phase += step * .095; budget -= step;
        if (step >= d) { actor.x = goal.x; actor.y = goal.y; actor.route.shift(); }
      }
      if (!actor.route.length) {
        marker = null; actor.idle = 0; actor.nextWave = rand(3.5, 6);
        if (pendingRoom) { beginEntry(pendingRoom); return; }
        status(`已抵達${actor.destination}`); toast(`到了！在${actor.destination}休息一下。`);
        if (pendingGreeting) { pendingGreeting = false; greet(); }
      }
    } else {
      if (motionEnabled) actor.idle += dt;
      if (actor.wave > 0) {
        actor.wave = Math.max(0, actor.wave - (motionEnabled ? dt : 0));
        if (!actor.wave) { $('#wave').disabled = false; status('正在享受島上的微風'); }
      } else if (actor.idle > actor.nextWave && motionEnabled) greet();
      else if (actor.idle > 5 && !actor.wave) status('正在享受島上的微風');
    }
    if (camera.follow) {
      const easing = 1 - Math.exp(-dt * 3);
      camera.x += (actor.x - camera.x) * easing; camera.y += (actor.y - 120 - camera.y) * easing;
    }
    if (toastUntil && clock > toastUntil) { $('#toast').classList.remove('show'); toastUntil = 0; }
  }
  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f0ece5'; ctx.fillRect(0, 0, width, height);
    const center = screenCenter();
    ctx.save(); ctx.translate(center.x, center.y); ctx.scale(camera.scale, camera.scale); ctx.translate(-camera.x, -camera.y);
    drawClouds();
    drawLivingIsland();
    life.drawWater(animationTime);
    life.drawInteriors(animationTime);
    drawTimeShadows();
    drawClocks();
    drawBuildingMist();
    if (marker) {
      const pulse = Math.sin(animationTime * 4) * 3;
      ctx.save(); ctx.strokeStyle = '#bd704d'; ctx.fillStyle = '#bd704d20'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(marker.x, marker.y, 18 + pulse, 8 + pulse * .3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(marker.x, marker.y - 11, 3.5, 0, Math.PI * 2); ctx.fillStyle = '#bd704d'; ctx.fill(); ctx.restore();
    }
    life.drawBirds(animationTime);
    drawDoctor(); ctx.restore();
  }
  function drawLivingIsland() {
    life.drawBase(animationTime);
  }
  function updateLighting() {
    const now = Date.now();
    if (now - timeStamp < 200) return;
    timeStamp = now;
    let h, m, s;
    if (previewHour === null) {
      const parts = Object.fromEntries(localTime.formatToParts(new Date(now)).map(p => [p.type, p.value]));
      h = Number(parts.hour); m = Number(parts.minute); s = Number(parts.second) + (now % 1000) / 1000;
    } else { h = Math.floor(previewHour); m = Math.floor((previewHour - h) * 60); s = 0; }
    const hour = h + m / 60 + s / 3600;
    const sunAngle = (hour - 6) / 12 * Math.PI;
    const elevation = Math.max(0, Math.sin(sunAngle));
    const length = 1 + (1 - elevation) * 2.5;
    lighting = { hour: h, minute: m, second: s, shadowX: -Math.cos(sunAngle) * 40 * length, shadowY: 12 + elevation * 15, length, opacity: .045 + elevation * .14 };
    $('#island-time').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    $('#time-mode').textContent = previewHour === null ? '台灣即時' : '光影預覽';
    $('#live-time').classList.toggle('selected', previewHour === null);
    if (previewHour === null && document.activeElement !== $('#light-time')) $('#light-time').value = hour;
  }
  function drawTimeShadows() {
    const l = lighting;
    ctx.save();
    // Limit all moving cast shadows to ground surfaces; the illustration retains its
    // original material shading. The cast direction follows the island's local time.
    ctx.beginPath();
    areas.forEach(area => polygon(area.poly));
    const groundPlanes = [
      [[332, 605], [537, 626], [735, 594], [770, 658], [624, 722], [415, 727], [328, 685]],
      [[582, 984], [798, 974], [998, 1006], [927, 1082], [748, 1112], [598, 1080]],
      [[221, 1164], [412, 1171], [480, 1248], [410, 1302], [288, 1264]],
      [[492, 1486], [698, 1473], [883, 1493], [974, 1530], [787, 1598], [604, 1600], [509, 1555]]
    ];
    groundPlanes.forEach(polygon); ctx.clip();
    const casters = [[532, 664, 1.2], [805, 1078, 1], [307, 1231, .8], [815, 1518, 1], [367, 588, .55], [750, 623, .6]];
    for (const [x, y, factor] of casters) {
      ctx.save(); ctx.translate(x + l.shadowX * factor * .5, y + l.shadowY * factor * .4);
      ctx.rotate(Math.atan2(l.shadowY, l.shadowX));
      ctx.scale((30 + Math.hypot(l.shadowX, l.shadowY) * .65) * factor, 22 * factor);
      const gradient = ctx.createRadialGradient(0, 0, .12, 0, 0, 1);
      gradient.addColorStop(0, `rgba(42,49,62,${l.opacity})`); gradient.addColorStop(.5, `rgba(42,49,62,${l.opacity * .7})`); gradient.addColorStop(1, 'rgba(42,49,62,0)');
      ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    ctx.restore();
  }
  function drawClocks() {
    const { hour, minute, second } = lighting;
    for (const face of [{ x: 499, y: 300, rx: 24, ry: 33, shear: .28 }, { x: 590, y: 298, rx: 23, ry: 32, shear: -.35 }]) {
      ctx.save(); ctx.translate(face.x, face.y); ctx.transform(1, face.shear, 0, 1, 0, 0); ctx.scale(face.rx / 36, face.ry / 36);
      ctx.beginPath(); ctx.arc(0, 0, 36, 0, Math.PI * 2); ctx.fillStyle = '#ede2cb'; ctx.fill();
      ctx.strokeStyle = '#a18a67'; ctx.lineWidth = 1.4; ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI / 6;
        ctx.save(); ctx.rotate(angle); ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, i % 3 ? -27 : -25); ctx.lineWidth = i % 3 ? 1.5 : 2.8; ctx.strokeStyle = '#705d47'; ctx.stroke(); ctx.restore();
      }
      ctx.fillStyle = '#705d47'; ctx.font = '8px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('12', 0, -19); ctx.fillText('3', 21, 0); ctx.fillText('6', 0, 21); ctx.fillText('9', -21, 0);
      const hand = (angle, length, width, color) => {
        ctx.save(); ctx.rotate(angle); ctx.beginPath(); ctx.moveTo(0, 3); ctx.lineTo(0, -length); ctx.lineCap = 'round'; ctx.lineWidth = width; ctx.strokeStyle = color; ctx.stroke(); ctx.restore();
      };
      hand(((hour % 12) + minute / 60) * Math.PI / 6, 16, 4.3, '#69513f');
      hand((minute + second / 60) * Math.PI / 30, 26, 2.8, '#69513f');
      hand(second * Math.PI / 30, 28, 1.1, '#a45440');
      ctx.fillStyle = '#69513f'; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }
  const clouds = [
    { x: 930, y: 454, w: 320, speed: .11, phase: 0, alpha: .93 },
    { x: 218, y: 637, w: 240, speed: .08, phase: 2, alpha: .95 },
    { x: 1031, y: 1170, w: 270, speed: .07, phase: 4, alpha: .9 },
    { x: 160, y: 1467, w: 280, speed: .06, phase: 1, alpha: .9 },
    { x: 238, y: 1718, w: 310, speed: .09, phase: 3, alpha: .94 },
    { x: 861, y: 1777, w: 410, speed: .055, phase: 5, alpha: .93 },
    { x: 614, y: 1886, w: 290, speed: .065, phase: 2.5, alpha: .72 }
  ];
  function drawClouds() {
    for (const c of clouds) {
      const t = animationTime * c.speed + c.phase;
      // Continuous wind avoids long, apparently frozen moments at sine extrema.
      const x = ((c.x + animationTime * (10 + c.speed * 90) + 300) % (W + 600)) - 300;
      const y = c.y + Math.sin(t * .65 + 1) * 16;
      const h = c.w * cloud.height / cloud.width;
      ctx.save(); ctx.globalAlpha = c.alpha * Math.min(1, (x + 300) / 110, (W + 300 - x) / 110);
      ctx.drawImage(cloud, x - c.w / 2, y - h / 2, c.w, h); ctx.restore();
    }
  }
  function drawBuildingMist() {
    const key = hoverBuilding || selectedBuilding;
    if (!key) return;
    const place = places[key];
    place.rim ||= new Path2D(IslandOutlines.buildings[key]);
    const fade = hoverBuilding ? 1 : smooth((clock-selectionTime)/.2);
    const line = 3.6 / camera.scale;
    ctx.save(); ctx.globalAlpha = fade * (.96 + Math.sin(animationTime*1.2)*.04);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.shadowColor = '#ffffff';
    // Independent illustration contours keep the white core attached to the artwork.
    ctx.lineWidth = line*4.5; ctx.strokeStyle = '#ffffff24'; ctx.shadowBlur = 20; ctx.stroke(place.rim);
    ctx.lineWidth = line*2.1; ctx.strokeStyle = '#ffffff72'; ctx.shadowBlur = 10; ctx.stroke(place.rim);
    ctx.lineWidth = line; ctx.strokeStyle = '#ffffff'; ctx.shadowBlur = 4; ctx.stroke(place.rim);
    ctx.restore();
  }
  function frame(time) {
    const dt = lastTime ? Math.min((time - lastTime) / 1000, .15) : 0;
    lastTime = time;
    if (!document.hidden) { clock += dt; if (ready) { if (motionEnabled) animationTime += dt; update(dt); draw(); } }
    requestAnimationFrame(frame);
  }
  function load(image, src) { return new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error(src)); image.src = src; }); }
  resize();
  Promise.all([load(island, 'Otsuka-Island.jpg'), load(islandMask, 'assets/island-cutout.png'), load(sprites, 'assets/doctor-turnaround.png'), load(cloud, 'assets/cloud.png'), load(edaArt, 'assets/eda-island-v8.jpg'), load(birdSheet, 'assets/sparrow-states.png'), load(validationArt, 'assets/verification-island-v7.jpg'), load(designArt, 'assets/design-island-v9.jpg')]).then(() => {
    spriteTexture = document.createElement('canvas'); spriteTexture.width = 2048; spriteTexture.height = 683;
    spriteTexture.getContext('2d').drawImage(sprites, 0, 0, 2048, 683);
    life = createIslandLife({ ctx, original: island, mask: islandMask, edaArt, birdSheet, validationArt, designArt, isWalkable: p => !!ground(p, 22) });
    roomExperience.setCharacter(sprites);
    ready = true; $('#loading').classList.add('done'); draw();
  }).catch(error => {
    $('#loading').innerHTML = '<p>圖片讀取失敗。請確認 HTML 與圖片保留在同一個資料夾。</p>';
    console.error('無法載入素材：', error);
  });
  requestAnimationFrame(frame);
  // A read-only snapshot helps verify routing and idle behavior without altering play.
  window.islandGame = Object.freeze({
    walkSpeed: WALK_SPEED,
    roomState: () => ({ ...roomExperience.snapshot(), pending: pendingRoom, entering: entry ? { ...entry } : null }),
    getState: () => ({ ready, x: actor.x, y: actor.y, moving: !!actor.route.length, route: actor.route.map(p => ({ ...p })), wave: actor.wave, phase: actor.phase, facing: actor.facing, destination: actor.destination, zoom: camera.zoom, selectedBuilding, cloudTime: animationTime, idle: actor.idle, nextWave: actor.nextWave, reducedMotion, motionEnabled, lighting: { ...lighting } }),
    resolveTarget: p => resolveTarget(p), findPath: (start, target) => findPath(start, target),
    isWalkable: p => !!ground(p, 22),
    sceneSnapshot: () => life?.snapshot(),
    treeCoverageAt: t => life.treeCoverage(t),
    clothingDiagnostics: () => {
      if (!activeClothing) return null;
      const { canvas: layer, context: g } = activeClothing, w = layer.width, h = layer.height;
      const pixels = g.getImageData(0, 0, w, h).data, visited = new Uint8Array(w * h), queue = new Int32Array(w * h);
      let holes = 0, largestHole = 0;
      for (let seed = 0; seed < visited.length; seed++) {
        if (visited[seed] || pixels[seed * 4 + 3] >= 32) continue;
        let head = 0, tail = 1, border = false; queue[0] = seed; visited[seed] = 1;
        while (head < tail) {
          const at = queue[head++], x = at % w, y = Math.floor(at / w);
          if (!x || !y || x === w - 1 || y === h - 1) border = true;
          for (const next of [x ? at - 1 : -1, x < w - 1 ? at + 1 : -1, y ? at - w : -1, y < h - 1 ? at + w : -1]) {
            if (next >= 0 && !visited[next] && pixels[next * 4 + 3] < 32) { visited[next] = 1; queue[tail++] = next; }
          }
        }
        if (!border && tail > 4) { holes++; largestHole = Math.max(largestHole, tail); }
      }
      visited.fill(0);
      let components = 0;
      for (let seed = 0; seed < visited.length; seed++) {
        if (visited[seed] || pixels[seed * 4 + 3] < 32) continue;
        let head = 0, tail = 1; queue[0] = seed; visited[seed] = 1;
        while (head < tail) {
          const at = queue[head++], x = at % w, y = Math.floor(at / w);
          for (const next of [x ? at - 1 : -1, x < w - 1 ? at + 1 : -1, y ? at - w : -1, y < h - 1 ? at + w : -1]) {
            if (next >= 0 && !visited[next] && pixels[next * 4 + 3] >= 32) { visited[next] = 1; queue[tail++] = next; }
          }
        }
        if (tail > 20) components++;
      }
      return { direction: activeClothing.direction, holes, largestHole, components, phase: actor.phase };
    },
    worldToScreen: p => { const c = screenCenter(); return P((p.x - camera.x) * camera.scale + c.x, (p.y - camera.y) * camera.scale + c.y); }
  });
})();
