// Matilda and Miss Trunchbull, drawn with the canvas 2D API.
//
// The engine translates the context to the point on the ground between the character's feet,
// then calls drawMatilda(ctx, s, o) or drawTrunchbull(ctx, s, o). `s` is the size of one tile
// (a tile is 2s wide and s tall on screen). Everything below is drawn in tile units, so the
// first thing each function does is scale by s.
//
// Poses are three-quarter views facing screen-right; `flip` mirrors them to face left.
// 'front' shows the face (walking down the screen), 'back' shows the back (walking up it).

const OUT = '#1c1020';

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------
function ell(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, Math.PI * 2);
}
function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function paint(ctx, fill, stroke = true) {
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) ctx.stroke();
}
// a horizontal gradient, lit from the left
function hgrad(ctx, x0, x1, a, b) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
}
function vgrad(ctx, y0, y1, a, b) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
}
// a rounded limb: a fat outline stroke with the colour stroked on top
function capsule(ctx, pts, w, color, ow) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = w + ow * 2;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.restore();
}
function line(ctx, pts, w, color) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.save();
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.restore();
}
function glow(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
const lerp = (a, b, k) => a + (b - a) * k;
// point at the end of a limb hanging from (x, y), turned by angle a (0 = straight down, + = towards screen-right)
const reachTo = (x, y, a, len) => [x + Math.sin(a) * len, y + Math.cos(a) * len];
function blinking(t, seed) {
  const p = (t + seed) % 3.9;
  return p < 0.13;
}

// ---------------------------------------------------------------------------
// Matilda: about 1.3 tiles tall
// ---------------------------------------------------------------------------
const MC = {
  skin: '#fbd8bc', skinD: '#e9ae8c', hair: '#4a2a17', hairL: '#6a4026', hairD: '#2b170c',
  navy: '#2f4496', navyD: '#18245a', white: '#f6f3ee', whiteD: '#c9c4d6', red: '#d8202f', redD: '#9a1020',
  sock: '#a7a9b6', sockD: '#7c7e8c', shoe: '#1a141c', brass: '#e2b443', leather: '#8a5428', leatherD: '#5c3518',
};

export function drawMatilda(ctx, s, o = {}) {
  const dir = o.dir || 'front', back = dir === 'back';
  const phase = o.phase || 0, speed = Math.min(1, o.speed || 0), power = Math.min(1, o.power || 0), t = o.t || 0;
  ctx.save();
  ctx.scale(s, s);
  if (o.flip) ctx.scale(-1, 1);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  const OW = 0.026;
  ctx.lineWidth = OW;

  const sw = Math.sin(phase) * speed;
  const bob = -Math.abs(Math.sin(phase)) * 0.03 * speed + Math.sin(t * 2.4) * 0.004;

  // legs, far one first: in the front view the far side is screen-right, from behind it's screen-left
  const legX = back ? [-0.065, 0.06] : [0.065, -0.06];
  for (let i = 0; i < 2; i++) {
    const lp = phase + (i ? Math.PI : 0);
    const dx = Math.sin(lp) * 0.06 * speed;
    const lift = Math.max(0, -Math.cos(lp)) * 0.05 * speed;
    const x = legX[i], ax = x + dx, ay = -0.075 - lift;
    const kx = x + dx * 0.5;
    capsule(ctx, [[x, -0.34 + bob], [kx, -0.24]], 0.072, MC.skin, OW);
    capsule(ctx, [[kx, -0.235], [ax, ay]], 0.074, i ? MC.sock : MC.sockD, OW);
    // turned-down sock cuff
    rrect(ctx, kx - 0.048, -0.258, 0.096, 0.035, 0.015);
    paint(ctx, i ? '#c2c4cf' : '#9597a4');
    // shoe, toe pointing the way she faces
    const toe = back ? -0.01 : 0.025;
    ell(ctx, ax + toe, ay + 0.035, 0.066, 0.042);
    paint(ctx, MC.shoe);
    if (!back) {
      line(ctx, [[ax - 0.04, ay + 0.012], [ax + 0.035, ay + 0.012]], 0.014, '#3a3040');
      ell(ctx, ax + 0.02, ay + 0.013, 0.014, 0.01);
      paint(ctx, MC.brass, false);
    }
    ell(ctx, ax + toe - 0.02, ay + 0.022, 0.02, 0.009, -0.3);
    paint(ctx, 'rgba(255,255,255,0.35)', false);
  }

  ctx.translate(0, bob);
  // arms: swing opposite to the legs; with her power on they reach up and forward
  const shoulderY = -0.745;
  const arm = (side) => {
    // side: -1 screen-left, +1 screen-right
    const sx = side * 0.145;
    const near = back ? side > 0 : side < 0;
    const walkA = (near ? sw : -sw) * 0.45 + side * 0.12;
    const [wx, wy] = reachTo(sx, shoulderY, walkA, 0.27);
    // with her power on, hands up beside her head, reaching forward
    const [tx, ty] = back ? [side * 0.3, -0.92] : side < 0 ? [-0.33, -0.86] : [0.4, -0.9];
    const ex = lerp(wx, tx, power), ey = lerp(wy, ty, power);
    const a = Math.atan2(ex - sx, ey - shoulderY);
    const [mx, my] = reachTo(sx, shoulderY, a, 0.1);
    capsule(ctx, [[mx, my], [ex, ey]], 0.058, MC.skin, OW);
    // puffed sleeve
    ell(ctx, sx + Math.sin(a) * 0.035, shoulderY + Math.cos(a) * 0.035, 0.068, 0.075, -a);
    paint(ctx, hgrad(ctx, sx - 0.07, sx + 0.07, MC.white, MC.whiteD));
    ell(ctx, ex, ey, 0.043, 0.043);
    paint(ctx, MC.skin);
    if (power > 0.5) {
      // open fingers
      for (let k = -1.5; k <= 1.5; k++) {
        const fa = a + k * 0.38;
        capsule(ctx, [[ex, ey], reachTo(ex, ey, fa, 0.06)], 0.018, MC.skin, OW * 0.7);
      }
      ell(ctx, ex, ey, 0.04, 0.04);
      paint(ctx, MC.skin);
      glow(ctx, ex, ey, 0.09, `rgba(192,132,255,${0.5 * power})`);
    }
  };
  const farSide = back ? -1 : 1;

  const armsUp = power > 0.5;
  if (!armsUp) arm(farSide);
  if (!back) {
    // the satchel peeks out behind her far hip
    rrect(ctx, 0.1, -0.66, 0.11, 0.15, 0.03);
    paint(ctx, MC.leatherD);
  }

  // pleated pinafore skirt, swaying a little as she walks
  ctx.save();
  ctx.rotate(sw * 0.035);
  ctx.beginPath();
  ctx.moveTo(-0.15, -0.565);
  ctx.lineTo(0.15, -0.565);
  ctx.quadraticCurveTo(0.21, -0.45, 0.245, -0.315);
  const pleats = 8;
  for (let k = 1; k <= pleats; k++) {
    const x = 0.245 - (0.49 * k) / pleats;
    ctx.lineTo(x + 0.0306, k % 2 ? -0.295 : -0.315);
    ctx.lineTo(x, -0.315 + (k % 2 ? 0 : 0.0));
  }
  ctx.quadraticCurveTo(-0.21, -0.45, -0.15, -0.565);
  ctx.closePath();
  paint(ctx, hgrad(ctx, -0.25, 0.25, MC.navy, MC.navyD));
  for (let k = -3; k <= 3; k++) line(ctx, [[k * 0.038, -0.55], [k * 0.07, -0.31]], 0.011, 'rgba(8,12,40,0.55)');
  line(ctx, [[-0.12, -0.54], [-0.19, -0.33]], 0.012, 'rgba(120,150,255,0.25)');
  ctx.restore();

  // body
  if (!back) {
    // blouse
    rrect(ctx, -0.15, -0.8, 0.3, 0.26, 0.08);
    paint(ctx, hgrad(ctx, -0.15, 0.15, MC.white, MC.whiteD));
    // pinafore bib and straps
    ctx.beginPath();
    ctx.moveTo(-0.1, -0.705);
    ctx.lineTo(0.12, -0.705);
    ctx.lineTo(0.145, -0.555);
    ctx.lineTo(-0.135, -0.555);
    ctx.closePath();
    paint(ctx, hgrad(ctx, -0.14, 0.14, MC.navy, MC.navyD));
    capsule(ctx, [[-0.085, -0.705], [-0.1, -0.785]], 0.034, MC.navy, OW * 0.7);
    capsule(ctx, [[0.105, -0.705], [0.1, -0.785]], 0.034, MC.navyD, OW * 0.7);
    for (const bx of [-0.08, 0.1]) { ell(ctx, bx, -0.69, 0.014, 0.014); paint(ctx, '#dfe3ff', false); }
    // red tie
    ctx.beginPath();
    ctx.moveTo(0.012, -0.775);
    ctx.lineTo(0.04, -0.775);
    ctx.lineTo(0.05, -0.71);
    ctx.lineTo(0.026, -0.695);
    ctx.lineTo(0.002, -0.71);
    ctx.closePath();
    paint(ctx, MC.red);
    // round collar
    for (const [cx, rot] of [[-0.035, 0.5], [0.075, -0.5]]) {
      ell(ctx, cx, -0.785, 0.052, 0.03, rot);
      paint(ctx, MC.white);
    }
    ell(ctx, 0.026, -0.78, 0.018, 0.016);
    paint(ctx, MC.redD);
    // satchel strap across her front, from her near shoulder to her far hip
    capsule(ctx, [[-0.12, -0.775], [0.155, -0.57]], 0.026, MC.leather, OW * 0.7);
  } else {
    rrect(ctx, -0.15, -0.8, 0.3, 0.26, 0.08);
    paint(ctx, hgrad(ctx, -0.15, 0.15, MC.white, MC.whiteD));
    // straps crossing at the back
    capsule(ctx, [[-0.1, -0.79], [0.1, -0.58]], 0.034, MC.navy, OW * 0.7);
    capsule(ctx, [[0.1, -0.79], [-0.1, -0.58]], 0.034, MC.navyD, OW * 0.7);
    rrect(ctx, -0.145, -0.6, 0.29, 0.05, 0.02);
    paint(ctx, MC.navyD);
    // the satchel on her back
    rrect(ctx, -0.125, -0.74, 0.25, 0.2, 0.045);
    paint(ctx, hgrad(ctx, -0.13, 0.13, MC.leather, MC.leatherD));
    ctx.beginPath();
    ctx.moveTo(-0.125, -0.7);
    ctx.quadraticCurveTo(-0.125, -0.745, -0.08, -0.745);
    ctx.lineTo(0.08, -0.745);
    ctx.quadraticCurveTo(0.125, -0.745, 0.125, -0.7);
    ctx.lineTo(0.125, -0.64);
    ctx.quadraticCurveTo(0, -0.6, -0.125, -0.64);
    ctx.closePath();
    paint(ctx, '#a0663a');
    rrect(ctx, -0.022, -0.648, 0.044, 0.04, 0.008);
    paint(ctx, MC.brass);
    line(ctx, [[-0.1, -0.72], [0.1, -0.72]], 0.008, 'rgba(255,230,190,0.35)');
  }
  // neck
  rrect(ctx, -0.035, -0.83, 0.07, 0.06, 0.02);
  paint(ctx, MC.skinD, false);

  if (!armsUp) arm(-farSide);

  // head
  const hx = 0.03, hy = -0.985;
  // the back of the bob
  const bob1 = () => {
    ctx.beginPath();
    ctx.moveTo(hx - 0.3, hy + 0.02);
    ctx.bezierCurveTo(hx - 0.34, hy - 0.37, hx + 0.34, hy - 0.37, hx + 0.3, hy + 0.02);
    ctx.bezierCurveTo(hx + 0.315, hy + 0.12, hx + 0.3, hy + 0.205, hx + 0.21, hy + 0.205);
    ctx.quadraticCurveTo(hx + 0.17, hy + 0.205, hx + 0.16, hy + 0.17);
    ctx.lineTo(hx - 0.16, hy + 0.17);
    ctx.quadraticCurveTo(hx - 0.17, hy + 0.205, hx - 0.21, hy + 0.205);
    ctx.bezierCurveTo(hx - 0.3, hy + 0.205, hx - 0.315, hy + 0.12, hx - 0.3, hy + 0.02);
    ctx.closePath();
  };
  bob1();
  paint(ctx, vgrad(ctx, hy - 0.3, hy + 0.2, MC.hairL, MC.hairD));

  if (back) {
    // strands and a shine on the back of her hair
    for (const k of [-0.16, -0.06, 0.05, 0.15]) {
      line(ctx, [[hx + k * 0.6, hy - 0.2], [hx + k, hy + 0.15]], 0.01, 'rgba(20,8,2,0.55)');
    }
    ctx.beginPath();
    ctx.arc(hx - 0.02, hy - 0.05, 0.22, -2.6, -1.6);
    ctx.save(); ctx.lineWidth = 0.022; ctx.strokeStyle = 'rgba(255,215,170,0.28)'; ctx.stroke(); ctx.restore();
    // the tucked-under ends
    line(ctx, [[hx - 0.2, hy + 0.165], [hx + 0.2, hy + 0.165]], 0.012, 'rgba(20,8,2,0.6)');
    // a peep of cheek on the side she's turned to
    ell(ctx, hx + 0.285, hy + 0.06, 0.03, 0.06, 0.2);
    paint(ctx, MC.skinD);
    drawBow(ctx, hx + 0.1, hy - 0.25, 0.25);
  } else {
    // face
    ell(ctx, hx + 0.035, hy + 0.012, 0.235, 0.232);
    paint(ctx, hgrad(ctx, hx - 0.2, hx + 0.27, MC.skin, MC.skinD));
    // the bob falling either side of her face: wider on the near side
    ctx.beginPath();
    ctx.moveTo(hx - 0.28, hy - 0.12);
    ctx.bezierCurveTo(hx - 0.31, hy + 0.04, hx - 0.3, hy + 0.15, hx - 0.25, hy + 0.2);
    ctx.quadraticCurveTo(hx - 0.2, hy + 0.215, hx - 0.15, hy + 0.17);
    ctx.bezierCurveTo(hx - 0.19, hy + 0.1, hx - 0.19, hy, hx - 0.17, hy - 0.06);
    ctx.closePath();
    paint(ctx, vgrad(ctx, hy - 0.1, hy + 0.2, MC.hair, MC.hairD));
    ctx.beginPath();
    ctx.moveTo(hx + 0.29, hy - 0.1);
    ctx.bezierCurveTo(hx + 0.315, hy + 0.04, hx + 0.31, hy + 0.15, hx + 0.27, hy + 0.195);
    ctx.quadraticCurveTo(hx + 0.24, hy + 0.205, hx + 0.215, hy + 0.165);
    ctx.bezierCurveTo(hx + 0.24, hy + 0.1, hx + 0.245, hy, hx + 0.235, hy - 0.05);
    ctx.closePath();
    paint(ctx, vgrad(ctx, hy - 0.1, hy + 0.2, MC.hair, MC.hairD));
    // fringe: a cap over the top of the head with a soft, uneven edge
    ctx.beginPath();
    ctx.moveTo(hx - 0.285, hy - 0.04);
    ctx.bezierCurveTo(hx - 0.33, hy - 0.37, hx + 0.36, hy - 0.37, hx + 0.3, hy - 0.04);
    const fr = [[0.24, -0.075], [0.17, -0.06], [0.1, -0.085], [0.03, -0.065], [-0.04, -0.09], [-0.11, -0.07], [-0.18, -0.095], [-0.24, -0.07]];
    let px = 0.3;
    for (const [fx, fy] of fr) {
      ctx.quadraticCurveTo(hx + (px + fx) / 2, hy + fy + 0.03, hx + fx, hy + fy);
      px = fx;
    }
    ctx.quadraticCurveTo(hx - 0.27, hy - 0.06, hx - 0.285, hy - 0.04);
    ctx.closePath();
    paint(ctx, vgrad(ctx, hy - 0.3, hy - 0.05, MC.hairL, MC.hair));
    ctx.beginPath();
    ctx.arc(hx - 0.01, hy - 0.04, 0.22, -2.55, -1.75);
    ctx.save(); ctx.lineWidth = 0.022; ctx.strokeStyle = 'rgba(255,215,170,0.3)'; ctx.stroke(); ctx.restore();

    // eyes
    const ey = hy + 0.02;
    const eyes = [[hx - 0.045, 0.05, 0.062], [hx + 0.135, 0.043, 0.058]];
    const closed = blinking(t, 0.7) && power <= 0;
    for (const [ex, rx, ry] of eyes) {
      if (closed) {
        ctx.beginPath();
        ctx.ellipse(ex, ey + 0.01, rx, ry * 0.5, 0, 0.15, Math.PI - 0.15);
        ctx.save(); ctx.lineWidth = 0.018; ctx.stroke(); ctx.restore();
        continue;
      }
      ell(ctx, ex, ey, rx, ry);
      ctx.save();
      ctx.lineWidth = 0.014;
      paint(ctx, '#ffffff');
      ctx.clip();
      const ix = ex + 0.013, iy = ey + 0.008;
      ell(ctx, ix, iy, rx * 0.74, ry * 0.66);
      ctx.fillStyle = power > 0 ? '#c084ff' : '#7a4520';
      ctx.fill();
      ell(ctx, ix, iy + 0.012, rx * 0.6, ry * 0.4);
      ctx.fillStyle = power > 0 ? 'rgba(255,230,255,0.5)' : 'rgba(200,120,60,0.6)';
      ctx.fill();
      ell(ctx, ix, iy, rx * 0.36, ry * 0.34);
      ctx.fillStyle = power > 0 ? '#5a1aa0' : '#1a0d08';
      ctx.fill();
      ctx.restore();
      ell(ctx, ex - 0.004, ey - 0.02, 0.013, 0.013);
      paint(ctx, '#ffffff', false);
      ell(ctx, ex + 0.024, ey + 0.017, 0.006, 0.006);
      paint(ctx, '#ffffff', false);
      // lash line with a flick at the outer corner
      ctx.beginPath();
      ctx.ellipse(ex, ey, rx, ry, 0, Math.PI + 0.25, Math.PI * 2 - 0.15);
      ctx.save(); ctx.lineWidth = 0.022; ctx.stroke(); ctx.restore();
    }
    if (!closed) {
      line(ctx, [[eyes[1][0] + 0.04, ey - 0.03], [eyes[1][0] + 0.062, ey - 0.048]], 0.014, OUT);
      line(ctx, [[eyes[0][0] - 0.046, ey - 0.03], [eyes[0][0] - 0.066, ey - 0.046]], 0.014, OUT);
    }
    // brows: the far one raised a touch, a clever look
    ctx.save();
    ctx.lineWidth = 0.016;
    ctx.strokeStyle = MC.hairD;
    ctx.beginPath(); ctx.arc(eyes[0][0], ey - 0.03, 0.06, -2.3, -1.0); ctx.stroke();
    ctx.beginPath(); ctx.arc(eyes[1][0], ey - 0.045, 0.055, -2.2, -0.95); ctx.stroke();
    ctx.restore();
    // nose, smile and cheeks
    line(ctx, [[hx + 0.075, hy + 0.08], [hx + 0.088, hy + 0.088]], 0.014, '#c98a6a');
    ctx.beginPath();
    ctx.moveTo(hx + 0.03, hy + 0.128);
    ctx.quadraticCurveTo(hx + 0.08, hy + 0.17, hx + 0.13, hy + 0.115);
    ctx.save(); ctx.lineWidth = 0.016; ctx.strokeStyle = '#8a2c30'; ctx.stroke(); ctx.restore();
    ell(ctx, hx - 0.105, hy + 0.09, 0.045, 0.026);
    paint(ctx, 'rgba(255,110,120,0.32)', false);
    ell(ctx, hx + 0.215, hy + 0.085, 0.03, 0.024);
    paint(ctx, 'rgba(255,110,120,0.32)', false);
    if (power > 0) {
      for (const [ex] of eyes) glow(ctx, ex, ey, 0.13, `rgba(192,132,255,${0.75 * power})`);
    }
    drawBow(ctx, hx - 0.13, hy - 0.245, -0.3);
  }
  if (armsUp) { arm(farSide); arm(-farSide); }
  ctx.restore();
}

// a big red ribbon bow
function drawBow(ctx, x, y, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  // tails
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(sd * 0.05, 0.1);
    ctx.lineTo(sd * 0.025, 0.09);
    ctx.lineTo(sd * 0.015, 0.105);
    ctx.closePath();
    paint(ctx, MC.redD);
  }
  // loops
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(sd * 0.06, -0.09, sd * 0.15, -0.06, sd * 0.13, 0.0);
    ctx.bezierCurveTo(sd * 0.12, 0.05, sd * 0.05, 0.04, 0, 0);
    ctx.closePath();
    paint(ctx, hgrad(ctx, -0.13, 0.13, '#ff4a55', MC.red));
    line(ctx, [[sd * 0.03, -0.01], [sd * 0.09, -0.03]], 0.01, 'rgba(120,0,10,0.5)');
  }
  ell(ctx, 0, 0, 0.032, 0.03);
  paint(ctx, MC.red);
  ell(ctx, -0.007, -0.009, 0.01, 0.007);
  paint(ctx, 'rgba(255,255,255,0.55)', false);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Miss Trunchbull: about 2 tiles tall and a tile wide
// ---------------------------------------------------------------------------
const TC = {
  skin: '#ecac8c', skinD: '#c98161', nose: '#d98a6c', coat: '#5d6d3a', coatD: '#38441f', coatDD: '#283216',
  khaki: '#c2ad72', khakiD: '#8f7c48', boot: '#6a3e1e', bootD: '#3e220e', sole: '#22140c', belt: '#4e2e14',
  brass: '#e0b040', brassD: '#9a7420', hair: '#a3a1ab', hairD: '#6f6c78', brow: '#3a3438', white: '#f1ede4', red: '#c81e2c',
};

export function drawTrunchbull(ctx, s, o = {}) {
  const dir = o.dir || 'front', back = dir === 'back';
  const phase = o.phase || 0, speed = Math.min(1, o.speed || 0), t = o.t || 0;
  const reach = Math.min(1, o.reach || 0), red = Math.min(1, o.red || 0), stunned = !!o.stunned;
  ctx.save();
  ctx.scale(s, s);
  if (o.flip) ctx.scale(-1, 1);
  if (stunned) ctx.rotate(Math.sin(t * 3.2) * 0.06);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = OUT;
  const OW = 0.028;
  ctx.lineWidth = OW;

  const sw = Math.sin(phase) * speed;
  const bob = -Math.abs(Math.sin(phase)) * 0.035 * speed + Math.sin(t * 1.8) * 0.006;

  // legs: puffed jodhpurs and tall laced boots
  const legX = back ? [-0.17, 0.16] : [0.17, -0.16];
  for (let i = 0; i < 2; i++) {
    const lp = phase + (i ? Math.PI : 0);
    const dx = Math.sin(lp) * 0.09 * speed;
    const lift = Math.max(0, -Math.cos(lp)) * 0.07 * speed;
    const x = legX[i], bx = x + dx, by = -lift;
    const out = x > 0 ? 1 : -1;
    // the thigh flares out sideways
    ctx.beginPath();
    ctx.moveTo(x - 0.13, -1.0 + bob);
    ctx.bezierCurveTo(x - 0.15 + Math.min(0, out) * 0.12, -0.85, x - 0.12, -0.66, bx - 0.085, -0.5 + by);
    ctx.lineTo(bx + 0.085, -0.5 + by);
    ctx.bezierCurveTo(x + 0.12, -0.66, x + 0.15 + Math.max(0, out) * 0.12, -0.85, x + 0.13, -1.0 + bob);
    ctx.closePath();
    paint(ctx, hgrad(ctx, x - 0.25, x + 0.25, i ? TC.khaki : TC.khakiD, i ? TC.khakiD : '#6e5e34'));
    // boot shaft
    rrect(ctx, bx - 0.095, -0.53 + by, 0.19, 0.48, 0.05);
    paint(ctx, hgrad(ctx, bx - 0.1, bx + 0.1, i ? TC.boot : '#5a3418', TC.bootD));
    rrect(ctx, bx - 0.1, -0.56 + by, 0.2, 0.06, 0.025);
    paint(ctx, TC.bootD);
    // foot and sole
    const toe = back ? -0.015 : 0.045;
    ell(ctx, bx + toe, -0.055 + by, 0.125, 0.07);
    paint(ctx, i ? TC.boot : '#5a3418');
    rrect(ctx, bx + toe - 0.13, -0.035 + by, 0.26, 0.04, 0.02);
    paint(ctx, TC.sole);
    ell(ctx, bx + toe + 0.03, -0.075 + by, 0.04, 0.016, -0.2);
    paint(ctx, 'rgba(255,220,180,0.25)', false);
    if (!back) {
      // criss-cross laces
      ctx.save();
      ctx.lineWidth = 0.012;
      ctx.strokeStyle = '#e8d6b0';
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const ly = -0.48 + by + k * 0.075;
        ctx.moveTo(bx - 0.04, ly); ctx.lineTo(bx + 0.04, ly + 0.05);
        ctx.moveTo(bx + 0.04, ly); ctx.lineTo(bx - 0.04, ly + 0.05);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.translate(0, bob);
  const shY = -1.5;
  // arms: hanging and swinging, or reaching out to grab when she chases
  const farSide = back ? -1 : 1;
  const arm = (side) => {
    const sx = side * 0.46;
    const near = back ? side > 0 : side < 0;
    const walkA = (near ? sw : -sw) * 0.35 + side * (back ? 0.12 : 0.18);
    const [wx, wy] = reachTo(sx, shY, walkA, 0.56);
    // reaching: from the front her hands come at you, in front of her chest; from behind they're hidden in front of her
    const [tx, ty] = back ? [side * 0.33, -1.6] : [side * 0.45 + 0.03, -1.47];
    const ex = lerp(wx, tx, reach), ey = lerp(wy, ty, reach);
    const elx = (sx + ex) / 2 + side * lerp(0.05, 0.08, reach), ely = (shY + ey) / 2 + lerp(0, -0.03, reach);
    capsule(ctx, [[sx, shY], [elx, ely], [ex, ey]], lerp(0.2, 0.25, back ? 0 : reach), side === farSide ? TC.coatD : TC.coat, OW);
    const a = Math.atan2(ex - elx, ey - ely);
    if (back && reach > 0.5) return;
    if (reach > 0.45 && !back) {
      // the sleeve opening faces you, and a big grasping hand reaches out of it
      ell(ctx, ex, ey, 0.125, 0.11);
      paint(ctx, TC.coatDD);
      const px = ex - side * 0.01, py = ey - 0.05;
      for (let k = -1.5; k <= 1.5; k++) {
        const fa = Math.PI + side * 0.3 + k * 0.36;
        const [f1x, f1y] = reachTo(px, py, fa, 0.155);
        const [f2x, f2y] = reachTo(f1x, f1y, fa - side * 0.2 + k * 0.3, 0.07);
        capsule(ctx, [[px, py], [f1x, f1y], [f2x, f2y]], 0.056, TC.skin, OW * 0.8);
      }
      const [thx, thy] = reachTo(px, py, Math.PI / 2 * -side + Math.PI * 0.85, 0.12);
      capsule(ctx, [[px, py], [thx, thy]], 0.058, TC.skin, OW * 0.8);
      ell(ctx, px, py, 0.12, 0.11);
      paint(ctx, hgrad(ctx, px - 0.12, px + 0.12, TC.skin, TC.skinD));
      // palm lines
      line(ctx, [[px - 0.05, py + 0.01], [px + 0.04, py - 0.02]], 0.01, 'rgba(110,40,30,0.5)');
      return;
    }
    // cuff and a big fist
    const [cx, cy] = reachTo(elx, ely, a, Math.hypot(ex - elx, ey - ely) - 0.06);
    ell(ctx, cx, cy, 0.105, 0.06, -a);
    paint(ctx, TC.coatDD);
    const fist = 0.1;
    ell(ctx, ex, ey, fist, fist * 0.95);
    paint(ctx, hgrad(ctx, ex - fist, ex + fist, TC.skin, TC.skinD));
    for (let k = -1; k <= 1; k++) line(ctx, [[ex + k * 0.035, ey + 0.015], [ex + k * 0.035, ey + 0.065]], 0.011, 'rgba(110,40,30,0.6)');
    ell(ctx, ex - side * 0.035, ey - 0.03, 0.05, 0.03, side * 0.4);
    paint(ctx, TC.skin);
  };
  // arms that reach towards the viewer are drawn in front of her body
  const armsFront = !back && reach > 0.5;
  if (!armsFront) arm(farSide);
  if (back && reach > 0.5) arm(-farSide);

  // coat tails, open at the front over the jodhpurs
  const coatG = hgrad(ctx, -0.5, 0.5, TC.coat, TC.coatD);
  if (back) {
    ctx.beginPath();
    ctx.moveTo(-0.41, -1.1);
    ctx.lineTo(0.41, -1.1);
    ctx.quadraticCurveTo(0.47, -0.88, 0.51, -0.66);
    ctx.quadraticCurveTo(0, -0.62, -0.51, -0.66);
    ctx.quadraticCurveTo(-0.47, -0.88, -0.41, -1.1);
    ctx.closePath();
    paint(ctx, coatG);
    // the back vent and folds
    line(ctx, [[0, -1.02], [0, -0.64]], 0.016, TC.coatDD);
    line(ctx, [[-0.25, -1.0], [-0.3, -0.67]], 0.012, 'rgba(20,28,10,0.5)');
    line(ctx, [[0.25, -1.0], [0.3, -0.67]], 0.012, 'rgba(20,28,10,0.5)');
  } else {
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sd * 0.03 + 0.03, -1.1);
      ctx.lineTo(sd * 0.41, -1.1);
      ctx.quadraticCurveTo(sd * 0.47, -0.88, sd * 0.51, -0.66);
      ctx.quadraticCurveTo(sd * 0.3, -0.63, sd * 0.11 + 0.03, -0.66);
      ctx.closePath();
      paint(ctx, coatG);
      line(ctx, [[sd * 0.25, -1.02], [sd * 0.31, -0.68]], 0.012, 'rgba(20,28,10,0.45)');
    }
  }

  // barrel chest
  ctx.beginPath();
  ctx.moveTo(-0.41, -1.06);
  ctx.bezierCurveTo(-0.55, -1.22, -0.55, -1.42, -0.47, -1.53);
  ctx.quadraticCurveTo(-0.36, -1.63, -0.14, -1.645);
  ctx.lineTo(0.18, -1.645);
  ctx.quadraticCurveTo(0.39, -1.63, 0.48, -1.53);
  ctx.bezierCurveTo(0.56, -1.42, 0.56, -1.22, 0.42, -1.06);
  ctx.closePath();
  paint(ctx, coatG);

  if (back) {
    line(ctx, [[0, -1.6], [0, -1.12]], 0.014, 'rgba(20,28,10,0.55)');
    // collar
    rrect(ctx, -0.17, -1.665, 0.34, 0.07, 0.03);
    paint(ctx, TC.coatDD);
  } else {
    // shirt, tie and lapels
    ctx.beginPath();
    ctx.moveTo(-0.1, -1.64);
    ctx.lineTo(0.16, -1.64);
    ctx.lineTo(0.035, -1.4);
    ctx.closePath();
    paint(ctx, TC.white);
    ctx.beginPath();
    ctx.moveTo(0.015, -1.6);
    ctx.lineTo(0.055, -1.6);
    ctx.lineTo(0.07, -1.47);
    ctx.lineTo(0.035, -1.42);
    ctx.lineTo(0.0, -1.47);
    ctx.closePath();
    paint(ctx, TC.red);
    rrect(ctx, 0.01, -1.625, 0.05, 0.035, 0.012);
    paint(ctx, '#a0141f');
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0.03 + sd * 0.14, -1.645);
      ctx.lineTo(0.03 + sd * 0.25, -1.58);
      ctx.lineTo(0.03 + sd * 0.19, -1.5);
      ctx.lineTo(0.03 + sd * 0.24, -1.45);
      ctx.lineTo(0.03 + sd * 0.01, -1.33);
      ctx.lineTo(0.03 + sd * 0.005, -1.4);
      ctx.closePath();
      paint(ctx, sd < 0 ? TC.coatD : TC.coatDD);
    }
    // two rows of brass buttons
    for (const by of [-1.3, -1.19]) for (const bx of [-0.12, 0.18]) {
      ell(ctx, bx, by, 0.026, 0.026);
      paint(ctx, TC.brass);
      ell(ctx, bx - 0.008, by - 0.008, 0.008, 0.008);
      paint(ctx, '#fff2b8', false);
    }
    // medal ribbons and a medal
    const mc = ['#c81e2c', '#2a4fd0', '#2f9a4a'];
    mc.forEach((c, k) => { rrect(ctx, 0.2 + k * 0.055, -1.47, 0.05, 0.034, 0.006); paint(ctx, c); });
    line(ctx, [[0.3, -1.436], [0.3, -1.39]], 0.018, '#c81e2c');
    ell(ctx, 0.3, -1.37, 0.03, 0.03);
    paint(ctx, TC.brass);
    // whistle on a cord
    ctx.save();
    ctx.lineWidth = 0.01;
    ctx.strokeStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(-0.08, -1.63);
    ctx.quadraticCurveTo(-0.17, -1.5, -0.2, -1.4);
    ctx.stroke();
    ctx.restore();
    rrect(ctx, -0.245, -1.405, 0.09, 0.045, 0.02);
    paint(ctx, '#f0c64a');
    ell(ctx, -0.235, -1.383, 0.01, 0.01);
    paint(ctx, '#5a4010', false);
  }
  // epaulettes
  for (const sd of [-1, 1]) {
    ell(ctx, sd * 0.42, -1.565, 0.12, 0.05, sd * 0.2);
    paint(ctx, TC.coatDD);
    line(ctx, [[sd * 0.33, -1.535], [sd * 0.52, -1.55]], 0.016, TC.brass);
  }
  // wide belt with a brass buckle, and her keys
  rrect(ctx, -0.43, -1.135, 0.86, 0.095, 0.03);
  paint(ctx, vgrad(ctx, -1.135, -1.04, '#6e4220', TC.belt));
  if (back) {
    rrect(ctx, -0.07, -1.15, 0.14, 0.12, 0.02);
    paint(ctx, TC.belt);
  } else {
    rrect(ctx, -0.035, -1.155, 0.14, 0.13, 0.025);
    paint(ctx, TC.brass);
    rrect(ctx, -0.005, -1.125, 0.08, 0.07, 0.01);
    paint(ctx, TC.belt);
    line(ctx, [[0.035, -1.125], [0.035, -1.06]], 0.016, TC.brassD);
  }
  const kx = back ? 0.37 : -0.37;
  ctx.save();
  ctx.lineWidth = 0.014;
  ctx.strokeStyle = TC.brass;
  ctx.beginPath(); ctx.arc(kx, -1.04, 0.035, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  for (const [kdx, ka] of [[-0.02, 0.25], [0.02, -0.2]]) {
    ctx.save();
    ctx.translate(kx + kdx, -1.01);
    ctx.rotate(ka);
    rrect(ctx, -0.01, 0, 0.02, 0.09, 0.006);
    paint(ctx, '#c8c4b0');
    rrect(ctx, -0.005, 0.06, 0.03, 0.012, 0.004);
    paint(ctx, '#c8c4b0', false);
    ctx.restore();
  }

  if (!armsFront) arm(-farSide);

  // head
  const hx = 0.03, hy = -1.8;
  // thick neck
  rrect(ctx, hx - 0.15, hy + 0.1, 0.3, 0.1, 0.04);
  paint(ctx, TC.skinD);
  const headPath = () => {
    ctx.beginPath();
    ctx.moveTo(hx - 0.22, hy - 0.1);
    ctx.bezierCurveTo(hx - 0.23, hy - 0.27, hx + 0.27, hy - 0.27, hx + 0.26, hy - 0.1);
    // jaw widening into jowls
    ctx.bezierCurveTo(hx + 0.28, hy + 0.02, hx + 0.31, hy + 0.1, hx + 0.24, hy + 0.17);
    ctx.quadraticCurveTo(hx + 0.13, hy + 0.235, hx + 0.02, hy + 0.225);
    ctx.quadraticCurveTo(hx - 0.13, hy + 0.23, hx - 0.22, hy + 0.17);
    ctx.bezierCurveTo(hx - 0.29, hy + 0.1, hx - 0.25, hy + 0.02, hx - 0.22, hy - 0.1);
    ctx.closePath();
  };
  const skinG = hgrad(ctx, hx - 0.25, hx + 0.3, TC.skin, TC.skinD);

  if (back) {
    // ears either side, then the back of the head under scraped-back hair
    for (const sd of [-1, 1]) { ell(ctx, hx + sd * 0.25, hy + 0.0, 0.045, 0.07); paint(ctx, TC.skinD); }
    headPath();
    paint(ctx, skinG);
    // hair over the whole back of the head down to a neat line at the nape
    ctx.save();
    headPath();
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(hx - 0.4, hy - 0.4);
    ctx.lineTo(hx + 0.45, hy - 0.4);
    ctx.lineTo(hx + 0.45, hy + 0.05);
    ctx.quadraticCurveTo(hx + 0.03, hy + 0.13, hx - 0.4, hy + 0.05);
    ctx.closePath();
    paint(ctx, vgrad(ctx, hy - 0.25, hy + 0.1, '#bdbbc4', TC.hairD));
    ctx.restore();
    headPath();
    ctx.stroke();
    // comb lines pulled tight towards the bun
    ctx.save();
    ctx.lineWidth = 0.009;
    ctx.strokeStyle = 'rgba(60,58,70,0.6)';
    for (const k of [-0.2, -0.12, -0.04, 0.04, 0.12, 0.2]) {
      ctx.beginPath();
      ctx.moveTo(hx + 0.02 + k * 1.15, hy + 0.07 - Math.abs(k) * 0.2);
      ctx.quadraticCurveTo(hx + 0.02 + k * 0.6, hy - 0.02, hx + 0.02 + k * 0.25, hy - 0.06);
      ctx.moveTo(hx + 0.02 + k * 1.1, hy - 0.22 + Math.abs(k) * 0.3);
      ctx.quadraticCurveTo(hx + 0.02 + k * 0.6, hy - 0.16, hx + 0.02 + k * 0.25, hy - 0.12);
      ctx.stroke();
    }
    ctx.restore();
    drawBun(ctx, hx + 0.02, hy - 0.11, 0.11);
    // neck roll
    ctx.beginPath();
    ctx.arc(hx + 0.02, hy + 0.1, 0.1, 0.4, Math.PI - 0.4);
    ctx.save(); ctx.lineWidth = 0.012; ctx.strokeStyle = 'rgba(80,30,20,0.5)'; ctx.stroke(); ctx.restore();
  } else {
    drawBun(ctx, hx - 0.15, hy - 0.16, 0.11);
    // near ear
    ell(ctx, hx - 0.235, hy + 0.0, 0.045, 0.072);
    paint(ctx, TC.skinD);
    headPath();
    paint(ctx, skinG);
    // grey hair, scraped back hard from the hairline
    ctx.save();
    headPath();
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(hx - 0.4, hy - 0.4);
    ctx.lineTo(hx + 0.45, hy - 0.4);
    ctx.lineTo(hx + 0.45, hy - 0.03);
    ctx.quadraticCurveTo(hx + 0.2, hy - 0.13, hx + 0.03, hy - 0.135);
    ctx.quadraticCurveTo(hx - 0.15, hy - 0.13, hx - 0.4, hy + 0.0);
    ctx.closePath();
    paint(ctx, vgrad(ctx, hy - 0.27, hy - 0.05, '#c2c0c8', TC.hair));
    ctx.restore();
    headPath();
    ctx.stroke();
    ctx.save();
    ctx.lineWidth = 0.009;
    ctx.strokeStyle = 'rgba(70,68,80,0.55)';
    for (const k of [-0.16, -0.08, 0.0, 0.08, 0.16]) {
      ctx.beginPath();
      ctx.moveTo(hx + 0.03 + k, hy - 0.14 + Math.abs(k) * 0.4);
      ctx.quadraticCurveTo(hx + k * 0.7, hy - 0.22, hx - 0.1, hy - 0.25);
      ctx.stroke();
    }
    ctx.restore();

    // face, flushing when she's after you
    if (red > 0) {
      for (const [cx, cr] of [[hx - 0.13, 0.07], [hx + 0.2, 0.06]]) { ell(ctx, cx, hy + 0.08, cr, cr * 0.7); paint(ctx, `rgba(230,40,40,${0.4 * red})`, false); }
    }
    const ey = hy + 0.0;
    const eyes = [[hx - 0.07, 0.042], [hx + 0.135, 0.036]];
    if (stunned) {
      // dizzy spiral eyes
      ctx.save();
      ctx.lineWidth = 0.014;
      for (const [ex, er] of eyes) {
        ell(ctx, ex, ey, er * 1.1, er * 1.1);
        paint(ctx, '#ffffff');
        ctx.beginPath();
        for (let k = 0; k <= 24; k++) {
          const a = k * 0.55 + t * 9, r = (k / 24) * er;
          const px2 = ex + Math.cos(a) * r, py2 = ey + Math.sin(a) * r;
          if (k === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
        }
        ctx.stroke();
      }
      ctx.restore();
    } else {
      const closed = blinking(t, 2.1) && red < 0.3;
      for (const [ex, er] of eyes) {
        ell(ctx, ex, ey, er, er * 0.7);
        ctx.save();
        ctx.lineWidth = 0.012;
        paint(ctx, red > 0.3 ? '#ffd8d0' : TC.white);
        ctx.restore();
        if (!closed) {
          ell(ctx, ex + 0.01, ey + 0.004, er * 0.48, er * 0.48);
          paint(ctx, red > 0.3 ? '#ff2a2a' : '#1b1214', false);
        }
        // heavy lids over the top half
        ctx.beginPath();
        ctx.ellipse(ex, ey, er * 1.08, er * 0.8, 0, Math.PI, Math.PI * 2);
        ctx.lineTo(ex + er * 1.08, ey + (closed ? er * 0.5 : -er * 0.1));
        ctx.quadraticCurveTo(ex, ey + (closed ? er * 0.8 : er * 0.05), ex - er * 1.08, ey + (closed ? er * 0.5 : -er * 0.1));
        ctx.closePath();
        ctx.save();
        ctx.lineWidth = 0.012;
        paint(ctx, TC.skinD);
        ctx.restore();
      }
      if (red > 0) for (const [ex] of eyes) glow(ctx, ex + 0.01, ey, 0.11, `rgba(255,42,42,${0.85 * red})`);
    }
    // thick angry brows, inner ends pulled down, and a crease between them
    const browTilt = stunned ? -0.6 : 1;
    capsule(ctx, [[hx - 0.17, ey - 0.075 + 0.0 * browTilt], [hx - 0.0, ey - 0.04 * browTilt - (stunned ? 0.07 : 0)]], 0.045, TC.brow, 0.01);
    capsule(ctx, [[hx + 0.07, ey - 0.04 * browTilt - (stunned ? 0.07 : 0)], [hx + 0.21, ey - 0.075]], 0.04, TC.brow, 0.01);
    if (!stunned) {
      line(ctx, [[hx + 0.025, ey - 0.07], [hx + 0.03, ey - 0.02]], 0.01, 'rgba(110,40,30,0.6)');
      line(ctx, [[hx + 0.05, ey - 0.07], [hx + 0.047, ey - 0.025]], 0.01, 'rgba(110,40,30,0.6)');
    }
    // big nose
    ell(ctx, hx + 0.055, hy + 0.075, 0.068, 0.056);
    paint(ctx, hgrad(ctx, hx, hx + 0.12, TC.nose, '#b86a50'));
    ell(ctx, hx + 0.035, hy + 0.1, 0.013, 0.009);
    paint(ctx, '#5a2a1e', false);
    ell(ctx, hx + 0.085, hy + 0.1, 0.011, 0.008);
    paint(ctx, '#5a2a1e', false);
    ell(ctx, hx + 0.035, hy + 0.06, 0.02, 0.013, -0.4);
    paint(ctx, 'rgba(255,230,210,0.5)', false);
    // jowls
    ctx.save();
    ctx.lineWidth = 0.012;
    ctx.strokeStyle = 'rgba(110,40,30,0.55)';
    ctx.beginPath(); ctx.moveTo(hx - 0.1, hy + 0.09); ctx.quadraticCurveTo(hx - 0.13, hy + 0.16, hx - 0.09, hy + 0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx + 0.18, hy + 0.09); ctx.quadraticCurveTo(hx + 0.21, hy + 0.16, hx + 0.17, hy + 0.2); ctx.stroke();
    ctx.restore();
    // mouth
    if (stunned) {
      ctx.beginPath();
      for (let k = 0; k <= 10; k++) {
        const mx = hx - 0.04 + k * 0.017, my = hy + 0.165 + Math.sin(k * 1.4 + t * 8) * 0.012;
        if (k === 0) ctx.moveTo(mx, my); else ctx.lineTo(mx, my);
      }
      ctx.save(); ctx.lineWidth = 0.018; ctx.strokeStyle = '#5a1a1a'; ctx.stroke(); ctx.restore();
    } else {
      // a scowl showing clenched teeth, corners pulled down
      const mx = hx - 0.045, my = hy + 0.14, mw = 0.18, mh = 0.055;
      ctx.beginPath();
      ctx.moveTo(mx, my + mh * 0.6);
      ctx.quadraticCurveTo(mx + mw / 2, my - mh * 0.35, mx + mw, my + mh * 0.6);
      ctx.quadraticCurveTo(mx + mw / 2, my + mh * 1.25, mx, my + mh * 0.6);
      ctx.closePath();
      ctx.save();
      ctx.lineWidth = 0.014;
      paint(ctx, '#f4efe2');
      ctx.clip();
      ctx.lineWidth = 0.008;
      ctx.strokeStyle = 'rgba(80,60,50,0.7)';
      ctx.beginPath();
      ctx.moveTo(mx, my + mh * 0.55); ctx.lineTo(mx + mw, my + mh * 0.55);
      for (let k = 1; k < 6; k++) { ctx.moveTo(mx + (mw * k) / 6, my - 0.02); ctx.lineTo(mx + (mw * k) / 6, my + mh * 1.2); }
      ctx.stroke();
      ctx.restore();
      line(ctx, [[mx - 0.005, my + mh * 0.6], [mx - 0.025, my + mh * 1.1]], 0.012, 'rgba(90,30,25,0.8)');
      line(ctx, [[mx + mw + 0.005, my + mh * 0.6], [mx + mw + 0.025, my + mh * 1.1]], 0.012, 'rgba(90,30,25,0.8)');
    }
  }

  if (armsFront) { arm(farSide); arm(-farSide); }
  ctx.restore();
}

// her tight grey bun: a twisted knot held with a pin
function drawBun(ctx, x, y, r) {
  ell(ctx, x, y + r * 0.25, r * 0.95, r * 0.5);
  paint(ctx, 'rgba(40,36,48,0.35)', false);
  ell(ctx, x, y, r, r * 0.85);
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05);
  g.addColorStop(0, '#dddbe3');
  g.addColorStop(0.6, TC.hair);
  g.addColorStop(1, TC.hairD);
  paint(ctx, g);
  // twists of hair wrapping round
  ctx.save();
  ctx.lineWidth = 0.011;
  ctx.strokeStyle = 'rgba(70,66,80,0.7)';
  for (let k = 0; k < 4; k++) {
    const a0 = k * (Math.PI / 2) + 0.3;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a0) * r * 0.9, y + Math.sin(a0) * r * 0.78);
    ctx.quadraticCurveTo(x + Math.cos(a0 + 0.9) * r * 0.75, y + Math.sin(a0 + 0.9) * r * 0.65, x + Math.cos(a0 + 1.6) * r * 0.2, y + Math.sin(a0 + 1.6) * r * 0.18);
    ctx.stroke();
  }
  ctx.restore();
  ell(ctx, x - r * 0.3, y - r * 0.35, r * 0.25, r * 0.13, -0.5);
  paint(ctx, 'rgba(255,255,255,0.35)', false);
  line(ctx, [[x - r * 1.15, y + r * 0.35], [x + r * 0.95, y - r * 0.45]], 0.015, '#2e2e34');
  ell(ctx, x + r * 0.95, y - r * 0.45, 0.012, 0.012);
  paint(ctx, '#2e2e34', false);
}
