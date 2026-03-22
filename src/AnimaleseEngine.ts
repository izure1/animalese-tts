import { TextAnalyzer, Sampler, AudioEffect, SynthesisOutput } from './interfaces'
import { AudioConverter } from './core/AudioConverter'

/**
 * Configuration options for the Animalese Engine.
 */
export interface AnimalVoiceConfig {
  /** Text analyzer used to split and identify phonemes. */
  analyzer: TextAnalyzer;
  /** Provider that supplies the raw audio samples for each phoneme. */
  sampler: Sampler;
  /** Audio effect to apply, typically handles pitch and speed adjustments. */
  effect: AudioEffect;
  /** Time in seconds to delay or pause when encountering a space character. */
  spaceDelay?: number;
  /** Time in seconds to delay or pause when encountering a punctuation character. */
  punctuationDelay?: number;
  /** Array of characters considered as punctuations. */
  punctuations?: string[];
}

/**
 * The core engine that synthesizes text into animal-like speech sounds.
 */
export class AnimaleseEngine {
  constructor(private readonly config: AnimalVoiceConfig) { }

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
      if (tokens.length === 0) continue

      // 현재 그룹에 병합된 후속 빈 그룹의 문자를 모아서 originalChar에 포함
      let originalChar = chars[i] || ''
      let j = i + 1
      while (j < tokenGroups.length && tokenGroups[j].length === 0) {
        originalChar += chars[j] || ''
        j++
      }
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
          const delaySamples = Math.floor(this.config.spaceDelay * this.config.sampler.sampleRate)
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
          const delaySamples = Math.floor(this.config.punctuationDelay * this.config.sampler.sampleRate)
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

        const rawBuffer = await this.config.sampler.getSample(token.phoneme)
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
            const pitch = this.config.effect.calculatePitch(charIndex++)
            const processedBuffer = this.config.effect.apply(combined, pitch)

            if (lastBufferLength === 0) lastBufferLength = processedBuffer.length
            expectedAudioSamples += lastBufferLength

            const charToYield = (charYieldCount === 0) ? (pendingUnsupportedChars + originalChar) : ''
            pendingUnsupportedChars = ''
            charYieldCount++

            if (totalAudioSamples > expectedAudioSamples) {
              const emptyBuffer = new Float32Array(0)
              yield {
                char: charToYield,
                phoneme: pendingPhoneme + token.phoneme,
                pitch,
                buffer: asInt16 ? AudioConverter.float32ToInt16(emptyBuffer) : emptyBuffer
              }
            } else {
              lastBufferLength = processedBuffer.length
              totalAudioSamples += processedBuffer.length
              const finalBuffer = asInt16 ? AudioConverter.float32ToInt16(processedBuffer) : processedBuffer
              yield {
                char: charToYield,
                phoneme: pendingPhoneme + token.phoneme,
                pitch,
                buffer: finalBuffer
              }
            }

            pendingBuffer = null
            pendingPhoneme = ''
            shouldMergeNext = false
          }
        } else {
          if (pendingBuffer) {
            const pitch = this.config.effect.calculatePitch(charIndex++)
            const processedBuffer = this.config.effect.apply(pendingBuffer, pitch)

            if (lastBufferLength === 0) lastBufferLength = processedBuffer.length
            expectedAudioSamples += lastBufferLength

            const charToYield = (charYieldCount === 0) ? (pendingUnsupportedChars + originalChar) : ''
            pendingUnsupportedChars = ''
            charYieldCount++

            if (totalAudioSamples > expectedAudioSamples) {
              const emptyBuffer = new Float32Array(0)
              yield {
                char: charToYield,
                phoneme: pendingPhoneme,
                pitch,
                buffer: asInt16 ? AudioConverter.float32ToInt16(emptyBuffer) : emptyBuffer
              }
            } else {
              lastBufferLength = processedBuffer.length
              totalAudioSamples += processedBuffer.length
              const finalBuffer = asInt16 ? AudioConverter.float32ToInt16(processedBuffer) : processedBuffer
              yield {
                char: charToYield,
                phoneme: pendingPhoneme,
                pitch,
                buffer: finalBuffer
              }
            }
          }

          if (token.mergeWithNext) {
            pendingBuffer = rawBuffer
            pendingPhoneme = token.phoneme
            shouldMergeNext = true
          } else {
            const pitch = this.config.effect.calculatePitch(charIndex++)
            const processedBuffer = this.config.effect.apply(rawBuffer, pitch)

            if (lastBufferLength === 0) lastBufferLength = processedBuffer.length
            expectedAudioSamples += lastBufferLength

            const charToYield = (charYieldCount === 0) ? (pendingUnsupportedChars + originalChar) : ''
            pendingUnsupportedChars = ''
            charYieldCount++

            if (totalAudioSamples > expectedAudioSamples) {
              const emptyBuffer = new Float32Array(0)
              yield {
                char: charToYield,
                phoneme: token.phoneme,
                pitch,
                buffer: asInt16 ? AudioConverter.float32ToInt16(emptyBuffer) : emptyBuffer
              }
            } else {
              lastBufferLength = processedBuffer.length
              totalAudioSamples += processedBuffer.length
              const finalBuffer = asInt16 ? AudioConverter.float32ToInt16(processedBuffer) : processedBuffer
              yield {
                char: charToYield,
                phoneme: token.phoneme,
                pitch,
                buffer: finalBuffer
              }
            }
            pendingBuffer = null
            pendingPhoneme = ''
            shouldMergeNext = false
          }
        }
      }

      if (pendingBuffer) {
        const pitch = this.config.effect.calculatePitch(charIndex++)
        const processedBuffer = this.config.effect.apply(pendingBuffer, pitch)

        if (lastBufferLength === 0) lastBufferLength = processedBuffer.length
        expectedAudioSamples += lastBufferLength

        const charToYield = (charYieldCount === 0) ? (pendingUnsupportedChars + originalChar) : ''
        pendingUnsupportedChars = ''
        charYieldCount++

        if (totalAudioSamples > expectedAudioSamples) {
          const emptyBuffer = new Float32Array(0)
          yield {
            char: charToYield,
            phoneme: pendingPhoneme,
            pitch,
            buffer: asInt16 ? AudioConverter.float32ToInt16(emptyBuffer) : emptyBuffer
          }
        } else {
          lastBufferLength = processedBuffer.length
          totalAudioSamples += processedBuffer.length
          const finalBuffer = asInt16 ? AudioConverter.float32ToInt16(processedBuffer) : processedBuffer
          yield {
            char: charToYield,
            phoneme: pendingPhoneme,
            pitch,
            buffer: finalBuffer
          }
        }
      }

      if (charYieldCount === 0) {
        pendingUnsupportedChars += originalChar;
      }
    }

    if (pendingUnsupportedChars !== '') {
      const emptyBuffer = new Float32Array(0)
      yield {
        char: pendingUnsupportedChars,
        phoneme: '',
        pitch: 1.0,
        buffer: asInt16 ? AudioConverter.float32ToInt16(emptyBuffer) : emptyBuffer
      }
    }
  }
}
