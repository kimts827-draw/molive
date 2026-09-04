"use client";

import { useMemo, useState } from "react";
import { DIRECT_BUCKET, type MemberRow } from "@/lib/growth/dashboard-types";
import styles from "./growth.module.css";

const dateTime = new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" });

function formatDate(value: string | null) {
  return value ? dateTime.format(new Date(value)) : "—";
}

function csvCell(value: string | number) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * 가장 자주 보는 화면. "가입했지만 미결제" 토글이 다음에 연락할 명단을 만든다.
 * 100명대라 전체 행을 받아 브라우저에서 거르고 정렬한다.
 */
export function GrowthMemberTable({ members, campaigns }: { members: MemberRow[]; campaigns: string[] }) {
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [campaign, setCampaign] = useState("all");
  const [newestFirst, setNewestFirst] = useState(true);

  const rows = useMemo(() => {
    const filtered = members.filter((member) => {
      if (unpaidOnly && member.paid) return false;
      if (campaign !== "all" && (member.utmCampaign ?? DIRECT_BUCKET) !== campaign) return false;
      return true;
    });
    return [...filtered].sort((a, b) => newestFirst
      ? b.signedUpAt.localeCompare(a.signedUpAt)
      : a.signedUpAt.localeCompare(b.signedUpAt));
  }, [members, unpaidOnly, campaign, newestFirst]);

  function downloadCsv() {
    const header = ["가입일", "이메일", "utm_campaign", "utm_content", "price_group", "생성횟수", "결제여부", "결제액", "마지막활동"];
    const lines = [header.join(",")];
    for (const member of rows) {
      lines.push([
        member.signedUpAt,
        member.email,
        member.utmCampaign ?? "",
        member.utmContent ?? "",
        member.priceGroup,
        member.generateCount,
        member.paid ? "결제" : "미결제",
        member.paidAmount,
        member.lastActiveAt ?? "",
      ].map(csvCell).join(","));
    }
    // Excel이 한글을 깨뜨리지 않도록 BOM을 붙인다.
    const blob = new Blob([`﻿${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `molive-members-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return <>
    <div className={styles.filterBar}>
      <label className={styles.toggle}>
        <input type="checkbox" checked={unpaidOnly} onChange={(event) => setUnpaidOnly(event.target.checked)} />
        <span>가입했지만 미결제만</span>
      </label>
      <label className={styles.select}>
        캠페인
        <select value={campaign} onChange={(event) => setCampaign(event.target.value)}>
          <option value="all">전체</option>
          {campaigns.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <button type="button" onClick={() => setNewestFirst((current) => !current)}>
        가입일 {newestFirst ? "최신순" : "오래된순"}
      </button>
      <button type="button" onClick={downloadCsv}>CSV 다운로드</button>
      <span className={styles.filterCount}>{rows.length}명 / 전체 {members.length}명</span>
    </div>
    {rows.length === 0
      ? <div className="projects-empty"><p>조건에 맞는 회원이 없습니다.</p></div>
      : <div className="usage-table-wrap">
        <table>
          <thead><tr><th>가입일</th><th>utm_content</th><th>이메일</th><th>생성횟수</th><th>결제여부</th><th>결제액</th><th>마지막활동</th></tr></thead>
          <tbody>{rows.map((member) => <tr key={member.userId}>
            <td>{formatDate(member.signedUpAt)}</td>
            <td>{member.utmContent ?? "—"}</td>
            <td>{member.email || member.userId.slice(0, 8)}</td>
            <td>{member.generateCount}회</td>
            <td>{member.paid ? <b className={styles.paid}>결제</b> : <span className={styles.unpaid}>미결제</span>}</td>
            <td>{member.paidAmount ? `${member.paidAmount.toLocaleString("ko-KR")}원` : "—"}</td>
            <td>{formatDate(member.lastActiveAt)}</td>
          </tr>)}</tbody>
        </table>
      </div>}
  </>;
}
