import type { Sampler } from '../interfaces'

export interface SamplerOptions {
  sampleRate?: number
  maxRetries?: number
  /** Amplitude threshold below which a sample is considered silent (0.0~1.0). Default: 0.01 */
  silenceThreshold?: number
}

/**
 * Abstract base class for fetching and caching audio samples.
 */
export abstract class BaseSampler implements Sampler {
  protected static readonly globalCache: Map<string, Float32Array> = new Map()
  protected static readonly globalFailureCount: Map<string, number> = new Map()

  protected getCacheKey(phoneme: string): string {
    return phoneme
  }

  private _sampleRate: number | undefined
  public readonly maxRetries: number
  public readonly silenceThreshold: number

  get sampleRate(): number | undefined {
    return this._sampleRate
  }

  protected set sampleRate(v: number) {
    this._sampleRate = v
  }

  constructor(options: SamplerOptions) {
    this._sampleRate = options.sampleRate
    this.maxRetries = options.maxRetries ?? 3
    this.silenceThreshold = options.silenceThreshold ?? 0.01
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

  public isCached(phoneme: string): boolean {
    return BaseSampler.globalCache.has(this.getCacheKey(phoneme))
  }

  protected abstract fetchSample(phoneme: string): Promise<Float32Array | undefined>

  /**
   * Initializes the sampler (e.g. fetches and slices a sprite file).
   * Override in subclasses that require explicit initialization.
   * Default implementation is a no-op.
   */
  public async load(): Promise<void> {
    // no-op by default
  }

  public async loadSample(phoneme: string, buffer: Float32Array): Promise<void> {
    BaseSampler.globalCache.set(this.getCacheKey(phoneme), buffer)
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
