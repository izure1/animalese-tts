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

    for (const phoneme of phonemes) {
      const rawBuffer = this.config.sampleProvider.getSample(phoneme)
      if (!rawBuffer) {
        continue
      }

      const pitch = this.calculateRandomizedPitch()
      const processedBuffer = this.config.effect.apply(rawBuffer, pitch)

      yield { phoneme, pitch, buffer: processedBuffer }
    }
  }

  public calculateRandomizedPitch(): number {
    return this.config.basePitch + (Math.random() - 0.5) * this.config.randomness
  }
}
