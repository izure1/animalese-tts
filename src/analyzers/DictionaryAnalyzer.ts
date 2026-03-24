import type { TextAnalyzer, PhonemeToken } from '../interfaces'

/**
 * Base analyzer that converts text using a dictionary mapping.
 * Each matching character sequence is converted into an array of phonemes.
 */
export abstract class DictionaryAnalyzer implements TextAnalyzer {
  protected abstract dictionary: Record<string, string[]>

  public analyze(text: string): PhonemeToken[][] {
    const phonemes: PhonemeToken[][] = []
    let i = 0

    // Simple dictionary matching, up to 2 characters
    while (i < text.length) {
      const char = text[i]
      const nextChar = text[i + 1]

      const combine = nextChar ? char + nextChar : ''

      if (this.dictionary[combine]) {
        const values = this.dictionary[combine]
        for (const seq of values) {
          const group: PhonemeToken[] = []
          for (let j = 0; j < seq.length; j++) {
            group.push({ phoneme: seq[j], mergeWithNext: j < seq.length - 1 })
          }
          phonemes.push(group)
        }
        phonemes.push([]) // Fill the consumed second character
        i += 2
        continue
      } else if (this.dictionary[char]) {
        const values = this.dictionary[char]
        for (const seq of values) {
          const group: PhonemeToken[] = []
          for (let j = 0; j < seq.length; j++) {
            group.push({ phoneme: seq[j], mergeWithNext: j < seq.length - 1 })
          }
          phonemes.push(group)
        }
        i++
        continue
      } else {
        phonemes.push([{ phoneme: char, mergeWithNext: false }])
        i++
        continue
      }
    }

    return phonemes
  }
}
