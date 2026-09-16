/**
 * 이 몰이 쓸 폰트를 코드가 확정합니다.
 *
 * 폰트는 hero·header·진열·팔레트와 달리 오랫동안 2단계 모델의 자유 선택이었고, 그 결과
 * 브리프가 달라도 목록 첫 항목인 Pretendard로 수렴했습니다(타이포 스케일 계약이 "시스템
 * 산세리프"를 지시하던 것도 같은 방향으로 밀었습니다). 그래서 팔레트와 같은 규칙을 씁니다.
 * plan이 진실이고, 2단계는 그 값을 시공합니다.
 *
 * 고르는 기준은 두 가지뿐입니다.
 * 1) 업종 — 업종 프로필이 그 카테고리에서 통하는 본문 폰트 풀을 가집니다.
 * 2) plan이 이미 정한 타이포 스케일 — serif-display면 세리프, sans-modern이면 고딕처럼
 *    스케일 설명과 폰트 분류가 어긋나지 않게 풀을 한 번 더 좁힙니다.
 * 같은 브리프는 같은 폰트를, 다른 업종·다른 스케일은 다른 폰트를 결정적으로 얻습니다.
 *
 * display 계열(검은고딕·주아)은 본문에 쓰면 읽기가 무너지므로 본문 풀에 넣지 않고,
 * 본문이 대비를 스스로 만들지 못하는 고딕·라운드일 때만 제목용으로 한 벌 더 얹습니다.
 */

import { STOREFRONT_FONTS, type StorefrontFontCategory, type StorefrontFontId } from "../fonts/storefront-fonts.ts";
import type { IndustryProfile } from "./industry.ts";
import type { TypeScaleId } from "./variants.ts";

/** 시드 고정 시 같은 plan이 나오는 결정적 RNG(mulberry32)입니다. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 브리프 문자열에서 안정적인 시드를 만듭니다. 같은 브리프는 같은 선택을 얻습니다. */
export function briefSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const FONT_CATEGORY = new Map<StorefrontFontId, StorefrontFontCategory>(STOREFRONT_FONTS.map((font) => [font.id, font.category]));

/**
 * 타이포 스케일이 선호하는 폰트 분류입니다. 앞에 있는 분류부터 찾고,
 * 업종 풀에 그 분류가 하나도 없으면 다음 분류로, 끝까지 없으면 업종 풀 전체를 씁니다.
 */
const TYPE_SCALE_CATEGORIES: Record<TypeScaleId, readonly StorefrontFontCategory[]> = {
  "serif-display": ["serif"],
  "sans-modern": ["gothic"],
  "rounded-warm": ["rounded", "serif"],
  "bold-retail": ["gothic", "rounded"],
};

export type PlanTypography = {
  /** 본문과 페이지 기본 타이포에 쓰는 폰트 id입니다. */
  bodyFont: StorefrontFontId;
  /** 제목에만 쓰는 폰트 id입니다. 본문이 이미 대비를 만들면 비어 있습니다. */
  displayFont?: StorefrontFontId;
};

function narrow(pool: readonly StorefrontFontId[], categories: readonly StorefrontFontCategory[]) {
  for (const category of categories) {
    const matches = pool.filter((id) => FONT_CATEGORY.get(id) === category);
    if (matches.length) return matches;
  }
  return pool;
}

function choose<T>(values: readonly T[], random: () => number): T {
  return values[Math.min(values.length - 1, Math.floor(random() * values.length))];
}

export function resolvePlanTypography(profile: IndustryProfile, typeScale: TypeScaleId, random: () => number): PlanTypography {
  const bodyFont = choose(narrow(profile.bodyFontPool, TYPE_SCALE_CATEGORIES[typeScale]), random);
  const bodyCategory = FONT_CATEGORY.get(bodyFont);
  // 세리프 본문은 그 자체로 제목 대비를 만듭니다. 제목 폰트를 더 얹으면 인상만 흐려집니다.
  const wantsDisplay = bodyCategory === "gothic" || bodyCategory === "rounded";
  const displayFont = wantsDisplay && profile.displayFontPool.length ? choose(profile.displayFontPool, random) : undefined;
  return displayFont ? { bodyFont, displayFont } : { bodyFont };
}
