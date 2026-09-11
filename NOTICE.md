# NOTICE

## 自研声明

本项目的全部源码（规则、渲染、音效、UI、样式、文档）均为原创，
**不包含任何第三方版权代码与资源文件**。因此整体许可为 MIT（见 `LICENSE`）。

- 无第三方 JS 库、无 CDN、无打包器
- **无图片、字体、音频文件**（这是硬约束，见 `CLAUDE.md`）
- 无构建产物

### 关于字形数据

`js/ui/pixelfont.js` 里的 5×7 点阵字形是本项目**手工绘制**的（用 `'#.'`
字符串表逐行写成），不是从任何现成字体文件中提取或转换的，因此不涉及
字体授权。

汉字模式不打包任何 CJK 字库：气球上的汉字由浏览器用**用户本机安装的
中文字体**现场绘制到离屏 canvas，再做 alpha 阈值二值化得到像素块
（见 `js/ui/pixelfont.js` 的 `hanziTile()`）。运行时依赖用户系统字体，
但项目**不分发、不嵌入**任何字体数据。

### 关于音效

`js/audio.js` 全部用 Web Audio API 的振荡器与噪声缓冲现场合成，
**没有任何音频采样文件**。

## 调研来源（原版游戏考证）

复刻对象是**小霸王「中英文电脑学习卡」内置的《打字游戏》**（SB-926 等机型
标配，位于「指法练习」之后的进阶项目），不是独立发售的游戏，也没有独立 ROM。
考证所依据的公开来源：

| 来源 | 用途 |
|---|---|
| [复刻小霸王上的打字游戏 · V2EX](https://global.v2ex.co/t/1117657) | 原版玩家记忆（气球带字下落、小鸟啄破气球）与复刻者的实现说明 |
| [小霸王学习机到底能不能用来学习？· 知乎](https://zhuanlan.zhihu.com/p/64620645) | 学习卡的功能构成（指法练习 / 打字游戏） |
| [小霸王学习机型号梳理（1995-2000）· 知乎](https://zhuanlan.zhihu.com/p/430498014) | 机型与学习卡版本 |
| [金山打字通怎么玩打字游戏](https://www.cuanjibiji.com/15405.html) | 同时期同类「玩泡泡」的判定规则对照 |
| [Mario Teaches Typing · Wikipedia](https://en.wikipedia.org/wiki/Mario_Teaches_Typing) | 同时期同类打字教学游戏的机制对照 |
| [Balloon Pop · TypingGamesKids](https://typinggameskids.com/games/balloon-pop/) | 同类气球打字玩法的机制对照 |
| B 站 UP「颖火虫」《小霸王学习卡》系列实机录像 `BV124411a7kn` / `BV1A4411p77m` / `BV164411u7K7` / `BV1t7411h7cb` | 原版画面与菜单结构的实机参照 |

同时期同类复刻参照：[vicalloy/apple-guardian](https://github.com/vicalloy/apple-guardian)
（MIT，Phaser + React，在线试玩 <https://vicalloy.github.io/letter-fall/>）。
本项目**未复用其任何代码**，技术路线也不同（纯 Canvas、零构建、像素风）。

原版哪些细节有确证、哪些是推测，逐条记录在 `specs/prd.md` 的「调研结论」
一节，没有把握的部分都标了可信度，不做「看起来像考证」的编造。

## 运行环境

- 现代浏览器（需支持 ES2020 模块、Canvas、Web Audio、ResizeObserver）
- 本地开发：`python3 server.py`（默认端口 6327）
- 部署：任意静态托管（GitHub Pages 直接推 master 即可，`.nojekyll` 已就位）
