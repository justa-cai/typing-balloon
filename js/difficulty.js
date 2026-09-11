/**
 * difficulty.js - 难度档位的单一事实来源
 *
 * 这个文件只描述"什么档位用什么参数"。
 * 它不碰 DOM、不碰 canvas、不碰游戏状态，只暴露一个全局对象 Difficulty。
 * 用经典 <script> 加载而不是 ES 模块，有两个实际好处：
 *
 *   1) 档位按钮由 ui/menu.js 从 Difficulty.LEVELS 动态生成，档位文案与参数
 *      永远同源，不会出现"文案说很难、参数很温柔"的漂移；
 *   2) 验证调参时可以在浏览器 console / playwright 里直接读 Difficulty 做参数
 *      扫描，不用去翻代码——这是本系列一贯的调参方式（见文件末尾的校准记录）。
 *
 * ── 档位刻度 ─────────────────────────────────────────────────────────
 *
 * 原版小霸王学习卡的《打字游戏》是 0～9 共十级，级别越高球落得越快。
 * 本项目沿用这个刻度，十档全部显式写在 LEVELS 里，不用公式推——
 * 一条一条能肉眼核对的表，比一个参数化函数好调也好解释。
 *
 * 每档四个旋钮：
 *
 *   fallSec       气球从天空顶端落到地面线所需秒数（越小越快）
 *   spawnMs       两个气球之间的生成间隔（毫秒，越小越密）
 *   maxBalloons   同屏气球数量上限
 *   collapseLimit 地面塌陷多少列就结束本轮
 *
 * 另外两个跨档位的规则：
 *
 *   perCharBonusSec  目标每多一个字符，额外补给玩家的下落秒数。
 *                    单词/汉字模式必须给，否则"打一个 8 字母的单词"和
 *                    "打一个字母"留给玩家的时间一样，显然不合理。
 *   modeSpawnScale   单词/汉字模式的生成间隔倍率（目标更长，球也出得慢些）。
 *
 * ── 与系列其它项目的差异 ─────────────────────────────────────────────
 *
 * 02/03 的难度旋钮映射到引擎的搜索弱化（那是"AI 有多强"）；
 * 04 映射到搜索深度 + 根节点采样。本项目没有 AI 对手，
 * 难度就是纯粹的环境压力：**球落多快、出多密、地面能挨几下**。
 * 玩家的水平不需要被"模拟"，只需要被测量——测量结果进侧栏的统计表。
 *
 * ── 校准记录 ─────────────────────────────────────────────────────────
 *
 * 2026-09-12 首版参数，按"等效打字速度需求"反推：
 *
 *   一屏 16 列、气球按列砸坑、每列能挨约 6 下。若不打字，
 *   塌陷 collapseLimit 列所需的球数 ≈ collapseLimit × 6 - 邻列溅射的抵扣，
 *   再除以生成间隔，就是"完全不操作还能撑多久"：
 *
 *     L0 : 6 列 ≈ 26 球 × 1.50s ≈ 39s
 *     L5 : 4 列 ≈ 17 球 × 0.90s ≈ 15s
 *     L9 : 3 列 ≈ 12 球 × 0.42s ≈  5s
 *
 *   这给了"最低限度的操作压力"，同时不至于一上手就输。
 *   实际手感与调整记录补充在本节末尾（见 README_CN.md 的调参小节）。
 *
 * @license MIT
 */

(function (global) {
  'use strict';

  /** 原版是 0～9 十级，这里保持同样的刻度 */
  var MAX_LEVEL = 9;

  /**
   * 十档难度参数表。索引即档位号（0～9）。
   *
   * letters 字段是"字母模式解锁多少个字母"，按英文词频从高到低解锁：
   * 低档只出最常见的几个键，让初学者先把手指放到正确的位置上。
   */
  var LEVELS = [
    { level: 0, name: '入门', fallSec: 9.0, spawnMs: 1500, maxBalloons: 3, collapseLimit: 6, letters: 8,  wordTier: 0, hanziTier: 0 },
    { level: 1, name: '新手', fallSec: 8.3, spawnMs: 1380, maxBalloons: 3, collapseLimit: 6, letters: 10, wordTier: 0, hanziTier: 0 },
    { level: 2, name: '初学', fallSec: 7.6, spawnMs: 1260, maxBalloons: 4, collapseLimit: 5, letters: 12, wordTier: 0, hanziTier: 1 },
    { level: 3, name: '熟练', fallSec: 6.9, spawnMs: 1140, maxBalloons: 4, collapseLimit: 5, letters: 16, wordTier: 1, hanziTier: 1 },
    { level: 4, name: '上手', fallSec: 6.2, spawnMs: 1020, maxBalloons: 5, collapseLimit: 5, letters: 20, wordTier: 1, hanziTier: 2 },
    { level: 5, name: '进阶', fallSec: 5.5, spawnMs: 900,  maxBalloons: 5, collapseLimit: 4, letters: 24, wordTier: 1, hanziTier: 2 },
    { level: 6, name: '快速', fallSec: 4.8, spawnMs: 780,  maxBalloons: 6, collapseLimit: 4, letters: 26, wordTier: 2, hanziTier: 2 },
    { level: 7, name: '高手', fallSec: 4.1, spawnMs: 660,  maxBalloons: 6, collapseLimit: 4, letters: 26, wordTier: 2, hanziTier: 3 },
    { level: 8, name: '精英', fallSec: 3.4, spawnMs: 540,  maxBalloons: 7, collapseLimit: 3, letters: 26, wordTier: 3, hanziTier: 3 },
    { level: 9, name: '大师', fallSec: 2.7, spawnMs: 420,  maxBalloons: 8, collapseLimit: 3, letters: 26, wordTier: 3, hanziTier: 3 }
  ];

  /** 目标每多一个字符补偿的下落秒数 */
  var PER_CHAR_BONUS_SEC = 0.55;

  /** 各模式的生成间隔倍率：目标越长，球出得越稀 */
  var MODE_SPAWN_SCALE = {
    letters: 1.0,
    words: 1.3,
    hanzi: 1.3
  };

  /** 三种练习模式。菜单按钮从这里生成，不硬编码文案 */
  var MODES = [
    {
      id: 'letters',
      name: '英文字母',
      short: '字母',
      desc: '气球上是一个字母，按下对应键即可击破。练基本指法与键位记忆。'
    },
    {
      id: 'words',
      name: '英文单词',
      short: '单词',
      desc: '气球上是一个英文单词，要连续正确输入完整拼写才击破。中途打错会清空输入。'
    },
    {
      id: 'hanzi',
      name: '汉字拼音',
      short: '汉字',
      desc: '气球上是一个汉字，输入它的完整拼音（全拼）击破。汉字用本机中文字体现场点阵化。'
    }
  ];

  /**
   * 取某一档的原始参数。越界会被夹到有效范围内而不是抛错——
   * 档位来自按钮或 URL，容错比报错有用。
   * @param {number} n 档位号 0～9
   * @returns {object} 该档的参数（副本，调用方改了不影响表）
   */
  function level(n) {
    var i = Math.round(Number(n));
    if (!isFinite(i)) i = 0;
    i = Math.max(0, Math.min(MAX_LEVEL, i));
    var src = LEVELS[i];
    return {
      level: src.level,
      name: src.name,
      fallSec: src.fallSec,
      spawnMs: src.spawnMs,
      maxBalloons: src.maxBalloons,
      collapseLimit: src.collapseLimit,
      letters: src.letters,
      wordTier: src.wordTier,
      hanziTier: src.hanziTier
    };
  }

  /**
   * 某一档 + 某一模式的最终生效参数（含按目标长度补偿后的下落时间）。
   *
   * @param {string} modeId 'letters' | 'words' | 'hanzi'
   * @param {number} n      档位号 0～9
   * @param {number} [len]  目标字符数，缺省按 1 算（即不补偿）
   * @returns {object} { ...档位参数, mode, spawnMs(已乘倍率), fallSec(已补偿) }
   */
  function config(modeId, n, len) {
    var base = level(n);
    var mode = String(modeId || 'letters');
    var scale = MODE_SPAWN_SCALE[mode] || 1;
    var chars = Math.max(1, Math.round(Number(len) || 1));
    base.mode = mode;
    base.spawnMs = Math.round(base.spawnMs * scale);
    base.fallSec = base.fallSec + (chars - 1) * PER_CHAR_BONUS_SEC;
    return base;
  }

  global.Difficulty = {
    MAX_LEVEL: MAX_LEVEL,
    LEVELS: LEVELS,
    MODES: MODES,
    PER_CHAR_BONUS_SEC: PER_CHAR_BONUS_SEC,
    MODE_SPAWN_SCALE: MODE_SPAWN_SCALE,
    level: level,
    config: config
  };
})(typeof window !== 'undefined' ? window : this);
