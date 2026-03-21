import type { Sampler } from '../interfaces'

export interface SamplerOptions {
  sampleRate: number;
  maxRetries?: number;
}

/**
 * Abstract base class for fetching and caching audio samples.
 */
export abstract class BaseSampler implements Sampler {
  protected readonly cache: Map<string, Float32Array> = new Map()
  protected readonly failureCount: Map<string, number> = new Map()

  public readonly sampleRate: number;
  public readonly maxRetries: number;

  constructor(options: SamplerOptions) {
    this.sampleRate = options.sampleRate;
    this.maxRetries = options.maxRetries ?? 3;
  }

  public async getSample(phoneme: string): Promise<Float32Array | undefined> {
    if (this.cache.has(phoneme)) {
      return this.cache.get(phoneme)
    }

    const fails = this.failureCount.get(phoneme) || 0
    if (fails >= this.maxRetries) {
      return undefined
    }

    try {
      const sample = await this.fetchSample(phoneme)
      if (sample) {
        this.cache.set(phoneme, sample)
        return sample
      } else {
        this.failureCount.set(phoneme, fails + 1)
        return undefined
      }
    } catch (e) {
      this.failureCount.set(phoneme, fails + 1)
      throw e
    }
  }

  protected abstract fetchSample(phoneme: string): Promise<Float32Array | undefined>

  public async loadSample(phoneme: string, buffer: Float32Array, sampleRate: number): Promise<void> {
    if (sampleRate !== this.sampleRate) {
      throw new Error(`[BaseSampler] 샘플레이트 불일치: 기대값 ${this.sampleRate}, 실제값 ${sampleRate}`)
    }
    this.cache.set(phoneme, buffer)
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
}
