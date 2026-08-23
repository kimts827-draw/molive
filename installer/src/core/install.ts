import type { SftpSession } from "./sftp";
import type { ZipFile } from "./zip";
import { collectDirectories, joinInsideSkin, normalizeEntryPath, resolveSkinRoot } from "./remote-path";

export type InstallProgress =
  | { phase: "prepare"; message: string }
  | { phase: "mkdir"; current: number; total: number; path: string }
  | { phase: "upload"; current: number; total: number; path: string; ok: boolean; error?: string };

export type FileFailure = { path: string; error: string };

/**
 * 쇼핑몰이 서버에서 직접 만들고 관리하는 파일.
 * 기준 스킨 압축본에 딸려 오지만 남의 몰 주소가 들어 있고 쓰기 권한도 없어서 설치하지 않는다.
 */
const SERVER_MANAGED = [/^sitemap[^/]*[.]xml([.]temp)?$/i];

function isServerManaged(relativePath: string): boolean {
  return SERVER_MANAGED.some((pattern) => pattern.test(relativePath));
}

export type InstallReport = {
  skinRoot: string;
  total: number;
  succeeded: number;
  /** 쇼핑몰이 관리하는 파일이라 일부러 올리지 않은 것들. 실패가 아니다. */
  skipped: string[];
  failures: FileFailure[];
  /** 실패 파일이 하나라도 있으면 false. 부분 성공을 설치 완료로 부르지 않는다. */
  complete: boolean;
  durationMs: number;
};

const UPLOAD_CONCURRENCY = 4;
const UPLOAD_ATTEMPTS = 2;

export async function installTheme(
  session: SftpSession,
  input: { files: ZipFile[]; basePath: string; skinName: string },
  onProgress: (progress: InstallProgress) => void,
): Promise<InstallReport> {
  const startedAt = Date.now();
  const skinRoot = resolveSkinRoot(input.basePath, input.skinName);

  // 1) 경로 검증을 먼저 전부 끝낸다. 하나라도 위험하면 아무것도 쓰지 않고 중단.
  onProgress({ phase: "prepare", message: "파일을 확인하는 중" });
  const checked = input.files.map((file) => {
    const relative = normalizeEntryPath(file.path);
    return { relative, remote: joinInsideSkin(skinRoot, relative), data: file.data };
  });
  const skipped = checked.filter((item) => isServerManaged(item.relative)).map((item) => item.relative);
  const planned = checked.filter((item) => !isServerManaged(item.relative));
  if (planned.length === 0) throw new Error("압축 파일 안에 설치할 파일이 없습니다.");

  const seen = new Set<string>();
  for (const item of checked) {
    if (seen.has(item.remote)) throw new Error(`압축 파일 안에 같은 경로가 두 번 있습니다: ${item.relative}`);
    seen.add(item.remote);
  }

  // 2) 대상 스킨이 실제로 존재하는지 확인한다. 새 스킨은 카페24 관리자에서만 만든다.
  onProgress({ phase: "prepare", message: `${skinRoot} 폴더를 확인하는 중` });
  const rootStats = await session.stat(skinRoot);
  if (!rootStats) throw new Error(`고른 디자인 폴더를 찾을 수 없습니다: ${skinRoot}`);
  if (!rootStats.isDirectory()) throw new Error(`대상 스킨이 폴더가 아닙니다: ${skinRoot}`);

  // 3) 디렉터리를 상위부터 순서대로 만든다.
  const directories = collectDirectories(skinRoot, planned.map((item) => item.relative));
  for (const [index, directory] of directories.entries()) {
    onProgress({ phase: "mkdir", current: index + 1, total: directories.length, path: directory });
    await session.ensureDirectory(directory);
  }

  // 4) 파일 업로드. 실패해도 멈추지 않고 끝까지 시도한 뒤 실패 목록을 남긴다.
  const failures: FileFailure[] = [];
  let finished = 0;
  let succeeded = 0;
  let cursor = 0;

  const worker = async () => {
    while (cursor < planned.length) {
      const item = planned[cursor++]!;
      let lastError: unknown;
      let ok = false;
      for (let attempt = 1; attempt <= UPLOAD_ATTEMPTS; attempt += 1) {
        try {
          await session.writeFile(item.remote, item.data);
          ok = true;
          break;
        } catch (error) {
          lastError = error;
        }
      }
      finished += 1;
      if (ok) succeeded += 1;
      else failures.push({ path: item.relative, error: describe(lastError) });
      onProgress({
        phase: "upload",
        current: finished,
        total: planned.length,
        path: item.relative,
        ok,
        error: ok ? undefined : describe(lastError),
      });
    }
  };

  await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, planned.length) }, worker));

  return {
    skinRoot,
    total: planned.length,
    succeeded,
    skipped,
    failures,
    complete: failures.length === 0 && succeeded === planned.length,
    durationMs: Date.now() - startedAt,
  };
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
