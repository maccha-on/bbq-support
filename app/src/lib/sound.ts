// FR-2.5: チェックON/OFF操作時のSE。外部音源ファイルを持たず、Web Audio APIで短いビープ音を生成する。
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new Ctor();
  }
  return audioCtx;
}

// モバイルブラウザの自動再生制限対策として、初回タップ時に呼び出してAudioContextを初期化する
export function initAudio() {
  const ctx = getAudioContext();
  if (ctx?.state === "suspended") ctx.resume();
}

function beep(freq: number, durationMs: number) {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = freq;
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + durationMs / 1000);
}

export function playCheckOnSound() {
  beep(880, 120);
}

export function playCheckOffSound() {
  beep(440, 150);
}
