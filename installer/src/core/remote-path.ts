/**
 * ZIP 엔트리 경로를 원격 경로로 바꾸기 전에 반드시 통과해야 하는 검증 계층.
 * 목표는 단 하나: 선택한 /sde_design/skinXX 밖으로는 어떤 파일도 쓰지 않는다.
 */

const SKIN_NAME = /^skin\d+$/i;

export class UnsafePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafePathError";
  }
}

/** ZIP 안의 상대 경로를 정규화한다. 절대경로, 드라이브 문자, `..`, NUL은 전부 거부. */
export function normalizeEntryPath(raw: string): string {
  if (raw.includes("\0")) throw new UnsafePathError(`경로에 NUL 문자가 있습니다: ${JSON.stringify(raw)}`);
  const unified = raw.replace(/\\/g, "/").trim();
  if (!unified) throw new UnsafePathError("빈 경로입니다.");
  if (unified.startsWith("/")) throw new UnsafePathError(`절대 경로는 설치할 수 없습니다: ${raw}`);
  if (/^[A-Za-z]:/.test(unified)) throw new UnsafePathError(`드라이브 경로는 설치할 수 없습니다: ${raw}`);

  const segments: string[] = [];
  for (const segment of unified.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") throw new UnsafePathError(`상위 경로 탈출이 포함되어 있습니다: ${raw}`);
    if (segment.length > 255) throw new UnsafePathError(`경로 조각이 너무 깁니다: ${raw}`);
    segments.push(segment);
  }
  if (segments.length === 0) throw new UnsafePathError(`유효한 경로 조각이 없습니다: ${raw}`);
  return segments.join("/");
}

/**
 * 기준 경로를 정규화한다. 항상 절대 POSIX 경로.
 * Cafe24 디자인FTP는 계정이 디자인 루트로 chroot 되어 skinXX가 `/` 바로 아래 있는 경우가 많으므로
 * 루트(`/`) 자체도 유효한 기준 경로다.
 */
export function normalizeBasePath(raw: string): string {
  const unified = raw.replace(/\\/g, "/").trim();
  if (!unified.startsWith("/")) throw new UnsafePathError("기준 경로는 `/`로 시작해야 합니다.");
  const segments: string[] = [];
  for (const segment of unified.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") throw new UnsafePathError("기준 경로에 `..`를 쓸 수 없습니다.");
    segments.push(segment);
  }
  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

/** 기준 경로 아래에 이름 하나를 붙인다. 루트일 때 `//`가 생기지 않게 한다. */
export function childPath(basePath: string, name: string): string {
  const base = normalizeBasePath(basePath);
  return base === "/" ? `/${name}` : `${base}/${name}`;
}

/** 설치 대상 스킨 루트를 만든다. skinXX 형태가 아니면 거부. */
export function resolveSkinRoot(basePath: string, skinName: string): string {
  if (!SKIN_NAME.test(skinName)) throw new UnsafePathError(`skinXX 형식이 아닙니다: ${skinName}`);
  return childPath(basePath, skinName);
}

export function isSkinDirectoryName(name: string): boolean {
  return SKIN_NAME.test(name);
}

/** 정규화된 상대 경로를 스킨 루트에 붙이고, 결과가 루트 안인지 다시 확인한다. */
export function joinInsideSkin(skinRoot: string, relativePath: string): string {
  const root = normalizeBasePath(skinRoot);
  if (root === "/") throw new UnsafePathError("스킨 루트가 `/`일 수 없습니다.");
  const relative = normalizeEntryPath(relativePath);
  const full = `${root}/${relative}`;
  if (full !== root && !full.startsWith(`${root}/`)) {
    throw new UnsafePathError(`스킨 루트 밖 경로입니다: ${full}`);
  }
  return full;
}

/** 파일 경로들에서 만들어야 하는 디렉터리를 상위부터 정렬해 돌려준다. */
export function collectDirectories(skinRoot: string, relativePaths: string[]): string[] {
  const root = normalizeBasePath(skinRoot);
  if (root === "/") throw new UnsafePathError("스킨 루트가 `/`일 수 없습니다.");
  const directories = new Set<string>();
  for (const relative of relativePaths) {
    const segments = normalizeEntryPath(relative).split("/");
    segments.pop();
    let current = root;
    for (const segment of segments) {
      current = `${current}/${segment}`;
      directories.add(current);
    }
  }
  return [...directories].sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
}
