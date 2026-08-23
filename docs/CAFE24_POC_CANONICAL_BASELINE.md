# Cafe24 deterministic POC canonical baseline

## 동결 범위

사용자가 실제 Cafe24 몰에서 정상 동작을 확인한 `lib/cafe24/poc/theme-poc.ts`의 다음 세 출력을 `cafe24-live-verified-deterministic-poc-v1`로 동결한다.

1. `HEADER_V1`
2. `productGridV1(1, 8)`
3. `POC_CSS`

위 출력의 HTML, CSS, Cafe24 module, Cafe24 variable, class, 순서, 중첩 구조는 실몰 재검증 없이 변경하지 않는다. `fixed-components.ts`는 canonical source가 아니다.

Golden fixture:

- `tests/fixtures/cafe24-poc-header-v1.html`
- `tests/fixtures/cafe24-poc-product-grid-v1.html`
- `tests/fixtures/cafe24-poc-v1.css`
- `tests/fixtures/cafe24-poc-canonical-v1.json`

## Canonical hash

| Artifact | SHA-256 | UTF-8 bytes |
|---|---|---:|
| HeaderV1 | `18293749de97980d3903ccd830bb21ebb619579aa1d01fb1d17705dd0b81dc08` | 1123 |
| ProductGridV1 | `dd941c8cefd0ab8fde4e4f82d68dffd9564b218099c1df4f5f6c6322e302561c` | 675 |
| POC_CSS | `11e449bec36be5c0d50644cf989cbabae59fb0cacf20e5b5e0b25ee713593726` | 2324 |

## `fixed-components.ts`와의 비교

비교 기준은 `renderHeaderV1("cafe24")`, `renderProductGridV1("cafe24", { moduleIndex: 1, count: 8 })`, `commerceCss()`이다.

| 영역 | 결과 | 정확한 차이 |
|---|---|---|
| Header HTML | canonical과 byte-for-byte 동일 | 없음. SHA-256도 `18293749...dc08`로 동일 |
| Product root marker | 다름 | POC는 `data-poc-grid="v1"`, fixed는 `data-moire-commerce="product-grid-v1"` |
| Product title | 다름 | POC는 `<h2 class="pocGrid__title">PRODUCT GRID V1</h2>`를 항상 출력. fixed는 `title` option이 없으면 title DOM을 출력하지 않음 |
| Product links | 다름 | POC는 image/name을 link로 감싸지 않음. fixed는 두 위치에 `href="{$link_product_detail}"` anchor를 추가 |
| Product module | 동일 | 둘 다 `module="product_listmain_1"`, `$count = 8`, `$moreview = no`, `$cache = no` |
| Product variables | fixed가 1종을 추가 | POC의 7개 variable은 유지되지만 fixed는 `{$link_product_detail}`을 2회 추가 |
| Product class | 고유 class set은 동일 | anchor 추가와 title 생략으로 DOM 구조는 다름 |
| CSS source | 다름 | POC는 고정값. fixed는 token interpolation, 확장 font stack, inherited colors, radius, object-position, product link rule, variant rule을 추가 |
| CSS selector | fixed가 확장 | fixed에 preview logo text용 `.pocHeader__logoText`와 `.pocGrid__name a` 규칙이 추가 |

Observed non-canonical hash:

| Artifact | SHA-256 |
|---|---|
| fixed ProductGridV1 Cafe24 output | `4693147293147b5993e7ee8a22b08105ff350d525a099a5573d80bc5b1b9e62a` |
| fixed default commerce CSS | `f9223e59ed30986a0ecbf401c229971e81b32545ee349af7d0aeac6bdaee6dd3` |

## 판정

- Header Cafe24 output은 canonical과 동일하므로 차이가 없다.
- fixed ProductGrid의 상품 상세 link, root marker, title 처리는 실몰 재검증 전까지 canonical에 합치지 않는다.
- fixed CSS의 tokenization과 추가 규칙도 실몰 재검증 전까지 canonical CSS가 아니다.
- canonical 변경이 필요하면 실몰 재검증, fixture 교체, hash 갱신, 차이 문서 갱신을 하나의 변경으로 처리한다.
