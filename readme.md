# Animalese TTS

동물의 숲 스타일의 음성 합성(TTS) 엔진인 Animalese TTS입니다. 텍스트를 분석하여 각각의 음소에 대응하는 오디오 샘플을 합성하고, 피치 조절 및 멜로디 변동 효과를 적용하여 귀엽고 독특한 목소리를 생성합니다.

## 주요 특징

- **다국어 지원**: 한국어(초/중/종성 분리), 영어, 일본어(히라가나, 가타카나) 분석기를 지원합니다.
- **다양한 환경 지원**: Web Audio API를 사용하는 브라우저 환경과 파일 시스템을 사용하는 Node.js 환경에서 모두 동작합니다.
- **실시간 합성**: `AsyncGenerator`를 사용하여 글자 단위로 실시간 합성이 가능합니다.
- **풍부한 오디오 효과**:
  - **기본 피치 및 랜덤성**: 목소리의 높낮이와 매번 바뀌는 변동 폭을 조절할 수 있습니다.
  - **멜로디 변동**: 사인파 기반의 음고 변화를 통해 노래하는 듯한 느낌을 줄 수 있습니다.
  - **재생 속도 조절**: 음고와 독립적으로 재생 속도를 조절할 수 있습니다.
  - **문장 부호 및 공백 지연**: 마침표나 쉼표, 공백 등에 따른 자연스러운 멈춤을 설정할 수 있습니다.

## 설치 및 빌드

```bash
# 의존성 설치
npm install

# 프로젝트 빌드 (dist 폴더 생성)
npm run build

# 테스트 실행
npm test
```

## 사용 방법 (예시)

### AnimaleseEngine 설정

```typescript
import { AnimaleseEngine, KoreanAnalyzer, FileSystemSampler, PitchManager } from 'animalese-tts'

const engine = new AnimaleseEngine({
  analyzer: new KoreanAnalyzer(),
  sampler: new FileSystemSampler({
    sampleRate: 44100,    // 원본 샘플 데이터의 샘플 레이트(Hz)
    maxRetries: 3,        // 없는 음소 파일 로드 시 최대 재시도 횟수
    samplesDirectory: './samples' // 원본 샘플 데이터가 저장된 디렉토리
  }),
  effect: new PitchManager({
    pitch: 1.5,           // 기본 보다 약간 높은 톤
    speed: 4.0,           // 재생 속도
    randomness: 0.1,      // 글자별 무작위 피치 변동 폭
    melodyRate: 0.05,     // 멜로디 변동 주기
    melodyAmplitude: 0.1  // 멜로디 변동 진폭
  }),
  spaceDelay: 0.1,        // 공백 문자 인식 시 삽입될 무음 지연 시간(초)
  punctuationDelay: 0.3   // 문장 부호 인식 시 삽입될 무음 지연 시간(초)
})

// 합성 및 출력 예시
async function speak(text: string) {
  for await (const output of engine.synthesize(text)) {
    console.log(`Synthesizing character: ${output.char}`)
    // output.buffer (Float32Array)를 재생하거나 파일로 저장
  }
}

speak("안녕하세요! 동물의 숲 목소리 테스트입니다.")
```

## 상세 설정 옵션 (AnimalVoiceConfig)

| 옵션명 | 타입 | 기본값 | 설명 |
| :--- | :--- | :--- | :--- |
| `analyzer` | `TextAnalyzer` | (필수) | 텍스트를 음소 단위로 분리합니다. 언어별 분석기를 선택할 수 있습니다. |
| `sampler` | `Sampler` | (필수) | 음소에 대응하는 원본 오디오 샘플 데이터를 공급합니다. |
| `effect` | `AudioEffect` | (필수) | 피치 변조 및 속도 조절 효과를 담당합니다. (보통 `PitchManager` 사용) |
| `spaceDelay` | `number` | `0` | 공백 문자(` `) 인식 시 삽입될 무음 지연 시간(초)입니다. |
| `punctuationDelay` | `number` | `0` | 문장 부호 인식 시 삽입될 무음 지연 시간(초)입니다. |
| `punctuations` | `string[]` | (기본세트) | 문장 부호로 간주할 문자들의 배열입니다. |

### Sampler 파라미터 옵션 (`SamplerOptions`)

- `sampleRate`: 원본 샘플 데이터의 샘를 레이트(Hz)를 의미합니다. (예: 44100)
- `maxRetries`: (선택) 없는 음소 파일 로드 시 최대 재시도 횟수입니다.

### PitchManager 파라미터 옵션 (`PitchManagerOptions`)

- `pitch`: 목소리의 기본 톤입니다. 1.0이 표준이며, 높을수록 얇고 낮은 목소리가 됩니다. 
- `speed`: 말하는 속도입니다. 1.0보다 크면 빨라지고, 작으면 느려집니다.
- `randomness`: 각 글자마다 적용되는 무작위 피치 변화량입니다.
- `melodyRate`: 멜로디가 변하는 주기입니다. 높을수록 음높이가 빠르게 오르내립니다. (기본 0.05)
- `melodyAmplitude`: 멜로디의 변화 진폭입니다. 높을수록 음고의 고저차가 뚜렷해집니다. (기본 0.1)

## 주요 컴포넌트

### 분석기 (Analyzers)
지원하는 언어 특성에 맞추어 텍스트를 가장 작은 음소 구조로 분리하는 역할을 합니다.
- `KoreanAnalyzer`: 한국어 텍스트를 초성, 중성, 종성 단위로 정밀하게 분리하며, 겹받침 등을 자연스럽게 처리합니다.
- `EnglishAnalyzer`: 영문을 대소문자 구분 없이 알파벳 단위로 분리하며, 미지원 특수기호를 필터링합니다.
- `JapaneseAnalyzer`: 히라가나와 가타카나를 분석하여 개별 음소 단위로 분리합니다.

### 샘플러 (Samplers)
분석된 음소 문자에 대응하는 실제 `.wav` 오디오 샘플을 가져오고 캐싱합니다.
- `FileSystemSampler`: **Node.js 전용.** 로컬 디렉토리(`samplesDirectory`)에서 오디오 파일을 읽어옵니다.
- `WebSampler`: **브라우저 전용.** 원격 서버(`baseUrl`)에서 HTTP 리퀘스트로 샘플을 동적으로 가져옵니다.
- `MemorySampler`: 오디오 버퍼를 메모리에 직접 적재하여 사용합니다. 커스텀 환경이나 테스트용으로 적합합니다.

### 재생 전략 (PlaybackStrategies)
`AnimaleseEngine`이 생성한 `AsyncGenerator` 스트림 오디오 데이터(`Float32Array`)를 최종 사용자에게 들려주는 역할을 담당합니다.
- `NodePlaybackStrategy`: Node.js 환경에서 합성된 오디오를 조각 형태로 `.wav` 파일로 로컬 디스크에 저장(Export)합니다.
- `BrowserPlaybackStrategy`: Web Audio API(`AudioContext`)를 사용하여 웹 브라우저에서 버퍼를 즉각적으로 재생합니다.

## 프로젝트 구조

- `src/core`: 오디오 디코더, 변환기, 샘플 제공자 등 핵심 로직
- `src/analyzers`: 언어별 텍스트 분석 알고리즘 (한/영/일)
- `src/effects`: 피치 및 속도 조절 등 오디오 효과 처리
- `src/playback`: 플랫폼별(Browser/Node) 재생 전략
- `src/interfaces.ts`: 주요 인터페이스 및 타입 정의

## 라이선스

이 프로젝트의 라이선스는 [LICENSE](LICENSE) 파일을 참조하십시오.
