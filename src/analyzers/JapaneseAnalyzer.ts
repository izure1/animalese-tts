import type { TextAnalyzer } from '../interfaces'

export class JapaneseAnalyzer implements TextAnalyzer {
  public analyze(text: string): string[] {
    const phonemes: string[] = []

    for (const char of text.split('')) {
      // 히라가나(\u3040-\u309F) 및 가타카나(\u30A0-\u30FF) 정규식 매칭
      // 동물의 숲 일본어판은 주로 가나(Kana) 단위로 읽으므로 한자(Kanji) 처리 등은 배제한 기본 형태
      if (/[\u3040-\u309F\u30A0-\u30FF]/.test(char)) {
        phonemes.push(char)
      } else if (/[a-zA-Z]/.test(char)) {
        // 영어가 섞여있을 경우 처리 (소문자 치환)
        phonemes.push(char.toLowerCase())
      }
    }

    return phonemes
  }
}
