// The homepage exhibit. Everything the browser discloses without being asked
// becomes one plate in a 3D stack; each plate's shape is cut from that value.
// Nothing here is stored or sent: values are read, drawn, and forgotten.
(() => {
  const stage = document.querySelectorAll('[data-stage]')[0];
  if (!stage) return;
  const canvas = stage.querySelector('canvas');
  const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
  const panel = document.querySelector('[data-readout]');
  const list = document.querySelector('[data-readout-list]');
  const idLine = document.querySelector('[data-readout-id]');
  if (!ctx || !panel || !list || !idLine) return;

  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MONO = "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

  /* ---- reading what the browser volunteers ---------------------------- */

  function mix(text, seed) {
    let h = seed >>> 0;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return h >>> 0;
  }
  const hex = (value, width) => value.toString(16).toUpperCase().padStart(width, '0').slice(-width);

  function settle(start, ms = 500) {
    try {
      return Promise.race([Promise.resolve(start()), new Promise(resolve => setTimeout(() => resolve(null), ms))]).catch(() => null);
    } catch { return Promise.resolve(null); }
  }

  function browser() {
    const data = navigator.userAgentData;
    if (data && Array.isArray(data.brands)) {
      const real = data.brands.filter(b => !/not/i.test(b.brand));
      const named = real.find(b => b.brand !== 'Chromium') || real[0];
      if (named) return `${named.brand} ${named.version}`;
    }
    const ua = navigator.userAgent || '';
    for (const [pattern, name] of [[/Firefox\/(\d+)/, 'Firefox'], [/Edg\/(\d+)/, 'Edge'], [/Chrome\/(\d+)/, 'Chrome'], [/Version\/(\d+).*Safari/, 'Safari']]) {
      const match = ua.match(pattern);
      if (match) return `${name} ${match[1]}`;
    }
    return null;
  }

  function system(high) {
    const ua = navigator.userAgent || '';
    const data = navigator.userAgentData;
    let name = data && data.platform ? data.platform : null;
    if (!name) {
      name = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : null;
    }
    if (!name) return null;
    if (high && high.architecture) return `${name}, ${high.architecture}${high.bitness ? ' ' + high.bitness + '-bit' : ''}`;
    return name;
  }

  function graphics() {
    try {
      const gl = document.createElement('canvas').getContext('webgl');
      if (!gl) return null;
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      const name = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
      return name.replace(/^ANGLE \((.*)\)$/, '$1').replace(/\s+/g, ' ').trim() || null;
    } catch { return null; }
  }

  function canvasMark() {
    try {
      const probe = document.createElement('canvas');
      probe.width = 220; probe.height = 40;
      const pen = probe.getContext('2d');
      pen.textBaseline = 'top';
      pen.font = "15px 'Times New Roman', serif";
      pen.fillStyle = '#f60'; pen.fillRect(100, 2, 60, 22);
      pen.fillStyle = '#069'; pen.fillText('arun0x.run ≈ 0x7f', 3, 12);
      pen.fillStyle = 'rgba(102, 204, 0, 0.7)'; pen.fillText('arun0x.run ≈ 0x7f', 5, 14);
      return `renders as ${hex(mix(probe.toDataURL(), 0x811c9dc5), 8)}`;
    } catch { return null; }
  }

  const size = bytes => bytes >= 1e9 ? `${Math.round(bytes / 1e9)} GB` : `${Math.max(1, Math.round(bytes / 1e6))} MB`;

  async function gather() {
    const items = [];
    const add = (label, value) => { if (value !== null && value !== undefined && value !== '') items.push({ label, value: String(value).length > 90 ? `${String(value).slice(0, 88)}\u2026` : String(value) }); };
    const data = navigator.userAgentData;
    const high = data && data.getHighEntropyValues ? await settle(() => data.getHighEntropyValues(['architecture', 'bitness'])) : null;

    add('browser', browser());
    add('system', system(high));
    if (window.screen && screen.width) add('screen', `${screen.width} × ${screen.height} at ${Number((window.devicePixelRatio || 1).toFixed(2))}x, ${screen.colorDepth}-bit`);
    if (navigator.hardwareConcurrency) add('processor', `${navigator.hardwareConcurrency} logical cores`);
    if (navigator.deviceMemory) add('memory', `at least ${navigator.deviceMemory} GB`);
    add('graphics', graphics());
    try { add('time zone', Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { /* not disclosed */ }
    add('languages', (navigator.languages && navigator.languages.length ? navigator.languages.slice(0, 4) : [navigator.language]).filter(Boolean).join(', '));
    add('appearance', `${window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'} theme, ${calm ? 'reduced motion' : 'motion allowed'}`);
    if (navigator.connection && navigator.connection.effectiveType) add('connection', navigator.connection.effectiveType);
    if (navigator.getBattery) {
      const battery = await settle(() => navigator.getBattery());
      if (battery && typeof battery.level === 'number') add('power', `${Math.round(battery.level * 100)}%, ${battery.charging ? 'charging' : 'on battery'}`);
    }
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await settle(() => navigator.storage.estimate());
      if (estimate && estimate.quota) add('storage', `about ${size(estimate.quota)} offered`);
    }
    let from = 'no referrer sent';
    try { if (document.referrer) from = new URL(document.referrer).host; } catch { /* keep default */ }
    add('arrived from', from);
    add('tracking', navigator.globalPrivacyControl || navigator.doNotTrack === '1' ? 'asked not to be tracked' : 'no preference sent');
    add('canvas', canvasMark());
    return items;
  }

  /* ---- the stack -------------------------------------------------------- */

  const PITCH = 0.44;
  const SIN_P = Math.sin(PITCH), COS_P = Math.cos(PITCH);
  const LIGHT = (() => { const v = [-0.45, 0.62, -0.64]; const n = Math.hypot(...v); return v.map(c => c / n); })();
  const CAMERA = 7.5;
  const GAP = 0.17;

  let plates = [];
  let rows = [];
  let height = 0;
  let angle = 0.6;
  let active = -1;
  let pinned = -1;
  let dragging = null;
  let visible = true;
  let started = 0;
  let frameId = 0;
  let width = 0, tall = 0, unit = 1, centreX = 0, centreY = 0;

  function cut(items) {
    let y = 0;
    plates = items.map((item, index) => {
      const h = mix(`${item.label}\u0000${item.value}`, 0x9747b28c + index);
      const plate = {
        sides: 4 + (h % 6),
        radius: 0.5 + ((h >>> 4) % 1000) / 1000 * 0.72,
        thick: 0.06 + ((h >>> 14) % 100) / 100 * 0.1,
        phase: ((h >>> 21) % 360) * Math.PI / 180,
        screenY: 0
      };
      return plate;
    });
    // First answer sits on top, so the stack reads in the same order as the list.
    for (let i = plates.length - 1; i >= 0; i--) { plates[i].base = y; y += plates[i].thick + GAP; }
    height = y - GAP;
    for (const plate of plates) plate.base -= height / 2;
  }

  function project(x, y, z) {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const rx = x * cos + z * sin;
    const rz = -x * sin + z * cos;
    const py = y * COS_P + rz * SIN_P;
    const pz = -y * SIN_P + rz * COS_P;
    const scale = unit * CAMERA / (CAMERA + pz);
    return [centreX + rx * scale, centreY - py * scale];
  }

  function shade(level, lit) {
    const b = Math.min(1, 0.13 + level * 0.87);
    return lit
      ? `rgb(${Math.round(64 + b * 170)}, ${Math.round(42 + b * 122)}, ${Math.round(16 + b * 52)})`
      : `rgb(${Math.round(12 + b * 62)}, ${Math.round(17 + b * 74)}, ${Math.round(25 + b * 94)})`;
  }

  function path(points) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
  }

  function outline(plate) {
    const ring = [];
    for (let k = 0; k < plate.sides; k++) {
      const a = plate.phase + (Math.PI * 2 * k) / plate.sides;
      ring.push([plate.radius * Math.cos(a), plate.radius * Math.sin(a)]);
    }
    return ring;
  }

  function drawPlate(plate, index, progress) {
    const ease = 1 - Math.pow(1 - progress, 3);
    const lift = (1 - ease) * 1.4;
    const bottom = plate.base + lift;
    const top = bottom + plate.thick;
    const lit = index === active;
    ctx.globalAlpha = ease;

    // The light between plates: a short glowing spindle standing on the plate below.
    if (index < plates.length - 1 && progress >= 1) {
      const below = plates[index + 1];
      const deck = below.base + below.thick;
      const a = project(0, deck, 0), b = project(0, bottom, 0);
      ctx.save();
      // Light pools on the plate underneath, clipped to its top face.
      path(outline(below).map(([x, z]) => project(x, deck, z)));
      ctx.clip();
      const reach = unit * Math.min(below.radius, plate.radius) * 1.05;
      const pool = ctx.createRadialGradient(a[0], a[1], 0, a[0], a[1], reach);
      pool.addColorStop(0, 'rgba(120, 190, 255, 0.85)');
      pool.addColorStop(0.35, 'rgba(70, 150, 255, 0.32)');
      pool.addColorStop(1, 'rgba(70, 150, 255, 0)');
      ctx.translate(a[0], a[1]); ctx.scale(1, SIN_P * 1.15); ctx.translate(-a[0], -a[1]);
      ctx.fillStyle = pool;
      ctx.beginPath(); ctx.arc(a[0], a[1], reach, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(190, 226, 255, 0.98)';
      ctx.shadowColor = 'rgba(70, 150, 255, 1)';
      ctx.shadowBlur = unit * 0.22;
      ctx.lineWidth = Math.max(2, unit * 0.11);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      ctx.restore();
    }

    const ring = outline(plate);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1;
    for (let k = 0; k < plate.sides; k++) {
      const next = (k + 1) % plate.sides;
      const mid = plate.phase + (Math.PI * 2 * (k + 0.5)) / plate.sides - angle;
      const nx = Math.cos(mid), nz = Math.sin(mid);
      if (nz >= 0) continue;
      const level = Math.max(0, nx * LIGHT[0] + nz * SIN_P * LIGHT[1] + nz * COS_P * LIGHT[2]);
      path([project(ring[k][0], top, ring[k][1]), project(ring[next][0], top, ring[next][1]), project(ring[next][0], bottom, ring[next][1]), project(ring[k][0], bottom, ring[k][1])]);
      ctx.fillStyle = shade(level * 0.8, lit);
      ctx.fill();
      ctx.strokeStyle = lit ? 'rgba(255, 214, 150, 0.35)' : 'rgba(210, 228, 255, 0.12)';
      ctx.stroke();
    }
    path(ring.map(([x, z]) => project(x, top, z)));
    const face = project(0, top, 0);
    const span = unit * plate.radius;
    const sheen = ctx.createLinearGradient(face[0] - span, face[1] - span * 0.4, face[0] + span, face[1] + span * 0.4);
    sheen.addColorStop(0, shade(0.95, lit));
    sheen.addColorStop(0.55, shade(0.52, lit));
    sheen.addColorStop(1, shade(0.3, lit));
    ctx.fillStyle = sheen;
    ctx.fill();
    ctx.strokeStyle = lit ? 'rgba(255, 224, 170, 0.8)' : 'rgba(200, 224, 255, 0.42)';
    ctx.stroke();

    // Key number, fixed in screen space so it stays readable while the stack turns.
    const anchor = project(0, bottom + plate.thick / 2, 0);
    plate.screenY = anchor[1];
    const x0 = centreX + unit * 1.32, x1 = centreX + unit * 1.5;
    if (x1 + 22 < width) {
      ctx.strokeStyle = lit ? 'rgba(224, 160, 74, 0.95)' : 'rgba(152, 161, 168, 0.35)';
      ctx.beginPath(); ctx.moveTo(x0, anchor[1]); ctx.lineTo(x1, anchor[1]); ctx.stroke();
      ctx.fillStyle = lit ? '#e0a04a' : 'rgba(152, 161, 168, 0.7)';
      ctx.font = `${Math.max(9, Math.min(11, unit * 0.075))}px ${MONO}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(String(index + 1).padStart(2, '0'), x1 + 6, anchor[1]);
    }
    ctx.globalAlpha = 1;
  }

  function draw(now) {
    ctx.clearRect(0, 0, width, tall);
    const floor = project(0, -height / 2 - 0.12, 0);
    const glow = ctx.createRadialGradient(floor[0], floor[1], 0, floor[0], floor[1], unit * 1.5);
    glow.addColorStop(0, 'rgba(70, 140, 230, 0.26)');
    glow.addColorStop(1, 'rgba(70, 140, 230, 0)');
    ctx.save();
    ctx.translate(floor[0], floor[1]); ctx.scale(1, SIN_P); ctx.translate(-floor[0], -floor[1]);
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(floor[0], floor[1], unit * 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Bottom plate first: the viewpoint is above, so upper plates overlap lower ones.
    for (let i = plates.length - 1; i >= 0; i--) {
      const order = plates.length - 1 - i;
      const progress = calm ? 1 : Math.max(0, Math.min(1, (now - started - order * 95) / 620));
      if (progress > 0) drawPlate(plates[i], i, progress);
    }
  }

  function loop(now) {
    frameId = 0;
    if (!started) started = now;
    if (!calm && !dragging) angle += 0.0032;
    draw(now);
    // With reduced motion nothing animates, so frames are drawn only on demand.
    if (!calm && visible && !document.hidden) frameId = requestAnimationFrame(loop);
  }
  const wake = () => { if (!frameId && visible && !document.hidden) frameId = requestAnimationFrame(loop); };

  function fit() {
    const box = stage.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, box.width); tall = Math.max(1, box.height);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(tall * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    unit = Math.min(width / 3.9, tall / (height * COS_P + 2.1));
    centreX = width * 0.46; centreY = tall * 0.5;
    wake();
  }

  function mark(index) {
    if (index === active) return;
    if (rows[active]) rows[active].classList.remove('is-active');
    active = index;
    if (rows[active]) rows[active].classList.add('is-active');
    wake();
  }

  function nearest(clientY) {
    const y = clientY - stage.getBoundingClientRect().top;
    let best = -1, distance = 22;
    plates.forEach((plate, index) => { const d = Math.abs(plate.screenY - y); if (d < distance) { distance = d; best = index; } });
    return best;
  }

  gather().then(items => {
    if (items.length < 3) return;
    cut(items);
    const a = mix(items.map(i => i.value).join('|'), 0x811c9dc5), b = mix(items.map(i => i.label + i.value).join('|'), 0x1b873593);
    items.forEach((item, index) => {
      const row = document.createElement('div');
      const term = document.createElement('dt');
      const key = document.createElement('span');
      const detail = document.createElement('dd');
      row.className = calm ? 'readout-row is-in' : 'readout-row';
      row.tabIndex = 0;
      key.className = 'readout-key';
      key.textContent = String(index + 1).padStart(2, '0');
      term.append(key, document.createTextNode(item.label));
      detail.textContent = item.value;
      row.append(term, detail);
      row.addEventListener('pointerenter', () => mark(index));
      row.addEventListener('pointerleave', () => mark(pinned));
      row.addEventListener('focus', () => { pinned = index; mark(index); });
      row.addEventListener('blur', () => { pinned = -1; mark(-1); });
      list.append(row);
      rows.push(row);
    });
    idLine.textContent = `Combined, that is ${hex(a, 8).slice(0, 4)}-${hex(a, 8).slice(4)}-${hex(b, 4)}. Each plate in the stack is one answer. A tracker would call the stack you.`;
    panel.hidden = false;
    stage.hidden = false;
    // Rows surface in step with their plates, on timers of their own so the
    // text never depends on animation frames being delivered.
    if (!calm) rows.forEach((row, index) => setTimeout(() => row.classList.add('is-in'), (rows.length - 1 - index) * 95 + 560));

    stage.addEventListener('pointerdown', event => { dragging = { x: event.clientX, angle }; stage.setPointerCapture(event.pointerId); stage.classList.add('is-held'); });
    stage.addEventListener('pointermove', event => {
      if (dragging) { angle = dragging.angle + (event.clientX - dragging.x) * 0.008; wake(); }
      else if (event.pointerType === 'mouse') mark(nearest(event.clientY));
    });
    const release = () => { dragging = null; stage.classList.remove('is-held'); };
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
    stage.addEventListener('pointerleave', () => { if (!dragging) mark(pinned); });

    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(stage); else window.addEventListener('resize', fit);
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => { visible = entries[0].isIntersecting; wake(); }).observe(stage);
    document.addEventListener('visibilitychange', wake);
    fit();
  });
})();
