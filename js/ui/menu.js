/**
 * ui/menu.js - 画面上的多级菜单 + 结算浮层 + 提示条
 *
 * 只管"显示什么、点了之后回调谁"，不碰游戏状态、不碰规则。
 * 档位和模式的按钮文案全部从 Difficulty 里现取，页面里一行硬编码都没有——
 * 这样改难度表的时候不需要同步改 HTML。
 *
 * @license MIT
 */

/**
 * @param {object} opts
 * @param {object} opts.difficulty  window.Difficulty
 * @param {(sel: {mode: string, level: number}) => void} opts.onStart 点「开始练习」
 * @param {() => void} opts.onRestart 结算浮层里的「再来一轮」
 * @param {() => void} opts.onMenu    结算浮层里的「换个模式」
 * @param {(name: string) => void} [opts.sfx] 点击音效回调（由 app.js 注入 audio）
 * @returns {object} 菜单控制器
 */
export function createMenu({ difficulty, onStart, onRestart, onMenu, sfx = () => {} }) {
  const $ = (id) => document.getElementById(id);
  /** 所有"切页 / 选中 / 关浮层"的点击统一哼一声 */
  const click = () => sfx('uiMove');

  const overlay = $('stage-options');
  const pages = {
    main: $('menu-main'),
    mode: $('menu-mode'),
    keys: $('menu-keys'),
    level: $('menu-level'),
    help: $('menu-help')
  };
  const modePicker = $('mode-picker');
  const groupPicker = $('group-picker');
  const groupDesc = $('group-desc');
  const levelPicker = $('level-picker');
  const levelDesc = $('level-desc');
  const levelBack = $('level-back');
  const summary = $('game-summary');
  const toastEl = $('toast');

  let selection = { mode: difficulty.MODES[0].id, level: 0, group: 0 };
  let toastTimer = 0;

  buildModeButtons();
  buildGroupButtons();
  buildLevelButtons();
  bindEvents();
  renderGroupDesc();
  renderLevelDesc();

  // ── 构建 ──────────────────────────────────────────────────────────

  function buildModeButtons() {
    modePicker.innerHTML = '';
    for (const m of difficulty.MODES) {
      const btn = document.createElement('button');
      btn.className = 'mode-btn';
      btn.dataset.mode = m.id;
      btn.innerHTML = `<span class="mode-name">${escapeHtml(m.name)}</span>` +
                      `<span class="mode-desc">${escapeHtml(m.desc)}</span>`;
      btn.addEventListener('click', () => {
        selection.mode = m.id;
        click();
        markActive();
        renderLevelDesc();
      });
      modePicker.appendChild(btn);
    }
    markActive();
  }

  /** 键位组按钮：从 Difficulty.KEY_GROUPS 现生成，档位按钮同款样式 */
  function buildGroupButtons() {
    groupPicker.innerHTML = '';
    for (const g of difficulty.KEY_GROUPS) {
      const btn = document.createElement('button');
      btn.className = 'level-btn';
      btn.dataset.group = String(g.group);
      btn.textContent = `${g.group} ${g.name}`;
      btn.addEventListener('click', () => {
        selection.group = g.group;
        click();
        markActive();
        renderGroupDesc();
        renderLevelDesc();
      });
      groupPicker.appendChild(btn);
    }
    markActive();
  }

  function buildLevelButtons() {
    levelPicker.innerHTML = '';
    for (const lv of difficulty.LEVELS) {
      const btn = document.createElement('button');
      btn.className = 'level-btn';
      btn.dataset.level = String(lv.level);
      btn.textContent = `${lv.level} ${lv.name}`;
      btn.addEventListener('click', () => {
        selection.level = lv.level;
        click();
        markActive();
        renderLevelDesc();
      });
      levelPicker.appendChild(btn);
    }
    markActive();
  }

  function bindEvents() {
    // 主菜单的「开始练习」进的是**选模式**页，不是直接开局——
    // 直接开局等于把模式和难度锁死在默认档，那两个选择页就成了死页面。
    $('startbtn').addEventListener('click', () => { click(); showPage('mode'); });
    $('helpbtn').addEventListener('click', () => { click(); showPage('help'); });
    // 键位分区模式要先过「选键位组」这一页，其余模式直接去选难度
    $('mode-next').addEventListener('click', () => {
      click();
      showPage(selection.mode === 'keys' ? 'keys' : 'level');
    });
    $('group-next').addEventListener('click', () => { click(); showPage('level'); });
    // 「开始练习」本身不出 click 声——开局会播更正式的 start 音，别叠在一起
    $('levelstart').addEventListener('click', () => { close(); onStart({ ...selection }); });
    for (const el of document.querySelectorAll('.returnbtn')) {
      el.addEventListener('click', () => { click(); showPage(el.dataset.back); });
    }
    $('summary-again').addEventListener('click', () => { hideSummary(); onRestart(); });
    $('summary-menu').addEventListener('click', () => { click(); hideSummary(); open('mode'); onMenu(); });
    $('summary-close').addEventListener('click', () => { click(); hideSummary(); });

    // Esc 关掉结算浮层（不是关菜单——菜单关掉会让游戏在没准备好的情况下开跑）
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !summary.classList.contains('hide')) hideSummary();
    });
  }

  // ── 页面切换 ──────────────────────────────────────────────────────

  function showPage(name) {
    for (const key of Object.keys(pages)) {
      pages[key].classList.toggle('hide', key !== name);
    }
  }

  /** 打开遮罩。传 page 则同时切到那一页 */
  function open(page) {
    overlay.classList.remove('hide');
    showPage(page || 'main');
  }

  function close() {
    overlay.classList.add('hide');
  }

  function isOpen() {
    return !overlay.classList.contains('hide');
  }

  function markActive() {
    for (const b of modePicker.children) {
      b.classList.toggle('active', b.dataset.mode === selection.mode);
    }
    for (const b of groupPicker.children) {
      b.classList.toggle('active', Number(b.dataset.group) === selection.group);
    }
    for (const b of levelPicker.children) {
      b.classList.toggle('active', Number(b.dataset.level) === selection.level);
    }
  }

  /** 键位组说明：这组有哪些键、手指怎么放 */
  function renderGroupDesc() {
    const g = difficulty.keyGroup(selection.group);
    groupDesc.innerHTML =
      `<b>${escapeHtml(g.name)}</b> · ${g.keys.toUpperCase().split('').join(' ')}<br>` +
      escapeHtml(g.desc);
  }

  /**
   * 把当前档位的四个旋钮值原样摆出来。
   * 这一块是「诚实」原则的一部分：难度不是黑箱，玩家能看到自己面对的是什么。
   */
  function renderLevelDesc() {
    const lv = difficulty.level(selection.level);
    const mode = difficulty.MODES.find((m) => m.id === selection.mode) || difficulty.MODES[0];
    const cfg = difficulty.config(selection.mode, selection.level, 1, selection.group);

    const chars = mode.id === 'keys'
      ? `键位组 <b>${escapeHtml(difficulty.keyGroup(selection.group).name)}</b>（` +
        `${difficulty.keyGroup(selection.group).keys.toUpperCase().split('').join(' ')}）`
      : mode.id === 'letters'
      ? `可用字母 <b>${lv.letters}</b> 个（按词频从高到低解锁）`
      : mode.id === 'words'
        ? `单词长度档 <b>${lv.wordTier + 1}/4</b>（越长越难）`
        : `拼音长度档 <b>${lv.hanziTier + 1}/4</b>（越长越难）`;

    // 难度页的「返回上一步」：键位分区退回选组页，其余模式退回选模式页
    levelBack.dataset.back = mode.id === 'keys' ? 'keys' : 'mode';

    levelDesc.innerHTML =
      `<b>${escapeHtml(mode.name)}</b> · ${escapeHtml(lv.name)}<br>` +
      `单字气球下落 <b>${lv.fallSec.toFixed(1)}s</b>（目标每多 1 个字符补 ` +
      `${difficulty.PER_CHAR_BONUS_SEC}s）<br>` +
      `出球间隔 <b>${cfg.spawnMs}ms</b> · 同屏上限 <b>${lv.maxBalloons}</b> 个<br>` +
      `地面塌陷 <b>${lv.collapseLimit}</b> 列即结束<br>` +
      chars;
  }

  // ── 结算 ──────────────────────────────────────────────────────────

  /**
   * @param {object} data
   * @param {string} data.grade  评语（低 / 中 / 高）
   * @param {Array<[string, string]>} data.rows 成绩单的「项 - 值」列表
   * @param {string} data.text   一句话总结
   */
  function showSummary(data) {
    $('summary-title').textContent = '本轮结束';
    $('summary-grade').textContent = data.grade;
    const body = $('summary-body');
    body.innerHTML = '';
    for (const [k, v] of data.rows) {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.textContent = k;
      const td = document.createElement('td');
      td.textContent = v;
      tr.append(th, td);
      body.appendChild(tr);
    }
    $('summary-text').textContent = data.text;
    summary.classList.remove('hide');
  }

  function hideSummary() {
    summary.classList.add('hide');
  }

  function isSummaryOpen() {
    return !summary.classList.contains('hide');
  }

  // ── 提示条 ────────────────────────────────────────────────────────

  function toast(message, ms = 2600) {
    toastEl.textContent = message;
    toastEl.classList.remove('hide');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add('hide'), ms);
  }

  /**
   * 把菜单的选中态同步成"当前正在玩的那一档"。
   * app.js 在开局时调用——否则用「重开本轮」「再来一轮」开局后，
   * 菜单里高亮的还是上一次手选的那个模式/档位，和实际在玩的对不上。
   */
  function setSelection(sel) {
    if (!sel) return;
    if (sel.mode) selection.mode = sel.mode;
    if (Number.isFinite(sel.level)) selection.level = sel.level;
    if (Number.isFinite(sel.group)) selection.group = sel.group;
    markActive();
    renderGroupDesc();
    renderLevelDesc();
  }

  return {
    open,
    close,
    isOpen,
    showSummary,
    hideSummary,
    isSummaryOpen,
    toast,
    setSelection,
    getSelection: () => ({ ...selection }),
    refreshLevelDesc: renderLevelDesc
  };
}

/** 菜单文案里只有来自我们自己数据表的字符串，但转义一下不花钱 */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
