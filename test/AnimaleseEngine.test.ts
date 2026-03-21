import { AnimaleseEngine, AnimalVoiceConfig } from '../src/AnimaleseEngine'
import { KoreanAnalyzer } from '../src/analyzers/KoreanAnalyzer'
import { MemorySampleProvider } from '../src/core/MemorySampleProvider'
import { GranularPitchShifter } from '../src/effects/GranularPitchShifter'
import { PlaybackStrategy } from '../src/interfaces'

describe('AnimaleseEngine (Full OOP DI Pattern)', () => {
  let engine: AnimaleseEngine
  let sampleProvider: MemorySampleProvider
  let mockStrategy: PlaybackStrategy

  beforeEach(() => {
    mockStrategy = {
      play: jest.fn().mockResolvedValue(undefined)
    }

    sampleProvider = new MemorySampleProvider()

    const config: AnimalVoiceConfig = {
      basePitch: 1.5,
      randomness: 0.1,
      analyzer: new KoreanAnalyzer(),
      sampleProvider: sampleProvider,
      effect: new GranularPitchShifter()
    }

    engine = new AnimaleseEngine(config)
  })

  it('텍스트 변환, 피치 연산 및 모의 전략 재생 호출이 연계되어야 한다.', async () => {
    // mock Float32Array 샘플 로드
    const buffer = new Float32Array(8)
    sampleProvider.loadSample('ㅏ', buffer)
    sampleProvider.loadSample('ㄴ', buffer)
    sampleProvider.loadSample('ㅕ', buffer)

    // '안녕' -> 'ㅏ', 'ㄴ', 'ㄴ', 'ㅕ', 'ㅇ'(생략) -> 총 4개의 음소가 유효함 (샘플 있음)
    for await (const result of engine.synthesize('안녕')) {
      await mockStrategy.play(result.buffer)
    }

    expect(mockStrategy.play).toHaveBeenCalledTimes(3)
  })

  it('calculateRandomizedPitch: 피치는 randomness 기본 범위 내에서 랜덤하게 생성되어야 한다', () => {
    const pitch = engine.calculateRandomizedPitch()
    expect(pitch).toBeGreaterThanOrEqual(1.5 - 0.1 / 2)
    expect(pitch).toBeLessThanOrEqual(1.5 + 0.1 / 2)
  })
})

import { EnglishAnalyzer } from '../src/analyzers/EnglishAnalyzer'

describe('AnimaleseEngine (EnglishAnalyzer)', () => {
  let engine: AnimaleseEngine
  let sampleProvider: MemorySampleProvider
  let mockStrategy: PlaybackStrategy

  beforeEach(() => {
    mockStrategy = {
      play: jest.fn().mockResolvedValue(undefined)
    }

    sampleProvider = new MemorySampleProvider()

    const config: AnimalVoiceConfig = {
      basePitch: 1.5,
      randomness: 0.1,
      analyzer: new EnglishAnalyzer(), // 영문 분석기 주입
      sampleProvider: sampleProvider,
      effect: new GranularPitchShifter()
    }

    engine = new AnimaleseEngine(config)
  })

  it('영문 텍스트는 대소문자 구분 없이 알파벳만 분리되어 재생되어야 한다.', async () => {
    // mock Float32Array 샘플 로드
    const buffer = new Float32Array(8)
    sampleProvider.loadSample('h', buffer)
    sampleProvider.loadSample('e', buffer)
    sampleProvider.loadSample('l', buffer)
    sampleProvider.loadSample('o', buffer)

    // 'Hello!!' -> 특수문자 무시, 대문자 소문자화 -> 'h', 'e', 'l', 'l', 'o' (총 5개)
    for await (const result of engine.synthesize('Hello!!')) {
      await mockStrategy.play(result.buffer)
    }

    expect(mockStrategy.play).toHaveBeenCalledTimes(5)
  })
})
