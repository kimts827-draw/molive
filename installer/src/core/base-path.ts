import { isSkinDirectoryName, normalizeBasePath } from "./remote-path";
import type { SftpSession } from "./sftp";

export type BasePathResolution = {
  /** skinXX를 담고 있다고 확인된 경로. 못 찾으면 null이고 연결은 그대로 유지한다. */
  basePath: string | null;
  skins: string[];
  home: string | null;
  /** 확인해 본 경로들. 실패했을 때 무엇을 봤는지 사용자에게 그대로 보여준다. */
  candidates: string[];
  /** 홈 디렉터리에서 실제로 보인 폴더들. 기준 경로를 직접 고를 때 쓰는 단서. */
  homeEntries: string[];
};

/**
 * 디자인FTP는 계정마다 접속 후 위치가 다르다.
 * `/sde_design`, `<home>/sde_design`, 홈 자체 순으로 확인하고,
 * skinXX가 실제로 보이는 경로를 우선 채택한다.
 */
export async function resolveBasePath(session: SftpSession, requested: string): Promise<BasePathResolution> {
  const base = normalizeBasePath(requested);
  const home = await readHome(session);

  // Cafe24 계정은 대개 디자인 루트로 chroot 되어 `/` 바로 아래에 skinXX가 있다.
  // 요청한 경로 → 로그인 위치 → 로그인 위치 하위 → 루트 순으로 확인한다.
  const candidates = [base];
  for (const candidate of [home, home ? normalizeBasePath(`${home}/${base.slice(1)}`) : null, "/"]) {
    if (candidate && !candidates.includes(candidate)) candidates.push(candidate);
  }

  let fallback: string | null = null;
  for (const candidate of candidates) {
    const stats = await session.stat(candidate).catch(() => null);
    if (!stats?.isDirectory()) continue;
    const skins = (await session.listDirectories(candidate).catch(() => [])).filter(isSkinDirectoryName);
    if (skins.length > 0) {
      return { basePath: candidate, skins, home, candidates, homeEntries: await readHomeEntries(session, home) };
    }
    fallback ??= candidate;
  }

  // 경로는 있는데 skinXX가 안 보이는 경우도 연결을 끊지 않고 그대로 알려준다.
  return { basePath: fallback, skins: [], home, candidates, homeEntries: await readHomeEntries(session, home) };
}

async function readHome(session: SftpSession): Promise<string | null> {
  for (const probe of [".", "./", ""]) {
    const resolved = await session.realpath(probe).catch(() => null);
    if (resolved && resolved.startsWith("/")) return normalizeBasePath(resolved);
  }
  return null;
}

async function readHomeEntries(session: SftpSession, home: string | null): Promise<string[]> {
  return session.listDirectories(home ?? ".").catch(() => []);
}
