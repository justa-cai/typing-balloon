# 项目目录结构说明 (Project Tree Specification)

## 1. 完整目录树

```text
05.typing-balloon/
├── index.html                  # 唯一入口（五段式骨架，无硬编码档位文案）
├── js/
│   ├── app.js                  # 主控：唯一调度中心，装配所有层；暴露调试句柄
│   ├── difficulty.js           # ★ 难度单一事实来源（十档 + 三模式，经典脚本）
│   ├── rules.js                # 裁判层：生成/下落/匹配/计分/地面塌陷/结束
│   ├── audio.js                # Web Audio 现场合成的 FC 风格音效
│   ├── data/
│   │   └── words.js            # 题库：字母 / 英文单词 / 汉字+拼音（纯数据）
│   └── ui/
│       ├── pixelfont.js        # 5×7 点阵字模 + 汉字二值化 tile
│       ├── stage.js            # Canvas 256×240 像素渲染（只画，不判断）
│       ├── panel.js            # 侧栏：实时统计 + 逐次击破记录表
│       └── menu.js             # 多级菜单遮罩 + 结算浮层 + toast
├── styles/
│   ├── tokens.css              # 系列变量 + --nes-* 调色板 + 画面区尺寸
│   ├── base.css                # 重置与工具类
│   ├── components/
│   │   ├── layout.css          # 整体 Grid 与响应式断点
│   │   ├── stage.css           # 画面外壳、提示条、菜单遮罩
│   │   ├── panel.css           # 侧栏卡片、信息网格、统计表、塌陷进度条
│   │   ├── controls.css        # 按钮组与标题计数徽章
│   │   └── modal.css           # 结算浮层、toast
│   └── main.css                # 统一 @import 入口（顺序固定）
├── specs/                      # 项目规格与需求文档 (SDD)
│   ├── prd.md                  # 产品需求文档（含原版考证与验收标准）
│   ├── ui.md                   # UI 界面与交互设计规范
│   └── project_tree.md         # 本文件
├── server.py                   # 本地静态开发服务器（端口 6327）
├── .nojekyll                   # GitHub Pages：禁用 Jekyll
├── .gitignore                  # 系统垃圾 / __pycache__ / node_modules
├── LICENSE                     # MIT 全文（全自研，无第三方代码）
├── NOTICE.md                   # 自研声明与调研来源
├── README.md                   # 英文说明
└── README_CN.md                # 中文说明（含调参记录与调研记录）
```

**整个仓库 < 160 KB 纯文本**，其中 `js/data/words.js` 占 24 KB（题库数据）。

### 与系列其它项目相比**没有**的目录

| 目录 | 02/03/04 的情况 | 本项目 | 原因 |
|---|---|---|---|
| `js/engines/` | 引擎门面 / Worker | **无** | 打字游戏没有算力引擎，不需要 Worker |
| `js/worker/` | 引擎 Worker | **无** | 同上；主线程逻辑开销可忽略 |
| `js/vendor/` | 第三方产物 | **无** | 零第三方依赖 |
| `assets/` `img/` `audio/` | — | **无** | 硬约束：零图片/字体/音频文件 |
| `scripts/` | 数据编译脚本 | **无** | 题库是手写的扁平表，无需编译 |
| `third-party/` | 源码级第三方资料 | **无** | 无第三方 |
| `test/` | — | **无** | 不建测试文件（用户规约）；验证靠 `window.TypingGame` |
| `package.json` | 本项目无，系列也没有 | **无** | 零构建 |

---

## 2. 核心模块与职责分工

### 2.1 数据与参数层

#### `js/difficulty.js`（经典脚本 → `window.Difficulty`）

**唯一的难度事实来源。** 用 `<script src>` 加载而不是 ESM，原因有二：

1. 档位按钮 / 模式按钮全部由 `ui/menu.js` 从 `LEVELS` / `MODES` 现生成，
   文案与参数永远同源；
2. 调参时可以在 console / playwright 里**直接读 `Difficulty` 做参数扫描**。

对外 API：

| 导出 | 说明 |
|---|---|
| `MAX_LEVEL` | 9 |
| `LEVELS` | 十档原始参数（含 `letters` / `wordTier` / `hanziTier`） |
| `MODES` | 三种模式的 `{id, name, short, desc}` |
| `PER_CHAR_BONUS_SEC` | 0.55，每多 1 字符补偿的下落秒数 |
| `MODE_SPAWN_SCALE` | `{letters:1.0, words:1.3, hanzi:1.3}` |
| `level(n)` | 取某档的**副本**（越界夹紧，不抛错） |
| `config(modeId, n, len)` | 某档 + 某模式 + 目标长度的最终生效参数 |

**注意 `config()` 的第三个参数 `len`**：下落时间按目标字符数补偿，
`rules.js` 里所有取参数的地方走的都是 `configFor(len)` 而不是缓存的 `config`。

#### `js/data/words.js`（ESM，纯数据）

| 导出 | 规模 | 说明 |
|---|---|---|
| `LETTERS` | 26 | 按英文词频降序：`etaoinshrdlucmfwygpbvkxjqz` |
| `WORDS` | 1342（无重复） | 小写英文单词，长度 3～10+ |
| `HANZI` | 275（无重复） | `{c, p}`，全拼小写，ü→v；172 个不同拼音 |
| `wordPool(tier)` | 245 / 756 / 308 / 33 | 按字符长度分桶 |
| `hanziPool(tier)` | 81 / 105 / 62 / 27 | 按拼音长度分桶 |
| `letterPool(count)` | — | 取词频表前 N 个 |

**分桶按长度现算，数据里没有 tier 字段**——手写的标注一旦和实际长度对不上就是
一个不会报错的隐性 bug。`bucket()` 在目标档为空时会向左右扩散着借，保证返回
数组**永远非空**，上层不用做空判断。

### 2.2 规则层 `js/rules.js`（ESM）

**不碰 DOM、不碰 canvas、不出声。** 所有时间戳取自 `state.clock`，`clock` 只在
`step(state, dt)` 里前进——这保证测量值与刷新率无关，且验证时可以用
`advance(ms)` 快进。

| 导出 | 说明 |
|---|---|
| `GEOMETRY` | 256×240、HUD 16、地面顶 208/底 240、16 列 |
| `GROUND_HIT` / `SPLASH1` / `SPLASH2` | 5 / 2 / 1 像素的砸坑量 |
| `SPRITE` | 结 3、线 5、字形 5×7、汉字 16 |
| `PECK_MS` / `BURST_MS` / `DUST_MS` / `CAVE_MS` | 160 / 380 / 300 / 520 毫秒 |
| `LOG_LIMIT` | 200 条 |
| `createRng(seed)` | mulberry32，确定性随机源 |
| `bodySize(mode, len)` | 气球本体尺寸 |
| `createGame({mode, level, configFor, rng})` | 新建一局 |
| `step(state, dt)` → `events` | 先进逻辑一步 |
| `input(state, key)` → `events` | 处理一次按键 |
| `elapsedMs` / `accuracy` / `cpm` / `bps` / `collapseRatio` | 派生统计量 |
| `activeTarget(state)` | 当前输入目标 |

**事件类型**：`spawn` / `pop` / `miss` / `progress` / `land` / `collapse` /
`burst` / `over`。渲染层不看事件（它读 `state`），音频层只听事件。

**两处刻意的设计**：

- `spawnAcc` 初始化为 `spawnMs`，让**第一步就出球**——否则最短的档也要等
  1.5 秒才开始，玩家会以为"开始按钮没生效"；
- `pickTarget()` 的 `.filter((x) => !onScreen.has(...))` 是**玩法的一部分**，
  不是性能优化（见 `CLAUDE.md` 约束 4）。

### 2.3 表现层 `js/ui/`

#### `pixelfont.js`

- `GLYPHS`：手绘 5×7 点阵，A–Z / 0–9 / 少量标点，用 `'#.'` 字符串写——
  一行一行看得见形状，改错了一眼能发现，比十六进制字节可维护得多；
- `glyph` / `textWidth` / `drawText` / `drawTextCentered`：ASCII 文本绘制，
  行内同色像素**合并成一次 `fillRect`**；
- `hanziTile(ch, size=16)` / `drawHanzi(...)`：把汉字画到离屏 canvas，
  `getImageData` 后按 `HANZI_ALPHA = 110` 做 alpha 阈值二值化，得到 1bit tile
  并按字缓存。**项目不分发任何字体数据**，字形随用户系统字体变化——
  这是刻意的取舍（见 `NOTICE.md`）。

#### `stage.js`

只做一件事：把 `state` 画出来。**不判断规则、不推进时间**——连小鸟飞到哪一帧
都是按 `rules` 打的时间戳算出来的。

- `readPalette(el)`：从 `:root` 读 `--nes-*` 自定义属性，每个字段带兜底默认值；
- `createStage(canvas, {palette})` → `{resize, draw, logicalSize, getScale}`；
- `ellipse()` 是**逐行 `fillRect`** 自己写的实心椭圆，刻意不用 `ctx.ellipse`
  （会抗锯齿）；
- 气球轮廓从大到小叠三层（选中白圈 → 1px 黑边 → 本体色），顺序错了会被盖掉，
  所以不做任何"挖空"；
- 汉字模式下画的是 `drawHanzi`，其余模式画 `drawTextCentered`。

#### `panel.js`

侧栏。**本系列「诚实统计」招牌的落点。**

- 导出 `SLOW_RATIO = 0.6`，页面上的说明文案由 JS 用同一个常量填，
  **两边不会说岔**；
- `update()` 每帧调用，但文本类字段**先比值再改 DOM**，记录表**只在
  `log.length` 变化时重绘**；
- 塌陷进度条的格子数只在 `collapseLimit` 变化时重建。

#### `menu.js`

只管"显示什么、点了之后回调谁"。**不碰游戏状态、不碰规则。**

- 模式按钮 / 档位按钮从 `Difficulty.MODES` / `Difficulty.LEVELS` 现生成；
- 「开始练习」进的是**选模式页**而不是直接开局——直接开局等于把模式和难度锁死在
  默认档，那两个选择页就成了死页面；
- `setSelection()` 把菜单选中态同步成"当前正在玩的那一档"，由 `app.js` 在开局时
  调用，否则「重开本轮」后菜单高亮会和实际不符；
- Esc 关掉的是**结算浮层**，不是菜单。

### 2.4 音效层 `js/audio.js`（ESM）

- `RECIPES` 表：`pop` / `key` / `combo` / `miss` / `spawn` / `land` / `collapse`
  / `uiMove` / `start` / `over`，每条由若干"层"组成（脉冲 / 三角 / 噪声片段）；
- `createAudio({muted})` → `{unlock, play, ready, isMuted, setMuted}`；
- `play(name, {semitones})` 支持整体变调（含噪声层低通扫频），连击音靠它爬音阶；
- **惰性建 `AudioContext`**：第一次真正出声前什么都不建，由 `app.js` 在第一次
  `keydown`/`pointerdown` 时 `unlock()`；
- **静音 = 不排音**（`play()` 第一行 return），不是把音量调成 0——
  否则自动化跑一轮会在时间轴上堆几百个振荡器节点；
- `pulseWave(ctx, duty)` 用 `createPeriodicWave` 按傅里叶系数构造矩形波，
  逼近 NES 脉冲通道的 12.5% / 25% / 50% 占空比，按占空比缓存；
- `buildNoise()` 用 LCG 生成确定性噪声缓冲，保证每次运行一致；
  单个音效层抛错只 `console.warn`，不让游戏崩掉。

### 2.5 主控 `js/app.js`（ESM，唯一调度中心）

**唯一同时认识所有层的地方。**

- `STEP_MS = 1000/60`、`MAX_CATCHUP = 10`（掉帧保护）；
- `GRADE_HIGH` / `GRADE_MID` 评语阈值常量；
- `startRound(sel, rng)` / `endRound()` / `buildSummary(state)`；
- `press(key)` 是**一次按键的统一入口**（真实键盘和自动化都走它）；
- `handleEvents(events)` 把 rules 的事件分发给音频 + 侧栏 + toast；
- `fitStage()` 由 `ResizeObserver` 触发，重算整数倍缩放；
- 菜单、结算、暂停（`visibilitychange` / 失焦）都在这里协调。

**调试句柄 `window.TypingGame`**（验证用，**走的是和真玩完全相同的
`rules.step()` / `rules.input()` 路径**）：

| 成员 | 用途 |
|---|---|
| `rules` / `Difficulty` / `SLOW_RATIO` / `menu` | 直接访问各层 |
| `state` / `summary` / `current` / `isPaused()` | 只读状态 |
| `start(sel, seed)` | 开一轮，传 seed 则确定性可复现 |
| `pause()` / `resume()` | 停/恢复 rAF 自动推进 |
| `advance(ms)` | 手动按固定步长快进，返回步数 |
| `press(key)` | 注入一次按键 |
| `autoPlayOne()` | 打完当前最靠下的气球 |
| `info()` | 一次性导出侧栏要用的汇总 |

---

## 3. 文件依赖关系

```text
index.html
  ├── styles/main.css ──▶ tokens / base / components/*
  ├── <script src="js/difficulty.js">      （经典脚本，先执行）
  └── <script type="module" src="js/app.js">（ESM，后执行）
        ├── ▶ rules.js ──▶ data/words.js
        ├── ▶ ui/stage.js ──▶ ui/pixelfont.js, rules.js（只为读常量）
        ├── ▶ ui/panel.js
        ├── ▶ ui/menu.js
        └── ▶ audio.js
```

**没有反向依赖**：`rules.js` 不知道 `ui/` 和 `audio.js` 的存在；
`ui/stage.js` 只从 `rules.js` 拿几何/尺寸**常量**，不调用它的函数；
`audio.js` 不 import 任何东西。整个系统里只有一个箭头朝下的数据流。

---

## 4. 文件规模（2026-09-12）

| 文件 | 字节 | 备注 |
|---|--:|---|
| `js/data/words.js` | 24,550 | 题库数据，占整个仓库约 1/6 |
| `js/rules.js` | 20,958 | 规则层，注释量约占一半 |
| `js/ui/stage.js` | 17,341 | 渲染层 |
| `js/app.js` | 17,477 | 主控 |
| `index.html` | 10,423 | 骨架 + 玩法说明文案 |
| `js/audio.js` | 10,174 | 音效表 + 合成 |
| `js/ui/pixelfont.js` | 9,571 | 字模表体积主要在 `GLYPHS` |
| `js/ui/menu.js` | 8,771 | |
| `js/difficulty.js` | 7,774 | |
| `js/ui/panel.js` | 7,508 | |
| `styles/**` | 22,381 | 8 个文件 |
| `server.py` | 1,957 | |
| **合计** | **约 155 KB** | 无任何二进制文件 |
