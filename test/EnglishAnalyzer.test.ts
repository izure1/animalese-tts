import { EnglishAnalyzer } from '../src/analyzers/EnglishAnalyzer'

describe('EnglishAnalyzer', () => {
  let analyzer: EnglishAnalyzer

  beforeEach(() => {
    analyzer = new EnglishAnalyzer()
  })

  test('should analyze basic alphabetic characters', () => {
    const result = analyzer.analyze('cat')
    expect(result).toEqual([
      [
        { phoneme: 'c', mergeWithNext: true },
        { phoneme: 'a', mergeWithNext: false }
      ],
      [],
      [{ phoneme: 't', mergeWithNext: false }]
    ])
  })

  test('should merge consonant after 2+ vowels', () => {
    // would -> woul, d
    const result = analyzer.analyze('would')
    expect(result).toEqual([
      [
        { phoneme: 'w', mergeWithNext: true },
        { phoneme: 'o', mergeWithNext: true },
        { phoneme: 'u', mergeWithNext: true },
        { phoneme: 'l', mergeWithNext: false }
      ],
      [],
      [],
      [],
      [{ phoneme: 'd', mergeWithNext: false }]
    ])

    // good -> good
    const result2 = analyzer.analyze('good')
    expect(result2).toEqual([
      [
        { phoneme: 'g', mergeWithNext: true },
        { phoneme: 'o', mergeWithNext: true },
        { phoneme: 'o', mergeWithNext: true },
        { phoneme: 'd', mergeWithNext: false }
      ],
      [],
      [],
      []
    ])
  })

  test('should not merge consonant after 1 vowel', () => {
    // like -> li, ke
    const result = analyzer.analyze('like')
    expect(result).toEqual([
      [
        { phoneme: 'l', mergeWithNext: true },
        { phoneme: 'i', mergeWithNext: false }
      ],
      [],
      [
        { phoneme: 'k', mergeWithNext: true },
        { phoneme: 'e', mergeWithNext: false }
      ],
      []
    ])
  })

  test('should merge digraphs correctly regardless of C/V rules', () => {
    // shop -> sho, p (s+h = digraph, h+o = C+V, o+p = break)
    const result = analyzer.analyze('shop')
    expect(result).toEqual([
      [
        { phoneme: 's', mergeWithNext: true },
        { phoneme: 'h', mergeWithNext: true },
        { phoneme: 'o', mergeWithNext: false }
      ],
      [],
      [],
      [{ phoneme: 'p', mergeWithNext: false }]
    ])

    // check -> che, ck (c+h = digraph, h+e = C+V, e+c = break, c+k = digraph)
    const result2 = analyzer.analyze('check')
    expect(result2).toEqual([
      [
        { phoneme: 'c', mergeWithNext: true },
        { phoneme: 'h', mergeWithNext: true },
        { phoneme: 'e', mergeWithNext: false }
      ],
      [],
      [],
      [
        { phoneme: 'c', mergeWithNext: true },
        { phoneme: 'k', mergeWithNext: false }
      ],
      []
    ])
  })

  test('should handle uppercase letters by converting them to lowercase', () => {
    // DOG -> DO, G (D->O is C->V merge)
    const result = analyzer.analyze('DOG')
    expect(result).toEqual([
      [
        { phoneme: 'd', mergeWithNext: true },
        { phoneme: 'o', mergeWithNext: false }
      ],
      [],
      [{ phoneme: 'g', mergeWithNext: false }]
    ])
  })

  test('should handle punctuation and unsupported characters correctly', () => {
    // hi! -> hi, ! (h->i is C->V, i->! is V->?, ! is not a-z so false)
    const result = analyzer.analyze('hi!')
    expect(result).toEqual([
      [
        { phoneme: 'h', mergeWithNext: true },
        { phoneme: 'i', mergeWithNext: false }
      ],
      [],
      [{ phoneme: '!', mergeWithNext: false }]
    ])
  })
})
