"use client";

import Image from "next/image";
import { Maximize2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { TemplateLightbox } from "@/components/templates/template-lightbox";
import { templateCatalog, type TemplateItem } from "@/lib/templates/catalog";
import styles from "./landing-sales.module.css";
import lightboxStyles from "@/components/templates/template-lightbox.module.css";

export function ResultGallery() {
  const [selected, setSelected] = useState<TemplateItem | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  const closeLightbox = useCallback(() => {
    setSelected(null);
  }, []);

  return <>
    <div className={styles.resultGrid}>
      {templateCatalog.map((sample) => <article className={styles.resultCard} key={sample.id}>
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
            src={sample.image.src}
            alt={`${sample.category} MOLIVE 쇼핑몰 디자인 미리보기`}
            fill
            unoptimized
            sizes="(max-width: 980px) calc(100vw - 16px), 50vw"
            style={{ objectPosition: sample.image.position }}
          />
          <span className={styles.resultView}><Maximize2 size={15} /> 전체 보기</span>
        </button>
        <footer><strong>{sample.category}</strong><span>{sample.mood}</span></footer>
      </article>)}
    </div>

    <TemplateLightbox
      open={Boolean(selected)}
      category={selected?.category ?? ""}
      ariaLabel={`${selected?.category ?? "템플릿"} 쇼핑몰 디자인 전체 보기`}
      openerRef={openerRef}
      onClose={closeLightbox}
    >
      {selected ? (
        <Image
          className={lightboxStyles.image}
          src={selected.image.src}
          alt={`${selected.category} MOLIVE 쇼핑몰 전체 디자인`}
          width={selected.image.width}
          height={selected.image.height}
          unoptimized
          sizes="(max-width: 720px) 100vw, 1180px"
        />
      ) : null}
    </TemplateLightbox>
  </>;
}
