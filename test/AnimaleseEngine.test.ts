import { AnimaleseEngine, AnimalVoiceConfig } from '../src/AnimaleseEngine'
import { KoreanAnalyzer } from '../src/analyzers/KoreanAnalyzer'
import { MemorySampler } from '../src/core/MemorySampler'
import { PitchManager } from '../src/effects/PitchManager'
import { AudioPlaybackStrategy } from '../src/interfaces'

describe('AnimaleseEngine (Full OOP DI Pattern)', () => {
  let engine: AnimaleseEngine
  let sampler: MemorySampler
  let mockStrategy: AudioPlaybackStrategy

  beforeEach(() => {
    mockStrategy = {
      volume: 1,
      play: jest.fn().mockResolvedValue(undefined),
      drainAndPlay: jest.fn().mockResolvedValue(undefined)
    }

    sampler = new MemorySampler({ sampleRate: 44100 })

    const config: AnimalVoiceConfig = {
      analyzer: new KoreanAnalyzer(),
      sampler: sampler,
      effect: new PitchManager({ pitch: 1.5, speed: 1.0, randomness: 0.1 })
    }

    engine = new AnimaleseEngine(config)
  })

  it('텍스트 변환, 피치 연산 및 모의 전략 재생 호출이 연계되어야 한다.', async () => {
    // mock Float32Array 샘플 로드
    const buffer = new Float32Array(8)
    await sampler.loadSample('ㅏ', buffer)
    await sampler.loadSample('ㄴ', buffer)
    await sampler.loadSample('ㅕ', buffer)

    // '안녕' -> 'ㅏ', 'ㄴ', 'ㄴ', 'ㅕ', 'ㅇ'(생략) -> '안', '녕' 각각 병합되어 총 2번의 오디오 재생이 유효함
    const speaker = engine.synthesize('안녕')
    await speaker.load()
    for await (const result of speaker.speak()) {
      await mockStrategy.play(result.buffer as Float32Array)
    }

    expect(mockStrategy.play).toHaveBeenCalledTimes(2)
  })
})

import { EnglishAnalyzer } from '../src/analyzers/EnglishAnalyzer'

describe('AnimaleseEngine (EnglishAnalyzer)', () => {
  let engine: AnimaleseEngine
  let sampler: MemorySampler
  let mockStrategy: AudioPlaybackStrategy

  beforeEach(() => {
    mockStrategy = {
      volume: 1,
      play: jest.fn().mockResolvedValue(undefined),
      drainAndPlay: jest.fn().mockResolvedValue(undefined)
    }

    sampler = new MemorySampler({ sampleRate: 44100 })

    const config: AnimalVoiceConfig = {
      analyzer: new EnglishAnalyzer(), // 영문 분석기 주입
      sampler: sampler,
      effect: new PitchManager({ pitch: 1.5, speed: 1.0, randomness: 0.1 })
    }

    engine = new AnimaleseEngine(config)
  })

  it('영문 텍스트는 대소문자 구분 없이 알파벳만 분리되어 재생되어야 한다.', async () => {
    // mock Float32Array 샘플 로드
    const buffer = new Float32Array(8)
    await sampler.loadSample('h', buffer)
    await sampler.loadSample('e', buffer)
    await sampler.loadSample('l', buffer)
    await sampler.loadSample('o', buffer)

    // 'Hello!!' -> 대문자 소문자화 -> 'h'+'e', 'l'+'l'+'o' (총 2그룹), '!'구두점 딜레이 2번 = 4번
    const speaker = engine.synthesize('Hello!!')
    await speaker.load()
    for await (const result of speaker.speak()) {
      await mockStrategy.play(result.buffer as Float32Array)
    }

    expect(mockStrategy.play).toHaveBeenCalledTimes(4)
  })
})
