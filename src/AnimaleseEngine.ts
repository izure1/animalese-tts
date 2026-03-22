import { TextAnalyzer, Sampler, AudioEffect, SynthesisOutput } from './interfaces'
import { AudioConverter } from './core/AudioConverter'
import { TTSSpeaker } from './core/TTSSpeaker'

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
   * Creates a TTSSpeaker instance for the given text.
   * @param text The input text to synthesize.
   * @param asInt16 Whether to output Int16Array instead of Float32Array.
   * @returns A TTSSpeaker instance to handle loading resources and streaming synthesis.
   */
  public synthesize(text: string, asInt16: boolean = false): TTSSpeaker {
    return new TTSSpeaker(text, asInt16, this.config)
  }
}
