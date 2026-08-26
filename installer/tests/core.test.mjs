import assert from "node:assert/strict";
import test from "node:test";
import { crc32, deflateRawSync } from "node:zlib";
import { detectRootPrefix, readZip, stripRootPrefix } from "../dist/core/zip.js";
import { collectDirectories, joinInsideSkin, normalizeBasePath, normalizeEntryPath, resolveSkinRoot } from "../dist/core/remote-path.js";

/** MOLIVE 서버의 lib/zip.ts와 같은 방식으로 ZIP을 만든다. (설치기 입력 재현) */
function createZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.path, "utf8");
    const crc = crc32(entry.data);
    const deflated = deflateRawSync(entry.data, { level: 9 });
    const stored = deflated.length >= entry.data.length;
    const body = stored ? entry.data : deflated;
    const method = stored ? 0 : 8;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + body.length;
  }
  const directory = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, eocd]);
}

test("MOLIVE 테마 ZIP을 그대로 읽는다", () => {
  const source = [
    { path: "index.html", data: Buffer.from("<html>MOLIVE</html>".repeat(20), "utf8") },
    { path: "layout/basic/main.html", data: Buffer.from("layout", "utf8") },
    { path: "css/moire/한글.css", data: Buffer.from("body{}", "utf8") },
  ];
  const files = readZip(createZip(source));
  assert.equal(files.length, 3);
  assert.deepEqual(files.map((file) => file.path).sort(), ["css/moire/한글.css", "index.html", "layout/basic/main.html"]);
  assert.equal(files.find((file) => file.path === "index.html").data.toString("utf8"), source[0].data.toString("utf8"));
  assert.equal(detectRootPrefix(files), null);
});

test("폴더로 한 번 감싼 ZIP은 최상위 폴더를 제거한다", () => {
  const files = readZip(createZip([
    { path: "skin4/index.html", data: Buffer.from("a") },
    { path: "skin4/css/main.css", data: Buffer.from("b") },
  ]));
  const prefix = detectRootPrefix(files);
  assert.equal(prefix, "skin4");
  assert.deepEqual(stripRootPrefix(files, prefix).map((file) => file.path).sort(), ["css/main.css", "index.html"]);
});

test("경로 탈출은 전부 거부한다", () => {
  for (const bad of ["../evil.html", "a/../../evil.html", "/etc/passwd", "C:/windows/system32", "a\u0000b"]) {
    assert.throws(() => normalizeEntryPath(bad), /UnsafePathError|경로/);
  }
  assert.equal(normalizeEntryPath("./layout//basic/main.html"), "layout/basic/main.html");
});

test("설치 경로는 항상 선택한 skinXX 안에 들어간다", () => {
  const root = resolveSkinRoot("/sde_design", "skin12");
  assert.equal(root, "/sde_design/skin12");
  assert.equal(joinInsideSkin(root, "layout/basic/main.html"), "/sde_design/skin12/layout/basic/main.html");
  assert.throws(() => joinInsideSkin(root, "../skin1/index.html"), /경로/);
  assert.throws(() => resolveSkinRoot("/sde_design", "../etc"), /skinXX/);
});

test("디렉터리는 상위부터 순서대로 만들어진다", () => {
  const dirs = collectDirectories("/sde_design/skin12", ["index.html", "layout/basic/css/main.css", "css/a.css"]);
  assert.deepEqual(dirs, [
    "/sde_design/skin12/css",
    "/sde_design/skin12/layout",
    "/sde_design/skin12/layout/basic",
    "/sde_design/skin12/layout/basic/css",
  ]);
});

test("디자인 루트로 chroot된 계정은 `/`가 기준 경로가 된다", () => {
  assert.equal(normalizeBasePath("/"), "/");
  assert.equal(normalizeBasePath("//"), "/");
  assert.equal(resolveSkinRoot("/", "skin11"), "/skin11");
  assert.equal(joinInsideSkin("/skin11", "layout/basic/main.html"), "/skin11/layout/basic/main.html");
  assert.deepEqual(collectDirectories("/skin11", ["index.html", "css/a.css"]), ["/skin11/css"]);
  assert.throws(() => joinInsideSkin("/", "index.html"), /스킨 루트/);
});
