import type { TextAnalyzer, PhonemeToken } from '../interfaces'

const DIGRAPHS = ['sh', 'ch', 'th', 'wh', 'ph', 'ck', 'qu', 'ng']

/**
 * Text analyzer implementation for the English language.
 * Merges consonant->vowel and vowel->vowel, but not others.
 * Exceptions: 
 * - Digraphs (sh, ch, th, etc.) are always merged together.
 */
export class EnglishAnalyzer implements TextAnalyzer {
  private isVowel(char: string): boolean {
    return ['a', 'e', 'i', 'o', 'u', 'y'].includes(char)
  }

  private isConsonant(char: string): boolean {
    return /[a-z]/.test(char) && !this.isVowel(char)
  }

  public analyze(text: string): PhonemeToken[][] {
    const phonemes: PhonemeToken[][] = []
    const normalizedText = text.toLowerCase()

    let i = 0
    while (i < normalizedText.length) {
      const char = normalizedText[i]

      // 알파벳이 아니면 단독 처리
      if (!/[a-z]/.test(char)) {
        phonemes.push([{ phoneme: char, mergeWithNext: false }])
        i++
        continue
      }

      const group: PhonemeToken[] = []
      let consumed = 0

      // 현재 문자가 알파벳일 경우 그룹화 시작
      while (i + consumed < normalizedText.length) {
        const currentChar = normalizedText[i + consumed]
        const nextChar = normalizedText[i + consumed + 1]
        const combine = nextChar ? currentChar + nextChar : ''

        // 현재 문자가 알파벳이 아니면 그룹 종료
        if (!/[a-z]/.test(currentChar)) {
          break
        }

        group.push({ phoneme: currentChar, mergeWithNext: false })
        consumed++

        if (DIGRAPHS.includes(combine)) {
          // 이중자음(digraph)인 경우 무조건 병합
          group[group.length - 1].mergeWithNext = true
        } else if (nextChar && this.isVowel(nextChar)) {
          // 다음 문자가 모음이면 계속 병합 (mergeWithNext = true)
          group[group.length - 1].mergeWithNext = true
        } else if (nextChar && this.isConsonant(nextChar)) {
          // 같은 자음이 연속이면 병합 (ll, pp, tt 등)
          if (currentChar === nextChar) {
            group[group.length - 1].mergeWithNext = true
          } else {
            break
          }
        } else {
          // 다음 문자가 알파벳이 아님/끝임
          break
        }
      }

      phonemes.push(group)
      for (let j = 1; j < consumed; j++) {
        phonemes.push([])
      }
      i += consumed
    }

    return phonemes
  }
}
