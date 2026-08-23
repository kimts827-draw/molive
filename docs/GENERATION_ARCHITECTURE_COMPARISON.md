# Project Source 생성 구조 비교

검증일: 2026-08-17  
조건: 첨부 이미지 없음, 강제 브랜드 컬러 없음, 동일 생성 API와 validator 사용

## 결과 요약

| 프롬프트 | Trace ID | Header | Hero | Product presentation | Typography | Footer |
|---|---|---|---|---|---|---|
| 절제된 프리미엄 전자제품 | `33a61270-d0e5-42e0-a8ee-2b436c521d6e` | 계측 패널처럼 나눈 3영역 콘솔 | 단일 제품·좌우 기술 표기·하단 정보를 겹친 정밀 장비 쇼케이스 | 12열 비대칭 카탈로그, 첫째·넷째 상품 강조 | 얇은 대형 제목 + 계측기형 메타 레이블 | 다크 메탈 톤의 지원·탐색 그리드 |
| 일본 독립잡지 스타일 스트릿 패션 | `f633f2e3-3a30-4fda-ae25-916ddd61fe50` | 이슈 정보·워드마크·상점 도구가 결합된 잡지 마스트헤드 | ISSUE 01, 세로 캡션, 비스듬한 보조 이미지의 표지 콜라주 | 커버 상품과 기사 썸네일이 섞인 12열 편집 그리드 | 응축 산세리프 + 명조의 편집 대비 | 거대 워드마크를 한 장의 백커버로 구성 |
| 따뜻한 자연주의 스킨케어 | `f25ca653-f703-4bdc-b173-03ad486e87f6` | 중앙 워드마크를 기준으로 좌우 동선을 둔 스튜디오형 헤더 | 식물·크림 텍스처 위 선언문·계절 카드·세로 표식이 겹치는 구성 | 첫 상품을 크게 둔 비대칭 ‘오늘의 선반’ | 가벼운 한국어 제목 + 작은 영문 표식 | 짙은 이끼색의 넓은 3단 브랜드 푸터 |

세 결과는 모두 1회의 OpenAI 응답으로 validator를 통과했고, 각각 1개의 `data-cafe24-slot="product-list"`를 포함합니다.

## 실제 HTML/CSS 지문

| 결과 | Section | Article | Editable node | HTML bytes | CSS bytes | 주요 grid 지문 |
|---|---:|---:|---:|---:|---:|---|
| 전자제품 | 5 | 7 | 80 | 13,503 | 19,959 | 계측 콘솔 + 12열 비대칭 상품 카탈로그 |
| 스트릿 패션 | 5 | 5 | 74 | 12,508 | 표지 콜라주 + 12열 잡지 목차형 상품 에디트 |
| 스킨케어 | 7 | 9 | 101 | 16,438 | 원료 작업대 + 첫 상품 강조형 12열 선반 |

섹션 개수부터 5/5/7로 달라졌고, header/hero 자식 구성, article 수, 상품 표현, 타이포그래피, footer 문법도 서로 다릅니다. 세 결과 중 어느 것도 기존 공통 Preview의 고정 46/54 Split Hero나 고정 3열 Product Grid를 통해 렌더링되지 않습니다. 세 CSS 모두 실제 기본 스킨의 `.prdList`, `.prdList__item`, `.thumbnail`, `.description` 규칙을 직접 포함해 Preview placeholder뿐 아니라 런타임에 마운트되는 Cafe24 상품에도 동일한 아트 디렉션을 적용합니다.

## Trace 확인

개발 모드 trace는 `.moire/traces/<timestamp>-<traceId>.json`에 저장됩니다. 각 파일에는 다음을 포함합니다.

- OpenAI에 전달한 실제 system prompt와 user prompt
- 모델 ID, 응답 ID, 원본 `output_text`, usage
- AI 원본 HTML/CSS와 metadata 정규화 후 Project Source
- validator 통계와 violation 목록
- 재시도별 결과

이미지 첨부 시 trace에는 이미지 개수와 역할만 남고 base64/원본 이미지 데이터는 저장하지 않습니다. API key도 기록하지 않습니다.

## 선택 영역 AI patch 확인

- 요청: 전자제품 결과의 `hero-precision-object`에 “더 고급스럽고 정밀한 단일 제품 쇼케이스” 적용
- Trace ID: `1da128c0-215e-4997-a006-c679c54d6aba`
- 결과: 선택 루트 ID 유지, node scope 유지, Project root scope 유지, validator 통과
- patch 크기: HTML 3,331 bytes, CSS 12,949 bytes

전체 페이지를 재생성하지 않고 선택한 Hero의 `outerHTML`과 해당 node 전용 CSS만 반환했습니다.
