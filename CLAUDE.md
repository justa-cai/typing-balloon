# CLAUDE.md

打字游戏网页应用（复刻小霸王学习卡《打字游戏》）。**纯静态**——没有构建步骤、
没有依赖安装、没有测试框架，改完文件刷新浏览器就生效。

- 线上：<https://justa-cai.github.io/typing-balloon/>（GitHub Pages，根目录）
- 仓库：<https://github.com/justa-cai/typing-balloon>

---

## 快速命令

```bash
python3 server.py          # 本地开发服务器，http://127.0.0.1:6327/
```

`file://` 直接打开**不行**：`app.js` 是 ES 模块，浏览器对 `file://` 下的模块加载
会走 CORS 检查并失败。必须起 HTTP。

---

## 架构

```
index.html
  ├─ js/difficulty.js    经典 <script> → window.Difficulty   档位表 / 模式表
  └─ js/app.js           ES 模块（type="module"），唯一调度中心
        ├─ js/rules.js          裁判层
        ├─ js/ui/stage.js       渲染层
        ├─ js/ui/panel.js       侧栏
        ├─ js/ui/menu.js        菜单 / 结算 / toast
        ├─ js/ui/pixelfont.js   字形
        ├─ js/data/words.js     题库（纯数据）
        └─ js/audio.js          音效
```

数据是**单向**的：`rules` 产出 `state` + `events`，渲染层和音效层只消费。
反向没有通路——`stage.js` 不能改 `state`，`audio.js` 不能读 `state`。

```
difficulty.js  ──configFor(len)──▶  rules.js  ──state──▶  ui/stage.js
                                                  │        ui/panel.js
                                                  └─events─▶  audio.js
                                                             app.js(handleEvents)
```

`app.js` 是唯一同时认识所有层的地方。**画面上所有会变的东西都从 `state` 来**，
没有第二条事实来源。

---

## 改这个仓库前必须知道的硬约束

每一条都对应一个踩过的坑或刻意的取舍。**不要凭直觉绕过它们。**

### 1. 不许引入图片、字体、音频文件（也不许引 CDN）

这是本项目的立项前提，也是整个系列里最极端的一条。具体地：

- **音效**只能是 `js/audio.js` 用振荡器 / 噪声缓冲现场合成。想加一个音效就
  往 `RECIPES` 表里加一条，不要"先放个 wav 顶一下"。
- **favicon** 是 `index.html` 里的一段内联 `data:image/svg+xml`，不是文件。
- **汉字**不打包 CJK 字库，用本机字体现场栅格化（见约束 4）。
- 唯一的外部 URL 是 `index.html` 里指向本项目自己仓库的两个链接。

### 2. 颜色只在 `styles/tokens.css` 里定义

渲染层通过 `readPalette()` 从 `:root` 的 `--nes-*` 自定义属性**读**颜色，
`js/ui/stage.js` 里**不出现任何硬编码色值**。想换配色只改 tokens.css 一个地方。

`readPalette()` 的每个字段都有兜底默认值——样式表没加载完时不会黑屏。

### 3. 难度只在 `js/difficulty.js` 里定义

`LEVELS` 是唯一的事实来源。**不许**在 `rules.js` / `menu.js` / `panel.js` /
`index.html` 里写死任何档位数字或档位文案：

- 档位按钮由 `ui/menu.js` 从 `Difficulty.LEVELS` 现生成（10 个）
- 模式按钮由 `Difficulty.MODES` 现生成（4 个，键位分区排第一位——初学者
  默认入口）；键位组按钮由 `Difficulty.KEY_GROUPS` 现生成（10 个，仅键位
  分区模式的菜单流程会经过这一页）
- 菜单里的参数说明、侧栏的「难度参数」卡都调 `Difficulty.config()` 现算

这样改一张表，四处文案自动同步，不会出现"文案说很难、参数很温柔"的漂移。

**注意 `config(modeId, n, len)` 的第三个参数。** 下落时间必须按目标**字符数**
补偿（`PER_CHAR_BONUS_SEC`，每多 1 字符 +0.55s）。`rules.js` 里所有取参数的
地方走的都是 `state.configFor(len)` 而不是 `state.config`——后者是
`configFor(1)` 的缓存，只用于生成间隔、同屏上限这些与长度无关的字段。

### 4. 同屏不许出现重复目标

`pickTarget()` 里那句 `.filter((x) => !onScreen.has(...))` 是**玩法的一部分**，
不是性能优化。删掉它，"按 A 打哪一个 A"就成了随机事件，玩家会觉得游戏在耍赖。
单词和汉字模式同理（汉字比对的是拼音 `h.p`）。

### 5. 5×7 字模不许被 `fillText` 顶替

`js/ui/pixelfont.js` 的手绘 `GLYPHS` 是像素观感的基础。浏览器把 8px 的字渲染
出来带抗锯齿灰边，放大 3 倍就是一坨糊的；点阵字放大 3 倍还是硬边——
这是"像素风"和"低分辨率"的区别。

汉字的 `hanziTile()` **可以**用 `fillText`，因为它是在 16×16 的**离屏** canvas
上画完立刻做 alpha 阈值二值化（`HANZI_ALPHA = 110`）的，取的是 1bit 结果。
但画到主画布上时必须走 `fillRect`。

### 6. 不许用 `ctx.arc` / `ctx.ellipse` / `ctx.roundRect`

全部会抗锯齿。`stage.js` 里的 `ellipse()` 是用逐行 `fillRect` 自己写的。
阴影、描边同理——`ctx.shadowBlur` 一律不用。

### 7. 缩放只取整数倍

`resize()` 里 `Math.floor(raw)` 和 `Math.max(1, Math.min(4, ...))` 都不能省。
非整数倍缩放会把 1 个逻辑像素摊成 2.5 个屏幕像素——`pixelated` 也救不回来，
边缘会出现宽度不均的条纹。上限 4 倍是刻意的：再大就该换赛道，而不是让一个
256px 的画面占满 2K 屏。

### 8. 逻辑时钟不许从 `performance.now()` 现取

`rules.js` 里所有时间戳都取自 `state.clock`，而 `clock` 只在 `step(state, dt)`
里前进。这条保证了三件事：

1. 反应时间 / 生成间隔 / 下落速度与显示刷新率无关；
2. 验证时可以用 `TypingGame.advance(ms)` 快进，不必真的等 30 秒；
3. 特效（小鸟、扬尘、塌陷）的动画进度跟着逻辑时钟走，掉帧时不会飘。

`state.clock` 一旦被某个 `Date.now()` 污染，上面三条全废。

### 9. 静音 = 不排音，不是音量归零

`audio.play()` 第一行就是 `if (isMuted) return`。自动化驱动时如果只是把
`master.gain` 调到 0，跑一轮下来会在时间轴上堆几百个振荡器节点。
`?mute=1` 走的就是这条路径（见 `app.js` 顶部）。

### 10. 输入法激活时收不到字母键

`KeyboardEvent.key` 在中文输入法下会是 `'Process'` 或直接不触发。这是浏览器
层面的限制，改不了——`input()` 里的 `/^[a-z0-9]$/` 白名单就是干这个的，
菜单的「玩法说明」页里也明确写了"请把输入法切到英文"。

---

## 校准记录

### 2026-09-12 · 首版难度参数

按「**完全不操作还能撑多久**」反推。一屏 16 列，每列大约能挨 6 下
（本列 5 + 邻列溅射 2 + 隔列 1，但邻列的伤害会互相抵扣）：

```
L0 : 6 列 ≈ 26 球 × 1.50s ≈ 39s
L5 : 4 列 ≈ 17 球 × 0.90s ≈ 15s
L9 : 3 列 ≈ 12 球 × 0.42s ≈  5s
```

即最低限度的操作压力：手完全不动能撑 5～39 秒（随档位），但不至于一上手就输。
四档刻度（9.0/8.3/7.6/…/2.7 秒）取等差数列，每档减 0.7s，肉眼可核对。

### 2026-09-12 · 长度补偿

`PER_CHAR_BONUS_SEC = 0.55`。取值依据：L0 单字给 9.0s，一个 9 字母的单词
拿到的就是 9.0 + 8×0.55 = 13.4s。按 9 个键算，等于允许约 1.5 秒/键——
对一个入门档来说刚好是"来得及但要专心"的节奏。

生成间隔的倍率 `MODE_SPAWN_SCALE.words = 1.3` 是同一个道理：目标更长，
球也得出得稀一些，否则屏幕会被长单词塞满。

### 验证方式（不落仓库的脚本）

`js/app.js` 末尾暴露了 `window.TypingGame`，可以在 console / playwright 里
直接驱动，**走的是和真玩完全相同的 `rules.step()` / `rules.input()` 路径**，
不存在"验证时跑的是另一条分支"：

```js
TypingGame.start({ mode: 'words', level: 6 }, 12345);  // 传种子 → 可复现
TypingGame.start({ mode: 'keys', level: 0, group: 3 }); // 键位分区：第 3 组 = qwert
TypingGame.pause();                    // 停掉 rAF 自动推进
TypingGame.advance(30000);             // 快进 30 秒
TypingGame.press('a');                 // 注入一次按键
TypingGame.autoPlayOne();              // 打完当前最靠下的那个气球
TypingGame.info();                     // 一次性导出侧栏要用的汇总
TypingGame.summary;                    // 结算数据（结算后才非空）
```

调参时改完 `difficulty.js` 刷新页面，读 `Difficulty.LEVELS` 与
`TypingGame.info()` 对照即可，不需要手打一局。

---

## 与系列其它项目的关系

`/nvme/work/Game` 下已有 02.chess / 03.chess_master / 04.Gomoku。本项目是第 5 个，
沿用系列的工程约定（纯静态零构建、design tokens、分层架构、specs 文档、
诚实统计侧栏），但有三处是系列首创：

| | 系列前四个 | 本项目 |
|---|---|---|
| 视觉 | 深色科技风 + 木色棋盘 | **FC 像素风**（256×240 整数倍放大） |
| 音效 | 完全没有 | **Web Audio 现场合成**（仍不落地任何资源文件） |
| 难度含义 | 映射到引擎强度/搜索弱化 | **纯环境压力**：球落多快、出多密、地面能挨几下 |

系列里 `js/engines/bridge.js` + Worker 那一层在本项目**不适用**（打字游戏没有
算力引擎），但其「难度单一事实来源」和「侧栏真实统计表」两个招牌做法保留了。

---

## 改动的默认流程

1. 改参数 → 只动 `js/difficulty.js`，刷新页面读 `Difficulty.LEVELS` 核对
2. 改玩法 → 只动 `js/rules.js`，它是纯逻辑，不碰 DOM，可以放心重构
3. 改画面 → 只动 `js/ui/stage.js` + `styles/tokens.css` 的 `--nes-*`
4. 改完在浏览器里跑一轮，确认没有回归（尤其别破坏约束 4 和 8）
5. **不新建测试文件**——验证靠 `window.TypingGame` 现场驱动
