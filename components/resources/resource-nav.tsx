import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/brand";
import { RESOURCE_BOARDS, type ResourceBoardKey } from "@/lib/resources/board";
import styles from "./resource-board.module.css";

export function ResourceNav({ current }: { current: ResourceBoardKey }) {
  return <nav className={styles.nav}>
    <Brand />
    <div className={styles.navLinks}>
      {RESOURCE_BOARDS.map((board) => (
        <Link className={board.key === current ? styles.current : undefined} href={board.href} key={board.key}>{board.label}</Link>
      ))}
      <Link href="/"><ArrowLeft size={15} /> 홈으로</Link>
    </div>
  </nav>;
}
