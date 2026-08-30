"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ResourceNav } from "@/components/resources/resource-nav";
import { resourceBoard, type ResourceBoardKey } from "@/lib/resources/board";
import { RESOURCE_IMAGE_ACCEPT } from "@/lib/resources/assets";
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
  const [uploading, setUploading] = useState(false);
  /** 업로드가 끝나기 전까지만 쓰는 로컬 미리보기 주소입니다. */
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const savedImageUrl = post?.imageUrl ?? "";
  const previewUrl = localPreview ?? draft.imageUrl;

  // 남아 있는 objectURL은 화면을 떠날 때 회수합니다.
  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function replaceLocalPreview(next: string | null) {
    setLocalPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return next;
    });
  }

  async function pickImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setUploading(true);
    replaceLocalPreview(URL.createObjectURL(file));
    try {
      const body = new FormData();
      body.append("board", board);
      body.append("file", file);
      const response = await fetch("/api/resources/uploads", { method: "POST", body });
      const result = await response.json() as { imageUrl?: string; error?: string };
      if (!response.ok || !result.imageUrl) throw new Error(result.error ?? "이미지를 업로드하지 못했습니다.");
      update("imageUrl", result.imageUrl);
      replaceLocalPreview(null);
    } catch (reason) {
      replaceLocalPreview(null);
      setError(reason instanceof Error ? reason.message : "이미지를 업로드하지 못했습니다.");
    } finally {
      setUploading(false);
    }
  }

  /** 저장 전에는 언제든 원래 이미지로 되돌릴 수 있습니다. 저장하지 않고 나가도 기존 이미지는 그대로입니다. */
  function restoreImage() {
    replaceLocalPreview(null);
    update("imageUrl", savedImageUrl);
    setError(null);
  }

  function payload() {
    if (isTemplate) {
      return { title: draft.title, summary: draft.summary, category: draft.category, brandColor: draft.brandColor.toUpperCase(), prompt: draft.prompt, imageUrl: draft.imageUrl };
    }
    return { title: draft.title, summary: draft.summary, content: draft.content, imageUrl: draft.imageUrl.trim() ? draft.imageUrl : null };
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isTemplate && !draft.imageUrl) {
      setError("대표 이미지를 선택해 주세요.");
      return;
    }
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

        <div className={styles.imageField}>
          <span className={styles.fieldLabel}>대표 이미지{isTemplate ? "" : " (선택)"}</span>
          <div className={styles.imagePreview}>
            {previewUrl
              ? <img src={previewUrl} alt="대표 이미지 미리보기" />
              : <p>선택된 이미지가 없습니다.</p>}
            {uploading ? <span className={styles.imageBadge}>업로드 중...</span> : null}
          </div>
          <input
            ref={fileInputRef}
            className={styles.fileInput}
            type="file"
            accept={RESOURCE_IMAGE_ACCEPT}
            onChange={(event) => void pickImage(event)}
          />
          <div className={styles.imageActions}>
            <button type="button" disabled={uploading || busy} onClick={() => fileInputRef.current?.click()}>
              {uploading ? "업로드 중..." : draft.imageUrl ? "이미지 변경" : "이미지 선택"}
            </button>
            {localPreview || draft.imageUrl !== savedImageUrl
              ? <button className={styles.ghost} type="button" disabled={uploading || busy} onClick={restoreImage}>
                {savedImageUrl ? "원래 이미지로 되돌리기" : "선택 취소"}
              </button>
              : null}
          </div>
          <small>PC에서 이미지를 고르면 바로 업로드됩니다. PNG · JPG · WebP · AVIF, 10MB 이하. 저장하지 않고 나가면 기존 이미지가 그대로 유지됩니다.</small>
        </div>

        {error ? <p className={styles.error} role="alert">{error}</p> : null}

        <div className={styles.actions}>
          <button type="submit" disabled={busy || uploading}>{busy ? "저장 중..." : post ? "수정 저장" : "등록"}</button>
          <Link href={meta.href}>취소</Link>
          {post ? <button className={styles.danger} type="button" disabled={busy} onClick={() => void remove()}>삭제</button> : null}
        </div>
      </form>
    </section>
  </main>;
}
