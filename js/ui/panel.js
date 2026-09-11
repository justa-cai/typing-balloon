/**
 * ui/panel.js - 侧栏
 *
 * 这一层是本系列「诚实统计」招牌的延续：表格里的每一个数字都来自
 * rules.js 真实发生的记录，没有估算、没有平均、没有为了好看做平滑。
 *
 * 唯一带主观判断的是「这一次算不算慢」——定义是**反应时间超过这个气球
 * 自身可用时间的 60%**（注意是各自比各自的，不是拿一个全局常数去卡），
 * 阈值写在 SLOW_RATIO，页面上的说明文案也直接引用它，两边不会说岔。
 *
 * 侧栏每帧都要刷新，所以做了两件事避免白干活：
 *   1) 文本类字段先比一次，值没变就不动 DOM；
 *   2) 记录表只在 log.length 变了才重绘。
 *
 * @license MIT
 */

/** 反应时间超过自身可用时间的这个比例，就标黄提醒 */
export const SLOW_RATIO = 0.6;

/** 记录表最多显示最近多少条（rules 里最多留 200 条，显示用不着那么多） */
const MAX_ROWS = 60;

/**
 * @param {object} opts
 * @param {number} opts.perCharBonus 目标每多 1 个字符补偿的下落秒数（来自 Difficulty）
 * @returns {object} 侧栏控制器
 */
export function createPanel({ perCharBonus }) {
  const perChar = Number(perCharBonus) || 0;
  const $ = (id) => document.getElementById(id);

  const el = {
    hitsCounter: $('hits-counter'),
    missCounter: $('miss-counter'),
    infoMode: $('info-mode'),
    infoLevel: $('info-level'),
    infoTime: $('info-time'),
    infoHits: $('info-hits'),
    infoMisses: $('info-misses'),
    infoAcc: $('info-acc'),
    infoCpm: $('info-cpm'),
    meterBar: $('base-meter-bar'),
    meterText: $('base-meter-text'),
    logBody: $('log-body'),
    logEmpty: $('log-empty'),
    status: $('current-status'),
    levelFacts: $('level-facts'),
    slowThreshold: $('slow-threshold')
  };

  const last = {
    text: {},
    logLen: -1,
    meterCells: -1,
    meterGone: -1
  };

  el.slowThreshold.textContent = `本条可用时间的 ${Math.round(SLOW_RATIO * 100)}%`;

  /**
   * 刷新侧栏。
   *
   * @param {object} state rules 的状态
   * @param {object} view  预计算好的展示值 { accuracy, cpm, elapsedMs, modeLabel }
   */
  function update(state, view) {
    const s = state.stats;

    setText(el.hitsCounter, s.hits);
    setText(el.missCounter, s.misses);
    setText(el.infoMode, view.modeLabel);
    setText(el.infoLevel, `${state.level} ${state.config.name}`);
    setText(el.infoTime, formatSeconds(view.elapsedMs));
    setText(el.infoHits, s.hits);
    setText(el.infoMisses, s.misses);
    setText(el.infoAcc, s.typed + s.misses ? `${(view.accuracy * 100).toFixed(1)}%` : '—');
    setText(el.infoCpm, view.cpm > 0 ? `${Math.round(view.cpm)} 字/分` : '—');

    updateMeter(state);
    updateLog(state);
  }

  /** 塌陷进度条：格子数等于本档的 collapseLimit */
  function updateMeter(state) {
    const limit = Math.max(1, state.config.collapseLimit);
    const gone = state.collapsed.length;

    if (last.meterCells !== limit) {
      el.meterBar.innerHTML = '';
      for (let i = 0; i < limit; i++) {
        const cell = document.createElement('div');
        cell.className = 'base-meter-cell';
        el.meterBar.appendChild(cell);
      }
      last.meterCells = limit;
      last.meterGone = -1;
    }

    if (last.meterGone !== gone) {
      const cells = el.meterBar.children;
      for (let i = 0; i < cells.length; i++) {
        cells[i].className = 'base-meter-cell' + (i < gone ? ' gone' : '');
      }
      last.meterGone = gone;
    }

    el.meterText.textContent = `${gone} / ${limit} 列`;
  }

  /** 记录表：只在条数变化时重绘，新记录在最上面 */
  function updateLog(state) {
    if (state.log.length === last.logLen) return;
    last.logLen = state.log.length;

    const hasAny = state.log.length > 0;
    el.logEmpty.classList.toggle('hide', hasAny);
    if (!hasAny) {
      el.logBody.innerHTML = '';
      return;
    }

    const rows = [];
    const start = Math.max(0, state.log.length - MAX_ROWS);
    for (let i = state.log.length - 1; i >= start; i--) {
      const e = state.log[i];
      const slow = e.ok && e.limitMs > 0 && e.reactionMs > e.limitMs * SLOW_RATIO;
      const tr = document.createElement('tr');
      if (!e.ok) tr.className = 'miss';
      else if (slow) tr.className = 'slow';

      const verdict = e.ok
        ? '<td class="verdict-ok">击破</td>'
        : '<td class="verdict-miss">失误</td>';
      const ms = e.ok && e.limitMs > 0
        ? `${Math.round(e.reactionMs)}ms / ${Math.round(e.limitMs)}ms`
        : '—';

      tr.innerHTML =
        `<td>${i + 1}</td>` +
        `<td>${(e.at / 1000).toFixed(1)}s</td>` +
        `<td>${escapeHtml(e.text)}</td>` +
        `<td class="ms">${ms}</td>` +
        verdict;
      rows.push(tr);
    }

    el.logBody.replaceChildren(...rows);
  }

  /**
   * 底部状态条。这一行是给玩家"现在该怎么办"的直接提示。
   * @param {string} text
   * @param {'idle'|'busy'|'danger'} tone
   */
  function setStatus(text, tone = 'idle') {
    if (last.text.status === text && last.text.tone === tone) return;
    last.text.status = text;
    last.text.tone = tone;
    el.status.textContent = text;
    el.status.className = 'current-status' + (tone === 'busy' ? ' busy' : tone === 'danger' ? ' danger' : '');
  }

  /**
   * 难度参数卡：把本档实际生效的旋钮值摆出来。
   * @param {object} lv  Difficulty.level(n)
   * @param {object} cfg Difficulty.config(mode, n, 1)
   * @param {object} mode Difficulty.MODES 里的一项
   */
  function setFacts(lv, cfg, mode) {
    const content = mode.id === 'letters'
      ? `可用字母 <span class="ok">${lv.letters}</span> / 26`
      : mode.id === 'words'
        ? `词长档 <span class="ok">${lv.wordTier + 1}/4</span>`
        : `拼音长档 <span class="ok">${lv.hanziTier + 1}/4</span>`;

    el.levelFacts.innerHTML =
      `模式：<b>${escapeHtml(mode.name)}</b><br>` +
      `档位：<b>${lv.level} ${escapeHtml(lv.name)}</b><br>` +
      `下落时间：<b>${lv.fallSec.toFixed(1)}s</b>（每多 1 字符 +${perChar}s）<br>` +
      `出球间隔：<b>${cfg.spawnMs}ms</b><br>` +
      `同屏上限：<b>${lv.maxBalloons}</b> 个<br>` +
      `塌陷阈值：<b>${lv.collapseLimit}</b> 列<br>` +
      `内容：${content}`;
  }

  /** 计数徽章弹一下，给击破/失误一个画面外的即时反馈 */
  function bump(kind) {
    const node = kind === 'miss' ? el.missCounter : el.hitsCounter;
    node.classList.add('bump');
    setTimeout(() => node.classList.remove('bump'), 130);
  }

  function reset() {
    last.logLen = -1;
    last.meterGone = -1;
    last.text.status = null;
    last.text.tone = null;
  }

  return { update, setStatus, setFacts, reset, bump };
}

// ──────────────────────────────────────────────────────────────────────

function setText(node, value) {
  const s = String(value);
  if (node.textContent !== s) node.textContent = s;
}

function formatSeconds(ms) {
  const sec = Math.max(0, ms) / 1000;
  if (sec < 60) return `${sec.toFixed(1)} s`;
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
