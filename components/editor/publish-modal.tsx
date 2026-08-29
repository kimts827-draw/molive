"use client";

import { useState } from "react";
import { Download, HardDriveDownload, LoaderCircle, Plug, X } from "lucide-react";

const PUBLISH_STEPS = [
  "디자인 ZIP 다운로드",
  "MOLIVE Installer 설치",
  "Installer에서 ZIP 선택",
  "Cafe24 접속 확인 → 스킨 선택 → 적용",
] as const;

export function PublishModal({ projectId, saveStateLabel, onFlushDraft, onClose }: { projectId: string | null; saveStateLabel: string; onFlushDraft: () => Promise<boolean>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 내려받기 전에 편집 중인 문서를 먼저 저장합니다.
   * ZIP은 서버의 현재 문서를 그대로 패키징하므로, 저장이 끝난 뒤에만 받아야
   * Editor 화면과 파일 내용이 어긋나지 않습니다.
   */
  async function downloadTheme() {
    if (!projectId || busy) return;
    setBusy(true);
    setError(null);
    const saved = await onFlushDraft();
    setBusy(false);
    if (!saved) {
      setError("편집 내용을 저장하지 못해 내려받기를 멈췄습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.");
      return;
    }
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
          {error ? <p className="publish-warning">{error}</p> : null}
          <div className="publish-downloads">
            <div className="publish-download-card">
              <div><Download size={18} /><p><b>디자인 ZIP</b><span>지금 Editor에 보이는 디자인</span></p></div>
              <button className="publish-primary" disabled={!projectId || busy} onClick={() => void downloadTheme()}>{busy ? <LoaderCircle size={14} /> : <Download size={14} />} {busy ? "저장 중" : "ZIP 다운로드"}</button>
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
