"use client";

import { Download, HardDriveDownload, Plug, X } from "lucide-react";

const PUBLISH_STEPS = [
  "디자인 ZIP 다운로드",
  "MOLIVE Installer 설치",
  "Installer에서 ZIP 선택",
  "Cafe24 접속 확인 → 스킨 선택 → 적용",
] as const;

export function PublishModal({ projectId, saveStateLabel, onClose }: { projectId: string | null; saveStateLabel: string; onClose: () => void }) {
  function downloadTheme() {
    if (!projectId) return;
    window.location.href = `/api/cafe24/theme-package?project_id=${encodeURIComponent(projectId)}`;
  }

  return (
    <div className="modal-backdrop">
      <div className="editor-modal publish-modal">
        <div className="modal-title">
          <div><Plug size={18} /><b>Cafe24 적용</b></div>
          <button onClick={onClose} aria-label="게시 창 닫기"><X size={17} /></button>
        </div>
        <div className="publish-form">
          <div className="publish-state"><span>디자인 저장 상태</span><b>{saveStateLabel}</b></div>
          {!projectId ? <p className="publish-warning">디자인 ZIP을 받으려면 먼저 로그인한 프로젝트로 저장해 주세요.</p> : null}
          <div className="publish-downloads">
            <div className="publish-download-card">
              <div><Download size={18} /><p><b>디자인 ZIP</b><span>현재 저장된 디자인 파일</span></p></div>
              <button className="publish-primary" disabled={!projectId} onClick={downloadTheme}><Download size={14} /> ZIP 다운로드</button>
            </div>
            <div className="publish-download-card">
              <div><HardDriveDownload size={18} /><p><b>MOLIVE Installer</b><span>Windows용 Setup 설치 파일</span></p></div>
              <a className="publish-secondary" href="/api/installer/download"><HardDriveDownload size={14} /> Installer 다운로드</a>
            </div>
          </div>
          <ol className="publish-steps">
            {PUBLISH_STEPS.map((step, index) => <li key={step}><span>{index + 1}</span><b>{step}</b></li>)}
          </ol>
          <p className="publish-caution">운영 중인 스킨 대신 복제한 테스트 스킨에서 먼저 확인해 주세요.</p>
        </div>
      </div>
    </div>
  );
}
