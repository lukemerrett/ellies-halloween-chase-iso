// Ellie's Halloween Chase, the isometric edition: help Matilda collect her library books and escape Miss Trunchbull.
// Everything is drawn on one HTML5 canvas. The world is a grid of tiles; positions are in tiles.
import * as A from './art.js';
import * as CH from './characters.js';
import { initAudio, play, setMuted, startDrone, setDrone } from './audio.js';
import { LEVELS, generateMap } from './levels.js';

const RUN = 1.7, M_R = 0.17, T_R = 0.26;
const SEE_DIST = 5.2, CATCH_R = 0.42, POWER_RANGE = 4.8, CRATE_RANGE = 2.6, POWER_COOLDOWN = 5, STUN_TIME = 5.5, GRACE = 3;
const M_HEAD = 1.35, T_HEAD = 2.1;
const BLOCK = new Set(['#', 'G', 'D', 'S', 'J', 'K', 'W', 'E', 'X']);
const SIGHT = new Set(['#', 'G', 'S', 'E', 'X']);
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

const LINES = {
  spot: ['THERE you are!', 'Come HERE, you little worm!', 'No running in MY school!', 'DETENTION!', 'I can SEE you!'],
  search: ['Where are you hiding...?', "I know you're in here...", 'Sniff sniff... I smell a child!'],
  giveUp: ['Hmph! Slippery little thing...', 'I WILL find you...'],
  stunned: ['Ooof! My head!', 'Wha...? Who did that?!', 'Ooooh... stars...'],
  caught: ['GOTCHA!', 'Caught you!'],
  angry: ['Those are MY books! GET BACK HERE!'],
};
const BOOK_COLOURS = ['#c0392b', '#2e6bd1', '#2a9a4a', '#9b4dd6', '#e08a1a'];

// ---------------------------------------------------------------------------
// The canvas, its scale, and a cache of pre-drawn sprites
// ---------------------------------------------------------------------------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const TOUCH = matchMedia('(pointer: coarse)').matches;
let cw = 1, ch = 1, dpr = 1, S = 48;
// darkness is drawn into a half-size canvas, with holes cut out for the lights
const lightCv = document.createElement('canvas');
const lctx = lightCv.getContext('2d');
const sprites = new Map();

function resize() {
  cw = window.innerWidth || 1; ch = window.innerHeight || 1;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  lightCv.width = Math.ceil(cw / 2); lightCv.height = Math.ceil(ch / 2);
  const ns = Math.round(clamp(Math.min(ch * 0.125, cw * 0.07), 32, 72));
  if (ns !== S) { S = ns; sprites.clear(); }
  checkOrientation();
}
// a sprite reaches `w` tile-heights either side of its anchor, `up` above it and `down` below it
function sprite(key, w, up, down, draw) {
  let sp = sprites.get(key);
  if (sp) return sp;
  const W = Math.ceil(2 * w * S), H = Math.ceil((up + down) * S);
  const c = document.createElement('canvas');
  c.width = Math.ceil(W * dpr); c.height = Math.ceil(H * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr); g.translate(w * S, up * S);
  draw(g, S);
  sp = { c, ox: w * S, oy: up * S, w: W, h: H };
  sprites.set(key, sp);
  return sp;
}
function blit(sp, x, y) { ctx.drawImage(sp.c, x - sp.ox, y - sp.oy, sp.w, sp.h); }

// world (tiles) to screen (pixels)
const cam = { x: 0, y: 0, ox: 0, oy: 0, shake: 0 };
const scr = (x, z, y = 0) => [(x - z) * S + cam.ox, ((x + z) * S) / 2 - y * S + cam.oy];

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------
const G = {
  level: 0, lv: null, grid: [], W: 0, H: 0, seed: 0, objs: [],
  books: [], booksGot: 0, checkpoints: [], cp: null, cpTile: null, exit: null, crates: [], jugs: [], baskets: [], swings: [], flames: [], windows: [],
  waypoints: [], playing: false, paused: false, time: 0, grace: 0, frozen: 0, power: 0,
  hidden: false, hideB: null, hideCool: 0, hideCount: 0, outT: -9,
  unlocked: false, done: false, angry: false, tipsShown: new Set(), nextThunder: 10, flash: 0, nextBats: 6, bats: [],
};
const M = { x: 0, z: 0, vx: 0, vz: 0, speed: 0, phase: 0, glow: 0, dir: 'front', flip: false, stepAcc: 0, hopT: 0, hopFrom: { x: 0, z: 0 }, visible: true };
const T = { x: 0, z: 0, state: 'patrol', wp: 0, path: [], pathT: 0, goalKey: '', lost: 0, lastSeen: { x: 0, z: 0 }, searchT: 0, stun: 0, phase: 0, stepAcc: 0, red: 0, sayT: -9, dir: 'front', flip: false, look: { x: 0, z: 1 }, speed: 0 };

// ---------------------------------------------------------------------------
// Grid helpers
// ---------------------------------------------------------------------------
const tileOf = (x, z) => [Math.floor(x), Math.floor(z)];
const centre = (tx, tz) => ({ x: tx + 0.5, z: tz + 0.5 });
const cell = (tx, tz) => (G.grid[tz] && G.grid[tz][tx]) || '#';
const blocked = (tx, tz) => BLOCK.has(cell(tx, tz));
const opaque = (tx, tz) => SIGHT.has(cell(tx, tz));
function lineOfSight(a, b) {
  const d = dist(a, b), n = Math.ceil(d / 0.15);
  for (let i = 1; i < n; i++) {
    const t = i / n, [tx, tz] = tileOf(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
    if (opaque(tx, tz)) return false;
  }
  return true;
}
// shortest route over the grid, as a list of tiles; with avoidHide, baskets can't be walked through
function findPath(from, to, avoidHide) {
  const [sx, sz] = from, [gx, gz] = to;
  const key = (x, z) => z * G.W + x;
  const prev = new Map([[key(sx, sz), -1]]);
  const q = [[sx, sz]];
  while (q.length) {
    const [x, z] = q.shift();
    if (x === gx && z === gz) break;
    for (const [dx, dz] of DIRS) {
      const nx = x + dx, nz = z + dz, k = key(nx, nz);
      if (prev.has(k) || blocked(nx, nz) || (avoidHide && cell(nx, nz) === 'H' && !(nx === gx && nz === gz))) continue;
      prev.set(k, key(x, z));
      q.push([nx, nz]);
    }
  }
  if (!prev.has(key(gx, gz))) return null;
  const out = [];
  for (let k = key(gx, gz); k !== -1; k = prev.get(k)) out.push([k % G.W, Math.floor(k / G.W)]);
  return out.reverse();
}
// push a circle out of any blocked squares around it
function collide(p, r, forTrunch) {
  const [tx, tz] = tileOf(p.x, p.z);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const x = tx + dx, z = tz + dz;
    if (!blocked(x, z) && !(forTrunch && cell(x, z) === 'H')) continue;
    const cx = clamp(p.x, x, x + 1), cz = clamp(p.z, z, z + 1);
    const ddx = p.x - cx, ddz = p.z - cz, d = Math.hypot(ddx, ddz);
    if (d < r) {
      if (d > 1e-5) { p.x = cx + (ddx / d) * r; p.z = cz + (ddz / d) * r; }
      else p.x += r;
    }
  }
}

// ---------------------------------------------------------------------------
// Building a level: everything in it becomes a drawable object, sorted by depth each frame
// ---------------------------------------------------------------------------
// obj: { x, z: where it stands, d: depth, tall: how high it reaches (for fading walls in front of people), draw(sx, sy) }
function add(o) { if (!("d" in o)) o.d = o.x + o.z; G.objs.push(o); return o; }
const wallish = (x, z) => { const c = cell(x, z); return c === '#' || c === 'G' || c === 'E'; };

function buildLevel(i, seed = Math.floor(Math.random() * 2 ** 31)) {
  const lv = { ...LEVELS[i], map: generateMap(LEVELS[i], seed) };
  G.level = i; G.lv = lv; G.seed = seed;
  G.grid = lv.map.map((r) => r.split(''));
  G.H = G.grid.length; G.W = G.grid[0].length;
  Object.assign(G, {
    objs: [], books: [], booksGot: 0, checkpoints: [], crates: [], jugs: [], baskets: [], swings: [], flames: [], windows: [], waypoints: [], bats: [],
    unlocked: false, done: false, angry: false, power: 0, grace: 0, hidden: false, hideB: null, hideCool: 0, outT: -9, exit: null,
  });
  document.body.classList.remove('hiding');
  const out = lv.outdoor;
  const r = A.rng(seed ^ 0x5bd1e995);
  const { W, H } = G;

  G.grid.forEach((row, z) => row.forEach((c, x) => {
    const p = centre(x, z);
    const vseed = (x * 7 + z * 13) % 4;
    if (c === '#') {
      if (x === W - 1 || z === H - 1) {
        // walls along the front edges are cut down so they don't hide the room
        add({ ...p, tall: 0, draw: (sx, sy) => blit(sprite(`low${out}`, 1.05, 0.9, 0.6, (g, s) => A.lowWall(g, s, out)), sx, sy) });
        return;
      }
      // decorate the faces that look into the room
      const faces = {};
      for (const [side, nx, nz] of [['left', x, z + 1], ['right', x + 1, z]]) {
        if (wallish(nx, nz)) continue;
        const outer = side === 'left' ? z === 0 : x === 0;
        const q = r();
        if (out) faces[side] = null;
        else if (outer && q < 0.38) faces[side] = 'window';
        else if (q < 0.08) faces[side] = 'portrait';
        else if (q < 0.13) faces[side] = 'notice';
        else if (q < 0.22) faces[side] = 'web';
        else if (q < 0.36) {
          // a candle sconce: the flame is drawn live
          faces[side] = null;
          const f = side === 'left' ? { x: x + 0.5, z: z + 1.02 } : { x: x + 1.02, z: z + 0.5 };
          G.flames.push({ ...f, y: A.WALL_H * 0.62, ph: r() * 9, flicker: r() < 0.35 });
        }
        if (faces[side] === 'window') G.windows.push(side === 'left' ? { x: x + 0.5, z: z + 1.05, y: 0.75 } : { x: x + 1.05, z: z + 0.5, y: 0.75 });
      }
      const key = `w${out}${vseed}${faces.left || ''}|${faces.right || ''}`;
      add({ ...p, tall: A.WALL_H, draw: (sx, sy) => blit(sprite(key, 1.05, A.WALL_H + 0.75, 0.6, (g, s) => A.wallBlock(g, s, out, vseed + 1, faces)), sx, sy) });
    } else if (c === 'G') {
      const along = z === 0 || z === H - 1 ? 'x' : 'z';
      const low = x === W - 1 || z === H - 1;
      add({ ...p, tall: low ? 0 : 1.2, draw: (sx, sy) => blit(sprite(`rail${along}${low}`, 1.15, 1.7, 0.7, (g, s) => A.railing(g, s, along, low)), sx, sy) });
    } else if (c === 'E') {
      const side = z === 0 ? 'left' : 'right';
      const ex = { tile: [x, z], front: side === 'left' ? [x, z + 1] : [x + 1, z], open: 0, side };
      G.exit = ex;
      const block = sprite(`ex${out}${vseed}`, 1.05, A.WALL_H + 0.75, 0.6, (g, s) => (out ? A.railing(g, s, side === 'left' ? 'x' : 'z', true) : A.wallBlock(g, s, out, vseed + 1, {})));
      add({ ...p, tall: A.WALL_H, draw: (sx, sy) => { blit(block, sx, sy); ctx.save(); ctx.translate(sx, sy); A.exitDoor(ctx, S, out, side, G.unlocked, ex.open, G.time); ctx.restore(); } });
    } else if (c === 'D') {
      add({ ...p, tall: 0.6, draw: (sx, sy) => blit(sprite(`desk${vseed}`, 0.9, 1.0, 0.6, (g, s) => A.desk(g, s, vseed)), sx, sy) });
    } else if (c === 'S') {
      add({ ...p, tall: 1.5, draw: (sx, sy) => blit(sprite(`shelf${vseed}`, 1.0, 1.9, 0.6, (g, s) => A.shelf(g, s, vseed + 3)), sx, sy) });
    } else if (c === 'K') {
      const text = pick(['NO RUNNING!', 'SILENCE!', 'I must not\ntalk in class', 'BEHAVE!']);
      add({ ...p, tall: 1.1, draw: (sx, sy) => blit(sprite(`chalk${text}`, 0.6, 1.3, 0.3, (g, s) => A.chalkboard(g, s, text)), sx, sy) });
    } else if (c === 'W') {
      const sw = { ...p, ph: r() * 6 };
      G.swings.push(sw);
      add({ ...p, tall: 1.5, draw: (sx, sy) => {
        blit(sprite('swingB', 1.0, 1.8, 0.6, (g, s) => A.swingFrame(g, s, true)), sx, sy);
        ctx.save(); ctx.translate(sx, sy); A.swingSeat(ctx, S, Math.sin(G.time * 1.3 + sw.ph) * 0.7); ctx.restore();
        blit(sprite('swingF', 1.0, 1.8, 0.6, (g, s) => A.swingFrame(g, s, false)), sx, sy);
      } });
    } else if (c === 'J') {
      const j = { ...p, tile: [x, z], used: false, fly: null, twirl: 0 };
      G.jugs.push(j);
      add({ ...p, tall: 0.5, draw: (sx, sy) => {
        blit(sprite('table', 0.6, 0.8, 0.4, (g, s) => A.table(g, s)), sx, sy);
        if (!j.used) { ctx.save(); ctx.translate(sx, sy - 0.45 * S - Math.sin(j.twirl * Math.PI) * 0.6 * S); ctx.rotate(Math.sin(j.twirl * Math.PI * 4) * 0.4); A.jug(ctx, S, G.time); ctx.restore(); }
      } });
    } else if (c === 'X') {
      const cr = { ...p, tile: [x, z], gone: false, lift: 0, spin: 0 };
      G.crates.push(cr);
      add({ ...p, tall: 0.8, draw: (sx, sy) => {
        if (cr.lift >= 1) return;
        ctx.save();
        ctx.globalAlpha = 1 - Math.max(0, cr.lift - 0.5) * 2;
        ctx.translate(sx, sy - cr.lift * cr.lift * 3 * S);
        ctx.rotate(cr.spin);
        blit(sprite(`crate${vseed}`, 0.9, 1.3, 0.6, (g, s) => A.crate(g, s, vseed)), 0, 0);
        ctx.restore();
      } });
    } else if (c === 'H') {
      const b = { ...p, tile: [x, z], open: 0 };
      G.baskets.push(b);
      add({ ...p, tall: 1.0, draw: (sx, sy) => {
        ctx.save(); ctx.translate(sx, sy);
        // a soft green ring on the floor marks a hiding place
        if (G.hideB !== b) {
          ctx.globalAlpha = 0.25 + Math.sin(G.time * 3) * 0.1;
          ctx.strokeStyle = '#7cff9a'; ctx.lineWidth = Math.max(2, S * 0.05);
          ctx.beginPath(); ctx.ellipse(0, 0, S * 0.62, S * 0.31, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = 1;
        }
        A.basket(ctx, S, b.open, G.hideB === b, G.time);
        ctx.restore();
      } });
    } else if (c === 'B') {
      const k = G.books.length;
      const b = { ...p, tile: [x, z], got: false, gotT: 0, ph: r() * 6, color: BOOK_COLOURS[k % BOOK_COLOURS.length] };
      G.books.push(b);
      add({ ...p, tall: 0, draw: (sx, sy) => {
        if (b.got && G.time - b.gotT > 0.5) return;
        const lift = b.got ? (G.time - b.gotT) * 3 : 0;
        const y = 0.45 + Math.sin(G.time * 2 + b.ph) * 0.1 + lift;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(sx, sy, S * 0.25, S * 0.12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.translate(sx, sy - y * S);
        ctx.scale(1 + lift * 0.5, 1 + lift * 0.5);
        if (b.got) ctx.globalAlpha = 1 - (G.time - b.gotT) * 2;
        blit(sprite(`book${b.color}`, 0.4, 0.35, 0.35, (g, s) => A.book(g, s, b.color)), 0, 0);
        ctx.restore();
      } });
    } else if (c === 'C' || c === 'M') {
      const off = DIRS.find(([dx, dz]) => blocked(x + dx, z + dz)) || [0, -1];
      const pk = { x: p.x + off[0] * 0.3, z: p.z + off[1] * 0.3, tile: [x, z], lit: c === 'M', seed: Math.floor(r() * 1e6) };
      G.checkpoints.push(pk);
      if (c === 'M') { G.cpTile = [x, z]; G.cp = pk; M.x = p.x; M.z = p.z; }
      add({ x: pk.x, z: pk.z, tall: 0, draw: (sx, sy) => { ctx.save(); ctx.translate(sx, sy); A.pumpkin(ctx, S, 1.25, pk.lit, G.time, pk.seed); ctx.restore(); } });
    } else if (/[a-h]/.test(c)) {
      G.waypoints[c.charCodeAt(0) - 97] = [x, z];
    }
    if (c === 'T') { T.x = p.x; T.z = p.z; T.start = [x, z]; }
  }));
  G.waypoints = G.waypoints.filter(Boolean);

  // Halloween decorations that don't get in the way: little pumpkins in corners, and outside, toadstools and graves
  G.grid.forEach((row, z) => row.forEach((c, x) => {
    if (c !== '.' || r() > (out ? 0.12 : 0.06)) return;
    const wall = DIRS.find(([dx, dz]) => wallish(x + dx, z + dz));
    if (!wall) return;
    const px = x + 0.5 + wall[0] * 0.36 + (wall[0] ? 0 : (r() - 0.5) * 0.5), pz = z + 0.5 + wall[1] * 0.36 + (wall[1] ? 0 : (r() - 0.5) * 0.5);
    const kind = out ? pick(['toad', 'toad', 'grave', 'pumpkin']) : 'pumpkin';
    const sd = Math.floor(r() * 1e6), sz = 0.7 + r() * 0.3;
    if (kind === 'pumpkin') add({ x: px, z: pz, tall: 0, draw: (sx, sy) => { ctx.save(); ctx.translate(sx, sy); A.pumpkin(ctx, S, sz, true, G.time, sd); ctx.restore(); } });
    else add({ x: px, z: pz, tall: 0, draw: (sx, sy) => blit(sprite(`${kind}${sd % 6}`, 0.5, 0.9, 0.2, (g, s) => (kind === 'toad' ? A.toadstool(g, s, sd % 6 + 1) : A.gravestone(g, s, sd % 6 + 1))), sx, sy) });
  }));
  if (out) {
    // dead trees beyond the railings
    for (let k = 0; k < 30; k++) {
      const side = k % 4, u = r();
      const x = side === 0 ? -1.5 - r() * 3 : side === 1 ? W + 1 + r() * 3 : u * W;
      const z = side === 2 ? -1.5 - r() * 3 : side === 3 ? H + 1 + r() * 3 : u * H;
      const sd = k % 6;
      add({ x, z, tall: 0, draw: (sx, sy) => blit(sprite(`tree${sd}`, 1.6, 2.6, 0.2, (g, s) => A.deadTree(g, s, sd + 11)), sx, sy) });
    }
  }

  // the characters
  add({ get x() { return M.x; }, get z() { return M.z; }, get d() { return M.x + M.z; }, tall: 0, chr: 'M', draw: drawMatilda });
  add({ get x() { return T.x; }, get z() { return T.z; }, get d() { return T.x + T.z; }, tall: 0, chr: 'T', draw: drawTrunchbull });
  M.dir = 'front'; M.flip = false; M.visible = true; M.hopT = 0;
  resetTrunchbull(true);
  const [cx, cy] = [(M.x - M.z) * S, ((M.x + M.z) * S) / 2];
  cam.x = cx; cam.y = cy;
  G.wisp = { x: M.x, z: M.z, y: 1.2 };
  updateHud();
}
function resetTrunchbull(start) {
  Object.assign(T, { state: 'patrol', path: [], stun: 0, red: 0, lost: 0, searchT: 0 });
  if (start) {
    T.wp = 0;
    const c = centre(...T.start);
    T.x = c.x; T.z = c.z;
  } else {
    // send her to the patrol point furthest from where Matilda is now
    let best = 0, bd = -1;
    G.waypoints.forEach((w, k) => { const d = dist(centre(...w), M); if (d > bd) { bd = d; best = k; } });
    T.wp = best;
    const c = centre(...G.waypoints[best]);
    T.x = c.x; T.z = c.z;
  }
}

// ---------------------------------------------------------------------------
// Drawing the characters
// ---------------------------------------------------------------------------
function shadow(sx, sy, w) {
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(sx, sy, w * S, w * S * 0.5, 0, 0, Math.PI * 2); ctx.fill();
}
function drawMatilda(sx, sy) {
  if (!M.visible || G.hidden) return;
  let hop = 0;
  if (M.hopT > 0) {
    // hopping out of a basket
    const k = M.hopT / 0.4;
    const [hx, hy] = scr(M.hopFrom.x, M.hopFrom.z);
    sx += (hx - sx) * k; sy += (hy - sy) * k;
    hop = Math.sin((1 - k) * Math.PI) * 0.6 + k * 0.5;
  }
  if (G.grace > 0 && Math.floor(G.time * 8) % 2 === 0) return;
  shadow(sx, sy, 0.26);
  ctx.save();
  ctx.translate(sx, sy - hop * S);
  CH.drawMatilda(ctx, S, { dir: M.dir, flip: M.flip, phase: M.phase, speed: clamp(M.speed / RUN, 0, 1), power: clamp(M.glow, 0, 1), t: G.time });
  ctx.restore();
}
function drawTrunchbull(sx, sy) {
  shadow(sx, sy, 0.42);
  ctx.save();
  ctx.translate(sx, sy);
  CH.drawTrunchbull(ctx, S, { dir: T.dir, flip: T.flip, phase: T.phase, speed: clamp(T.speed / 1.4, 0, 1), reach: T.state === 'chase' ? 1 : 0, red: T.red, stunned: T.state === 'stunned', t: G.time });
  ctx.restore();
  if (T.state === 'stunned') {
    // dizzy stars round her head
    for (let k = 0; k < 4; k++) {
      const a = G.time * 4 + (k * Math.PI) / 2;
      star(sx + Math.cos(a) * S * 0.45, sy - (T_HEAD + 0.12) * S + Math.sin(a) * S * 0.15, S * 0.09, '#ffe14d');
    }
  }
}
function star(x, y, rr, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, q = k % 2 ? rr * 0.45 : rr; ctx.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
  ctx.fill();
}
// which way a walker faces on screen, from the way it's moving in the world
function facing(o, vx, vz) {
  const dx = vx - vz, dy = vx + vz;
  if (Math.hypot(dx, dy) < 1e-3) return;
  o.dir = dy > -0.25 * Math.abs(dx) ? 'front' : 'back';
  if (Math.abs(dx) > 0.05) o.flip = dx < 0;
}

// ---------------------------------------------------------------------------
// Input: a joystick on the left, POWER on the right, keys on a computer
// ---------------------------------------------------------------------------
const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
const joyBase = document.getElementById('joyBase'), joyKnob = document.getElementById('joyKnob');
const keys = new Set();
function joyRadius() { return Math.min(70, ch * 0.17); }
canvas.addEventListener('pointerdown', (e) => {
  initAudio();
  if (!G.playing || G.paused) return;
  if (e.clientX > window.innerWidth * 0.55 || joy.id !== null) return;
  e.preventDefault();
  joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.x = joy.y = 0;
  canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
  showJoy(true);
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== joy.id) return;
  const rr = joyRadius();
  let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
  const d = Math.hypot(dx, dy);
  if (d > rr) {
    // drag the joystick along if the thumb wanders off it
    joy.ox += (dx / d) * (d - rr); joy.oy += (dy / d) * (d - rr);
    dx = e.clientX - joy.ox; dy = e.clientY - joy.oy;
  }
  joy.x = dx / rr; joy.y = -dy / rr;
  showJoy(true);
});
const endJoy = (e) => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; showJoy(false); };
canvas.addEventListener('pointerup', endJoy);
canvas.addEventListener('pointercancel', endJoy);
function showJoy(active) {
  const rr = joyRadius();
  if (active) {
    joyBase.style.transform = `translate(${joy.ox}px, ${joy.oy}px) translate(-50%, -50%)`;
    joyKnob.style.transform = `translate(${joy.ox + joy.x * rr}px, ${joy.oy - joy.y * rr}px) translate(-50%, -50%)`;
    joyBase.classList.add('active'); joyKnob.classList.add('active');
  } else {
    // rest in the bottom-left corner as a reminder of where to press
    const x = Math.max(rr + 26, window.innerWidth * 0.14), y = window.innerHeight - rr - 30;
    joyBase.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    joyKnob.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    joyBase.classList.remove('active'); joyKnob.classList.remove('active');
  }
}
window.addEventListener('keydown', (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key === ' ' && G.playing) { e.preventDefault(); if (G.hidden) leaveBasket(); else usePower(); }
  if ((e.key === 'Enter' || e.key.toLowerCase() === 'e') && G.playing && G.hidden) leaveBasket();
  if (e.key === 'Escape' && G.playing) setPaused(!G.paused);
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
// the stick (or keys) as a direction on screen: x right, y up
function inputVector() {
  let x = joy.x, y = joy.y;
  if (keys.has('arrowup') || keys.has('w')) y += 1;
  if (keys.has('arrowdown') || keys.has('s')) y -= 1;
  if (keys.has('arrowleft') || keys.has('a')) x -= 1;
  if (keys.has('arrowright') || keys.has('d')) x += 1;
  const m = Math.hypot(x, y);
  if (m > 1) { x /= m; y /= m; }
  return { x, y, m: Math.min(1, m) };
}
// turn a direction on screen into one in the world, so pushing up always walks up the screen
function screenToWorld(jx, jy) {
  const wx = jx - 2 * jy, wz = -2 * jy - jx, l = Math.hypot(wx, wz) || 1;
  return [wx / l, wz / l];
}
const powerBtn = document.getElementById('powerBtn');
powerBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); initAudio(); if (G.playing && !G.paused) usePower(); });
const outBtn = document.getElementById('outBtn');
outBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); initAudio(); if (G.playing && !G.paused) leaveBasket(); });

// ---------------------------------------------------------------------------
// Matilda's power
// ---------------------------------------------------------------------------
const orbs = [];
function magicStream(from, to, color = '#c084ff', n = 14) {
  for (let k = 0; k < n; k++) orbs.push({ from: { ...from }, to: { ...to }, t0: G.time + k * 0.025, dur: 0.45, wob: rand(0, 6), amp: rand(0.2, 0.7), color, size: rand(0.08, 0.16) });
}
function usePower() {
  if (G.frozen > 0 || G.done) return;
  if (G.hidden) { leaveBasket(); return; }
  if (G.power > 0) { play('fizzle'); bump(powerBtn); return; }
  const eye = { x: M.x, z: M.z, y: 1.0 };
  M.glow = 1.2;
  if (T.state !== 'stunned' && dist(T, M) < POWER_RANGE && lineOfSight(M, T)) {
    // the nearest jug of water flies at her, or a stream of magic if there isn't one
    play('whoosh');
    const head = { x: T.x, z: T.z, y: T_HEAD * 0.85 };
    const jug = G.jugs.filter((j) => !j.used).map((j) => ({ j, d: dist(j, T) })).sort((a, b) => a.d - b.d)[0];
    if (jug && jug.d < 4.5) {
      jug.j.used = true;
      flyers.push({ from: { x: jug.j.x, z: jug.j.z, y: 0.45 }, to: head, t0: G.time, dur: 0.7, kind: 'jug' });
      later(0.7, () => { play('splash2'); burst(head, 18, ['#9fd8ff', '#ffffff', '#5fb4ff'], 2); });
    }
    magicStream(eye, head);
    later(0.45, stunTrunchbull);
    G.power = POWER_COOLDOWN;
    return;
  }
  const crate = G.crates.filter((c) => !c.gone).map((c) => ({ c, d: dist(c, M) })).sort((a, b) => a.d - b.d)[0];
  if (crate && crate.d < CRATE_RANGE) {
    play('whoosh');
    const c = crate.c;
    c.gone = true;
    magicStream(eye, { x: c.x, z: c.z, y: 0.5 });
    const rz = (Math.random() - 0.5) * 1.2;
    tween(1.6, (u) => { c.lift = u; c.spin = rz * u; }, () => { c.lift = 1; play('pop'); });
    G.grid[c.tile[1]][c.tile[0]] = '.';
    G.power = 1.5;
    say('M', 'Whoosh!');
    return;
  }
  const jug = G.jugs.filter((j) => !j.used).map((j) => ({ j, d: dist(j, M) })).sort((a, b) => a.d - b.d)[0];
  if (jug && jug.d < 2.8) {
    play('whoosh');
    magicStream(eye, { x: jug.j.x, z: jug.j.z, y: 0.6 });
    tween(1.6, (u) => { jug.j.twirl = u; }, () => { jug.j.twirl = 0; });
    G.power = 1.5;
    return;
  }
  // nothing to use it on: a little sparkle
  play('fizzle');
  const [fx, fz] = screenToWorld(M.flip ? -1 : 1, M.dir === 'back' ? 1 : -1);
  magicStream(eye, { x: M.x + fx, z: M.z + fz, y: 1.2 }, '#c084ff', 8);
  G.power = 0.8;
}
function stunTrunchbull() {
  T.state = 'stunned'; T.stun = STUN_TIME; T.red = 0;
  play('dizzy');
  say('T', pick(LINES.stunned));
  burst({ x: T.x, z: T.z, y: T_HEAD }, 14, ['#ffe14d', '#c084ff', '#ffffff']);
}
function bump(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

// ---------------------------------------------------------------------------
// Effects: tweens, sparks, flying things, speech bubbles
// ---------------------------------------------------------------------------
const tweens = [];
function tween(dur, fn, done) { tweens.push({ t0: G.time, dur, fn, done }); }
// run something after a delay in game time, so pausing the game pauses it too
function later(sec, fn) { tween(sec, () => {}, fn); }
const sparks = [];
function burst(pos, n, colors, speed = 1.6) {
  for (let k = 0; k < n; k++) {
    const a = rand(0, Math.PI * 2), sp = rand(speed * 0.4, speed);
    sparks.push({ x: pos.x, z: pos.z, y: pos.y, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: rand(1, 3), t0: G.time, life: rand(0.6, 1.1), color: pick(colors) });
  }
}
const flyers = [];
const bubbleLayer = document.getElementById('bubbles');
const bubbles = [];
function say(who, text, life = 2) {
  const el = document.createElement('div');
  el.className = 'bubble' + (who === 'T' ? ' trunch' : '');
  el.textContent = text;
  bubbleLayer.appendChild(el);
  bubbles.push({ el, who, t0: G.time, life });
}

// ---------------------------------------------------------------------------
// HUD and messages
// ---------------------------------------------------------------------------
const hudBooks = document.getElementById('books');
const banner = document.getElementById('banner');
const danger = document.getElementById('danger');
let bannerQ = [], bannerT = 0;
function showBanner(text, dur = 3.2, urgent = false) {
  if (urgent) { bannerQ = []; bannerT = 0; }
  bannerQ.push({ text, dur });
}
function tip(key, text, urgent) { if (!G.lv.tips || G.tipsShown.has(key)) return; G.tipsShown.add(key); showBanner(text, 4, urgent); }
const BOOK_SVG = '<svg viewBox="0 0 24 24"><path d="M4 4.5 C7 3.5 10 3.5 12 5 C14 3.5 17 3.5 20 4.5 V19 C17 18 14 18 12 19.5 C10 18 7 18 4 19 Z"/><path d="M12 5 V19.5" fill="none" stroke-width="1.4"/></svg>';
function updateHud() {
  hudBooks.innerHTML = G.books.map((b) => `<span class="book ${b.got ? 'got' : ''}">${BOOK_SVG}</span>`).join('');
  document.getElementById('levelName').textContent = `${G.level + 1}. ${G.lv.name}`;
}

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------
const screens = ['start', 'story', 'complete', 'win', 'pause'].reduce((o, id) => ((o[id] = document.getElementById(id)), o), {});
function show(id) { for (const k in screens) screens[k].classList.toggle('show', k === id); document.body.classList.toggle('playing', !id); }
const PROGRESS = 'ellie-chase-iso-level';
function loadProgress() { try { return +localStorage.getItem(PROGRESS) || 0; } catch (_) { return 0; } }
function saveProgress(n) { try { localStorage.setItem(PROGRESS, String(Math.max(n, loadProgress()))); } catch (_) { /* private mode */ } }
function startLevel(i, seed) {
  buildLevel(i, seed);
  document.getElementById('storyTitle').textContent = `Level ${i + 1}: ${LEVELS[i].name}`;
  document.getElementById('storyText').textContent = LEVELS[i].intro;
  show('story');
  G.playing = false;
}
function beginPlay() {
  show(null);
  G.playing = true; G.paused = false; G.frozen = 0;
  startDrone();
  showBanner(`Find ${G.books.length} books!`, 2.6);
  if (G.lv.tips) tip('move', TOUCH ? 'Press and drag on the left to walk. Follow the fairy light!' : 'Use the arrow keys to walk. Follow the fairy light!');
}
function levelComplete() {
  G.done = true; G.playing = false;
  play('win');
  saveProgress(G.level + 1);
  later(0.9, () => show(G.level === LEVELS.length - 1 ? 'win' : 'complete'));
}
function caught() {
  G.frozen = 1.8;
  play('caught');
  say('T', pick(LINES.caught), 1.6);
  document.getElementById('caught').classList.add('show');
  later(1.5, () => {
    document.getElementById('caught').classList.remove('show');
    const c = centre(...G.cpTile);
    M.x = c.x; M.z = c.z;
    resetTrunchbull(false);
    G.grace = GRACE;
  });
}
function setPaused(p) { G.paused = p; show(p ? 'pause' : null); }

document.getElementById('playBtn').addEventListener('click', () => { initAudio(); goFullscreen(); startLevel(0); });
document.getElementById('goBtn').addEventListener('click', () => { initAudio(); beginPlay(); });
document.getElementById('nextBtn').addEventListener('click', () => startLevel(G.level + 1));
document.getElementById('againBtn').addEventListener('click', () => { show('start'); renderLevelButtons(); });
document.getElementById('pauseBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (G.playing) setPaused(true); });
document.getElementById('resumeBtn').addEventListener('click', () => setPaused(false));
document.getElementById('restartBtn').addEventListener('click', () => { G.playing = false; startLevel(G.level); });
document.getElementById('menuBtn').addEventListener('click', () => { G.playing = false; show('start'); renderLevelButtons(); });
let muted = false;
for (const id of ['muteBtn', 'muteBtn2']) {
  document.getElementById(id).addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    muted = !muted; setMuted(muted);
    document.querySelectorAll('.mute').forEach((b) => b.classList.toggle('off', muted));
  });
}
function renderLevelButtons() {
  const got = loadProgress(), box = document.getElementById('levels');
  box.innerHTML = '';
  if (got < 1) return;
  LEVELS.forEach((lv, i) => {
    const b = document.createElement('button');
    b.className = 'lvl'; b.textContent = String(i + 1);
    b.disabled = i > got;
    b.setAttribute('aria-label', `Level ${i + 1}: ${lv.name}`);
    b.addEventListener('click', () => { initAudio(); goFullscreen(); startLevel(i); });
    box.appendChild(b);
  });
}
function goFullscreen() {
  if (!TOUCH) return;
  const el = document.documentElement, req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (req && !document.fullscreenElement) {
    try {
      const p = req.call(el);
      if (p && p.then) p.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {});
    } catch (_) { /* not allowed */ }
  }
}
function checkOrientation() { document.body.classList.toggle('portrait', TOUCH && window.innerHeight > window.innerWidth); }
window.addEventListener('resize', resize);
window.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden && G.playing && !G.paused) setPaused(true); });

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------
function update(dt) {
  if (G.paused) return;
  G.time += dt;
  if (G.playing) {
    updateMatilda(dt);
    updateTrunchbull(dt);
    updateWorld(dt);
  }
  updateEffects(dt);
}

function updateMatilda(dt) {
  if (G.grace > 0) G.grace -= dt;
  if (G.power > 0) G.power = Math.max(0, G.power - dt);
  if (G.hideCool > 0) G.hideCool -= dt;
  if (M.hopT > 0) M.hopT = Math.max(0, M.hopT - dt);
  let inp = G.frozen > 0 ? { x: 0, y: 0, m: 0 } : inputVector();
  if (G.frozen > 0) G.frozen -= dt;
  if (G.hidden) {
    // inside a basket the stick does nothing, but nudges the GET OUT button as a reminder
    if (inp.m > 0.6 && (!G.outNag || G.time - G.outNag > 1.6)) { G.outNag = G.time; bump(outBtn); }
    inp = { x: 0, y: 0, m: 0 };
  }
  const sp = RUN * inp.m;
  if (inp.m > 0.08) {
    const [wx, wz] = screenToWorld(inp.x, inp.y);
    M.x += wx * sp * dt; M.z += wz * sp * dt;
    facing(M, wx, wz);
  }
  if (!G.hidden) collide(M, M_R, false);
  M.speed += (sp - M.speed) * Math.min(1, dt * 10);
  M.phase += dt * (3 + M.speed * 6);
  if (M.speed > 0.4) { M.stepAcc += dt * M.speed; if (M.stepAcc > 0.45) { M.stepAcc = 0; play('step'); } }
  M.glow = Math.max(0, M.glow - dt);

  const [tx, tz] = tileOf(M.x, M.z);
  // walk into a basket to hide in it
  if (!G.hidden && cell(tx, tz) === 'H' && G.hideCool <= 0 && G.frozen <= 0) {
    const b = G.baskets.find((k) => k.tile[0] === tx && k.tile[1] === tz);
    if (b) enterBasket(b);
  }
  for (const b of G.baskets) {
    const near = !G.hidden && dist(b, M) < 1.1 && G.time - G.outT > 1.2;
    // the lid lifts as Matilda comes close, and stays open a crack while she peeks out
    b.open += ((near ? 1 : G.hideB === b ? 0.5 : 0) - b.open) * Math.min(1, dt * 8);
    if (!G.hidden && dist(b, M) < 2.5) tip('hide', 'Baskets are hiding places. Walk into one to hide!');
  }
  if (G.hidden) { M.x = G.hideB.x; M.z = G.hideB.z; }
  // books
  for (const b of G.books) {
    if (b.got || dist(b, M) > 0.5) continue;
    b.got = true; b.gotT = G.time;
    play('chime');
    burst({ x: b.x, z: b.z, y: 0.5 }, 20, ['#ffe14d', '#ffffff', '#c084ff']);
    G.booksGot++;
    updateHud();
    const left = G.books.length - G.booksGot;
    if (left > 0) showBanner(left === 1 ? 'Just 1 more book!' : `${left} more books to find!`, 2.2);
    else unlockExit();
  }
  // checkpoints
  for (const cp of G.checkpoints) {
    if (dist(cp, M) < 0.75 && G.cp !== cp) {
      if (!cp.lit) { play('lit'); burst({ x: cp.x, z: cp.z, y: 0.4 }, 12, ['#ff9a2a', '#ffe14d']); showBanner('Checkpoint! The pumpkin will remember you.', 2.4); }
      cp.lit = true;
      G.cp = cp; G.cpTile = cp.tile;
    }
  }
  // crates nearby
  for (const c of G.crates) if (!c.gone && dist(c, M) < CRATE_RANGE) tip('crate', 'Crates in the way! Tap POWER to float them away!');
  // the way out
  if (G.exit && tx === G.exit.front[0] && tz === G.exit.front[1]) {
    if (G.unlocked) {
      levelComplete();
      tween(1, (k) => { G.exit.open = k; });
      play('door');
    } else if (!G.exitNag || G.time - G.exitNag > 4) {
      G.exitNag = G.time;
      showBanner(`The door is locked! Find all ${G.books.length} books first.`, 2.6);
    }
  }
}

function enterBasket(b) {
  G.hidden = true; G.hideB = b;
  M.speed = 0;
  play('creak');
  document.body.classList.add('hiding');
  const how = TOUCH ? "Tap GET OUT when it's safe." : 'Press Space to get out.';
  showBanner(G.hideCount++ < 3 ? `Shhh... you're hiding! ${how}` : 'Shhh... hiding!', 3, true);
}
function leaveBasket() {
  if (!G.hidden || G.frozen > 0) return;
  const b = G.hideB, [tx, tz] = b.tile;
  // climb out the way the stick is pushed, or the way she was facing
  const inp = inputVector();
  const [vx, vz] = inp.m > 0.2 ? screenToWorld(inp.x, inp.y) : screenToWorld(M.flip ? -1 : 1, M.dir === 'back' ? 1 : -1);
  let best = null, bd = -9;
  for (const [dx, dz] of DIRS) {
    if (blocked(tx + dx, tz + dz) || cell(tx + dx, tz + dz) === 'H') continue;
    const d = dx * vx + dz * vz;
    if (d > bd) { bd = d; best = [dx, dz]; }
  }
  if (!best) return;
  G.hidden = false; G.hideB = null; G.hideCool = 0.6; G.outT = G.time; G.grace = Math.max(G.grace, 0.6);
  document.body.classList.remove('hiding');
  bannerQ = []; bannerT = 0;
  M.hopFrom = { x: b.x, z: b.z };
  M.x = tx + 0.5 + best[0] * 0.78; M.z = tz + 0.5 + best[1] * 0.78;
  collide(M, M_R, false);
  facing(M, best[0], best[1]);
  M.hopT = 0.4;
  play('pop');
}

function unlockExit() {
  G.unlocked = true;
  play('unlock');
  if (G.lv.finale) {
    G.angry = true;
    showBanner('All the books! Now RUN to the door!', 3, true);
    T.state = 'chase'; T.lost = 0;
    play('spot');
    say('T', LINES.angry[0], 2.6);
  } else showBanner('All the books! Now find the green door!', 3, true);
}

function updateTrunchbull(dt) {
  const dM = dist(T, M);
  // can she see Matilda?
  let sees = false;
  if (!G.hidden && G.grace <= 0 && G.frozen <= 0 && dM < SEE_DIST && lineOfSight(T, M)) {
    const toM = Math.atan2(M.x - T.x, M.z - T.z), lookA = Math.atan2(T.look.x, T.look.z);
    let diff = Math.abs(toM - lookA) % (Math.PI * 2);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    sees = diff < 1.3 || dM < 1.5 || T.state === 'chase';
  }
  const speedChase = G.lv.trunchSpeed / 3 + (G.angry ? 0.17 : 0);
  let target = null, speed = 0;

  if (T.state === 'stunned') {
    T.stun -= dt;
    if (T.stun <= 0) { T.state = 'search'; T.searchT = 2.5; T.lastSeen = { x: T.x, z: T.z }; }
  } else if (T.state === 'patrol') {
    if (sees) startChase();
    else {
      const wp = G.waypoints[T.wp];
      if (wp) {
        target = followPath(wp, dt);
        speed = 0.65;
        if (dist(centre(...wp), T) < 0.2) T.wp = (T.wp + 1) % G.waypoints.length;
      }
    }
  } else if (T.state === 'chase') {
    if (sees || (G.angry && !G.hidden)) { T.lost = 0; T.lastSeen = { x: M.x, z: M.z }; }
    else T.lost += dt;
    if (T.lost > 0.6) {
      T.state = 'search'; T.searchT = 3; T.sayT = -9;
    } else {
      speed = speedChase;
      target = dM < 1.7 && lineOfSight(T, M) ? { x: M.x, z: M.z } : followPath(tileOf(M.x, M.z), dt);
    }
    if (dM < CATCH_R && !G.hidden && G.grace <= 0 && G.frozen <= 0) caught();
  } else if (T.state === 'search') {
    if (sees) startChase();
    else if (dist(T.lastSeen, T) > 0.35) { target = followPath(tileOf(T.lastSeen.x, T.lastSeen.z), dt); speed = 0.9; }
    else {
      T.searchT -= dt;
      // look about
      const a = Math.sin(G.time * 1.5) * 2;
      T.look = { x: Math.sin(a), z: Math.cos(a) };
      facing(T, T.look.x, T.look.z);
      if (T.sayT < 0) { T.sayT = 1; say('T', pick(LINES.search), 2.2); }
      if (T.searchT <= 0) {
        say('T', pick(LINES.giveUp), 2);
        T.state = 'patrol';
        // carry on from the nearest patrol point
        let best = 0, bd = Infinity;
        G.waypoints.forEach((w, k) => { const d = dist(centre(...w), T); if (d < bd) { bd = d; best = k; } });
        T.wp = best;
      }
    }
  }
  if (target && speed > 0) {
    const dx = target.x - T.x, dz = target.z - T.z, len = Math.hypot(dx, dz);
    if (len > 0.02) {
      const step = Math.min(len, speed * dt);
      T.x += (dx / len) * step; T.z += (dz / len) * step;
      T.look = { x: dx / len, z: dz / len };
      facing(T, dx, dz);
    }
    collide(T, T_R, true);
  } else speed = 0;
  T.speed += (speed - T.speed) * Math.min(1, dt * 8);
  T.phase += dt * (2 + T.speed * 5);
  if (T.speed > 0.3) {
    T.stepAcc += dt * (2 + T.speed * 5);
    if (T.stepAcc > Math.PI) { T.stepAcc = 0; play('stomp', clamp(1 - dM / 9, 0, 1)); if (dM < 2.4) cam.shake = Math.max(cam.shake, 5 * (1 - dM / 2.4)); }
  }
  // red eyes when she's after you
  T.red += ((T.state === 'chase' ? 1 : 0) - T.red) * Math.min(1, dt * 4);

  // fear: heartbeat and drone
  const fear = T.state === 'chase' ? clamp(1.2 - dM / 5.5, 0.3, 1) : 0;
  setDrone(fear);
  if (fear > 0) {
    G.heart = (G.heart || 0) - dt;
    if (G.heart <= 0) { G.heart = 0.9 - fear * 0.45; play('heartbeat', 0.6 + fear * 0.6); }
  }
  danger.classList.toggle('on', T.state === 'chase');
  danger.classList.toggle('hidden', G.hidden);
  danger.classList.toggle('stunned', T.state === 'stunned');
}
function startChase() {
  T.state = 'chase'; T.lost = 0;
  play('spot');
  say('T', pick(LINES.spot), 1.8);
  tip('spotted', "She's seen you! Run away, hide in a basket, or tap POWER!", true);
}
function followPath(goal, dt) {
  T.pathT -= dt;
  const from = tileOf(T.x, T.z);
  if (T.pathT <= 0 || !T.path.length || T.goalKey !== goal.join(',')) {
    T.path = findPath(from, goal, true) || [];
    T.pathT = 0.35; T.goalKey = goal.join(',');
    if (T.path.length && T.path[0][0] === from[0] && T.path[0][1] === from[1]) T.path.shift();
  }
  while (T.path.length && dist(centre(...T.path[0]), T) < 0.18) T.path.shift();
  return T.path.length ? centre(...T.path[0]) : centre(...goal);
}

function updateWorld(dt) {
  // lightning and thunder
  G.nextThunder -= dt;
  if (G.nextThunder <= 0) {
    G.nextThunder = rand(14, 26);
    G.flash = 1;
    later(0.5, () => play('thunder'));
  }
  G.flash = Math.max(0, G.flash - dt * 3);
  // the fairy light leads to the next book, or the door
  G.wispT = (G.wispT || 0) - dt;
  if (G.wispT <= 0) {
    G.wispT = 0.4;
    const from = tileOf(M.x, M.z);
    const goals = G.unlocked ? [G.exit.front] : G.books.filter((b) => !b.got).map((b) => b.tile);
    let best = null;
    for (const g of goals) {
      const p = findPathPlayer(from, g);
      if (p && (!best || p.length < best.length)) best = p;
    }
    G.wispGoal = best ? centre(...best[Math.min(best.length - 1, 2)]) : { x: M.x, z: M.z };
  }
  if (G.wispGoal) {
    const t = G.time, k = Math.min(1, dt * 2.2);
    G.wisp.x += (G.wispGoal.x + Math.sin(t * 2.3) * 0.15 - G.wisp.x) * k;
    G.wisp.z += (G.wispGoal.z + Math.cos(t * 1.9) * 0.15 - G.wisp.z) * k;
    G.wisp.y = 1.1 + Math.sin(t * 3.1) * 0.12;
  }
  // bats over the playground
  if (G.lv.outdoor) {
    G.nextBats -= dt;
    if (G.nextBats <= 0) {
      G.nextBats = rand(10, 18);
      const fromLeft = Math.random() < 0.5;
      for (let k = 0; k < 4; k++) G.bats.push({ x: fromLeft ? -60 - k * 40 : cw + 60 + k * 40, y: ch * rand(0.15, 0.45), v: (fromLeft ? 1 : -1) * rand(150, 220), ph: rand(0, 6) });
      later(1.2, () => play('squeak'));
    }
    for (const b of G.bats) { b.x += b.v * dt; b.y += Math.sin(G.time * 3 + b.ph) * 20 * dt; }
    G.bats = G.bats.filter((b) => b.x > -400 && b.x < cw + 400);
  }
}
function findPathPlayer(from, to) {
  // like findPath, but crates count as passable so the light still points at books behind them
  const saved = [];
  for (const c of G.crates) if (!c.gone) { saved.push(c); G.grid[c.tile[1]][c.tile[0]] = '.'; }
  const p = findPath(from, to, false);
  for (const c of saved) G.grid[c.tile[1]][c.tile[0]] = 'X';
  return p;
}

function updateEffects(dt) {
  const t = G.time;
  for (let k = tweens.length - 1; k >= 0; k--) {
    const tw = tweens[k], u = Math.min(1, (t - tw.t0) / tw.dur);
    tw.fn(u);
    if (u >= 1) { tweens.splice(k, 1); tw.done && tw.done(); }
  }
  for (let k = sparks.length - 1; k >= 0; k--) {
    const p = sparks[k];
    if (t - p.t0 > p.life) { sparks.splice(k, 1); continue; }
    p.vy -= 6 * dt;
    p.x += p.vx * dt; p.z += p.vz * dt; p.y = Math.max(0, p.y + p.vy * dt);
  }
  for (let k = orbs.length - 1; k >= 0; k--) if (t - orbs[k].t0 > orbs[k].dur) orbs.splice(k, 1);
  for (let k = flyers.length - 1; k >= 0; k--) if (t - flyers[k].t0 > flyers[k].dur) flyers.splice(k, 1);
  // power button charge ring
  const charge = G.power > 0 ? 1 - G.power / POWER_COOLDOWN : 1;
  powerBtn.style.setProperty('--p', String(clamp(charge, 0, 1)));
  powerBtn.classList.toggle('ready', G.power <= 0);
  // banners
  bannerT -= dt;
  if (bannerT <= 0) {
    if (bannerQ.length) { const b = bannerQ.shift(); banner.textContent = b.text; banner.classList.add('show'); bannerT = b.dur; }
    else banner.classList.remove('show');
  }
}

// ---------------------------------------------------------------------------
// Drawing a frame
// ---------------------------------------------------------------------------
function render(dt = 0) {
  // the camera glides after Matilda
  const tx = (M.x - M.z) * S, ty = ((M.x + M.z) * S) / 2 - 0.6 * S;
  const k = Math.min(1, dt * 6);
  cam.x += (tx - cam.x) * (dt ? k : 1); cam.y += (ty - cam.y) * (dt ? k : 1);
  cam.shake = Math.max(0, cam.shake - dt * 12);
  cam.ox = cw / 2 - cam.x + rand(-1, 1) * cam.shake;
  cam.oy = ch * 0.55 - cam.y + rand(-1, 1) * cam.shake;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  const out = G.lv.outdoor;
  ctx.fillStyle = out ? '#0d0a1c' : '#07040c';
  ctx.fillRect(0, 0, cw, ch);
  if (out) {
    // a big moon low in the sky
    const mg = ctx.createRadialGradient(cw * 0.82, ch * 0.18, 0, cw * 0.82, ch * 0.18, ch * 0.35);
    mg.addColorStop(0, 'rgba(255,250,220,0.35)'); mg.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = mg; ctx.fillRect(0, 0, cw, ch);
  }

  // floors
  const pad = out ? 7 : 0;
  for (let z = -pad; z < G.H + pad; z++) for (let x = -pad; x < G.W + pad; x++) {
    const [sx, sy] = scr(x + 0.5, z + 0.5);
    if (sx < -S * 1.2 || sx > cw + S * 1.2 || sy < -S || sy > ch + S) continue;
    const v = ((x * 73856093) ^ (z * 19349663)) >>> 0;
    blit(sprite(`f${out}${v % 6}`, 1.03, 0.55, 0.55, (g, s) => { g.scale(1.03, 1.03); A.floorTile(g, s, out, (v % 6) + 1); }), sx, sy);
  }

  // everything standing on the floor, back to front
  const vis = [];
  for (const o of G.objs) {
    const [sx, sy] = scr(o.x, o.z);
    if (sx < -S * 3 || sx > cw + S * 3 || sy < -S * 0.8 || sy > ch + S * 3.5) continue;
    vis.push({ o, sx, sy, d: o.d });
  }
  vis.sort((a, b) => a.d - b.d);
  // walls in front of Matilda or Miss Trunchbull fade, so they never vanish behind one
  const [mx, my] = scr(M.x, M.z), [tx2, ty2] = scr(T.x, T.z);
  const people = [{ x: mx, y: my, h: M_HEAD, d: M.x + M.z, w: 0.35 }, { x: tx2, y: ty2, h: T_HEAD, d: T.x + T.z, w: 0.55 }];
  for (const v of vis) {
    let alpha = 1;
    if (v.o.tall > 0) {
      for (const p of people) {
        if (v.d <= p.d + 0.2) continue;
        const top = v.sy - v.o.tall * S - S * 0.5, bot = v.sy + S * 0.5;
        if (Math.abs(v.sx - p.x) < S * (1 + p.w) && p.y > top && p.y - p.h * S < bot) alpha = Math.min(alpha, 0.32);
      }
    }
    ctx.globalAlpha = alpha;
    v.o.draw(v.sx, v.sy);
    ctx.globalAlpha = 1;
  }

  // flying jugs
  for (const f of flyers) {
    const u = clamp((G.time - f.t0) / f.dur, 0, 1);
    const [sx, sy] = scr(f.from.x + (f.to.x - f.from.x) * u, f.from.z + (f.to.z - f.from.z) * u, f.from.y + (f.to.y - f.from.y) * u + Math.sin(u * Math.PI) * 1.2);
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(u * 8); A.jug(ctx, S, G.time); ctx.restore();
  }

  drawLights();

  // glowing things on top of the darkness
  ctx.globalCompositeOperation = 'lighter';
  for (const b of G.books) if (!b.got) { const [sx, sy] = scr(b.x, b.z, 0.5); glow(sx, sy, S * 0.7, '255,220,90', 0.35 + Math.sin(G.time * 3 + b.ph) * 0.1); }
  for (const f of G.flames) { const [sx, sy] = scr(f.x, f.z, f.y); flameAt(sx, sy, f); }
  if (G.exit) { const [sx, sy] = scr(G.exit.front[0] + 0.5 - (G.exit.side === 'right' ? 0.5 : 0), G.exit.front[1] + 0.5 - (G.exit.side === 'left' ? 0.5 : 0), 0.7); glow(sx, sy, S * 1.2, G.unlocked ? '80,255,120' : '255,60,60', 0.35 + Math.sin(G.time * 4) * 0.12); }
  for (const c of G.crates) if (!c.gone && dist(c, M) < CRATE_RANGE) { const [sx, sy] = scr(c.x, c.z, 1.0); glow(sx, sy, S * 0.6, '192,132,255', 0.4 + Math.sin(G.time * 6) * 0.25); }
  if (T.red > 0.05) { const [sx, sy] = scr(T.x, T.z, T_HEAD * 0.8); glow(sx, sy, S * 0.55, '255,30,30', T.red * 0.7); }
  if (M.glow > 0 && !G.hidden) { const [sx, sy] = scr(M.x, M.z, 0.9); glow(sx, sy, S * 0.9, '192,132,255', Math.min(1, M.glow) * 0.6); }
  // the fairy light
  { const [sx, sy] = scr(G.wisp.x, G.wisp.z, G.wisp.y); glow(sx, sy, S * 0.5, '158,240,255', 0.75 + Math.sin(G.time * 9) * 0.15); ctx.fillStyle = '#e8fdff'; ctx.beginPath(); ctx.arc(sx, sy, S * 0.06, 0, Math.PI * 2); ctx.fill(); }
  // magic and sparks
  for (const o of orbs) {
    const u = (G.time - o.t0) / o.dur;
    if (u < 0) continue;
    const [sx, sy] = scr(o.from.x + (o.to.x - o.from.x) * u, o.from.z + (o.to.z - o.from.z) * u, o.from.y + (o.to.y - o.from.y) * u + Math.sin(u * Math.PI) * o.amp + Math.sin(u * 12 + o.wob) * 0.06);
    glow(sx, sy, S * o.size * 2.4, o.color === '#c084ff' ? '192,132,255' : '255,255,255', 0.9 * (1 - u * 0.5));
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const p of sparks) {
    const u = (G.time - p.t0) / p.life;
    const [sx, sy] = scr(p.x, p.z, p.y);
    ctx.globalAlpha = 1 - u;
    star(sx, sy, S * 0.07 * (1 - u * 0.6), p.color);
  }
  ctx.globalAlpha = 1;
  // bats
  for (const b of G.bats) { ctx.save(); ctx.translate(b.x, b.y); A.bat(ctx, S * 0.8, G.time * 18 + b.ph); ctx.restore(); }
  // lightning
  const fl = G.flash > 0.66 || (G.flash > 0.2 && G.flash < 0.4) ? 1 : 0;
  document.getElementById('flash').style.opacity = fl * 0.3;

  // speech bubbles follow whoever is talking
  for (let k = bubbles.length - 1; k >= 0; k--) {
    const b = bubbles[k], u = (G.time - b.t0) / b.life;
    if (u >= 1) { b.el.remove(); bubbles.splice(k, 1); continue; }
    const [sx, sy] = b.who === 'T' ? scr(T.x, T.z, T_HEAD + 0.25) : scr(M.x, M.z, M_HEAD + 0.2);
    b.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%) scale(${Math.min(1, u * 8)})`;
    b.el.style.opacity = u > 0.8 ? (1 - u) * 5 : 1;
  }
}
function glow(x, y, r, rgb, a) {
  if (a <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function flameAt(sx, sy, f) {
  const on = f.flicker ? (Math.sin(G.time * 13 + f.ph) * Math.sin(G.time * 3.1 + f.ph * 2) > -0.6 ? 1 : 0.2) : 1;
  const w = 1 + Math.sin(G.time * 17 + f.ph) * 0.15;
  glow(sx, sy, S * 0.7, '255,170,60', 0.45 * on);
  ctx.fillStyle = `rgba(255,210,90,${0.9 * on})`;
  ctx.beginPath(); ctx.ellipse(sx, sy, S * 0.04, S * 0.09 * w, 0, 0, Math.PI * 2); ctx.fill();
}
// the darkness: a dark layer with soft holes where the lights are
function drawLights() {
  const out = G.lv.outdoor;
  const fl = G.flash > 0.66 || (G.flash > 0.2 && G.flash < 0.4) ? 1 : 0;
  const lw = lightCv.width, lh = lightCv.height;
  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, lw, lh);
  lctx.fillStyle = out ? `rgba(10,6,30,${0.6 - fl * 0.45})` : `rgba(6,2,14,${0.8 - fl * 0.5})`;
  lctx.fillRect(0, 0, lw, lh);
  lctx.globalCompositeOperation = 'destination-out';
  const hole = (x, z, y, r, a) => {
    const [sx, sy] = scr(x, z, y);
    const R = r * S * 1.45 / 2;
    lctx.save();
    lctx.translate(sx / 2, sy / 2);
    lctx.scale(1, 0.62);
    const g = lctx.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.55, `rgba(0,0,0,${a * 0.6})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = g;
    lctx.fillRect(-R, -R, R * 2, R * 2);
    lctx.restore();
  };
  // Matilda's lantern
  hole(M.x, M.z, 0.3, G.hidden ? 1.6 : 3.4, 1);
  for (const f of G.flames) {
    const on = f.flicker ? (Math.sin(G.time * 13 + f.ph) * Math.sin(G.time * 3.1 + f.ph * 2) > -0.6 ? 1 : 0.3) : 1;
    hole(f.x, f.z, 0.2, 2.3 + Math.sin(G.time * 9 + f.ph) * 0.1, 0.85 * on);
  }
  for (const w of G.windows) hole(w.x, w.z, 0, 1.6, 0.55);
  for (const cp of G.checkpoints) if (cp.lit) hole(cp.x, cp.z, 0, 1.7, 0.85);
  for (const b of G.books) if (!b.got) hole(b.x, b.z, 0, 1.2, 0.7);
  if (G.exit) hole(G.exit.front[0] + 0.5, G.exit.front[1] + 0.5, 0, 1.6, 0.7);
  hole(G.wisp.x, G.wisp.z, 0, 1.0, 0.6);
  // a faint glow round Miss Trunchbull so she's never lost in the dark
  hole(T.x, T.z, 0.4, 1.3, 0.45);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(lightCv, 0, 0, canvas.width, canvas.height);
  ctx.restore();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ---------------------------------------------------------------------------
// Start up
// ---------------------------------------------------------------------------
resize();
showJoy(false);
buildLevel(0);
show('start');
renderLevelButtons();
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
document.body.classList.add('ready');

// handy for automated tests
window.__game = { G, M, T, update, render, startLevel, beginPlay, usePower, leaveBasket, joy, keys, findPath, centre, tileOf, LEVELS, stunTrunchbull, caught, screenToWorld };
