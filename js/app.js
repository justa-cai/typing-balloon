/**
 * app.js - 主控（装配画面、侧栏、菜单、音效；驱动游戏循环）
 *
 * 全应用唯一的调度中心，也是唯一知道"各层怎么连起来"的地方：
 *
 *     difficulty.js  ← 档位参数的单一事实来源
 *          ↓  configFor(len)
 *     rules.js       ← 纯逻辑，不碰 DOM / canvas / 音频
 *          ↓  state + events
 *     ui/stage.js    ← 只画，不判断
 *     ui/panel.js    ← 只显示，数字全部来自 state
 *     ui/menu.js     ← 只管页面切换
 *     audio.js       ← 只听事件，不看状态
 *
 * ── 固定步长 ────────────────────────────────────────────────────────
 *
 * 逻辑按 1/60 秒固定步长推进，渲染跟 rAF 走。两者解耦的好处是
 * 120Hz 屏和 60Hz 屏上气球下落速度、反应时间测量值完全一致——
 * 不然"这次反应 412ms"就变成取决于显示器的随机数了。
 * 掉帧时最多补 10 步，避免切回标签页时瞬间冲一大截。
 *
 * ── 暂停 ────────────────────────────────────────────────────────────
 *
 * 菜单打开、切到别的标签页、窗口失焦，都会暂停。逻辑时钟停在原地，
 * 回来接着走——不会出现"去倒杯水回来地面已经塌完了"。
 *
 * @license MIT
 */

import * as rules from './rules.js';
import { createStage, readPalette } from './ui/stage.js';
import { createPanel, SLOW_RATIO } from './ui/panel.js';
import { createMenu } from './ui/menu.js';
import { createAudio } from './audio.js';

/** 逻辑步长：60Hz */
const STEP_MS = 1000 / 60;
/** 单帧最多补几步（掉帧保护） */
const MAX_CATCHUP = 10;

/** 评语阈值：原版打完一局给「低/中/高」，这里把两档阈值显式写出来 */
const GRADE_HIGH = { cpm: 180, acc: 0.95 };
const GRADE_MID = { cpm: 90, acc: 0.88 };

const Difficulty = window.Difficulty;
if (!Difficulty) {
  throw new Error('difficulty.js 没有加载：它必须排在 app.js 之前（见 index.html 底部）');
}

const params = new URLSearchParams(location.search);
// ?mute=1 供自动化驱动时静音——静音是"不排音"，不是音量归零，
// 免得跑几分钟下来在时间轴上堆几千个振荡器节点
const audio = createAudio({ muted: params.get('mute') === '1' });

const canvas = document.getElementById('stage');
const stageArea = document.getElementById('stage-area');
const stage = createStage(canvas, { palette: readPalette() });
const panel = createPanel({ perCharBonus: Difficulty.PER_CHAR_BONUS_SEC });

let state = makeIdleState();
let paused = true;
let acc = 0;
let lastFrame = 0;
let lastSummary = null;

const menu = createMenu({
  difficulty: Difficulty,
  // 菜单不 import audio（保持"只管显示、点了回调谁"的分层），
  // 音效由这一层注进去，它只负责在点按钮时喊一声
  sfx: (name) => audio.play(name),
  onStart: (sel) => startRound(sel),
  onRestart: () => startRound(current),
  onMenu: () => { paused = true; panel.setStatus('已暂停，选好模式和难度再开始。'); }
});

/** 当前选择的模式与档位（重开时用） */
let current = { mode: Difficulty.MODES[0].id, level: 0 };

// ──────────────────────────────────────────────────────────────────────
// 生命周期
// ──────────────────────────────────────────────────────────────────────

/** 菜单阶段也要有东西可画，所以造一个不推进的空局面 */
function makeIdleState() {
  const s = rules.createGame({
    mode: 'letters',
    level: 0,
    configFor: (len) => Difficulty.config('letters', 0, len)
  });
  s.status = 'idle';
  return s;
}

/**
 * 开一轮。
 * @param {object} sel {mode, level}
 * @param {() => number} [sel.rng] 可选的确定性随机源（自动化复现用）
 */
function startRound(sel, rng) {
  const mode = sel.mode || current.mode;
  const level = Number.isFinite(sel.level) ? sel.level : current.level;
  current = { mode, level };

  state = rules.createGame({
    mode,
    level,
    configFor: (len) => Difficulty.config(mode, level, len),
    rng
  });
  state.status = 'running';
  state.stats.startedAt = 0;

  const modeInfo = Difficulty.MODES.find((m) => m.id === mode) || Difficulty.MODES[0];
  const lv = Difficulty.level(level);
  panel.setFacts(lv, Difficulty.config(mode, level, 1), modeInfo);
  panel.reset();
  panel.setStatus(`正在练「${modeInfo.name}」${level} ${lv.name}。`, 'busy');

  menu.close();
  menu.hideSummary();
  menu.setSelection({ mode, level }); // 菜单高亮跟着实际在玩的那一档走
  audio.unlock();
  audio.play('start');

  acc = 0;
  paused = false;
  return state;
}

/** 结束一轮：算成绩、弹结算 */
function endRound() {
  paused = true;
  const summary = buildSummary(state);
  lastSummary = summary;
  panel.setStatus(`本轮结束：${summary.text}`, 'danger');
  audio.play('over');
  menu.showSummary(summary);
}

/**
 * 成绩单。
 *
 * 评语沿用原版的「低 / 中 / 高」三档，阈值写在文件头的常量里，
 * 不是随手拍的比例——速度看字/分，正确率单独一档，两个都要达标才算上一档。
 */
function buildSummary(s) {
  const modeInfo = Difficulty.MODES.find((m) => m.id === s.mode) || Difficulty.MODES[0];
  const lv = Difficulty.level(s.level);
  const ms = rules.elapsedMs(s);
  const acc = rules.accuracy(s);
  const cpm = rules.cpm(s);

  const oks = s.log.filter((e) => e.ok);
  const reactions = oks.map((e) => e.reactionMs);
  const avg = reactions.length
    ? reactions.reduce((a, b) => a + b, 0) / reactions.length
    : 0;
  const fast = reactions.length ? Math.min(...reactions) : 0;

  let grade = '低';
  if (cpm >= GRADE_HIGH.cpm && acc >= GRADE_HIGH.acc) grade = '高';
  else if (cpm >= GRADE_MID.cpm && acc >= GRADE_MID.acc) grade = '中';

  const rows = [
    ['模式', modeInfo.name],
    ['难度', `${lv.level} ${lv.name}`],
    ['用时', `${(ms / 1000).toFixed(1)} s`],
    ['击破气球', `${s.stats.hits} 个`],
    ['击破字数', `${s.stats.chars} 字`],
    ['最高连击', `${s.stats.bestCombo} 连`],
    ['正确按键', `${s.stats.typed} 次`],
    ['失误', `${s.stats.misses} 次`],
    ['正确率', `${(acc * 100).toFixed(1)}%`],
    ['速度', `${Math.round(cpm)} 字/分`],
    ['平均反应', reactions.length ? `${Math.round(avg)} ms` : '—'],
    ['最快反应', reactions.length ? `${Math.round(fast)} ms` : '—'],
    ['落地漏球', `${s.stats.landed} 个`],
    ['地面塌陷', `${s.collapsed.length} / ${s.config.collapseLimit} 列`]
  ];

  const text = reactions.length
    ? `共击破 ${s.stats.hits} 个目标、${s.stats.chars} 个字，` +
      `平均反应 ${Math.round(avg)}ms，地面被砸塌 ${s.collapsed.length} 列。`
    : `一个都没打中就结束了。先按对最下面那个气球试试。`;

  return { grade, rows, text };
}

// ──────────────────────────────────────────────────────────────────────
// 输入
// ──────────────────────────────────────────────────────────────────────

/**
 * 一次按键的统一入口（真实键盘和自动化驱动都走这里）。
 * @param {string} key
 * @returns {boolean} 是否被游戏消费
 */
function press(key) {
  if (!state || state.status !== 'running' || paused) return false;
  const before = state.stats.typed + state.stats.misses + state.stats.hits;
  const events = rules.input(state, key);
  if (!events.length) return false;
  handleEvents(events);
  return state.stats.typed + state.stats.misses + state.stats.hits > before;
}

function handleEvents(events) {
  for (const e of events) {
    switch (e.type) {
      case 'pop':
        audio.play('pop');
        // 从第 2 连击起叠一个随连击升高的点缀音，最高抬一个八度
        if (e.combo >= 2) audio.play('combo', { semitones: Math.min(e.combo - 2, 12) });
        panel.bump('hits');
        break;
      case 'progress':
        // 目标还没打完，但这一下按对了——给个逐键反馈
        audio.play('key');
        break;
      case 'spawn':
        audio.play('spawn');
        break;
      case 'miss':
        audio.play('miss');
        panel.bump('miss');
        break;
      case 'land':
        audio.play('land');
        break;
      case 'collapse':
        audio.play('collapse');
        menu.toast(`第 ${e.column + 1} 列塌了（${e.count} / ${state.config.collapseLimit}）`);
        break;
      case 'over':
        endRound();
        break;
      default:
        break;
    }
  }
}

window.addEventListener('keydown', (ev) => {
  // 输入法激活时 key 会是 'Process' 之类，交给 press 里的白名单挡掉
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
  if (menu.isOpen() || menu.isSummaryOpen()) return;
  if (ev.key === ' ') ev.preventDefault(); // 空格别把页面滚下去
  const consumed = press(ev.key);
  if (consumed) ev.preventDefault();
});

// 第一次真实交互时把音频上下文建起来（浏览器自动播放策略的要求）
const unlockOnce = () => {
  if (audio.unlock()) {
    const hint = document.getElementById('hint-audio');
    hint.textContent = audio.isMuted() ? '音效：已静音（?mute=1）' : '音效：已启用';
    document.removeEventListener('pointerdown', unlockOnce);
    document.removeEventListener('keydown', unlockOnce);
  }
};
document.addEventListener('pointerdown', unlockOnce);
document.addEventListener('keydown', unlockOnce);

// ──────────────────────────────────────────────────────────────────────
// 按钮
// ──────────────────────────────────────────────────────────────────────

document.getElementById('restartbtn').addEventListener('click', () => startRound(current));
document.getElementById('menubtn').addEventListener('click', () => {
  paused = true;
  audio.play('uiMove');
  menu.open('main');
  panel.setStatus('已暂停，选好模式和难度再开始。');
});

const muteBtn = document.getElementById('mutebtn');
muteBtn.addEventListener('click', () => {
  audio.unlock();
  audio.setMuted(!audio.isMuted());
  muteBtn.textContent = audio.isMuted() ? '取消静音' : '静音';
  document.getElementById('hint-audio').textContent =
    audio.isMuted() ? '音效：已静音' : '音效：已启用';
});
if (audio.isMuted()) muteBtn.textContent = '取消静音';

// 切走标签页 / 窗口失焦时暂停：逻辑时钟不动，回来接着打
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.status === 'running') {
    paused = true;
  } else if (!document.hidden && state.status === 'running' && !menu.isOpen()) {
    paused = false;
    acc = 0;
  }
});

// ──────────────────────────────────────────────────────────────────────
// 画面缩放
// ──────────────────────────────────────────────────────────────────────

function fitStage() {
  const rect = stageArea.getBoundingClientRect();
  // 减去外框的 padding（见 stage-area 的样式），否则画面会顶到边框上
  const pad = 20;
  stage.resize(rect.width - pad, rect.height - pad);
}

const ro = new ResizeObserver(fitStage);
ro.observe(stageArea);
window.addEventListener('resize', fitStage);
fitStage();

// ──────────────────────────────────────────────────────────────────────
// 主循环
// ──────────────────────────────────────────────────────────────────────

function frame(now) {
  requestAnimationFrame(frame);

  if (!lastFrame) lastFrame = now;
  const dt = Math.min(250, now - lastFrame);
  lastFrame = now;

  if (state.status === 'running' && !paused) {
    acc += dt;
    let steps = 0;
    while (acc >= STEP_MS && steps < MAX_CATCHUP) {
      const events = rules.step(state, STEP_MS);
      acc -= STEP_MS;
      steps++;
      if (events.length) handleEvents(events);
      if (state.status !== 'running') break; // step 里已经收尾了
    }
    if (steps >= MAX_CATCHUP) acc = 0; // 落后太多就丢掉，别越追越远
  }

  stage.draw(state);
  panel.update(state, {
    accuracy: rules.accuracy(state),
    cpm: rules.cpm(state),
    elapsedMs: rules.elapsedMs(state),
    modeLabel: labelOf(state.mode)
  });
}

function labelOf(modeId) {
  const m = Difficulty.MODES.find((x) => x.id === modeId);
  return m ? m.name : modeId;
}

requestAnimationFrame(frame);

// 一开始就停在菜单上
menu.open('main');
panel.setStatus('按「开始练习」挑一个模式。');

// ──────────────────────────────────────────────────────────────────────
// 调试句柄
// ──────────────────────────────────────────────────────────────────────

/**
 * 暴露给浏览器 console 和自动化驱动（playwright）。
 *
 * 验证方式就是直接驱动这个对象：pause() 停掉 rAF 推进，advance(ms) 手动
 * 快进，press(key) 注入按键，然后断言 state 里的数字——不用真的手打，
 * 也不用真的等 30 秒。
 *
 * 注意 advance() 走的是同一套 rules.step()，和真玩时的逻辑完全一致，
 * 不存在"验证时跑的是另一条分支"。
 */
window.TypingGame = {
  rules,
  Difficulty,
  SLOW_RATIO,
  menu, // 让自动化能直接切菜单页（UI 上没有"直接跳到选难度"的入口）

  get state() { return state; },
  get summary() { return lastSummary; },
  get current() { return { ...current }; },
  isPaused: () => paused,

  /** 开一轮。传 seed 则使用确定性随机源，便于复现同一局 */
  start(sel = {}, seed) {
    const rng = seed == null ? undefined : rules.createRng(seed);
    return startRound({ mode: sel.mode || current.mode, level: sel.level ?? current.level }, rng);
  },

  /** 停掉 rAF 的自动推进，改用 advance() 手动控制时间 */
  pause() { paused = true; },
  resume() { paused = false; lastFrame = 0; acc = 0; },

  /**
   * 手动推进 ms 毫秒（按固定步长切分，和主循环同一条路径）。
   * @returns {number} 产生的步数
   */
  advance(ms) {
    let left = Math.max(0, Number(ms) || 0);
    let steps = 0;
    while (left >= STEP_MS && steps < 100000) {
      const events = rules.step(state, STEP_MS);
      left -= STEP_MS;
      steps++;
      if (events.length) handleEvents(events);
      if (state.status !== 'running') break;
    }
    return steps;
  },

  /** 注入一次按键（会走和键盘完全相同的处理链） */
  press(key) {
    const wasPaused = paused;
    paused = false; // 自动化里不该因为"菜单开着"就吞掉按键
    const ok = press(key);
    paused = wasPaused;
    return ok;
  },

  /** 打完当前屏上所有气球（自动化跑一轮快照用） */
  autoPlayOne() {
    const b = state.balloons.find((x) => x.state === 'falling');
    if (!b) return false;
    for (const ch of b.match) press(ch);
    return true;
  },

  /** 一次性导出侧栏要用的汇总，方便断言 */
  info() {
    return {
      status: state.status,
      mode: state.mode,
      level: state.level,
      clock: Math.round(state.clock),
      elapsedMs: Math.round(rules.elapsedMs(state)),
      hits: state.stats.hits,
      misses: state.stats.misses,
      typed: state.stats.typed,
      landed: state.stats.landed,
      combo: state.stats.combo,
      bestCombo: state.stats.bestCombo,
      accuracy: Number(rules.accuracy(state).toFixed(4)),
      cpm: Number(rules.cpm(state).toFixed(1)),
      balloons: state.balloons.length,
      ground: state.ground.map((v) => Math.round(v)),
      collapsed: state.collapsed.slice(),
      collapseLimit: state.config.collapseLimit,
      logLen: state.log.length,
      log: state.log.slice(-10),
      canvasScale: stage.getScale(),
      audioReady: audio.ready()
    };
  }
};
