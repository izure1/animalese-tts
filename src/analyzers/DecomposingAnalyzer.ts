import type { TextAnalyzer, PhonemeToken } from '../interfaces'

/**
 * Base abstract analyzer for languages that decompose characters into individual phonemes.
 */
export abstract class DecomposingAnalyzer implements TextAnalyzer {
  public analyze(text: string): PhonemeToken[][] {
    const tokens: PhonemeToken[][] = []
    for (const char of text.split('')) {
      tokens.push(this.decompose(char))
    }
    return tokens
  }

  /**
   * Decomposes a single character into an array of phoneme tokens.
   * @param char The character to decompose.
   * @returns An array of PhonemeToken representing the decomposed phonemes.
   */
  protected abstract decompose(char: string): PhonemeToken[]
}
