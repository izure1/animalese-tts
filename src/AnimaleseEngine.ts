import { TextAnalyzer, SampleProvider, AudioEffect, SynthesisOutput } from './interfaces'

export interface AnimalVoiceConfig {
  basePitch: number
  randomness: number
  analyzer: TextAnalyzer
  sampleProvider: SampleProvider
  effect: AudioEffect
}

export class AnimaleseEngine {
  constructor(private config: AnimalVoiceConfig) { }

  public async *synthesize(text: string): AsyncGenerator<SynthesisOutput, void, unknown> {
    const tokens = this.config.analyzer.analyze(text)

    let pendingBuffer: Float32Array | null = null
    let pendingPhoneme: string = ''
    let shouldMergeNext = false

    for (const token of tokens) {
      if (!token.phoneme) continue

      const rawBuffer = this.config.sampleProvider.getSample(token.phoneme)
      if (!rawBuffer) continue

      const pitch = this.calculateRandomizedPitch()
      const processedBuffer = this.config.effect.apply(rawBuffer, pitch)

      if (shouldMergeNext && pendingBuffer) {
        const maxLength = Math.max(pendingBuffer.length, processedBuffer.length)
        const combined = new Float32Array(maxLength)
        for (let i = 0; i < maxLength; i++) {
          const v1 = i < pendingBuffer.length ? pendingBuffer[i] : 0
          const v2 = i < processedBuffer.length ? processedBuffer[i] : 0
          const sum = v1 + v2
          combined[i] = Math.max(-1.0, Math.min(1.0, sum))
        }

        if (token.mergeWithNext) {
          pendingBuffer = combined
          pendingPhoneme = pendingPhoneme + token.phoneme
          shouldMergeNext = true
        } else {
          yield { phoneme: pendingPhoneme + token.phoneme, pitch, buffer: combined }
          pendingBuffer = null
          pendingPhoneme = ''
          shouldMergeNext = false
        }
      } else {
        if (pendingBuffer) {
          yield { phoneme: pendingPhoneme, pitch, buffer: pendingBuffer }
        }

        if (token.mergeWithNext) {
          pendingBuffer = processedBuffer
          pendingPhoneme = token.phoneme
          shouldMergeNext = true
        } else {
          yield { phoneme: token.phoneme, pitch, buffer: processedBuffer }
          pendingBuffer = null
          pendingPhoneme = ''
          shouldMergeNext = false
        }
      }
    }

    if (pendingBuffer) {
      yield { phoneme: pendingPhoneme, pitch: this.calculateRandomizedPitch(), buffer: pendingBuffer }
    }
  }

  public calculateRandomizedPitch(): number {
    return this.config.basePitch + (Math.random() - 0.5) * this.config.randomness
  }
}
