"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INQUIRY_STATUS_LABELS, type InquiryStatus } from "@/lib/inquiries/config";

export function InquiryStatusControl({ inquiryId, initialStatus }: { inquiryId: string; initialStatus: InquiryStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/inquiries/${inquiryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "상태를 변경하지 못했습니다.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "상태를 변경하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="inquiry-status-control">
    <select aria-label="문의 상태" value={status} onChange={(event) => setStatus(event.target.value as InquiryStatus)}>
      {(Object.entries(INQUIRY_STATUS_LABELS) as [InquiryStatus, string][]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
    <button type="button" disabled={busy || status === initialStatus} onClick={() => void save()}>{busy ? "저장 중..." : "상태 저장"}</button>
    {error ? <small>{error}</small> : null}
  </div>;
}
