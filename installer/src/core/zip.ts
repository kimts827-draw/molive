import { crc32, inflateRawSync } from "node:zlib";

/**
 * central directory부터 읽는 최소 ZIP 리더.
 * store/deflate만 지원하고, 암호화·심볼릭 링크 엔트리는 설치 전에 거부한다.
 */

export type ZipFile = { path: string; data: Buffer };

const EOCD_SIG = 0x06054b50;
const EOCD64_LOCATOR_SIG = 0x07064b50;
const EOCD64_SIG = 0x06064b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

export class ZipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipError";
  }
}

function findEocd(buffer: Buffer): number {
  const min = Math.max(0, buffer.length - 0xffff - 22);
  for (let i = buffer.length - 22; i >= min; i -= 1) {
    if (buffer.readUInt32LE(i) === EOCD_SIG) return i;
  }
  throw new ZipError("ZIP 구조를 읽을 수 없습니다. (EOCD 없음)");
}

function readDirectoryBounds(buffer: Buffer) {
  const eocd = findEocd(buffer);
  let entryCount = buffer.readUInt16LE(eocd + 10);
  let directoryOffset = buffer.readUInt32LE(eocd + 16);

  const locator = eocd - 20;
  if (locator >= 0 && buffer.readUInt32LE(locator) === EOCD64_LOCATOR_SIG) {
    const eocd64 = Number(buffer.readBigUInt64LE(locator + 8));
    if (buffer.readUInt32LE(eocd64) !== EOCD64_SIG) throw new ZipError("Zip64 구조가 손상되었습니다.");
    entryCount = Number(buffer.readBigUInt64LE(eocd64 + 32));
    directoryOffset = Number(buffer.readBigUInt64LE(eocd64 + 48));
  }
  return { entryCount, directoryOffset };
}

function readZip64Extra(extra: Buffer, needsUncompressed: boolean, needsCompressed: boolean, needsOffset: boolean) {
  let uncompressedSize: number | undefined;
  let compressedSize: number | undefined;
  let localOffset: number | undefined;
  let cursor = 0;
  while (cursor + 4 <= extra.length) {
    const id = extra.readUInt16LE(cursor);
    const size = extra.readUInt16LE(cursor + 2);
    const body = extra.subarray(cursor + 4, cursor + 4 + size);
    if (id === 0x0001) {
      let inner = 0;
      if (needsUncompressed && inner + 8 <= body.length) { uncompressedSize = Number(body.readBigUInt64LE(inner)); inner += 8; }
      if (needsCompressed && inner + 8 <= body.length) { compressedSize = Number(body.readBigUInt64LE(inner)); inner += 8; }
      if (needsOffset && inner + 8 <= body.length) { localOffset = Number(body.readBigUInt64LE(inner)); inner += 8; }
      break;
    }
    cursor += 4 + size;
  }
  return { uncompressedSize, compressedSize, localOffset };
}

export function readZip(buffer: Buffer): ZipFile[] {
  const { entryCount, directoryOffset } = readDirectoryBounds(buffer);
  const files: ZipFile[] = [];
  let cursor = directoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== CENTRAL_SIG) {
      throw new ZipError(`ZIP 엔트리 ${index + 1}번을 읽을 수 없습니다.`);
    }
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const expectedCrc = buffer.readUInt32LE(cursor + 16);
    let compressedSize = buffer.readUInt32LE(cursor + 20);
    let uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const externalAttributes = buffer.readUInt32LE(cursor + 38);
    let localOffset = buffer.readUInt32LE(cursor + 42);

    const nameStart = cursor + 46;
    const rawName = buffer.subarray(nameStart, nameStart + nameLength);
    const name = rawName.toString(flags & 0x800 ? "utf8" : "latin1");
    const extra = buffer.subarray(nameStart + nameLength, nameStart + nameLength + extraLength);
    cursor = nameStart + nameLength + extraLength + commentLength;

    if (flags & 0x1) throw new ZipError(`암호화된 ZIP은 설치할 수 없습니다: ${name}`);

    const zip64 = readZip64Extra(
      extra,
      uncompressedSize === 0xffffffff,
      compressedSize === 0xffffffff,
      localOffset === 0xffffffff,
    );
    if (zip64.uncompressedSize !== undefined) uncompressedSize = zip64.uncompressedSize;
    if (zip64.compressedSize !== undefined) compressedSize = zip64.compressedSize;
    if (zip64.localOffset !== undefined) localOffset = zip64.localOffset;

    if (name.endsWith("/")) continue;
    const unixMode = (externalAttributes >>> 16) & 0xf000;
    if (unixMode === 0xa000) throw new ZipError(`심볼릭 링크 엔트리는 설치할 수 없습니다: ${name}`);

    if (buffer.readUInt32LE(localOffset) !== LOCAL_SIG) throw new ZipError(`로컬 헤더가 손상되었습니다: ${name}`);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const body = buffer.subarray(dataStart, dataStart + compressedSize);

    let data: Buffer;
    if (method === 0) data = Buffer.from(body);
    else if (method === 8) data = inflateRawSync(body);
    else throw new ZipError(`지원하지 않는 압축 방식(${method})입니다: ${name}`);

    if (data.length !== uncompressedSize) throw new ZipError(`압축 해제 크기가 다릅니다: ${name}`);
    if (crc32(data) !== expectedCrc) throw new ZipError(`CRC 검증에 실패했습니다: ${name}`);

    files.push({ path: name, data });
  }
  return files;
}

/**
 * ZIP 전체가 폴더 하나로 감싸여 있으면 그 폴더 이름을 돌려준다.
 * Moiré 테마 ZIP은 skin 루트 기준이라 보통 null이지만, 사용자가 다시 압축한 경우를 흡수한다.
 */
export function detectRootPrefix(files: ZipFile[]): string | null {
  if (files.length === 0) return null;
  const first = files[0]!.path.replace(/\\/g, "/");
  if (!first.includes("/")) return null;
  const candidate = first.slice(0, first.indexOf("/"));
  if (!candidate || candidate === "." || candidate === "..") return null;
  const prefix = `${candidate}/`;
  return files.every((file) => file.path.replace(/\\/g, "/").startsWith(prefix)) ? candidate : null;
}

export function stripRootPrefix(files: ZipFile[], prefix: string | null): ZipFile[] {
  if (!prefix) return files;
  const head = `${prefix}/`;
  return files.map((file) => ({ ...file, path: file.path.replace(/\\/g, "/").slice(head.length) }));
}
