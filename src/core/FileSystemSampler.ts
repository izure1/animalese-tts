import * as fs from 'node:fs/promises'
import { constants } from 'node:fs'
import * as path from 'node:path'
import { WavDecoder } from './WavDecoder'
import { BaseSampler, SamplerOptions } from './BaseSampler'
import type { SpriteMap } from './WebSampler'

export interface FileSystemSamplerOptions extends SamplerOptions {
  audioFilePath: string
  sprites: SpriteMap | string[]
  /** Minimum duration of silence to split sprites in auto-detect mode. Default: 20ms */
  minSilenceDurationMs?: number
}

/**
 * Sample provider that fetches audio files from the local file system.
 */
export class FileSystemSampler extends BaseSampler {
  private readonly decoder: WavDecoder = new WavDecoder()
  private readonly audioFilePath: string
  private readonly spriteDefinition: SpriteMap | string[]
  private readonly minSilenceDurationMs: number
  private initPromise: Promise<void> | undefined

  constructor(options: FileSystemSamplerOptions) {
    super({
      maxRetries: options.maxRetries,
      silenceThreshold: options.silenceThreshold
    })
    this.audioFilePath = options.audioFilePath
    this.spriteDefinition = options.sprites
    this.minSilenceDurationMs = options.minSilenceDurationMs ?? 20
  }

  protected getCacheKey(phoneme: string): string {
    return `${this.audioFilePath}_${phoneme}`
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
    // 1. Read file + WAV decode
    try {
      await fs.access(this.audioFilePath, constants.R_OK)
    } catch (e: any) {
      throw new Error(`[FileSystemSampler] 파일을 찾을 수 없거나 접근 불가능합니다: ${this.audioFilePath}`)
    }

    const fileBuffer = await fs.readFile(this.audioFilePath)
    const { buffer: fullBuffer, sampleRate } = this.decoder.decode(fileBuffer, false)

    // 2. Set sampleRate 
    this.sampleRate = sampleRate

    // 3. Resolve SpriteMap
    const spriteMap: SpriteMap = Array.isArray(this.spriteDefinition)
      ? this.detectSprites(fullBuffer, sampleRate, this.spriteDefinition)
      : this.spriteDefinition

    // 4. Slice each phoneme -> trim -> cache
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
        `[FileSystemSampler] 감지된 세그먼트 수(${segments.length})와 라벨 수(${labels.length})가 다릅니다.`
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
