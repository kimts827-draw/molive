"use client";

import { useEffect } from "react";
import {
  ATTRIBUTION_KEY,
  clearFirstTouch,
  ensureSessionId,
  persistFirstTouch,
  readFirstTouch,
} from "@/lib/growth/attribution";
import { NEW_USER_COOKIE } from "@/lib/growth/new-user-cookie";

function readCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`))
    ?.slice(name.length + 1) ?? null;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`;
}

/** 같은 탭에서 새로고침해도 방문이 중복 집계되지 않게 막는다. */
function markedInTab(key: string) {
  try {
    if (window.sessionStorage.getItem(key)) return true;
    window.sessionStorage.setItem(key, "1");
    return false;
  } catch {
    return false;
  }
}

async function send(path: string, body: unknown) {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 랜딩 진입과 결제 페이지 진입을 기록하고, 가입 직후 첫 유입 정보를 계정에 붙인다.
 *
 * UTM 저장은 어느 페이지에서든 첫 방문 때 한 번만 일어난다. 이미 저장된 값은 덮어쓰지 않으므로
 * 링크로 왔다가 나갔다가 직접 주소로 다시 들어와도 첫 유입 경로가 그대로 남는다.
 */
export function GrowthTracker({ event }: { event?: "visit" | "checkout_view" }) {
  useEffect(() => {
    const storage = (() => {
      try {
        return window.localStorage;
      } catch {
        return null;
      }
    })();

    persistFirstTouch(storage, window.location.search);
    const sessionId = ensureSessionId(storage);
    const attribution = readFirstTouch(storage);

    if (event && !markedInTab(`molive:tracked:${event}`)) {
      void send("/api/track", { event, sessionId, attribution });
    }

    if (readCookie(NEW_USER_COOKIE)) {
      void (async () => {
        const ok = await send("/api/track/identify", { sessionId, attribution });
        if (ok) {
          clearCookie(NEW_USER_COOKIE);
          // 계정에 옮겨 담은 뒤에만 지운다. 실패하면 다음 페이지에서 다시 시도한다.
          clearFirstTouch(storage);
        }
      })();
    }
  }, [event]);

  return null;
}

/** 이메일 가입처럼 클라이언트가 가입 성공을 직접 아는 경로에서 호출한다. */
export async function reportSignup() {
  const storage = (() => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  })();
  const sessionId = ensureSessionId(storage);
  const attribution = readFirstTouch(storage);
  const ok = await send("/api/track/identify", { sessionId, attribution });
  if (ok) clearFirstTouch(storage);
  return ok;
}

export { ATTRIBUTION_KEY };
