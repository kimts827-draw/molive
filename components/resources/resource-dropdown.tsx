"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import styles from "./resource-dropdown.module.css";

const RESOURCE_LINKS = [
  { href: "/notice", title: "공지사항", description: "MOLIVE 업데이트와 주요 안내" },
  { href: "/blog", title: "블로그", description: "Cafe24와 소규모 쇼핑몰 운영에 도움되는 글" },
  { href: "/resources", title: "자료모음", description: "운영에 바로 쓰는 체크리스트와 자료" },
] as const;

export function ResourceDropdown({ mobile = false }: { mobile?: boolean }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelClose() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }

  function scheduleClose() {
    cancelClose();
    closeTimerRef.current = setTimeout(() => setOpen(false), 160);
  }

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => () => cancelClose(), []);

  const panelId = mobile ? "mobile-resource-menu" : "desktop-resource-menu";
  return (
    <div
      className={`${styles.root} ${mobile ? styles.mobileRoot : styles.desktopRoot}`}
      ref={rootRef}
      onMouseEnter={mobile ? undefined : () => { cancelClose(); setOpen(true); }}
      onMouseLeave={mobile ? undefined : scheduleClose}
      onFocus={mobile ? undefined : () => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button ref={buttonRef} type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((current) => mobile ? !current : true)}>
        자료실 <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open ? <div className={styles.panel} id={panelId}>
        {RESOURCE_LINKS.map((item) => <Link href={item.href} key={item.href} onClick={() => setOpen(false)}>
          <strong>{item.title}</strong>
          <span>{item.description}</span>
        </Link>)}
      </div> : null}
    </div>
  );
}
