type PickZipResult =
  | { canceled: true }
  | {
      canceled: false;
      filePath: string;
      fileCount: number;
      rootPrefix: string | null;
      totalBytes: number;
      hasIndexHtml: boolean;
      sample: string[];
    };

type ConnectResult = {
  ok: true;
  basePath: string | null;
  skins: string[];
  home: string | null;
  candidates: string[];
  homeEntries: string[];
};

type InstallProgress =
  | { phase: "prepare"; message: string }
  | { phase: "mkdir"; current: number; total: number; path: string }
  | { phase: "upload"; current: number; total: number; path: string; ok: boolean; error?: string };

type InstallReport = {
  skinRoot: string;
  total: number;
  succeeded: number;
  skipped: string[];
  failures: Array<{ path: string; error: string }>;
  complete: boolean;
  durationMs: number;
};

type LoadedSettings = {
  settings: { host: string; port: number | null; username: string; basePath: string; rememberPassword: boolean };
  password: string;
  canRememberPassword: boolean;
};

interface InstallerBridge {
  loadSettings(): Promise<LoadedSettings>;
  saveSettings(input: {
    host: string;
    port: number | string;
    username: string;
    basePath: string;
    rememberPassword: boolean;
    password?: string;
  }): Promise<{ ok: true; rememberPassword: boolean }>;
  pickZip(): Promise<PickZipResult>;
  connect(input: { host: string; port: number; username: string; password: string; basePath: string }): Promise<ConnectResult>;
  list(input: { path: string }): Promise<{ path: string; directories: string[] }>;
  disconnect(): Promise<{ ok: true }>;
  install(input: { skinName: string }): Promise<InstallReport>;
  onProgress(listener: (progress: InstallProgress) => void): () => void;
}

interface Window {
  installer: InstallerBridge;
}

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const connectButton = $<HTMLButtonElement>("connect");
const disconnectButton = $<HTMLButtonElement>("disconnect");
const browseButton = $<HTMLButtonElement>("browse");
const pickZipButton = $<HTMLButtonElement>("pickZip");
const installButton = $<HTMLButtonElement>("install");
const skinSelect = $<HTMLSelectElement>("skin");
const confirmSkin = $<HTMLInputElement>("confirmSkin");
const basePathInput = $<HTMLInputElement>("basePath");
const hostInput = $<HTMLInputElement>("host");
const portInput = $<HTMLInputElement>("port");
const usernameInput = $<HTMLInputElement>("username");
const passwordInput = $<HTMLInputElement>("password");
const rememberPassword = $<HTMLInputElement>("rememberPassword");
const bar = $<HTMLProgressElement>("bar");
const logBox = $<HTMLDivElement>("log");
const resultBox = $<HTMLDivElement>("result");

let connected = false;
let zipReady = false;
let installing = false;

/** 접속 단계에서 자주 나오는 원문 오류를 사용자가 바로 이해할 수 있는 말로 바꾼다. */
const FRIENDLY_ERRORS: Array<[RegExp, string]> = [
  [
    /All configured authentication methods failed/i,
    "계정 또는 비밀번호가 맞지 않습니다. 디자인 FTP 사용 기간(최대 7일)이 지났을 수도 있으니, 카페24에서 다시 신청한 뒤 새로 받은 정보로 시도해 보세요.",
  ],
  [/getaddrinfo|ENOTFOUND|EAI_AGAIN/i, "FTP 주소를 찾을 수 없습니다. 주소를 다시 확인해 주세요."],
  [/ECONNREFUSED/i, "접속이 거부되었습니다. 접속 포트 번호를 다시 확인해 주세요."],
  [/ETIMEDOUT|Timed out while waiting/i, "접속 시간이 초과되었습니다. 주소와 포트, 인터넷 연결을 확인해 주세요."],
  [/ECONNRESET|socket hang up/i, "접속이 끊어졌습니다. 잠시 후 다시 시도해 주세요."],
  [/Handshake failed|no matching/i, "쇼핑몰 서버와 접속 방식이 맞지 않습니다. 카페24에서 디자인 FTP 권한을 신청했는지 확인해 주세요."],
  [/permission denied/i, "쇼핑몰이 쓰기를 허용하지 않는 파일입니다."],
];

function message(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const cleaned = raw.replace(/^Error invoking remote method '[^']+':\s*/, "").replace(/^Error:\s*/, "");
  for (const [pattern, friendly] of FRIENDLY_ERRORS) {
    if (pattern.test(cleaned)) return friendly;
  }
  return cleaned;
}

function log(line: string) {
  logBox.textContent += `${line}\n`;
  logBox.scrollTop = logBox.scrollHeight;
}

function setStatus(id: string, text: string, kind: "" | "ok" | "err" = "") {
  const node = $<HTMLSpanElement>(id);
  node.textContent = text;
  node.className = `status ${kind}`;
}

/**
 * 입력값만 저장한다. 접속 성공 여부 같은 실행 중 상태는 저장하지 않는다.
 * 비밀번호는 사용자가 저장을 켰고 실제로 접속에 성공했을 때만 함께 넘긴다.
 */
async function saveInputs(includePassword: boolean) {
  try {
    await window.installer.saveSettings({
      host: hostInput.value,
      port: portInput.value,
      username: usernameInput.value,
      basePath: basePathInput.value,
      rememberPassword: rememberPassword.checked,
      password: includePassword && rememberPassword.checked ? passwordInput.value : undefined,
    });
  } catch {
    // 저장에 실패해도 설치 흐름은 막지 않는다.
  }
}

/** 다시 실행했을 때 입력값만 되살린다. 접속 상태는 언제나 '확인 필요'에서 시작한다. */
async function restoreInputs() {
  try {
    const loaded = await window.installer.loadSettings();
    hostInput.value = loaded.settings.host;
    portInput.value = loaded.settings.port === null ? "" : String(loaded.settings.port);
    usernameInput.value = loaded.settings.username;
    basePathInput.value = loaded.settings.basePath || "/";
    rememberPassword.disabled = !loaded.canRememberPassword;
    rememberPassword.checked = loaded.settings.rememberPassword && loaded.canRememberPassword;
    if (loaded.password) passwordInput.value = loaded.password;
  } catch {
    // 저장된 값이 없으면 빈 화면으로 시작한다.
  }
  setStatus("connectStatus", "접속 확인이 필요합니다");
}

function refreshInstallButton() {
  installButton.disabled = !(connected && zipReady && skinSelect.value !== "" && confirmSkin.checked && !installing);
}

connectButton.addEventListener("click", async () => {
  connectButton.disabled = true;
  setStatus("connectStatus", "접속하는 중…");
  try {
    await saveInputs(false);
    const result = await window.installer.connect({
      host: hostInput.value,
      port: Number(portInput.value),
      username: usernameInput.value,
      password: passwordInput.value,
      basePath: basePathInput.value,
    });
    connected = true;
    disconnectButton.disabled = false;
    browseButton.disabled = false;
    skinSelect.disabled = false;
    skinSelect.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = result.skins.length ? "디자인을 고르세요" : "설치할 수 있는 디자인이 없습니다";
    skinSelect.append(placeholder);
    for (const skin of result.skins) {
      const option = document.createElement("option");
      option.value = skin;
      option.textContent = skin;
      skinSelect.append(option);
    }
    if (result.basePath) basePathInput.value = result.basePath;
    // 접속에 성공한 값만 저장한다. 틀린 비밀번호가 남지 않게 한다.
    await saveInputs(true);

    log(`[접속] 접속한 위치: ${result.home ?? "확인하지 못함"}`);
    log(`[접속] 찾아본 폴더: ${result.candidates.join(", ")}`);
    log(`[접속] 그 안에 있던 폴더: ${result.homeEntries.join(", ") || "(없음)"}`);

    if (result.skins.length) {
      setStatus("connectStatus", `접속 성공 · 디자인 ${result.skins.length}개를 찾았습니다`, "ok");
      log(`[접속] 설치할 수 있는 디자인: ${result.skins.join(", ")}`);
    } else {
      setStatus("connectStatus", "접속은 됐지만 디자인 폴더를 찾지 못했습니다. 아래 '직접 지정'을 열어 보세요", "err");
    }
  } catch (error) {
    connected = false;
    disconnectButton.disabled = true;
    browseButton.disabled = true;
    skinSelect.disabled = true;
    setStatus("connectStatus", message(error), "err");
  } finally {
    connectButton.disabled = false;
    refreshInstallButton();
  }
});

browseButton.addEventListener("click", async () => {
  const target = basePathInput.value;
  try {
    const result = await window.installer.list({ path: target });
    log(`[살펴보기] ${result.path} 안의 폴더: ${result.directories.join(", ") || "(없음)"}`);
  } catch (error) {
    log(`[살펴보기] ${target} — ${message(error)}`);
  }
});

disconnectButton.addEventListener("click", async () => {
  await window.installer.disconnect();
  connected = false;
  disconnectButton.disabled = true;
  browseButton.disabled = true;
  skinSelect.disabled = true;
  skinSelect.innerHTML = '<option value="">접속 확인을 먼저 하세요</option>';
  setStatus("connectStatus", "접속을 끊었습니다");
  refreshInstallButton();
});

pickZipButton.addEventListener("click", async () => {
  try {
    const result = await window.installer.pickZip();
    if (result.canceled) return;
    zipReady = true;
    const name = result.filePath.split(/[/\\]/).pop() ?? result.filePath;
    setStatus("zipStatus", name, "ok");
    const detail = $<HTMLElement>("zipDetail");
    detail.textContent = result.hasIndexHtml
      ? `쇼핑몰에 올릴 파일 ${result.fileCount}개를 확인했습니다.`
      : `파일 ${result.fileCount}개를 읽었지만 디자인 파일이 아닐 수 있습니다. Moiré에서 내려받은 압축 파일이 맞는지 확인해 주세요.`;
    detail.className = result.hasIndexHtml ? "note" : "note err";
    log(`[파일] ${result.filePath}`);
    log(`[파일] ${result.fileCount}개 · ${Math.round(result.totalBytes / 1024)} KB${result.rootPrefix ? ` · 바깥 폴더 "${result.rootPrefix}" 제외` : ""}`);
  } catch (error) {
    zipReady = false;
    setStatus("zipStatus", message(error), "err");
  } finally {
    refreshInstallButton();
  }
});

rememberPassword.addEventListener("change", () => {
  void saveInputs(rememberPassword.checked);
});

// 접속 확인을 누르지 않고 창을 닫아도 입력값이 남도록 잠깐 멈춘 뒤 저장한다. (비밀번호는 제외)
let saveTimer = 0;
for (const input of [hostInput, portInput, usernameInput, basePathInput]) {
  input.addEventListener("input", () => {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => void saveInputs(false), 600);
  });
}

skinSelect.addEventListener("change", refreshInstallButton);
confirmSkin.addEventListener("change", refreshInstallButton);

window.installer.onProgress((progress) => {
  if (progress.phase === "prepare") {
    setStatus("installStatus", progress.message);
    return;
  }
  if (progress.phase === "mkdir") {
    bar.value = 0;
    setStatus("installStatus", `폴더를 만드는 중 ${progress.current}/${progress.total}`);
    return;
  }
  bar.max = progress.total;
  bar.value = progress.current;
  setStatus("installStatus", `파일을 올리는 중 ${progress.current}/${progress.total}`);
  log(progress.ok ? `  올림  ${progress.path}` : `  실패  ${progress.path} — ${progress.error ?? ""}`);
});

installButton.addEventListener("click", async () => {
  installing = true;
  refreshInstallButton();
  resultBox.textContent = "";
  resultBox.className = "";
  logBox.textContent = "";
  bar.value = 0;
  try {
    const report = await window.installer.install({ skinName: skinSelect.value });
    const seconds = (report.durationMs / 1000).toFixed(1);
    const kept = report.skipped.length
      ? `\n쇼핑몰이 직접 관리하는 파일 ${report.skipped.length}개는 그대로 두었습니다.`
      : "";
    if (report.complete) {
      resultBox.className = "ok";
      resultBox.textContent =
        `설치가 끝났습니다.\n` +
        `파일 ${report.succeeded}개를 ${skinSelect.value}에 올렸습니다. (${seconds}초)${kept}\n` +
        `카페24 관리자에서 이 디자인의 미리보기로 확인해 보세요.`;
      setStatus("installStatus", "완료", "ok");
    } else {
      resultBox.className = "err";
      const list = report.failures.map((failure) => `  · ${failure.path} — ${message(failure.error)}`).join("\n");
      resultBox.textContent =
        `설치를 마치지 못했습니다.\n` +
        `${report.total}개 중 ${report.failures.length}개를 올리지 못했습니다. (${seconds}초)${kept}\n` +
        `올리지 못한 파일:\n${list}\n` +
        `[설치하기]를 다시 누르면 처음부터 다시 시도합니다.`;
      setStatus("installStatus", "일부 파일 실패", "err");
    }
    if (report.skipped.length) log(`[설치] 그대로 둔 파일: ${report.skipped.join(", ")}`);
  } catch (error) {
    resultBox.className = "err";
    resultBox.textContent = `설치를 시작하지 못했습니다.\n${message(error)}`;
    setStatus("installStatus", "중단", "err");
  } finally {
    installing = false;
    refreshInstallButton();
  }
});

void restoreInputs();
