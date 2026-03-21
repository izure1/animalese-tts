/**
 * Represents a single phoneme and its merging behavior.
 */
export interface PhonemeToken {
  phoneme: string;
  mergeWithNext: boolean;
}

/**
 * Interface for analyzing text into phoneme tokens.
 */
export interface TextAnalyzer {
  analyze(text: string): PhonemeToken[][]
}

/**
 * Interface for providing audio samples for phonemes.
 */
export interface SampleProvider {
  getSample(phoneme: string): Promise<Float32Array | undefined>
  loadSample(phoneme: string, buffer: Float32Array, sampleRate: number): Promise<void>
}

/**
 * Interface for applying audio effects like pitch shifting.
 */
export interface AudioEffect {
  basePitch?: number;
  randomness?: number;
  apply(buffer: Float32Array, pitchRatio: number): Float32Array
}

/**
 * Interface for playing synthesized audio buffers.
 */
export interface PlaybackStrategy {
  play(buffer: Float32Array): Promise<void>
}

/**
 * Represents the output of a single synthesized character.
 */
export interface SynthesisOutput {
  char: string;
  phoneme: string;
  pitch: number;
  buffer: Float32Array | Int16Array;
}
