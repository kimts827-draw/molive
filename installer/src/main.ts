import { statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain, safeStorage, type IpcMainInvokeEvent } from "electron";
import { resolveBasePath } from "./core/base-path";
import { installTheme, type InstallProgress, type InstallReport } from "./core/install";
import { SftpSession } from "./core/sftp";
import { normalizeBasePath, normalizeEntryPath } from "./core/remote-path";
import { DEFAULT_SETTINGS, resolveZipDialogDirectory, type Settings } from "./core/settings";
import { loadSettings, saveSettings, type SecretCodec } from "./core/settings-store";
import { detectRootPrefix, readZip, stripRootPrefix, type ZipFile } from "./core/zip";

/**
 * 모든 자격 증명과 원격 I/O는 이 main 프로세스 안에서만 일어난다.
 * 비밀번호는 외부 서버로 나가지 않고 로그에도 남기지 않는다.
 * 사용자가 저장을 선택했을 때만 OS 자격 증명 보호(Windows DPAPI)로 암호화해 이 PC에 둔다.
 */

type ZipState = { filePath: string; files: ZipFile[]; rootPrefix: string | null };

const session = new SftpSession();
let zipState: ZipState | null = null;
let basePath: string | null = null;
let mainWindow: BrowserWindow | null = null;

let settings: Settings = { ...DEFAULT_SETTINGS };
let storedPassword: string | null = null;

const settingsFile = () => path.join(app.getPath("userData"), "settings.json");

/** Windows에서는 로그인 계정에 묶인 DPAPI로 암호화된다. 다른 계정·다른 PC에서는 풀 수 없다. */
const codec: SecretCodec = {
  get available() {
    return safeStorage.isEncryptionAvailable();
  },
  encrypt: (plain) => safeStorage.encryptString(plain).toString("base64"),
  decrypt: (cipher) => safeStorage.decryptString(Buffer.from(cipher, "base64")),
};

function isUsableDirectory(target: string): boolean {
  try {
    return statSync(target).isDirectory();
  } catch {
    return false;
  }
}

async function persist(next: Settings, password: string | null): Promise<void> {
  settings = await saveSettings(settingsFile(), codec, next, password);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 940,
    height: 900,
    title: "MOLIVE Installer",
    icon: app.isPackaged
      ? path.join(process.resourcesPath, "molive_app_icon.ico")
      : path.join(app.getAppPath(), "build", "icon.ico"),
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

app.whenReady().then(async () => {
  const loaded = await loadSettings(settingsFile(), codec);
  settings = loaded.settings;
  storedPassword = loaded.password;
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
  const defaultPath = resolveZipDialogDirectory(settings.lastZipDirectory, app.getPath("downloads"), isUsableDirectory);
  const result = await dialog.showOpenDialog({
    title: "MOLIVE에서 내려받은 디자인 파일 고르기",
    properties: ["openFile"],
    defaultPath,
    filters: [{ name: "디자인 압축 파일 (*.zip)", extensions: ["zip"] }],
  });
  // 취소하면 마지막 폴더를 그대로 둔다.
  if (result.canceled || result.filePaths.length === 0) return { canceled: true as const };

  const filePath = result.filePaths[0]!;
  const directory = path.dirname(filePath);
  if (directory !== settings.lastZipDirectory) {
    await persist({ ...settings, lastZipDirectory: directory }, null).catch(() => undefined);
  }
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

ipcMain.handle("settings:load", async () => {
  const { encryptedPassword: _ignored, ...visible } = settings;
  return {
    settings: visible,
    password: storedPassword ?? "",
    canRememberPassword: codec.available,
  };
});

ipcMain.handle(
  "settings:save",
  async (
    _event: IpcMainInvokeEvent,
    input: { host: string; port: number | string; username: string; basePath: string; rememberPassword: boolean; password?: string },
  ) => {
    try {
      const remember = input.rememberPassword === true && codec.available;
      const password = remember ? (input.password || storedPassword) : null;
      await persist(
        {
          ...settings,
          host: input.host,
          port: Number(input.port),
          username: input.username,
          basePath: input.basePath,
          rememberPassword: remember,
        },
        password ?? null,
      );
      storedPassword = remember ? password ?? null : null;
      return { ok: true as const, rememberPassword: remember };
    } catch (error) {
      fail(error);
    }
  },
);

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
