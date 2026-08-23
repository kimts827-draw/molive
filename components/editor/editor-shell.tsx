"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Copy, Eye, EyeOff, GripVertical, History, ImagePlus, LoaderCircle, Monitor, Plus, Redo2, Save, Send, Smartphone, Sparkles, Tablet, Trash2, Undo2, X } from "lucide-react";
import { Brand } from "@/components/brand";
import { EditorCanvas } from "@/components/editor/editor-canvas";
import { PublishModal } from "@/components/editor/publish-modal";
import { optimizeImageFile, persistProjectAsset } from "@/lib/client-image";
import { cloneProjectSource, type EditorNodeSelection, type ProjectSource } from "@/lib/project-source";

type Viewport = "desktop" | "tablet" | "mobile";
type ChatMessage = { id: string; role: "assistant" | "user"; text: string };
type SavedVersion = { id: string; label: string; createdAt: string; source: ProjectSource };
type NodeSnapshot = EditorNodeSelection & {
  text: string;
  href: string;
  src: string;
  alt: string;
  style: Record<string, string>;
  outerHtml: string;
  sectionId: string | null;
};
type RegionSummary = { id: string; type: string; label: string; hidden: boolean };

function parseSource(html: string) {
  if (typeof DOMParser === "undefined") return null;
  return new DOMParser().parseFromString(html, "text/html");
}

function findByMoireId(document: Document, id: string) {
  return [...document.querySelectorAll<HTMLElement>("[data-moire-id]")].find((node) => node.dataset.moireId === id) ?? null;
}

function serializeProjectHtml(document: Document) {
  const root = document.querySelector<HTMLElement>("[data-moire-root]");
  if (!root) throw new Error("Project Source 루트를 찾지 못했습니다.");
  return root.outerHTML;
}

function sourceRootValue(html: string) {
  return html.match(/data-moire-root\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
}

function editableText(node: HTMLElement) {
  const clone = node.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  return clone.textContent?.trim() ?? "";
}

function readNode(source: ProjectSource, selection: EditorNodeSelection | null): NodeSnapshot | null {
  if (!selection) return null;
  const document = parseSource(source.html);
  const node = document ? findByMoireId(document, selection.id) : null;
  if (!node) return null;
  const style: Record<string, string> = {};
  for (const property of ["color", "backgroundColor", "fontFamily", "fontSize", "fontWeight", "textAlign", "paddingTop", "paddingBottom", "maxWidth", "display"]) style[property] = node.style.getPropertyValue(property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`));
  const section = node.closest<HTMLElement>("section");
  return {
    ...selection,
    tagName: node.tagName.toLowerCase(),
    type: node.dataset.moireType || selection.type,
    text: node.tagName === "IMG" ? "" : editableText(node),
    href: node.getAttribute("href") ?? "",
    src: node.getAttribute("src") ?? "",
    alt: node.getAttribute("alt") ?? "",
    style,
    outerHtml: node.outerHTML,
    sectionId: section?.dataset.moireId ?? null,
  };
}

function listRegions(html: string): RegionSummary[] {
  const document = parseSource(html);
  if (!document) return [];
  const root = document.querySelector<HTMLElement>("[data-moire-root]");
  if (!root) return [];
  const nodes = [
    root.querySelector<HTMLElement>(":scope > header[data-moire-id]"),
    ...root.querySelectorAll<HTMLElement>(":scope > main > section[data-moire-id]"),
    root.querySelector<HTMLElement>(":scope > footer[data-moire-id]"),
  ].filter((node): node is HTMLElement => Boolean(node));
  return nodes.map((node, index) => ({
    id: node.dataset.moireId || `region-${index}`,
    type: node.dataset.moireType || node.tagName.toLowerCase(),
    label: node.getAttribute("aria-label") || node.querySelector("h1,h2,h3")?.textContent?.trim().slice(0, 38) || `${node.tagName.toLowerCase()} ${index + 1}`,
    hidden: node.dataset.moireHidden === "true" || node.style.display === "none",
  }));
}

function replaceNode(source: ProjectSource, nodeId: string, nodeHtml: string, nodeCss: string) {
  const document = parseSource(source.html);
  const current = document ? findByMoireId(document, nodeId) : null;
  if (!document || !current) throw new Error("선택한 노드를 Project Source에서 찾지 못했습니다.");
  const template = document.createElement("template");
  template.innerHTML = nodeHtml.trim();
  const replacement = template.content.firstElementChild;
  if (!replacement || template.content.children.length !== 1) throw new Error("AI patch는 하나의 루트 노드여야 합니다.");
  current.replaceWith(replacement);
  const escaped = nodeId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const marker = new RegExp(`/\\* MOIRE:NODE:${escaped}:START \\*/[\\s\\S]*?/\\* MOIRE:NODE:${escaped}:END \\*/`, "g");
  const block = `/* MOIRE:NODE:${nodeId}:START */\n${nodeCss.trim()}\n/* MOIRE:NODE:${nodeId}:END */`;
  const css = marker.test(source.css) ? source.css.replace(marker, block) : `${source.css.trim()}\n\n${block}`;
  return { ...source, html: serializeProjectHtml(document), css, updatedAt: new Date().toISOString() };
}

export function EditorShell({ initialSource, projectId = null, initialVersions = [], currentVersionId = null }: { initialSource: ProjectSource; projectId?: string | null; initialVersions?: SavedVersion[]; currentVersionId?: string | null }) {
  const [hydrated, setHydrated] = useState(false);
  const [source, setSource] = useState(() => cloneProjectSource(initialSource));
  const [selection, setSelection] = useState<EditorNodeSelection | null>(null);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [leftPanel, setLeftPanel] = useState<"sections" | "ai">("sections");
  const [rightOpen, setRightOpen] = useState(true);
  const [past, setPast] = useState<ProjectSource[]>([]);
  const [future, setFuture] = useState<ProjectSource[]>([]);
  const [versions, setVersions] = useState<SavedVersion[]>(initialVersions);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(currentVersionId);
  const [persistBusy, setPersistBusy] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: "hello", role: "assistant", text: "캔버스나 섹션 목록에서 영역을 선택한 뒤 원하는 변화를 말해 주세요. 선택한 HTML/CSS 범위만 수정합니다." }]);
  const sourceRef = useRef(source);
  const pastRef = useRef(past);
  const futureRef = useRef(future);
  const historyGroupRef = useRef<string | null>(null);
  const historyTimerRef = useRef<number | null>(null);

  const regions = useMemo(() => hydrated ? listRegions(source.html) : [], [hydrated, source.html]);
  const selectedNode = useMemo(() => hydrated ? readNode(source, selection) : null, [hydrated, source, selection]);

  const closeHistoryGroup = useCallback(() => {
    historyGroupRef.current = null;
    if (historyTimerRef.current !== null) window.clearTimeout(historyTimerRef.current);
    historyTimerRef.current = null;
  }, []);

  const commit = useCallback((next: ProjectSource, historyKey?: string) => {
    const current = sourceRef.current;
    if (next.html === current.html && next.css === current.css && next.name === current.name) return;
    if (!historyKey || historyGroupRef.current !== historyKey) {
      pastRef.current = [...pastRef.current.slice(-49), current];
      setPast(pastRef.current);
    }
    futureRef.current = [];
    setFuture([]);
    sourceRef.current = next;
    setSource(next);
    if (historyKey) {
      historyGroupRef.current = historyKey;
      if (historyTimerRef.current !== null) window.clearTimeout(historyTimerRef.current);
      historyTimerRef.current = window.setTimeout(closeHistoryGroup, 900);
    } else closeHistoryGroup();
  }, [closeHistoryGroup]);

  const mutateNode = useCallback((nodeId: string, mutate: (node: HTMLElement) => void, historyKey?: string) => {
    const current = sourceRef.current;
    const document = parseSource(current.html);
    const node = document ? findByMoireId(document, nodeId) : null;
    if (!document || !node) return;
    mutate(node);
    commit({ ...current, html: serializeProjectHtml(document), updatedAt: new Date().toISOString() }, historyKey);
  }, [commit]);

  const undo = useCallback(() => {
    const previous = pastRef.current.at(-1);
    if (!previous) return;
    closeHistoryGroup();
    futureRef.current = [sourceRef.current, ...futureRef.current].slice(0, 50);
    pastRef.current = pastRef.current.slice(0, -1);
    sourceRef.current = previous;
    setFuture(futureRef.current); setPast(pastRef.current); setSource(previous);
  }, [closeHistoryGroup]);

  const redo = useCallback(() => {
    const next = futureRef.current[0];
    if (!next) return;
    closeHistoryGroup();
    pastRef.current = [...pastRef.current, sourceRef.current].slice(-50);
    futureRef.current = futureRef.current.slice(1);
    sourceRef.current = next;
    setPast(pastRef.current); setFuture(futureRef.current); setSource(next);
  }, [closeHistoryGroup]);

  useEffect(() => {
    setHydrated(true);
    const raw = projectId ? null : sessionStorage.getItem("moire:generated-source");
    if (raw) {
      try {
        const generated = JSON.parse(raw) as ProjectSource;
        pastRef.current = [sourceRef.current];
        sourceRef.current = generated;
        setPast(pastRef.current); setSource(generated);
        const rationale = sessionStorage.getItem("moire:generated-rationale");
        if (rationale) setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", text: rationale }]);
        setToast("새 Project Source를 그대로 불러왔습니다");
      } catch { setToast("생성 결과를 불러오지 못했습니다"); }
      sessionStorage.removeItem("moire:generated-source");
      sessionStorage.removeItem("moire:generated-rationale");
    }
  }, [projectId]);

  useEffect(() => {
    if (!hydrated || !projectId) return;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: sourceRef.current }),
        });
        if (!response.ok) throw new Error();
      } catch { setToast("Project Source 자동 저장에 실패했습니다"); }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [hydrated, projectId, source]);

  useEffect(() => {
    if (!selection && regions[0]) setSelection({ id: regions[0].id, type: regions[0].type, tagName: regions[0].type });
  }, [regions, selection]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, undo]);

  useEffect(() => () => closeHistoryGroup(), [closeHistoryGroup]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 2600); return () => window.clearTimeout(timer); }, [toast]);

  function updateText(value: string) {
    if (!selectedNode) return;
    mutateNode(selectedNode.id, (node) => {
      node.replaceChildren();
      value.split("\n").forEach((line, index) => {
        if (index > 0) node.appendChild(node.ownerDocument.createElement("br"));
        node.appendChild(node.ownerDocument.createTextNode(line));
      });
    }, `node:${selectedNode.id}:text`);
  }

  function updateAttribute(name: string, value: string) {
    if (!selectedNode) return;
    mutateNode(selectedNode.id, (node) => node.setAttribute(name, value), `node:${selectedNode.id}:attr:${name}`);
  }

  function updateStyle(property: string, value: string) {
    if (!selectedNode) return;
    mutateNode(selectedNode.id, (node) => node.style.setProperty(property, value), `node:${selectedNode.id}:style:${property}`);
  }

  function sectionNodeId() { return selectedNode?.sectionId ?? (selectedNode?.tagName === "section" ? selectedNode.id : null); }

  function toggleHidden(id = sectionNodeId()) {
    if (!id) return;
    mutateNode(id, (node) => {
      const hidden = node.dataset.moireHidden === "true";
      if (hidden) { delete node.dataset.moireHidden; node.style.removeProperty("display"); }
      else { node.dataset.moireHidden = "true"; node.style.setProperty("display", "none"); }
    });
  }

  function duplicateSection() {
    const id = sectionNodeId();
    if (!id) return;
    const current = sourceRef.current;
    const document = parseSource(current.html);
    const node = document ? findByMoireId(document, id) : null;
    if (!document || !node || node.tagName !== "SECTION") return;
    const copy = node.cloneNode(true) as HTMLElement;
    copy.querySelectorAll<HTMLElement>("[data-moire-id]").forEach((child) => { child.dataset.moireId = `${child.dataset.moireId || "node"}-${crypto.randomUUID().slice(0, 8)}`; });
    copy.dataset.moireId = `${id}-${crypto.randomUUID().slice(0, 8)}`;
    node.after(copy);
    commit({ ...current, html: serializeProjectHtml(document), updatedAt: new Date().toISOString() });
    setSelection({ id: copy.dataset.moireId, type: copy.dataset.moireType || "section", tagName: "section" });
    setToast("섹션을 독립 편집 ID로 복제했습니다");
  }

  function deleteSection() {
    const id = sectionNodeId();
    const document = parseSource(sourceRef.current.html);
    const node = document && id ? findByMoireId(document, id) : null;
    if (!document || !node || node.tagName !== "SECTION" || document.querySelectorAll("main section").length <= 1) return;
    node.remove();
    commit({ ...sourceRef.current, html: serializeProjectHtml(document), updatedAt: new Date().toISOString() });
    setSelection(null);
  }

  function moveSection(id: string, direction: -1 | 1) {
    const document = parseSource(sourceRef.current.html);
    const node = document ? findByMoireId(document, id) : null;
    if (!document || !node || node.tagName !== "SECTION") return;
    if (direction < 0 && node.previousElementSibling) node.parentElement?.insertBefore(node, node.previousElementSibling);
    if (direction > 0 && node.nextElementSibling) node.parentElement?.insertBefore(node.nextElementSibling, node);
    else if (direction > 0 && !node.nextElementSibling) return;
    commit({ ...sourceRef.current, html: serializeProjectHtml(document), updatedAt: new Date().toISOString() });
  }

  async function requestAiPatch(prompt: string, target: EditorNodeSelection, baseSource = sourceRef.current) {
    const snapshot = readNode(baseSource, target);
    if (!snapshot) throw new Error("AI가 수정할 선택 영역을 찾지 못했습니다.");
    const response = await fetch("/api/ai/edit", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, nodeId: snapshot.id, nodeType: snapshot.type, nodeHtml: snapshot.outerHtml, projectCss: baseSource.css, rootValue: sourceRootValue(baseSource.html), architecture: baseSource.architecture }),
    });
    const payload = await response.json() as { nodeHtml?: string; nodeCss?: string; summary?: string; error?: string };
    if (!response.ok || !payload.nodeHtml || payload.nodeCss === undefined) throw new Error(payload.error ?? "AI 영역 편집에 실패했습니다.");
    const next = replaceNode(sourceRef.current, target.id, payload.nodeHtml, payload.nodeCss);
    commit(next);
    return payload.summary ?? "선택한 영역의 HTML/CSS만 업데이트했습니다.";
  }

  async function submitAiEdit() {
    const prompt = chatInput.trim();
    if (!prompt || !selection || chatBusy) return;
    setMessages((items) => [...items, { id: crypto.randomUUID(), role: "user", text: prompt }]);
    setChatInput(""); setChatBusy(true);
    try {
      const summary = await requestAiPatch(prompt, selection);
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", text: summary }]);
    } catch (error) {
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", text: error instanceof Error ? error.message : "AI 편집에 실패했습니다." }]);
    } finally { setChatBusy(false); }
  }

  async function addAiSection(prompt: string) {
    const id = `section-${crypto.randomUUID()}`;
    const textId = `text-${crypto.randomUUID()}`;
    const document = parseSource(sourceRef.current.html);
    const main = document?.querySelector("main");
    if (!document || !main) return;
    const section = document.createElement("section");
    section.dataset.moireId = id; section.dataset.moireType = "section";
    section.innerHTML = `<p data-moire-id="${textId}" data-moire-type="text">새 섹션을 설계하고 있습니다.</p>`;
    const selected = selection ? findByMoireId(document, selection.id)?.closest("section") : null;
    if (selected?.parentElement === main) selected.after(section); else main.appendChild(section);
    const placeholderSource = { ...sourceRef.current, html: serializeProjectHtml(document), updatedAt: new Date().toISOString() };
    commit(placeholderSource);
    const target = { id, type: "section", tagName: "section" };
    setSelection(target); setShowAddSection(false); setLeftPanel("ai"); setChatBusy(true);
    try {
      const summary = await requestAiPatch(`새 섹션을 처음부터 설계해 추가해줘. 요구사항: ${prompt}`, target, placeholderSource);
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", text: summary }]);
      setToast("AI가 새 섹션을 직접 설계했습니다");
    } catch (error) {
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", text: error instanceof Error ? error.message : "새 섹션 생성에 실패했습니다." }]);
    } finally { setChatBusy(false); }
  }

  async function saveVersion() {
    const label = `저장 버전 ${versions.length + 1}`;
    const createdAt = new Date().toISOString();
    if (!projectId) {
      setVersions((items) => [{ id: crypto.randomUUID(), label, createdAt, source: cloneProjectSource(sourceRef.current) }, ...items]);
      setToast("현재 Project Source 버전을 저장했습니다");
      return;
    }
    setPersistBusy(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, source: sourceRef.current }),
      });
      const payload = await response.json() as { versionId?: string; createdAt?: string; error?: string };
      if (!response.ok || !payload.versionId) throw new Error(payload.error ?? "버전을 저장하지 못했습니다.");
      setVersions((items) => [{ id: payload.versionId!, label, createdAt: payload.createdAt ?? createdAt, source: cloneProjectSource(sourceRef.current) }, ...items]);
      setActiveVersionId(payload.versionId);
      setToast("새 버전을 저장하고 activeVersion으로 전환했습니다");
    } catch (error) { setToast(error instanceof Error ? error.message : "버전을 저장하지 못했습니다"); }
    finally { setPersistBusy(false); }
  }

  async function restoreVersion(version: SavedVersion) {
    if (!projectId) {
      commit(cloneProjectSource(version.source)); setShowVersions(false); setSelection(null); setToast(`${version.label}을 복원했습니다`);
      return;
    }
    setPersistBusy(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/versions/${version.id}/activate`, { method: "POST" });
      const payload = await response.json() as { source?: ProjectSource; activeVersionId?: string; error?: string };
      if (!response.ok || !payload.source) throw new Error(payload.error ?? "버전을 복원하지 못했습니다.");
      commit(cloneProjectSource(payload.source));
      setActiveVersionId(version.id); setShowVersions(false); setSelection(null); setToast(`${version.label}을 activeVersion으로 복원했습니다`);
    } catch (error) { setToast(error instanceof Error ? error.message : "버전을 복원하지 못했습니다"); }
    finally { setPersistBusy(false); }
  }

  return (
    <main className="editor-app">
      <header className="editor-topbar">
        <div className="topbar-left"><Link className="editor-back" href="/" aria-label="홈으로"><ArrowLeft size={17} /></Link><Brand compact /><span className="topbar-divider" /><b className="project-name">{source.name}</b><span className="saved-state"><Save size={12} /> {projectId ? "Supabase Project Source" : "로컬 Project Source"}</span></div>
        <div className="viewport-switcher" aria-label="미리보기 기기"><button type="button" aria-label="Desktop 1920 × 1080" title="Desktop 1920 × 1080" className={viewport === "desktop" ? "active" : ""} onClick={() => setViewport("desktop")}><Monitor size={15} /></button><button type="button" aria-label="Tablet 1024 × 768" title="Tablet 1024 × 768" className={viewport === "tablet" ? "active" : ""} onClick={() => setViewport("tablet")}><Tablet size={15} /></button><button type="button" aria-label="Mobile 390 × 844" title="Mobile 390 × 844" className={viewport === "mobile" ? "active" : ""} onClick={() => setViewport("mobile")}><Smartphone size={15} /></button></div>
        <div className="topbar-actions"><button disabled={!past.length} onClick={undo} title="실행 취소"><Undo2 size={16} /></button><button disabled={!future.length} onClick={redo} title="다시 실행"><Redo2 size={16} /></button><button onClick={() => setShowVersions(true)}><History size={15} /> 버전</button><Link className="new-design-button" href="/#create"><Sparkles size={15} /> 새 디자인</Link><button className="publish-button" onClick={() => setShowPublish(true)}>게시</button></div>
      </header>

      <div className="editor-workspace">
        <aside className="editor-left-panel">
          <div className="left-tabs"><button className={leftPanel === "sections" ? "active" : ""} onClick={() => setLeftPanel("sections")}><GripVertical size={15} /> 구조</button><button className={leftPanel === "ai" ? "active ai" : ""} onClick={() => setLeftPanel("ai")}><Sparkles size={15} /> AI</button></div>
          {leftPanel === "sections" ? <>
            <div className="panel-heading"><div><span>Project Source</span><b>자유 구조</b></div></div>
            <div className="section-list">{regions.map((region, index) => <div className={`section-list-row ${selection?.id === region.id || selectedNode?.sectionId === region.id ? "active" : ""}`} key={region.id} onClick={() => setSelection({ id: region.id, type: region.type, tagName: region.type })}><GripVertical size={13} /><span>{region.label}</span><div className="row-actions"><button onClick={(event) => { event.stopPropagation(); toggleHidden(region.id); }}>{region.hidden ? <EyeOff size={12} /> : <Eye size={12} />}</button>{region.type !== "header" && region.type !== "footer" && <><button onClick={(event) => { event.stopPropagation(); moveSection(region.id, -1); }} disabled={index === 0}>↑</button><button onClick={(event) => { event.stopPropagation(); moveSection(region.id, 1); }}>↓</button></>}</div></div>)}</div>
            <button className="add-section-button" onClick={() => setShowAddSection(true)}><Plus size={14} /> AI로 새 섹션 설계</button>
            <div className="locked-commerce"><Save size={14} /><div><b>Cafe24 Commerce</b><span>module · 변수 · 결제 hook 보호됨</span></div><span>잠금</span></div>
          </> : <div className="ai-panel"><div className="ai-panel-title"><div className="ai-orb"><Sparkles /></div><div><b>AI Node Designer</b><span>{selectedNode ? `${selectedNode.type} · ${selectedNode.id}` : "영역을 선택하세요"}</span></div></div><div className="chat-messages">{messages.map((message) => <div className={`chat-message ${message.role}`} key={message.id}>{message.text}</div>)}{chatBusy && <div className="chat-message assistant thinking"><LoaderCircle size={14} /> 선택 영역의 코드를 설계 중</div>}</div><div className="suggestion-chips">{["이 Hero를 더 고급스럽게", "상품 하나를 크게", "구조를 완전히 새롭게"].map((text) => <button key={text} onClick={() => setChatInput(text)}>{text}</button>)}</div><div className="ai-input-wrap"><textarea value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitAiEdit(); } }} placeholder="선택한 영역의 HTML/CSS만 수정합니다" /><button disabled={!chatInput.trim() || !selection || chatBusy} onClick={() => void submitAiEdit()}><Send size={15} /></button></div></div>}
        </aside>

        <section className="editor-stage"><div className="stage-toolbar"><span>{viewport === "desktop" ? "1920 × 1080" : viewport === "tablet" ? "1024 × 768" : "390 × 844"}</span><b>HTML/CSS 직접 렌더링</b></div><div className={`canvas-viewport viewport-${viewport}`}><EditorCanvas source={source} selection={selection} viewport={viewport} onSelect={(next) => { setSelection(next); setRightOpen(true); }} /></div></section>

        {rightOpen && <aside className="editor-inspector"><div className="inspector-title"><div><span>선택 노드</span><b>{selectedNode ? `${selectedNode.tagName} · ${selectedNode.type}` : "선택 없음"}</b></div><button onClick={() => setRightOpen(false)}><X size={16} /></button></div>{selectedNode ? <NodeInspector node={selectedNode} projectId={projectId} onText={updateText} onAttribute={updateAttribute} onStyle={updateStyle} /> : <p className="empty-inspector">미리보기에서 텍스트, 이미지, 버튼 또는 섹션을 클릭하세요.</p>}{sectionNodeId() && <div className="section-actions"><button onClick={duplicateSection}><Copy size={14} /> 복제</button><button onClick={() => toggleHidden()}><EyeOff size={14} /> 숨김</button><button className="danger" onClick={deleteSection}><Trash2 size={14} /> 삭제</button></div>}<button className="inspector-ai-button" onClick={() => setLeftPanel("ai")}><Sparkles size={15} /> AI로 선택 영역 다시 설계</button></aside>}
      </div>

      {toast && <div className="editor-toast"><Save size={14} /> {toast}</div>}
      {showAddSection && <AddSectionModal onClose={() => setShowAddSection(false)} onAdd={addAiSection} />}
      {showVersions && <VersionModal versions={versions} current={source} activeVersionId={activeVersionId} busy={persistBusy} onClose={() => setShowVersions(false)} onSave={saveVersion} onRestore={restoreVersion} />}
      {showPublish && <PublishModal projectId={projectId} onClose={() => setShowPublish(false)} />}
    </main>
  );
}

function NodeInspector({ node, projectId, onText, onAttribute, onStyle }: { node: NodeSnapshot; projectId: string | null; onText: (value: string) => void; onAttribute: (name: string, value: string) => void; onStyle: (property: string, value: string) => void }) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const isText = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "a", "button"].includes(node.tagName);

  async function upload(file: File | undefined) {
    if (!file) return;
    setImageBusy(true); setImageError(null);
    try {
      const optimized = await optimizeImageFile(file);
      const stored = await persistProjectAsset(optimized, "image");
      onAttribute("src", stored?.url ?? optimized);
      if (projectId && stored?.storagePath) {
        const response = await fetch(`/api/projects/${projectId}/assets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storagePath: stored.storagePath, kind: "reference" }) });
        if (!response.ok) throw new Error("업로드한 이미지 정보를 저장하지 못했습니다.");
      }
    }
    catch (error) { setImageError(error instanceof Error ? error.message : "이미지를 업로드하지 못했습니다."); }
    finally { setImageBusy(false); if (imageInputRef.current) imageInputRef.current.value = ""; }
  }

  return <div className="inspector-fields">
    {isText && <label><span>내용</span><textarea rows={node.tagName === "p" ? 5 : 3} value={node.text} onChange={(event) => onText(event.target.value)} /></label>}
    {(node.tagName === "a" || node.tagName === "button") && <label><span>링크</span><input type="text" value={node.href} onChange={(event) => onAttribute("href", event.target.value)} placeholder="/product/list.html" /></label>}
    {node.tagName === "img" && <><label><span>이미지 URL</span><input type="url" value={node.src} onChange={(event) => onAttribute("src", event.target.value)} /></label><label><span>대체 텍스트</span><input type="text" value={node.alt} onChange={(event) => onAttribute("alt", event.target.value)} /></label><input ref={imageInputRef} className="visually-hidden-file" type="file" accept="image/*" onChange={(event) => void upload(event.target.files?.[0])} /><button className="replace-image-button" disabled={imageBusy} onClick={() => imageInputRef.current?.click()}>{imageBusy ? <LoaderCircle size={14} /> : <ImagePlus size={14} />} {imageBusy ? "이미지 준비 중" : "이미지 업로드"}</button>{imageError && <p className="image-upload-error">{imageError}</p>}</>}
    {isText && <><label><span>폰트</span><select value={node.style.fontFamily || ""} onChange={(event) => onStyle("font-family", event.target.value)}><option value="">디자인 기본값</option><option value="Arial, sans-serif">Sans</option><option value="Georgia, serif">Serif</option><option value="monospace">Mono</option></select></label><label><span>크기</span><input type="text" value={node.style.fontSize || ""} onChange={(event) => onStyle("font-size", event.target.value)} placeholder="예: 64px 또는 clamp(...)" /></label><label><span>굵기</span><select value={node.style.fontWeight || ""} onChange={(event) => onStyle("font-weight", event.target.value)}><option value="">기본값</option><option value="300">Light</option><option value="400">Regular</option><option value="500">Medium</option><option value="700">Bold</option></select></label><label><span>색상</span><input type="text" value={node.style.color || ""} onChange={(event) => onStyle("color", event.target.value)} placeholder="#111111" /></label><label><span>정렬</span><div className="option-grid">{["left", "center", "right"].map((align) => <button className={node.style.textAlign === align ? "active" : ""} key={align} onClick={() => onStyle("text-align", align)}>{align === "left" ? "왼쪽" : align === "center" ? "가운데" : "오른쪽"}</button>)}</div></label></>}
    {(node.tagName === "section" || node.tagName === "header" || node.tagName === "footer") && <><label><span>배경</span><input type="text" value={node.style.backgroundColor || ""} onChange={(event) => onStyle("background-color", event.target.value)} placeholder="#ffffff" /></label><label><span>상단 여백</span><input type="text" value={node.style.paddingTop || ""} onChange={(event) => onStyle("padding-top", event.target.value)} placeholder="96px" /></label><label><span>하단 여백</span><input type="text" value={node.style.paddingBottom || ""} onChange={(event) => onStyle("padding-bottom", event.target.value)} placeholder="96px" /></label><label><span>최대 폭</span><input type="text" value={node.style.maxWidth || ""} onChange={(event) => onStyle("max-width", event.target.value)} placeholder="100% 또는 1200px" /></label></>}
  </div>;
}

function AddSectionModal({ onClose, onAdd }: { onClose: () => void; onAdd: (prompt: string) => Promise<void> }) {
  const [prompt, setPrompt] = useState("");
  return <div className="modal-backdrop"><div className="editor-modal add-ai-section-modal"><div className="modal-title"><div><Sparkles size={18} /><b>AI로 새 섹션 설계</b></div><button onClick={onClose}><X size={17} /></button></div><div className="add-section-form"><p>정해진 섹션 타입을 고르지 않습니다. 필요한 역할과 구성을 자연어로 설명하면 AI가 HTML/CSS를 직접 설계합니다.</p><textarea rows={6} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="예: 대표 제품 하나를 잡지 표지처럼 크게 보여주고, 재료 디테일을 작은 캡션과 함께 비대칭으로 배치해줘" /><button disabled={prompt.trim().length < 5} onClick={() => void onAdd(prompt.trim())}><Sparkles size={15} /> 새 구조 생성</button></div></div></div>;
}

function VersionModal({ versions, current, activeVersionId, busy, onClose, onSave, onRestore }: { versions: SavedVersion[]; current: ProjectSource; activeVersionId: string | null; busy: boolean; onClose: () => void; onSave: () => Promise<void>; onRestore: (version: SavedVersion) => Promise<void> }) {
  return <div className="modal-backdrop"><div className="editor-modal version-modal"><div className="modal-title"><div><History size={18} /><b>Project Source 버전</b></div><button onClick={onClose}><X size={17} /></button></div><div className="current-version"><div><span>현재 소스</span><b>{current.name}</b></div><button disabled={busy} onClick={() => void onSave()}><Save size={14} /> {busy ? "저장 중" : "버전 저장"}</button></div><div className="version-list">{versions.length === 0 ? <div className="empty-versions"><History size={23} /><b>저장된 버전이 없습니다</b><span>HTML과 CSS가 함께 하나의 버전으로 저장됩니다.</span></div> : versions.map((version) => <div className="version-row" key={version.id}><div><b>{version.label}{version.id === activeVersionId ? " · active" : ""}</b><span>{new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(version.createdAt))}</span></div><button disabled={busy || version.id === activeVersionId} onClick={() => void onRestore(version)}>{version.id === activeVersionId ? "적용 중" : "복원"}</button></div>)}</div></div></div>;
}
