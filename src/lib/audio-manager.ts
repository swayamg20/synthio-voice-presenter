type BrowserAudioContext = typeof AudioContext;

declare global {
  interface Window {
    webkitAudioContext?: BrowserAudioContext;
  }
}

export class AudioPlaybackManager {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  private audioQueue: AudioBuffer[] = [];
  private currentSource: AudioBufferSourceNode | null = null;
  private playbackGeneration = 0;
  private playing = false;

  onPlaybackComplete?: () => void;
  onBufferStart?: () => void;

  constructor() {
    if (typeof window === "undefined") {
      throw new Error("AudioPlaybackManager can only be created in a browser.");
    }

    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;

    if (!AudioContextCtor) {
      throw new Error("This browser does not support the Web Audio API.");
    }

    this.audioContext = new AudioContextCtor();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.82;
    this.analyser.connect(this.audioContext.destination);
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  async enqueue(chunk: ArrayBuffer): Promise<void> {
    const generationAtStart = this.playbackGeneration;

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    const buffer = await this.audioContext.decodeAudioData(chunk.slice(0));

    if (generationAtStart !== this.playbackGeneration) {
      return;
    }

    this.audioQueue.push(buffer);

    if (!this.playing) {
      this.playNext(generationAtStart);
    }
  }

  stop(): void {
    this.playbackGeneration += 1;
    this.audioQueue = [];
    this.playing = false;

    const source = this.currentSource;
    this.currentSource = null;

    if (!source) {
      return;
    }

    source.onended = null;

    try {
      source.stop();
    } catch {
      // The source may already have ended between the interrupt and stop call.
    }
  }

  getWaveformData(): Uint8Array {
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    return data;
  }

  private playNext(generation: number): void {
    if (generation !== this.playbackGeneration) {
      return;
    }

    const buffer = this.audioQueue.shift();

    if (!buffer) {
      this.playing = false;
      this.currentSource = null;
      this.onPlaybackComplete?.();
      return;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.analyser);
    source.onended = () => {
      if (this.currentSource === source) {
        this.currentSource = null;
      }

      this.playNext(generation);
    };

    this.currentSource = source;
    this.playing = true;
    this.onBufferStart?.();
    source.start();
  }
}
