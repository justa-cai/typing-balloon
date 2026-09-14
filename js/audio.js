/**
 * audio.js - Web Audio 现场合成的 FC 风格音效
 *
 * 本项目不引入任何音频文件（硬约束，见 CLAUDE.md）。FC 的 APU 本来就只有
 * 方波、三角波和噪声三种源，用振荡器现场合成反而比采样更"对味"——
 * 音高、滑音、包络全都是参数，想改就改，不用重新导出音频。
 *
 * ── 为什么不在加载时就建 AudioContext ─────────────────────────────────
 *
 * 浏览器的自动播放策略要求 AudioContext 必须在**用户手势**里创建或 resume，
 * 否则会是一个永久 suspended 的僵尸上下文。所以这里第一次真正出声前什么都不建，
 * 由 app.js 在第一次 keydown / click 时调用 unlock()。
 *
 * ── 静音 ─────────────────────────────────────────────────────────────
 *
 * 静音不是"把音量调成 0"，而是直接不排音——这样自动化驱动（playwright）
 * 跑的时候不会有几百个振荡器节点堆积在时间轴上。除程序化静音外还支持
 * URL 参数 `?mute=1`，由 app.js 读出来传进来。
 *
 * @license MIT
 */

/** 主音量。FC 的音效本来就脆，压低一点免得吵 */
const MASTER = 0.22;

/**
 * 各音效的参数表。集中放在这里是为了"想调音只改一张表"，
 * 不用在合成代码里翻来翻去。
 *
 * 每条音效由若干"层"组成，每层是一个脉冲/三角/噪声片段：
 *   { wave, freq, freqTo, t, dur, gain, duty }
 */
const RECIPES = {
  // 击破气球：噪声爆裂 + 方波急速下滑，短促干脆
  pop: [
    { wave: 'noise', t: 0, dur: 0.07, gain: 0.75, filterFrom: 3200, filterTo: 600 },
    { wave: 'square', freq: 1400, freqTo: 320, t: 0, dur: 0.09, gain: 0.5, duty: 0.25 }
  ],
  // 打错：低音方波两声短哔，闷但不刺耳
  miss: [
    { wave: 'square', freq: 196, freqTo: 165, t: 0, dur: 0.06, gain: 0.4, duty: 0.5 },
    { wave: 'square', freq: 147, freqTo: 123, t: 0.07, dur: 0.08, gain: 0.35, duty: 0.5 }
  ],
  // 气球落地：一声闷响，噪声 + 极低频三角
  land: [
    { wave: 'noise', t: 0, dur: 0.14, gain: 0.5, filterFrom: 900, filterTo: 180 },
    { wave: 'triangle', freq: 150, freqTo: 70, t: 0, dur: 0.16, gain: 0.6 }
  ],
  // 地面塌陷：长下滑 + 长噪声，比落地重得多
  collapse: [
    { wave: 'noise', t: 0, dur: 0.42, gain: 0.55, filterFrom: 1400, filterTo: 120 },
    { wave: 'square', freq: 330, freqTo: 62, t: 0, dur: 0.44, gain: 0.4, duty: 0.125 },
    { wave: 'triangle', freq: 110, freqTo: 45, t: 0.05, dur: 0.4, gain: 0.55 }
  ],
  // 逐键命中：每打对一个字符一声轻脆"哒"。这是打字游戏最基本的反馈——
  // 不用等气球炸开就知道"这一下按对了"。音量压得比 pop 低得多，
  // 连打一整句也不会盖过击破声，只当节奏垫底。
  key: [
    { wave: 'square', freq: 1180, freqTo: 880, t: 0, dur: 0.022, gain: 0.13, duty: 0.125 }
  ],
  // 连击点缀：从第 2 连击起和 pop 一起响。音高不写死在这里，由 play 时
  // 传的 semitones 按连击数抬高（最高一个八度），连得越久爬得越高。
  combo: [
    { wave: 'square', freq: 1319, t: 0, dur: 0.045, gain: 0.2, duty: 0.125 },
    { wave: 'square', freq: 1760, t: 0.04, dur: 0.06, gain: 0.18, duty: 0.125 }
  ],
  // 气球生成：很轻的一声上滑 whoosh，提示"来了个新目标"。
  // 出球密时这声会连成一片，所以音量刻意比其他音效更低。
  spawn: [
    { wave: 'noise', t: 0, dur: 0.08, gain: 0.17, filterFrom: 600, filterTo: 2400 },
    { wave: 'triangle', freq: 320, freqTo: 620, t: 0, dur: 0.07, gain: 0.12 }
  ],
  // 菜单/UI 点击：短促单音，切页、选项、关浮层都用它
  uiMove: [
    { wave: 'square', freq: 740, t: 0, dur: 0.035, gain: 0.2, duty: 0.25 }
  ],
  // 开始：上行两音，像游戏机"叮咚"一下
  start: [
    { wave: 'square', freq: 523, t: 0, dur: 0.07, gain: 0.4, duty: 0.5 },
    { wave: 'square', freq: 784, t: 0.08, dur: 0.12, gain: 0.4, duty: 0.25 }
  ],
  // 结束：下行琶音，很 FC 的"game over"
  over: [
    { wave: 'square', freq: 784, t: 0, dur: 0.1, gain: 0.4, duty: 0.25 },
    { wave: 'square', freq: 659, t: 0.12, dur: 0.1, gain: 0.4, duty: 0.25 },
    { wave: 'square', freq: 523, t: 0.24, dur: 0.1, gain: 0.4, duty: 0.25 },
    { wave: 'square', freq: 392, t: 0.36, dur: 0.16, gain: 0.42, duty: 0.5 },
    { wave: 'triangle', freq: 196, freqTo: 98, t: 0.52, dur: 0.5, gain: 0.5 }
  ]
};

/**
 * 建一个音效播放器。
 *
 * @param {object} [opts]
 * @param {boolean} [opts.muted] 初始是否静音
 * @returns {{unlock: Function, play: Function, setMuted: Function, isMuted: Function, ready: Function}}
 */
export function createAudio({ muted = false } = {}) {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let isMuted = !!muted;

  /** 惰性建上下文——必须在用户手势里调用 */
  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false; // 浏览器不支持就安静地降级，不影响玩
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = MASTER;
    master.connect(ctx.destination);
    noiseBuffer = buildNoise(ctx);
    return true;
  }

  /**
   * 播放一个音效。
   * @param {string} name RECIPES 里的键
   * @param {object} [opts]
   * @param {number} [opts.semitones=0] 整体升降的半音数（连击音靠它爬音阶）
   */
  function play(name, { semitones = 0 } = {}) {
    if (isMuted) return;
    const recipe = RECIPES[name];
    if (!recipe) return;
    if (!unlock()) return;

    // 变调：整条配方一起移调，连噪声层里的滤波扫频也跟着走，
    // 不至于只有方波在飘、噪声还留在原地。
    const pitch = semitones ? Math.pow(2, semitones / 12) : 1;
    const t0 = ctx.currentTime + 0.001;
    for (const layer of recipe) {
      try {
        if (layer.wave === 'noise') playNoise(layer, t0, pitch);
        else playTone(layer, t0, pitch);
      } catch (err) {
        // 单个音效层失败不该让游戏崩掉
        console.warn('[audio] 播放失败', name, err);
      }
    }
  }

  /** 合成一个方波/三角波片段 */
  function playTone(layer, t0, pitch = 1) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = layer.wave === 'triangle' ? 'triangle' : 'square';
    if (osc.type === 'square' && layer.duty != null && osc.setPeriodicWave) {
      // 用自定义周期波做占空比，逼近 NES 的 12.5% / 25% / 50% 脉冲波
      osc.setPeriodicWave(pulseWave(ctx, layer.duty));
    }

    const start = t0 + (layer.t || 0);
    const end = start + layer.dur;
    osc.frequency.setValueAtTime(layer.freq * pitch, start);
    if (layer.freqTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, layer.freqTo * pitch), end);
    }

    // 方波直接开关会有咔哒声，给 6ms 的淡入 + 指数淡出
    const g = layer.gain != null ? layer.gain : 0.4;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(g, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(gain).connect(master);
    osc.start(start);
    osc.stop(end + 0.02);
  }

  /** 合成一段噪声（带低通扫频） */
  function playNoise(layer, t0, pitch = 1) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const gain = ctx.createGain();

    const start = t0 + (layer.t || 0);
    const end = start + layer.dur;

    // 滤波频率也跟着变调，但要夹在可听范围内
    const from = clampFreq((layer.filterFrom || 2000) * pitch);
    filter.frequency.setValueAtTime(from, start);
    if (layer.filterTo) {
      filter.frequency.exponentialRampToValueAtTime(clampFreq(layer.filterTo * pitch), end);
    }

    const g = layer.gain != null ? layer.gain : 0.4;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(g, start + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    src.connect(filter).connect(gain).connect(master);
    src.start(start);
    src.stop(end + 0.02);
  }

  return {
    unlock,
    play,
    /** 只有真正有上下文时才算就绪（自动化里可用来断言） */
    ready: () => !!ctx,
    isMuted: () => isMuted,
    setMuted(next) {
      isMuted = !!next;
      if (master) master.gain.value = isMuted ? 0 : MASTER;
    }
  };
}

/** 变调后的滤波频率夹在 40Hz～16kHz，免得超出可听范围或撞上奈奎斯特 */
function clampFreq(hz) {
  return Math.max(40, Math.min(16000, hz));
}

/** 生成一段 1 秒的白噪声，反复复用，不必每次重建 */
function buildNoise(ctx) {
  const len = Math.floor(ctx.sampleRate);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let seed = 0x2545f491;
  for (let i = 0; i < len; i++) {
    // 用确定性随机而不是 Math.random，保证每次运行的噪声一致
    seed = (seed * 1664525 + 1013904223) >>> 0;
    data[i] = (seed / 4294967296) * 2 - 1;
  }
  return buf;
}

/** 按占空比构造一个周期波（NES 脉冲通道的近似） */
const waveCache = new Map();
function pulseWave(ctx, duty) {
  const key = Math.round(duty * 100);
  if (waveCache.has(key)) return waveCache.get(key);
  const n = 32;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  const d = Math.max(0.05, Math.min(0.5, duty));
  for (let i = 1; i < n; i++) {
    // 矩形波的傅里叶系数：占空比 d 时第 i 次谐波幅度
    real[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * d);
    imag[i] = 0;
  }
  const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  waveCache.set(key, wave);
  return wave;
}
