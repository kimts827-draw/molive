"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Copy, ExternalLink, Eye, EyeOff, GripVertical, History, ImagePlus, LoaderCircle, Maximize2, Minimize2, Monitor, Plus, Redo2, Save, Send, Smartphone, Sparkles, Tablet, Trash2, Undo2, X } from "lucide-react";
import { Brand } from "@/components/brand";
import { EditorCanvas, type PreviewStylePatch, type SelectionRenderMetrics } from "@/components/editor/editor-canvas";
import { PublishModal } from "@/components/editor/publish-modal";
import { optimizeImageFile, persistProjectAsset } from "@/lib/client-image";
import { autosaveLabel, type AutosaveState } from "@/lib/editor/autosave-state";
import { classifyAiEditIntent } from "@/lib/editor/ai-edit-intent";
import { productThumbnailGuidance } from "@/lib/editor/product-thumbnail-guidance";
import { isResponsiveProperty, readEditorDeclarations, removeEditorBlocks, setEditorDeclarations, type EditorViewport } from "@/lib/editor/responsive-style";
import { resolveEditorIntent, type EditorHeaderVariant } from "@/lib/editor/style-intent";
import { HEADER_NODE_ID, resolveHeaderPresentation } from "@/lib/commerce/fixed-components";
import { cloneProjectSource, type EditorNodeSelection, type ProjectHeaderPresentation, type ProjectSource } from "@/lib/project-source";

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
  insideProductSlot: boolean;
  isProductSection: boolean;
  /** Preview에만 존재하는 Header 가상 노드입니다. Project Source HTML에는 없습니다. */
  isHeader: boolean;
};
type ImageEditKind = "content" | "background" | "icon";
type RegionSummary = { id: string; type: string; label: string; hidden: boolean };
/**
 * Inspector가 읽는 style 속성 목록입니다.
 * 스냅샷은 항상 이 키를 빈 문자열로라도 채워야 합니다. 값이 없으면 Inspector 계산에서 터집니다.
 */
const INSPECTED_STYLE_PROPERTIES = ["color", "backgroundColor", "backgroundImage", "backgroundSize", "backgroundPosition", "objectPosition", "fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight", "letterSpacing", "textAlign", "textDecorationLine", "scale", "translate", "width", "height", "aspectRatio", "marginTop", "marginRight", "marginBottom", "marginLeft", "paddingTop", "paddingBottom", "minHeight", "maxWidth", "display"] as const;

const HEADER_VARIANT_OPTIONS: ReadonlyArray<{ value: EditorHeaderVariant; label: string }> = [
  { value: "split-utility", label: "한 줄" },
  { value: "centered-brand", label: "두 줄" },
  { value: "overlay-minimal", label: "오버레이" },
];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function imageUrlFromCss(value: string) {
  return value.match(/^url\(["']?(.*?)["']?\)$/i)?.[1] ?? "";
}

function cssImageUrl(value: string) {
  return `url(${JSON.stringify(value)})`;
}

function camelCase(property: string) {
  return property.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

/**
 * Header는 HeaderV1이 Preview에 직접 주입하므로 Project Source HTML에 노드가 없습니다.
 * Inspector와 AI가 같은 선택 모델을 쓰도록 가상 스냅샷을 만들어 줍니다.
 */
function headerSnapshot(selection: EditorNodeSelection): NodeSnapshot {
  return {
    ...selection,
    tagName: "header",
    type: "header",
    text: "", href: "", src: "", alt: "",
    style: Object.fromEntries(INSPECTED_STYLE_PROPERTIES.map((property) => [property, ""])),
    outerHtml: "", sectionId: null,
    insideProductSlot: false, isProductSection: false, isHeader: true,
  };
}

function readNode(source: ProjectSource, selection: EditorNodeSelection | null, viewport: EditorViewport): NodeSnapshot | null {
  if (!selection) return null;
  if (selection.id === HEADER_NODE_ID) return headerSnapshot(selection);
  const document = parseSource(source.html);
  const node = document ? findByMoireId(document, selection.id) : null;
  if (!node) return null;
  const style: Record<string, string> = {};
  for (const property of INSPECTED_STYLE_PROPERTIES) style[property] = node.style.getPropertyValue(property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`));
  // 반응형 속성은 인라인이 아니라 viewport CSS 블록에 있으므로 현재 viewport 값을 겹쳐 읽습니다.
  for (const [property, value] of Object.entries(readEditorDeclarations(source.css, { nodeId: selection.id, viewport }))) {
    style[camelCase(property)] = value;
  }
  const section = node.closest<HTMLElement>("section");
  const productSlot = node.closest<HTMLElement>('[data-cafe24-slot="product-list"]');
  const isProductSection = Boolean(productSlot || node.querySelector('[data-cafe24-slot="product-list"]') || node.dataset.moireType === "products");
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
    insideProductSlot: Boolean(productSlot),
    isProductSection,
    isHeader: false,
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

export function EditorShell({ initialSource, projectId = null, initialVersions = [], currentVersionId = null, initialCreditBalance = null }: { initialSource: ProjectSource; projectId?: string | null; initialVersions?: SavedVersion[]; currentVersionId?: string | null; initialCreditBalance?: number | null }) {
  const [hydrated, setHydrated] = useState(false);
  const [source, setSource] = useState(() => cloneProjectSource(initialSource));
  const [selection, setSelection] = useState<EditorNodeSelection | null>(null);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [leftPanel, setLeftPanel] = useState<"sections" | "ai">("sections");
  const [rightOpen, setRightOpen] = useState(true);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [past, setPast] = useState<ProjectSource[]>([]);
  const [future, setFuture] = useState<ProjectSource[]>([]);
  const [versions, setVersions] = useState<SavedVersion[]>(initialVersions);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(currentVersionId);
  const [persistBusy, setPersistBusy] = useState(false);
  const [autosaveState, setAutosaveState] = useState<AutosaveState>(projectId ? "saved" : "demo");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(initialCreditBalance);
  const [toast, setToast] = useState<string | null>(null);
  const [previewStylePatch, setPreviewStylePatch] = useState<PreviewStylePatch | null>(null);
  const [previewHeaderPresentation, setPreviewHeaderPresentation] = useState<ProjectHeaderPresentation | null>(null);
  const [selectionMetrics, setSelectionMetrics] = useState<SelectionRenderMetrics | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: "hello", role: "assistant", text: "캔버스나 섹션 목록에서 영역을 선택한 뒤 원하는 변화를 말해 주세요. 선택한 HTML/CSS 범위만 수정합니다." }]);
  const sourceRef = useRef(source);
  const pastRef = useRef(past);
  const futureRef = useRef(future);
  const historyGroupRef = useRef<string | null>(null);
  const historyTimerRef = useRef<number | null>(null);
  const autosaveSequenceRef = useRef(0);
  const selectionMetricsRef = useRef<SelectionRenderMetrics | null>(null);

  const regions = useMemo(() => hydrated ? listRegions(source.html) : [], [hydrated, source.html]);
  const selectedNode = useMemo(() => hydrated ? readNode(source, selection, viewport) : null, [hydrated, source, selection, viewport]);
  const handleSelectionMetrics = useCallback((metrics: SelectionRenderMetrics | null) => {
    selectionMetricsRef.current = metrics;
    setSelectionMetrics((current) => {
      if (!metrics || !current) return metrics;
      const unchanged = (Object.keys(metrics) as Array<keyof SelectionRenderMetrics>).every((key) => metrics[key] === current[key]);
      return unchanged ? current : metrics;
    });
  }, []);

  useEffect(() => {
    if (selectionMetricsRef.current?.nodeId === selection?.id) return;
    selectionMetricsRef.current = null;
    setSelectionMetrics(null);
  }, [selection?.id]);

  const waitForSelectionRender = useCallback((nodeId: string, afterRevision: number) => new Promise<SelectionRenderMetrics | null>((resolve) => {
    const startedAt = performance.now();
    const check = () => {
      const metrics = selectionMetricsRef.current;
      if (metrics?.nodeId === nodeId && metrics.renderRevision > afterRevision) {
        resolve(metrics);
        return;
      }
      if (performance.now() - startedAt >= 2000) {
        resolve(null);
        return;
      }
      window.requestAnimationFrame(check);
    };
    window.requestAnimationFrame(check);
  }), []);

  const verifyVisibleSelectionChange = useCallback(async (nodeId: string, before: SelectionRenderMetrics | null, allowDocumentChange = false) => {
    if (!before || before.nodeId !== nodeId) return false;
    const after = await waitForSelectionRender(nodeId, before.renderRevision);
    return Boolean(after && (after.computedFingerprint !== before.computedFingerprint
      || (allowDocumentChange && after.documentFingerprint !== before.documentFingerprint)));
  }, [waitForSelectionRender]);

  const closeHistoryGroup = useCallback(() => {
    historyGroupRef.current = null;
    if (historyTimerRef.current !== null) window.clearTimeout(historyTimerRef.current);
    historyTimerRef.current = null;
  }, []);

  const discardUnappliedChange = useCallback((before: ProjectSource, previousFuture: ProjectSource[]) => {
    const latestPast = pastRef.current.at(-1);
    if (latestPast?.html === before.html && latestPast.css === before.css) {
      pastRef.current = pastRef.current.slice(0, -1);
      setPast(pastRef.current);
    }
    sourceRef.current = before;
    setSource(before);
    futureRef.current = previousFuture;
    setFuture(previousFuture);
    closeHistoryGroup();
  }, [closeHistoryGroup]);

  const commit = useCallback((next: ProjectSource, historyKey?: string) => {
    const current = sourceRef.current;
    // Header variant·content color와 상품 썸네일 비율은 HTML/CSS 밖에 있으므로 함께 비교해야 변경이 사라지지 않습니다.
    if (next.html === current.html && next.css === current.css && next.name === current.name
      && JSON.stringify(next.architecture) === JSON.stringify(current.architecture)
      && JSON.stringify(next.commerce) === JSON.stringify(current.commerce)
      && next.headerContentColor === current.headerContentColor
      && JSON.stringify(next.headerPresentation) === JSON.stringify(current.headerPresentation)) return;
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
    const sequence = ++autosaveSequenceRef.current;
    setAutosaveState("saving");
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: sourceRef.current }),
        });
        if (!response.ok) throw new Error();
        if (autosaveSequenceRef.current === sequence) {
          setLastSavedAt(new Date().toISOString());
          setAutosaveState("saved");
        }
      } catch {
        if (autosaveSequenceRef.current === sequence) setAutosaveState("error");
        setToast("Project Source 자동 저장에 실패했습니다");
      }
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

  /**
   * 편집값을 속성 성격에 따라 나눠 씁니다.
   * 크기·간격·위치처럼 화면폭을 타는 속성은 현재 viewport의 미디어 쿼리 CSS로 가고,
   * 색상·굵기처럼 화면폭과 무관한 속성만 인라인으로 남습니다.
   * 인라인은 미디어 쿼리를 무조건 이기므로, CSS로 옮기는 속성의 인라인 값은 함께 지웁니다.
   */
  const applyStyleDeclarations = useCallback((nodeId: string, styles: Record<string, string>, historyKey?: string) => {
    const current = sourceRef.current;
    const rootValue = sourceRootValue(current.html);
    const document = parseSource(current.html);
    const node = document ? findByMoireId(document, nodeId) : null;
    if (!document || !node) return;
    const responsive: Record<string, string> = {};
    for (const [property, value] of Object.entries(styles)) {
      if (rootValue && isResponsiveProperty(property)) {
        responsive[property] = value;
        node.style.removeProperty(property);
        continue;
      }
      if (value.trim()) node.style.setProperty(property, value);
      else node.style.removeProperty(property);
    }
    const css = Object.keys(responsive).length
      ? setEditorDeclarations(current.css, { rootValue, nodeId, viewport, declarations: responsive })
      : current.css;
    commit({ ...current, html: serializeProjectHtml(document), css, updatedAt: new Date().toISOString() }, historyKey);
  }, [commit, viewport]);

  function updateStyle(property: string, value: string) {
    if (!selectedNode) return;
    setPreviewStylePatch(null);
    applyStyleDeclarations(selectedNode.id, { [property]: value }, `node:${selectedNode.id}:${viewport}:style:${property}`);
  }

  function updateStyles(styles: Record<string, string>) {
    if (!selectedNode) return;
    setPreviewStylePatch(null);
    applyStyleDeclarations(selectedNode.id, styles, `node:${selectedNode.id}:${viewport}:styles:${Object.keys(styles).sort().join(",")}`);
  }

  function previewStyle(property: string, value: string) {
    if (!selectedNode) return;
    setPreviewStylePatch({ nodeId: selectedNode.id, property, value });
  }

  function updateImageSource(value: string, kind: ImageEditKind) {
    if (!selectedNode || selectedNode.insideProductSlot) return;
    mutateNode(selectedNode.id, (node) => {
      if (kind === "content" && node.tagName === "IMG") {
        node.setAttribute("src", value);
        return;
      }
      if (kind === "icon") {
        const image = node.ownerDocument.createElement("img");
        for (const attribute of [...node.attributes]) image.setAttribute(attribute.name, attribute.value);
        image.dataset.moireId = selectedNode.id;
        image.dataset.moireType = "image";
        image.setAttribute("src", value);
        image.setAttribute("alt", node.getAttribute("aria-label") || "아이콘");
        node.replaceWith(image);
        return;
      }
      node.style.setProperty("background-image", cssImageUrl(value));
      node.style.setProperty("background-size", "cover");
      node.style.setProperty("background-position", "center");
      node.style.setProperty("background-repeat", "no-repeat");
    }, `node:${selectedNode.id}:image:${kind}`);
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
    const removedIds = [id ?? "", ...[...node.querySelectorAll<HTMLElement>("[data-moire-id]")].map((child) => child.dataset.moireId ?? "")].filter((value): value is string => Boolean(value));
    node.remove();
    const css = removedIds.reduce((current, removedId) => removeEditorBlocks(current, removedId), sourceRef.current.css);
    commit({ ...sourceRef.current, html: serializeProjectHtml(document), css, updatedAt: new Date().toISOString() });
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
    const snapshot = readNode(baseSource, target, viewport);
    if (!snapshot) throw new Error("AI가 수정할 선택 영역을 찾지 못했습니다.");
    const renderMetrics = selectionMetrics?.nodeId === snapshot.id ? {
      width: selectionMetrics.width,
      height: selectionMetrics.height,
      fontSize: selectionMetrics.fontSize,
      lineHeight: selectionMetrics.lineHeight,
      letterSpacing: selectionMetrics.letterSpacing,
      marginTop: selectionMetrics.marginTop,
      marginBottom: selectionMetrics.marginBottom,
      paddingTop: selectionMetrics.paddingTop,
      paddingBottom: selectionMetrics.paddingBottom,
    } : undefined;
    const response = await fetch("/api/ai/edit", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, nodeId: snapshot.id, nodeType: snapshot.type, nodeHtml: snapshot.outerHtml, projectCss: baseSource.css, rootValue: sourceRootValue(baseSource.html), architecture: baseSource.architecture, pagePlan: baseSource.pagePlan, renderMetrics, ...(projectId && UUID_PATTERN.test(projectId) ? { projectId } : {}) }),
    });
    const payload = await response.json() as { nodeHtml?: string; nodeCss?: string; summary?: string; error?: string; balance?: number };
    if (!response.ok || !payload.nodeHtml || payload.nodeCss === undefined) throw new Error(payload.error ?? "AI 영역 편집에 실패했습니다.");
    const before = sourceRef.current;
    const previousFuture = futureRef.current;
    const beforeRender = selectionMetricsRef.current;
    const next = replaceNode(before, target.id, payload.nodeHtml, payload.nodeCss);
    // 실제 문서가 바뀌었을 때만 성공으로 봅니다. 바뀐 게 없는데 "완료"라고 말하지 않습니다.
    if (next.html === before.html && next.css === before.css) {
      throw new Error("요청을 반영한 실제 변경이 만들어지지 않았습니다. 바꾸고 싶은 부분을 조금 더 구체적으로 적어 주세요.");
    }
    commit(next);
    const styleOnly = classifyAiEditIntent(prompt) === "style-only";
    const visiblyChanged = await verifyVisibleSelectionChange(target.id, beforeRender, !styleOnly);
    if (!visiblyChanged) {
      discardUnappliedChange(before, previousFuture);
      throw new Error(styleOnly
        ? "요청한 스타일은 생성됐지만 현재 레이아웃의 실제 계산 결과가 달라지지 않았습니다. 상위 영역의 고정 크기나 기존 CSS 제약 때문에 적용되지 않았을 수 있습니다. Inspector에서 해당 영역을 다시 선택한 뒤 구체적인 px 또는 배율로 요청해 주세요."
        : "AI가 patch를 만들었지만 실제 문서 구조나 화면 결과가 달라지지 않아 적용을 취소했습니다. 바꿀 대상과 원하는 결과를 조금 더 구체적으로 적어 주세요.");
    }
    if (typeof payload.balance === "number") setCreditBalance(payload.balance);
    return payload.summary ?? "선택한 영역의 HTML/CSS만 업데이트했습니다.";
  }

  /**
   * 상품 썸네일 표시 비율은 commerce 토큰이 소유합니다.
   * 검증된 ProductSection DOM과 Cafe24 상품 binding은 그대로 두고 CSS 비율만 바뀝니다.
   */
  function applyThumbRatio(ratio: string) {
    const current = sourceRef.current;
    if (current.commerce?.thumbRatioOverride === ratio) return false;
    commit({ ...current, commerce: { ...current.commerce, thumbRatioOverride: ratio }, updatedAt: new Date().toISOString() });
    return true;
  }

  /** Header는 AI HTML이 아니라 HeaderV1 variant가 소유하므로 architecture 값으로만 바뀝니다. */
  function applyHeaderVariant(variant: EditorHeaderVariant) {
    const current = sourceRef.current;
    if (current.architecture.header === variant) return false;
    commit({ ...current, architecture: { ...current.architecture, header: variant }, updatedAt: new Date().toISOString() });
    return true;
  }

  function applyHeaderPresentation(next: ProjectHeaderPresentation) {
    const current = sourceRef.current;
    setPreviewHeaderPresentation(null);
    commit({ ...current, headerPresentation: next, updatedAt: new Date().toISOString() });
  }

  function applyHeaderContentColor(headerContentColor: "dark" | "light") {
    const current = sourceRef.current;
    commit({ ...current, headerContentColor, updatedAt: new Date().toISOString() });
  }

  async function submitAiEdit() {
    const prompt = chatInput.trim();
    if (!prompt || !selection || chatBusy) return;
    const node = selectedNode;
    setMessages((items) => [...items, { id: crypto.randomUUID(), role: "user", text: prompt }]);
    setChatInput("");

    // 결과가 하나로 정해지는 요청은 모델 왕복 없이 바로 처리합니다.
    const intent = node
      ? resolveEditorIntent({
        prompt,
        node: { tagName: node.tagName, type: node.type, insideProductSlot: node.insideProductSlot, isHeader: node.isHeader, thumbRatio: source.commerce?.thumbRatioOverride, translate: node.style.translate, scale: node.style.scale },
        metrics: selectionMetrics?.nodeId === node.id
          ? { width: selectionMetrics.width, height: selectionMetrics.height, fontSize: selectionMetrics.fontSize }
          : undefined,
      })
      : { kind: "model" as const };

    if (intent.kind === "unsupported") {
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", text: intent.message }]);
      return;
    }
    if (intent.kind === "product-thumbnail") {
      const changed = applyThumbRatio(intent.thumbRatio);
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", text: changed ? intent.summary : "상품 썸네일이 이미 요청하신 비율입니다. 바꾼 내용이 없습니다." }]);
      return;
    }
    if (intent.kind === "header-variant") {
      const changed = applyHeaderVariant(intent.variant);
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", text: changed ? intent.summary : "헤더가 이미 요청하신 형식입니다. 바꾼 내용이 없습니다." }]);
      return;
    }
    if (intent.kind === "style" && node) {
      setPreviewStylePatch(null);
      const before = sourceRef.current;
      const previousFuture = futureRef.current;
      const beforeRender = selectionMetricsRef.current;
      applyStyleDeclarations(node.id, intent.declarations);
      const changed = sourceRef.current.html !== before.html || sourceRef.current.css !== before.css;
      const visiblyChanged = changed && await verifyVisibleSelectionChange(node.id, beforeRender);
      if (changed && !visiblyChanged) discardUnappliedChange(before, previousFuture);
      const text = !changed
        ? "이미 요청하신 값이라 바뀐 내용이 없습니다."
        : visiblyChanged
          ? intent.summary
          : "스타일 값은 만들었지만 실제 화면의 계산 결과가 달라지지 않아 적용을 취소했습니다. 상위 레이아웃의 고정 크기나 기존 CSS 제약을 확인해 주세요.";
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", text }]);
      return;
    }

    setChatBusy(true);
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
    <main className={`editor-app${previewFullscreen ? " preview-fullscreen" : ""}`}>
      <header className="editor-topbar">
        <div className="topbar-left"><Link className="editor-back" href={projectId ? "/projects" : "/"} aria-label={projectId ? "내 디자인으로" : "홈으로"}><ArrowLeft size={17} /></Link><Brand compact /><span className="topbar-divider" /><b className="project-name">{source.name}</b><span className={`saved-state saved-state-${autosaveState}`}><Save size={12} /> {autosaveLabel(autosaveState, lastSavedAt)}</span></div>
        <div className="viewport-switcher" aria-label="미리보기 기기"><button type="button" aria-label="Desktop 1920 × 1080" title="Desktop 1920 × 1080" className={viewport === "desktop" ? "active" : ""} onClick={() => setViewport("desktop")}><Monitor size={15} /></button><button type="button" aria-label="Tablet 1024 × 768" title="Tablet 1024 × 768" className={viewport === "tablet" ? "active" : ""} onClick={() => setViewport("tablet")}><Tablet size={15} /></button><button type="button" aria-label="Mobile 390 × 844" title="Mobile 390 × 844" className={viewport === "mobile" ? "active" : ""} onClick={() => setViewport("mobile")}><Smartphone size={15} /></button></div>
        <div className="topbar-actions"><button className="preview-fullscreen-button" onClick={() => setPreviewFullscreen((current) => !current)} title={previewFullscreen ? "Editor 화면으로 돌아가기" : "전체화면 보기"}>{previewFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />} {previewFullscreen ? "Editor로 돌아가기" : "전체화면 보기"}</button><button disabled={!past.length} onClick={undo} title="실행 취소"><Undo2 size={16} /></button><button disabled={!future.length} onClick={redo} title="다시 실행"><Redo2 size={16} /></button><button onClick={() => setShowVersions(true)}><History size={15} /> 버전</button>{projectId ? <a className="standalone-preview-button" href={`/preview/${encodeURIComponent(projectId)}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} /> 새 창에서 전체 보기</a> : null}<Link className="new-design-button" href="/"><Sparkles size={15} /> 새 디자인</Link><button className="publish-button" onClick={() => setShowPublish(true)}>게시</button></div>
      </header>

      <div className="editor-workspace">
        <aside className="editor-left-panel">
          <div className="left-tabs"><button className={leftPanel === "sections" ? "active" : ""} onClick={() => setLeftPanel("sections")}><GripVertical size={15} /> 구조</button><button className={leftPanel === "ai" ? "active ai" : ""} onClick={() => setLeftPanel("ai")}><Sparkles size={15} /> AI</button></div>
          {leftPanel === "sections" ? <>
            <div className="panel-heading"><div><span>Project Source</span><b>자유 구조</b></div></div>
            <div className="section-list">{regions.map((region, index) => <div className={`section-list-row ${selection?.id === region.id || selectedNode?.sectionId === region.id ? "active" : ""}`} key={region.id} onClick={() => setSelection({ id: region.id, type: region.type, tagName: region.type })}><GripVertical size={13} /><span>{region.label}</span><div className="row-actions"><button onClick={(event) => { event.stopPropagation(); toggleHidden(region.id); }}>{region.hidden ? <EyeOff size={12} /> : <Eye size={12} />}</button>{region.type !== "header" && region.type !== "footer" && <><button onClick={(event) => { event.stopPropagation(); moveSection(region.id, -1); }} disabled={index === 0}>↑</button><button onClick={(event) => { event.stopPropagation(); moveSection(region.id, 1); }}>↓</button></>}</div></div>)}</div>
            <button className="add-section-button" onClick={() => setShowAddSection(true)}><Plus size={14} /> AI로 새 섹션 설계</button>
            <div className="locked-commerce"><Save size={14} /><div><b>Cafe24 Commerce</b><span>module · 변수 · 결제 hook 보호됨</span></div><span>잠금</span></div>
          </> : <div className="ai-panel"><div className="ai-panel-title"><div className="ai-orb"><Sparkles /></div><div><b>AI Node Designer</b><span>{selectedNode ? `${selectedNode.type} · ${selectedNode.id}` : "영역을 선택하세요"}</span></div>{creditBalance !== null ? <Link className="editor-credit" href="/pricing">{creditBalance}C · AI 1C</Link> : null}</div><div className="chat-messages">{messages.map((message) => <div className={`chat-message ${message.role}`} key={message.id}>{message.text}</div>)}{chatBusy && <div className="chat-message assistant thinking"><LoaderCircle size={14} /> 선택 영역의 코드를 설계 중</div>}</div><div className="suggestion-chips">{["이 Hero를 더 고급스럽게", "상품 하나를 크게", "구조를 완전히 새롭게"].map((text) => <button key={text} onClick={() => setChatInput(text)}>{text}</button>)}</div><div className="ai-input-wrap"><textarea value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submitAiEdit(); } }} placeholder="선택한 영역의 HTML/CSS만 수정합니다" /><button disabled={!chatInput.trim() || !selection || chatBusy} onClick={() => void submitAiEdit()}><Send size={15} /></button></div></div>}
        </aside>

        <section className="editor-stage"><div className="stage-toolbar"><span>{viewport === "desktop" ? "1920 × 1080" : viewport === "tablet" ? "1024 × 768" : "390 × 844"}</span><b>HTML/CSS 직접 렌더링</b></div><div className={`canvas-viewport viewport-${viewport}`}><EditorCanvas source={source} selection={selection} previewStylePatch={previewStylePatch} previewHeaderPresentation={previewHeaderPresentation} viewport={viewport} onSelectionMetrics={handleSelectionMetrics} onSelect={(next) => { setPreviewStylePatch(null); setPreviewHeaderPresentation(null); selectionMetricsRef.current = null; setSelectionMetrics(null); setSelection(next); setRightOpen(true); }} /></div></section>

        {rightOpen && <aside className="editor-inspector"><div className="inspector-title"><div><span>선택 노드</span><b>{selectedNode ? `${selectedNode.tagName} · ${selectedNode.type}` : "선택 없음"}</b></div><button onClick={() => setRightOpen(false)} aria-label="Inspector 닫기"><X size={16} /></button></div>{selectedNode ? <NodeInspector node={selectedNode} renderMetrics={selectionMetrics?.nodeId === selectedNode.id ? selectionMetrics : null} projectId={projectId} productPresentation={source.architecture.productPresentation} thumbRatioOverride={source.commerce?.thumbRatioOverride} headerVariant={(source.architecture.header as EditorHeaderVariant) ?? "split-utility"} headerContentColor={source.headerContentColor ?? "dark"} headerPresentation={resolveHeaderPresentation(source.headerPresentation)} onPreviewHeaderPresentation={setPreviewHeaderPresentation} onHeaderContentColor={applyHeaderContentColor} onHeaderPresentation={applyHeaderPresentation} onHeaderVariant={(variant) => { if (!applyHeaderVariant(variant)) setToast("헤더가 이미 그 형식입니다"); }} onText={updateText} onAttribute={updateAttribute} onStyle={updateStyle} onStyles={updateStyles} onPreviewStyle={previewStyle} onImageSource={updateImageSource} /> : <p className="empty-inspector">미리보기에서 텍스트, 이미지, 버튼 또는 섹션을 클릭하세요.</p>}{sectionNodeId() && <div className="section-actions"><button onClick={duplicateSection}><Copy size={14} /> 복제</button><button onClick={() => toggleHidden()}><EyeOff size={14} /> 숨김</button><button className="danger" onClick={deleteSection}><Trash2 size={14} /> 삭제</button></div>}<button className="inspector-ai-button" onClick={() => setLeftPanel("ai")}><Sparkles size={15} /> AI로 선택 영역 다시 설계</button></aside>}
      </div>

      {toast && <div className="editor-toast"><Save size={14} /> {toast}</div>}
      {showAddSection && <AddSectionModal onClose={() => setShowAddSection(false)} onAdd={addAiSection} />}
      {showVersions && <VersionModal versions={versions} current={source} activeVersionId={activeVersionId} busy={persistBusy} onClose={() => setShowVersions(false)} onSave={saveVersion} onRestore={restoreVersion} />}
      {showPublish && <PublishModal projectId={projectId} saveStateLabel={autosaveLabel(autosaveState, lastSavedAt)} onClose={() => setShowPublish(false)} />}
    </main>
  );
}

function pickerColor(value: string) {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  const short = value.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  const rgb = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) return `#${rgb.slice(1, 4).map((part) => Math.min(255, Number(part)).toString(16).padStart(2, "0")).join("")}`;
  return "#000000";
}

function normalizeCssValue(value: string, defaultUnit?: string) {
  const trimmed = value.trim();
  if (!trimmed || !defaultUnit || !/^-?(?:\d+|\d*\.\d+)$/.test(trimmed)) return trimmed;
  return `${trimmed}${defaultUnit}`;
}

function editableCssValue(value: string, defaultUnit?: string) {
  if (!defaultUnit) return value;
  const match = value.trim().match(new RegExp(`^(-?(?:\\d+|\\d*\\.\\d+))${defaultUnit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"));
  return match?.[1] ?? value;
}

function DraftInput({ syncKey, value, onCommit, type = "text", inputMode, placeholder, ariaLabel }: { syncKey: string; value: string; onCommit: (value: string) => void; type?: "text" | "url"; inputMode?: "decimal"; placeholder?: string; ariaLabel?: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [syncKey, value]);
  const commitDraft = () => onCommit(draft.trim());
  return <input type={type} inputMode={inputMode} aria-label={ariaLabel} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commitDraft} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitDraft(); event.currentTarget.blur(); } else if (event.key === "Escape") { setDraft(value); event.currentTarget.blur(); } }} placeholder={placeholder} />;
}

function CssValueField({ nodeId, property, value, onStyle, defaultUnit, placeholder }: { nodeId: string; property: string; value: string; onStyle: (property: string, value: string) => void; defaultUnit?: string; placeholder?: string }) {
  return <DraftInput syncKey={`${nodeId}:${property}`} value={editableCssValue(value, defaultUnit)} inputMode="decimal" placeholder={placeholder} onCommit={(draft) => onStyle(property, normalizeCssValue(draft, defaultUnit))} />;
}

function numericCssValue(value: string, fallback: number) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function NumericSlider({ syncKey, label, value, min, max, step, onPreview, onCommit }: { syncKey: string; label: string; value: number; min: number; max: number; step: number; onPreview: (value: number) => void; onCommit: (value: number) => void }) {
  const normalizedValue = Math.min(max, Math.max(min, value));
  const [draft, setDraft] = useState(String(Number(normalizedValue.toFixed(3))));
  const rangeRef = useRef<HTMLInputElement>(null);
  const draftNumber = Number(draft);
  const rangeValue = Number.isFinite(draftNumber) ? Math.min(max, Math.max(min, draftNumber)) : normalizedValue;
  useEffect(() => setDraft(String(Number(normalizedValue.toFixed(3)))), [normalizedValue, syncKey]);
  useEffect(() => {
    const range = rangeRef.current;
    if (!range) return;
    const commitRange = () => onCommit(Number(range.value));
    range.addEventListener("change", commitRange);
    return () => range.removeEventListener("change", commitRange);
  }, [onCommit, syncKey]);
  const commitDraft = () => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed)) onCommit(Math.min(max, Math.max(min, parsed)));
    else setDraft(String(Number(normalizedValue.toFixed(3))));
  };
  return <div className="numeric-slider"><input type="number" aria-label={label} min={min} max={max} step={step} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commitDraft} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commitDraft(); event.currentTarget.blur(); } else if (event.key === "Escape") { setDraft(String(Number(normalizedValue.toFixed(3)))); event.currentTarget.blur(); } }} /><input ref={rangeRef} type="range" aria-label={`${label} 조절바`} min={min} max={max} step={step} value={rangeValue} onInput={(event) => { const next = Number(event.currentTarget.value); setDraft(event.currentTarget.value); onPreview(next); }} onBlur={(event) => onCommit(Number(event.currentTarget.value))} /></div>;
}

function ColorField({ nodeId, property, value, onPreview, onChange, placeholder }: { nodeId: string; property: string; value: string; onPreview: (value: string) => void; onChange: (value: string) => void; placeholder: string }) {
  const [draft, setDraft] = useState(value);
  const pickerRef = useRef<HTMLInputElement>(null);
  useEffect(() => setDraft(value), [nodeId, property, value]);
  useEffect(() => {
    const picker = pickerRef.current;
    if (!picker) return;
    const commitPicker = () => onChange(picker.value);
    picker.addEventListener("change", commitPicker);
    return () => picker.removeEventListener("change", commitPicker);
  }, [nodeId, onChange, property]);
  return <div className="color-input"><input ref={pickerRef} type="color" aria-label="색상 선택" value={pickerColor(draft)} onInput={(event) => { const next = event.currentTarget.value; setDraft(next); onPreview(next); }} onBlur={(event) => onChange(event.currentTarget.value)} /><input type="text" aria-label="색상 값" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={(event) => onChange(event.currentTarget.value.trim())} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onChange(event.currentTarget.value.trim()); event.currentTarget.blur(); } else if (event.key === "Escape") { setDraft(value); onPreview(value); event.currentTarget.blur(); } }} placeholder={placeholder} /></div>;
}

function scaleParts(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean).map(Number);
  const horizontal = Number.isFinite(parts[0]) ? parts[0] : 1;
  const vertical = Number.isFinite(parts[1]) ? parts[1] : horizontal;
  return [horizontal, vertical] as const;
}

function positionParts(value: string) {
  const parts = value.trim().split(/\s+/);
  const parsePart = (part: string | undefined) => {
    if (!part?.trim()) return 50;
    const numeric = Number(part.replace("%", ""));
    return Number.isFinite(numeric) ? Math.min(100, Math.max(0, numeric)) : 50;
  };
  return [parsePart(parts[0]), parsePart(parts[1])] as const;
}

function HeaderInspector({ projectId, headerVariant, headerContentColor, presentation, onHeaderVariant, onContentColor, onPreviewPresentation, onPresentation }: { projectId: string | null; headerVariant: EditorHeaderVariant; headerContentColor: "dark" | "light"; presentation: ProjectHeaderPresentation; onHeaderVariant: (variant: EditorHeaderVariant) => void; onContentColor: (value: "dark" | "light") => void; onPreviewPresentation: (value: ProjectHeaderPresentation) => void; onPresentation: (value: ProjectHeaderPresentation) => void }) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const updateLogo = (patch: Partial<ProjectHeaderPresentation["logo"]>) => onPresentation({ ...presentation, logo: { ...presentation.logo, ...patch } });
  const updateAnnouncement = (patch: Partial<ProjectHeaderPresentation["announcement"]>) => onPresentation({ ...presentation, announcement: { ...presentation.announcement, ...patch } });
  const previewLogo = (patch: Partial<ProjectHeaderPresentation["logo"]>) => onPreviewPresentation({ ...presentation, logo: { ...presentation.logo, ...patch } });
  const previewAnnouncement = (patch: Partial<ProjectHeaderPresentation["announcement"]>) => onPreviewPresentation({ ...presentation, announcement: { ...presentation.announcement, ...patch } });

  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    setImageBusy(true); setImageError(null);
    try {
      const optimized = await optimizeImageFile(file);
      const stored = projectId ? await persistProjectAsset(optimized, "logo", { projectId }) : null;
      updateLogo({ mode: "image", imageUrl: stored?.url ?? optimized });
      if (projectId && stored?.storagePath) {
        const response = await fetch(`/api/projects/${projectId}/assets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storagePath: stored.storagePath, kind: "logo" }) });
        if (!response.ok) throw new Error("업로드한 로고 정보를 저장하지 못했습니다.");
      }
    } catch (error) { setImageError(error instanceof Error ? error.message : "로고를 업로드하지 못했습니다."); }
    finally { setImageBusy(false); if (imageInputRef.current) imageInputRef.current.value = ""; }
  }

  return <div className="inspector-fields header-inspector-fields">
    <div className="header-variant-fields"><b>헤더 형식</b><span>검색·로그인·장바구니 Cafe24 기능은 그대로 유지됩니다.</span><div className="option-grid header-variant-grid">{HEADER_VARIANT_OPTIONS.map((option) => <button type="button" key={option.value} className={headerVariant === option.value ? "active" : ""} onClick={() => onHeaderVariant(option.value)}>{option.label}</button>)}</div></div>
    <section className="header-control-section"><b>글자·아이콘 색상</b><div className="option-grid"><button type="button" className={headerContentColor === "dark" ? "active" : ""} onClick={() => onContentColor("dark")}>검정</button><button type="button" className={headerContentColor === "light" ? "active" : ""} onClick={() => onContentColor("light")}>흰색</button></div></section>
    <section className="header-control-section"><b>로고</b><div className="option-grid logo-mode-grid"><button type="button" className={presentation.logo.mode === "text" ? "active" : ""} onClick={() => updateLogo({ mode: "text" })}>텍스트 로고</button><button type="button" className={presentation.logo.mode === "image" ? "active" : ""} onClick={() => updateLogo({ mode: "image" })}>이미지 로고</button></div>
      {presentation.logo.mode === "text" ? <>
        <label><span>로고 문구</span><DraftInput syncKey="header-logo-text" value={presentation.logo.text ?? ""} onCommit={(text) => updateLogo({ text })} placeholder="브랜드명" /></label>
        <label><span>폰트</span><select value={presentation.logo.fontFamily ?? "inherit"} onChange={(event) => updateLogo({ fontFamily: event.target.value })}><option value="inherit">디자인 기본값</option><option value="Arial, sans-serif">Sans</option><option value="Pretendard, Arial, sans-serif">Pretendard</option><option value="Georgia, serif">Serif</option><option value="monospace">Mono</option></select></label>
        <label><span>글자 크기 <em>px</em></span><NumericSlider syncKey="header-logo-text-size" label="텍스트 로고 크기" value={presentation.logo.textSize ?? 26} min={18} max={64} step={1} onPreview={(textSize) => previewLogo({ textSize })} onCommit={(textSize) => updateLogo({ textSize })} /></label>
        <label><span>행간 <em>배율</em></span><NumericSlider syncKey="header-logo-line-height" label="텍스트 로고 행간" value={presentation.logo.lineHeight ?? 1} min={0.7} max={2} step={0.05} onPreview={(lineHeight) => previewLogo({ lineHeight })} onCommit={(lineHeight) => updateLogo({ lineHeight })} /></label>
        <label><span>자간 <em>px</em></span><NumericSlider syncKey="header-logo-letter-spacing" label="텍스트 로고 자간" value={presentation.logo.letterSpacing ?? 2} min={-10} max={30} step={0.5} onPreview={(letterSpacing) => previewLogo({ letterSpacing })} onCommit={(letterSpacing) => updateLogo({ letterSpacing })} /></label>
        <label><span>굵기</span><select value={String(presentation.logo.fontWeight ?? 800)} onChange={(event) => updateLogo({ fontWeight: Number(event.target.value) })}><option value="300">Light</option><option value="400">Regular</option><option value="500">Medium</option><option value="600">Semi Bold</option><option value="700">Bold</option><option value="800">Extra Bold</option><option value="900">Black</option></select></label>
        <label><span>글자색</span><ColorField nodeId="header-logo" property="color" value={presentation.logo.textColor ?? ""} onPreview={(textColor) => previewLogo({ textColor })} onChange={(textColor) => updateLogo({ textColor })} placeholder="#171713" /></label>
      </> : <><label><span>로고 이미지 URL</span><DraftInput syncKey="header-logo-image" type="url" value={presentation.logo.imageUrl ?? ""} onCommit={(imageUrl) => updateLogo({ imageUrl })} placeholder="https://… 또는 파일 업로드" /></label><input ref={imageInputRef} className="visually-hidden-file" type="file" accept="image/*" onChange={(event) => void uploadLogo(event.target.files?.[0])} /><button type="button" className="replace-image-button" disabled={imageBusy} onClick={() => imageInputRef.current?.click()}>{imageBusy ? <LoaderCircle size={14} /> : <ImagePlus size={14} />} {imageBusy ? "로고 준비 중" : "이미지 로고 업로드"}</button>{imageError ? <p className="image-upload-error">{imageError}</p> : null}<label><span>표시 높이 <em>px</em></span><NumericSlider syncKey="header-logo-image-height" label="이미지 로고 높이" value={presentation.logo.imageHeight ?? 38} min={20} max={72} step={1} onPreview={(imageHeight) => previewLogo({ imageHeight })} onCommit={(imageHeight) => updateLogo({ imageHeight })} /></label><small className="header-control-help">가로 비율은 자동으로 유지되고 작은 화면에서는 최대 32px로 축소됩니다.</small></>}
    </section>
    <section className="header-control-section announcement-controls"><div className="header-control-heading"><b>띠배너</b><button type="button" className={presentation.announcement.visible ? "active" : ""} onClick={() => updateAnnouncement({ visible: !presentation.announcement.visible })}>{presentation.announcement.visible ? "표시 중" : "숨김"}</button></div>
      <label><span>문구</span><DraftInput syncKey="announcement-text" value={presentation.announcement.text} onCommit={(text) => updateAnnouncement({ text })} placeholder="배송·이벤트 안내" /></label><label><span>링크</span><DraftInput syncKey="announcement-link" type="url" value={presentation.announcement.href ?? ""} onCommit={(href) => updateAnnouncement({ href })} placeholder="/event.html 또는 https://…" /></label><div className="announcement-color-grid"><label><span>배경색</span><ColorField nodeId="announcement" property="background" value={presentation.announcement.backgroundColor} onPreview={(backgroundColor) => previewAnnouncement({ backgroundColor })} onChange={(backgroundColor) => updateAnnouncement({ backgroundColor })} placeholder="#171713" /></label><label><span>글자색</span><ColorField nodeId="announcement" property="text" value={presentation.announcement.textColor} onPreview={(textColor) => previewAnnouncement({ textColor })} onChange={(textColor) => updateAnnouncement({ textColor })} placeholder="#ffffff" /></label></div><label><span>높이 <em>px</em></span><NumericSlider syncKey="announcement-height" label="띠배너 높이" value={presentation.announcement.height} min={24} max={72} step={1} onPreview={(height) => previewAnnouncement({ height })} onCommit={(height) => updateAnnouncement({ height })} /></label>
    </section>
  </div>;
}

function NodeInspector({ node, renderMetrics, projectId, productPresentation, thumbRatioOverride, headerVariant, headerContentColor, headerPresentation, onPreviewHeaderPresentation, onHeaderContentColor, onHeaderPresentation, onHeaderVariant, onText, onAttribute, onStyle, onStyles, onPreviewStyle, onImageSource }: { node: NodeSnapshot; renderMetrics: SelectionRenderMetrics | null; projectId: string | null; productPresentation: string; thumbRatioOverride?: string; headerVariant: EditorHeaderVariant; headerContentColor: "dark" | "light"; headerPresentation: ProjectHeaderPresentation; onPreviewHeaderPresentation: (value: ProjectHeaderPresentation) => void; onHeaderContentColor: (value: "dark" | "light") => void; onHeaderPresentation: (value: ProjectHeaderPresentation) => void; onHeaderVariant: (variant: EditorHeaderVariant) => void; onText: (value: string) => void; onAttribute: (name: string, value: string) => void; onStyle: (property: string, value: string) => void; onStyles: (styles: Record<string, string>) => void; onPreviewStyle: (property: string, value: string) => void; onImageSource: (value: string, kind: ImageEditKind) => void }) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const isText = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "a", "button"].includes(node.tagName);
  const isIcon = node.tagName === "svg" || node.type.toLowerCase().includes("icon");
  const imageKind: ImageEditKind = isIcon ? "icon" : node.tagName === "img" ? "content" : "background";
  const canReplaceImage = !node.insideProductSlot && (node.tagName === "img" || isIcon || !isText);
  const guidance = productThumbnailGuidance(productPresentation, thumbRatioOverride);
  const currentImageUrl = imageKind === "content" ? node.src : imageKind === "background" ? imageUrlFromCss(node.style.backgroundImage) : "";
  const [scaleX] = scaleParts(node.style.scale);
  const [imageX, imageY] = positionParts(node.style.objectPosition);
  /**
   * object-position Y는 값이 커질수록 이미지의 아래쪽을 기준으로 맞추므로
   * 사진 내용은 위로 이동해 보입니다. 슬라이더 증가 방향을 CSS 값과 그대로 맞춥니다.
   */
  const [translateX, translateY] = (() => {
    const values = node.style.translate.trim().split(/\s+/);
    return [numericCssValue(values[0] ?? "", 0), numericCssValue(values[1] ?? "", 0)] as const;
  })();
  const isLayout = ["section", "header", "footer", "main", "div", "ul", "ol"].includes(node.tagName) || ["hero", "section", "products", "layout"].some((token) => node.type.toLowerCase().includes(token));
  const actualWidth = Math.max(1, Math.round(renderMetrics?.width ?? numericCssValue(node.style.width, 320)));
  const actualHeight = Math.max(1, Math.round(renderMetrics?.height ?? numericCssValue(node.style.height || node.style.minHeight, 480)));
  const actualFontSize = Math.max(6, renderMetrics?.fontSize ?? numericCssValue(node.style.fontSize, 32));
  const actualLineHeight = renderMetrics?.lineHeight && actualFontSize ? renderMetrics.lineHeight / actualFontSize : numericCssValue(node.style.lineHeight, 1.2);
  const actualLetterSpacing = renderMetrics?.letterSpacing ?? numericCssValue(node.style.letterSpacing, 0);

  async function upload(file: File | undefined) {
    if (!file) return;
    setImageBusy(true); setImageError(null);
    try {
      const optimized = await optimizeImageFile(file);
      const stored = projectId ? await persistProjectAsset(optimized, "image", { projectId }) : null;
      onImageSource(stored?.url ?? optimized, imageKind);
      if (projectId && stored?.storagePath) {
        const response = await fetch(`/api/projects/${projectId}/assets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storagePath: stored.storagePath, kind: "reference" }) });
        if (!response.ok) throw new Error("업로드한 이미지 정보를 저장하지 못했습니다.");
      }
    }
    catch (error) { setImageError(error instanceof Error ? error.message : "이미지를 업로드하지 못했습니다."); }
    finally { setImageBusy(false); if (imageInputRef.current) imageInputRef.current.value = ""; }
  }

  function updateImagePosition(axis: "x" | "y", draft: string) {
    const percent = Number(draft);
    if (!Number.isFinite(percent)) return;
    const nextX = axis === "x" ? Math.min(100, Math.max(0, percent)) : imageX;
    const nextY = axis === "y" ? Math.min(100, Math.max(0, percent)) : imageY;
    onStyle("object-position", `${nextX}% ${nextY}%`);
  }

  function setLayoutHeight(height: number) {
    const pixels = `${Math.max(1, Math.round(height))}px`;
    onStyles({ height: pixels, "min-height": pixels });
  }

  /** 요소를 중앙 기준으로 키우고 줄입니다. transform-origin 기본값이 중앙이라 모든 화면폭에서 같은 기준으로 축소됩니다. */
  function setUniformScale(percent: number, preview = false) {
    const next = String(Math.max(0.1, percent / 100));
    if (preview) onPreviewStyle("scale", next); else onStyle("scale", next);
  }

  function setTranslate(axis: "x" | "y", value: number, preview = false) {
    const nextX = axis === "x" ? Math.round(value) : translateX;
    const nextY = axis === "y" ? Math.round(value) : translateY;
    const next = `${nextX}px ${nextY}px`;
    if (preview) onPreviewStyle("translate", next); else onStyle("translate", next);
  }

  /** Inspector의 Y 슬라이더는 오른쪽(양수)일수록 화면 위쪽으로 이동합니다. */
  function setVerticalSliderPosition(value: number, preview = false) {
    setTranslate("y", -Math.round(value), preview);
  }

  // Header의 기능 DOM은 고정하고, content color·로고·띠배너·variant 표시 설정만 Project Source에 저장합니다.
  if (node.isHeader) {
    return <HeaderInspector projectId={projectId} headerVariant={headerVariant} headerContentColor={headerContentColor} presentation={headerPresentation} onHeaderVariant={onHeaderVariant} onContentColor={onHeaderContentColor} onPreviewPresentation={onPreviewHeaderPresentation} onPresentation={onHeaderPresentation} />;
  }

  return <div className="inspector-fields">
    {node.isProductSection ? <div className="product-guidance"><span>상품 썸네일 권장 규격</span><b>{guidance.label}</b><dl><div><dt>비율</dt><dd>{guidance.ratio}</dd></div><div><dt>크기</dt><dd>{guidance.size}</dd></div></dl>{guidance.note ? <small>{guidance.note}</small> : null}<small>Cafe24 상품 이미지를 이 규격에 맞추면 가장 안정적으로 보입니다.</small></div> : null}
    {isText && <label><span>내용</span><textarea rows={node.tagName === "p" ? 5 : 3} value={node.text} onChange={(event) => onText(event.target.value)} /></label>}
    {(node.tagName === "a" || node.tagName === "button") && <label><span>링크</span><input type="text" value={node.href} onChange={(event) => onAttribute("href", event.target.value)} placeholder="/product/list.html" /></label>}
    {node.insideProductSlot && node.tagName === "img" ? <div className="protected-product-image"><b>Cafe24 상품 썸네일</b><span>상품 데이터 바인딩을 보호하기 위해 Editor에서 교체하지 않습니다.</span></div> : null}
    {canReplaceImage ? <><label><span>{imageKind === "content" ? "이미지 URL" : imageKind === "icon" ? "아이콘 이미지 URL" : "배경 이미지 URL"}</span><DraftInput syncKey={`${node.id}:${imageKind}`} type="url" value={currentImageUrl} onCommit={(value) => { if (imageKind === "background" && !value) onStyle("background-image", ""); else if (value && value !== currentImageUrl) onImageSource(value, imageKind); }} placeholder={imageKind === "background" ? "https://… 또는 파일 업로드" : "https://…"} /></label>{imageKind === "content" ? <label><span>대체 텍스트</span><input type="text" value={node.alt} onChange={(event) => onAttribute("alt", event.target.value)} /></label> : null}<input ref={imageInputRef} className="visually-hidden-file" type="file" accept="image/*" onChange={(event) => void upload(event.target.files?.[0])} /><button type="button" className="replace-image-button" disabled={imageBusy} onClick={() => imageInputRef.current?.click()}>{imageBusy ? <LoaderCircle size={14} /> : <ImagePlus size={14} />} {imageBusy ? "이미지 준비 중" : imageKind === "background" ? "배경 이미지 교체" : imageKind === "icon" ? "아이콘 교체" : "이미지 교체"}</button>{imageError ? <p className="image-upload-error">{imageError}</p> : null}</> : null}
    {node.tagName === "img" && !node.insideProductSlot ? <div className="image-position-fields"><b>이미지 위치·크기</b><span>보이는 중심과 크기를 조절합니다. 크기는 중앙을 기준으로 커지고 작아지며, 태블릿·모바일은 화면폭에 맞춰 그대로 줄어듭니다.</span><div><label><span>보이는 중심 X <em>%</em></span><NumericSlider syncKey={`${node.id}:object-x`} label="이미지 가로 중심" value={imageX} min={0} max={100} step={1} onPreview={(value) => onPreviewStyle("object-position", `${value}% ${imageY}%`)} onCommit={(value) => updateImagePosition("x", String(value))} /></label><label><span>세로 위치 Y <em>%</em></span><NumericSlider syncKey={`${node.id}:object-y`} label="이미지 세로 중심" value={imageY} min={0} max={100} step={1} onPreview={(value) => onPreviewStyle("object-position", `${imageX}% ${value}%`)} onCommit={(value) => updateImagePosition("y", String(value))} /></label><label><span>크기 배율 <em>%</em></span><NumericSlider syncKey={`${node.id}:image-scale`} label="이미지 크기 배율" value={Math.round(scaleX * 100)} min={20} max={200} step={1} onPreview={(value) => setUniformScale(value, true)} onCommit={(value) => setUniformScale(value)} /></label></div><div><label><span>좌우 위치 <em>px</em></span><NumericSlider syncKey={`${node.id}:image-translate-x`} label="이미지 좌우 위치" value={translateX} min={-400} max={400} step={1} onPreview={(value) => setTranslate("x", value, true)} onCommit={(value) => setTranslate("x", value)} /></label><label><span>상하 위치 <em>px</em></span><NumericSlider syncKey={`${node.id}:image-translate-y`} label="이미지 상하 위치" value={-translateY} min={-400} max={400} step={1} onPreview={(value) => setVerticalSliderPosition(value, true)} onCommit={(value) => setVerticalSliderPosition(value)} /></label></div></div> : null}
    {isText && <>
      <label><span>폰트</span><select value={node.style.fontFamily || ""} onChange={(event) => onStyle("font-family", event.target.value)}><option value="">디자인 기본값</option><option value="Arial, sans-serif">Sans</option><option value="Pretendard, Arial, sans-serif">Pretendard</option><option value="Georgia, serif">Serif</option><option value="monospace">Mono</option></select></label>
      <label><span>글자 크기 <em>px</em></span><NumericSlider syncKey={`${node.id}:font-size`} label="글자 크기" value={actualFontSize} min={6} max={240} step={1} onPreview={(value) => onPreviewStyle("font-size", `${value}px`)} onCommit={(value) => onStyle("font-size", `${value}px`)} /></label>
      <label><span>행간 <em>배율</em></span><NumericSlider syncKey={`${node.id}:line-height`} label="행간" value={actualLineHeight} min={0.6} max={3} step={0.05} onPreview={(value) => onPreviewStyle("line-height", String(value))} onCommit={(value) => onStyle("line-height", String(value))} /></label>
      <label><span>자간 <em>px</em></span><NumericSlider syncKey={`${node.id}:letter-spacing`} label="자간" value={actualLetterSpacing} min={-20} max={60} step={0.5} onPreview={(value) => onPreviewStyle("letter-spacing", `${value}px`)} onCommit={(value) => onStyle("letter-spacing", `${value}px`)} /></label>
      <div className="scale-fields"><label><span>크기 배율 <em>%</em></span><NumericSlider syncKey={`${node.id}:text-scale`} label="텍스트 크기 배율" value={Math.round(scaleX * 100)} min={40} max={200} step={1} onPreview={(value) => setUniformScale(value, true)} onCommit={(value) => setUniformScale(value)} /></label></div>
      <div className="scale-fields"><label><span>좌우 위치 X <em>px</em></span><NumericSlider syncKey={`${node.id}:translate-x`} label="텍스트 좌우 위치" value={translateX} min={-400} max={400} step={1} onPreview={(value) => setTranslate("x", value, true)} onCommit={(value) => setTranslate("x", value)} /></label><label><span>상하 위치 Y <em>px</em></span><NumericSlider syncKey={`${node.id}:translate-y`} label="텍스트 상하 위치" value={-translateY} min={-400} max={400} step={1} onPreview={(value) => setVerticalSliderPosition(value, true)} onCommit={(value) => setVerticalSliderPosition(value)} /></label></div>
      <label><span>굵기</span><select value={node.style.fontWeight || ""} onChange={(event) => onStyle("font-weight", event.target.value)}><option value="">기본값</option><option value="300">Light</option><option value="400">Regular</option><option value="500">Medium</option><option value="700">Bold</option></select></label>
      <label><span>글자 색상</span><ColorField nodeId={node.id} property="color" value={node.style.color || ""} onPreview={(value) => onPreviewStyle("color", value)} onChange={(value) => onStyle("color", value)} placeholder="#111111" /></label>
      <label><span>정렬</span><div className="option-grid">{["left", "center", "right"].map((align) => <button type="button" className={node.style.textAlign === align ? "active" : ""} key={align} onClick={() => onStyle("text-align", align)}>{align === "left" ? "왼쪽" : align === "center" ? "가운데" : "오른쪽"}</button>)}</div></label>
      <div className="text-style-toggles"><button type="button" className={node.style.textDecorationLine.includes("underline") ? "active" : ""} onClick={() => onStyle("text-decoration-line", node.style.textDecorationLine.includes("underline") ? "" : "underline")}>밑줄</button><button type="button" className={node.style.fontStyle === "italic" ? "active" : ""} onClick={() => onStyle("font-style", node.style.fontStyle === "italic" ? "" : "italic")}>기울임</button></div>
    </>}
    {(node.tagName === "section" || node.tagName === "header" || node.tagName === "footer") ? <><label><span>배경 색상</span><ColorField nodeId={node.id} property="background-color" value={node.style.backgroundColor || ""} onPreview={(value) => onPreviewStyle("background-color", value)} onChange={(value) => onStyle("background-color", value)} placeholder="#ffffff" /></label><label><span>최대 폭</span><DraftInput syncKey={`${node.id}:max-width`} value={node.style.maxWidth || ""} onCommit={(value) => onStyle("max-width", value)} placeholder="100% 또는 1200px" /></label></> : null}
    {isLayout ? <div className="layout-fields"><b>레이아웃 높이</b><span>현재 렌더 높이 {actualHeight}px을 기준으로 실제 세로폭을 조절합니다.</span><label><span>높이 <em>px</em></span><NumericSlider syncKey={`${node.id}:layout-height`} label="레이아웃 높이" value={actualHeight} min={40} max={4000} step={1} onPreview={(value) => onPreviewStyle("height", `${value}px`)} onCommit={setLayoutHeight} /></label><div className="height-scale-control"><label><span>현재 높이 배율</span><DraftInput syncKey={`${node.id}:height-ratio:${actualHeight}`} value="1" inputMode="decimal" onCommit={(value) => { const ratio = Number(value.replace(/x$/i, "")); if (Number.isFinite(ratio) && ratio > 0) setLayoutHeight(actualHeight * ratio); }} placeholder="예: 1.2 또는 1.5" /></label><div>{[0.8, 1.2, 1.5].map((ratio) => <button type="button" key={ratio} onClick={() => setLayoutHeight(actualHeight * ratio)}>{ratio}×</button>)}</div></div></div> : null}
    {isLayout ? <div className="spacing-fields"><b>위아래 여백</b><span>바깥 여백은 영역 사이 거리, 안쪽 여백은 영역 내부 공간입니다.</span><div><label><span>바깥 위</span><CssValueField nodeId={node.id} property="margin-top" value={node.style.marginTop || `${renderMetrics?.marginTop ?? 0}px`} defaultUnit="px" onStyle={onStyle} placeholder="0" /></label><label><span>바깥 아래</span><CssValueField nodeId={node.id} property="margin-bottom" value={node.style.marginBottom || `${renderMetrics?.marginBottom ?? 0}px`} defaultUnit="px" onStyle={onStyle} placeholder="0" /></label><label><span>안쪽 위</span><CssValueField nodeId={node.id} property="padding-top" value={node.style.paddingTop || `${renderMetrics?.paddingTop ?? 0}px`} defaultUnit="px" onStyle={onStyle} placeholder="0" /></label><label><span>안쪽 아래</span><CssValueField nodeId={node.id} property="padding-bottom" value={node.style.paddingBottom || `${renderMetrics?.paddingBottom ?? 0}px`} defaultUnit="px" onStyle={onStyle} placeholder="0" /></label></div></div> : null}
  </div>;
}

function AddSectionModal({ onClose, onAdd }: { onClose: () => void; onAdd: (prompt: string) => Promise<void> }) {
  const [prompt, setPrompt] = useState("");
  return <div className="modal-backdrop"><div className="editor-modal add-ai-section-modal"><div className="modal-title"><div><Sparkles size={18} /><b>AI로 새 섹션 설계</b></div><button onClick={onClose}><X size={17} /></button></div><div className="add-section-form"><p>정해진 섹션 타입을 고르지 않습니다. 필요한 역할과 구성을 자연어로 설명하면 AI가 HTML/CSS를 직접 설계합니다.</p><textarea rows={6} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="예: 대표 제품 하나를 잡지 표지처럼 크게 보여주고, 재료 디테일을 작은 캡션과 함께 비대칭으로 배치해줘" /><button disabled={prompt.trim().length < 5} onClick={() => void onAdd(prompt.trim())}><Sparkles size={15} /> 새 구조 생성</button></div></div></div>;
}

function VersionModal({ versions, current, activeVersionId, busy, onClose, onSave, onRestore }: { versions: SavedVersion[]; current: ProjectSource; activeVersionId: string | null; busy: boolean; onClose: () => void; onSave: () => Promise<void>; onRestore: (version: SavedVersion) => Promise<void> }) {
  return <div className="modal-backdrop"><div className="editor-modal version-modal"><div className="modal-title"><div><History size={18} /><b>Project Source 버전</b></div><button onClick={onClose}><X size={17} /></button></div><div className="current-version"><div><span>현재 소스</span><b>{current.name}</b></div><button disabled={busy} onClick={() => void onSave()}><Save size={14} /> {busy ? "저장 중" : "버전 저장"}</button></div><div className="version-list">{versions.length === 0 ? <div className="empty-versions"><History size={23} /><b>저장된 버전이 없습니다</b><span>HTML과 CSS가 함께 하나의 버전으로 저장됩니다.</span></div> : versions.map((version) => <div className="version-row" key={version.id}><div><b>{version.label}{version.id === activeVersionId ? " · active" : ""}</b><span>{new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(version.createdAt))}</span></div><button disabled={busy || version.id === activeVersionId} onClick={() => void onRestore(version)}>{version.id === activeVersionId ? "적용 중" : "복원"}</button></div>)}</div></div></div>;
}
