# MOLIVE 디자인 다양성 1차 — 계획과 구현 기록

## 배경

업종이 전혀 다른 세 브리프(아기용품 / 인테리어 / 식품)로 생성한 결과가 서로 거의 같은 페이지가 되었다.
동일한 split Hero, 동일한 editorial 시퀀스, 동일한 neutral/beige 팔레트로 수렴하고,
생성 전에 사용자가 지정한 brand main color가 최종 화면에 거의 남지 않았다.

`Guide/Cafe24-Design-References`의 레퍼런스 32건을 대조하고 생성 경로를 추적한 결과 원인은 두 가지였다.

1. **brand color가 두 지점에서 끊긴다.**
   `pagePlanSchema`에 색 필드가 없어 1단계에서 hex가 소실되고(2단계가 실제로 따르는
   `renderPagePlanContract` 텍스트에 색이 한 글자도 실리지 않음), `commerce.accent`는
   스키마가 필수로 받아 저장까지 하지만 소비하는 렌더러가 코드베이스에 하나도 없었다.

2. **섹션 변주 축이 4개뿐이라 레이아웃이 붕괴한다.**
   `alignment / mediaPosition / density / tone`만으로는 `imageText` · `brandStory` ·
   `productFocus` · `materials`가 전부 "반은 사진, 반은 카피"로 같아진다.
   레퍼런스가 이들을 구분하는 **컨테이너 폭 · 컬럼 수 · 표면 표현**이 스키마에 없었다.

## 설계 원칙

**AI 준수에 기대지 않는다.** plan이 정한 값은 코드가 생성 HTML에 속성으로 주입하고,
코드 소유 baseline CSS가 소비한다. AI가 축을 무시해도 최소한의 geometry·색 차이는 화면에 나타난다.
**retry validator는 하나도 추가하지 않는다** — 생성 1건당 비용과 시간을 늘리지 않기 위해서다.

## 1차 구현 범위

| # | 항목 | 성격 |
|---|---|---|
| A | PagePlan에 `palette` 계약 추가 (brandColor / colorStrategy / surfaceFamily) | 스키마 + 프롬프트 |
| B | 사용자 입력 hex를 plan · ProjectSource에 덮어쓰기로 확정 (검증 아님) | 결정적 코드 |
| C | 섹션 variation 축 3종 추가: `container` / `columns` / `surfaceStyle` | 스키마 + 프롬프트 |
| D | plan 값을 생성 HTML에 코드가 속성으로 주입 (`applyPagePlanAttributes`) | 결정적 코드 |
| E | 주입된 속성을 소비하는 baseline CSS 레이어 (`planLayoutCss`) | 결정적 코드 |
| F | brand color 램프 + `colorStrategy`별 적용 정책 + `surfaceFamily` 소비 경로 | 결정적 코드 |
| G | Hero variant 6종 spec을 구조적으로 겹치지 않게 재정의 | 프롬프트 |
| H | neutral/beige 수렴을 유발하는 spec 산문 편향 완화 | 프롬프트 |
| I | 리테일 업종의 `categoryGrid`를 Hero 직후로 당김 | 가중치 |

## 1차에서 제외한 항목

| 제외 | 이유 |
|---|---|
| 상품 진열 블록 2~3개 확장 | `product_listmain_2~6`은 base skin에 있으나 verified 표식은 `_1`에만 있다. 실기기 검증 없이 확장하면 Cafe24 export가 깨진다 |
| brand color / 축 준수를 강제하는 retry validator | draft 재생성이 늘어 비용·시간이 배가 된다. 검증 대신 D·E·F가 보장한다 |
| Header에 brand color 혼합 | Header의 dark/light + 텍스트 로고 tone 상속 구조 동결 |
| ProductSectionV1 CSS 확장 | verified selector를 건드려야 한다. DOM · module binding · selector 불변 |
| `register` 축 / `columns` 강제화 / Hero variant 추가 / typeScale·header 분산 강제 | C의 효과를 측정한 뒤 판단 |

---

## 데이터 흐름 변화

```
                      [수정 전]                        [1차 수정 후]

색 입력  prompt-composer  colors:["#hex"]        동일
   ↓
1단계   PagePlan      ✗ 색 필드 없음 → 소실       ✓ palette{brandColor,colorStrategy,surfaceFamily}
        normalize                                ✓ 입력 hex 덮어쓰기 (B)
                                                 ✓ accent 밴드 1개 이상 보장 (F)
                                                 ✓ monochrome·surfaceFamily 모순 차단 (F)
                                                 ✓ 섹션에 container/columns/surfaceStyle 부여 (C)
   ↓
계약    renderPagePlanContract  ✗ 색 없음         ✓ 팔레트 + 지면색 + 신규 축을 계약 텍스트로 (A,C,F)
   ↓
2단계   Design AI                                ✓ 계약만 전달. 재시도 조건에는 추가하지 않음
   ↓
후처리  ensureEditingMetadata                    ✓ + applyPagePlanAttributes(html, plan)  ← 신규 (D)
                                                   section 요소에 data-moire-tone /
                                                   -container / -columns / -surface 주입
   ↓
tokens  commerce.accent  소비처 0곳               ✓ 입력 hex 덮어쓰기 (B)
   ↓
CSS     preview-document / theme-package
                       ✗ accent 미사용            ✓ brandThemeCss + planLayoutCss 주입 (E,F)
                          Header: surface/ink만    → Header 동결
```

---

## D. plan 값을 section DOM에 결정적으로 주입

`lib/design-library/plan-attributes.ts` — `applyPagePlanAttributes(html, plan)`.
`site-generator.ts`에서 `ensureEditingMetadata` 직후에 실행한다.

단순 순서 매칭은 AI가 섹션을 하나 더/덜 만들면 전체가 밀리므로 확정적인 신호부터 소진한다.

| pass | 근거 |
|---|---|
| 1 | `data-moire-plan` / `data-moire-id`가 plan 섹션 `id`와 정확히 일치 |
| 2 | `data-moire-type="hero"` |
| 3 | `data-cafe24-slot="product-list"`를 품은 최상위 `<section>` → `featuredProducts` (앵커) |
| 4 | `data-moire-type` 의미 매칭 (`products`) |
| 5 | **fallback** — 앵커에서 바깥 방향으로 순서 정렬 (앞쪽은 앵커 직전부터 거슬러, 뒤쪽은 앵커 직후부터) |

매칭 결과는 `planAudit.attributeMapping` / `trace.planAttributeMapping`으로 남긴다(관측 전용).

**안전 규칙**: 최상위 `<section>`과 hero 요소의 여는 태그에만 속성을 더한다.
`data-cafe24-slot` 내부, `module=` 요소, `header` 요소에는 아무것도 쓰지 않는다.

---

## E. 주입 속성을 소비하는 baseline CSS

`lib/design-library/plan-layout-css.ts` — `planLayoutCss(plan)`.
`preview-document.ts`와 `theme-package.ts`에서 AI CSS 뒤에 emit한다.

### 명시도 문제와 `!important` 경계

실제 생성 검증에서 **AI CSS가 baseline을 이기는 것이 확인됐다.**
`isolateAiDesignCss`의 `scopeStaticSelector`가 모든 AI 셀렉터에 `[data-moire-static]`를 덧붙여
명시도를 최소 `(0,3,0)`으로 올리는 반면, baseline 셀렉터는 `(0,2,0)`이라 소스 순서가 개입할 여지가 없다.

```
AI  : [data-moire-static][data-moire-root="…"] .pg-manifesto  → (0,3,0)  padding: … 28px
코드: [data-moire-root] [data-moire-container="boxed"]         → (0,2,0)  padding-inline: …
결과(수정 전): computed padding-left = 28px  ← AI가 이김
```

셀렉터를 더 복잡하게 만들어 명시도 경쟁을 하는 대신,
**plan이 코드 소유로 확정한 hard property에만 제한적으로 `!important`를 쓴다.**
AI CSS는 계약상 `!important`를 쓸 수 없으므로(`CSS_IMPORTANT_FORBIDDEN`) 이 경계는 한 방향으로만 작동한다.

**강제(HARD) 대상 — 이 목록 밖으로 나가지 않는다**
- `container`의 `padding-inline` (모바일 media query 포함)
- `full-bleed`의 `padding-inline`
- `full-bleed` 직계 자식의 `max-width`, `margin-inline`
- `surfaceStyle=card` / `outlined`의 표면 속성
- `tone=accent`의 `background-color`와 대비 `color`

**강제하지 않는 것**
- `tone` light / tinted / dark 는 `:where()`로 감싼 명시도 0의 폴백이며 `!important`를 쓰지 않는다.
  AI가 그 섹션 배경을 직접 디자인했으면 AI가 이긴다(의도한 우선권).
- `columns`는 카드 컨테이너가 섹션의 임의 깊이 자손이라 코드가 결정적으로 도달할 수 없다.
  `--molive-columns` 변수로만 내려 주고 계약이 `repeat(var(--molive-columns),1fr)` 사용을 지시한다.
- shell 배경도 강제 대상이 아니다.

**`background` 축약형은 어떤 경우에도 쓰지 않는다.** 축약형은 `background-image`를 `none`으로
초기화해 AI가 깔아 둔 사진과 그라디언트를 지운다. 항상 `background-color`만 쓴다.

---

## F. brand color / surfaceFamily 반영 정책

`lib/commerce/brand-theme.ts` — 입력 hex 하나에서 결정적으로 램프를 만든다.

### 변수 namespace

전부 **`--molive-` 전용 prefix**이며 `[data-moire-root]`에만 선언한다.
`:root` / `html` / `body`에는 선언하지 않는다.
theme-bridge가 소유한 기존 `--moire-card-*` · `--moire-thumb-*` · `--moire-header-gap` ·
`--moire-icon-size` · `--moire-footer-ink` · `--moire-footer-icon-filter`는 선언도 재정의도 하지 않는다.

`#wrap[data-moire-root]`가 header·contents·footer를 전부 감싸므로 변수 자체는 페이지 전역에 닿지만,
HeaderV1(`commerceCss`)과 verified ProductSectionV1의 CSS는 `--molive-*`를 하나도 읽지 않으므로
그 둘의 외형은 변하지 않는다(테스트로 고정).

### 본문 accent 밴드 보장

`normalizePagePlan`이 `tone === "accent"`인 본문 섹션이 없으면 전환·탐색 섹션 하나를 승격한다
(`cta` → `editorialBanner` → `promotion` → `categoryGrid` → `gift` → `collection` → `benefits`).
`featuredProducts`는 승격 대상이 아니고, 붙어 있는 두 섹션이 동시에 accent가 되지 않게 한다.

### colorStrategy가 색의 양을 조절

| colorStrategy | 본문 accent 밴드 | tinted 밴드 | Footer |
|---|---|---|---|
| `dominant` | 최대 2개 승격 | brand-tint | **brand** |
| `band` | 1개 보장 | brand-tint | **brand-tint** |
| `accent-only` | 1개 보장 | 중립 | `footerMood` 그대로 |
| `duotone` | 1개 보장 | 2차 색 | `footerMood` 그대로 |
| `monochrome` | 승격 안 함 | 중립 | `footerMood` 그대로 |

모든 페이지 푸터를 brand color로 칠하지 않는다. `footer#footer`는 계산된 **리터럴 hex**를 쓴다.

### duotone의 2차 색 파생

사용자 입력을 늘리지 않고 `brandColor` 하나에서 결정적으로 만든다.
보색(180°)은 진동이 심해 **150° 스플릿 보색**을 쓰고, 채도 ×0.85(0.18~0.72 clamp),
명도 0.38~0.62 정규화. 무채색 입력(`s < 0.08`)은 명도만 벌린 중성색으로 파생한다.

### surfaceFamily 소비 경로

`surfaceTokens(family, brandColor)`가 `--molive-surface` / `--molive-surface-ink` /
`--molive-line` / `--molive-raised`를 만든다. 소비처는 세 곳이다.

1. shell 배경 — `[data-moire-root]:not([data-moire-static])`
   (AI 셀렉터는 항상 `[data-moire-static]`를 달고 나오므로 겹치지 않는다)
2. `tone=light` 폴백
3. 계약 텍스트에 지면색 값을 명시

`white / warm / cool / tinted / dark`가 서로 다른 지면색을 만들고, 지면과 글자의 대비는 4.5:1 이상이다.

### 모순 방지 정규화 (재시도 없음)

- **monochrome 오용**: 사용자가 hex를 명시했는데 AI가 `monochrome`을 고르면 `accent-only`로 강등.
  브리프가 명시적으로 무채색을 요구한 경우(`모노크롬`·`무채색`·`흑백`·`monochrome` 등)만 예외.
- **surfaceFamily 모순**: 브리프에 어두운 지면 표현(`차콜`·`charcoal`·`다크`·`dark`·`블랙`·
  `black`·`검정` 등)이 있고 브랜드 hex도 매우 어두우면(HSL L < 0.28) `warm`/`white`를 그대로 두지 않는다.
  채도가 남아 있으면 `cool`, 무채색이면 `dark`로 결정적 정정.
  브리프가 따뜻한 지면(`아이보리`·`크림`·`따뜻`·`warm`·`베이지` 등)을 함께 명시했으면 사용자 말을 우선해 유지.
- **dominant + white**: 색을 무력화하는 조합이므로 `tinted`로 눌러 준다.

---

## 변주 축 (C)

| 축 | 값 | 강제 여부 |
|---|---|---|
| `container` | `boxed`(1200) / `wide`(1560) / `full-bleed` / `asymmetric` | **강제** |
| `surfaceStyle` | `flat` / `card` / `outlined` / `photoField` | `card`·`outlined`만 강제 |
| `columns` | `1`~`6` | advisory (변수만) |

`SectionTypeDefinition.geometry`가 타입별 허용 조합을 갖고, `normalizeSection`이 그 밖의 값을 되돌린다.
`featuredProducts`의 `columns`·`surfaceStyle`은 `productPresentation`이 소유하므로 열지 않는다.

---

## 보호선 (한 줄도 건드리지 않음)

- `HEADER_V1_CAFE24_TEMPLATE` · `renderHeaderV1` · `commerceCss`의 헤더 규칙 ·
  `headerTextToneCss` · `headerPresentationCss`
- `product-section-v1.ts`의 DOM · class · `module="product_listmain_1"` · `{$...}` 변수
- `verifiedProductLayoutCss`의 `.prdList` · `.prdList__item` · `.thumbnail` · `.description` ·
  `.spec` · `.icon` 규칙
- `lib/cafe24/protection.ts`의 보호 검사 및 `PRODUCT_SLOT_COUNT` 1개 제한
- `validateGeneratedDesignContract`의 violation 코드 목록 (재시도 증가 방지)

`planLayoutCss` / `brandThemeCss` 출력에 `.pocHeader` · `.prdList` · `.thumbnail` ·
`.ec-base-product` selector가 등장하지 않는 것을 테스트로 고정한다.

---

## 변경 파일

| 파일 | 내용 |
|---|---|
| `lib/commerce/brand-theme.ts` **(신규)** | hex → 램프, `deriveSecondary`, `surfaceTokens`, `brandThemeCss`, `footerBrandBackground`, `resolveProjectPalette` |
| `lib/design-library/plan-attributes.ts` **(신규)** | `applyPagePlanAttributes` — 직접 매칭 우선 · 앵커 fallback |
| `lib/design-library/plan-layout-css.ts` **(신규)** | `planLayoutCss` — container/tone/surface baseline과 HARD 경계 |
| `lib/design-library/page-plan.ts` | `palette` 스키마, 축 3종, accent 밴드 보장, monochrome·surfaceFamily 가드, 팔레트 계약 |
| `lib/design-library/section-registry.ts` | 축 vocabulary와 타입별 `geometry`, spec 산문 탈편향 |
| `lib/design-library/variants.ts` | Hero 6종 spec 재정의, `saturated-pop` / `bold-retail` 추가 |
| `lib/design-library/industry.ts` | 리테일 `categoryGrid` 위치 상향, pool 재정렬 |
| `lib/design-library/plan-composer.ts` | 대비 경로에서 palette·신규 축 조합 |
| `lib/openai/page-plan-contract.ts` | 색 면적 규칙, hero 배타성, 신규 축 지시 |
| `lib/openai/site-generator.ts` | hex 확정, `applyPagePlanAttributes` 호출, 변수 사용 지시, trace 지표 |
| `lib/openai/page-plan-generator.ts` | 사용자 hex·브리프를 정규화에 전달 |
| `lib/openai/dev-trace.ts` | `planAttributeMapping` · `brandColorUsage` 관측 필드 |
| `lib/editor/preview-document.ts` · `lib/cafe24/theme-package.ts` | Preview·Export 양쪽에 동일 주입 |
| `lib/cafe24/theme-bridge.ts` | 푸터 브랜드 배경 override 인자 |

---

## 검증 결과

### 자동 테스트

`npm test` — **397 tests / 395 pass**.
실패 2건(`editor-responsive`, `editor-style-intent`)은 이번 작업 이전부터 존재하며 무관하다
(clean 트리에서도 동일하게 실패). `tsc --noEmit` clean.

DOM 구현(jsdom 등)이 devDependencies에 없어 computed style 회귀 테스트는 `npm test`에 넣지 못했다.
대신 명시도 계산 · `!important` 배치 · 허용 property 목록 · `background` 축약형 금지를
정적으로 고정하고, 실제 브라우저에서 주입 실험으로 확인했다.

### 실제 AI 생성 3종 (동일 입력, attempt 각 1회)

| | 유아 `#D9A89A` | 식품 `#A94F37` | 라이프스타일 `#303030` |
|---|---|---|---|
| hero | product-forward | product-forward | banner-stack |
| colorStrategy | band | band | dominant |
| surfaceFamily | warm | warm | **dark** (정규화가 정정) |
| `--molive-surface` | `#f9f6f3` | `#f9f6f3` | `#1f1f1f` |
| accent 섹션 | 2 | 2 | 2 |
| attributeMapping | unmatched 0 | unmatched 0 | unmatched 0 |

### 브라우저 computed style 확인

모든 container 섹션에서 코드 값이 적용됐다(`boxed` → 192.5px = `max(24, (1585-1200)/2)`).
실제 AI CSS와 같은 스코프·명시도로 충돌 규칙을 주입해도 hard axis는 전부 유지됐다.

| 주입 | 실제 computed |
|---|---|
| accent `background-color:#00ff00` | 브랜드색 유지 |
| boxed `padding-inline:7px` | `192.5px` 유지 |
| full-bleed `padding-inline:99px` | `0px` 유지 |
| full-bleed 자식 `max-width:333px` | `none` 유지 |
| outlined `border-block:0` | `1px` 유지 |

반대로 `light` / `tinted` 폴백에 같은 방식으로 주입하면 AI가 이긴다(의도한 우선권).

Header는 3종 모두 `centered-brand`, export CSS에 `commerceCss` 원본 문자열이 그대로 포함되고
`.pocHeader` 규칙에 `--molive-` 참조가 없다. Preview ↔ Export는 `data-moire-plan` 수,
accent 규칙, container 규칙 수, 푸터 배경이 모두 일치한다.

---

## 2차 후속 항목

1. **상품 진열 블록 2~3개** — `product_listmain_2/3` 실기기 검증이 선행되어야 한다.
   `theme-template.ts`와 `product-section-v1.ts`가 이미 `moduleIndex`를 파라미터로 받는다.
   레퍼런스 대비 가장 큰 구조 격차다.
2. **`columns` 강제화** — `applyPagePlanAttributes`의 매핑 정확도를 더 모은 뒤,
   카드 컨테이너까지 도달하는 안전한 selector 전략이 서면 advisory → 강제로 승격.
   현재 3건 모두 `byId: 0`으로 앵커 fallback에 의존하고 있다(결과는 `unmatched: 0`).
3. **`register` 축** (`retail-dense` / `editorial-airy` / `playful-pop` / `technical-precise`).
4. **가로 rail / 캐러셀** — CSS scroll-snap 정적 rail로 JS 없이 우회 가능한지 검토.
5. **편집기 브랜드 컬러 변경 UI** — `--molive-brand` 도입으로 사후 색 교체가 한 값 변경이 된다.
   `duotone`의 2차 색 직접 지정도 여기서 함께 검토.
6. **`typeScale` / `header` 분산** — 3종이 여전히 `centered-brand`로 수렴한다. 1차에서는 범위 밖으로 두었다.
