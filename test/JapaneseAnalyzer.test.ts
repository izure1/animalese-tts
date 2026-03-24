import { JapaneseAnalyzer } from '../src/analyzers/JapaneseAnalyzer';

describe('JapaneseAnalyzer', () => {
  let analyzer: JapaneseAnalyzer;

  beforeEach(() => {
    analyzer = new JapaneseAnalyzer();
  });

  test('should break down basic Hiragana', () => {
    const result = analyzer.analyze('さ');
    expect(result).toEqual([
      [
        { phoneme: 's', mergeWithNext: true },
        { phoneme: 'a', mergeWithNext: false }
      ]
    ]);
  });

  test('should break down basic Katakana', () => {
    const result = analyzer.analyze('テスト');
    expect(result).toEqual([
      [
        { phoneme: 't', mergeWithNext: true },
        { phoneme: 'e', mergeWithNext: false }
      ],
      [
        { phoneme: 's', mergeWithNext: true },
        { phoneme: 'u', mergeWithNext: false }
      ],
      [
        { phoneme: 't', mergeWithNext: true },
        { phoneme: 'o', mergeWithNext: false }
      ]
    ]);
  });

  test('should handle Youon (contracted sounds)', () => {
    const result = analyzer.analyze('きゃ');
    expect(result).toEqual([
      [
        { phoneme: 'k', mergeWithNext: true },
        { phoneme: 'y', mergeWithNext: true },
        { phoneme: 'a', mergeWithNext: false }
      ],
      []
    ]);
  });

  test('should handle Sokuon (double consonants) as individual unmapped character', () => {
    const result = analyzer.analyze('まって');
    expect(result).toEqual([
      [
        { phoneme: 'm', mergeWithNext: true },
        { phoneme: 'a', mergeWithNext: false }
      ],
      [
        { phoneme: 'っ', mergeWithNext: false }
      ],
      [
        { phoneme: 't', mergeWithNext: true },
        { phoneme: 'e', mergeWithNext: false }
      ]
    ]);
  });

  test('should handle mixed characters and alphabet', () => {
    const result = analyzer.analyze('Aあ');
    expect(result).toEqual([
      [{ phoneme: 'A', mergeWithNext: false }],
      [
        { phoneme: 'a', mergeWithNext: false }
      ]
    ]);
  });

  test('should handle Choonpu (long vowel mark) as individual unmapped character', () => {
    const result = analyzer.analyze('ター');
    expect(result).toEqual([
      [
        { phoneme: 't', mergeWithNext: true },
        { phoneme: 'a', mergeWithNext: false }
      ],
      [
        { phoneme: 'ー', mergeWithNext: false }
      ]
    ]);
  });
});
