import Link from "next/link";
import { ArrowLeft, FolderOpen } from "lucide-react";
import { Brand } from "@/components/brand";
import styles from "./resource-empty-page.module.css";

export function ResourceEmptyPage({ eyebrow, title, message }: { eyebrow: string; title: string; message: string }) {
  return <main className={styles.page}>
    <nav><Brand /><Link href="/"><ArrowLeft size={15} /> 홈으로</Link></nav>
    <section>
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      <div><FolderOpen size={28} aria-hidden="true" /><p>{message}</p></div>
    </section>
  </main>;
}
