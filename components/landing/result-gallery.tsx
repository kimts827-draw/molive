"use client";

import Image from "next/image";
import { Maximize2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./landing-sales.module.css";

const resultSamples = [
  { category: "패션", mood: "감각적이고 여유로운 분위기", src: "/samples/landing/fashion.png", width: 1834, height: 7260, position: "50% 0%" },
  { category: "자동차용품", mood: "강하고 선명한 분위기", src: "/samples/landing/auto-care.png", width: 1834, height: 4016, position: "50% 0%" },
  { category: "인테리어", mood: "차분하고 따뜻한 분위기", src: "/samples/landing/interior-v2.png", width: 1834, height: 4710, position: "50% 0%" },
  { category: "뷰티", mood: "깨끗하고 부드러운 분위기", src: "/samples/landing/beauty.png", width: 1834, height: 5464, position: "50% 0%" },
] as const;

type ResultSample = (typeof resultSamples)[number];

export function ResultGallery() {
  const [selected, setSelected] = useState<ResultSample | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const closeLightbox = useCallback(() => {
    setSelected(null);
    window.requestAnimationFrame(() => openerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!selected) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeLightbox();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [closeLightbox, selected]);

  return <>
    <div className={styles.resultGrid}>
      {resultSamples.map((sample) => <article className={styles.resultCard} key={sample.category}>
        <div className={styles.resultBrowser}><i /><i /><i /><span>MOLIVE SAMPLE</span></div>
        <button
          className={styles.resultPreview}
          type="button"
          aria-label={`${sample.category} 쇼핑몰 디자인 전체 보기`}
          onClick={(event) => {
            openerRef.current = event.currentTarget;
            setSelected(sample);
          }}
        >
          <Image
            className={styles.resultPreviewImage}
            src={sample.src}
            alt={`${sample.category} MOLIVE 쇼핑몰 디자인 미리보기`}
            fill
            unoptimized
            sizes="(max-width: 980px) calc(100vw - 16px), 50vw"
            style={{ objectPosition: sample.position }}
          />
          <span className={styles.resultView}><Maximize2 size={15} /> 전체 보기</span>
        </button>
        <footer><strong>{sample.category}</strong><span>{sample.mood}</span></footer>
      </article>)}
    </div>

    {selected ? <div
      className={styles.lightbox}
      role="dialog"
      aria-modal="true"
      aria-label={`${selected.category} 쇼핑몰 디자인 전체 보기`}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeLightbox();
      }}
    >
      <div className={styles.lightboxPanel}>
        <div className={styles.lightboxToolbar}>
          <strong>{selected.category}</strong>
          <span>전체 쇼핑몰 디자인</span>
          <button ref={closeRef} type="button" onClick={closeLightbox} aria-label="전체 보기 닫기"><X size={22} /></button>
        </div>
        <Image
          className={styles.lightboxImage}
          src={selected.src}
          alt={`${selected.category} MOLIVE 쇼핑몰 전체 디자인`}
          width={selected.width}
          height={selected.height}
          unoptimized
          sizes="(max-width: 720px) 100vw, 1180px"
        />
      </div>
    </div> : null}
  </>;
}
