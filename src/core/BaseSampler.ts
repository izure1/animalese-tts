import type { Sampler } from '../interfaces'
import { WavDecoder } from './WavDecoder'

export interface SamplerOptions {
  sampleRate?: number
  maxRetries?: number
  /** Amplitude threshold below which a sample is considered silent (0.0~1.0). Default: 0.01 */
  silenceThreshold?: number
}

/**
 * Explicit timing map for each phoneme in the sprite file.
 */
export type SpriteMap = Record<string, { startMs: number; durationMs: number }>

/**
 * Abstract base class for fetching and caching audio samples.
 *
 * Subclasses must implement:
 *   - fetchBuffer(): how to obtain the raw WAV data (HTTP, filesystem, memory, etc.)
 *   - getCacheKey(): a unique cache key per phoneme for this sampler instance
 */
export abstract class BaseSampler implements Sampler {
  protected static readonly globalCache: Map<string, Float32Array> = new Map()
  protected static readonly globalFailureCount: Map<string, number> = new Map()

  private readonly decoder: WavDecoder = new WavDecoder()
  private readonly spriteDefinition: SpriteMap | string[]
  private readonly minSilenceDurationMs: number
  private initPromise: Promise<void> | undefined

  private _sampleRate: number | undefined
  public readonly maxRetries: number
  public readonly silenceThreshold: number

  get sampleRate(): number | undefined {
    return this._sampleRate
  }

  protected set sampleRate(v: number) {
    this._sampleRate = v
  }

  constructor(
    sprites: SpriteMap | string[],
    options: {
      maxRetries?: number
      silenceThreshold?: number
      minSilenceDurationMs?: number
      sampleRate?: number
    } = {}
  ) {
    this._sampleRate = options.sampleRate
    this.maxRetries = options.maxRetries ?? 3
    this.silenceThreshold = options.silenceThreshold ?? 0.01
    this.spriteDefinition = sprites
    this.minSilenceDurationMs = options.minSilenceDurationMs ?? 20
  }

  /**
   * Returns the raw WAV data for this sampler instance.
   * Implement in subclasses to fetch from HTTP, filesystem, memory, etc.
   */
  protected abstract fetchBuffer(): Promise<ArrayBuffer | Uint8Array>

  protected getCacheKey(phoneme: string): string {
    return phoneme
  }

  public async load(): Promise<void> {
    await this.ensureInitialized()
  }

  public async getSample(phoneme: string): Promise<Float32Array | undefined> {
    const key = this.getCacheKey(phoneme)

    if (BaseSampler.globalCache.has(key)) {
      return BaseSampler.globalCache.get(key)
    }

    const fails = BaseSampler.globalFailureCount.get(key) || 0
    if (fails >= this.maxRetries) {
      return undefined
    }

    try {
      const sample = await this.fetchSample(phoneme)
      if (sample) {
        BaseSampler.globalCache.set(key, sample)
        return sample
      } else {
        BaseSampler.globalFailureCount.set(key, fails + 1)
        return undefined
      }
    } catch (e) {
      BaseSampler.globalFailureCount.set(key, fails + 1)
      throw e
    }
  }

  protected async fetchSample(phoneme: string): Promise<Float32Array | undefined> {
    await this.ensureInitialized()
    return BaseSampler.globalCache.get(this.getCacheKey(phoneme))
  }

  public isCached(phoneme: string): boolean {
    return BaseSampler.globalCache.has(this.getCacheKey(phoneme))
  }

  public async loadSample(phoneme: string, buffer: Float32Array): Promise<void> {
    BaseSampler.globalCache.set(this.getCacheKey(phoneme), buffer)
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this._initialize()
    }
    return this.initPromise
  }

  private async _initialize(): Promise<void> {
    const rawBuffer = await this.fetchBuffer()
    const { buffer: fullBuffer, sampleRate } = this.decoder.decode(rawBuffer, false)

    this.sampleRate = sampleRate

    const spriteMap: SpriteMap = Array.isArray(this.spriteDefinition)
      ? this.detectSprites(fullBuffer, sampleRate, this.spriteDefinition)
      : this.spriteDefinition

    for (const [phoneme, { startMs, durationMs }] of Object.entries(spriteMap)) {
      const startSample = Math.floor(startMs / 1000 * sampleRate)
      const durationSamples = Math.floor(durationMs / 1000 * sampleRate)
      const endSample = Math.min(startSample + durationSamples, fullBuffer.length)
      const slice = fullBuffer.slice(startSample, endSample)
      const trimmed = this.trimSilence(slice)
      BaseSampler.globalCache.set(this.getCacheKey(phoneme), trimmed)
    }
  }

  /**
   * Auto-detects phoneme segments by splitting on silent regions.
   * Maps each detected segment to the corresponding label in order.
   */
  private detectSprites(
    buffer: Float32Array,
    sampleRate: number,
    labels: string[]
  ): SpriteMap {
    const minSilenceSamples = Math.floor(this.minSilenceDurationMs / 1000 * sampleRate)
    const spriteMap: SpriteMap = {}

    // 묵음/비묵음 구간 경계 탐지
    const segments: { start: number; end: number }[] = []
    let inSound = false
    let segmentStart = 0
    let silenceCount = 0

    for (let i = 0; i < buffer.length; i++) {
      const isSilent = Math.abs(buffer[i]) <= this.silenceThreshold

      if (!inSound && !isSilent) {
        // 소리 구간 시작
        inSound = true
        segmentStart = i
        silenceCount = 0
      } else if (inSound && isSilent) {
        silenceCount++
        // 무음이 충분히 길면 구간 종료
        if (silenceCount >= minSilenceSamples) {
          segments.push({ start: segmentStart, end: i - silenceCount })
          inSound = false
          silenceCount = 0
        }
      } else if (inSound && !isSilent) {
        silenceCount = 0
      }
    }

    // 마지막 소리 구간 처리
    if (inSound) {
      segments.push({ start: segmentStart, end: buffer.length - 1 })
    }

    if (segments.length !== labels.length) {
      console.warn(
        `[${this.constructor.name}] 감지된 세그먼트 수(${segments.length})와 라벨 수(${labels.length})가 다릅니다.`
      )
    }

    const count = Math.min(segments.length, labels.length)
    for (let i = 0; i < count; i++) {
      const { start, end } = segments[i]
      spriteMap[labels[i]] = {
        startMs: (start / sampleRate) * 1000,
        durationMs: ((end - start) / sampleRate) * 1000,
      }
    }

    return spriteMap
  }

  protected resample(buffer: Float32Array, sourceRate: number, targetRate: number): Float32Array {
    if (sourceRate === targetRate) return buffer

    const targetLength = Math.floor(buffer.length * targetRate / sourceRate)
    const resampled = new Float32Array(targetLength)
    const ratio = sourceRate / targetRate

    for (let i = 0; i < targetLength; i++) {
      const srcIndex = i * ratio
      const leftIndex = Math.floor(srcIndex)
      const rightIndex = Math.min(leftIndex + 1, buffer.length - 1)
      const fraction = srcIndex - leftIndex

      resampled[i] = buffer[leftIndex] * (1 - fraction) + buffer[rightIndex] * fraction
    }

    return resampled
  }

  /**
   * Trims leading and trailing silence from an audio buffer.
   * Preserves a small fade margin (64 samples) to avoid clicks.
   */
  protected trimSilence(buffer: Float32Array): Float32Array {
    if (buffer.length === 0) return buffer

    const threshold = this.silenceThreshold
    const fadeMargin = 64

    let start = 0
    for (let i = 0; i < buffer.length; i++) {
      if (Math.abs(buffer[i]) > threshold) {
        start = i
        break
      }
    }

    let end = buffer.length - 1
    for (let i = buffer.length - 1; i >= start; i--) {
      if (Math.abs(buffer[i]) > threshold) {
        end = i
        break
      }
    }

    const trimStart = Math.max(0, start - fadeMargin)
    const trimEnd = Math.min(buffer.length, end + fadeMargin + 1)

    return buffer.slice(trimStart, trimEnd)
  }
}
