"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OrderApproveButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function approve() {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/approve`, { method: "POST" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "입금확인에 실패했습니다.");
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "입금확인에 실패했습니다."); setBusy(false); }
  }
  return <div className="admin-action"><button disabled={busy} onClick={() => void approve()}>{busy ? "지급 중" : "입금확인 + Credit 지급"}</button>{error ? <small>{error}</small> : null}</div>;
}
