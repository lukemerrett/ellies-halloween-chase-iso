// The world's art, drawn with the Canvas 2D API: floors, walls, furniture and Halloween bits.
// Every function draws with its origin at the ground point in the middle of a tile.
// One tile is 2s wide and s tall on screen; heights are measured in s.

export const WALL_H = 1.1;
const INK = '#160b16';

// a point in tile-local space: x and z in tiles from the tile centre, y in tile heights above the ground
export const P = (s, x, z, y = 0) => [(x - z) * s, ((x + z) * s) / 2 - y * s];

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function path(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}
function poly(ctx, pts, fill, stroke, lw = 1) {
  path(ctx, pts);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); }
}
function ellipse(ctx, x, y, rx, ry, fill, stroke, lw = 1) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
// run `draw` in a face's own flat coordinates: u goes 0→1 from corner a to corner b, v goes 0 (top) → 1 (ground)
function onFace(ctx, s, a, b, h, draw) {
  ctx.save();
  ctx.transform(b[0] - a[0], b[1] - a[1], 0, h * s, a[0], a[1] - h * s);
  draw(ctx);
  ctx.restore();
}
function shadeHex(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// A box from (x0, z0) to (x1, z1), from y0 up to y1. Only the three faces the viewer can see are drawn:
// the left face (the +z side), the right face (the +x side) and the top.
export function box(ctx, s, x0, z0, x1, z1, y0, y1, col, opt = {}) {
  const A = P(s, x0, z1, y0), B = P(s, x1, z1, y0), C = P(s, x1, z0, y0);
  const At = P(s, x0, z1, y1), Bt = P(s, x1, z1, y1), Ct = P(s, x1, z0, y1), Nt = P(s, x0, z0, y1);
  const lw = opt.lw ?? Math.max(1, s * 0.03);
  const h = y1 - y0;
  poly(ctx, [A, B, Bt, At], opt.left || shadeHex(col, 0.78));
  if (opt.faceL) onFace(ctx, s, A, B, h, opt.faceL);
  poly(ctx, [B, C, Ct, Bt], opt.right || shadeHex(col, 0.55));
  if (opt.faceR) onFace(ctx, s, B, C, h, opt.faceR);
  poly(ctx, [Nt, Ct, Bt, At], opt.top || col);
  if (opt.topDraw) opt.topDraw(ctx, Nt, Ct, Bt, At);
  if (lw > 0) {
    ctx.strokeStyle = opt.ink || INK; ctx.lineWidth = lw; ctx.lineJoin = 'round';
    path(ctx, [A, B, C, Ct, Nt, At]); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(...At); ctx.lineTo(...Bt); ctx.lineTo(...Ct); ctx.moveTo(...Bt); ctx.lineTo(...B); ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Textures for walls, made once
// ---------------------------------------------------------------------------
function makeCanvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}
let brickTex = null, hedgeTex = null;
function bricks() {
  if (brickTex) return brickTex;
  const r = rng(12);
  // four faces' worth side by side, so neighbouring walls don't repeat exactly
  brickTex = makeCanvas(512, 128, (g, w, h) => {
    g.fillStyle = '#1b1019'; g.fillRect(0, 0, w, h);
    const bh = 11, bw = 26, top = h * 0.72;
    for (let y = 0, row = 0; y < top; y += bh, row++) {
      for (let x = -(row % 2) * bw / 2; x < w; x += bw) {
        const v = 52 + r() * 26;
        g.fillStyle = `rgb(${v + 34},${v * 0.5},${v * 0.72})`;
        g.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
        g.fillStyle = 'rgba(255,220,240,0.08)'; g.fillRect(x + 1.5, y + 1.5, bw - 3, 2);
        if (r() < 0.12) { g.fillStyle = 'rgba(30,60,30,0.45)'; g.fillRect(x + 2 + r() * 10, y + bh - 5, 8 + r() * 8, 3); }
      }
    }
    // dark wooden panels along the bottom
    g.fillStyle = '#2c1a10'; g.fillRect(0, top, w, h - top);
    g.fillStyle = '#3d2615';
    for (let x = 0; x < w; x += 32) g.fillRect(x + 4, top + 6, 24, h - top - 10);
    g.fillStyle = '#5a3a20'; g.fillRect(0, top, w, 4);
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(0, top + 4, w, 2);
  });
  return brickTex;
}
function hedge() {
  if (hedgeTex) return hedgeTex;
  const r = rng(5);
  hedgeTex = makeCanvas(512, 128, (g, w, h) => {
    g.fillStyle = '#132613'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      const x = r() * w, y = r() * h, rr = 3 + r() * 6;
      const v = r();
      g.fillStyle = v < 0.4 ? '#1d3a1a' : v < 0.75 ? '#27491f' : v < 0.93 ? '#335b26' : '#0d1a0d';
      g.beginPath(); g.ellipse(x, y, rr, rr * 0.7, r() * 3, 0, Math.PI * 2); g.fill();
    }
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, 'rgba(120,160,90,0.12)'); grd.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
  return hedgeTex;
}
const texSlice = (tex, k) => (ctx) => ctx.drawImage(tex, (k % 4) * 128, 0, 128, 128, 0, 0, 1, 1);

// ---------------------------------------------------------------------------
// Floors
// ---------------------------------------------------------------------------
export function floorTile(ctx, s, outdoor, seed) {
  const r = rng(seed);
  const N = P(s, -0.5, -0.5), E = P(s, 0.5, -0.5), S = P(s, 0.5, 0.5), W = P(s, -0.5, 0.5);
  ctx.save();
  path(ctx, [N, E, S, W]);
  ctx.clip();
  if (outdoor) {
    const v = r();
    ctx.fillStyle = v < 0.5 ? '#1c2f18' : v < 0.85 ? '#1f3419' : '#23361a';
    ctx.fillRect(-s, -s / 2, 2 * s, s);
    for (let i = 0; i < 40; i++) {
      const [x, y] = P(s, r() - 0.5, r() - 0.5);
      const q = r();
      ctx.fillStyle = q < 0.5 ? 'rgba(60,96,44,0.7)' : q < 0.85 ? 'rgba(12,24,10,0.7)' : 'rgba(110,96,60,0.5)';
      ctx.fillRect(x, y, 1 + r() * s * 0.05, 1 + r() * s * 0.03);
    }
    // grass tufts
    ctx.strokeStyle = '#3c6a2c'; ctx.lineWidth = Math.max(1, s * 0.02);
    for (let i = 0; i < 3; i++) {
      const [x, y] = P(s, r() * 0.8 - 0.4, r() * 0.8 - 0.4);
      ctx.beginPath();
      for (let k = -1; k <= 1; k++) { ctx.moveTo(x, y); ctx.lineTo(x + k * s * 0.05, y - s * (0.08 + r() * 0.05)); }
      ctx.stroke();
    }
  } else {
    // wooden boards running along x
    for (let k = 0; k < 4; k++) {
      const v = 58 + r() * 16;
      poly(ctx, [P(s, -0.5, -0.5 + k / 4), P(s, 0.5, -0.5 + k / 4), P(s, 0.5, -0.25 + k / 4), P(s, -0.5, -0.25 + k / 4)], `rgb(${v},${v * 0.6},${v * 0.38})`);
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = Math.max(1, s * 0.02);
      ctx.beginPath(); ctx.moveTo(...P(s, -0.5, -0.5 + k / 4)); ctx.lineTo(...P(s, 0.5, -0.5 + k / 4)); ctx.stroke();
      const cut = r() - 0.5;
      ctx.beginPath(); ctx.moveTo(...P(s, cut, -0.5 + k / 4)); ctx.lineTo(...P(s, cut, -0.25 + k / 4)); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
      for (let g = 0; g < 2; g++) {
        const z = -0.47 + k / 4 + r() * 0.2, x0 = r() - 0.6;
        ctx.beginPath(); ctx.moveTo(...P(s, x0, z)); ctx.lineTo(...P(s, x0 + 0.3, z)); ctx.stroke();
      }
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Walls
// ---------------------------------------------------------------------------
// faces: which visible faces look onto the floor (and so get decorations), e.g. { left: 'window', right: null }
export function wallBlock(ctx, s, outdoor, seed, faces = {}, h = WALL_H) {
  const r = rng(seed);
  const k = Math.floor(r() * 4);
  const deco = (kind) => kind && ((c) => faceDeco(c, kind, seed));
  if (outdoor) {
    const tex = hedge();
    box(ctx, s, -0.5, -0.5, 0.5, 0.5, 0, h * 0.86, '#1f3d1c', {
      faceL: (c) => { texSlice(tex, k)(c); deco(faces.left)?.(c); },
      faceR: (c) => { texSlice(tex, k + 1)(c); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, 0, 1, 1); deco(faces.right)?.(c); },
      top: '#25461f', lw: Math.max(1, s * 0.025), ink: '#0a160a',
    });
    // a bumpy leafy top
    for (let i = 0; i < 9; i++) {
      const x = r() - 0.5, z = r() - 0.5;
      const [px, py] = P(s, x * 0.9, z * 0.9, h * 0.86);
      const rr = s * (0.16 + r() * 0.1);
      ellipse(ctx, px, py, rr, rr * 0.7, '#1c3a19', '#0a160a', Math.max(1, s * 0.02));
      ellipse(ctx, px - rr * 0.2, py - rr * 0.2, rr * 0.6, rr * 0.4, r() < 0.5 ? '#2e5726' : '#335f2a');
    }
    return;
  }
  const tex = bricks();
  box(ctx, s, -0.5, -0.5, 0.5, 0.5, 0, h, '#3a2430', {
    faceL: (c) => { texSlice(tex, k)(c); deco(faces.left)?.(c); },
    faceR: (c) => { texSlice(tex, k + 2)(c); c.fillStyle = 'rgba(10,0,20,0.4)'; c.fillRect(0, 0, 1, 1); deco(faces.right)?.(c); },
    top: '#2a1a26',
  });
}
// decorations painted onto a wall face, in the face's own 0..1 coordinates
function faceDeco(c, kind, seed) {
  const r = rng(seed * 3 + 1);
  if (kind === 'window') {
    // a tall arched window with moonlight behind it
    c.beginPath();
    c.moveTo(0.3, 0.68); c.lineTo(0.3, 0.3); c.quadraticCurveTo(0.5, 0.02, 0.7, 0.3); c.lineTo(0.7, 0.68); c.closePath();
    const g = c.createLinearGradient(0, 0.1, 0, 0.7);
    g.addColorStop(0, '#9fb8ff'); g.addColorStop(1, '#3a4aa0');
    c.fillStyle = g; c.fill();
    c.strokeStyle = '#120a14'; c.lineWidth = 0.03; c.stroke();
    // a crescent moon in one pane, and the bars
    c.fillStyle = 'rgba(255,250,220,0.9)'; c.beginPath(); c.ellipse(0.4, 0.3, 0.05, 0.05, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#4a5ab0'; c.beginPath(); c.ellipse(0.42, 0.29, 0.045, 0.045, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#120a14'; c.lineWidth = 0.02;
    c.beginPath(); c.moveTo(0.5, 0.12); c.lineTo(0.5, 0.68); c.moveTo(0.3, 0.45); c.lineTo(0.7, 0.45); c.stroke();
    c.fillStyle = '#4a3020'; c.fillRect(0.26, 0.67, 0.48, 0.05);
  } else if (kind === 'portrait') {
    // a gloomy portrait of a stern old headmaster
    c.fillStyle = '#b8892c'; c.fillRect(0.28, 0.1, 0.44, 0.48);
    c.fillStyle = '#7a5418'; c.fillRect(0.31, 0.13, 0.38, 0.42);
    c.fillStyle = '#20141c'; c.fillRect(0.33, 0.15, 0.34, 0.38);
    c.fillStyle = '#3a2a3a'; c.beginPath(); c.ellipse(0.5, 0.5, 0.13, 0.08, 0, Math.PI, 0); c.fill();
    c.fillStyle = '#c9a58a'; c.beginPath(); c.ellipse(0.5, 0.31, 0.08, 0.1, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = r() < 0.5 ? '#9a9a9a' : '#3a2a20'; c.beginPath(); c.ellipse(0.5, 0.235, 0.085, 0.04, 0, Math.PI, 0); c.fill();
    c.fillStyle = '#fff6d0'; c.fillRect(0.465, 0.29, 0.025, 0.02); c.fillRect(0.51, 0.29, 0.025, 0.02);
    c.fillStyle = '#000'; c.fillRect(0.472, 0.292, 0.012, 0.016); c.fillRect(0.517, 0.292, 0.012, 0.016);
    c.strokeStyle = '#5a2020'; c.lineWidth = 0.012; c.beginPath(); c.moveTo(0.47, 0.36); c.lineTo(0.53, 0.355); c.stroke();
  } else if (kind === 'web') {
    c.strokeStyle = 'rgba(220,220,240,0.55)'; c.lineWidth = 0.008;
    c.beginPath();
    for (let a = 0; a <= 4; a++) { c.moveTo(0, 0); c.lineTo(Math.cos(a * 0.39) * 0.4, Math.sin(a * 0.39) * 0.5); }
    for (let k = 1; k <= 3; k++) {
      c.moveTo(k * 0.12, 0);
      for (let a = 1; a <= 4; a++) c.lineTo(Math.cos(a * 0.39) * k * 0.12, Math.sin(a * 0.39) * k * 0.15);
    }
    c.stroke();
  } else if (kind === 'notice') {
    c.fillStyle = '#d9cfa8'; c.fillRect(0.38, 0.22, 0.24, 0.24);
    c.fillStyle = '#7a1010'; c.fillRect(0.41, 0.26, 0.18, 0.03);
    c.fillStyle = '#4a4030'; for (let k = 0; k < 4; k++) c.fillRect(0.41, 0.32 + k * 0.03, 0.12 + r() * 0.06, 0.012);
    c.fillStyle = '#c02020'; c.beginPath(); c.ellipse(0.5, 0.22, 0.012, 0.012, 0, 0, Math.PI * 2); c.fill();
  }
}

// a low wall along the front edges of the board: walls there would hide the room, so they're cut down
export function lowWall(ctx, s, outdoor) {
  if (outdoor) {
    box(ctx, s, -0.5, -0.5, 0.5, 0.5, 0, 0.22, '#2f2a33', { top: '#3c3640' });
    return;
  }
  box(ctx, s, -0.5, -0.5, 0.5, 0.5, 0, 0.3, '#3a2430', { faceL: texSlice(bricks(), 1), faceR: texSlice(bricks(), 3), top: '#4a3040' });
}

// iron railings around the playground. along: 'x' or 'z', the direction the fence runs
export function railing(ctx, s, along, low) {
  box(ctx, s, -0.5, -0.5, 0.5, 0.5, 0, 0.22, '#3a343e', { top: '#4a4450', lw: Math.max(1, s * 0.02) });
  if (low) return;
  const H = 1.15;
  ctx.strokeStyle = '#0c080e'; ctx.lineWidth = Math.max(1.5, s * 0.045); ctx.lineCap = 'round';
  const pt = (u, y) => (along === 'x' ? P(s, u, 0, y) : P(s, 0, u, y));
  ctx.beginPath();
  for (let k = 0; k <= 6; k++) {
    const u = -0.5 + k / 6;
    const [x0, y0] = pt(u, 0.22), [x1, y1] = pt(u, H);
    ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
  }
  for (const y of [0.35, H - 0.12]) { const [a0, b0] = pt(-0.5, y), [a1, b1] = pt(0.5, y); ctx.moveTo(a0, b0); ctx.lineTo(a1, b1); }
  ctx.stroke();
  ctx.fillStyle = '#0c080e';
  for (let k = 0; k <= 6; k++) {
    const [x, y] = pt(-0.5 + k / 6, H);
    ctx.beginPath(); ctx.moveTo(x - s * 0.04, y); ctx.lineTo(x, y - s * 0.12); ctx.lineTo(x + s * 0.04, y); ctx.fill();
  }
  // stone pillars at the ends
  for (const u of [-0.5, 0.5]) {
    const [x, y] = pt(u, 0);
    ctx.save(); ctx.translate(x, y);
    box(ctx, s, -0.1, -0.1, 0.1, 0.1, 0, 1.35, '#4a4450', { top: '#5a5462', lw: Math.max(1, s * 0.02) });
    ctx.restore();
  }
}

// the way out: a big door in a wall face. side: 'left' or 'right' (the visible face it's in)
export function exitDoor(ctx, s, outdoor, side, unlocked, open, t) {
  if (outdoor) {
    // a tall iron gate in a stone arch
    const pt = (u, y) => (side === 'left' ? P(s, -0.5 + u, 0.5, y) : P(s, 0.5, 0.5 - u, y));
    for (const u of [0.05, 0.95]) {
      const [x, y] = pt(u, 0);
      ctx.save(); ctx.translate(x, y);
      box(ctx, s, -0.1, -0.1, 0.1, 0.1, 0, 1.6, '#57505e', { top: '#6a6372', lw: Math.max(1, s * 0.02) });
      ctx.restore();
    }
    ctx.strokeStyle = '#0c080e'; ctx.lineWidth = Math.max(1.5, s * 0.04);
    ctx.beginPath();
    const o = open * 0.42;
    for (let k = 1; k < 9; k++) {
      let u = 0.1 + k * 0.1;
      u = u < 0.5 ? 0.1 + (u - 0.1) * (1 - o * 2) : 0.9 - (0.9 - u) * (1 - o * 2);
      const [x0, y0] = pt(u, 0), [x1, y1] = pt(u, 1.3 + Math.sin(k / 9 * Math.PI) * 0.15);
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    }
    for (const y of [0.25, 1.15]) { const [a, b] = pt(0.1, y), [c2, d] = pt(0.9, y); ctx.moveTo(a, b); ctx.lineTo(c2, d); }
    ctx.stroke();
    if (!open) lockAt(ctx, s, ...pt(0.5, 0.7), unlocked, t);
    return;
  }
  const A = side === 'left' ? P(s, -0.5, 0.5, WALL_H) : P(s, 0.5, 0.5, WALL_H);
  const B = side === 'left' ? P(s, 0.5, 0.5, WALL_H) : P(s, 0.5, -0.5, WALL_H);
  onFace(ctx, s, [A[0], A[1] + WALL_H * s], [B[0], B[1] + WALL_H * s], WALL_H, (c) => {
    // stone arch
    c.fillStyle = '#5a4a52';
    c.beginPath(); c.moveTo(0.12, 1); c.lineTo(0.12, 0.3); c.quadraticCurveTo(0.5, -0.05, 0.88, 0.3); c.lineTo(0.88, 1); c.closePath(); c.fill();
    // dark doorway behind
    c.fillStyle = unlocked ? '#1a3a1a' : '#0a0508';
    c.beginPath(); c.moveTo(0.18, 1); c.lineTo(0.18, 0.34); c.quadraticCurveTo(0.5, 0.06, 0.82, 0.34); c.lineTo(0.82, 1); c.closePath(); c.fill();
    // two door leaves, squeezed towards the hinges as they open
    const w = 0.32 * (1 - open * 0.85);
    for (const [x0, dir] of [[0.18, 1], [0.82, -1]]) {
      const x1 = x0 + dir * w;
      c.fillStyle = '#6a3a1c';
      c.beginPath(); c.moveTo(x0, 1); c.lineTo(x0, 0.34); c.quadraticCurveTo((x0 + 0.5) / 2, 0.12, x1, 0.12 + (1 - open) * 0.0); c.lineTo(x1, 1); c.closePath(); c.fill();
      c.strokeStyle = '#3a1e0c'; c.lineWidth = 0.012;
      for (let k = 1; k < 4; k++) { const x = x0 + dir * w * k / 4; c.beginPath(); c.moveTo(x, 0.25); c.lineTo(x, 1); c.stroke(); }
      c.fillStyle = '#1a1210'; c.fillRect(Math.min(x0, x1), 0.45, w, 0.035); c.fillRect(Math.min(x0, x1), 0.82, w, 0.035);
    }
    c.strokeStyle = '#120a10'; c.lineWidth = 0.02;
    c.beginPath(); c.moveTo(0.12, 1); c.lineTo(0.12, 0.3); c.quadraticCurveTo(0.5, -0.05, 0.88, 0.3); c.lineTo(0.88, 1); c.stroke();
  });
  if (!open) {
    const [x, y] = side === 'left' ? P(s, 0, 0.5, 0.62) : P(s, 0.5, 0, 0.62);
    lockAt(ctx, s, x, y, unlocked, t);
  }
}
function lockAt(ctx, s, x, y, unlocked, t) {
  const col = unlocked ? '#3dff6a' : '#ff3a3a';
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = s * 0.04;
  ctx.beginPath(); ctx.arc(x, y - s * 0.08, s * 0.07, Math.PI, unlocked ? Math.PI * 1.7 : 0); ctx.stroke();
  ctx.fillStyle = col; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, s * 0.025);
  ctx.beginPath(); ctx.roundRect(x - s * 0.1, y - s * 0.08, s * 0.2, s * 0.17, s * 0.03); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(x, y, s * 0.025, 0, Math.PI * 2); ctx.fill();
}

// ---------------------------------------------------------------------------
// Furniture
// ---------------------------------------------------------------------------
export function desk(ctx, s, seed) {
  const r = rng(seed);
  const wood = '#7a4a26';
  // a little chair in front
  for (const [x, z] of [[-0.12, 0.28], [0.12, 0.28], [-0.12, 0.42], [0.12, 0.42]]) box(ctx, s, x - 0.025, z - 0.025, x + 0.025, z + 0.025, 0, 0.25, '#3a2414', { lw: 0 });
  box(ctx, s, -0.16, 0.24, 0.16, 0.46, 0.25, 0.29, '#5a3418');
  box(ctx, s, -0.16, 0.44, 0.16, 0.48, 0.29, 0.55, '#5a3418');
  // the desk: legs, a box and a sloping lid
  for (const [x, z] of [[-0.3, -0.2], [0.3, -0.2], [-0.3, 0.18], [0.3, 0.18]]) box(ctx, s, x - 0.03, z - 0.03, x + 0.03, z + 0.03, 0, 0.36, '#3a2414', { lw: Math.max(1, s * 0.015) });
  box(ctx, s, -0.34, -0.24, 0.34, 0.22, 0.36, 0.48, wood);
  box(ctx, s, -0.36, -0.26, 0.36, 0.24, 0.48, 0.52, '#8e5a30', { top: '#9a6638' });
  // an inkwell and a book or an apple
  const [ix, iy] = P(s, 0.22, -0.14, 0.52);
  ellipse(ctx, ix, iy - s * 0.03, s * 0.035, s * 0.04, '#1a1a2a', INK, 1);
  if (r() < 0.6) box(ctx, s, -0.2, -0.1, 0.05, 0.1, 0.52, 0.57, ['#7a1a1a', '#1a3a7a', '#2a6a2a'][Math.floor(r() * 3)], { lw: Math.max(1, s * 0.015) });
  else { const [ax, ay] = P(s, -0.1, 0, 0.52); ellipse(ctx, ax, ay - s * 0.05, s * 0.055, s * 0.05, '#c81e1e', INK, 1); }
}

export function shelf(ctx, s, seed) {
  const r = rng(seed);
  const H = 1.35;
  const spines = (c) => {
    c.fillStyle = '#2a160a'; c.fillRect(0, 0, 1, 1);
    for (let row = 0; row < 4; row++) {
      const y0 = 0.06 + row * 0.235, y1 = y0 + 0.2;
      for (let x = 0.05; x < 0.93;) {
        const w = 0.04 + r() * 0.05, tall = 0.12 + r() * 0.08;
        if (r() < 0.1) { x += w; continue; }
        c.fillStyle = ['#7a1a1a', '#1a3a7a', '#2a6a2a', '#7a5a1a', '#5a1a6a', '#1a5a5a'][Math.floor(r() * 6)];
        c.fillRect(x, y1 - tall, w - 0.008, tall);
        c.fillStyle = 'rgba(255,230,150,0.35)'; c.fillRect(x, y1 - tall + 0.03, w - 0.008, 0.012);
        x += w;
      }
      c.fillStyle = '#5a3418'; c.fillRect(0, y1, 1, 0.035);
    }
  };
  box(ctx, s, -0.45, -0.3, 0.45, 0.3, 0, H, '#6a3e1e', { faceL: spines, faceR: (c) => { spines(c); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, 0, 1, 1); }, top: '#7a4a26' });
  // a skull or a candle on top, for Halloween
  const [x, y] = P(s, 0.1, 0, H);
  if (r() < 0.5) {
    ellipse(ctx, x, y - s * 0.08, s * 0.08, s * 0.075, '#e8e0cc', INK, 1);
    ctx.fillStyle = '#1a1010'; ctx.fillRect(x - s * 0.045, y - s * 0.1, s * 0.03, s * 0.03); ctx.fillRect(x + s * 0.015, y - s * 0.1, s * 0.03, s * 0.03);
  } else {
    ctx.fillStyle = '#efe6c8'; ctx.fillRect(x - s * 0.03, y - s * 0.16, s * 0.06, s * 0.16);
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(x - s * 0.03, y - s * 0.16, s * 0.06, s * 0.16);
  }
}

// a little round table; the jug on it is drawn separately so it can fly
export function table(ctx, s) {
  const [cx, cy] = P(s, 0, 0, 0);
  box(ctx, s, -0.04, -0.04, 0.04, 0.04, 0, 0.45, '#3a2414', { lw: Math.max(1, s * 0.015) });
  ellipse(ctx, cx, cy, s * 0.22, s * 0.1, '#3a2414', INK, Math.max(1, s * 0.02));
  const [tx, ty] = P(s, 0, 0, 0.45);
  ellipse(ctx, tx, ty + s * 0.03, s * 0.4, s * 0.2, '#5a3418');
  ellipse(ctx, tx, ty, s * 0.4, s * 0.2, '#8a5630', INK, Math.max(1, s * 0.025));
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(tx, ty, s * 0.3, s * 0.14, 0, 0, Math.PI * 2); ctx.stroke();
}
// a glass jug of water with a newt swimming in it; origin at the jug's base
export function jug(ctx, s, t) {
  const w = s * 0.17, h = s * 0.36;
  ctx.beginPath();
  ctx.moveTo(-w * 0.7, 0); ctx.quadraticCurveTo(-w * 1.2, -h * 0.5, -w * 0.55, -h * 0.85); ctx.lineTo(-w * 0.6, -h);
  ctx.lineTo(w * 0.8, -h); ctx.lineTo(w * 0.55, -h * 0.85); ctx.quadraticCurveTo(w * 1.2, -h * 0.5, w * 0.7, 0); ctx.closePath();
  ctx.fillStyle = 'rgba(160,210,255,0.35)'; ctx.fill();
  // water
  ctx.save(); ctx.clip();
  ctx.fillStyle = 'rgba(70,150,230,0.55)'; ctx.fillRect(-w * 1.3, -h * 0.62, w * 2.6, h);
  // the newt
  const nx = Math.sin(t * 1.7) * w * 0.4;
  ctx.fillStyle = '#e07a20';
  ctx.beginPath(); ctx.ellipse(nx, -h * 0.3, w * 0.38, w * 0.13, Math.sin(t * 1.7) * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(nx + w * 0.28, -h * 0.32, w * 0.04, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(220,240,255,0.9)'; ctx.lineWidth = Math.max(1, s * 0.022); ctx.stroke();
  ctx.beginPath(); ctx.arc(w * 0.95, -h * 0.55, w * 0.35, -1.3, 1.3); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-w * 0.45, -h * 0.75, w * 0.12, h * 0.45);
}

export function chalkboard(ctx, s, text) {
  // an easel with a blackboard facing the viewer
  ctx.strokeStyle = '#4a2a14'; ctx.lineWidth = Math.max(2, s * 0.05); ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * 0.35, s * 0.1); ctx.lineTo(-s * 0.2, -s * 1.15);
  ctx.moveTo(s * 0.35, s * 0.1); ctx.lineTo(s * 0.2, -s * 1.15);
  ctx.moveTo(0, -s * 0.1); ctx.lineTo(0, -s * 1.1);
  ctx.stroke();
  ctx.fillStyle = '#5a3418'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, s * 0.025);
  ctx.beginPath(); ctx.roundRect(-s * 0.5, -s * 1.08, s * 1.0, s * 0.68, s * 0.04); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1e2a22'; ctx.fillRect(-s * 0.45, -s * 1.03, s * 0.9, s * 0.58);
  ctx.fillStyle = 'rgba(240,240,230,0.85)';
  ctx.font = `${Math.round(s * 0.13)}px "Creepster", "Baloo 2", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lines = text.split('\n');
  lines.forEach((l, i) => ctx.fillText(l, 0, -s * 0.74 + (i - (lines.length - 1) / 2) * s * 0.16));
  ctx.fillStyle = '#e8e8e0'; ctx.fillRect(s * 0.2, -s * 0.44, s * 0.08, s * 0.025);
}

// the swing frame; the seat is drawn live by swingSeat so it can sway
export function swingFrame(ctx, s, back) {
  ctx.strokeStyle = '#2a2a34'; ctx.lineWidth = Math.max(2, s * 0.05); ctx.lineCap = 'round';
  const H = 1.5;
  const legs = back ? [[-0.42, -0.25], [-0.42, 0.25]] : [[0.42, -0.25], [0.42, 0.25]];
  ctx.beginPath();
  for (const [x, z] of legs) { const [a, b] = P(s, x, z, 0), [c, d] = P(s, x, 0, H); ctx.moveTo(a, b); ctx.lineTo(c, d); }
  if (back) { const [a, b] = P(s, -0.42, 0, H), [c, d] = P(s, 0.42, 0, H); ctx.moveTo(a, b); ctx.lineTo(c, d); }
  ctx.stroke();
}
export function swingSeat(ctx, s, sway) {
  const H = 1.5, z = Math.sin(sway) * 0.35, y = 0.38 + (1 - Math.cos(sway)) * 0.35;
  ctx.strokeStyle = '#6a6a74'; ctx.lineWidth = Math.max(1, s * 0.015);
  ctx.beginPath();
  for (const x of [-0.18, 0.18]) { const [a, b] = P(s, x, 0, H), [c, d] = P(s, x, z, y); ctx.moveTo(a, b); ctx.lineTo(c, d); }
  ctx.stroke();
  box(ctx, s, -0.22, z - 0.08, 0.22, z + 0.08, y - 0.04, y, '#6a3a1c');
}

export function crate(ctx, s, seed) {
  const r = rng(seed);
  const planks = (c) => {
    c.fillStyle = 'rgba(0,0,0,0.25)';
    for (let k = 1; k < 4; k++) c.fillRect(0, k / 4 - 0.01, 1, 0.02);
    c.strokeStyle = '#3a200c'; c.lineWidth = 0.07;
    c.strokeRect(0.04, 0.04, 0.92, 0.92);
    c.beginPath(); c.moveTo(0.06, 0.94); c.lineTo(0.94, 0.06); c.stroke();
    c.fillStyle = '#1a1a1a'; for (const [x, y] of [[0.08, 0.08], [0.92, 0.08], [0.08, 0.92], [0.92, 0.92]]) c.fillRect(x - 0.02, y - 0.02, 0.04, 0.04);
  };
  const h = 0.72 + r() * 0.08;
  box(ctx, s, -0.38, -0.38, 0.38, 0.38, 0, h, '#a8723a', { faceL: planks, faceR: planks, top: '#b88448', topDraw: (c, Nt, Ct, Bt, At) => {
    c.strokeStyle = 'rgba(60,30,10,0.6)'; c.lineWidth = Math.max(1, s * 0.015);
    for (let k = 1; k < 4; k++) { const f = k / 4; c.beginPath(); c.moveTo(Nt[0] + (At[0] - Nt[0]) * f, Nt[1] + (At[1] - Nt[1]) * f); c.lineTo(Ct[0] + (Bt[0] - Ct[0]) * f, Ct[1] + (Bt[1] - Ct[1]) * f); c.stroke(); }
  } });
}

// a big wicker basket with a lid. open: 0..1 lifts the lid; eyes: Matilda peeking out from inside
export function basket(ctx, s, open, eyes, t) {
  const rx = s * 0.5, ry = s * 0.25, h = s * 0.95;
  // body: a slightly flared tub
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-rx * 0.88, 0);
    ctx.lineTo(-rx, -h);
    ctx.ellipse(0, -h, rx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(rx * 0.88, 0);
    ctx.ellipse(0, 0, rx * 0.88, ry * 0.88, 0, 0, Math.PI);
    ctx.closePath();
  };
  body();
  const g = ctx.createLinearGradient(-rx, 0, rx, 0);
  g.addColorStop(0, '#6a4220'); g.addColorStop(0.35, '#b07a40'); g.addColorStop(1, '#4a2a12');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); body(); ctx.clip();
  // woven bands and upright canes
  ctx.lineWidth = Math.max(1, s * 0.035);
  for (let k = 0; k < 9; k++) {
    const y = -h * (k + 0.5) / 9;
    ctx.strokeStyle = k % 2 ? 'rgba(60,30,10,0.55)' : 'rgba(255,220,160,0.22)';
    ctx.beginPath(); ctx.ellipse(0, y, rx * (0.88 + 0.12 * (k + 0.5) / 9), ry, 0, 0.05, Math.PI - 0.05); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(40,20,5,0.5)'; ctx.lineWidth = Math.max(1, s * 0.02);
  for (let k = -5; k <= 5; k++) {
    const a = (k / 6) * (Math.PI / 2), x = Math.sin(a);
    ctx.beginPath(); ctx.moveTo(x * rx * 0.88, Math.cos(a) * ry * 0.88); ctx.lineTo(x * rx, -h + Math.cos(a) * ry); ctx.stroke();
  }
  ctx.restore();
  body(); ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, s * 0.03); ctx.stroke();
  // the rim and the dark inside
  const lift = open * s * 0.45;
  ellipse(ctx, 0, -h, rx, ry, eyes || open > 0.05 ? '#140a04' : '#7a4a22', INK, Math.max(1, s * 0.03));
  if (eyes) {
    // two eyes glinting in the dark gap under the lid
    const blink = (t % 3.7) < 0.12 ? 0.15 : 1;
    for (const dx of [-0.13, 0.13]) {
      ellipse(ctx, dx * s, -h - s * 0.02, s * 0.065, s * 0.06 * blink, '#fff');
      ellipse(ctx, dx * s + s * 0.015, -h - s * 0.01, s * 0.03, s * 0.035 * blink, '#3a2010');
    }
  }
  // the lid, hinged at the back: it rises and tips back as it opens
  ctx.save();
  ctx.translate(0, -h - lift - (eyes ? s * 0.1 : 0));
  ctx.scale(1, 1 - open * 0.55);
  ellipse(ctx, 0, s * 0.04, rx * 1.04, ry * 1.04, '#5a3416');
  ellipse(ctx, 0, 0, rx * 1.04, ry * 1.04, '#9a6a34', INK, Math.max(1, s * 0.03));
  ctx.strokeStyle = 'rgba(60,30,10,0.5)'; ctx.lineWidth = Math.max(1, s * 0.025);
  for (const k of [0.75, 0.5, 0.25]) { ctx.beginPath(); ctx.ellipse(0, 0, rx * k, ry * k, 0, 0, Math.PI * 2); ctx.stroke(); }
  ellipse(ctx, 0, -s * 0.03, s * 0.07, s * 0.045, '#6a4220', INK, 1);
  ctx.restore();
}

export function pumpkin(ctx, s, size, lit, t, seed = 1) {
  const r = rng(seed);
  const w = s * 0.32 * size, h = s * 0.26 * size;
  // ribs
  for (const [dx, k] of [[-0.55, 0.62], [0.55, 0.62], [-0.25, 0.8], [0.25, 0.8], [0, 0.85]]) {
    ellipse(ctx, dx * w, -h, w * k * 0.62, h, dx === 0 ? '#ff8a1a' : Math.abs(dx) < 0.3 ? '#f07a12' : '#d8650c', INK, Math.max(1, s * 0.022));
  }
  // stem
  ctx.fillStyle = '#4a6a1a'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, s * 0.02);
  ctx.beginPath(); ctx.moveTo(-w * 0.08, -h * 1.9); ctx.quadraticCurveTo(w * 0.1, -h * 2.4, w * 0.25, -h * 2.3); ctx.lineTo(w * 0.1, -h * 1.85); ctx.closePath(); ctx.fill(); ctx.stroke();
  // carved face
  const glow = lit ? (0.85 + Math.sin(t * 9 + seed) * 0.08 + Math.sin(t * 23) * 0.05) : 0;
  ctx.fillStyle = lit ? `rgba(255,${200 + glow * 40},90,1)` : '#3a1a08';
  const eye = (x) => { ctx.beginPath(); ctx.moveTo(x - w * 0.16, -h * 1.15); ctx.lineTo(x, -h * 1.45); ctx.lineTo(x + w * 0.16, -h * 1.15); ctx.closePath(); ctx.fill(); };
  eye(-w * 0.3); eye(w * 0.3);
  ctx.beginPath(); ctx.moveTo(-w * 0.12, -h * 0.98); ctx.lineTo(0, -h * 1.15); ctx.lineTo(w * 0.12, -h * 0.98); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-w * 0.5, -h * 0.75);
  const teeth = 2 + Math.floor(r() * 2);
  for (let k = 0; k <= teeth * 2; k++) ctx.lineTo(-w * 0.5 + (w * k) / teeth / 2 * 1, -h * (k % 2 ? 0.62 : 0.75));
  ctx.quadraticCurveTo(0, -h * 0.25, -w * 0.5, -h * 0.75);
  ctx.fill();
}

export function book(ctx, s, color) {
  // a closed hardback seen at an angle, with pages showing
  const w = s * 0.3, d = s * 0.22, th = s * 0.08;
  ctx.lineWidth = Math.max(1, s * 0.022); ctx.strokeStyle = INK; ctx.lineJoin = 'round';
  poly(ctx, [[-w, 0], [0, d], [0, d + th], [-w, th]], shadeHex(color, 0.7), INK, ctx.lineWidth);
  poly(ctx, [[0, d], [w, 0], [w, th], [0, d + th]], '#f2ead2', INK, ctx.lineWidth);
  ctx.strokeStyle = 'rgba(120,100,70,0.6)'; ctx.lineWidth = 1;
  for (let k = 1; k < 3; k++) { ctx.beginPath(); ctx.moveTo(0, d + th * k / 3); ctx.lineTo(w, th * k / 3); ctx.stroke(); }
  poly(ctx, [[-w, 0], [0, -d], [w, 0], [0, d]], color, INK, Math.max(1, s * 0.022));
  // a gold star on the cover
  ctx.fillStyle = '#ffd84a';
  ctx.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? s * 0.035 : s * 0.08; ctx.lineTo(Math.cos(a) * rr * 1.4, Math.sin(a) * rr * 0.75); }
  ctx.fill();
}

export function candelabra(ctx, s, t, seed) {
  ctx.strokeStyle = '#2a2420'; ctx.lineWidth = Math.max(2, s * 0.04); ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, -s * 0.85);
  ctx.moveTo(-s * 0.22, -s * 0.85); ctx.quadraticCurveTo(-s * 0.22, -s * 0.7, 0, -s * 0.7); ctx.quadraticCurveTo(s * 0.22, -s * 0.7, s * 0.22, -s * 0.85);
  ctx.stroke();
  ellipse(ctx, 0, 0, s * 0.14, s * 0.07, '#2a2420', INK, 1);
  for (const [x, hh] of [[-0.22, 0.85], [0, 0.95], [0.22, 0.85]]) {
    ctx.fillStyle = '#efe6c8'; ctx.fillRect(x * s - s * 0.03, -hh * s - s * 0.16, s * 0.06, s * 0.16);
    const f = 1 + Math.sin(t * 14 + x * 30 + seed) * 0.15;
    ctx.fillStyle = '#ffcf4a';
    ctx.beginPath(); ctx.ellipse(x * s, -hh * s - s * 0.21, s * 0.03, s * 0.06 * f, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff6d0';
    ctx.beginPath(); ctx.ellipse(x * s, -hh * s - s * 0.2, s * 0.012, s * 0.03 * f, 0, 0, Math.PI * 2); ctx.fill();
  }
}

export function deadTree(ctx, s, seed) {
  const r = rng(seed);
  ctx.strokeStyle = '#140c18'; ctx.lineCap = 'round';
  const branch = (x, y, len, ang, w, depth) => {
    const x2 = x + Math.sin(ang) * len, y2 = y - Math.cos(ang) * len;
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo((x + x2) / 2 + (r() - 0.5) * len * 0.3, (y + y2) / 2, x2, y2); ctx.stroke();
    if (depth > 0) {
      const n = 2 + (r() < 0.4 ? 1 : 0);
      for (let k = 0; k < n; k++) branch(x2, y2, len * (0.55 + r() * 0.2), ang + (k - (n - 1) / 2) * (0.6 + r() * 0.3) + (r() - 0.5) * 0.3, w * 0.62, depth - 1);
    }
  };
  branch(0, 0, s * (0.9 + r() * 0.4), (r() - 0.5) * 0.2, s * 0.14, 4);
}
export function toadstool(ctx, s, seed) {
  const r = rng(seed);
  const n = 1 + Math.floor(r() * 3);
  for (let k = 0; k < n; k++) {
    const x = (r() - 0.5) * s * 0.5, y = (r() - 0.5) * s * 0.2, sz = 0.6 + r() * 0.6;
    const col = r() < 0.5 ? '#5ad8c8' : '#c070ff';
    ctx.fillStyle = '#e8dccc'; ctx.strokeStyle = INK; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x - s * 0.03 * sz, y - s * 0.22 * sz, s * 0.06 * sz, s * 0.22 * sz, s * 0.02); ctx.fill(); ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(x, y - s * 0.22 * sz, s * 0.13 * sz, s * 0.09 * sz, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (const dx of [-0.06, 0.03]) { ctx.beginPath(); ctx.arc(x + dx * s * sz, y - s * 0.27 * sz, s * 0.017 * sz, 0, Math.PI * 2); ctx.fill(); }
  }
}
export function gravestone(ctx, s, seed) {
  const r = rng(seed);
  const lean = (r() - 0.5) * 0.25;
  ctx.save(); ctx.rotate(lean);
  ctx.fillStyle = '#5a5662'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, s * 0.025);
  ctx.beginPath(); ctx.moveTo(-s * 0.2, 0); ctx.lineTo(-s * 0.2, -s * 0.45); ctx.arc(0, -s * 0.45, s * 0.2, Math.PI, 0); ctx.lineTo(s * 0.2, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3a3640'; ctx.font = `bold ${Math.round(s * 0.11)}px sans-serif`; ctx.textAlign = 'center';
  ctx.fillText('RIP', 0, -s * 0.38);
  ctx.restore();
}

export function bat(ctx, s, flap) {
  ctx.fillStyle = '#0c0610';
  const w = s * 0.5, f = Math.sin(flap) * s * 0.18;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-w * 0.5, -f - s * 0.1, -w, -f);
  ctx.quadraticCurveTo(-w * 0.7, -f * 0.3 + s * 0.04, -w * 0.5, s * 0.03);
  ctx.quadraticCurveTo(-w * 0.25, s * 0.0, 0, s * 0.08);
  ctx.quadraticCurveTo(w * 0.25, s * 0.0, w * 0.5, s * 0.03);
  ctx.quadraticCurveTo(w * 0.7, -f * 0.3 + s * 0.04, w, -f);
  ctx.quadraticCurveTo(w * 0.5, -f - s * 0.1, 0, 0);
  ctx.fill();
  ctx.fillStyle = '#ff4040'; ctx.fillRect(-s * 0.04, -s * 0.01, s * 0.025, s * 0.02); ctx.fillRect(s * 0.015, -s * 0.01, s * 0.025, s * 0.02);
}
