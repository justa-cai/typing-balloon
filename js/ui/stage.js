/**
 * ui/stage.js - Canvas 像素渲染层
 *
 * 只做一件事：把 rules.js 给出的状态画到画布上。**不判断规则、不推进时间**——
 * 连小鸟飞到哪一帧都是按 rules 打的时间戳算出来的，这里不自己计时。
 *
 * ── 像素是怎么保证的 ─────────────────────────────────────────────────
 *
 *   1) 逻辑分辨率固定 256×240（FC 原生），canvas.width/height 就是它，
 *      内部所有坐标都按这个尺寸算，不存在"半个像素"；
 *   2) 显示尺寸只取**整数倍**（2x / 3x / 4x），配合 CSS 的
 *      `image-rendering: pixelated`，放大后每个逻辑像素正好是 N×N 个屏幕像素；
 *   3) 所有图形都用 fillRect 逐行/逐游程画，**不用 ctx.arc / ellipse**——
 *      那些会抗锯齿，边缘会糊成灰的，放大后一眼就看出不是像素画。
 *
 * ── 颜色 ─────────────────────────────────────────────────────────────
 *
 * 所有颜色都从 tokens.css 的 `--nes-*` 变量读进来（readPalette），
 * 渲染代码里不出现任何硬编码色值。这是本系列的硬约束（见 CLAUDE.md）：
 * 想换配色只改 tokens.css 一个地方。
 *
 * @license MIT
 */

import { drawText, drawTextCentered, drawHanzi, GLYPH_H } from './pixelfont.js';
import { SPRITE, GEOMETRY } from '../rules.js';

/** 气球配色个数，与 rules.js 里的 color 取值域一致 */
const BALLOON_COLORS = 8;

/** 云的高度与漂移速度（逻辑像素 / 秒） */
const CLOUD_SPEED = 3;

/**
 * 从 CSS 自定义属性里读出一整套 NES 调色板。
 * 读不到（比如样式表还没加载完）会退回一组兜底色，保证画面不黑屏。
 *
 * @param {HTMLElement} [el] 取计算样式的元素，默认 documentElement
 * @returns {object} 调色板
 */
export function readPalette(el) {
  const target = el || document.documentElement;
  const cs = getComputedStyle(target);
  const get = (name, fallback) => {
    const v = cs.getPropertyValue(name);
    return v && v.trim() ? v.trim() : fallback;
  };

  const balloons = [];
  for (let i = 0; i < BALLOON_COLORS; i++) {
    balloons.push(get(`--nes-balloon-${i}`, '#f83800'));
  }

  return {
    sky: get('--nes-sky', '#5c94fc'),
    cloud: get('--nes-cloud', '#fcfcfc'),
    cloudShade: get('--nes-cloud-shade', '#b8d8f8'),
    hudBg: get('--nes-hud-bg', '#000000'),
    text: get('--nes-text', '#fcfcfc'),
    textDim: get('--nes-text-dim', '#bcbcbc'),
    ink: get('--nes-ink', '#000000'),
    outline: get('--nes-outline', '#000000'),
    grass: get('--nes-grass', '#00a800'),
    grassDark: get('--nes-grass-dark', '#007800'),
    dirt: get('--nes-dirt', '#c84c0c'),
    dirtDark: get('--nes-dirt-dark', '#8c3000'),
    beak: get('--nes-beak', '#fce438'),
    balloons
  };
}

/**
 * 建一个渲染器。
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} opts
 * @param {object} opts.palette 由 readPalette() 得到
 * @returns {object} { resize, draw, logicalSize }
 */
export function createStage(canvas, { palette }) {
  const ctx = canvas.getContext('2d');
  const W = GEOMETRY.W;
  const H = GEOMETRY.H;

  // 逻辑分辨率固定，缩放只发生在 CSS 尺寸上
  canvas.width = W;
  canvas.height = H;
  ctx.imageSmoothingEnabled = false;

  let scale = 1;

  /** 云是装饰，位置只跟逻辑时钟有关，不需要记在 rules 里 */
  const clouds = [
    { x: 20, y: 34, w: 26, speed: CLOUD_SPEED },
    { x: 120, y: 26, w: 34, speed: CLOUD_SPEED * 0.7 },
    { x: 205, y: 46, w: 22, speed: CLOUD_SPEED * 1.3 }
  ];

  /**
   * 按可用空间算一个**整数**倍率。
   * 上限 4 倍：再大就该考虑缩放了，而不是让一个 256px 的画面占满 2K 屏。
   *
   * @param {number} availW 可用宽（CSS 像素）
   * @param {number} availH 可用高（CSS 像素）
   */
  function resize(availW, availH) {
    const raw = Math.min(availW / W, availH / H);
    const next = Math.max(1, Math.min(4, Math.floor(raw)));
    scale = next;
    canvas.style.width = W * scale + 'px';
    canvas.style.height = H * scale + 'px';
    return scale;
  }

  /**
   * 画一帧。
   *
   * @param {object} state rules.createGame() 的状态
   */
  function draw(state) {
    const t = state.clock;

    // ── 天空 ────────────────────────────────────────────────────────
    ctx.fillStyle = palette.sky;
    ctx.fillRect(0, 0, W, H);

    drawClouds(t);

    // ── 地面（先画地面，气球落地时压在坑上才自然）───────────────────
    drawGround(state);

    // ── 气球 ────────────────────────────────────────────────────────
    for (const b of state.balloons) {
      drawBalloon(b, state.activeId === b.id, state.mode);
    }

    // ── 特效（扬尘在小鸟之下，炸开在最上）───────────────────────────
    for (const e of state.effects) {
      if (e.type === 'dust') drawDust(e, t);
    }
    for (const e of state.effects) {
      if (e.type === 'cave') drawCave(e, t);
    }
    for (const e of state.effects) {
      if (e.type === 'bird') drawBird(e, t);
    }
    for (const e of state.effects) {
      if (e.type === 'burst') drawBurst(e, t);
    }

    // ── 顶部信息条 ──────────────────────────────────────────────────
    drawHud(state);
  }

  // ────────────────────────────────────────────────────────────────────
  // 天空 / 地面
  // ────────────────────────────────────────────────────────────────────

  function drawClouds(t) {
    const span = W + 60;
    for (const c of clouds) {
      const x = ((c.x + (t / 1000) * c.speed) % span) - 30;
      drawCloud(x, c.y, c.w);
    }
  }

  /** 云 = 三块圆角像素条堆出来的形状，全部走 fillRect */
  function drawCloud(x0, y0, w) {
    const x = Math.round(x0);
    const y = Math.round(y0);
    const h = Math.max(4, Math.round(w / 4));
    ctx.fillStyle = palette.cloud;
    ctx.fillRect(x + 2, y, w - 4, h);
    ctx.fillRect(x, y + 2, w, h - 2);
    ctx.fillRect(x + 6, y - 2, Math.round(w * 0.4), 3);
    ctx.fillStyle = palette.cloudShade;
    ctx.fillRect(x, y + h, w, 2);
  }

  function drawGround(state) {
    const colW = W / GEOMETRY.COLUMNS;
    for (let c = 0; c < GEOMETRY.COLUMNS; c++) {
      const x = Math.round(c * colW);
      const w = Math.round((c + 1) * colW) - x;
      const surface = Math.round(state.ground[c]);
      if (surface >= GEOMETRY.GROUND_BOTTOM) continue; // 这一列已经掏穿

      const depth = GEOMETRY.GROUND_BOTTOM - surface;
      ctx.fillStyle = palette.dirt;
      ctx.fillRect(x, surface, w, depth);

      // 草皮层：只在没被砸掉的前提下画
      if (surface <= GEOMETRY.GROUND_TOP + 1) {
        ctx.fillStyle = palette.grass;
        ctx.fillRect(x, surface, w, 3);
        ctx.fillStyle = palette.grassDark;
        ctx.fillRect(x, surface + 3, w, 1);
      }

      // 泥土纹理：每 5px 一道深色短线，让断面看起来是土不是纯色块
      ctx.fillStyle = palette.dirtDark;
      for (let y = surface + 7; y < GEOMETRY.GROUND_BOTTOM; y += 5) {
        const off = ((c * 3 + y) % 5) - 1;
        ctx.fillRect(x + Math.max(1, off), y, Math.max(2, w - 4), 1);
      }
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // 气球
  // ────────────────────────────────────────────────────────────────────

  function drawBalloon(b, active, mode) {
    const color = palette.balloons[b.color % palette.balloons.length];
    const cx = Math.round(b.x + b.w / 2);
    const cy = Math.round(b.y + b.h / 2);
    const rx = Math.max(3, b.w / 2 - 1);
    const ry = Math.max(3, b.h / 2 - 1);

    // 从外到内叠三层椭圆：选中态的白圈 → 1px 黑边 → 气球本体色。
    // 轮廓一律用 fillRect 逐行画（见 ellipse 的说明），顺序错了就会被盖掉，
    // 所以这里从大到小依次画，不做任何"挖空"。
    if (active) ellipse(cx, cy, rx + 2, ry + 2, palette.text);
    ellipse(cx, cy, rx + 1, ry + 1, palette.outline);
    ellipse(cx, cy, rx, ry, color);

    // 高光：左上角一小块，气球的体积感全靠它
    ctx.fillStyle = palette.cloud;
    ctx.fillRect(Math.round(cx - rx * 0.45), Math.round(cy - ry * 0.55), 2, 3);
    ctx.fillRect(Math.round(cx - rx * 0.45) + 1, Math.round(cy - ry * 0.55) - 1, 1, 1);

    // 结 + 线
    const bottom = Math.round(cy + ry);
    ctx.fillStyle = palette.outline;
    ctx.fillRect(cx - 2, bottom + 1, 4, 1);
    ctx.fillRect(cx - 1, bottom + 2, 2, 1);
    for (let i = 0; i < SPRITE.STRING; i++) {
      const wobble = i === 2 ? 1 : 0;
      ctx.fillRect(cx + wobble, bottom + 3 + i, 1, 1);
    }

    // 文字
    if (mode === 'hanzi') {
      drawHanzi(ctx, b.text, Math.round(cx - SPRITE.HANZI / 2),
                Math.round(cy - SPRITE.HANZI / 2), palette.ink, SPRITE.HANZI);
    } else {
      drawTextCentered(ctx, b.text, cx, Math.round(cy - GLYPH_H / 2), palette.ink);
    }

    // 输入进度条：贴在气球底部内侧，1px 高。
    // 用进度条而不是给字母变色，是因为气球配色有深有浅，
    // 换色在浅色气球上根本看不见——进度条对任何底色都成立。
    if (b.match.length > 1 && b.typed > 0) {
      const barW = Math.max(2, b.w - 8);
      const filled = Math.round(barW * Math.min(1, b.typed / b.match.length));
      const by = bottom - 3;
      ctx.fillStyle = palette.outline;
      ctx.fillRect(cx - Math.round(barW / 2), by, barW, 2);
      ctx.fillStyle = palette.text;
      ctx.fillRect(cx - Math.round(barW / 2) + 1, by + 1, Math.max(1, filled - 1), 1);
    }
  }

  /**
   * 用逐行 fillRect 画实心椭圆。
   * 刻意不用 ctx.ellipse：那个带抗锯齿，边缘会糊。
   */
  function ellipse(cx, cy, rx, ry, color) {
    ctx.fillStyle = color;
    const y0 = Math.round(cy - ry);
    const y1 = Math.round(cy + ry);
    for (let y = y0; y < y1; y++) {
      const dy = (y + 0.5 - cy) / ry;
      if (Math.abs(dy) >= 1) continue;
      const half = rx * Math.sqrt(1 - dy * dy);
      const x0 = Math.round(cx - half);
      const x1 = Math.round(cx + half);
      if (x1 > x0) ctx.fillRect(x0, y, x1 - x0, 1);
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // 特效
  // ────────────────────────────────────────────────────────────────────

  const BIRD_FRAMES = [
    ['..oo....', '.o##o...', 'b####o..', '.o##o...', '..oo....', '........', '........', '........'],
    ['........', '.o##oo..', 'b####o..', '.o##oo..', '........', '........', '........', '........'],
    ['........', '.o##o...', 'b####o..', '.o##o...', '..oo....', '........', '........', '........']
  ];

  function drawBird(e, t) {
    const p = clamp01((t - e.startAt) / e.dur);
    // 缓出：小鸟是"冲过去啄"的，前段快后段慢才对
    const ease = 1 - (1 - p) * (1 - p);
    const x = Math.round(e.fromX + (e.toX - e.fromX) * ease);
    const y = Math.round(e.fromY + (e.toY - e.fromY) * ease);
    // 翅膀按飞行进度扇，不按真实时间——这样飞行多快都能扇满三帧
    const frame = BIRD_FRAMES[Math.min(BIRD_FRAMES.length - 1, Math.floor(p * 3))];
    drawSprite(frame, x - 4, y - 4, { o: palette.outline, '#': palette.text, b: palette.beak });
  }

  function drawBurst(e, t) {
    const p = clamp01((t - e.startAt) / e.dur);
    const cx = Math.round(e.x);
    const cy = Math.round(e.y);
    const color = palette.balloons[e.color % palette.balloons.length];
    const dist = 4 + p * 16;

    ctx.fillStyle = color;
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8 + (e.seed % 7) * 0.3;
      const r = dist * (i % 2 ? 0.78 : 1);
      ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 2, 2);
    }
    // 中间炸开的闪光，前 1/3 就收掉
    if (p < 0.35) {
      ctx.fillStyle = palette.text;
      const s = Math.round(6 * (1 - p / 0.35)) + 2;
      ctx.fillRect(cx - Math.round(s / 2), cy - Math.round(s / 2), s, s);
    }
  }

  function drawDust(e, t) {
    const p = clamp01((t - e.startAt) / e.dur);
    const cx = Math.round(e.x);
    const y = Math.round(e.y);
    ctx.fillStyle = palette.textDim;
    for (let i = 0; i < 4; i++) {
      const dir = i % 2 ? 1 : -1;
      const px = Math.round(cx + dir * (2 + p * 9 + i));
      const py = Math.round(y - p * 8 - i * 2);
      if (p > 0.2 + i * 0.15) ctx.fillRect(px, py, 2, 2);
    }
  }

  function drawCave(e, t) {
    const p = clamp01((t - e.startAt) / e.dur);
    if (p > 0.6) return;
    const x = Math.round(e.x);
    const y = Math.round(e.y);
    ctx.fillStyle = palette.ink;
    const s = Math.round((1 - p / 0.6) * 10) + 2;
    ctx.fillRect(x - Math.round(s / 2), y, s, s);
  }

  /** 按字符查表画一个 N×8 的像素 sprite（行内同色像素合并成一次 fillRect） */
  function drawSprite(rows, x, y, colors) {
    for (let ry = 0; ry < rows.length; ry++) {
      const row = rows[ry];
      let rx = 0;
      while (rx < row.length) {
        const ch = row[rx];
        if (ch === '.' || !colors[ch]) { rx++; continue; }
        let run = 1;
        while (rx + run < row.length && row[rx + run] === ch) run++;
        ctx.fillStyle = colors[ch];
        ctx.fillRect(x + rx, y + ry, run, 1);
        rx += run;
      }
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // 顶部信息条
  // ────────────────────────────────────────────────────────────────────

  function drawHud(state) {
    ctx.fillStyle = palette.hudBg;
    ctx.fillRect(0, 0, W, GEOMETRY.HUD_H);

    const s = state.stats;
    drawText(ctx, 'SCORE ' + pad(s.hits, 3), 4, 5, palette.text);
    drawText(ctx, 'LV' + state.level, 76, 5, state.level >= 7 ? palette.balloons[0] : palette.text);

    const acc = Math.round(accuracyOf(state) * 100);
    drawText(ctx, 'ACC ' + pad(acc, 3) + '%', 106, 5, palette.text);

    // 塌陷计：格子数 = collapseLimit，填满就结束。
    // 放在 HUD 上而不是只在侧栏，是因为"还剩几格"是决定生死的量，
    // 不该逼玩家离开画面去看侧栏。
    const limit = Math.max(1, state.config.collapseLimit);
    const bx = W - 6 - limit * 6;
    drawText(ctx, 'BASE', bx - 30, 5, palette.textDim);
    for (let i = 0; i < limit; i++) {
      const x = bx + i * 6;
      const filled = i < state.collapsed.length;
      ctx.fillStyle = filled ? palette.balloons[0] : palette.textDim;
      ctx.fillRect(x, 5, 4, 6);
      if (!filled) {
        ctx.fillStyle = palette.hudBg;
        ctx.fillRect(x + 1, 6, 2, 4);
      }
    }
  }

  return {
    resize,
    draw,
    logicalSize: { w: W, h: H },
    getScale: () => scale
  };
}

// ──────────────────────────────────────────────────────────────────────
// 小工具
// ──────────────────────────────────────────────────────────────────────

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** 左侧补零，宽度不足时原样返回（长了也不截） */
function pad(n, width) {
  const s = String(Math.max(0, Math.round(n)));
  return s.length >= width ? s : '0'.repeat(width - s.length) + s;
}

/** 与 rules.accuracy() 同口径。渲染层不 import 规则层，所以这里独立算一遍 */
function accuracyOf(state) {
  const total = state.stats.typed + state.stats.misses;
  return total ? state.stats.typed / total : 1;
}
