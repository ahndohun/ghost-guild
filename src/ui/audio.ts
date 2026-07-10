const masterVolume = 0.25;
const bgmVolume = 0.35;
const bgmSrc = "/assets/audio/bgm-spooky-dungeon.mp3";

export type SoundName =
  | "hit"
  | "kill"
  | "eliteKill"
  | "levelUp"
  | "gemPickup"
  | "goldPickup"
  | "heroDeath"
  | "victory"
  | "uiClick";

type AudioEngineOptions = {
  readonly enabled: boolean;
  readonly muted: boolean;
  readonly onMutedChange: (muted: boolean) => void;
};

export type AudioEngine = {
  readonly play: (sound: SoundName) => void;
};

type AudioRuntime = {
  readonly context: AudioContext;
  readonly master: GainNode;
  readonly noise: AudioBuffer;
};

type ToneSpec = {
  readonly wave: OscillatorType;
  readonly startHz: number;
  readonly endHz: number;
  readonly duration: number;
  readonly gain: number;
  readonly delay?: number;
};

type NoiseSpec = {
  readonly duration: number;
  readonly gain: number;
  readonly cutoffHz: number;
  readonly delay?: number;
};

type NotesSpec = {
  readonly frequencies: readonly number[];
  readonly spacing: number;
  readonly duration: number;
};

export function createAudioEngine(
  documentRef: Document,
  options: AudioEngineOptions,
): AudioEngine {
  let muted = options.muted;
  let failed = false;
  let runtime: AudioRuntime | undefined;
  let hitVariation = 0;
  let lastGemTime = Number.NEGATIVE_INFINITY;
  let bgmStarted = false;
  const bgm = options.enabled ? createBgmElement(documentRef) : undefined;

  const soundButtons = documentRef.querySelectorAll<HTMLButtonElement>("[data-testid=\"sound-toggle\"]");
  syncSoundButtons(soundButtons, muted);
  for (const button of soundButtons) {
    button.addEventListener("click", () => {
      muted = !muted;
      if (runtime !== undefined) {
        try {
          runtime.master.gain.setValueAtTime(muted ? 0 : masterVolume, runtime.context.currentTime);
        } catch {
          failed = true;
          runtime = undefined;
        }
      }
      applyBgmMuteState(bgm, muted, bgmStarted);
      syncSoundButtons(soundButtons, muted);
      options.onMutedChange(muted);
    });
  }

  if (options.enabled) {
    const startAfterGesture = (): void => {
      initializeSfxAfterGesture();
      startBgmAfterGesture();
    };
    documentRef.addEventListener("pointerdown", startAfterGesture, { once: true, passive: true });
    documentRef.addEventListener("keydown", startAfterGesture, { once: true });
    documentRef.addEventListener("click", playButtonClick);
  }

  function initializeSfxAfterGesture(): void {
    if (failed || runtime !== undefined || typeof AudioContext !== "function") {
      return;
    }

    try {
      runtime = createAudioRuntime(muted);
      if (runtime.context.state === "suspended") {
        void runtime.context.resume().catch(() => {
          failed = true;
        });
      }
    } catch {
      failed = true;
      runtime = undefined;
    }
  }

  function startBgmAfterGesture(): void {
    if (bgm === undefined || bgmStarted) {
      return;
    }
    bgmStarted = true;
    if (muted) {
      bgm.pause();
      return;
    }
    void bgm.play().catch(() => {
      // Autoplay / decode failures are non-fatal; user can retry via later gestures only if we re-wire.
      // Keep the element so unmute can attempt play again.
      bgmStarted = true;
    });
  }

  function playButtonClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const button = target.closest("button");
    if (button !== null && !button.hasAttribute("disabled")) {
      play("uiClick");
    }
  }

  function play(sound: SoundName): void {
    const activeRuntime = runtime;
    if (muted || failed || activeRuntime === undefined || activeRuntime.context.state === "closed") {
      return;
    }

    try {
      switch (sound) {
        case "hit": {
          const pitch = 184 + (hitVariation % 4) * 22;
          hitVariation += 1;
          scheduleTone(activeRuntime, { wave: "square", startHz: pitch, endHz: pitch * 0.82, duration: 0.055, gain: 0.16 });
          return;
        }
        case "kill":
          scheduleTone(activeRuntime, { wave: "sawtooth", startHz: 430, endHz: 145, duration: 0.16, gain: 0.2 });
          return;
        case "eliteKill":
          scheduleTone(activeRuntime, { wave: "sine", startHz: 96, endHz: 42, duration: 0.45, gain: 0.68 });
          scheduleNoise(activeRuntime, { duration: 0.24, gain: 0.28, cutoffHz: 520 });
          return;
        case "levelUp":
          scheduleNotes(activeRuntime, { frequencies: [293.66, 369.99, 440], spacing: 0.085, duration: 0.15 });
          return;
        case "gemPickup": {
          const now = activeRuntime.context.currentTime;
          if (now - lastGemTime < 0.1) {
            return;
          }
          lastGemTime = now;
          scheduleTone(activeRuntime, { wave: "sine", startHz: 880, endHz: 1174.66, duration: 0.07, gain: 0.16 });
          return;
        }
        case "goldPickup":
          scheduleTone(activeRuntime, { wave: "square", startHz: 1320, endHz: 920, duration: 0.065, gain: 0.14 });
          return;
        case "heroDeath":
          scheduleNotes(activeRuntime, { frequencies: [220, 174.61], spacing: 0.24, duration: 0.32 });
          return;
        case "victory":
          scheduleNotes(activeRuntime, { frequencies: [293.66, 369.99, 440, 587.33], spacing: 0.1, duration: 0.2 });
          return;
        case "uiClick":
          scheduleTone(activeRuntime, { wave: "square", startHz: 300, endHz: 240, duration: 0.035, gain: 0.075 });
          return;
        default:
          return assertNever(sound);
      }
    } catch {
      failed = true;
      runtime = undefined;
    }
  }

  return { play };
}

function createBgmElement(documentRef: Document): HTMLAudioElement {
  const audio = documentRef.createElement("audio");
  audio.src = bgmSrc;
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = bgmVolume;
  audio.setAttribute("aria-hidden", "true");
  // Keep the element out of the accessibility tree / layout; not appended is fine for play().
  return audio;
}

function applyBgmMuteState(
  bgm: HTMLAudioElement | undefined,
  muted: boolean,
  bgmStarted: boolean,
): void {
  if (bgm === undefined || !bgmStarted) {
    return;
  }
  if (muted) {
    bgm.pause();
    return;
  }
  void bgm.play().catch(() => {
    // Ignore play() rejection (gesture / decode / autoplay policy).
  });
}

function createAudioRuntime(muted: boolean): AudioRuntime {
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = muted ? 0 : masterVolume;
  master.connect(context.destination);
  return { context, master, noise: createNoiseBuffer(context) };
}

function createNoiseBuffer(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.5), context.sampleRate);
  const samples = buffer.getChannelData(0);
  let seed = 0x51f15e;
  for (let index = 0; index < samples.length; index += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    samples[index] = (seed / 0xffffffff) * 2 - 1;
  }
  return buffer;
}

function scheduleTone(runtime: AudioRuntime, spec: ToneSpec): void {
  const start = runtime.context.currentTime + (spec.delay ?? 0);
  const oscillator = runtime.context.createOscillator();
  const envelope = runtime.context.createGain();
  oscillator.type = spec.wave;
  oscillator.frequency.setValueAtTime(spec.startHz, start);
  oscillator.frequency.exponentialRampToValueAtTime(spec.endHz, start + spec.duration);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(spec.gain, start + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + spec.duration);
  oscillator.connect(envelope).connect(runtime.master);
  oscillator.start(start);
  oscillator.stop(start + spec.duration + 0.02);
}

function scheduleNoise(runtime: AudioRuntime, spec: NoiseSpec): void {
  const start = runtime.context.currentTime + (spec.delay ?? 0);
  const source = runtime.context.createBufferSource();
  const filter = runtime.context.createBiquadFilter();
  const envelope = runtime.context.createGain();
  source.buffer = runtime.noise;
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(spec.cutoffHz, start);
  envelope.gain.setValueAtTime(spec.gain, start);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + spec.duration);
  source.connect(filter).connect(envelope).connect(runtime.master);
  source.start(start);
  source.stop(start + spec.duration);
}

function scheduleNotes(runtime: AudioRuntime, spec: NotesSpec): void {
  for (let index = 0; index < spec.frequencies.length; index += 1) {
    const frequency = spec.frequencies[index];
    if (frequency !== undefined) {
      scheduleTone(runtime, {
        wave: "triangle",
        startHz: frequency,
        endHz: frequency * 0.98,
        duration: spec.duration,
        gain: 0.2,
        delay: index * spec.spacing,
      });
    }
  }
}

function syncSoundButtons(buttons: NodeListOf<HTMLButtonElement>, muted: boolean): void {
  for (const button of buttons) {
    button.textContent = muted ? "SOUND MUTED" : "SOUND ON";
    button.setAttribute("aria-pressed", muted ? "true" : "false");
    button.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled sound: ${String(value)}`);
}
