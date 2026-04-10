import type { AudioPlaybackStrategy } from '../interfaces'

/**
 * Playback strategy for browser environments using the Web Audio API.
 *
 * If no sampleRate is provided in the constructor, the AudioContext is created
 * lazily on the first play() call using the browser's native rate.
 * After loading a sampler, set `player.sampleRate = sampler.sampleRate`
 * to ensure the buffer sample rate matches the source WAV file.
 */
export class WebPlayer implements AudioPlaybackStrategy {
  public volume: number = 1.0
  private _audioContext: AudioContext | undefined
  private _sampleRate: number | undefined

  constructor(sampleRate?: number) {
    this._sampleRate = sampleRate
    if (sampleRate !== undefined) {
      this._initAudioContext(sampleRate)
    }
  }

  get sampleRate(): number | undefined {
    return this._sampleRate
  }

  /**
   * Updates the sample rate. If the AudioContext already exists with a different
   * rate, it will be closed and recreated with the new rate.
   */
  set sampleRate(rate: number) {
    if (this._sampleRate === rate) return
    this._sampleRate = rate
    this._audioContext?.close()
    this._initAudioContext(rate)
  }

  private _initAudioContext(sampleRate: number): void {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) {
      throw new Error('이 브라우저는 Web Audio API를 지원하지 않습니다.')
    }
    this._audioContext = new AudioContextClass({ sampleRate })
  }

  private get audioContext(): AudioContext {
    if (!this._audioContext) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) {
        throw new Error('이 브라우저는 Web Audio API를 지원하지 않습니다.')
      }
      // sampleRate 미지정 시 브라우저 기본 rate로 생성
      this._audioContext = new AudioContextClass()
      this._sampleRate = this._audioContext.sampleRate
    }
    return this._audioContext
  }

  /**
   * Plays the provided audio buffer through the browser's AudioContext.
   * @param bufferData The audio data to play.
   */
  public async play(bufferData: Float32Array): Promise<void> {
    const ctx = this.audioContext
    const sr = this._sampleRate ?? ctx.sampleRate
    const audioBuffer = ctx.createBuffer(1, bufferData.length, sr)
    audioBuffer.copyToChannel(bufferData as any, 0)

    const sourceNode = ctx.createBufferSource()
    sourceNode.buffer = audioBuffer
    sourceNode.playbackRate.value = 1.0

    const gainNode = ctx.createGain()
    gainNode.gain.value = this.volume

    sourceNode.connect(gainNode)
    gainNode.connect(ctx.destination)

    return new Promise((resolve) => {
      sourceNode.onended = () => resolve()
      sourceNode.start(0)
    })
  }

  /**
   * Merges multiple audio buffers into one and plays the result.
   * @param buffers Array of Float32Array audio chunks.
   */
  public async drainAndPlay(buffers: Float32Array[]): Promise<void> {
    const totalLength = buffers.reduce((sum, b) => sum + b.length, 0)
    const merged = new Float32Array(totalLength)
    let offset = 0
    for (const buf of buffers) {
      merged.set(buf, offset)
      offset += buf.length
    }
    return this.play(merged)
  }
}
