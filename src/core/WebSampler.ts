import { BaseSampler } from './BaseSampler'
import { WavDecoder } from './WavDecoder'

/**
 * Explicit timing map for each phoneme in the sprite file.
 */
export type SpriteMap = Record<string, { startMs: number; durationMs: number }>

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
  private readonly decoder: WavDecoder = new WavDecoder()
  private readonly audioSrc: string
  private readonly spriteDefinition: SpriteMap | string[]
  private readonly minSilenceDurationMs: number
  private initPromise: Promise<void> | undefined

  constructor(
    audioSrc: string,
    sprites: SpriteMap | string[],
    options: {
      maxRetries?: number
      silenceThreshold?: number
      minSilenceDurationMs?: number
    } = {}
  ) {
    super({ maxRetries: options.maxRetries, silenceThreshold: options.silenceThreshold })
    this.audioSrc = audioSrc
    this.spriteDefinition = sprites
    this.minSilenceDurationMs = options.minSilenceDurationMs ?? 20
  }

  protected getCacheKey(phoneme: string): string {
    return `${this.audioSrc}_${phoneme}`
  }

  protected async fetchSample(phoneme: string): Promise<Float32Array | undefined> {
    await this.ensureInitialized()
    return BaseSampler.globalCache.get(this.getCacheKey(phoneme))
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this._initialize()
    }
    return this.initPromise
  }

  private async _initialize(): Promise<void> {
    // 1. Fetch + WAV decode
    const response = await fetch(this.audioSrc)
    if (!response.ok) {
      throw new Error(`[WebSampler] 파일 로드 실패: ${response.status} ${response.statusText} (${this.audioSrc})`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const { buffer: fullBuffer, sampleRate } = this.decoder.decode(arrayBuffer, false)

    // 2. sampleRate 자동 설정
    this.sampleRate = sampleRate

    // 3. SpriteMap 확정
    const spriteMap: SpriteMap = Array.isArray(this.spriteDefinition)
      ? this.detectSprites(fullBuffer, sampleRate, this.spriteDefinition)
      : this.spriteDefinition

    // 4. 각 음소 슬라이싱 → trim → globalCache 저장
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
        `[WebSampler] 감지된 세그먼트 수(${segments.length})와 라벨 수(${labels.length})가 다릅니다.`
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
}
