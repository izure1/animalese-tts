import { TextAnalyzer, SampleProvider, AudioEffect, SynthesisOutput } from './interfaces'
import { AudioConverter } from './core/AudioConverter'

/**
 * Configuration options for the Animalese Engine.
 */
export interface AnimalVoiceConfig {
  analyzer: TextAnalyzer
  sampleProvider: SampleProvider
  effect: AudioEffect
  sampleRate: number
  melodyRate?: number
  melodyAmplitude?: number
  spaceDelay?: number
  punctuationDelay?: number
  punctuations?: string[]
}

/**
 * The core engine that synthesizes text into animal-like speech sounds.
 */
export class AnimaleseEngine {
  constructor(private config: AnimalVoiceConfig) { }

  /**
   * Synthesizes the given text into an asynchronous stream of audio outputs.
   * @param text The input text to synthesize.
   * @param asInt16 Whether to output Int16Array instead of Float32Array.
   * @returns An async generator yielding synthesis outputs character by character.
   */
  public async *synthesize(text: string, asInt16: boolean = false): AsyncGenerator<SynthesisOutput, void, unknown> {
    const tokenGroups = this.config.analyzer.analyze(text)
    const chars = text.split('')
    let charIndex = 0

    let totalAudioSamples = 0
    let expectedAudioSamples = 0
    let lastBufferLength = 0
    let pendingUnsupportedChars = ''

    for (let i = 0; i < tokenGroups.length; i++) {
      const tokens = tokenGroups[i]
      const originalChar = chars[i] || ''
      let charYieldCount = 0

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
          totalAudioSamples = 0
          expectedAudioSamples = 0
          lastBufferLength = 0
        }

        if (isSpace && this.config.spaceDelay) {
          const delaySamples = Math.floor(this.config.spaceDelay * this.config.sampleRate)
          if (delaySamples > 0) {
            const emptyBuffer = new Float32Array(delaySamples)
            totalAudioSamples += delaySamples
            expectedAudioSamples += delaySamples

            const charToYield = (charYieldCount === 0) ? (pendingUnsupportedChars + originalChar) : ''
            pendingUnsupportedChars = ''
            charYieldCount++

            yield {
              char: charToYield,
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
            totalAudioSamples += delaySamples
            expectedAudioSamples += delaySamples

            const charToYield = (charYieldCount === 0) ? (pendingUnsupportedChars + originalChar) : ''
            pendingUnsupportedChars = ''
            charYieldCount++

            yield {
              char: charToYield,
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
          for (let j = 0; j < maxLength; j++) {
            const v1 = j < pendingBuffer.length ? pendingBuffer[j] : 0
            const v2 = j < rawBuffer.length ? rawBuffer[j] : 0
            const sum = v1 + v2
            combined[j] = Math.max(-1.0, Math.min(1.0, sum))
          }

          if (token.mergeWithNext) {
            pendingBuffer = combined
            pendingPhoneme = pendingPhoneme + token.phoneme
            shouldMergeNext = true
          } else {
            const pitch = this.calculatePitch(charIndex++)
            const processedBuffer = this.config.effect.apply(combined, pitch)

            if (lastBufferLength === 0) lastBufferLength = processedBuffer.length
            expectedAudioSamples += lastBufferLength

            const charToYield = (charYieldCount === 0) ? (pendingUnsupportedChars + originalChar) : ''
            pendingUnsupportedChars = ''
            charYieldCount++

            if (totalAudioSamples > expectedAudioSamples) {
              const emptyBuffer = new Float32Array(0)
              yield { char: charToYield, phoneme: pendingPhoneme + token.phoneme, pitch, buffer: asInt16 ? AudioConverter.float32ToInt16(emptyBuffer) : emptyBuffer }
            } else {
              lastBufferLength = processedBuffer.length
              totalAudioSamples += processedBuffer.length
              const finalBuffer = asInt16 ? AudioConverter.float32ToInt16(processedBuffer) : processedBuffer
              yield { char: charToYield, phoneme: pendingPhoneme + token.phoneme, pitch, buffer: finalBuffer }
            }

            pendingBuffer = null
            pendingPhoneme = ''
            shouldMergeNext = false
          }
        } else {
          if (pendingBuffer) {
            const pitch = this.calculatePitch(charIndex++)
            const processedBuffer = this.config.effect.apply(pendingBuffer, pitch)

            if (lastBufferLength === 0) lastBufferLength = processedBuffer.length
            expectedAudioSamples += lastBufferLength

            const charToYield = (charYieldCount === 0) ? (pendingUnsupportedChars + originalChar) : ''
            pendingUnsupportedChars = ''
            charYieldCount++

            if (totalAudioSamples > expectedAudioSamples) {
              const emptyBuffer = new Float32Array(0)
              yield { char: charToYield, phoneme: pendingPhoneme, pitch, buffer: asInt16 ? AudioConverter.float32ToInt16(emptyBuffer) : emptyBuffer }
            } else {
              lastBufferLength = processedBuffer.length
              totalAudioSamples += processedBuffer.length
              const finalBuffer = asInt16 ? AudioConverter.float32ToInt16(processedBuffer) : processedBuffer
              yield { char: charToYield, phoneme: pendingPhoneme, pitch, buffer: finalBuffer }
            }
          }

          if (token.mergeWithNext) {
            pendingBuffer = rawBuffer
            pendingPhoneme = token.phoneme
            shouldMergeNext = true
          } else {
            const pitch = this.calculatePitch(charIndex++)
            const processedBuffer = this.config.effect.apply(rawBuffer, pitch)

            if (lastBufferLength === 0) lastBufferLength = processedBuffer.length
            expectedAudioSamples += lastBufferLength

            const charToYield = (charYieldCount === 0) ? (pendingUnsupportedChars + originalChar) : ''
            pendingUnsupportedChars = ''
            charYieldCount++

            if (totalAudioSamples > expectedAudioSamples) {
              const emptyBuffer = new Float32Array(0)
              yield { char: charToYield, phoneme: token.phoneme, pitch, buffer: asInt16 ? AudioConverter.float32ToInt16(emptyBuffer) : emptyBuffer }
            } else {
              lastBufferLength = processedBuffer.length
              totalAudioSamples += processedBuffer.length
              const finalBuffer = asInt16 ? AudioConverter.float32ToInt16(processedBuffer) : processedBuffer
              yield { char: charToYield, phoneme: token.phoneme, pitch, buffer: finalBuffer }
            }
            pendingBuffer = null
            pendingPhoneme = ''
            shouldMergeNext = false
          }
        }
      }

      if (pendingBuffer) {
        const pitch = this.calculatePitch(charIndex++)
        const processedBuffer = this.config.effect.apply(pendingBuffer, pitch)

        if (lastBufferLength === 0) lastBufferLength = processedBuffer.length
        expectedAudioSamples += lastBufferLength

        const charToYield = (charYieldCount === 0) ? (pendingUnsupportedChars + originalChar) : ''
        pendingUnsupportedChars = ''
        charYieldCount++

        if (totalAudioSamples > expectedAudioSamples) {
          const emptyBuffer = new Float32Array(0)
          yield { char: charToYield, phoneme: pendingPhoneme, pitch, buffer: asInt16 ? AudioConverter.float32ToInt16(emptyBuffer) : emptyBuffer }
        } else {
          lastBufferLength = processedBuffer.length
          totalAudioSamples += processedBuffer.length
          const finalBuffer = asInt16 ? AudioConverter.float32ToInt16(processedBuffer) : processedBuffer
          yield { char: charToYield, phoneme: pendingPhoneme, pitch, buffer: finalBuffer }
        }
      }

      if (charYieldCount === 0) {
        pendingUnsupportedChars += originalChar;
      }
    }

    if (pendingUnsupportedChars !== '') {
      const emptyBuffer = new Float32Array(0)
      yield { char: pendingUnsupportedChars, phoneme: '', pitch: 1.0, buffer: asInt16 ? AudioConverter.float32ToInt16(emptyBuffer) : emptyBuffer }
    }
  }

  public calculatePitch(charIndex: number): number {
    let pitch = this.config.effect.basePitch ?? 1.0

    const amplitude = this.config.melodyAmplitude ?? 0.1
    const melodyRate = this.config.melodyRate || 0.05
    const stepDegrees = 360 * melodyRate
    const radianStep = stepDegrees * (Math.PI / 180)

    pitch += Math.sin(charIndex * radianStep) * amplitude

    return pitch + (Math.random() - 0.5) * (this.config.effect.randomness ?? 0.0)
  }
}
