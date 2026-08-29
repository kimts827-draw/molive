"use client";

import Link from "next/link";
import { Check, Copy, Maximize2, PenLine } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ResourceNav } from "@/components/resources/resource-nav";
import { TemplateLightbox } from "@/components/templates/template-lightbox";
import { resourceBoard } from "@/lib/resources/board";
import type { ResourcePost } from "@/lib/resources/service";
import boardStyles from "./resource-board.module.css";
import styles from "./template-board.module.css";
import lightboxStyles from "@/components/templates/template-lightbox.module.css";

const meta = resourceBoard("template");

export function TemplateBoard({ templates, canManage }: { templates: ResourcePost[]; canManage: boolean }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ResourcePost | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  const closeLightbox = useCallback(() => setSelected(null), []);

  useEffect(() => () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
  }, []);

  async function copyPrompt(id: string, prompt: string) {
    await navigator.clipboard.writeText(prompt);
    setCopiedId(id);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => setCopiedId(null), 1800);
  }

  return (
    <main className={styles.page}>
      <ResourceNav current="template" />

      <header className={styles.hero}>
        <span>RESOURCES / TEMPLATES</span>
        <h1>템플릿</h1>
        <p>다양한 업종의 완성 예시와 브랜드 컬러, 생성 프롬프트를 확인하고<br />내 쇼핑몰을 위한 출발점으로 활용해보세요.</p>
        <div><strong>{templates.length}</strong><span>개의 템플릿</span></div>
      </header>

      {canManage ? <div className={boardStyles.adminBar}>
        <span>관리자 계정으로 로그인되어 있습니다.</span>
        <Link className={boardStyles.writeButton} href="/templates/new"><PenLine size={14} /> 글쓰기</Link>
      </div> : null}

      {templates.length ? <section className={styles.grid} aria-label="템플릿 목록">
        {templates.map((template) => {
          const copied = copiedId === template.id;
          return (
            <article className={styles.card} key={template.id}>
              <button
                className={styles.imageFrame}
                type="button"
                aria-label={`${template.title} 전체 보기`}
                onClick={(event) => {
                  openerRef.current = event.currentTarget;
                  setSelected(template);
                }}
              >
                <img src={template.imageUrl} alt={`${template.title} 쇼핑몰 템플릿`} loading="lazy" />
                <span>{template.category}</span>
                <strong className={styles.previewAction}><Maximize2 size={15} /> 전체보기</strong>
              </button>

              <div className={styles.content}>
                <div className={styles.heading}>
                  <div><span>{template.summary}</span><h2>{template.title}</h2></div>
                  <div className={styles.color} title={`브랜드 컬러 ${template.brandColor}`}>
                    <i style={{ backgroundColor: template.brandColor }} />
                    <span>BRAND COLOR</span>
                    <strong>{template.brandColor}</strong>
                  </div>
                </div>

                <div className={styles.prompt}>
                  <div><span>생성 프롬프트</span><small>이 문장을 복사해 원하는 내용으로 바꿔보세요.</small></div>
                  <p>{template.prompt}</p>
                  <button type="button" onClick={() => void copyPrompt(template.id, template.prompt)}>
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                    {copied ? "복사 완료" : "프롬프트 복사"}
                  </button>
                </div>

                {canManage ? <div className={styles.manage}><Link href={`/templates/${template.id}/edit`}>수정</Link></div> : null}
              </div>
            </article>
          );
        })}
      </section> : <div className={boardStyles.empty}><p>{meta.empty}</p></div>}

      <TemplateLightbox
        open={Boolean(selected)}
        category={selected?.category ?? ""}
        ariaLabel={`${selected?.title ?? "템플릿"} 전체 보기`}
        openerRef={openerRef}
        onClose={closeLightbox}
      >
        {selected ? <img className={lightboxStyles.image} src={selected.imageUrl} alt={`${selected.title} 쇼핑몰 전체 디자인`} /> : null}
      </TemplateLightbox>
    </main>
  );
}
