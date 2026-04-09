import { BaseSampler, SpriteMap } from './BaseSampler'

export type { SpriteMap }


/**
 * Sample provider that loads a single WAV sprite file over HTTP/HTTPS
 * and slices it into individual phoneme buffers.
 *
 * Supports two initialization modes:
 *
 * Mode 1 — Explicit SpriteMap:
 *   new WebSampler(audioSrc, { 'a': { startMs: 0, durationMs: 150 }, ... })
 *
 * Mode 2 — Auto-detect from labels (splits on silence):
 *   new WebSampler(audioSrc, ['a', 'b', 'c', ...])
 */
export class WebSampler extends BaseSampler {
  private readonly audioSrc: string

  constructor(
    audioSrc: string,
    sprites: SpriteMap | string[],
    options: {
      maxRetries?: number
      silenceThreshold?: number
      minSilenceDurationMs?: number
    } = {}
  ) {
    super(sprites, options)
    this.audioSrc = audioSrc
  }

  protected getCacheKey(phoneme: string): string {
    return `${this.audioSrc}_${phoneme}`
  }

  protected async fetchBuffer(): Promise<ArrayBuffer> {
    const response = await fetch(this.audioSrc)
    if (!response.ok) {
      throw new Error(`[WebSampler] 파일 로드 실패: ${response.status} ${response.statusText} (${this.audioSrc})`)
    }
    return response.arrayBuffer()
  }
}
