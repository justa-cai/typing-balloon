/**
 * rules.js - 规则 / 裁判层
 *
 * 这一层负责"游戏里发生了什么"：气球什么时候生成、怎么下落、玩家按的键算不算数、
 * 地面凭什么塌、什么时候结束。它**不碰 DOM、不碰 canvas、不出声**——
 * 渲染交给 ui/stage.js，音效交给 audio.js，两者都只消费这里吐出的事件。
 *
 * ── 时钟 ─────────────────────────────────────────────────────────────
 *
 * 逻辑时钟（state.clock，毫秒）只在 step() 里按 dt 前进，不从 performance.now()
 * 现取。好处有两个：
 *   1) 固定步长驱动时，反应时间、生成间隔这些测量值和调用频率无关，
 *      120Hz 屏和 60Hz 屏跑出来的数一样；
 *   2) 验证时可以用"注入 N 毫秒"的方式快进，不必真的等。
 *
 * ── 匹配规则（这里是最容易出歧义的地方）───────────────────────────────
 *
 * 三种模式统一用「输入缓冲 + 前缀匹配」：
 *
 *   - 缓冲为空时，按下的键匹配**以该键开头**的候选气球，取其中**最靠下**
 *     （y 最大、也就是最快落地）的那个作为当前目标；
 *   - 缓冲非空时，只认当前目标，把按键追加到缓冲后面继续比对前缀；
 *     一旦不是目标的前缀，就算一次失误，缓冲清空、目标进度回退。
 *
 * 字母模式额外有一条硬约束：**同屏不出现重复字母**（生成时过滤）。
 * 否则"按 A 打哪一个 A"就成了随机事件，玩家会觉得游戏在耍赖。
 *
 * 单词/汉字模式同屏也不出重复目标，理由同上。
 *
 * ── 地面塌陷（失败判定）──────────────────────────────────────────────
 *
 * 沿用 04 的"诚实"原则：失败条件的每一个中间量都是可见、可解释的。
 *
 *   ground[c] 记录第 c 列地面的**上沿 y 坐标**，初始 208（地面顶端）。
 *   气球砸在同一列时，上沿往下沉（y 变大），形成碗形坑：
 *
 *       本列 += 5   相邻列 += 2   次邻列 += 1
 *
 *   某列下沉到 240（画布底）时该列**塌陷**，地面出现一个贯通的缺口。
 *   塌陷列数达到档位的 collapseLimit 就结束本轮。
 *
 * 所以"还剩多少余地"永远是屏幕上直接看得见的东西——玩家不会莫名其妙地输。
 *
 * ── 效果（effects）为什么放在这一层 ──────────────────────────────────
 *
 * 小鸟啄气球、落地扬尘、气球炸成像素碎片，这些都是**时间轴上的事件**，
 * 必须跟着逻辑时钟走（否则固定步长下动画会飘）。所以 rules 负责生成并推进
 * effects，渲染层只按当前时刻把它们画出来，不做任何计时决策。
 *
 * @license MIT
 */

import { letterPool, wordPool, hanziPool } from './data/words.js';

/** 画布与场地几何。逻辑分辨率固定 256×240（FC 原生） */
export const GEOMETRY = {
  W: 256,
  H: 240,
  HUD_H: 16,        // 顶部信息条高度
  SKY_TOP: 16,      // 气球生成时的 y
  GROUND_TOP: 208,  // 地面初始上沿
  GROUND_BOTTOM: 240, // 画布底 = 地面被掏穿的深度
  COLUMNS: 16       // 地面切成 16 列，每列 16px，用于计算砸坑
};

/** 气球落地时对地面的破坏量（像素） */
export const GROUND_HIT = 5;
export const GROUND_SPLASH1 = 2;
export const GROUND_SPLASH2 = 1;

/** 气球造型常数（都是逻辑像素） */
export const SPRITE = {
  KNOT: 3,      // 气球底部的结
  STRING: 5,    // 结下面的线
  LETTER_W: 5,  // 字形宽
  LETTER_H: 7,  // 字形高
  PITCH: 6,     // 字形步进（5 + 1px 间距）
  HANZI: 16,    // 汉字点阵块的边长
  MIN_BODY_W: 16
};

/** 命中后到气球炸开的动画时长 */
export const PECK_MS = 160;
export const BURST_MS = 380;
export const DUST_MS = 300;
export const CAVE_MS = 520;

/** 击破记录表最多保留多少条（侧栏只显示最近若干条） */
export const LOG_LIMIT = 200;

/**
 * mulberry32 —— 小而够用的确定性伪随机数发生器。
 * 只在验证/复现时传入种子用；正常游玩走 Math.random。
 * @param {number} seed 种子
 * @returns {() => number} 返回 [0,1) 的函数
 */
export function createRng(seed) {
  let a = (Number(seed) || 1) >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 按模式算出气球本体尺寸（不含结与线）。
 * @param {string} mode 'letters' | 'words' | 'hanzi'
 * @param {number} len 目标字符数
 * @returns {{w: number, h: number}}
 */
export function bodySize(mode, len) {
  const n = Math.max(1, len);
  if (mode === 'hanzi') {
    return { w: SPRITE.HANZI + 8, h: SPRITE.HANZI + 6 };
  }
  const textW = n * SPRITE.PITCH - 1;
  return {
    w: Math.max(SPRITE.MIN_BODY_W, textW + 10),
    h: SPRITE.LETTER_H + 7
  };
}

/**
 * 新建一局。
 *
 * @param {object} opts
 * @param {string} opts.mode       'letters' | 'words' | 'hanzi'
 * @param {number} opts.level      0～9
 * @param {(len: number) => object} opts.configFor
 *        按**目标字符数**取本局生效参数（来自 Difficulty.config）。
 *        下落时间必须随目标长度补偿——打一个 9 字母的词和打一个字母
 *        给同样的时间显然不合理，补偿规则统一写在 difficulty.js 里。
 * @param {() => number} [opts.rng] 随机源，缺省 Math.random
 * @returns {object} 游戏状态（可直接被渲染层读取）
 */
export function createGame({ mode, level, configFor, rng }) {
  const rand = typeof rng === 'function' ? rng : Math.random;
  const ground = new Array(GEOMETRY.COLUMNS);
  for (let i = 0; i < GEOMETRY.COLUMNS; i++) ground[i] = GEOMETRY.GROUND_TOP;
  const baseConfig = configFor(1);

  return {
    mode,
    level,
    configFor,
    config: baseConfig,
    rand,

    status: 'running',       // running | over
    clock: 0,                // 逻辑时钟（毫秒）
    balloons: [],
    effects: [],
    ground,
    collapsed: [],           // 已塌陷的列号

    buffer: '',              // 当前正在输入的缓冲（小写）
    activeId: null,          // 缓冲对应的气球 id

    nextId: 1,
    // 预置满一个间隔：开局第一步就出球，不然最短的档也要等 1.5 秒才开始，
    // 玩家会以为自己没按对开始按钮
    spawnAcc: baseConfig.spawnMs,
    endReason: '',

    stats: {
      hits: 0,        // 击破气球数
      chars: 0,       // 击破目标累计字符数
      typed: 0,       // 正确按键数（含尚未凑成目标的推进）
      misses: 0,      // 失误按键数
      landed: 0,      // 落地气球数
      startedAt: 0,   // 本轮开始时的 clock
      endedAt: 0
    },

    log: []           // 击破/失误记录，供侧栏表格如实展示
  };
}

/** 本轮已进行的毫秒数 */
export function elapsedMs(state) {
  const end = state.status === 'over' ? state.stats.endedAt : state.clock;
  return Math.max(0, end - state.stats.startedAt);
}

/** 正确率：无输入时按 100% 计（不编造，只是"还没有输入"的合理默认） */
export function accuracy(state) {
  const total = state.stats.typed + state.stats.misses;
  if (!total) return 1;
  return state.stats.typed / total;
}

/** 每分钟正确字符数 */
export function cpm(state) {
  const ms = elapsedMs(state);
  if (ms < 500) return 0;
  return state.stats.typed / (ms / 60000);
}

/** 每秒击破气球数 */
export function bps(state) {
  const ms = elapsedMs(state);
  if (ms < 500) return 0;
  return state.stats.hits / (ms / 1000);
}

/** 塌陷占比 0～1 */
export function collapseRatio(state) {
  const limit = Math.max(1, state.config.collapseLimit);
  return Math.min(1, state.collapsed.length / limit);
}

/**
 * 先进逻辑一步。调用方按固定步长喂 dt。
 *
 * @param {object} state
 * @param {number} dtMs 步长（毫秒）
 * @returns {Array<object>} 本步产生的游戏事件
 */
export function step(state, dtMs) {
  if (state.status !== 'running') return [];

  const dt = Math.max(0, Math.min(250, dtMs)); // 掉帧时不让时间跳得太离谱
  state.clock += dt;
  const events = [];

  // ── 生成 ──────────────────────────────────────────────────────────
  state.spawnAcc += dt;
  // 同屏满了就不再积攒计数，否则一旦有空位会连续喷出好几个
  if (state.balloons.length >= state.config.maxBalloons) {
    state.spawnAcc = Math.min(state.spawnAcc, state.config.spawnMs);
  }
  let guard = 0;
  while (state.spawnAcc >= state.config.spawnMs && guard++ < 8) {
    if (state.balloons.length >= state.config.maxBalloons) break;
    const b = trySpawn(state);
    if (!b) break; // 放不下，等下一帧再试（不消耗 spawnAcc）
    state.spawnAcc -= state.config.spawnMs;
    state.balloons.push(b);
    events.push({ type: 'spawn', balloon: b });
  }

  // ── 下落与落地 ────────────────────────────────────────────────────
  const landed = [];
  for (const b of state.balloons) {
    if (b.state === 'pecked') continue;
    b.y += b.vy * (dt / 1000);
    if (b.y + b.totalH >= GEOMETRY.GROUND_TOP) {
      b.y = GEOMETRY.GROUND_TOP - b.totalH;
      landed.push(b);
    }
  }
  for (const b of landed) {
    // 落地前若正是当前输入目标，清掉缓冲——目标已经不存在了
    if (state.activeId === b.id) resetBuffer(state);
    // 让同列的其他气球也停在地面线上，避免叠在一起穿模
    for (const other of state.balloons) {
      if (other !== b && other.state !== 'pecked' && other.y > b.y - 2 &&
          Math.abs(other.x - b.x) < Math.max(other.w, b.w) * 0.5) {
        other.y = b.y;
      }
    }
    events.push(...landBalloon(state, b));
    state.balloons.splice(state.balloons.indexOf(b), 1);
  }

  // ── 啄破动画到点 → 炸开 ───────────────────────────────────────────
  for (const b of state.balloons.slice()) {
    if (b.state === 'pecked' && state.clock - b.peckAt >= PECK_MS) {
      state.balloons.splice(state.balloons.indexOf(b), 1);
      state.effects.push({
        type: 'burst', x: b.x + b.w / 2, y: b.y + b.h / 2,
        startAt: state.clock, dur: BURST_MS, color: b.color, seed: b.id
      });
      events.push({ type: 'burst', balloon: b });
    }
  }

  // ── 特效寿命 ──────────────────────────────────────────────────────
  state.effects = state.effects.filter((e) => state.clock - e.startAt < e.dur);

  // ── 结束判定 ──────────────────────────────────────────────────────
  if (state.collapsed.length >= state.config.collapseLimit) {
    state.status = 'over';
    state.stats.endedAt = state.clock;
    state.endReason = 'collapse';
    resetBuffer(state);
    events.push({ type: 'over', reason: 'collapse' });
  }

  return events;
}

/**
 * 处理一次按键。
 *
 * @param {object} state
 * @param {string} key  KeyboardEvent.key（大小写、单字符）
 * @returns {Array<object>} 事件（pop / miss / progress）
 */
export function input(state, key) {
  if (state.status !== 'running') return [];
  const k = String(key || '').toLowerCase();
  // 只认单个字母/数字键；修饰键、方向键、中文输入法产生的多字符 key 一律忽略
  if (!/^[a-z0-9]$/.test(k)) return [];

  const events = [];

  // ① 还没有目标：找一个以 k 开头的气球，取最靠下的
  if (state.activeId === null) {
    let target = null;
    for (const b of state.balloons) {
      if (b.state !== 'falling') continue;
      if (!b.match.startsWith(k)) continue;
      if (!target || b.y > target.y) target = b;
    }
    if (!target) return [missEvent(state, k)];

    target.typed = 1;
    state.stats.typed += 1;
    if (target.typed >= target.match.length) {
      events.push(popBalloon(state, target));
    } else {
      state.activeId = target.id;
      state.buffer = k;
      events.push({ type: 'progress', balloon: target, buffer: state.buffer, key: k });
    }
    return events;
  }

  // ② 已有目标：继续比前缀
  const target = findBalloon(state, state.activeId);
  if (!target || target.state !== 'falling') {
    // 目标在输入途中落地了（正常情况下 step 已经清过缓冲，这是兜底）
    resetBuffer(state);
    return input(state, k);
  }

  const next = state.buffer + k;
  if (target.match.startsWith(next)) {
    state.buffer = next;
    target.typed = next.length;
    state.stats.typed += 1;
    if (next === target.match) {
      events.push(popBalloon(state, target));
    } else {
      events.push({ type: 'progress', balloon: target, buffer: state.buffer, key: k });
    }
    return events;
  }

  // ③ 打错了：进度回退、缓冲清空，记一次失误
  target.typed = 0;
  resetBuffer(state);
  return [missEvent(state, k)];
}

/** 取得当前正在输入的目标（没有则 null） */
export function activeTarget(state) {
  return state.activeId === null ? null : findBalloon(state, state.activeId);
}

// ──────────────────────────────────────────────────────────────────────
// 内部实现
// ──────────────────────────────────────────────────────────────────────

function findBalloon(state, id) {
  for (const b of state.balloons) if (b.id === id) return b;
  return null;
}

function resetBuffer(state) {
  if (state.activeId !== null) {
    const b = findBalloon(state, state.activeId);
    if (b && b.state === 'falling') b.typed = 0;
  }
  state.activeId = null;
  state.buffer = '';
}

/** 读时钟的简写：所有时间戳都取自逻辑时钟 */
function now(state) {
  return state.clock;
}

/**
 * 抽一个气球。抽不到（同屏挤不下、或题库里没得挑）返回 null。
 * @returns {object|null}
 */
function trySpawn(state) {
  const picked = pickTarget(state);
  if (!picked) return null;

  const size = bodySize(state.mode, picked.match.length);
  const totalH = size.h + SPRITE.KNOT + SPRITE.STRING;

  const x = pickX(state, size.w);
  if (x === null) return null;

  // 下落时间按目标长度取（越长给的秒数越多，规则见 difficulty.js）
  const fallSec = Math.max(1, state.configFor(picked.match.length).fallSec);
  const vy = (GEOMETRY.GROUND_TOP - GEOMETRY.SKY_TOP - totalH) / fallSec;

  return {
    id: state.nextId++,
    mode: state.mode,
    text: picked.text,
    match: picked.match,
    x,
    y: GEOMETRY.SKY_TOP,
    w: size.w,
    h: size.h,
    totalH,
    vy,
    color: Math.floor(state.rand() * 8),
    state: 'falling',
    typed: 0,
    spawnedAt: now(state),
    peckAt: 0
  };
}

/**
 * 选一个本屏还没有的目标。
 * 三种模式共用：先按档位取池子，再滤掉已经在屏上的，最后随机挑。
 */
function pickTarget(state) {
  const cfg = state.config;
  const onScreen = new Set(state.balloons.map((b) => b.match));
  let pool;

  if (state.mode === 'letters') {
    pool = letterPool(cfg.letters).filter((c) => !onScreen.has(c));
    if (!pool.length) return null;
    const ch = pool[Math.floor(state.rand() * pool.length)];
    return { text: ch.toUpperCase(), match: ch };
  }

  if (state.mode === 'words') {
    pool = wordPool(cfg.wordTier).filter((w) => !onScreen.has(w));
    if (!pool.length) return null;
    const w = pool[Math.floor(state.rand() * pool.length)];
    return { text: w.toUpperCase(), match: w };
  }

  pool = hanziPool(cfg.hanziTier).filter((h) => !onScreen.has(h.p));
  if (!pool.length) return null;
  const h = pool[Math.floor(state.rand() * pool.length)];
  return { text: h.c, match: h.p };
}

/**
 * 在顶部区域里找一个不压到现有气球的位置。
 * 只躲**顶部 60px 内**的气球——下面的气球本来就在往下走，躲它们没必要，
 * 而且会让生成位置越来越受限。
 *
 * @returns {number|null} x 坐标，找不到返回 null
 */
function pickX(state, w) {
  const maxX = GEOMETRY.W - w;
  if (maxX <= 0) return 0;

  for (let attempt = 0; attempt < 24; attempt++) {
    const x = state.rand() * maxX;
    let ok = true;
    for (const b of state.balloons) {
      if (b.state !== 'falling') continue;
      if (b.y > 60) continue;
      const gap = Math.max(b.w, w) * 0.5 + 4;
      if (Math.abs(b.x + b.w / 2 - (x + w / 2)) < gap) { ok = false; break; }
    }
    if (ok) return x;
  }
  return null;
}

/**
 * 击破一个气球：记账、写记录、生成小鸟特效。
 * 气球不在这里移除——它先进 'pecked' 状态让小鸟飞过去，啄到位再炸开。
 */
function popBalloon(state, b) {
  b.state = 'pecked';
  b.peckAt = now(state);
  b.typed = b.match.length;

  const reaction = now(state) - b.spawnedAt;
  // 这个气球从生成到落地一共给了玩家多少时间。侧栏用它判断"这一次算不算慢"——
  // 慢是相对于**这个气球自己的可用时间**说的，不是相对于某个全局常数。
  const limitMs = b.vy > 0 ? ((GEOMETRY.GROUND_TOP - GEOMETRY.SKY_TOP - b.totalH) / b.vy) * 1000 : 0;

  state.stats.hits += 1;
  state.stats.chars += b.match.length;
  pushLog(state, {
    ok: true,
    text: b.text,
    match: b.match,
    reactionMs: reaction,
    limitMs,
    at: elapsedMs(state)
  });

  // 小鸟从屏幕右侧外飞过来啄
  state.effects.push({
    type: 'bird',
    fromX: GEOMETRY.W + 8,
    fromY: Math.max(GEOMETRY.SKY_TOP, b.y - 14),
    toX: b.x + b.w / 2,
    toY: b.y + b.h / 2,
    startAt: now(state),
    dur: PECK_MS
  });

  resetBuffer(state);
  return { type: 'pop', balloon: b, reactionMs: reaction };
}

/** 记一次失误 */
function missEvent(state, key) {
  state.stats.misses += 1;
  pushLog(state, {
    ok: false,
    text: key.toUpperCase(),
    match: key,
    reactionMs: null,
    limitMs: 0,
    at: elapsedMs(state)
  });
  return { type: 'miss', key };
}

/** 气球落地：砸坑 → 可能塌陷 → 可能结束 */
function landBalloon(state, b) {
  const events = [];
  state.stats.landed += 1;

  const cx = b.x + b.w / 2;
  const col = clampCol(Math.floor(cx / (GEOMETRY.W / GEOMETRY.COLUMNS)));
  damage(state, col, GROUND_HIT);
  damage(state, col - 1, GROUND_SPLASH1);
  damage(state, col + 1, GROUND_SPLASH1);
  damage(state, col - 2, GROUND_SPLASH2);
  damage(state, col + 2, GROUND_SPLASH2);

  state.effects.push({
    type: 'dust', x: cx, y: GEOMETRY.GROUND_TOP,
    startAt: now(state), dur: DUST_MS
  });
  events.push({ type: 'land', balloon: b, column: col });

  // 本步刚塌掉的列
  for (let c = 0; c < GEOMETRY.COLUMNS; c++) {
    if (state.ground[c] >= GEOMETRY.GROUND_BOTTOM && !state.collapsed.includes(c)) {
      state.collapsed.push(c);
      state.effects.push({
        type: 'cave', x: c * (GEOMETRY.W / GEOMETRY.COLUMNS) + 8, y: GEOMETRY.GROUND_TOP,
        startAt: now(state), dur: CAVE_MS, column: c
      });
      events.push({ type: 'collapse', column: c, count: state.collapsed.length });
    }
  }
  return events;
}

/** 给某一列加坑深，已塌陷的列不再重复计数 */
function damage(state, col, amount) {
  if (col < 0 || col >= GEOMETRY.COLUMNS) return;
  if (state.collapsed.includes(col)) return;
  state.ground[col] = Math.min(GEOMETRY.GROUND_BOTTOM, state.ground[col] + amount);
}

function clampCol(c) {
  return Math.max(0, Math.min(GEOMETRY.COLUMNS - 1, c));
}

function pushLog(state, entry) {
  state.log.push(entry);
  if (state.log.length > LOG_LIMIT) state.log.shift();
}
