"use client";

import { X } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { useCallback, useEffect, useRef } from "react";
import styles from "./template-lightbox.module.css";

type TemplateLightboxProps = {
  open: boolean;
  category: string;
  ariaLabel: string;
  openerRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  children: ReactNode;
};

/** 홈 예시와 템플릿 게시판이 함께 사용하는 긴 이미지 전체보기 UX입니다. */
export function TemplateLightbox({ open, category, ariaLabel, openerRef, onClose, children }: TemplateLightboxProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => {
    onClose();
    window.requestAnimationFrame(() => openerRef.current?.focus());
  }, [onClose, openerRef]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [close, open]);

  if (!open) return null;

  return (
    <div
      className={styles.lightbox}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className={styles.panel}>
        <div className={styles.toolbar}>
          <strong>{category}</strong>
          <span>전체 쇼핑몰 디자인</span>
          <button ref={closeRef} type="button" onClick={close} aria-label="전체 보기 닫기"><X size={22} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
