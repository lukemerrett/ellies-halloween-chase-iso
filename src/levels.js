// The three levels, drawn as text maps. Each character is one square (one isometric tile).
//
//   #  wall (a hedge outside, brick inside)     .  floor          +  doorway (floor)
//   M  where Matilda starts                       T  where Miss Trunchbull starts
//   a…h  the order Miss Trunchbull patrols in     B  a library book to collect
//   H  a basket to hide in                         C  a pumpkin checkpoint
//   E  the way out (in the outside wall)          X  crates Matilda can float away with her power
//   D  school desk    S  bookshelf    J  table with a water jug    K  chalkboard    W  swing
//   G  iron railings (outside only)

// The hand-drawn maps below are only a fallback: each level is normally generated fresh by generateMap().
export const LEVELS = [
  {
    name: 'The Playground at Midnight',
    intro: 'Matilda left her library books at school! Creep across the dark playground and find all 3. Watch out for Miss Trunchbull!',
    outdoor: true,
    cols: 6, rows: 4, books: 3, baskets: 3, checkpoints: 2, patrol: 4, jugs: 0, rooms: 2, loops: 0.25, wide: 0.6,
    map: [
      'GGGGGGGGGGGGGGGGGGGG',
      'GM..C..#....#.....BG',
      'G......#.##.#.###..G',
      'G.##...#B.#...#....G',
      'G.#H......#.W.#.##.G',
      'G.####.####...#..#.G',
      'G......#..a...b..#.G',
      'G.##.#.#.T.....#...G',
      'G.#..#...d.....#.#.G',
      'G.#.H#.#####.c##.#.G',
      'G##..#.#...C...#.#.G',
      'GB.X##.#.#####.#.#HG',
      'G##....#.......#..CE',
      'GGGGGGGGGGGGGGGGGGGG',
    ],
    trunchSpeed: 3.6,
    tips: true,
  },
  {
    name: 'The Creaky Corridors',
    intro: 'Inside the school it is even darker. Find 5 books in the corridors and classrooms. Hide in a basket if she sees you!',
    outdoor: false,
    cols: 7, rows: 4, books: 5, baskets: 4, checkpoints: 2, patrol: 5, jugs: 2, rooms: 2, loops: 0.35, wide: 0.3,
    map: [
      '######################',
      '#M..C#......#....B...#',
      '#....#.D.D..#.SSSS...#',
      '#.H..+......+........#',
      '###.##.D.D..####+#####',
      '#B....##+####...H#...#',
      '#.....#.....J....X.B.#',
      '#.S...+..T..a....#...#',
      '#.S...#.....b....#####',
      '###+###..K..#..X.....#',
      '#..........c+..#..B..#',
      '#.H.C...#####..#.....#',
      '#.......#B..d..+.H..CE',
      '######################',
    ],
    trunchSpeed: 3.9,
  },
  {
    name: "The Headmistress's Hall",
    intro: "This is Miss Trunchbull's own hall. Find the last 5 books, then race for the door. Use your POWER to stop her!",
    outdoor: false,
    cols: 7, rows: 5, books: 5, baskets: 5, checkpoints: 3, patrol: 6, jugs: 3, rooms: 3, loops: 0.35, wide: 0.35,
    map: [
      '########################',
      '#M...#......SSSS......B#',
      '#..C.+..D.D.......D.D..#',
      '#....#..D.D...a...D.D..#',
      '##+###......J.....H....#',
      '#B..H#.###########.#####',
      '#....+.#....K....#.#B..#',
      '#.SS.#.#..T......#.#...#',
      '#....#.#.b....c..+.##X##',
      '###+##.###+#######.....#',
      '#........C......d...C..#',
      '#.D.D.D.......D.D.D....#',
      '#B....H.......J....#..BE',
      '########################',
    ],
    trunchSpeed: 4.2,
    finale: true,
  },
];

// ---------------------------------------------------------------------------
// Random layouts
// ---------------------------------------------------------------------------
// The board is a grid of 2×2-square "cells" with walls one square thick between them:
//
//   #######
//   #..#..#      cells are joined into a maze (a spanning tree, so everywhere can be reached),
//   #..#..#      then extra gaps make loops to run round, and some 2×2 blocks of cells become rooms.
//   #######
//
// One dead-end cell is sealed with a crate and gets a book, so every level needs the power once.
// Everything else (books, baskets, pumpkins, patrol points, furniture) is spread out at random,
// and each placement is checked so nothing ever blocks the way.

const BLOCK = new Set(['#', 'G', 'D', 'S', 'J', 'K', 'W', 'E', 'X']);
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateMap(spec, seed) {
  for (let k = 0; k < 60; k++) {
    const map = tryGenerate(spec, (seed + k * 7919) >>> 0);
    if (map) return map;
  }
  return spec.map;
}

function tryGenerate(spec, seed) {
  const r = mulberry(seed);
  const ri = (n) => Math.floor(r() * n);
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = ri(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const { cols, rows } = spec;
  const W = cols * 3 + 1, H = rows * 3 + 1;
  const g = Array.from({ length: H }, () => Array(W).fill('#'));
  const cx = (i) => 1 + 3 * i, cz = (j) => 1 + 3 * j;
  const cid = (i, j) => j * cols + i;
  const cellTiles = (c) => { const i = c % cols, j = Math.floor(c / cols); return [[cx(i), cz(j)], [cx(i) + 1, cz(j)], [cx(i), cz(j) + 1], [cx(i) + 1, cz(j) + 1]]; };
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) for (const [x, z] of cellTiles(cid(i, j))) g[z][x] = '.';

  // the wall squares between two neighbouring cells
  const between = (a, b) => {
    const [lo, hi] = a < b ? [a, b] : [b, a];
    const i = lo % cols, j = Math.floor(lo / cols);
    return hi === lo + 1 ? [[cx(i) + 2, cz(j)], [cx(i) + 2, cz(j) + 1]] : [[cx(i), cz(j) + 2], [cx(i) + 1, cz(j) + 2]];
  };
  const neighbours = (c) => {
    const i = c % cols, j = Math.floor(c / cols), out = [];
    if (i > 0) out.push(c - 1); if (i < cols - 1) out.push(c + 1);
    if (j > 0) out.push(c - cols); if (j < rows - 1) out.push(c + cols);
    return out;
  };
  const links = new Map();   // cell -> set of joined cells
  for (let c = 0; c < cols * rows; c++) links.set(c, new Set());
  const doorTiles = new Set();
  const join = (a, b, width) => {
    links.get(a).add(b); links.get(b).add(a);
    const ws = between(a, b);
    const open = width === 2 ? ws : [ws[ri(2)]];
    for (const [x, z] of open) { g[z][x] = '.'; doorTiles.add(z * W + x); }
  };
  const doorWidth = () => (r() < spec.wide ? 2 : 1);

  // start in a random corner; carve a maze outwards with a random depth-first walk
  const corners = [cid(0, 0), cid(cols - 1, 0), cid(0, rows - 1), cid(cols - 1, rows - 1)];
  const start = corners[ri(4)];
  const seen = new Set([start]), stack = [start];
  while (stack.length) {
    const c = stack[stack.length - 1];
    const next = shuffle(neighbours(c).filter((n) => !seen.has(n)));
    if (!next.length) { stack.pop(); continue; }
    seen.add(next[0]);
    join(c, next[0], doorWidth());
    stack.push(next[0]);
  }
  const cellDist = (from) => {
    const d = new Map([[from, 0]]), q = [from];
    while (q.length) { const c = q.shift(); for (const n of links.get(c)) if (!d.has(n)) { d.set(n, d.get(c) + 1); q.push(n); } }
    return d;
  };
  // the exit goes in the outside wall, in an edge cell across the board from the start
  let dist = cellDist(start);
  const apart = (a, b) => Math.abs((a % cols) - (b % cols)) + Math.abs(Math.floor(a / cols) - Math.floor(b / cols));
  // (only on the two back edges: in the isometric view those are the walls whose inside faces the viewer)
  const backEdge = (c) => c % cols === 0 || Math.floor(c / cols) === 0;
  const exitCell = [...dist.keys()].filter((c) => backEdge(c) && c !== start).sort((a, b) => apart(b, start) - apart(a, start) + (r() - 0.5) * 3)[0];

  // a dead end, sealed with a crate in a one-square doorway, hides one book
  const leaves = [...links.keys()].filter((c) => links.get(c).size === 1 && c !== start && c !== exitCell && dist.get(c) >= 2);
  if (!leaves.length) return null;
  const secret = leaves[ri(leaves.length)];
  const secretDoor = [...links.get(secret)][0];
  for (const [x, z] of between(secret, secretDoor)) { g[z][x] = '#'; doorTiles.delete(z * W + x); }
  const [crX, crZ] = between(secret, secretDoor)[ri(2)];
  g[crZ][crX] = 'X'; doorTiles.add(crZ * W + crX);

  // extra gaps make loops, so there's always another way round
  for (let c = 0; c < cols * rows; c++) for (const n of neighbours(c)) {
    if (n < c || links.get(c).has(n) || c === secret || n === secret) continue;
    if (r() < spec.loops) join(c, n, doorWidth());
  }
  // knock some 2×2 blocks of cells together into rooms
  const rooms = [];
  for (let k = 0, tries = 0; k < spec.rooms && tries < 40; tries++) {
    const i = ri(cols - 1), j = ri(rows - 1);
    const block = [cid(i, j), cid(i + 1, j), cid(i, j + 1), cid(i + 1, j + 1)];
    if (block.includes(secret) || rooms.some((rm) => rm.cells.some((c) => block.includes(c) || neighbours(c).some((n) => block.includes(n))))) continue;
    for (let x = cx(i); x < cx(i) + 5; x++) for (let z = cz(j); z < cz(j) + 5; z++) g[z][x] = '.';
    for (const [a, b] of [[0, 1], [2, 3], [0, 2], [1, 3]]) { links.get(block[a]).add(block[b]); links.get(block[b]).add(block[a]); }
    rooms.push({ x0: cx(i), z0: cz(j), cells: block });
    k++;
  }
  dist = cellDist(start);
  const maxD = Math.max(...dist.values());

  // the exit door
  {
    const i = exitCell % cols, j = Math.floor(exitCell / cols), opts = [];
    if (i === 0) opts.push([0, cz(j) + ri(2)]);
    if (j === 0) opts.push([cx(i) + ri(2), 0]);
    const [ex, ez] = opts[ri(opts.length)];
    g[ez][ex] = 'E';
  }

  // helpers for placing things on single squares
  const free = (x, z) => g[z][x] === '.';
  const nearDoor = (x, z) => doorTiles.has(z * W + x) || DIRS.some(([dx, dz]) => doorTiles.has((z + dz) * W + x + dx) || g[z + dz]?.[x + dx] === 'E');
  const againstWall = (x, z) => DIRS.some(([dx, dz]) => { const c = g[z + dz]?.[x + dx]; return c === '#' || c === 'G'; });
  // after a placement, every open square must still join up (baskets count as blocked: she can't walk through them)
  const startTile = cellTiles(start)[ri(4)];
  g[startTile[1]][startTile[0]] = 'M';
  const joinedUp = () => {
    let total = 0;
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) { const c = g[z][x]; if (c === 'X' || (!BLOCK.has(c) && c !== 'H')) total++; }
    const seenT = new Set([startTile[1] * W + startTile[0]]), q = [startTile];
    while (q.length) {
      const [x, z] = q.shift();
      for (const [dx, dz] of DIRS) {
        const nx = x + dx, nz = z + dz, c = g[nz]?.[nx], k = nz * W + nx;
        if (c === undefined || seenT.has(k) || (BLOCK.has(c) && c !== 'X') || c === 'H') continue;
        seenT.add(k); q.push([nx, nz]);
      }
    }
    return seenT.size === total;
  };
  const tryPut = (x, z, ch) => {
    if (!free(x, z)) return false;
    g[z][x] = ch;
    if (BLOCK.has(ch) || ch === 'H') {
      if (!joinedUp()) { g[z][x] = '.'; return false; }
    }
    return true;
  };
  const putInCell = (c, ch, want = () => true) => {
    for (const [x, z] of shuffle(cellTiles(c))) if (free(x, z) && want(x, z) && tryPut(x, z, ch)) return [x, z];
    return null;
  };
  // pick cells spread far apart: each new one is as far as possible (in steps) from the ones already chosen
  const spread = (n, pool, chosen) => {
    const out = [];
    const dists = chosen.map((c) => cellDist(c));
    for (let k = 0; k < n && pool.length; k++) {
      let best = null, bs = -1;
      for (const c of pool) {
        const s = Math.min(...dists.map((d) => d.get(c) ?? 99)) + r() * 1.5;
        if (s > bs) { bs = s; best = c; }
      }
      out.push(best);
      pool = pool.filter((c) => c !== best);
      dists.push(cellDist(best));
    }
    return out;
  };
  const allCells = [...links.keys()].filter((c) => c !== secret);

  // books: one behind the crate, the rest spread round the board
  const sTiles = cellTiles(secret).sort((a, b) => (Math.abs(b[0] - crX) + Math.abs(b[1] - crZ)) - (Math.abs(a[0] - crX) + Math.abs(a[1] - crZ)));
  g[sTiles[0][1]][sTiles[0][0]] = 'B';
  const bookCells = spread(spec.books - 1, allCells.filter((c) => c !== start && dist.get(c) >= 2), [start, secret]);
  if (bookCells.length < spec.books - 1) return null;
  for (const c of bookCells) if (!putInCell(c, 'B')) return null;

  // pumpkin checkpoints, roughly evenly spaced along the way from the start
  for (let k = 1; k <= spec.checkpoints; k++) {
    const want = Math.round((maxD * k) / (spec.checkpoints + 1));
    const pool = shuffle(allCells.filter((c) => c !== start && Math.abs(dist.get(c) - want) <= 1));
    if (!pool.some((c) => putInCell(c, 'C'))) return null;
  }

  // Miss Trunchbull starts well away from Matilda, then patrols points spread across the board
  const far = shuffle(allCells.filter((c) => dist.get(c) >= Math.max(3, maxD * 0.5) && c !== exitCell));
  let tCell = null;
  for (const c of far) if (putInCell(c, 'T')) { tCell = c; break; }
  if (tCell === null) return null;
  const wps = [tCell, ...spread(spec.patrol - 1, allCells.filter((c) => c !== tCell && c !== start), [tCell, start])];
  // visit them in a sensible loop: always go to the nearest one not yet visited
  const order = [wps[0]];
  let left = wps.slice(1);
  while (left.length) {
    const d = cellDist(order[order.length - 1]);
    left.sort((a, b) => d.get(a) - d.get(b));
    order.push(left.shift());
  }
  order.forEach((c, k) => putInCell(c, 'abcdefgh'[k]));


  // furniture
  const furnish = (ch, n, want) => {
    let k = 0;
    for (const c of shuffle(allCells.slice())) {
      if (k >= n) break;
      if (c === start) continue;
      if (putInCell(c, ch, (x, z) => !nearDoor(x, z) && want(x, z))) k++;
    }
  };
  for (const rm of rooms) {
    if (spec.outdoor) {
      // a hedge in the middle of the lawn to dodge round, and a creaky swing
      tryPut(rm.x0 + 2, rm.z0 + 2, '#');
      const sw = shuffle([[rm.x0 + 1, rm.z0 + 1], [rm.x0 + 3, rm.z0 + 3], [rm.x0 + 3, rm.z0 + 1], [rm.x0 + 1, rm.z0 + 3]]);
      tryPut(...sw[0], 'W');
    } else {
      // a classroom: rows of desks and a chalkboard on the wall
      for (const [dx, dz] of [[1, 1], [3, 1], [1, 3], [3, 3]]) if (r() < 0.8) tryPut(rm.x0 + dx, rm.z0 + dz, 'D');
      const sides = shuffle([[2, 0, 0, -1], [2, 4, 0, 1], [0, 2, -1, 0], [4, 2, 1, 0]]);
      for (const [dx, dz, ox, oz] of sides) {
        const x = rm.x0 + dx, z = rm.z0 + dz;
        if (g[z + oz][x + ox] === '#' && !nearDoor(x, z) && tryPut(x, z, 'K')) break;
      }
    }
  }
  if (!spec.outdoor) {
    furnish('S', spec.jugs + 1, againstWall);
    furnish('J', spec.jugs, againstWall);
    furnish('D', 2, () => true);
  }
  // hiding baskets against walls, spread out (and not right next to the start), each with a good view to peek at
  const SIGHT = new Set(['#', 'G', 'S', 'E', 'X']);
  const view = (x, z) => Math.max(...DIRS.map(([dx, dz]) => {
    let n = 0;
    while (n < 8 && g[z + dz * (n + 1)]?.[x + dx * (n + 1)] !== undefined && !SIGHT.has(g[z + dz * (n + 1)][x + dx * (n + 1)])) n++;
    return n;
  }));
  const basketCells = spread(allCells.length, allCells.filter((c) => c !== start), [start]);
  let baskets = 0;
  for (const c of basketCells) {
    if (baskets >= spec.baskets) break;
    const opts = cellTiles(c).filter(([x, z]) => free(x, z) && againstWall(x, z) && !nearDoor(x, z) && view(x, z) >= 3)
      .sort((a, b) => view(b[0], b[1]) - view(a[0], a[1]));
    if (opts.some(([x, z]) => tryPut(x, z, 'H'))) baskets++;
  }
  if (baskets < spec.baskets) return null;

  // one spare crate to play with (never right beside a basket, where it would block the view)
  furnish('X', 1, (x, z) => (!againstWall(x, z) || r() < 0.5) && !DIRS.some(([dx, dz]) => g[z + dz]?.[x + dx] === 'H'));

  // outside, the board is ringed with iron railings instead of hedges
  if (spec.outdoor) {
    for (let x = 0; x < W; x++) for (const z of [0, H - 1]) if (g[z][x] === '#') g[z][x] = 'G';
    for (let z = 0; z < H; z++) for (const x of [0, W - 1]) if (g[z][x] === '#') g[z][x] = 'G';
  }
  const map = g.map((row) => row.join(''));
  return checkMap(map) ? map : null;
}

// Can Matilda reach every book and the door, and can Miss Trunchbull reach every patrol point?
export function checkMap(map) {
  const H = map.length, W = map[0].length;
  const find = (ch) => { const out = []; map.forEach((row, z) => [...row].forEach((c, x) => { if (c === ch) out.push([x, z]); })); return out; };
  const flood = (from, ok) => {
    const seen = new Set([from[1] * W + from[0]]), q = [from];
    while (q.length) {
      const [x, z] = q.shift();
      for (const [dx, dz] of DIRS) {
        const nx = x + dx, nz = z + dz, k = nz * W + nx, c = map[nz]?.[nx];
        if (c === undefined || seen.has(k) || !ok(c)) continue;
        seen.add(k); q.push([nx, nz]);
      }
    }
    return seen;
  };
  const has = (seen, [x, z]) => seen.has(z * W + x);
  const [m] = find('M'), [t] = find('T'), [e] = find('E');
  if (!m || !t || !e) return false;
  // Matilda, once crates are floated away
  const mSeen = flood(m, (c) => c === 'X' || !BLOCK.has(c));
  if (!find('B').every((b) => has(mSeen, b))) return false;
  if (!find('C').every((b) => has(mSeen, b))) return false;
  if (!DIRS.some(([dx, dz]) => has(mSeen, [e[0] + dx, e[1] + dz]))) return false;
  // without using the power, only the secret book is out of reach
  const mFree = flood(m, (c) => !BLOCK.has(c));
  if (find('B').filter((b) => !has(mFree, b)).length > 1) return false;
  if (!find('C').every((b) => has(mFree, b)) || !has(mFree, t)) return false;
  if (!DIRS.some(([dx, dz]) => has(mFree, [e[0] + dx, e[1] + dz]))) return false;
  // Miss Trunchbull, who can't walk through baskets or crates
  const tSeen = flood(t, (c) => !BLOCK.has(c) && c !== 'H');
  for (const ch of 'abcdefgh') for (const p of find(ch)) if (!has(tSeen, p)) return false;
  return true;
}
