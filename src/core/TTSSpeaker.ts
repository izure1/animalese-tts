import { AnimalVoiceConfig } from '../AnimaleseEngine'
import { SynthesisOutput } from '../interfaces'
import { AudioConverter } from './AudioConverter'

export type TTSSpeakerEventCallback<K extends keyof TTSSpeakerEvents> = TTSSpeakerEvents[K]

export type TTSSpeakerEvents = {
  requested: (tokensToLoad: string[]) => void;
  loading: (tokensToLoad: string[]) => void;
  loaded: (token: string) => void;
  completed: (loadedTokens: string[]) => void;
  failed: (failedToken: string) => void;
}

export class TTSSpeaker {
  private listeners: { [K in keyof TTSSpeakerEvents]?: TTSSpeakerEventCallback<K>[] } = {}
  private isLoaded: boolean = false
  private readonly punctuations: string[]

  constructor(
    private readonly text: string,
    private readonly asInt16: boolean,
    private readonly config: AnimalVoiceConfig
  ) {
    this.punctuations = this.config.punctuations || ['.', ',', '!', '?', "'", '"', '(', ')', '~', '。', '、', '！', '？', 'っ', 'ッ', 'ー']
  }

  public on<K extends keyof TTSSpeakerEvents>(event: K, callback: TTSSpeakerEventCallback<K>): void {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event]!.push(callback)
  }

  private emit<K extends keyof TTSSpeakerEvents>(event: K, ...args: Parameters<TTSSpeakerEvents[K]>): void {
    const callbacks = this.listeners[event]
    if (callbacks) {
      callbacks.forEach(cb => (cb as any)(...args))
    }
  }

  public async load(): Promise<void> {
    const tokenGroups = this.config.analyzer.analyze(this.text)
    const uniqueTokens = new Set<string>()

    for (const group of tokenGroups) {
      for (const token of group) {
        if (token.phoneme) {
          uniqueTokens.add(token.phoneme)
        }
      }
    }

    const tokensToLoad: string[] = []
    const allTokens = Array.from(uniqueTokens)

    for (const token of allTokens) {
      const isSpace = token === ' ' || token === '　'
      const isPunctuation = this.punctuations.includes(token)

      if (!isSpace && !isPunctuation) {
        if (!this.config.sampler.isCached(token)) {
          tokensToLoad.push(token)
        }
      }
    }

    this.emit('requested', tokensToLoad)

    if (tokensToLoad.length > 0) {
      this.emit('loading', tokensToLoad)
    }

    const loadedTokens: string[] = []

    await Promise.all(tokensToLoad.map(async (token) => {
      try {
        const sample = await this.config.sampler.getSample(token)
        if (sample) {
          loadedTokens.push(token)
          this.emit('loaded', token)
        } else {
          this.emit('failed', token)
        }
      } catch (error) {
        this.emit('failed', token)
      }
    }))

    this.isLoaded = true
    this.emit('completed', loadedTokens)
  }

  public async *speak(): AsyncGenerator<SynthesisOutput, void, unknown> {
    if (!this.isLoaded) {
      throw new Error('[TTSSpeaker] load() must be called and awaited before calling speak()')
    }

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
              buffer: this.asInt16 ? AudioConverter.float32ToInt16(emptyBuffer) : emptyBuffer
            }
          }
          continue
        } else if (isSpace) {
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
