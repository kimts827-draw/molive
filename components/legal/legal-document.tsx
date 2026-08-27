import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { hasSupabaseServerConfig } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";
import styles from "./legal-document.module.css";

export type LegalDocumentName = "terms" | "privacy" | "refund";

function readLegalSource(document: LegalDocumentName) {
  if (document === "terms") return readFile(path.join(process.cwd(), "content", "legal", "terms.md"), "utf8");
  if (document === "privacy") return readFile(path.join(process.cwd(), "content", "legal", "privacy.md"), "utf8");
  return readFile(path.join(process.cwd(), "content", "legal", "refund.md"), "utf8");
}

function inlineMarkdown(text: string, keyPrefix: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => part.startsWith("**") && part.endsWith("**")
    ? <strong key={`${keyPrefix}-${index}`}>{part.slice(2, -2)}</strong>
    : part);
}

function tableCells(line: string) {
  return line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function renderMarkdown(source: string) {
  const visibleSource = source.replace(/<!--[^]*?-->/g, "");
  const lines = visibleSource.replaceAll("\r\n", "\n").split("\n");
  const blocks: ReactNode[] = [];

  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const content = inlineMarkdown(heading[2], `heading-${index}`);
      if (heading[1].length === 1) blocks.push(<h1 key={`block-${index}`}>{content}</h1>);
      else if (heading[1].length === 2) blocks.push(<h2 key={`block-${index}`}>{content}</h2>);
      else blocks.push(<h3 key={`block-${index}`}>{content}</h3>);
      index += 1;
      continue;
    }

    if (/^---\s*$/.test(line)) {
      blocks.push(<hr key={`block-${index}`} />);
      index += 1;
      continue;
    }

    if (line.trim().startsWith("|") && /^\|(?:\s*:?-+:?\s*\|)+\s*$/.test(lines[index + 1] ?? "")) {
      const header = tableCells(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      blocks.push(<div className={styles.tableWrap} key={`block-${index}`}><table><thead><tr>{header.map((cell, cellIndex) => <th key={cellIndex}>{inlineMarkdown(cell, `th-${index}-${cellIndex}`)}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{inlineMarkdown(cell, `td-${index}-${rowIndex}-${cellIndex}`)}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }

    const ordered = line.match(/^\d+\.\s+(.+)$/);
    const unordered = line.match(/^-\s+(.+)$/);
    if (ordered || unordered) {
      const orderedList = Boolean(ordered);
      const items: string[] = [];
      while (index < lines.length) {
        const item = lines[index].match(orderedList ? /^\d+\.\s+(.+)$/ : /^-\s+(.+)$/);
        if (!item) break;
        items.push(item[1]);
        index += 1;
      }
      const children = items.map((item, itemIndex) => <li key={itemIndex}>{inlineMarkdown(item, `li-${index}-${itemIndex}`)}</li>);
      blocks.push(orderedList ? <ol key={`block-${index}`}>{children}</ol> : <ul key={`block-${index}`}>{children}</ul>);
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !/^(#{1,3})\s+|^---\s*$|^\d+\.\s+|^-\s+|^\|/.test(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(<p key={`block-${index}`}>{inlineMarkdown(paragraph.join(" "), `paragraph-${index}`)}</p>);
  }

  return blocks;
}

export async function LegalDocument({ document, pathname }: { document: LegalDocumentName; pathname: string }) {
  const persistenceEnabled = hasSupabaseServerConfig();
  const user = persistenceEnabled ? await getCurrentUser() : null;
  const source = await readLegalSource(document);

  return <main className={styles.page}>
    <SiteHeader userEmail={user?.email ?? null} persistenceEnabled={persistenceEnabled} loginNext={pathname} />
    <article className={styles.document}>{renderMarkdown(source)}</article>
    <SiteFooter />
  </main>;
}
