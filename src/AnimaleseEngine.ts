import { TextAnalyzer, SampleProvider, AudioEffect, PlaybackStrategy } from './interfaces'

export interface AnimalVoiceConfig {
  basePitch: number
  randomness: number
  analyzer: TextAnalyzer
  sampleProvider: SampleProvider
  effect: AudioEffect
}

export class AnimaleseEngine {
  constructor(private config: AnimalVoiceConfig) { }

  public async *synthesize(text: string): AsyncGenerator<{ phoneme: string; pitch: number; buffer: Float32Array }, void, unknown> {
    const phonemes = this.config.analyzer.analyze(text)

    let pendingBuffer: Float32Array | null = null
    let pendingPhoneme: string = ''

    for (const phoneme of phonemes) {
      if (!phoneme) continue

      const rawBuffer = this.config.sampleProvider.getSample(phoneme)
      if (!rawBuffer) continue

      const pitch = this.calculateRandomizedPitch()
      const processedBuffer = this.config.effect.apply(rawBuffer, pitch)

      const isKoreanConsonant = /[ㄱ-ㅎ]/.test(phoneme)
      const isKoreanVowel = /[ㅏ-ㅣ]/.test(phoneme)

      if (isKoreanConsonant) {
        if (pendingBuffer) {
          yield { phoneme: pendingPhoneme, pitch, buffer: pendingBuffer }
        }
        pendingBuffer = processedBuffer
        pendingPhoneme = phoneme
      } else if (isKoreanVowel && pendingBuffer) {
        const maxLength = Math.max(pendingBuffer.length, processedBuffer.length)
        const combined = new Float32Array(maxLength)

        for (let i = 0; i < pendingBuffer.length; i++) combined[i] += pendingBuffer[i]
        for (let i = 0; i < processedBuffer.length; i++) combined[i] += processedBuffer[i]

        for (let i = 0; i < maxLength; i++) {
          if (combined[i] > 1.0) combined[i] = 1.0
          else if (combined[i] < -1.0) combined[i] = -1.0
        }

        yield { phoneme: pendingPhoneme + phoneme, pitch, buffer: combined }
        pendingBuffer = null
        pendingPhoneme = ''
      } else {
        if (pendingBuffer) {
          yield { phoneme: pendingPhoneme, pitch, buffer: pendingBuffer }
          pendingBuffer = null
          pendingPhoneme = ''
        }
        yield { phoneme, pitch, buffer: processedBuffer }
      }
    }

    if (pendingBuffer) {
      yield { phoneme: pendingPhoneme, pitch: 1.0, buffer: pendingBuffer }
    }
  }

  public calculateRandomizedPitch(): number {
    return this.config.basePitch + (Math.random() - 0.5) * this.config.randomness
  }
}
