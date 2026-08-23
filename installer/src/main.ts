import { readFile } from "node:fs/promises";
import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from "electron";
import { resolveBasePath } from "./core/base-path";
import { installTheme, type InstallProgress, type InstallReport } from "./core/install";
import { SftpSession } from "./core/sftp";
import { normalizeBasePath, normalizeEntryPath } from "./core/remote-path";
import { detectRootPrefix, readZip, stripRootPrefix, type ZipFile } from "./core/zip";

/**
 * 모든 자격 증명과 원격 I/O는 이 main 프로세스 안에서만 일어난다.
 * 비밀번호는 connect 호출 인자로 한 번 흘러들어와 ssh2 세션이 잡고 있을 뿐,
 * 디스크·로그·외부 서버 어디에도 남기지 않는다.
 */

type ZipState = { filePath: string; files: ZipFile[]; rootPrefix: string | null };

const session = new SftpSession();
let zipState: ZipState | null = null;
let basePath: string | null = null;
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 940,
    height: 900,
    title: "Moiré 설치 도우미",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.removeMenu();
  void mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  void session.end();
  zipState = null;
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  void session.end();
  zipState = null;
});

function fail(error: unknown): never {
  throw new Error(error instanceof Error ? error.message : String(error));
}

ipcMain.handle("zip:pick", async () => {
  const result = await dialog.showOpenDialog({
    title: "Moiré에서 내려받은 디자인 파일 고르기",
    properties: ["openFile"],
    filters: [{ name: "디자인 압축 파일 (*.zip)", extensions: ["zip"] }],
  });
  if (result.canceled || result.filePaths.length === 0) return { canceled: true as const };

  const filePath = result.filePaths[0]!;
  try {
    const buffer = await readFile(filePath);
    const raw = readZip(buffer);
    const rootPrefix = detectRootPrefix(raw);
    const files = stripRootPrefix(raw, rootPrefix);
    // 선택 시점에 경로 검증을 미리 돌려, 설치 버튼을 누르기 전에 위험한 ZIP을 걸러낸다.
    const relativePaths = files.map((file) => normalizeEntryPath(file.path));
    zipState = { filePath, files, rootPrefix };
    return {
      canceled: false as const,
      filePath,
      fileCount: files.length,
      rootPrefix,
      totalBytes: files.reduce((sum, file) => sum + file.data.length, 0),
      hasIndexHtml: relativePaths.includes("index.html"),
      sample: relativePaths.slice(0, 12),
    };
  } catch (error) {
    zipState = null;
    fail(error);
  }
});

ipcMain.handle(
  "sftp:connect",
  async (
    _event: IpcMainInvokeEvent,
    input: { host: string; port: number; username: string; password: string; basePath: string },
  ) => {
    try {
      const host = input.host.trim();
      const username = input.username.trim();
      const port = Number(input.port);
      if (!host) throw new Error("FTP 주소를 입력해 주세요.");
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("접속 포트 번호를 확인해 주세요.");
      if (!username) throw new Error("계정을 입력해 주세요.");
      if (!input.password) throw new Error("비밀번호를 입력해 주세요.");

      const requestedBase = normalizeBasePath(input.basePath || "/");
      await session.connect({ host, port, username, password: input.password });

      // 경로를 못 찾아도 연결은 유지한다. 원격에 무엇이 있는지 봐야 다음 시도를 할 수 있다.
      const resolution = await resolveBasePath(session, requestedBase);
      basePath = resolution.basePath;
      return { ok: true as const, ...resolution };
    } catch (error) {
      await session.end();
      fail(error);
    }
  },
);

/** 기준 경로를 못 찾았을 때 사용자가 원격을 직접 훑어볼 수 있게 한다. */
ipcMain.handle("sftp:list", async (_event: IpcMainInvokeEvent, input: { path: string }) => {
  try {
    if (!session.connected) throw new Error("먼저 접속 확인을 해 주세요.");
    const target = normalizeBasePath(input.path);
    return { path: target, directories: await session.listDirectories(target) };
  } catch (error) {
    fail(error);
  }
});

ipcMain.handle("sftp:disconnect", async () => {
  await session.end();
  return { ok: true as const };
});

ipcMain.handle("install:start", async (event: IpcMainInvokeEvent, input: { skinName: string }): Promise<InstallReport> => {
  try {
    if (!session.connected) throw new Error("먼저 접속 확인을 해 주세요.");
    if (!basePath) throw new Error("디자인 폴더 위치를 찾지 못했습니다. 접속 확인을 다시 해 주세요.");
    if (!zipState) throw new Error("먼저 디자인 파일을 골라 주세요.");
    const send = (progress: InstallProgress) => {
      if (!event.sender.isDestroyed()) event.sender.send("install:progress", progress);
    };
    return await installTheme(session, { files: zipState.files, basePath, skinName: input.skinName }, send);
  } catch (error) {
    fail(error);
  }
});
