"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Images, LayoutTemplate, LoaderCircle, MonitorSmartphone, PanelsTopLeft, Sparkles, WandSparkles, X } from "lucide-react";
import { createAssetSessionId, optimizeImageFile, persistProjectAsset } from "@/lib/client-image";
import type { ProjectSource } from "@/lib/project-source";
import { generationDestination } from "@/lib/projects/client-flow";

type AttachedAsset = { id: string; kind: "logo" | "image"; name: string; url: string; storagePath?: string };

const initialPrompt = "차분한 올리브 컬러의 수제 가구 브랜드 쇼핑몰";

const generationDraftKey = "moire:generation-draft";

const generationStages = [
  { message: "브랜드의 분위기를 분석하고 있어요", icon: Sparkles },
  { message: "쇼핑몰의 전체 구조를 설계하고 있어요", icon: LayoutTemplate },
  { message: "상품이 돋보이는 레이아웃을 만들고 있어요", icon: PanelsTopLeft },
  { message: "브랜드에 어울리는 비주얼을 준비하고 있어요", icon: Images },
  { message: "섹션별 디자인을 세밀하게 다듬고 있어요", icon: WandSparkles },
  { message: "PC와 모바일 화면의 균형을 맞추고 있어요", icon: MonitorSmartphone },
  { message: "마지막 디테일을 정리하고 있어요", icon: Sparkles },
  { message: "MOLIVE가 쇼핑몰을 완성하고 있어요", icon: WandSparkles },
] as const;

const generationTips = [
  "생성 후 Editor에서 글자와 색상을 직접 수정할 수 있어요",
  "마음에 들지 않는 부분은 AI에게 다시 수정 요청할 수 있어요",
  "완성된 디자인은 ZIP으로 내려받아 Cafe24에 적용할 수 있어요",
] as const;

const generationTipSequence = [0, 0, 1, 1, 2, 2, 0, 1] as const;

export function PromptComposer({ signedIn, creditBalance, persistenceEnabled, demoMode }: { signedIn: boolean; creditBalance: number | null; persistenceEnabled: boolean; demoMode: boolean }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [color, setColor] = useState("#6b6654");
  const [colorSelected, setColorSelected] = useState(false);
  const [assets, setAssets] = useState<AttachedAsset[]>([]);
  // 생성 요청 하나마다 새 이미지 세션을 씁니다. 이전 프로젝트 첨부가 다음 생성으로 넘어가지 않습니다.
  const [assetSessionId, setAssetSessionId] = useState(() => createAssetSessionId());
  const [busy, setBusy] = useState(false);
  const [readingFiles, setReadingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generationStage, setGenerationStage] = useState(0);

  useEffect(() => {
    const raw = sessionStorage.getItem(generationDraftKey);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as { prompt?: string; color?: string; colorSelected?: boolean };
      if (draft.prompt) setPrompt(draft.prompt);
      if (draft.color) setColor(draft.color);
      if (draft.colorSelected) setColorSelected(true);
    } catch { /* Ignore an invalid login-return draft. */ }
  }, []);

  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => {
      setGenerationStage((current) => (current + 1) % generationStages.length);
    }, 4_800);
    return () => window.clearInterval(timer);
  }, [busy]);

  /** 생성이 끝나면 첨부와 세션을 함께 비웁니다. 다음 프로젝트가 이번 이미지를 물려받지 않습니다. */
  function resetAssetSession() {
    setAssets([]);
    setAssetSessionId(createAssetSessionId());
  }

  function rememberDraft() {
    sessionStorage.setItem(generationDraftKey, JSON.stringify({ prompt, color, colorSelected }));
  }

  function goToLogin() {
    rememberDraft();
    router.push("/login?next=%2F%23create");
  }

  async function addFiles(files: FileList | null, kind: AttachedAsset["kind"]) {
    if (!files?.length) return;
    if (persistenceEnabled && !signedIn) { goToLogin(); return; }
    setReadingFiles(true);
    setError(null);
    try {
      const available = kind === "logo" ? 1 : Math.max(0, 6 - assets.filter((asset) => asset.kind === "image").length);
      const selected = Array.from(files).slice(0, available);
      const next = await Promise.all(selected.map(async (file) => {
        const optimized = await optimizeImageFile(file);
        const stored = await persistProjectAsset(optimized, kind, { sessionId: assetSessionId });
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
    if (persistenceEnabled && !signedIn) {
      goToLogin();
      return;
    }
    if (!persistenceEnabled && !demoMode) {
      setError("영구 저장 설정이 완료되지 않아 디자인을 생성할 수 없습니다.");
      return;
    }
    setGenerationStage(0);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), colors: colorSelected ? [color] : [], assetSessionId, assetUrls: assets.map((asset) => asset.url), assetPaths: assets.map((asset) => asset.storagePath ?? ""), assetRoles: assets.map((asset) => asset.kind === "logo" ? "logo" : "reference") }),
      });
      const payload = await response.json() as { source?: ProjectSource; rationale?: string; projectId?: string; versionId?: string; error?: string };
      const destination = generationDestination({ status: response.status, projectId: payload.projectId, persistenceEnabled });
      if (destination.kind === "login") { goToLogin(); return; }
      if (!response.ok || !payload.source) throw new Error(payload.error ?? "디자인 생성에 실패했습니다.");
      if (destination.kind === "project") {
        sessionStorage.removeItem(generationDraftKey);
        resetAssetSession();
        router.push(destination.href);
      } else if (destination.kind === "demo") {
        resetAssetSession();
        sessionStorage.setItem("moire:generated-source", JSON.stringify(payload.source));
        if (payload.rationale) sessionStorage.setItem("moire:generated-rationale", payload.rationale);
        router.push(destination.href);
      } else throw new Error(destination.message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "디자인 생성에 실패했습니다.");
      setBusy(false);
    }
  }

  return (
    <form className={`prompt-composer${busy ? " is-generating" : ""}`} aria-busy={busy} onSubmit={(event) => void submit(event)}>
      {busy ? <GenerationLoading stage={generationStage} /> : <>
      <label className="prompt-topline" htmlFor="home-design-prompt"><WandSparkles size={17} /><span>어떤 쇼핑몰을 만들까요?</span></label>
      <textarea id="home-design-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={2} aria-label="쇼핑몰 디자인 프롬프트" />
      {assets.length > 0 && <div className="home-asset-list">{assets.map((asset) => <span key={asset.id}><b>{asset.kind === "logo" ? "로고" : "이미지"}</b>{asset.name}<button type="button" onClick={() => setAssets((current) => current.filter((item) => item.id !== asset.id))} aria-label={`${asset.name} 제거`}><X size={11} /></button></span>)}</div>}
      <div className="prompt-credit"><span>AI 디자인 생성 10C</span>{signedIn && creditBalance !== null ? <Link href="/pricing">잔액 {creditBalance}C</Link> : null}</div>
      {error && <p className="home-prompt-error">{error}{error.includes("Credit") ? <> · <Link href="/pricing">Credit 충전</Link></> : null}</p>}
      {!persistenceEnabled && demoMode && <p className="home-prompt-demo">개발 데모 결과입니다. Editor를 닫거나 새로고침하면 수정 내용이 사라집니다.</p>}
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
      </>}
    </form>
  );
}

function GenerationLoading({ stage }: { stage: number }) {
  const current = generationStages[stage];
  const StageIcon = current.icon;
  const tip = generationTips[generationTipSequence[stage]];
  return <section className="generation-loading" role="status" aria-live="polite" aria-atomic="true">
    <div className="generation-icon-frame" key={`icon-${stage}`} aria-hidden="true"><StageIcon size={28} strokeWidth={1.7} /></div>
    <div className="generation-copy" key={`copy-${stage}`}>
      <span>MOLIVE DESIGN STUDIO</span>
      <h2>{current.message}</h2>
    </div>
    <div className="generation-progress" role="progressbar" aria-label="AI 디자인 생성 중"><i /></div>
    <p className="generation-wait">AI 디자인 생성에는 몇 분 정도 걸릴 수 있어요. 창을 닫지 말아주세요.</p>
    <p className="generation-tip" key={`tip-${tip}`}><Sparkles size={12} aria-hidden="true" /><span>{tip}</span></p>
  </section>;
}
