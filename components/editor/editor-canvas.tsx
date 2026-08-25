"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { buildEditorPreviewDocument } from "@/lib/editor/preview-document";
import { HEADER_NODE_ID } from "@/lib/commerce/fixed-components";
import type { ProjectDocument } from "@/lib/project-document";
import type { EditorNodeSelection, ProjectHeaderPresentation } from "@/lib/project-source";

type EditorCanvasProps = {
  source: ProjectDocument;
  selection: EditorNodeSelection | null;
  previewStylePatch?: PreviewStylePatch | null;
  previewHeaderPresentation?: ProjectHeaderPresentation | null;
  onSelect: (selection: EditorNodeSelection) => void;
  onSelectionMetrics: (metrics: SelectionRenderMetrics | null) => void;
  viewport: "desktop" | "tablet" | "mobile";
};

export type PreviewStylePatch = { nodeId: string; property: string; value: string };
export type SelectionRenderMetrics = {
  nodeId: string;
  renderRevision: number;
  documentFingerprint: string;
  computedFingerprint: string;
  width: number;
  height: number;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  marginTop: number;
  marginBottom: number;
  paddingTop: number;
  paddingBottom: number;
};

const editorOverlayCss = `
[data-moire-id]{cursor:pointer}
[data-moire-id][data-moire-editor-hovered="true"]:not([data-moire-editor-selected="true"]){outline:1px dashed rgba(115,87,232,.82)!important;outline-offset:-1px!important}
[data-moire-id][data-moire-editor-selected="true"]{outline:2px solid #7357e8!important;outline-offset:-2px!important}
`;

const SMALL_HIT_VISUAL_PADDING = 7;

function textFingerprint(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${value.length}:${(hash >>> 0).toString(36)}`;
}

function nodeDepth(node: HTMLElement) {
  let depth = 0;
  for (let parent = node.parentElement; parent; parent = parent.parentElement) depth += 1;
  return depth;
}

function isSmallEditorTarget(node: HTMLElement, rect: DOMRect) {
  const type = (node.dataset.moireType || "").toLowerCase();
  const tag = node.tagName.toLowerCase();
  const semanticSmallTarget = ["text", "icon", "button", "link", "label"].some((value) => type.includes(value))
    || ["a", "button", "svg", "i", "span", "small", "label"].includes(tag);
  return semanticSmallTarget && rect.width > 0 && rect.height > 0 && (rect.width <= 96 || rect.height <= 40);
}

function distanceToRect(x: number, y: number, rect: DOMRect) {
  const dx = Math.max(rect.left - x, 0, x - rect.right);
  const dy = Math.max(rect.top - y, 0, y - rect.bottom);
  return Math.hypot(dx, dy);
}

const PREVIEW_VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 1024, height: 768 },
  mobile: { width: 390, height: 844 },
} as const;

export function EditorCanvas({ source, selection, previewStylePatch = null, previewHeaderPresentation = null, onSelect, onSelectionMetrics, viewport }: EditorCanvasProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const scaleRef = useRef<HTMLDivElement>(null);
  const selectionObserverRef = useRef<ResizeObserver | null>(null);
  const appliedSrcDocRef = useRef("");
  const frameScrollRef = useRef({ x: 0, y: 0 });
  const renderRevisionRef = useRef(0);
  const [previewScale, setPreviewScale] = useState(1);
  const preview = useMemo(() => buildEditorPreviewDocument(source), [source]);
  const isComponentSpec = preview.kind === "component-spec";
  const srcDoc = preview.srcDoc;

  const reportSelectionMetrics = useCallback((node: HTMLElement | null) => {
    if (!node) { onSelectionMetrics(null); return; }
    const view = node.ownerDocument.defaultView;
    const computed = view?.getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    const numeric = (value: string | undefined) => {
      const parsed = Number.parseFloat(value ?? "");
      return Number.isFinite(parsed) ? parsed : 0;
    };
    onSelectionMetrics({
      nodeId: node.dataset.moireId ?? "",
      renderRevision: renderRevisionRef.current,
      documentFingerprint: textFingerprint(node.outerHTML),
      computedFingerprint: JSON.stringify({
        rect: [Math.round(rect.width * 100) / 100, Math.round(rect.height * 100) / 100],
        scroll: [node.scrollWidth, node.scrollHeight],
        color: computed?.color,
        backgroundColor: computed?.backgroundColor,
        backgroundImage: computed?.backgroundImage,
        fontFamily: computed?.fontFamily,
        fontSize: computed?.fontSize,
        fontWeight: computed?.fontWeight,
        fontStyle: computed?.fontStyle,
        lineHeight: computed?.lineHeight,
        letterSpacing: computed?.letterSpacing,
        textAlign: computed?.textAlign,
        textDecorationLine: computed?.textDecorationLine,
        width: computed?.width,
        height: computed?.height,
        minHeight: computed?.minHeight,
        maxWidth: computed?.maxWidth,
        margin: computed?.margin,
        padding: computed?.padding,
        objectPosition: computed?.objectPosition,
        aspectRatio: computed?.aspectRatio,
        translate: computed?.translate,
        scale: computed?.scale,
        transform: computed?.transform,
        display: computed?.display,
        position: computed?.position,
        inset: [computed?.top, computed?.right, computed?.bottom, computed?.left],
      }),
      width: rect.width,
      height: rect.height,
      fontSize: numeric(computed?.fontSize),
      lineHeight: numeric(computed?.lineHeight),
      letterSpacing: numeric(computed?.letterSpacing),
      marginTop: numeric(computed?.marginTop),
      marginBottom: numeric(computed?.marginBottom),
      paddingTop: numeric(computed?.paddingTop),
      paddingBottom: numeric(computed?.paddingBottom),
    });
  }, [onSelectionMetrics]);

  const paintSelection = useCallback(() => {
    selectionObserverRef.current?.disconnect();
    selectionObserverRef.current = null;
    if (isComponentSpec) { onSelectionMetrics(null); return; }
    const document = iframeRef.current?.contentDocument;
    if (!document) { onSelectionMetrics(null); return; }
    document.querySelectorAll("[data-moire-editor-selected]").forEach((node) => node.removeAttribute("data-moire-editor-selected"));
    if (!selection) { onSelectionMetrics(null); return; }
    const node = [...document.querySelectorAll<HTMLElement>("[data-moire-id]")].find((item) => item.dataset.moireId === selection.id);
    node?.setAttribute("data-moire-editor-selected", "true");
    if (node) {
      reportSelectionMetrics(node);
      const observer = new ResizeObserver(() => reportSelectionMetrics(node));
      observer.observe(node);
      selectionObserverRef.current = observer;
    } else onSelectionMetrics(null);
  }, [isComponentSpec, onSelectionMetrics, reportSelectionMetrics, selection]);

  const bindFrame = useCallback(() => {
    // component-spec의 RenderBundle HTML/CSS에는 Editor overlay나 DOM patch를 적용하지 않습니다.
    if (isComponentSpec) return;
    const document = iframeRef.current?.contentDocument;
    const documentElement = document?.documentElement;
    if (!document || !documentElement) return;
    if (documentElement.dataset.moireEditorBound === "true") {
      paintSelection();
      return;
    }
    renderRevisionRef.current += 1;
    documentElement.dataset.moireEditorBound = "true";
    // HeaderV1은 Preview와 Cafe24가 같은 DOM을 쓰므로 편집 메타데이터를 마크업에 넣지 않습니다.
    // Editor에서만 선택할 수 있도록 iframe 안에서 오버레이 속성만 붙입니다.
    const headerElement = document.querySelector<HTMLElement>("header#header.pocHeader");
    if (headerElement && !headerElement.dataset.moireId) {
      headerElement.dataset.moireId = HEADER_NODE_ID;
      headerElement.dataset.moireType = "header";
    }
    const overlay = document.createElement("style");
    overlay.dataset.moireEditorOverlay = "true";
    overlay.textContent = editorOverlayCss;
    document.head.appendChild(overlay);
    let hoveredTarget: HTMLElement | null = null;
    const resolvePointerTarget = (event: MouseEvent | PointerEvent) => {
      const iframe = iframeRef.current;
      const frameScale = iframe && iframe.offsetWidth > 0 ? iframe.getBoundingClientRect().width / iframe.offsetWidth : 1;
      const eventTarget = event.target as Element | null;
      const x = frameScale > 0 && frameScale < 1 ? event.clientX / frameScale : event.clientX;
      const y = frameScale > 0 && frameScale < 1 ? event.clientY / frameScale : event.clientY;
      const correctedTarget = frameScale > 0 && frameScale < 1 ? document.elementFromPoint(x, y) : eventTarget;
      const stack = document.elementsFromPoint(x, y);
      const directTargets: HTMLElement[] = [];
      for (const element of [eventTarget, correctedTarget, ...stack]) {
        const target = typeof element?.closest === "function" ? element.closest<HTMLElement>("[data-moire-id]") : null;
        if (target && !directTargets.includes(target)) directTargets.push(target);
      }

      const directSmallTarget = directTargets[0] && isSmallEditorTarget(directTargets[0], directTargets[0].getBoundingClientRect())
        ? directTargets[0]
        : null;
      if (directSmallTarget) return directSmallTarget;

      // 실제 DOM 크기를 늘리지 않고, 축소된 Editor 화면에서만 작은 텍스트/아이콘 주위의 클릭 허용 범위를 넓힙니다.
      const hitPadding = Math.min(24, SMALL_HIT_VISUAL_PADDING / Math.max(frameScale, 0.25));
      const eventTargetRect = typeof (eventTarget as HTMLElement | null)?.getBoundingClientRect === "function"
        ? (eventTarget as HTMLElement).getBoundingClientRect()
        : null;
      const hitPoints = [{ x, y }];
      if (eventTargetRect && Number.isFinite(event.offsetX) && Number.isFinite(event.offsetY)) {
        hitPoints.push({ x: eventTargetRect.left + event.offsetX, y: eventTargetRect.top + event.offsetY });
      }
      const nearbySmallTargets = [...document.querySelectorAll<HTMLElement>("[data-moire-id]")]
        .map((target) => {
          const rect = target.getBoundingClientRect();
          const distance = Math.min(...hitPoints.map((point) => distanceToRect(point.x, point.y, rect)));
          return { target, rect, distance };
        })
        .filter(({ target, rect }) => {
          if (!isSmallEditorTarget(target, rect)) return false;
          const view = document.defaultView;
          const style = view?.getComputedStyle(target);
          if (style?.visibility === "hidden" || style?.display === "none" || Number(style?.opacity ?? 1) === 0) return false;
          const centerStack = document.elementsFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          if (!centerStack.some((element) => element === target || target.contains(element))) return false;
          return hitPoints.some((point) => point.x >= rect.left - hitPadding && point.x <= rect.right + hitPadding
            && point.y >= rect.top - hitPadding && point.y <= rect.bottom + hitPadding);
        })
        .sort((a, b) => {
          if (a.distance !== b.distance) return a.distance - b.distance;
          return nodeDepth(b.target) - nodeDepth(a.target);
        });

      return nearbySmallTargets[0]?.target ?? directTargets[0] ?? null;
    };
    document.addEventListener("pointermove", (event) => {
      const target = resolvePointerTarget(event);
      if (target === hoveredTarget) return;
      hoveredTarget?.removeAttribute("data-moire-editor-hovered");
      target?.setAttribute("data-moire-editor-hovered", "true");
      hoveredTarget = target;
    }, { passive: true });
    documentElement.addEventListener("pointerleave", () => {
      hoveredTarget?.removeAttribute("data-moire-editor-hovered");
      hoveredTarget = null;
    });
    document.addEventListener("click", (event) => {
      event.preventDefault();
      const target = resolvePointerTarget(event);
      if (!target?.dataset.moireId) return;
      onSelect({ id: target.dataset.moireId, type: target.dataset.moireType || "element", tagName: target.tagName.toLowerCase() });
    });
    const restoreScroll = () => iframeRef.current?.contentWindow?.scrollTo(frameScrollRef.current.x, frameScrollRef.current.y);
    restoreScroll();
    document.defaultView?.requestAnimationFrame(restoreScroll);
    paintSelection();
  }, [isComponentSpec, onSelect, paintSelection]);

  useLayoutEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || appliedSrcDocRef.current === srcDoc) return;
    if (appliedSrcDocRef.current) {
      frameScrollRef.current = {
        x: iframe.contentWindow?.scrollX ?? 0,
        y: iframe.contentWindow?.scrollY ?? 0,
      };
    }
    appliedSrcDocRef.current = srcDoc;
    iframe.srcdoc = srcDoc;
  }, [srcDoc]);

  useEffect(() => { paintSelection(); }, [paintSelection]);
  useEffect(() => () => selectionObserverRef.current?.disconnect(), []);

  useEffect(() => {
    if (isComponentSpec || !previewStylePatch) return;
    const document = iframeRef.current?.contentDocument;
    if (!document?.documentElement) return;
    const node = [...document.querySelectorAll<HTMLElement>("[data-moire-id]")].find((item) => item.dataset.moireId === previewStylePatch.nodeId);
    if (!node) return;
    if (previewStylePatch.value.trim()) node.style.setProperty(previewStylePatch.property, previewStylePatch.value);
    else node.style.removeProperty(previewStylePatch.property);
  }, [isComponentSpec, previewStylePatch]);

  useEffect(() => {
    if (isComponentSpec || !previewHeaderPresentation) return;
    const document = iframeRef.current?.contentDocument;
    if (!document?.documentElement) return;
    const logoText = document.querySelector<HTMLElement>(".pocHeader__logoText");
    const logoImage = document.querySelector<HTMLElement>(".pocHeader__logoImage");
    const announcement = document.querySelector<HTMLElement>(".moireAnnouncementBar");
    const header = document.querySelector<HTMLElement>("#header.pocHeader");
    const textSize = previewHeaderPresentation.logo.textSize ?? 26;
    const imageHeight = previewHeaderPresentation.logo.imageHeight ?? 38;
    if (logoText) {
      logoText.style.fontFamily = previewHeaderPresentation.logo.fontFamily ?? "inherit";
      logoText.style.fontSize = `${viewport === "mobile" ? Math.min(textSize, 26) : viewport === "tablet" ? Math.min(textSize, 34.8) : textSize}px`;
      logoText.style.fontWeight = String(previewHeaderPresentation.logo.fontWeight ?? 800);
      logoText.style.lineHeight = String(previewHeaderPresentation.logo.lineHeight ?? 1);
      logoText.style.letterSpacing = `${previewHeaderPresentation.logo.letterSpacing ?? 2}px`;
      logoText.style.color = previewHeaderPresentation.logo.textColor ?? "inherit";
    }
    if (logoImage) logoImage.style.height = `${viewport === "mobile" ? Math.min(imageHeight, 32) : viewport === "tablet" ? Math.min(imageHeight, 51.2) : imageHeight}px`;
    if (announcement) {
      announcement.style.minHeight = `${Math.min(previewHeaderPresentation.announcement.height, viewport === "mobile" ? 48 : 72)}px`;
      announcement.style.backgroundColor = previewHeaderPresentation.announcement.backgroundColor;
      announcement.style.color = previewHeaderPresentation.announcement.textColor;
    }
    if (header?.classList.contains("pocHeader--overlay-minimal") && announcement) {
      header.style.top = `${previewHeaderPresentation.announcement.height}px`;
    }
  }, [isComponentSpec, previewHeaderPresentation, viewport]);

  useEffect(() => {
    const container = scaleRef.current;
    if (!container) return;
    const resize = () => setPreviewScale(Math.min(1, container.clientWidth / PREVIEW_VIEWPORTS[viewport].width));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [viewport]);

  const previewViewport = PREVIEW_VIEWPORTS[viewport];

  return (
    <div ref={scaleRef} className="project-source-scale" style={{ height: previewViewport.height * previewScale }}>
      <iframe
        ref={iframeRef}
        className={`project-source-frame viewport-${viewport}`}
        width={previewViewport.width}
        height={previewViewport.height}
        data-preview-preset={viewport}
        data-preview-scale={previewScale}
        style={{ width: previewViewport.width, height: previewViewport.height, transform: `scale(${previewScale})` }}
        title="Project Source 미리보기"
        sandbox="allow-same-origin"
        onLoad={bindFrame}
      />
    </div>
  );
}
