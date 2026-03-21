import { TextAnalyzer, SampleProvider, AudioEffect, SynthesisOutput } from './interfaces'

export interface AnimalVoiceConfig {
  basePitch: number
  randomness: number
  analyzer: TextAnalyzer
  sampleProvider: SampleProvider
  effect: AudioEffect
  sampleRate?: number
  spaceDelay?: number
  punctuationDelay?: number
  punctuations?: string[]
}

export class AnimaleseEngine {
  constructor(private config: AnimalVoiceConfig) { }

  public async *synthesize(text: string): AsyncGenerator<SynthesisOutput, void, unknown> {
    const tokenGroups = this.config.analyzer.analyze(text)

    for (const tokens of tokenGroups) {
      let pendingBuffer: Float32Array | null = null
      let pendingPhoneme: string = ''
      let shouldMergeNext = false

      for (const token of tokens) {
        if (!token.phoneme) continue

        const isSpace = token.phoneme === ' ' || token.phoneme === '　'
        const punctuations = this.config.punctuations || ['.', ',', '!', '?', "'", '"', '(', ')', '~', '。', '、', '！', '？']
        const isPunctuation = punctuations.includes(token.phoneme)

        if (isSpace && this.config.spaceDelay) {
          const delaySamples = Math.floor(this.config.spaceDelay * (this.config.sampleRate || 22050))
          if (delaySamples > 0) {
            yield { phoneme: ' ', pitch: 1.0, buffer: new Float32Array(delaySamples) }
          }
          continue
        }

        if (isPunctuation && this.config.punctuationDelay) {
          const delaySamples = Math.floor(this.config.punctuationDelay * (this.config.sampleRate || 22050))
          if (delaySamples > 0) {
            yield { phoneme: token.phoneme, pitch: 1.0, buffer: new Float32Array(delaySamples) }
          }
          continue
        }

        const rawBuffer = this.config.sampleProvider.getSample(token.phoneme)
        if (!rawBuffer) continue

        if (shouldMergeNext && pendingBuffer) {
          const maxLength = Math.max(pendingBuffer.length, rawBuffer.length)
          const combined = new Float32Array(maxLength)
          for (let i = 0; i < maxLength; i++) {
            const v1 = i < pendingBuffer.length ? pendingBuffer[i] : 0
            const v2 = i < rawBuffer.length ? rawBuffer[i] : 0
            const sum = v1 + v2
            combined[i] = Math.max(-1.0, Math.min(1.0, sum))
          }

          if (token.mergeWithNext) {
            pendingBuffer = combined
            pendingPhoneme = pendingPhoneme + token.phoneme
            shouldMergeNext = true
          } else {
            const pitch = this.calculateRandomizedPitch()
            const processedBuffer = this.config.effect.apply(combined, pitch)
            yield { phoneme: pendingPhoneme + token.phoneme, pitch, buffer: processedBuffer }
            pendingBuffer = null
            pendingPhoneme = ''
            shouldMergeNext = false
          }
        } else {
          if (pendingBuffer) {
            const pitch = this.calculateRandomizedPitch()
            const processedBuffer = this.config.effect.apply(pendingBuffer, pitch)
            yield { phoneme: pendingPhoneme, pitch, buffer: processedBuffer }
          }

          if (token.mergeWithNext) {
            pendingBuffer = rawBuffer
            pendingPhoneme = token.phoneme
            shouldMergeNext = true
          } else {
            const pitch = this.calculateRandomizedPitch()
            const processedBuffer = this.config.effect.apply(rawBuffer, pitch)
            yield { phoneme: token.phoneme, pitch, buffer: processedBuffer }
            pendingBuffer = null
            pendingPhoneme = ''
            shouldMergeNext = false
          }
        }
      }

      if (pendingBuffer) {
        const pitch = this.calculateRandomizedPitch()
        const processedBuffer = this.config.effect.apply(pendingBuffer, pitch)
        yield { phoneme: pendingPhoneme, pitch, buffer: processedBuffer }
      }
    }
  }

  public calculateRandomizedPitch(): number {
    return this.config.basePitch + (Math.random() - 0.5) * this.config.randomness
  }
}
