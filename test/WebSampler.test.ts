import { WebSampler } from '../src/core/WebSampler'
import type { SpriteMap } from '../src/core/BaseSampler'

// fetch mock
const mockFetch = jest.fn()
global.fetch = mockFetch

/**
 * 지정된 구간 배열로 구성된 WAV Float32Array를 생성하는 헬퍼.
 * 각 구간은 { durationSamples, silent } 형태로 소리/무음을 나타냄.
 */
function buildSpriteBuffer(
  segments: { durationSamples: number; silent: boolean }[]
): Float32Array {
  const total = segments.reduce((a, s) => a + s.durationSamples, 0)
  const buf = new Float32Array(total)
  let offset = 0
  for (const seg of segments) {
    if (!seg.silent) {
      for (let i = 0; i < seg.durationSamples; i++) {
        buf[offset + i] = 0.5  // 임의 소리 값
      }
    }
    offset += seg.durationSamples
  }
  return buf
}

/**
 * Float32Array를 최소한의 WAV ArrayBuffer로 감싸는 헬퍼.
 * WavDecoder가 파싱할 수 있도록 16-bit PCM WAV 헤더를 포함함.
 */
function wrapInWav(buffer: Float32Array, sampleRate = 44100): ArrayBuffer {
  const numSamples = buffer.length
  const dataSize = numSamples * 2
  const ab = new ArrayBuffer(44 + dataSize)
  const view = new DataView(ab)

  // RIFF 헤더
  ;[82, 73, 70, 70].forEach((c, i) => view.setUint8(i, c))           // 'RIFF'
  view.setUint32(4, 36 + dataSize, true)
  ;[87, 65, 86, 69].forEach((c, i) => view.setUint8(8 + i, c))       // 'WAVE'

  // fmt 청크
  ;[102, 109, 116, 32].forEach((c, i) => view.setUint8(12 + i, c))   // 'fmt '
  view.setUint32(16, 16, true)          // chunk size
  view.setUint16(20, 1, true)           // PCM
  view.setUint16(22, 1, true)           // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)

  // data 청크
  ;[100, 97, 116, 97].forEach((c, i) => view.setUint8(36 + i, c))    // 'data'
  view.setUint32(40, dataSize, true)

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]))
    view.setInt16(44 + i * 2, s < 0 ? s * 32768 : s * 32767, true)
  }

  return ab
}

function mockFetchWith(buffer: Float32Array, sampleRate = 44100) {
  const wav = wrapInWav(buffer, sampleRate)
  mockFetch.mockResolvedValue({
    ok: true,
    arrayBuffer: () => Promise.resolve(wav),
  })
}

beforeEach(() => {
  mockFetch.mockClear()
  // globalCache 초기화 (테스트 격리)
  ;(WebSampler as any).globalCache = new Map()
  ;(WebSampler as any).globalFailureCount = new Map()
})

// ─── SpriteMap 명시 모드 ─────────────────────────────────────────────────────

describe('WebSampler — 명시적 SpriteMap 모드', () => {
  it('sampleRate를 WAV 헤더에서 자동 탐지해야 한다', async () => {
    const buf = new Float32Array(4800).fill(0.5)
    mockFetchWith(buf, 48000)

    const sampler = new WebSampler('http://x/sprite-' + Math.random() + '.wav', {
      'a': { startMs: 0, durationMs: 50 }
    })

    await sampler.getSample('a')
    expect(sampler.sampleRate).toBe(48000)
  })

  it('지정한 구간만 슬라이싱하여 반환해야 한다', async () => {
    const sampleRate = 44100
    // 0~100ms: 소리A, 100~200ms: 소리B
    const durationSamples = Math.floor(0.1 * sampleRate)  // 100ms
    const buf = new Float32Array(durationSamples * 2)
    buf.fill(0.3, 0, durationSamples)    // A 구간
    buf.fill(0.7, durationSamples)       // B 구간

    mockFetchWith(buf, sampleRate)

    const sampler = new WebSampler('http://x/sprite-' + Math.random() + '.wav', {
      'a': { startMs: 0,   durationMs: 100 },
      'b': { startMs: 100, durationMs: 100 },
    })

    const sliceA = await sampler.getSample('a')
    const sliceB = await sampler.getSample('b')

    expect(sliceA).toBeDefined()
    expect(sliceB).toBeDefined()
    // A 구간 값은 ~0.3, B 구간 값은 ~0.7
    expect(sliceA![0]).toBeCloseTo(0.3, 1)
    expect(sliceB![0]).toBeCloseTo(0.7, 1)
  })

  it('Promise.all로 병렬 호출해도 fetch는 1번만 발생해야 한다', async () => {
    const buf = new Float32Array(8820).fill(0.5)
    mockFetchWith(buf, 44100)

    const sampler = new WebSampler('http://x/sprite-' + Math.random() + '.wav', {
      'a': { startMs: 0,  durationMs: 50 },
      'b': { startMs: 50, durationMs: 50 },
    })

    await Promise.all([sampler.getSample('a'), sampler.getSample('b')])
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('SpriteMap에 없는 음소는 undefined를 반환해야 한다', async () => {
    const buf = new Float32Array(4410).fill(0.5)
    mockFetchWith(buf, 44100)

    const sampler = new WebSampler('http://x/sprite-' + Math.random() + '.wav', {
      'a': { startMs: 0, durationMs: 50 },
    })

    const result = await sampler.getSample('z')
    expect(result).toBeUndefined()
  })
})

// ─── string[] 자동 탐지 모드 ────────────────────────────────────────────────

describe('WebSampler — 자동 탐지 (string[]) 모드', () => {
  it('무음 구간을 기준으로 세그먼트를 분리하고 라벨에 매핑해야 한다', async () => {
    const sampleRate = 44100
    const soundSamples = Math.floor(0.1 * sampleRate)   // 100ms 소리
    const silenceSamples = Math.floor(0.05 * sampleRate) // 50ms 무음

    // [소리A | 무음 | 소리B] 구조
    const buf = buildSpriteBuffer([
      { durationSamples: soundSamples,   silent: false },
      { durationSamples: silenceSamples, silent: true  },
      { durationSamples: soundSamples,   silent: false },
    ])
    mockFetchWith(buf, sampleRate)

    const sampler = new WebSampler('http://x/sprite-5.wav', ['a', 'b'])

    const sliceA = await sampler.getSample('a')
    const sliceB = await sampler.getSample('b')

    expect(sliceA).toBeDefined()
    expect(sliceB).toBeDefined()
    expect(sliceA!.length).toBeGreaterThan(0)
    expect(sliceB!.length).toBeGreaterThan(0)
  })

  it('세그먼트 수와 라벨 수가 다를 때 경고를 출력해야 한다', async () => {
    const sampleRate = 44100
    const soundSamples = Math.floor(0.1 * sampleRate)
    const silenceSamples = Math.floor(0.05 * sampleRate)

    const buf = buildSpriteBuffer([
      { durationSamples: soundSamples,   silent: false },
      { durationSamples: silenceSamples, silent: true  },
      { durationSamples: soundSamples,   silent: false },
    ])
    mockFetchWith(buf, sampleRate)

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const sampler = new WebSampler('http://x/sprite-6.wav', ['a', 'b', 'c'])  // 라벨 3개, 세그먼트 2개

    await sampler.getSample('a')
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[WebSampler]')
    )
    warnSpy.mockRestore()
  })
})
