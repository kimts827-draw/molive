import assert from "node:assert/strict";
import test from "node:test";
import { resolveBasePath } from "../dist/core/base-path.js";
import { installTheme } from "../dist/core/install.js";
import { SftpSession } from "../dist/core/sftp.js";
import { startMockSftpServer } from "./sftp-server.mjs";

const theme = () => [
  { path: "index.html", data: Buffer.from("<html>Moiré</html>", "utf8") },
  { path: "layout/basic/main.html", data: Buffer.from("main", "utf8") },
  { path: "layout/basic/css/main.css", data: Buffer.from("body{color:#111}", "utf8") },
  { path: "css/moire.css", data: Buffer.from(".moire{}", "utf8") },
];

async function withServer(options, run) {
  const server = await startMockSftpServer({ directories: ["/sde_design/skin1", "/sde_design/skin9"], ...options });
  const session = new SftpSession();
  try {
    await session.connect({ host: "127.0.0.1", port: server.port, username: "moire", password: "in-memory-only" });
    await run(session, server);
  } finally {
    await session.end();
    await server.close();
  }
}

test("skinXX 목록을 읽는다", async () => {
  await withServer({}, async (session) => {
    assert.deepEqual(await session.listDirectories("/sde_design"), ["skin1", "skin9"]);
  });
});

test("테마 전체가 선택한 skin 루트에 같은 구조로 올라간다", async () => {
  await withServer({}, async (session, server) => {
    const report = await installTheme(session, { files: theme(), basePath: "/sde_design", skinName: "skin9" }, () => {});
    assert.equal(report.complete, true);
    assert.equal(report.succeeded, 4);
    assert.deepEqual(report.failures, []);
    assert.equal(server.files.get("/sde_design/skin9/index.html").toString("utf8"), "<html>Moiré</html>");
    assert.equal(server.files.get("/sde_design/skin9/layout/basic/css/main.css").toString("utf8"), "body{color:#111}");
    assert.ok(server.directories.has("/sde_design/skin9/layout/basic/css"));
    // 다른 스킨은 건드리지 않는다.
    assert.equal([...server.files.keys()].some((path) => path.startsWith("/sde_design/skin1/")), false);
  });
});

test("기존 파일은 덮어쓴다", async () => {
  await withServer({}, async (session, server) => {
    server.files.set("/sde_design/skin9/index.html", Buffer.from("예전 내용", "utf8"));
    const report = await installTheme(session, { files: theme(), basePath: "/sde_design", skinName: "skin9" }, () => {});
    assert.equal(report.complete, true);
    assert.equal(server.files.get("/sde_design/skin9/index.html").toString("utf8"), "<html>Moiré</html>");
  });
});

test("파일 하나가 실패하면 설치 완료로 처리하지 않는다", async () => {
  await withServer({ failWrites: ["/sde_design/skin9/css/moire.css"] }, async (session) => {
    const report = await installTheme(session, { files: theme(), basePath: "/sde_design", skinName: "skin9" }, () => {});
    assert.equal(report.complete, false);
    assert.equal(report.succeeded, 3);
    assert.equal(report.failures.length, 1);
    assert.equal(report.failures[0].path, "css/moire.css");
    assert.ok(report.failures[0].error.length > 0);
  });
});

test("스킨 밖을 노리는 엔트리가 있으면 한 글자도 쓰지 않고 중단한다", async () => {
  await withServer({}, async (session, server) => {
    const files = [...theme(), { path: "../skin1/index.html", data: Buffer.from("탈출", "utf8") }];
    await assert.rejects(
      () => installTheme(session, { files, basePath: "/sde_design", skinName: "skin9" }, () => {}),
      /경로/,
    );
    assert.equal(server.files.size, 0);
  });
});

test("없는 스킨을 고르면 설치를 시작하지 않는다", async () => {
  await withServer({}, async (session, server) => {
    await assert.rejects(
      () => installTheme(session, { files: theme(), basePath: "/sde_design", skinName: "skin77" }, () => {}),
      /디자인 폴더를 찾을 수 없습니다/,
    );
    assert.equal(server.files.size, 0);
  });
});

test("진행률은 파일 수만큼 보고된다", async () => {
  await withServer({}, async (session) => {
    const uploads = [];
    await installTheme(session, { files: theme(), basePath: "/sde_design", skinName: "skin9" }, (progress) => {
      if (progress.phase === "upload") uploads.push(progress);
    });
    assert.equal(uploads.length, 4);
    assert.equal(uploads.at(-1).current, 4);
    assert.equal(uploads.at(-1).total, 4);
  });
});

test("기준 경로가 홈 디렉터리 아래에 있어도 찾아낸다", async () => {
  const server = await startMockSftpServer({
    home: "/myshop",
    directories: ["/myshop/sde_design/skin9"],
  });
  const session = new SftpSession();
  try {
    await session.connect({ host: "127.0.0.1", port: server.port, username: "myshop", password: "x" });
    const resolution = await resolveBasePath(session, "/sde_design");
    assert.equal(resolution.basePath, "/myshop/sde_design");
    assert.deepEqual(resolution.skins, ["skin9"]);
  } finally {
    await session.end();
    await server.close();
  }
});

test("skinXX를 못 찾아도 연결을 끊지 않고 확인한 경로와 폴더 목록을 돌려준다", async () => {
  const server = await startMockSftpServer({ home: "/myshop", directories: ["/myshop/design_backup"] });
  const session = new SftpSession();
  try {
    await session.connect({ host: "127.0.0.1", port: server.port, username: "myshop", password: "x" });
    const resolution = await resolveBasePath(session, "/sde_design");
    assert.equal(resolution.skins.length, 0);
    assert.equal(resolution.home, "/myshop");
    assert.deepEqual(resolution.homeEntries, ["design_backup"]);
    assert.ok(resolution.candidates.includes("/sde_design"));
    assert.ok(resolution.candidates.includes("/myshop"));
    assert.equal(session.connected, true);
  } finally {
    await session.end();
    await server.close();
  }
});

test("실제 Cafe24 구조(루트 바로 아래 skinXX)를 찾아 설치한다", async () => {
  // FileZilla로 접속했을 때 보이는 구조: / 아래에 base, mobile, web, skin3…skin11
  const server = await startMockSftpServer({
    home: "/",
    directories: ["/base", "/mobile", "/web", "/skin3", "/skin4", "/skin9", "/skin11"],
  });
  const session = new SftpSession();
  try {
    await session.connect({ host: "127.0.0.1", port: server.port, username: "myshop", password: "x" });

    // 기본값이 `/sde_design`이어도 루트까지 확인해서 찾아낸다.
    const resolution = await resolveBasePath(session, "/sde_design");
    assert.equal(resolution.basePath, "/");
    assert.deepEqual(resolution.skins, ["skin3", "skin4", "skin9", "skin11"]);
    assert.deepEqual(resolution.homeEntries, ["base", "mobile", "skin3", "skin4", "skin9", "skin11", "web"]);

    const report = await installTheme(session, { files: theme(), basePath: "/", skinName: "skin11" }, () => {});
    assert.equal(report.complete, true);
    assert.equal(server.files.get("/skin11/index.html").toString("utf8"), "<html>Moiré</html>");
    assert.ok(server.directories.has("/skin11/layout/basic/css"));
    // 다른 스킨과 base/mobile/web은 건드리지 않는다.
    assert.equal([...server.files.keys()].every((path) => path.startsWith("/skin11/")), true);
  } finally {
    await session.end();
    await server.close();
  }
});

test("쇼핑몰이 관리하는 sitemap 파일은 올리지 않고, 그래도 설치 완료로 본다", async () => {
  // 기준 스킨 압축본에는 카페24가 서버에서 만든 sitemap이 딸려 오고 쓰기 권한도 없다.
  await withServer(
    { failWrites: ["/sde_design/skin9/sitemap.xml", "/sde_design/skin9/sitemap0.xml.temp"] },
    async (session, server) => {
      const files = [
        ...theme(),
        { path: "sitemap.xml", data: Buffer.from("<urlset/>", "utf8") },
        { path: "sitemap0.xml.temp", data: Buffer.from("<urlset/>", "utf8") },
      ];
      const report = await installTheme(session, { files, basePath: "/sde_design", skinName: "skin9" }, () => {});
      assert.equal(report.complete, true);
      assert.equal(report.total, 4);
      assert.equal(report.succeeded, 4);
      assert.deepEqual(report.skipped, ["sitemap.xml", "sitemap0.xml.temp"]);
      assert.equal(server.files.has("/sde_design/skin9/sitemap.xml"), false);
      assert.equal(server.files.has("/sde_design/skin9/sitemap0.xml.temp"), false);
    },
  );
});
