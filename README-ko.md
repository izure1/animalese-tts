# Animalese TTS

[![](https://data.jsdelivr.com/v1/package/npm/animalese-tts/badge)](https://www.jsdelivr.com/package/npm/animalese-tts)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

Animalese TTS는 '동물의 숲' 스타일의 음성 합성(TTS) 엔진입니다. 텍스트를 분석하여 각 음소에 해당하는 오디오 샘플을 합성하고, 피치 조절과 음률 변화를 주어 귀엽고 독특한 목소리를 생성합니다.

👉 **[테스트 페이지 (데모) 가기](https://animalese-tts.izure.org)**

## 주요 기능

- **다국어 지원**: 한국어(초/중/종성 분리), 영어, 일본어(히라가나, 가타카나) 분석기를 지원합니다.
- **크로스 환경 지원**: Web Audio API를 사용하는 브라우저 환경과 파일 시스템을 사용하는 Node.js 환경 모두에서 완벽하게 동작합니다.
- **실시간 합성**: `AsyncGenerator`를 사용하여 글자 단위로 실시간 합성이 가능합니다.
- **풍부한 오디오 효과**:
  - **기본 피치 & 무작위성**: 목소리의 톤과 매번 달라지는 변동폭을 조절합니다.
  - **음률 변화**: 사인파 기반의 피치 변화를 통해 노래하는 듯한 효과를 줍니다.
  - **재생 속도 조절**: 피치와 독립적으로 재생 속도를 조절합니다.
  - **구두점 및 띄어쓰기 지연**: 마침표, 쉼표, 띄어쓰기 등에 자연스러운 퍼즈(pause)를 설정합니다.

## 설치 및 빌드

```bash
npm install animalese-tts
```

```html
<script type="module">
  import {
    AnimaleseEngine,
    KoreanAnalyzer,
    WebSampler,
    PitchManager,
    WebPlayer
  } from 'https://cdn.jsdelivr.net/npm/animalese-tts/+esm'
</script>
```

## 사용법 (예제)

### 웹 브라우저 환경

브라우저 환경에서는 `WebSampler`를 사용해 HTTP로 샘플을 가져오고, `WebPlayer`를 사용해 Web Audio API로 오디오를 재생합니다.

```typescript
import {
  AnimaleseEngine,
  KoreanAnalyzer,
  WebSampler,
  PitchManager,
  WebPlayer
} from 'https://cdn.jsdelivr.net/npm/animalese-tts/+esm'

const sampleRate = 48000

const player = new WebPlayer(sampleRate)

const engine = new AnimaleseEngine({
  analyzer: new KoreanAnalyzer(),
  sampler: new WebSampler(
    'https://your-server.com/sounds/sprite.wav', 
    ['a', 'b', 'c'] // 라벨로 자동 감지하거나 명시적인 SpriteMap 객체를 사용
  ),
  effect: new PitchManager({
    pitch: 1.5,
    speed: 4.0
  })
})

async function speak(text: string) {
  const speaker = engine.synthesize(text)
  await speaker.load()
  
  for await (const output of speaker.speak()) {
    await player.play(output.buffer)
  }
}

speak("안녕하세요! 브라우저에서의 목소리 테스트입니다.")
```

### Node.js 환경

Node.js 환경에서는 `FileSystemSampler`를 사용해 로컬 디스크에서 샘플을 읽고, `FilePlayer`를 사용해 오디오를 재생하거나 저장합니다.

```typescript
import {
  AnimaleseEngine,
  KoreanAnalyzer,
  FileSystemSampler,
  PitchManager,
  FilePlayer
} from 'animalese-tts'

const sampleRate = 48000

const player = new FilePlayer(sampleRate)

const engine = new AnimaleseEngine({
  analyzer: new KoreanAnalyzer(),
  sampler: new FileSystemSampler({
    sampleRate: 48000,
    audioFilePath: './sounds/sprite.wav',
    sprites: ['a', 'b', 'c'] // 라벨 나열식 자동 감지 또는 명시적인 SpriteMap 넘기기
  }),
  effect: new PitchManager({
    pitch: 0.8,
    speed: 3.5
  })
})

async function speak(text: string) {
  const speaker = engine.synthesize(text)
  await speaker.load()
  
  for await (const output of speaker.speak()) {
    // FilePlayer는 버퍼를 임시 또는 지정된 .wav 파일/스트림으로 내보냅니다.
    await player.play(output.buffer, './output_folder')
  }
}

speak("안녕하세요! Node.js에서의 목소리 테스트입니다.")
```

## 상세 설정 옵션 (AnimalVoiceConfig)

| 옵션명 | 타입 | 기본값 | 설명 |
| :--- | :--- | :--- | :--- |
| `analyzer` | `TextAnalyzer` | (필수) | 텍스트를 음소 단위로 분리합니다. 언어별 분석기를 선택할 수 있습니다. |
| `sampler` | `Sampler` | (필수) | 음소에 해당하는 원본 오디오 샘플 데이터를 공급합니다. |
| `effect` | `AudioEffect` | (필수) | 피치 변조 및 속도 조절 효과를 처리합니다. (일반적으로 `PitchManager` 사용) |
| `spaceDelay` | `number` | `0.03` | 띄어쓰기(` `) 인식 시 삽입되는 지연 시간(초)입니다. |
| `punctuationDelay` | `number` | `0.3` | 마침표, 구두점 인식 시 삽입되는 지연 시간(초)입니다. |
| `punctuations` | `string[]` | (기본 셋) | 구두점으로 처리할 문자들의 배열입니다. |

### Sampler 공통 옵션 (`SamplerOptions`)

- `sampleRate`: 원본 오디오 데이터의 샘플 레이트(Hz). (예: 44100)
- `maxRetries`: (선택) 누락된 음소 파일을 불러올 때 최대 재시도 횟수.
- `silenceThreshold`: (선택) 오디오 버퍼가 무음으로 간주되는 진폭의 임계값(0.0~1.0). 앞뒤 무음을 잘라내는(trim) 용도로 쓰입니다. (기본값: 0.01)

### 환경별 Sampler 설정

환경에 따라 제공되는 특정 `Sampler` 구현체를 사용해야 하며, 오디오 샘플 데이터의 위치를 지정해야 합니다.

- **Node.js (`FileSystemSampler`)**: 
  개별 파일이 아닌 단일 오디오 스프라이트 파일을 로컬에서 읽고 분할합니다.
  - `sampleRate`: 샘플레이트를 올바르게 검증하기 위한 사전 설정값.
  - `audioFilePath`: 로컬 디스크의 단일 음성 스프라이트 `.wav` 파일 경로 (절대/상대 경로).
  - `sprites`: 명시적인 `SpriteMap` 객체, 또는 무음 기준으로 자동 분할할 라벨의 `string[]` 배열.

- **Browser (`WebSampler`)**: 
  단일 오디오 스프라이트(`.wav`)를 로드하고 개별 음소 단위로 자동 분할합니다.
  - `audioSrc` (첫 번째 인자): 단일 스프라이트 오디오 파일의 URL.
  - `sprites` (두 번째 인자): 명시적인 `SpriteMap`(`{ startMs, durationMs }`) 객체, 또는 무음 기준으로 자동 분할할 라벨의 `string[]` 배열.

### 음소 오디오 데이터 구조

**`FileSystemSampler` (Node.js) & `WebSampler` (Browser) 공통**
모든 음소가 연이어 재생되는 단일 스프라이트 파일(예: `sprite.wav`)을 준비합니다.
그 뒤 명시적 `SpriteMap`이나 순서대로 배치된 `string` 배열을 통해 각 조각을 음소와 매핑합니다. 
웹과 노드 환경 구별 없이 구조가 이제 완벽히 동일하며 읽는 소스(HTTP URI vs 로컬 파일 경로)만 다릅니다.

> **참고**: 만약 해당하는 음소 오디오 파일(또는 스프라이트 슬라이스)을 찾을 수 없는 경우 합성 시 해당 문자는 무음으로 처리됩니다.

### PitchManager 옵션 (`PitchManagerOptions`)

- `pitch`: 목소리의 기본 톤. 1.0이 기본이며 높을수록 얇고 낮을수록 굵어집니다.
- `speed`: 말하기 속도. 1.0보다 크면 빠르고, 작으면 느려집니다.
- `randomness`: 글자마다 적용되는 무작위 피치 변동치.
- `melodyRate`: 음률의 변화율. 클수록 피치가 빠르게 오르내립니다. (기본 0.05)
- `melodyAmplitude`: 음률 변화의 진폭. 클수록 음낮이 격차가 선명해집니다. (기본 0.1)

## 주요 컴포넌트

### 분석기 (Analyzers)
분석기는 텍스트를 각 언어의 특성에 맞는 최소한의 음소 단위로 쪼갭니다.
- `KoreanAnalyzer`: 한국어를 초성, 중성, 종성으로 정밀하게 분리합니다. 겹받침 등을 자연스럽게 처리합니다.
- `EnglishAnalyzer`: 영어를 대소문자 구분 없이 알파벳으로 분리하고 미지원 기호를 필터링합니다.
- `JapaneseAnalyzer`: 히라가나와 가타카나를 분석해 각각의 음소로 분리합니다.

### 커스텀 분석기 만들기
제공되는 베이스 클래스(`DecomposingAnalyzer` 또는 `DictionaryAnalyzer`)를 상속하면 사용자만의 언어 분석기를 쉽게 만들 수 있습니다.

#### DecomposingAnalyzer 사용 (글자 단위)
수학적으로 음소가 결합되는 언어(한국어 등)에 적합합니다.
```typescript
import { DecomposingAnalyzer, PhonemeToken } from 'animalese-tts';

export class MyCustomAnalyzer extends DecomposingAnalyzer {
  protected decompose(char: string): PhonemeToken[] {
    // 한 글자를 음소로 분리하는 커스텀 로직
    return [{ phoneme: char.toLowerCase(), mergeWithNext: false }];
  }
}
```

#### DictionaryAnalyzer 사용 (사전 매핑 기반)
특정 글자가 그대로 음소 배열에 매핑되는 언어(일본어 등)에 적합합니다.
```typescript
import { DictionaryAnalyzer, PhonemeToken } from 'animalese-tts';

export class MyMappedAnalyzer extends DictionaryAnalyzer {
  protected dictionary: Record<string, string[]> = {
    // 단일 글자 발음
    'あ': ['a'],
    // 한 묶음으로 처리되는 발음
    'きゃ': ['kya'], 
    // 두 개의 발음을 이어서 처리
    '大': ['ta', 'i'], 
  };
}
```

### 샘플러 (Samplers)
샘플러는 분석된 음소에 해당하는 실제 `.wav` 파일 조각을 캐싱하고 제공합니다.
- `FileSystemSampler`: **Node.js 전용.** 로컬 파일 시스템에서 오디오를 수집합니다.
- `WebSampler`: **브라우저 전용.** 서버로부터 HTTP 통신을 틍해 동적으로 샘플(스프라이트)을 로드합니다.
- `MemorySampler`: 메모리에 직접 버퍼를 적재합니다. 테스트 목적 등에 쓰입니다.

### 재생 전략 (PlaybackStrategies)
`AnimaleseEngine`의 `AsyncGenerator`가 뱉어내는 조각난 스트림 오디오 데이터(`Float32Array`)를 엔드 유저에게 효과적으로 전달합니다.
- `FilePlayer`: Node.js 환경에서 합성된 오디오 조각들을 모아 로컬 디스크의 `.wav` 파일로 저장(Export)합니다.
- `WebPlayer`: 웹 프론트엔드 환경에서 Web Audio API(`AudioContext`)를 사용하여 버퍼를 즉각 재생합니다.

## 프로젝트 구조

- `src/core`: 오디오 디코더, 배열 변환, 샘플 공급자 등 핵심 코어.
- `src/analyzers`: 언어별 텍스트 분석 알고리즘 (한국어/영어/일본어)
- `src/effects`: 피치 및 속도 등 오디오 효과 처리부
- `src/playback`: 환경별 재생 전략 (브라우저/Node.js)
- `src/interfaces.ts`: 기본 인터페이스 및 타입 정의

## 라이선스

본 프로젝트의 라이선스 관련 사항은 [LICENSE](LICENSE) 파일을 참조하세요.
