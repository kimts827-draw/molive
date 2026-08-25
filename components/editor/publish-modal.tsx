"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, LoaderCircle, Plug, Send, Unplug, X } from "lucide-react";

type Connection = { id: string; mall_id: string; shop_no: number; status: string };
type Installation = { id: string; connection_id: string; skin_no: number; script_no: string | number | null; status: string; last_error: string | null };

export function PublishModal({ projectId, saveStateLabel, onClose }: { projectId: string | null; saveStateLabel: string; onClose: () => void }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [mallId, setMallId] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [skinNo, setSkinNo] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    if (!projectId) return;
    const response = await fetch(`/api/cafe24/status?project_id=${encodeURIComponent(projectId)}`, { cache: "no-store" });
    const payload = await response.json() as { connections?: Connection[]; installations?: Installation[]; error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Cafe24 상태를 읽지 못했습니다.");
    setConnections(payload.connections ?? []); setInstallations(payload.installations ?? []);
    setConnectionId((current) => current || payload.connections?.[0]?.id || "");
  }

  useEffect(() => { void refresh().catch((error) => setMessage(error instanceof Error ? error.message : "Cafe24 상태 오류")); }, [projectId]);
  const selectedInstallation = useMemo(() => installations.find((item) => item.connection_id === connectionId && item.skin_no === skinNo), [connectionId, installations, skinNo]);

  function connect() {
    if (!projectId || !mallId.trim()) return;
    window.location.href = `/api/cafe24/oauth/start?mall_id=${encodeURIComponent(mallId.trim())}&project_id=${encodeURIComponent(projectId)}`;
  }

  function downloadTheme() {
    if (!projectId) return;
    window.location.href = `/api/cafe24/theme-package?project_id=${encodeURIComponent(projectId)}`;
  }

  async function deploy() {
    if (!projectId || !connectionId) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/cafe24/deploy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, connectionId, skinNo, mode: "runtime" }) });
      const payload = await response.json() as { status?: string; reusedScriptTag?: boolean; activeVersionId?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Cafe24 게시에 실패했습니다.");
      setMessage(payload.reusedScriptTag ? "최신 저장 버전을 Cafe24에 반영했습니다." : "Cafe24 적용이 완료되었습니다.");
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Cafe24 게시에 실패했습니다."); }
    finally { setBusy(false); }
  }

  async function unpublish() {
    if (!selectedInstallation) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/cafe24/installations/${selectedInstallation.id}/unpublish`, { method: "POST" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "연동 해제에 실패했습니다.");
      setMessage("Cafe24 적용을 해제하고 원본 화면으로 복구했습니다.");
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "연동 해제에 실패했습니다."); }
    finally { setBusy(false); }
  }

  return <div className="modal-backdrop"><div className="editor-modal publish-modal"><div className="modal-title"><div><Plug size={18} /><b>Cafe24 적용</b></div><button onClick={onClose} aria-label="게시 창 닫기"><X size={17} /></button></div>{!projectId ? <p className="publish-warning">먼저 로그인한 프로젝트로 저장해야 ZIP 다운로드와 Cafe24 적용을 사용할 수 있습니다.</p> : <div className="publish-form"><div className="publish-state"><span>디자인 저장 상태</span><b>{saveStateLabel}</b></div><div className="publish-theme"><p><b>테마 ZIP</b><br />현재 저장 버전을 내려받아 Cafe24 디자인FTP에 업로드할 수 있습니다.</p><button className="publish-primary" onClick={downloadTheme}><Download size={14} /> ZIP 다운로드</button></div><p>Installer로 적용하려면 쇼핑몰 ID를 연결한 뒤 적용할 스킨 번호를 선택하세요.</p><div className="publish-connect-row"><input value={mallId} onChange={(event) => setMallId(event.target.value)} placeholder="Cafe24 쇼핑몰 ID" aria-label="Cafe24 쇼핑몰 ID" /><button disabled={!mallId.trim() || busy} onClick={connect}><Plug size={14} /> 연결</button></div>{connections.length > 0 ? <><label><span>연결 쇼핑몰</span><select value={connectionId} onChange={(event) => setConnectionId(event.target.value)}>{connections.map((connection) => <option value={connection.id} key={connection.id}>{connection.mall_id}</option>)}</select></label><label><span>적용 스킨 번호</span><input type="number" min={1} value={skinNo} onChange={(event) => setSkinNo(Math.max(1, Number(event.target.value) || 1))} /></label><div className="publish-state"><span>적용 상태</span><b>{selectedInstallation?.status === "active" ? "Cafe24에 적용됨" : "적용 전"}</b>{selectedInstallation?.last_error ? <small>{selectedInstallation.last_error}</small> : null}</div><div className="publish-buttons"><button className="publish-primary" disabled={busy || !connectionId} onClick={() => void deploy()}>{busy ? <LoaderCircle size={14} /> : <Send size={14} />} Cafe24에 적용</button>{selectedInstallation?.status === "active" ? <button disabled={busy} onClick={() => void unpublish()}><Unplug size={14} /> 적용 해제</button> : null}</div></> : null}<p className="publish-caution">운영 중인 스킨에 적용하기 전, 복제한 테스트 스킨에서 먼저 확인하세요.</p></div>}{message ? <div className="publish-message">{message}</div> : null}</div></div>;
}
