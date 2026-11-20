/* Vice Cover Studio v2 — canvas movie-poster renderer + studio logic.
   Fresh build from scratch. No libraries, no external assets.
   The poster is drawn entirely on <canvas>: photos, chrome title, tags,
   billing block, barcode, seal, grain and vignette. */

'use strict';

const canvas = document.getElementById('poster');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

const CAST = [
  { key: 'driver',   role: 'THE DRIVER',   file: 'photos/hero-driver.jpg',      caption: 'OCEAN DRIVE · 6:42 PM · LOOKING FOR TROUBLE', hero: true },
  { key: 'boss',     role: 'THE BOSS',     file: 'photos/boss-silver.jpg',      caption: 'SILVER PALMS · 7:05 PM · OWNS THE ROOM' },
  { key: 'mechanic', role: 'THE MECHANIC', file: 'photos/mechanic-red.jpg',     caption: 'GARAGE 88 · 5:58 PM · FIXES ANYTHING' },
  { key: 'captain',  role: 'THE CAPTAIN',  file: 'photos/captain-hat.jpg',      caption: 'MARINA BAY · 8:15 PM · NEVER LOSES A RACE' },
  { key: 'rider',    role: 'THE RIDER',    file: 'photos/rider-leather.jpg',    caption: 'ROUTE 9 · 9:40 PM · FASTER THAN RUMOR' },
  { key: 'lookout',  role: 'THE LOOKOUT',  file: 'photos/lookout-dark.jpg',     caption: 'ROOFTOP 12 · 11:02 PM · SEES EVERYTHING' },
  { key: 'wheelman', role: 'THE WHEELMAN', file: 'photos/wheelman-floral.jpg',  caption: 'NEON STRIP · 12:30 AM · DRIVES THE GETAWAY' },
];

const GRADES = {
  sunset:   { filter: 'saturate(1.28) contrast(1.10) sepia(0.16) brightness(1.02)', tint: 'rgba(255,110,20,0.10)', sky: ['#2b0a4e', '#7a1e6e', '#e0397a', '#ff7a1a', '#ffc93c'] },
  neon:     { filter: 'saturate(1.65) contrast(1.16) hue-rotate(-14deg) brightness(1.03)', tint: 'rgba(255,0,150,0.12)', sky: ['#12063a', '#4b0f7a', '#c2189b', '#ff2e88', '#ff9a3d'] },
  golden:   { filter: 'sepia(0.38) saturate(1.45) contrast(1.06) brightness(1.04)', tint: 'rgba(255,190,60,0.12)', sky: ['#3a1c00', '#8a3d00', '#d96b00', '#ff9d2e', '#ffe259'] },
  twilight: { filter: 'saturate(1.12) hue-rotate(24deg) brightness(0.92) contrast(1.12)', tint: 'rgba(60,40,160,0.14)', sky: ['#0a1030', '#2c1a5e', '#6b2a8a', '#c94b8a', '#ff8a5c'] },
  heatwave: { filter: 'saturate(1.55) contrast(1.22) sepia(0.26) brightness(1.06)', tint: 'rgba(255,60,0,0.13)', sky: ['#33060a', '#7a0e1e', '#d92b2b', '#ff7a1a', '#ffd23c'] },
  noir:     { filter: 'grayscale(1) contrast(1.28) brightness(0.95)', tint: 'rgba(0,0,0,0.10)', sky: ['#050505', '#1c1c22', '#3a3a44', '#6a6a76', '#c9c9d4'] },
};

const state = {
  title: 'VICE HEAT',
  subtitle: 'Kings of the Coast',
  quote: 'A FEVER DREAM IN NEON',
  tagline: 'SEVEN LIVES · ONE COAST · NO WAY BACK',
  grade: 'sunset',
  layout: 'center',
  images: {},          // key -> HTMLImageElement (or null while loading)
  custom: {},          // key -> object URL of a user-uploaded photo
};

let imagesReady = 0;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function setStatus(msg, ok) {
  statusEl.textContent = msg;
  statusEl.className = ok ? 'ok' : '';
}

/* Draw an image cover-cropped into a rect (no distortion). */
function drawCover(c, img, x, y, w, h) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale, sh = h / scale;
  const sx = (iw - sw) / 2, sy = (ih - sh) / 2;
  c.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/* Deterministic pseudo-random from a seed, for grain + barcode. */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/* ------------------------------------------------------------------ */
/* Poster geometry (all fractions of W/H so exports re-render cleanly) */
/* ------------------------------------------------------------------ */

function layout(W, H) {
  const topH = H * 0.072;
  const panelTop = H * 0.088;
  const panelBot = H * 0.715;
  const gap = W * 0.010;
  const sideW = W * 0.115;
  const heroW = W - sideW * 6 - gap * 6 - W * 0.02;
  const heroX = W * 0.01 + sideW * 3 + gap * 3.5;
  const panels = [];
  // Left block: boss, mechanic, captain (top to bottom order in code is
  // left-to-right on screen); right block: rider, lookout, wheelman.
  const leftKeys = ['boss', 'mechanic', 'captain'];
  const rightKeys = ['rider', 'lookout', 'wheelman'];
  leftKeys.forEach((key, i) => {
    panels.push({ key, x: W * 0.01 + i * (sideW + gap), y: panelTop, w: sideW, h: panelBot - panelTop });
  });
  rightKeys.forEach((key, i) => {
    panels.push({ key, x: heroX + heroW + gap + i * (sideW + gap), y: panelTop, w: sideW, h: panelBot - panelTop });
  });
  return {
    W, H, topH, panelTop, panelBot, gap,
    hero: { key: 'driver', x: heroX, y: panelTop, w: heroW, h: panelBot - panelTop },
    panels,
  };
}

/* ------------------------------------------------------------------ */
/* Poster pieces                                                       */
/* ------------------------------------------------------------------ */

function drawSky(c, W, H, grade) {
  const g = c.createLinearGradient(0, 0, 0, H);
  grade.sky.forEach((col, i) => g.addColorStop(i / (grade.sky.length - 1), col));
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  // Low sun glow behind the hero.
  const sun = c.createRadialGradient(W * 0.5, H * 0.42, 10, W * 0.5, H * 0.42, W * 0.42);
  sun.addColorStop(0, 'rgba(255,214,90,0.55)');
  sun.addColorStop(0.45, 'rgba(255,122,26,0.28)');
  sun.addColorStop(1, 'rgba(255,122,26,0)');
  c.fillStyle = sun;
  c.fillRect(0, 0, W, H);
}

function drawPanel(c, p, grade, slant) {
  const member = CAST.find((m) => m.key === p.key);
  const img = state.images[p.key];
  c.save();
  if (slant) {
    c.translate(p.x + p.w / 2, p.y + p.h / 2);
    c.rotate(slant);
    c.translate(-(p.x + p.w / 2), -(p.y + p.h / 2));
  }
  // Frame.
  c.fillStyle = '#0a0514';
  c.fillRect(p.x - 3, p.y - 3, p.w + 6, p.h + 6);
  if (img) {
    c.save();
    c.beginPath();
    c.rect(p.x, p.y, p.w, p.h);
    c.clip();
    c.filter = grade.filter;
    drawCover(c, img, p.x, p.y, p.w, p.h);
    c.restore();
    // Warm grade tint + bottom shade so tags stay readable.
    c.fillStyle = grade.tint;
    c.fillRect(p.x, p.y, p.w, p.h);
    const shade = c.createLinearGradient(0, p.y + p.h * 0.55, 0, p.y + p.h);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.55)');
    c.fillStyle = shade;
    c.fillRect(p.x, p.y, p.w, p.h);
  } else {
    c.fillStyle = '#241239';
    c.fillRect(p.x, p.y, p.w, p.h);
  }
  c.restore();
  drawRoleTag(c, p, member);
  drawCaption(c, p, member);
}

function drawRoleTag(c, p, member) {
  const fs = Math.max(13, p.w * 0.085);
  c.save();
  c.font = `900 ${fs}px "Arial Black", Arial, sans-serif`;
  const tw = c.measureText(member.role).width;
  const pad = fs * 0.55;
  const bw = tw + pad * 2 + fs * 0.5;
  const bh = fs * 1.9;
  const bx = p.x + p.w * 0.045;
  const by = p.y + p.h * 0.045;
  c.fillStyle = 'rgba(0,0,0,0.88)';
  roundRect(c, bx, by, bw, bh, bh * 0.22);
  c.fill();
  // Yellow left bar.
  c.fillStyle = '#ffc93c';
  c.fillRect(bx, by, fs * 0.5, bh);
  c.fillStyle = '#ffffff';
  c.textBaseline = 'middle';
  c.fillText(member.role, bx + pad + fs * 0.5, by + bh / 2 + 1);
  c.restore();
}

function drawCaption(c, p, member) {
  const fs = Math.max(10, p.w * 0.058);
  c.save();
  c.font = `700 ${fs}px Arial, sans-serif`;
  c.fillStyle = 'rgba(255,255,255,0.92)';
  c.shadowColor = 'rgba(0,0,0,0.9)';
  c.shadowBlur = 4;
  const x = p.x + p.w * 0.045;
  const y = p.y + p.h * 0.045 + fs * 2.6;
  // Wrap caption onto at most two lines.
  const words = member.caption.split(' ');
  let line = '', lines = [];
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (c.measureText(test).width > p.w * 0.92 && line) { lines.push(line); line = w; }
    else line = test;
  }
  lines.push(line);
  lines.slice(0, 2).forEach((ln, i) => c.fillText(ln, x, y + i * fs * 1.35));
  c.restore();
}

/* Huge striped retro-chrome 3D title, drawn DIRECTLY on the main canvas.
   (An earlier offscreen-mask version was dropped: this headless Chromium
   silently drops drawImage of an offscreen canvas whose bitmap was built
   with a gradient + non-source-over composite — solid colours survive,
   gradients do not. Direct fillText with a gradient fillStyle works.) */
function drawChromeTitle(c, text, W, H) {
  const fs = W * 0.148;
  c.save();
  c.translate(W / 2, H * 0.63);
  c.rotate(-0.022);
  c.font = `900 ${fs}px "Arial Black", Impact, Arial, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  // Hard 3D depth: dark copies offset down-right, then a thick outline.
  c.fillStyle = '#160428';
  c.fillText(text, fs * 0.028, fs * 0.045);
  c.lineWidth = fs * 0.055;
  c.strokeStyle = '#160428';
  c.strokeText(text, 0, 0);
  // Vertical sunset gradient fill.
  const grad = c.createLinearGradient(0, -fs * 0.62, 0, fs * 0.62);
  grad.addColorStop(0.00, '#ffe259');
  grad.addColorStop(0.28, '#ffb03c');
  grad.addColorStop(0.48, '#ff7a1a');
  grad.addColorStop(0.62, '#ff4fa3');
  grad.addColorStop(0.82, '#c65cff');
  grad.addColorStop(1.00, '#7a3cff');
  c.shadowColor = 'rgba(20,2,40,0.85)';
  c.shadowBlur = W * 0.012;
  c.shadowOffsetY = H * 0.012;
  c.fillStyle = grad;
  c.fillText(text, 0, 0);
  c.shadowColor = 'transparent';
  c.shadowBlur = 0;
  c.shadowOffsetY = 0;
  // Chrome stripes: a repeating light-band pattern painted over the glyphs.
  const stripe = document.createElement('canvas');
  stripe.width = 4;
  stripe.height = Math.max(8, Math.round(fs * 0.30));
  const s = stripe.getContext('2d');
  s.fillStyle = 'rgba(255,255,255,0.55)';
  s.fillRect(0, 0, 4, Math.round(fs * 0.055));
  s.fillStyle = 'rgba(0,0,0,0.28)';
  s.fillRect(0, Math.round(fs * 0.14), 4, Math.round(fs * 0.04));
  c.globalAlpha = 0.55;
  c.fillStyle = c.createPattern(stripe, 'repeat');
  c.fillText(text, 0, 0);
  c.globalAlpha = 1;
  c.restore();
}

function drawSubtitle(c, text, W, H) {
  const fs = W * 0.042;
  c.save();
  c.translate(W / 2, H * 0.76);
  c.rotate(-0.022);
  c.font = `italic 700 ${fs}px "Brush Script MT", "Segoe Script", "Comic Sans MS", cursive`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.shadowColor = '#ff4fa3';
  c.shadowBlur = W * 0.014;
  c.fillStyle = '#ff8ac2';
  c.fillText(text, 0, 0);
  c.shadowBlur = 0;
  c.fillStyle = '#ffd7ea';
  c.fillText(text, 0, -1);
  c.restore();
}

function drawTopBar(c, W, H, geo) {
  const barH = geo.topH;
  c.save();
  c.fillStyle = 'rgba(8,2,18,0.94)';
  c.fillRect(0, 0, W, barH);
  c.fillStyle = '#ffc93c';
  c.fillRect(0, barH - 3, W, 3);
  const cy = barH / 2;
  // Five gold stars.
  const starR = barH * 0.30;
  let sx = W * 0.018;
  for (let i = 0; i < 5; i++) {
    drawStar(c, sx + starR, cy, starR, '#ffc93c');
    sx += starR * 2.3;
  }
  // Quote, centered.
  const qfs = Math.max(13, W * 0.0175);
  c.font = `900 ${qfs}px "Arial Black", Arial, sans-serif`;
  c.fillStyle = '#ffffff';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const quote = `“${state.quote}”`;
  const qx = W * 0.5;
  c.fillText(quote, qx, cy - 1);
  // Source under the quote is folded into one line on narrow widths;
  // keep the source as a smaller caps line right of the stars instead.
  c.font = `700 ${Math.max(10, W * 0.011)}px Arial, sans-serif`;
  c.fillStyle = '#ffc93c';
  c.textAlign = 'left';
  c.fillText('— THE COAST HERALD', sx + W * 0.012, cy);
  // VOL badge + WANTED badge, right side.
  const badgeH = barH * 0.62;
  const badgeFs = Math.max(11, W * 0.013);
  c.font = `900 ${badgeFs}px Arial, sans-serif`;
  const volText = 'VOL. 02';
  const volW = c.measureText(volText).width + badgeFs * 1.4;
  const wantedText = '★ WANTED ★';
  const wantW = c.measureText(wantedText).width + badgeFs * 1.4;
  let bx = W - W * 0.014 - wantW;
  c.fillStyle = '#ff2e63';
  roundRect(c, bx, cy - badgeH / 2, wantW, badgeH, 5);
  c.fill();
  c.fillStyle = '#fff';
  c.textAlign = 'center';
  c.fillText(wantedText, bx + wantW / 2, cy + 1);
  bx -= W * 0.008 + volW;
  c.fillStyle = '#ffc93c';
  roundRect(c, bx, cy - badgeH / 2, volW, badgeH, 5);
  c.fill();
  c.fillStyle = '#160428';
  c.fillText(volText, bx + volW / 2, cy + 1);
  c.restore();
}

function drawStar(c, cx, cy, r, color) {
  c.save();
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.closePath();
  c.fillStyle = color;
  c.fill();
  c.restore();
}

function drawTaglineStrip(c, W, H) {
  const y = H * 0.815, h = H * 0.052;
  c.save();
  c.fillStyle = '#0a0514';
  c.fillRect(0, y, W, h);
  c.fillStyle = '#ffc93c';
  c.fillRect(0, y, W, 2);
  c.fillRect(0, y + h - 2, W, 2);
  // Palm silhouettes flanking the tagline.
  drawPalm(c, W * 0.028, y + h, h * 1.9, 1);
  drawPalm(c, W * 0.972, y + h, h * 1.9, -1);
  const fs = Math.max(13, W * 0.019);
  c.font = `900 ${fs}px "Arial Black", Arial, sans-serif`;
  c.fillStyle = '#ffffff';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(state.tagline, W / 2, y + h / 2 + 1);
  c.restore();
}

/* Simple palm-tree silhouette: curved trunk + five drooping fronds. */
function drawPalm(c, x, baseY, size, dir) {
  c.save();
  c.translate(x, baseY);
  c.scale(dir, 1);
  c.strokeStyle = 'rgba(255,201,60,0.9)';
  c.fillStyle = 'rgba(255,201,60,0.9)';
  c.lineWidth = size * 0.045;
  c.lineCap = 'round';
  // Trunk, leaning slightly.
  c.beginPath();
  c.moveTo(0, 0);
  c.quadraticCurveTo(size * 0.10, -size * 0.45, size * 0.22, -size * 0.72);
  c.stroke();
  const tx = size * 0.22, ty = -size * 0.72;
  // Fronds.
  const fronds = [
    [-0.95, -0.55, -1.55, -0.15], [-0.55, -0.85, -1.05, -0.75],
    [0.05, -1.0, 0.1, -1.15], [0.6, -0.85, 1.1, -0.7], [0.95, -0.5, 1.5, -0.1],
  ];
  c.lineWidth = size * 0.05;
  fronds.forEach(([dx1, dy1, dx2, dy2]) => {
    c.beginPath();
    c.moveTo(tx, ty);
    c.quadraticCurveTo(tx + size * dx1 * 0.55, ty + size * dy1 * 0.55, tx + size * dx2 * 0.55, ty + size * dy2 * 0.55);
    c.stroke();
  });
  c.restore();
}

function drawBilling(c, W, H) {
  const y = H * 0.878;
  // Dark bottom band so the credits + COMING SOON read over any grade.
  c.save();
  c.fillStyle = 'rgba(8,2,18,0.92)';
  c.fillRect(0, H * 0.867, W, H * 0.133);
  c.fillStyle = '#ffc93c';
  c.fillRect(0, H * 0.867, W, 2);
  c.restore();
  c.save();
  c.textAlign = 'left';
  c.textBaseline = 'top';
  const fs1 = Math.max(10, W * 0.0115);
  const fs2 = Math.max(9, W * 0.0098);
  c.font = `700 ${fs1}px Arial, sans-serif`;
  c.fillStyle = 'rgba(255,255,255,0.95)';
  c.fillText('A VICE HEAT PICTURE', W * 0.012, y);
  c.font = `400 ${fs2}px Arial, sans-serif`;
  c.fillStyle = 'rgba(255,255,255,0.75)';
  c.fillText('STARRING YOUR CREW  ·  SHOT ON YOUR OWN CAMERA  ·  GRADED AT SUNSET', W * 0.012, y + fs1 * 1.55);
  c.fillText('VICE CITY  ·  OCEAN DRIVE  ·  PALMLINE STUDIOS  ·  ALL CHARACTERS ORIGINAL', W * 0.012, y + fs1 * 1.55 + fs2 * 1.5);
  // COMING SOON, right of the credits.
  const csFs = Math.max(14, W * 0.02);
  c.font = `900 ${csFs}px "Arial Black", Arial, sans-serif`;
  c.fillStyle = '#ffc93c';
  c.textAlign = 'right';
  c.fillText('COMING SOON', W * 0.865, y + 2);
  c.restore();
  drawBarcode(c, W, H);
  drawSeal(c, W, H);
}

function drawBarcode(c, W, H) {
  const bw = W * 0.085, bh = H * 0.055;
  const bx = W * 0.895, by = H * 0.885;
  c.save();
  c.fillStyle = '#ffffff';
  c.fillRect(bx - 5, by - 5, bw + 10, bh + 24);
  const rnd = mulberry32(20261121);
  let x = bx;
  c.fillStyle = '#000000';
  while (x < bx + bw - 2) {
    const wBar = 1 + Math.floor(rnd() * 4) * (W / 1600);
    const gapBar = 1 + Math.floor(rnd() * 3) * (W / 1600);
    if (rnd() > 0.35) c.fillRect(x, by, Math.max(1.5, wBar), bh);
    x += wBar + gapBar;
  }
  c.font = `400 ${Math.max(8, W * 0.0075)}px Arial, sans-serif`;
  c.fillStyle = '#000';
  c.textAlign = 'center';
  c.fillText('8 90211 06021 7', bx + bw / 2, by + bh + 9);
  c.restore();
}

function drawSeal(c, W, H) {
  const cx = W * 0.935, cy = H * 0.795;
  const r = W * 0.042;
  c.save();
  c.translate(cx, cy);
  c.rotate(0.12);
  // Starburst.
  c.beginPath();
  const spikes = 20;
  for (let i = 0; i < spikes * 2; i++) {
    const rad = i % 2 === 0 ? r : r * 0.82;
    const a = (i * Math.PI) / spikes - Math.PI / 2;
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.closePath();
  c.fillStyle = '#ffc93c';
  c.fill();
  c.lineWidth = 2.5;
  c.strokeStyle = '#7a4d00';
  c.stroke();
  c.beginPath();
  c.arc(0, 0, r * 0.72, 0, Math.PI * 2);
  c.lineWidth = 1.5;
  c.strokeStyle = '#7a4d00';
  c.stroke();
  c.fillStyle = '#160428';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const fs = r * 0.24;
  c.font = `900 ${fs}px "Arial Black", Arial, sans-serif`;
  c.fillText('ORIGINAL', 0, -fs * 0.75);
  c.fillText('COVER ART', 0, fs * 0.35);
  c.font = `700 ${fs * 0.8}px Arial, sans-serif`;
  c.fillText('★ ★ ★', 0, fs * 1.25);
  c.restore();
}

/* Film grain + vignette, drawn last so they sit over everything. */
function drawFinish(c, W, H) {
  const rnd = mulberry32(777);
  c.save();
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * W, y = rnd() * H;
    c.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    c.fillRect(x, y, 1.4, 1.4);
  }
  const vig = c.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, W * 0.72);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(10,2,20,0.42)');
  c.fillStyle = vig;
  c.fillRect(0, 0, W, H);
  c.restore();
}

/* ------------------------------------------------------------------ */
/* Master render                                                       */
/* ------------------------------------------------------------------ */

function renderPoster(targetCtx, W, H) {
  const c = targetCtx;
  const grade = GRADES[state.grade];
  const geo = layout(W, H);
  c.clearRect(0, 0, W, H);
  drawSky(c, W, H, grade);
  // Side panels first, hero last so it can overlap. Slanted layout tilts
  // the side panels in alternating directions for a dynamic comic feel.
  const slanted = state.layout === 'slanted';
  geo.panels.forEach((p, i) => drawPanel(c, p, grade, slanted ? (i % 2 === 0 ? -0.028 : 0.028) : 0));
  drawHero(c, geo.hero, grade, geo);
  drawTopBar(c, W, H, geo);
  drawChromeTitle(c, state.title, W, H);
  drawSubtitle(c, state.subtitle, W, H);
  drawTaglineStrip(c, W, H);
  drawBilling(c, W, H);
  drawFinish(c, W, H);
}

/* Hero: large center panel with the POP-OUT differentiator — the hero
   photo breaks out of its frame: it rises above the panel row to overlap
   the top bar, and sinks below it to overlap the title band, with a hard
   drop shadow so the poster's silhouette is unmistakable in a thumbnail. */
function drawHero(c, p, grade, geo) {
  const img = state.images[p.key];
  const member = CAST.find((m) => m.key === p.key);
  const outTop = p.y - geo.topH * 0.55;          // breaks into the top bar
  const popH = (p.y + p.h + geo.H * 0.045) - outTop;
  c.save();
  // Hard drop shadow behind the popped-out frame.
  c.fillStyle = 'rgba(10,2,20,0.55)';
  c.fillRect(p.x - 3 + 10, outTop + 12, p.w + 6, popH);
  c.fillStyle = '#0a0514';
  c.fillRect(p.x - 3, outTop, p.w + 6, popH);
  if (img) {
    c.save();
    c.beginPath();
    c.rect(p.x, outTop, p.w, popH);
    c.clip();
    c.filter = grade.filter;
    drawCover(c, img, p.x, outTop, p.w, popH);
    c.restore();
    c.fillStyle = grade.tint;
    c.fillRect(p.x, outTop, p.w, popH);
    const shade = c.createLinearGradient(0, outTop + popH * 0.55, 0, outTop + popH);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.55)');
    c.fillStyle = shade;
    c.fillRect(p.x, outTop, p.w, popH);
  } else {
    c.fillStyle = '#241239';
    c.fillRect(p.x, outTop, p.w, popH);
  }
  c.restore();
  // Role tag + caption sit inside the popped-out frame.
  drawRoleTag(c, { x: p.x, y: outTop, w: p.w, h: popH }, member);
  drawCaption(c, { x: p.x, y: outTop, w: p.w, h: popH }, member);
}

function render() {
  renderPoster(ctx, canvas.width, canvas.height);
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

function exportPNG(aspect) {
  let W, H;
  if (aspect === '1:1') { W = 1080; H = 1080; }
  else if (aspect === '4:5') { W = 1080; H = 1350; }
  else { W = 1600; H = 900; }
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const octx = off.getContext('2d');
  renderPoster(octx, W, H);
  off.toBlob((blob) => {
    if (!blob) { setStatus('Export failed — canvas is empty.', false); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vice-heat-poster-${aspect.replace(':', 'x')}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setStatus(`Exported ${aspect} PNG (${W}×${H}).`, true);
  }, 'image/png');
}

/* ------------------------------------------------------------------ */
/* Studio wiring                                                       */
/* ------------------------------------------------------------------ */

function bindControls() {
  const bindText = (id, key) => {
    const el = document.getElementById(id);
    el.addEventListener('input', () => { state[key] = el.value; render(); });
  };
  bindText('inTitle', 'title');
  bindText('inSubtitle', 'subtitle');
  bindText('inQuote', 'quote');
  bindText('inTagline', 'tagline');

  document.getElementById('inGrade').addEventListener('change', (e) => {
    state.grade = e.target.value; render();
  });
  document.getElementById('inLayout').addEventListener('change', (e) => {
    state.layout = e.target.value; render();
  });
  document.querySelectorAll('[data-export]').forEach((btn) => {
    btn.addEventListener('click', () => exportPNG(btn.dataset.export));
  });
}

function buildCastList() {
  const list = document.getElementById('castList');
  CAST.forEach((member) => {
    const row = document.createElement('div');
    row.className = 'cast-row';
    const role = document.createElement('span');
    role.className = 'role';
    role.textContent = member.role;
    const fname = document.createElement('span');
    fname.className = 'fname';
    fname.id = `fname-${member.key}`;
    fname.textContent = member.file.split('/').pop();
    const label = document.createElement('label');
    label.className = 'up';
    label.textContent = 'Upload';
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      loadImage(url).then((img) => {
        if (img) {
          state.images[member.key] = img;
          state.custom[member.key] = url;
          fname.textContent = file.name;
          render();
          setStatus(`${member.role} photo replaced.`, true);
        }
      });
    });
    label.appendChild(input);
    row.appendChild(role);
    row.appendChild(fname);
    row.appendChild(label);
    list.appendChild(row);
  });
}

async function init() {
  bindControls();
  buildCastList();
  const jobs = CAST.map((m) => loadImage(m.file).then((img) => {
    state.images[m.key] = img;
    imagesReady++;
    render();
  }));
  await Promise.all(jobs);
  const loaded = CAST.filter((m) => state.images[m.key]).length;
  if (loaded === CAST.length) setStatus(`Cast ready — ${loaded}/7 photos loaded. Edit, grade, export.`, true);
  else setStatus(`Only ${loaded}/7 photos loaded — check the photos/ folder.`, false);
  render();
}

init();
