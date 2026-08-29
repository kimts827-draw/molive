import Link from "next/link";
import { ResourceNav } from "@/components/resources/resource-nav";
import { resourceBoard, type ResourceBoardKey } from "@/lib/resources/board";
import type { ResourcePost } from "@/lib/resources/service";
import styles from "./resource-board.module.css";

const dateFormat = new Intl.DateTimeFormat("ko-KR", { dateStyle: "long" });

export function ResourceArticlePage({ board, post, canManage }: { board: ResourceBoardKey; post: ResourcePost; canManage: boolean }) {
  const meta = resourceBoard(board);
  const created = new Date(post.createdAt);

  return <main className={styles.page}>
    <ResourceNav current={board} />
    <article className={styles.article}>
      <span>{meta.eyebrow}</span>
      <h1>{post.title}</h1>
      <div className={styles.articleMeta}><span>{Number.isNaN(created.getTime()) ? "" : dateFormat.format(created)}</span></div>
      {post.imageUrl ? <img className={styles.articleImage} src={post.imageUrl} alt="" /> : null}
      {post.summary ? <p className={styles.articleBody}><b>{post.summary}</b></p> : null}
      <div className={styles.articleBody}>{post.content}</div>
      <div className={styles.articleFoot}>
        <Link href={meta.href}>목록으로</Link>
        {canManage ? <Link href={`${meta.href}/${post.id}/edit`}>수정</Link> : null}
      </div>
    </article>
  </main>;
}
