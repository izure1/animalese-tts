import { AnimalVoiceConfig } from '../AnimaleseEngine'
import { SynthesisOutput } from '../interfaces'
import { AudioConverter } from './AudioConverter'


export class TTSSpeaker {
  private readonly punctuations: string[]

  constructor(
    private readonly text: string,
    private readonly asInt16: boolean,
    private config: AnimalVoiceConfig
  ) {
    this.punctuations = this.config.punctuations || ['.', ',', '!', '?', "'", '"', '(', ')', '~', '。', '、', '！', '？', 'っ', 'ッ', 'ー']
    this.config = {
      ...this.config,
      spaceDelay: this.config.spaceDelay ?? 0.03,
      punctuationDelay: this.config.punctuationDelay ?? 0.3,
    }
  }

  // ── load() was removed. Use engine.load(speaker) before calling speak().

  public async *speak(): AsyncGenerator<SynthesisOutput, void, unknown> {
    const tokenGroups = this.config.analyzer.analyze(this.text)
    const chars = this.text.split('')
    let charIndex = 0

    let totalAudioSamples = 0
    let expectedAudioSamples = 0
    let lastBufferLength = 0
    let pendingUnsupportedChars = ''

    for (let i = 0; i < tokenGroups.length; i++) {
      const tokens = tokenGroups[i]
      if (tokens.length === 0) continue

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
        const isPunctuation = this.punctuations.includes(token.phoneme)

        if (isPunctuation) {
          charIndex = 0
          totalAudioSamples = 0
          expectedAudioSamples = 0
          lastBufferLength = 0
        }

        if (isSpace && this.config.spaceDelay) {
          const sr = this.config.sampler.sampleRate ?? 44100
          const delaySamples = Math.floor(this.config.spaceDelay * sr)
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
              buffer: this.asInt16 ? AudioConverter.float32ToInt16(emptyBuffer) : emptyBuffer
            }
          }
          continue
        } else if (isSpace) {
          continue
        }

        if (isPunctuation && this.config.punctuationDelay) {
          const sr = this.config.sampler.sampleRate ?? 44100
          const delaySamples = Math.floor(this.config.punctuationDelay * sr)
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
              buffer: this.asInt16 ? AudioConverter.float32ToInt16(emptyBuffer) : emptyBuffer
            }
          }
          continue
        } else if (isPunctuation) {
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
                buffer: this.asInt16 ? AudioConverter.float32ToInt16(emptyBuffer) : emptyBuffer
              }
            } else {
              lastBufferLength = processedBuffer.length
              totalAudioSamples += processedBuffer.length
              const finalBuffer = this.asInt16 ? AudioConverter.float32ToInt16(processedBuffer) : processedBuffer
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
                buffer: this.asInt16 ? AudioConverter.float32ToInt16(emptyBuffer) : emptyBuffer
              }
            } else {
              lastBufferLength = processedBuffer.length
              totalAudioSamples += processedBuffer.length
              const finalBuffer = this.asInt16 ? AudioConverter.float32ToInt16(processedBuffer) : processedBuffer
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
                buffer: this.asInt16 ? AudioConverter.float32ToInt16(emptyBuffer) : emptyBuffer
              }
            } else {
              lastBufferLength = processedBuffer.length
              totalAudioSamples += processedBuffer.length
              const finalBuffer = this.asInt16 ? AudioConverter.float32ToInt16(processedBuffer) : processedBuffer
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
            buffer: this.asInt16 ? AudioConverter.float32ToInt16(emptyBuffer) : emptyBuffer
          }
        } else {
          lastBufferLength = processedBuffer.length
          totalAudioSamples += processedBuffer.length
          const finalBuffer = this.asInt16 ? AudioConverter.float32ToInt16(processedBuffer) : processedBuffer
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
        buffer: this.asInt16 ? AudioConverter.float32ToInt16(emptyBuffer) : emptyBuffer
      }
    }
  }
}
