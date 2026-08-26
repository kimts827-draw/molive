import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check, Download, MonitorDown, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { installerRelease } from "@/lib/installer-release";

export const metadata: Metadata = {
  title: "사용 방법 — MOLIVE",
  description: "MOLIVE에서 만든 디자인을 Installer로 Cafe24에 적용하는 방법",
};

const WORKFLOW = [
  ["AI 디자인 생성", "브랜드와 원하는 분위기를 설명해 첫 디자인을 만듭니다."],
  ["Editor에서 수정", "텍스트, 이미지, 컬러와 레이아웃을 화면에서 다듬습니다."],
  ["ZIP 다운로드", "Editor의 게시 화면에서 현재 디자인 ZIP을 받습니다."],
  ["MOLIVE Installer 설치", "Windows용 Setup 파일을 내려받아 설치합니다."],
  ["Cafe24에 적용", "ZIP과 적용할 스킨을 선택한 뒤 결과를 확인합니다."],
] as const;

export default function GuidePage() {
  return (
    <main className="guide-page">
      <nav className="guide-nav">
        <Brand />
        <Link href="/"><ArrowLeft size={15} /> 홈으로</Link>
      </nav>

      <section className="guide-hero">
        <div className="section-kicker">MOLIVE INSTALL GUIDE</div>
        <h1>만든 디자인을<br /><em>Cafe24에 적용하세요.</em></h1>
        <p>디자인 ZIP을 받은 뒤 MOLIVE Installer에서 순서대로 선택하면 됩니다.</p>
        <a className="button button-dark guide-download" href={installerRelease.downloadPath}>
          <Download size={17} /> Windows Installer 다운로드
        </a>
        <span>현재 버전 v{installerRelease.version} · Setup EXE</span>
      </section>

      <section className="guide-workflow" aria-labelledby="workflow-title">
        <div>
          <span>전체 흐름</span>
          <h2 id="workflow-title">생성부터 적용까지</h2>
        </div>
        <ol>
          {WORKFLOW.map(([title, description], index) => (
            <li key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><h3>{title}</h3><p>{description}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="guide-details">
        <article>
          <MonitorDown />
          <span>WINDOWS</span>
          <h2>Installer 설치</h2>
          <ol>
            <li>위 버튼에서 Setup EXE를 다운로드합니다.</li>
            <li>다운로드한 파일을 실행하고 안내에 따라 설치합니다.</li>
            <li>설치가 끝나면 MOLIVE Installer를 실행합니다.</li>
          </ol>
          <p className="guide-smartscreen"><ShieldCheck size={15} /><span>코드서명 전 버전은 Windows 보호 안내가 표시될 수 있습니다. 파일 출처가 MOLIVE인지 확인한 뒤 <b>추가 정보 → 실행</b>을 선택하세요.</span></p>
        </article>
        <article>
          <Check />
          <span>CAFE24</span>
          <h2>디자인 적용</h2>
          <ol>
            <li>Installer에서 내려받은 디자인 ZIP을 선택합니다.</li>
            <li>Cafe24 접속 정보를 확인합니다.</li>
            <li>적용할 스킨을 선택하고 적용을 시작합니다.</li>
            <li>Cafe24에서 적용 결과를 확인합니다.</li>
          </ol>
          <p className="guide-note">운영 스킨에 적용하기 전, 복제한 테스트 스킨에서 먼저 확인하세요. 적용 중에는 Installer를 종료하지 마세요.</p>
        </article>
      </section>
    </main>
  );
}
