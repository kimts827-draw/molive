import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { sanitizeSettings, toStoredSettings, type Settings } from "./settings";

/**
 * 설정 파일 읽기/쓰기.
 * 비밀번호는 이 모듈이 직접 다루지 않고, 주입받은 `SecretCodec`(Windows에서는 OS 자격 증명 보호)에 맡긴다.
 */

export type SecretCodec = {
  /** OS가 암호화를 지원하지 않으면 false. 이때는 비밀번호를 저장하지 않는다. */
  available: boolean;
  encrypt(plain: string): string;
  decrypt(cipher: string): string;
};

export type LoadedSettings = { settings: Settings; password: string | null };

export async function loadSettings(filePath: string, codec: SecretCodec): Promise<LoadedSettings> {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    // 파일이 없거나 깨졌으면 기본값으로 시작한다.
    parsed = null;
  }
  const settings = sanitizeSettings(parsed);

  let password: string | null = null;
  if (settings.rememberPassword && settings.encryptedPassword && codec.available) {
    try {
      password = codec.decrypt(settings.encryptedPassword) || null;
    } catch {
      // 다른 계정이나 다른 PC에서 만들어진 암호문은 풀 수 없다. 비밀번호만 비워 두고 나머지는 살린다.
      password = null;
      delete settings.encryptedPassword;
    }
  }
  return { settings, password };
}

export async function saveSettings(
  filePath: string,
  codec: SecretCodec,
  settings: Settings,
  password: string | null,
): Promise<Settings> {
  const next = sanitizeSettings(settings);
  if (next.rememberPassword && password && codec.available) {
    next.encryptedPassword = codec.encrypt(password);
  } else if (next.rememberPassword && !password) {
    // 비밀번호를 새로 주지 않았으면 이미 저장된 암호문을 그대로 둔다.
    if (settings.encryptedPassword) next.encryptedPassword = settings.encryptedPassword;
  }

  const stored = toStoredSettings(next);
  await mkdir(dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  await writeFile(temporary, JSON.stringify(stored, null, 2), "utf8");
  await rename(temporary, filePath);
  return sanitizeSettings(stored);
}
