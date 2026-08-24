import Link from "next/link";
import { ArrowRight, Clock3 } from "lucide-react";
import { Brand } from "@/components/brand";
import { listProjects } from "@/lib/projects/service";
import { hasSupabaseServerConfig, missingSupabaseServerEnv } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ProjectsPage() {
  if (!hasSupabaseServerConfig()) {
    return <main className="projects-page"><section className="projects-panel projects-empty"><Brand /><h1>내 디자인을 사용할 수 없습니다</h1><p>개발 환경의 영구 저장이 비활성화돼 있습니다. 필요한 환경변수: {missingSupabaseServerEnv().join(", ")}</p><Link href="/">홈으로</Link></section></main>;
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fprojects");
  const projects = await listProjects(user.id);

  return (
    <main className="projects-page">
      <section className="projects-panel">
        <header className="projects-header"><Brand /><div><span>{user.email ?? "로그인 사용자"}</span><form action="/auth/signout" method="post"><button type="submit">로그아웃</button></form></div></header>
        <div className="projects-title"><div><span>MY DESIGNS</span><h1>내 디자인</h1><p>최근 수정한 프로젝트부터 표시됩니다.</p></div><Link className="button button-dark" href="/#create">새 디자인 <ArrowRight size={15} /></Link></div>
        {projects.length === 0 ? <div className="projects-empty"><h2>아직 저장된 디자인이 없습니다</h2><p>첫 디자인을 생성하면 여기에 자동으로 표시됩니다.</p><Link href="/#create">디자인 만들기</Link></div> : <div className="project-list">{projects.map((project) => <Link className="project-list-item" href={`/editor?project=${encodeURIComponent(project.id)}`} key={project.id}><div><b>{project.name}</b><span><Clock3 size={13} /> {new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(project.updatedAt))}</span></div><span>열기 <ArrowRight size={14} /></span></Link>)}</div>}
      </section>
    </main>
  );
}
