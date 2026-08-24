/**
 * 다시 실행했을 때 되살릴 입력값의 형태와 검증 규칙.
 * 비밀번호 평문은 이 형태에 절대 들어가지 않는다. (암호문만 `encryptedPassword`로 보관)
 */

export type Settings = {
  host: string;
  port: number | null;
  username: string;
  basePath: string;
  lastZipDirectory: string | null;
  rememberPassword: boolean;
  /** OS 자격 증명 보호 기능으로 암호화한 비밀번호(base64). 저장하지 않으면 없음. */
  encryptedPassword?: string;
};

export const SETTINGS_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  host: "",
  port: null,
  username: "",
  basePath: "/",
  lastZipDirectory: null,
  rememberPassword: false,
};

function asText(value: unknown, max = 255): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function asPort(value: unknown): number | null {
  const port = typeof value === "number" ? value : Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null;
}

function asBasePath(value: unknown): string {
  const text = asText(value);
  return text.startsWith("/") ? text : DEFAULT_SETTINGS.basePath;
}

function asDirectory(value: unknown): string | null {
  const text = asText(value, 4096);
  return text.length > 0 ? text : null;
}

/**
 * 손상되었거나 사람이 손댄 설정 파일이 들어와도 앱이 죽지 않게 한 겹 거른다.
 * 알 수 없는 키는 버리므로, 예전 버전이 남긴 평문 비밀번호 같은 값도 여기서 사라진다.
 */
export function sanitizeSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SETTINGS };
  const source = raw as Record<string, unknown>;
  const encrypted = asText(source.encryptedPassword, 8192);
  const settings: Settings = {
    host: asText(source.host),
    port: asPort(source.port),
    username: asText(source.username),
    basePath: asBasePath(source.basePath),
    lastZipDirectory: asDirectory(source.lastZipDirectory),
    rememberPassword: source.rememberPassword === true,
  };
  if (settings.rememberPassword && encrypted) settings.encryptedPassword = encrypted;
  return settings;
}

/** 저장 직전 형태. 비밀번호를 기억하지 않기로 했으면 암호문도 함께 지운다. */
export function toStoredSettings(settings: Settings): Settings & { version: number } {
  const clean = sanitizeSettings(settings);
  if (!clean.rememberPassword) delete clean.encryptedPassword;
  return { version: SETTINGS_VERSION, ...clean };
}

/**
 * 파일 고르기 창을 열 폴더를 정한다.
 * 마지막 폴더가 사라졌거나 열 수 없으면 기본 폴더로 되돌아간다.
 */
export function resolveZipDialogDirectory(
  lastDirectory: string | null,
  fallbackDirectory: string,
  isUsableDirectory: (path: string) => boolean,
): string {
  if (lastDirectory && isUsableDirectory(lastDirectory)) return lastDirectory;
  return fallbackDirectory;
}
