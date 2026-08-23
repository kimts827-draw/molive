"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, Sparkles, WandSparkles, X } from "lucide-react";
import { optimizeImageFile, persistProjectAsset } from "@/lib/client-image";
import type { ProjectSource } from "@/lib/project-source";

type AttachedAsset = { id: string; kind: "logo" | "image"; name: string; url: string; storagePath?: string };

const initialPrompt = "차분한 올리브 컬러의 수제 가구 브랜드 쇼핑몰";

export function PromptComposer() {
  const router = useRouter();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [color, setColor] = useState("#6b6654");
  const [colorSelected, setColorSelected] = useState(false);
  const [assets, setAssets] = useState<AttachedAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [readingFiles, setReadingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addFiles(files: FileList | null, kind: AttachedAsset["kind"]) {
    if (!files?.length) return;
    setReadingFiles(true);
    setError(null);
    try {
      const available = kind === "logo" ? 1 : Math.max(0, 6 - assets.filter((asset) => asset.kind === "image").length);
      const selected = Array.from(files).slice(0, available);
      const next = await Promise.all(selected.map(async (file) => {
        const optimized = await optimizeImageFile(file);
        const stored = await persistProjectAsset(optimized, kind);
        return { id: crypto.randomUUID(), kind, name: file.name, url: stored?.url ?? optimized, storagePath: stored?.storagePath };
      }));
      setAssets((current) => kind === "logo"
        ? [...current.filter((asset) => asset.kind !== "logo"), ...next]
        : [...current, ...next].slice(0, 7));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "이미지를 추가하지 못했습니다.");
    } finally {
      setReadingFiles(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (prompt.trim().length < 10 || busy || readingFiles) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), colors: colorSelected ? [color] : [], assetUrls: assets.map((asset) => asset.url), assetPaths: assets.map((asset) => asset.storagePath ?? ""), assetRoles: assets.map((asset) => asset.kind === "logo" ? "logo" : "reference") }),
      });
      const payload = await response.json() as { source?: ProjectSource; rationale?: string; projectId?: string; versionId?: string; error?: string };
      if (!response.ok || !payload.source) throw new Error(payload.error ?? "디자인 생성에 실패했습니다.");
      if (payload.projectId) {
        router.push(`/editor?project=${encodeURIComponent(payload.projectId)}`);
      } else {
        sessionStorage.setItem("moire:generated-source", JSON.stringify(payload.source));
        if (payload.rationale) sessionStorage.setItem("moire:generated-rationale", payload.rationale);
        router.push("/editor");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "디자인 생성에 실패했습니다.");
      setBusy(false);
    }
  }

  return (
    <form className="prompt-composer" onSubmit={(event) => void submit(event)}>
      <label className="prompt-topline" htmlFor="home-design-prompt"><WandSparkles size={17} /><span>어떤 쇼핑몰을 만들까요?</span></label>
      <textarea id="home-design-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={2} aria-label="쇼핑몰 디자인 프롬프트" />
      {assets.length > 0 && <div className="home-asset-list">{assets.map((asset) => <span key={asset.id}><b>{asset.kind === "logo" ? "로고" : "이미지"}</b>{asset.name}<button type="button" onClick={() => setAssets((current) => current.filter((item) => item.id !== asset.id))} aria-label={`${asset.name} 제거`}><X size={11} /></button></span>)}</div>}
      {error && <p className="home-prompt-error">{error}</p>}
      <div className="prompt-actions">
        <div className="attachment-pills">
          <label>＋ 로고<input type="file" accept="image/*" onChange={(event) => { void addFiles(event.target.files, "logo"); event.target.value = ""; }} /></label>
          <label>＋ 이미지<input type="file" accept="image/*" multiple onChange={(event) => { void addFiles(event.target.files, "image"); event.target.value = ""; }} /></label>
          <label className={`brand-color-pill ${colorSelected ? "selected" : ""}`}><i style={{ background: color }} /> {colorSelected ? color : "브랜드 컬러"}<input type="color" value={color} onChange={(event) => { setColor(event.target.value); setColorSelected(true); }} /></label>
        </div>
        <button className="generate-button" type="submit" disabled={prompt.trim().length < 10 || busy || readingFiles}>
          {busy ? <><LoaderCircle size={15} className="spin" /> 디자인 생성 중</> : readingFiles ? <><LoaderCircle size={15} className="spin" /> 이미지 준비 중</> : <>디자인 생성 <ArrowRight size={16} /></>}
        </button>
      </div>
      <span className="prompt-secure-note"><Sparkles size={11} /> 첨부 자료를 브랜드 디자인에 반영합니다</span>
    </form>
  );
}
