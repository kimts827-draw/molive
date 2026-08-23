"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, LoaderCircle, Plug, Send, Unplug, X } from "lucide-react";

type Connection = { id: string; mall_id: string; shop_no: number; status: string };
type RemoteScriptTag = {
  state: "installed" | "missing" | "invalid_response" | "error";
  scriptNo?: string | number;
  src?: string | null;
  displayLocation?: string[];
  skinNo?: number[];
  error?: string;
};
type Installation = { id: string; connection_id: string; skin_no: number; script_no: string | number | null; status: string; last_error: string | null; remote?: RemoteScriptTag };

export function PublishModal({ projectId, onClose }: { projectId: string | null; onClose: () => void }) {
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

  function downloadPoc() {
    window.location.href = "/api/cafe24/theme-poc";
  }

  async function deploy() {
    if (!projectId || !connectionId) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/cafe24/deploy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, connectionId, skinNo, mode: "runtime" }) });
      const payload = await response.json() as { status?: string; reusedScriptTag?: boolean; activeVersionId?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Cafe24 게시에 실패했습니다.");
      setMessage(payload.reusedScriptTag ? "기존 ScriptTag를 유지하고 activeVersion을 반영했습니다." : "ScriptTag/Runtime 설치와 게시가 완료되었습니다.");
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
      setMessage("Runtime을 비활성화하고 Cafe24 원본 화면으로 복구했습니다.");
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "연동 해제에 실패했습니다."); }
    finally { setBusy(false); }
  }

  return <div className="modal-backdrop"><div className="editor-modal publish-modal"><div className="modal-title"><div><Plug size={18} /><b>Cafe24 Runtime 게시</b></div><button onClick={onClose}><X size={17} /></button></div>{!projectId ? <p className="publish-warning">Supabase에 저장된 프로젝트에서만 Cafe24에 게시할 수 있습니다.</p> : <div className="publish-form"><div className="publish-theme"><p><b>Cafe24 테마 내려받기</b> — 실제 적용 방식입니다. 압축을 풀어 디자인FTP의 skin 폴더에 그대로 올리세요.</p><button className="publish-primary" onClick={downloadTheme}><Download size={14} /> 테마 ZIP 내려받기</button><button onClick={downloadPoc}><Download size={14} /> 연동 검증 POC ZIP</button></div><p>아래 Runtime/ScriptTag는 미리보기용입니다. ScriptTag는 최초 한 번만 설치되고, 이후에는 저장된 activeVersion 변경만 반영됩니다.</p><div className="publish-connect-row"><input value={mallId} onChange={(event) => setMallId(event.target.value)} placeholder="Cafe24 쇼핑몰 ID" /><button disabled={!mallId.trim() || busy} onClick={connect}><Plug size={14} /> OAuth 연결</button></div>{connections.length > 0 && <><label><span>연결 쇼핑몰</span><select value={connectionId} onChange={(event) => setConnectionId(event.target.value)}>{connections.map((connection) => <option value={connection.id} key={connection.id}>{connection.mall_id} · shop {connection.shop_no}</option>)}</select></label><label><span>적용 스킨 번호</span><input type="number" min={1} value={skinNo} onChange={(event) => setSkinNo(Math.max(1, Number(event.target.value) || 1))} /></label><div className="publish-state"><span>installation</span><b>{selectedInstallation ? `${selectedInstallation.status} · script ${selectedInstallation.script_no ?? "없음"}` : "설치 전"}</b>{selectedInstallation?.remote && <small>Cafe24 원격: {selectedInstallation.remote.state}{selectedInstallation.remote.skinNo?.length ? ` · skin ${selectedInstallation.remote.skinNo.join(", ")}` : ""}{selectedInstallation.remote.displayLocation?.length ? ` · ${selectedInstallation.remote.displayLocation.join(", ")}` : ""}</small>}{selectedInstallation?.remote?.error && <small>{selectedInstallation.remote.error}</small>}{selectedInstallation?.last_error && <small>{selectedInstallation.last_error}</small>}</div><div className="publish-buttons"><button className="publish-primary" disabled={busy || !connectionId} onClick={() => void deploy()}>{busy ? <LoaderCircle size={14} /> : <Send size={14} />} Cafe24에 적용</button>{selectedInstallation?.status === "active" && <button disabled={busy} onClick={() => void unpublish()}><Unplug size={14} /> Unpublish</button>}</div></>}</div>}{message && <div className="publish-message">{message}</div>}</div></div>;
}
