/**
 * 실제 Electron 런타임에서 설정 저장이 제대로 도는지 확인한다.
 * 가짜 코덱이 아니라 Windows 자격 증명 보호(DPAPI)를 그대로 쓰기 때문에,
 * 단위 테스트가 잡지 못하는 "이 PC에서 정말 암호화되는가"를 검증한다.
 *
 *   npx electron scripts/verify-safe-storage.cjs <결과를 적을 파일>
 */
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { app, safeStorage } = require("electron");
const { DEFAULT_SETTINGS } = require("../dist/core/settings.js");
const { loadSettings, saveSettings } = require("../dist/core/settings-store.js");

const outputFile = process.argv[process.argv.length - 1];
const SECRET = "검증용-비밀번호-1234";

const codec = {
  get available() {
    return safeStorage.isEncryptionAvailable();
  },
  encrypt: (plain) => safeStorage.encryptString(plain).toString("base64"),
  decrypt: (cipher) => safeStorage.decryptString(Buffer.from(cipher, "base64")),
};

app.whenReady().then(async () => {
  const result = {};
  let directory;
  try {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), "moire-verify-"));
    const file = path.join(directory, "settings.json");

    await saveSettings(
      file,
      codec,
      {
        ...DEFAULT_SETTINGS,
        host: "ftp.example.test",
        port: 8105,
        username: "myshop",
        lastZipDirectory: path.join(os.homedir(), "Desktop", "Moireskins"),
        rememberPassword: true,
      },
      SECRET,
    );

    const raw = await fs.readFile(file, "utf8");
    const loaded = await loadSettings(file, codec);

    result.encryptionAvailable = safeStorage.isEncryptionAvailable();
    result.plaintextPasswordInFile = raw.includes(SECRET);
    result.hasEncryptedPassword = Boolean(JSON.parse(raw).encryptedPassword);
    result.restoredHost = loaded.settings.host;
    result.restoredPort = loaded.settings.port;
    result.restoredUsername = loaded.settings.username;
    result.restoredZipDirectory = loaded.settings.lastZipDirectory;
    result.passwordRestored = loaded.password === SECRET;
    result.settingsFileInProduction = path.join(app.getPath("userData"), "settings.json");
    result.downloadsFallback = app.getPath("downloads");
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  } finally {
    if (directory) await fs.rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }

  await fs.writeFile(outputFile, JSON.stringify(result, null, 2), "utf8");
  app.exit(result.error ? 1 : 0);
});
