import type { TextAnalyzer, PhonemeToken } from '../interfaces'

/**
 * Text analyzer implementation for the English language.
 * Extracts individual alphabetical characters as phonemes.
 */
export class EnglishAnalyzer implements TextAnalyzer {
  public analyze(text: string): PhonemeToken[][] {
    const phonemes: PhonemeToken[][] = []

    const normalizedText = text.toLowerCase()

    for (const char of normalizedText.split('')) {
      if (/[a-z]/.test(char)) {
        phonemes.push([{ phoneme: char, mergeWithNext: false }])
      } else {
        phonemes.push([{ phoneme: char, mergeWithNext: false }])
      }
    }

    return phonemes
  }
}
