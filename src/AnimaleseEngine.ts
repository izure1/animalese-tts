import { TextAnalyzer, SampleProvider, AudioEffect, SynthesisOutput } from './interfaces'
import { AudioConverter } from './core/AudioConverter'

export interface AnimalVoiceConfig {
  basePitch: number
  randomness: number
  analyzer: TextAnalyzer
  sampleProvider: SampleProvider
  effect: AudioEffect
  sampleRate: number
  spaceDelay?: number
  punctuationDelay?: number
  punctuations?: string[]
}

export class AnimaleseEngine {
  constructor(private config: AnimalVoiceConfig) { }

  public async *synthesize(text: string, asInt16: boolean = false): AsyncGenerator<SynthesisOutput, void, unknown> {
    const tokenGroups = this.config.analyzer.analyze(text)
    let charIndex = 0

    for (const tokens of tokenGroups) {
      let pendingBuffer: Float32Array | null = null
      let pendingPhoneme: string = ''
      let shouldMergeNext = false

      for (const token of tokens) {
        if (!token.phoneme) continue

        const isSpace = token.phoneme === ' ' || token.phoneme === '　'
        const punctuations = this.config.punctuations || ['.', ',', '!', '?', "'", '"', '(', ')', '~', '。', '、', '！', '？']
        const isPunctuation = punctuations.includes(token.phoneme)

        if (isPunctuation) {
          charIndex = 0
        }

        if (isSpace && this.config.spaceDelay) {
          const delaySamples = Math.floor(this.config.spaceDelay * this.config.sampleRate)
          if (delaySamples > 0) {
            const emptyBuffer = new Float32Array(delaySamples)
            yield {
              phoneme: ' ',
              pitch: 1.0,
              buffer: asInt16 ? AudioConverter.float32ToInt16(emptyBuffer) : emptyBuffer
            }
          }
          continue
        }

        if (isPunctuation && this.config.punctuationDelay) {
          const delaySamples = Math.floor(this.config.punctuationDelay * this.config.sampleRate)
          if (delaySamples > 0) {
            const emptyBuffer = new Float32Array(delaySamples)
            yield {
              phoneme: token.phoneme,
              pitch: 1.0,
              buffer: asInt16 ? AudioConverter.float32ToInt16(emptyBuffer) : emptyBuffer
            }
          }
          continue
        }

        const rawBuffer = await this.config.sampleProvider.getSample(token.phoneme)
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
            const pitch = this.calculatePitch(charIndex++)
            const processedBuffer = this.config.effect.apply(combined, pitch)
            const finalBuffer = asInt16 ? AudioConverter.float32ToInt16(processedBuffer) : processedBuffer
            yield { phoneme: pendingPhoneme + token.phoneme, pitch, buffer: finalBuffer }
            pendingBuffer = null
            pendingPhoneme = ''
            shouldMergeNext = false
          }
        } else {
          if (pendingBuffer) {
            const pitch = this.calculatePitch(charIndex++)
            const processedBuffer = this.config.effect.apply(pendingBuffer, pitch)
            const finalBuffer = asInt16 ? AudioConverter.float32ToInt16(processedBuffer) : processedBuffer
            yield { phoneme: pendingPhoneme, pitch, buffer: finalBuffer }
          }

          if (token.mergeWithNext) {
            pendingBuffer = rawBuffer
            pendingPhoneme = token.phoneme
            shouldMergeNext = true
          } else {
            const pitch = this.calculatePitch(charIndex++)
            const processedBuffer = this.config.effect.apply(rawBuffer, pitch)
            const finalBuffer = asInt16 ? AudioConverter.float32ToInt16(processedBuffer) : processedBuffer
            yield { phoneme: token.phoneme, pitch, buffer: finalBuffer }
            pendingBuffer = null
            pendingPhoneme = ''
            shouldMergeNext = false
          }
        }
      }

      if (pendingBuffer) {
        const pitch = this.calculatePitch(charIndex++)
        const processedBuffer = this.config.effect.apply(pendingBuffer, pitch)
        const finalBuffer = asInt16 ? AudioConverter.float32ToInt16(processedBuffer) : processedBuffer
        yield { phoneme: pendingPhoneme, pitch, buffer: finalBuffer }
      }
    }
  }

  public calculatePitch(charIndex: number): number {
    let pitch = this.config.basePitch

    const amplitude = 0.1 // 기본 진폭
    const stepDegrees = 15 // 기본값: 글자당 30도 회전
    const radianStep = stepDegrees * (Math.PI / 180)

    pitch += Math.sin(charIndex * radianStep) * amplitude

    console.log(charIndex, pitch)

    return pitch + (Math.random() - 0.5) * this.config.randomness
  }
}
