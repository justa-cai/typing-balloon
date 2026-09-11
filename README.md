# Typing Balloon · 气球打字

A browser remake of the **typing game built into Subor's "Chinese/English
Computer Study Card"** (小霸王「中英文电脑学习卡」内置《打字游戏》, standard on
SB-926 and similar machines) — the one where lettered balloons drift down from
the sky, you burst them by typing, a little bird flies in to peck each one, and
balloons you miss dig craters until the ground caves in.

Pure front end: **no build step, no dependencies, no CDN, and not a single image,
font or audio file.** The whole game is a handful of text files you can drop on
GitHub Pages.

> 中文说明见 [README_CN.md](README_CN.md).
> **Play online: <https://justa-cai.github.io/typing-balloon/>** ·
> Source: <https://github.com/justa-cai/typing-balloon>

## Highlights

- **Honest pixel art, not "low-res"** — the logical resolution is fixed at
  **256×240** (native NES), displayed only at **integer** scale with
  `image-rendering: pixelated`. Letters are hand-drawn 5×7 bitmap glyphs; Hanzi
  are rasterised on the fly from the user's own system font into 16×16 1-bit
  tiles. Everything is drawn with `fillRect` — never `ctx.arc`/`ctx.ellipse`,
  which anti-alias and turn hard pixel edges into grey mush.
- **Sound synthesised in the browser** — square/saw via `createPeriodicWave`
  duty cycles, triangle, and a deterministic noise buffer through a swept
  low-pass. Six effects, all parameters in one table in `js/audio.js`.
  Zero audio files.
- **Three practice modes** — finger placement on letters, English words,
  Hanzi by full pinyin.
- **Ten difficulty levels (0–9)**, matching the original. Four knobs per level
  (fall seconds / spawn interval / on-screen cap / collapse threshold) are
  written out explicitly in `js/difficulty.js` — read them straight from the
  console, nothing is hidden behind a formula.
- **Fail by terrain, not by lives** — a missed balloon dents the ground in a
  bowl shape; when enough columns are punched through, the round ends. A wrong
  keypress only costs accuracy, never the round.
- **Honest stats** — the side panel lists every single burst with its
  *measured* reaction time next to *that balloon's own* time budget. Rows slower
  than 60% of their budget are highlighted amber. Nothing averaged away,
  nothing rounded up to look better.

## Gameplay

Balloons carrying a character descend from the top of the screen. Type the
character and the balloon bursts — a bird flies in from the right to peck it.

| Mode | Balloon carries | What you type |
|---|---|---|
| Letters | `A`–`Z` (one character) | that key |
| Words | an English word | the full spelling |
| Hanzi | a Chinese character | its **full pinyin** (`ü` is typed as `v`) |

Matching is **case-insensitive** and uses a uniform *input buffer + prefix
match* rule:

- With an empty buffer, a keypress selects the **lowest** (closest to the
  ground) balloon starting with that key.
- With a non-empty buffer, only the current target is considered; a key that
  isn't the next character of its spelling counts as a miss, clears the buffer
  and rolls the target's progress back to zero.

Two hard guarantees keep this from feeling arbitrary:

1. **No duplicate targets on screen.** The spawner filters out any character
   already up there, so "which `A` did I hit?" is never a coin flip.
2. **Longer targets get proportionally more time.** A 9-letter word is not
   given the same descent window as a single letter — the compensation rule
   (`PER_CHAR_BONUS_SEC`) lives in `difficulty.js` and is applied per balloon.

### Ground collapse

`ground[16]` holds the surface Y of each of the 16 columns. A landing balloon
pushes its own column down by 5 px and splashes 2 px / 1 px into its
neighbours, so craters form a bowl rather than a spike. When a column's surface
reaches the bottom of the canvas the column is **punched through**; reach the
level's `collapseLimit` and the round ends.

Because "how much room is left" is drawn on screen at all times (and mirrored
as a segmented meter in the HUD and the side panel), you never lose to something
you couldn't see.

## Difficulty

| Level | Name | Fall (s) | Spawn (ms) | On screen | Collapse limit | Letters | Word tier | Pinyin tier |
|:--:|:--:|--:|--:|:--:|:--:|:--:|:--:|:--:|
| 0 | 入门 | 9.0 | 1500 | 3 | 6 | 8 | 1/4 | 1/4 |
| 1 | 新手 | 8.3 | 1380 | 3 | 6 | 10 | 1/4 | 1/4 |
| 2 | 初学 | 7.6 | 1260 | 4 | 5 | 12 | 1/4 | 2/4 |
| 3 | 熟练 | 6.9 | 1140 | 4 | 5 | 16 | 2/4 | 2/4 |
| 4 | 上手 | 6.2 | 1020 | 5 | 5 | 20 | 2/4 | 3/4 |
| 5 | 进阶 | 5.5 | 900 | 5 | 4 | 24 | 2/4 | 3/4 |
| 6 | 快速 | 4.8 | 780 | 6 | 4 | 26 | 3/4 | 3/4 |
| 7 | 高手 | 4.1 | 660 | 6 | 4 | 26 | 3/4 | 4/4 |
| 8 | 精英 | 3.4 | 540 | 7 | 3 | 26 | 4/4 | 4/4 |
| 9 | 大师 | 2.7 | 420 | 8 | 3 | 26 | 4/4 | 4/4 |

Words and Hanzi spawn 1.3× slower than letters, and every extra character in a
target adds 0.55 s of descent time. The single source of truth for all of this
is `js/difficulty.js`; the level buttons, the menu description and the side
panel are all generated from it, so the text can never drift from the numbers.

## Architecture

```text
index.html
  ├─ js/difficulty.js    classic <script> → window.Difficulty  (levels + modes)
  └─ js/app.js           ES module: the only place that wires things together
        ├─ js/rules.js          referee: spawn, fall, matching, scoring,
        │                       ground collapse, round end  (no DOM/canvas/audio)
        ├─ js/ui/stage.js       Canvas pixel renderer  (draws, never decides)
        ├─ js/ui/panel.js       side panel stats + burst log
        ├─ js/ui/menu.js        overlay menus + summary + toast
        ├─ js/ui/pixelfont.js   5×7 bitmap glyphs + Hanzi binarisation
        ├─ js/data/words.js     letter/word/Hanzi banks (pure data)
        └─ js/audio.js          Web Audio synthesis
```

The logic clock is a **fixed 60 Hz step** decoupled from `rAF`. Measured
reaction times, spawn intervals and fall speeds are therefore identical on a
60 Hz and a 144 Hz display — otherwise "412 ms this time" would just be a
random number that depends on your monitor.

## Documentation

- [`specs/prd.md`](specs/prd.md) — requirements, the research into the original
  (with a confidence level on every claim), acceptance criteria
- [`specs/ui.md`](specs/ui.md) — layout and interaction specification
- [`specs/project_tree.md`](specs/project_tree.md) — every file, one by one
- [`CLAUDE.md`](CLAUDE.md) — architecture, hard constraints, calibration log

## Run locally

```bash
python3 server.py          # → http://127.0.0.1:6327/
```

Any static file server works. `?mute=1` starts muted (used when driving the
game from automation).

## Deploy

Push to a GitHub Pages repo; `.nojekyll` is included. No headers, no build
pipeline, no cross-origin isolation needed.

## License

MIT — see [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md). All code and data in
this repository are original; the sources used to research the original game
are listed in NOTICE.md.
