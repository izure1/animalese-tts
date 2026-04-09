import { BaseSampler, SpriteMap } from './BaseSampler'

/**
 * Sample provider that manages an audio sprite buffer entirely in memory.
 * Accepts a pre-loaded ArrayBuffer or Uint8Array containing WAV data.
 */
export class MemorySampler extends BaseSampler {
  private readonly bufferSource: ArrayBuffer | Uint8Array

  constructor(
    buffer: ArrayBuffer | Uint8Array,
    sprites: SpriteMap | string[] = [],
    options: {
      maxRetries?: number
      silenceThreshold?: number
      minSilenceDurationMs?: number
    } = {}
  ) {
    super(sprites, options)
    this.bufferSource = buffer
  }

  protected getCacheKey(phoneme: string): string {
    return `memory_${phoneme}`
  }

  protected async fetchBuffer(): Promise<ArrayBuffer | Uint8Array> {
    return this.bufferSource
  }
}
