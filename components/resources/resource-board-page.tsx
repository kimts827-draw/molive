import Link from "next/link";
import { FolderOpen, PenLine } from "lucide-react";
import { ResourceNav } from "@/components/resources/resource-nav";
import { resourceBoard, type ResourceBoardKey } from "@/lib/resources/board";
import type { ResourcePost } from "@/lib/resources/service";
import styles from "./resource-board.module.css";

const dateFormat = new Intl.DateTimeFormat("ko-KR", { dateStyle: "long" });

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : dateFormat.format(date);
}

/** 공지사항·블로그·자료모음 공용 목록 화면. 템플릿 게시판은 별도 카드 레이아웃을 사용한다. */
export function ResourceBoardPage({ board, posts, canManage }: { board: ResourceBoardKey; posts: ResourcePost[]; canManage: boolean }) {
  const meta = resourceBoard(board);

  return <main className={styles.page}>
    <ResourceNav current={board} />

    <header className={styles.hero}>
      <div><span>{meta.eyebrow}</span><h1>{meta.label}</h1><p>{meta.intro}</p></div>
      {posts.length ? <div className={styles.count}><strong>{posts.length}</strong><span>개의 게시글</span></div> : null}
    </header>

    {canManage ? <div className={styles.adminBar}>
      <span>관리자 계정으로 로그인되어 있습니다.</span>
      <Link className={styles.writeButton} href={`${meta.href}/new`}><PenLine size={14} /> 글쓰기</Link>
    </div> : null}

    {posts.length ? <section className={styles.list} aria-label={`${meta.label} 목록`}>
      {posts.map((post) => <article className={styles.item} key={post.id}>
        <Link href={`${meta.href}/${post.id}`}>
          <div className={styles.itemMeta}><span>{formatDate(post.createdAt)}</span></div>
          <h2>{post.title}</h2>
          {post.summary ? <p>{post.summary}</p> : null}
        </Link>
        {canManage ? <div className={styles.itemActions}><Link href={`${meta.href}/${post.id}/edit`}>수정</Link></div> : null}
      </article>)}
    </section> : <div className={styles.empty}><FolderOpen size={28} aria-hidden="true" /><p>{meta.empty}</p></div>}
  </main>;
}
