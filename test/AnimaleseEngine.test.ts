import { AnimaleseEngine, AnimalVoiceConfig } from '../src/AnimaleseEngine'
import { KoreanAnalyzer } from '../src/analyzers/KoreanAnalyzer'
import { MemorySampleProvider } from '../src/core/MemorySampleProvider'
import { PitchManager } from '../src/effects/PitchManager'
import { PlaybackStrategy } from '../src/interfaces'

describe('AnimaleseEngine (Full OOP DI Pattern)', () => {
  let engine: AnimaleseEngine
  let sampleProvider: MemorySampleProvider
  let mockStrategy: PlaybackStrategy

  beforeEach(() => {
    mockStrategy = {
      play: jest.fn().mockResolvedValue(undefined)
    }

    sampleProvider = new MemorySampleProvider(44100)

    const config: AnimalVoiceConfig = {
      sampleRate: 44100,
      analyzer: new KoreanAnalyzer(),
      sampleProvider: sampleProvider,
      effect: new PitchManager(1.5, 1.0, 0.1)
    }

    engine = new AnimaleseEngine(config)
  })

  it('텍스트 변환, 피치 연산 및 모의 전략 재생 호출이 연계되어야 한다.', async () => {
    // mock Float32Array 샘플 로드
    const buffer = new Float32Array(8)
    await sampleProvider.loadSample('ㅏ', buffer, 44100)
    await sampleProvider.loadSample('ㄴ', buffer, 44100)
    await sampleProvider.loadSample('ㅕ', buffer, 44100)

    // '안녕' -> 'ㅏ', 'ㄴ', 'ㄴ', 'ㅕ', 'ㅇ'(생략) -> '안', '녕' 각각 병합되어 총 2번의 오디오 재생이 유효함
    for await (const result of engine.synthesize('안녕')) {
      await mockStrategy.play(result.buffer as Float32Array)
    }

    expect(mockStrategy.play).toHaveBeenCalledTimes(2)
  })

  it('calculatePitch: 피치는 randomness 기본 범위 내에서 랜덤하게 생성되어야 한다', () => {
    const pitch = engine.calculatePitch(0)
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

    sampleProvider = new MemorySampleProvider(44100)

    const config: AnimalVoiceConfig = {
      sampleRate: 44100,
      analyzer: new EnglishAnalyzer(), // 영문 분석기 주입
      sampleProvider: sampleProvider,
      effect: new PitchManager(1.5, 1.0, 0.1)
    }

    engine = new AnimaleseEngine(config)
  })

  it('영문 텍스트는 대소문자 구분 없이 알파벳만 분리되어 재생되어야 한다.', async () => {
    // mock Float32Array 샘플 로드
    const buffer = new Float32Array(8)
    await sampleProvider.loadSample('h', buffer, 44100)
    await sampleProvider.loadSample('e', buffer, 44100)
    await sampleProvider.loadSample('l', buffer, 44100)
    await sampleProvider.loadSample('o', buffer, 44100)

    // 'Hello!!' -> 특수문자 무시, 대문자 소문자화 -> 'h', 'e', 'l', 'l', 'o' (총 5개) 그리고 뒤의 미지원 문자열 '!!' 1개 추가 출력
    for await (const result of engine.synthesize('Hello!!')) {
      await mockStrategy.play(result.buffer as Float32Array)
    }

    expect(mockStrategy.play).toHaveBeenCalledTimes(6)
  })
})
