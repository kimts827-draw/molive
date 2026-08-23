"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildEditorPreviewDocument } from "@/lib/editor/preview-document";
import type { ProjectDocument } from "@/lib/project-document";
import type { EditorNodeSelection } from "@/lib/project-source";

type EditorCanvasProps = {
  source: ProjectDocument;
  selection: EditorNodeSelection | null;
  onSelect: (selection: EditorNodeSelection) => void;
  viewport: "desktop" | "tablet" | "mobile";
};

const editorOverlayCss = `
[data-moire-id]{cursor:pointer}
[data-moire-id][data-moire-editor-selected="true"]{outline:2px solid #7357e8!important;outline-offset:-2px!important}
[data-moire-id]:hover{outline:1px dashed rgba(115,87,232,.7);outline-offset:-1px}
`;

const PREVIEW_VIEWPORTS = {
  desktop: { width: 1440, height: 1000 },
  tablet: { width: 1024, height: 900 },
  mobile: { width: 390, height: 844 },
} as const;

export function EditorCanvas({ source, selection, onSelect, viewport }: EditorCanvasProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const scaleRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const preview = useMemo(() => buildEditorPreviewDocument(source), [source]);
  const isComponentSpec = preview.kind === "component-spec";
  const srcDoc = preview.srcDoc;

  const paintSelection = useCallback(() => {
    if (isComponentSpec) return;
    const document = iframeRef.current?.contentDocument;
    if (!document) return;
    document.querySelectorAll("[data-moire-editor-selected]").forEach((node) => node.removeAttribute("data-moire-editor-selected"));
    if (!selection) return;
    const node = [...document.querySelectorAll<HTMLElement>("[data-moire-id]")].find((item) => item.dataset.moireId === selection.id);
    node?.setAttribute("data-moire-editor-selected", "true");
    node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [isComponentSpec, selection]);

  const bindFrame = useCallback(() => {
    // component-spec의 RenderBundle HTML/CSS에는 Editor overlay나 DOM patch를 적용하지 않습니다.
    if (isComponentSpec) return;
    const document = iframeRef.current?.contentDocument;
    if (!document) return;
    if (document.documentElement.dataset.moireEditorBound === "true") {
      paintSelection();
      return;
    }
    document.documentElement.dataset.moireEditorBound = "true";
    const overlay = document.createElement("style");
    overlay.dataset.moireEditorOverlay = "true";
    overlay.textContent = editorOverlayCss;
    document.head.appendChild(overlay);
    document.addEventListener("click", (event) => {
      event.preventDefault();
      const eventTarget = event.target as Element | null;
      const target = typeof eventTarget?.closest === "function" ? eventTarget.closest<HTMLElement>("[data-moire-id]") : null;
      if (!target?.dataset.moireId) return;
      onSelect({ id: target.dataset.moireId, type: target.dataset.moireType || "element", tagName: target.tagName.toLowerCase() });
    });
    paintSelection();
  }, [isComponentSpec, onSelect, paintSelection]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.addEventListener("load", bindFrame);
    if (iframe.contentDocument?.readyState === "complete") bindFrame();
    return () => iframe.removeEventListener("load", bindFrame);
  }, [bindFrame, srcDoc]);

  useEffect(() => { paintSelection(); }, [paintSelection]);

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
        style={{ width: previewViewport.width, height: previewViewport.height, transform: `scale(${previewScale})` }}
        title="Project Source 미리보기"
        sandbox="allow-same-origin"
        srcDoc={srcDoc}
        onLoad={bindFrame}
      />
    </div>
  );
}
