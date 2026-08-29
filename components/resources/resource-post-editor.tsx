"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ResourceNav } from "@/components/resources/resource-nav";
import { resourceBoard, type ResourceBoardKey } from "@/lib/resources/board";
import type { ResourcePost } from "@/lib/resources/service";
import boardStyles from "./resource-board.module.css";
import styles from "./resource-post-editor.module.css";

type Draft = { title: string; summary: string; content: string; category: string; brandColor: string; prompt: string; imageUrl: string };

function initialDraft(post: ResourcePost | null): Draft {
  return {
    title: post?.title ?? "",
    summary: post?.summary ?? "",
    content: post?.content ?? "",
    category: post?.category ?? "",
    brandColor: post?.brandColor ?? "#655BDD",
    prompt: post?.prompt ?? "",
    imageUrl: post?.imageUrl ?? "",
  };
}

export function ResourcePostEditor({ board, post }: { board: ResourceBoardKey; post: ResourcePost | null }) {
  const meta = resourceBoard(board);
  const isTemplate = board === "template";
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => initialDraft(post));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function payload() {
    if (isTemplate) {
      return { title: draft.title, summary: draft.summary, category: draft.category, brandColor: draft.brandColor.toUpperCase(), prompt: draft.prompt, imageUrl: draft.imageUrl };
    }
    return { title: draft.title, summary: draft.summary, content: draft.content, imageUrl: draft.imageUrl.trim() ? draft.imageUrl : null };
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(post ? `/api/resources/${board}/${post.id}` : `/api/resources/${board}`, {
        method: post ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const result = await response.json() as { post?: ResourcePost; error?: string };
      if (!response.ok) throw new Error(result.error ?? "게시글을 저장하지 못했습니다.");
      const saved = result.post;
      router.push(isTemplate || !saved ? meta.href : `${meta.href}/${saved.id}`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "게시글을 저장하지 못했습니다.");
      setBusy(false);
    }
  }

  async function remove() {
    if (!post || !window.confirm("이 게시글을 삭제할까요?")) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/resources/${board}/${post.id}`, { method: "DELETE" });
      if (!response.ok) {
        const result = await response.json() as { error?: string };
        throw new Error(result.error ?? "게시글을 삭제하지 못했습니다.");
      }
      router.push(meta.href);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "게시글을 삭제하지 못했습니다.");
      setBusy(false);
    }
  }

  return <main className={boardStyles.page}>
    <ResourceNav current={board} />
    <section className={styles.shell}>
      <span>{meta.eyebrow} · ADMIN</span>
      <h1>{meta.label} {post ? "수정" : "글쓰기"}</h1>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <label>제목<input required maxLength={160} value={draft.title} onChange={(event) => update("title", event.target.value)} /></label>

        <label>{isTemplate ? "분위기 한 줄 설명" : "요약"}
          <input maxLength={300} value={draft.summary} onChange={(event) => update("summary", event.target.value)} placeholder={isTemplate ? "포근하고 부드러운 분위기" : "목록에 노출되는 한 줄 요약"} />
        </label>

        {isTemplate ? <>
          <label>카테고리<input required maxLength={60} value={draft.category} onChange={(event) => update("category", event.target.value)} placeholder="유아동 / 베이비" /></label>
          <div className={styles.colorRow}>
            <label>브랜드 컬러
              <input required pattern="#[0-9A-Fa-f]{6}" maxLength={7} value={draft.brandColor} onChange={(event) => update("brandColor", event.target.value)} placeholder="#D8C3A9" />
            </label>
            <input aria-label="브랜드 컬러 선택" type="color" value={/^#[0-9A-Fa-f]{6}$/.test(draft.brandColor) ? draft.brandColor : "#655BDD"} onChange={(event) => update("brandColor", event.target.value.toUpperCase())} />
          </div>
          <label>프롬프트
            <textarea required maxLength={4000} rows={7} value={draft.prompt} onChange={(event) => update("prompt", event.target.value)} placeholder="이 템플릿을 만들 때 사용한 생성 프롬프트" />
          </label>
        </> : <label>본문
          <textarea required maxLength={20000} rows={16} value={draft.content} onChange={(event) => update("content", event.target.value)} />
        </label>}

        <label>대표 이미지{isTemplate ? "" : " (선택)"}
          <input required={isTemplate} maxLength={500} value={draft.imageUrl} onChange={(event) => update("imageUrl", event.target.value)} placeholder="/templates/baby.png 또는 https://..." />
          <small>public 폴더 경로(/로 시작) 또는 https:// URL을 입력하세요.</small>
        </label>

        {error ? <p className={styles.error} role="alert">{error}</p> : null}

        <div className={styles.actions}>
          <button type="submit" disabled={busy}>{busy ? "저장 중..." : post ? "수정 저장" : "등록"}</button>
          <Link href={meta.href}>취소</Link>
          {post ? <button className={styles.danger} type="button" disabled={busy} onClick={() => void remove()}>삭제</button> : null}
        </div>
      </form>
    </section>
  </main>;
}
