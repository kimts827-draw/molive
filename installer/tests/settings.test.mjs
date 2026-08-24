import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_SETTINGS,
  resolveZipDialogDirectory,
  sanitizeSettings,
  toStoredSettings,
} from "../dist/core/settings.js";
import { loadSettings, saveSettings } from "../dist/core/settings-store.js";

const SECRET = "디자인FTP-비밀번호";

/** 실제 OS 암호화 대신 쓰는 가짜 코덱. 원문이 그대로 남지 않는지 확인할 수 있게 뒤집어 둔다. */
const codec = {
  available: true,
  encrypt: (plain) => Buffer.from(plain, "utf8").reverse().toString("base64"),
  decrypt: (cipher) => Buffer.from(Buffer.from(cipher, "base64").reverse()).toString("utf8"),
};

const unavailableCodec = {
  available: false,
  encrypt: () => {
    throw new Error("사용할 수 없음");
  },
  decrypt: () => {
    throw new Error("사용할 수 없음");
  },
};

async function withTempFile(run) {
  const directory = await mkdtemp(join(tmpdir(), "moire-settings-"));
  try {
    await run(join(directory, "settings.json"), directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("설정이 없으면 기본값으로 시작한다", () => {
  assert.deepEqual(sanitizeSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(sanitizeSettings("깨진 값"), DEFAULT_SETTINGS);
  assert.deepEqual(sanitizeSettings({}), DEFAULT_SETTINGS);
});

test("잘못된 값은 걸러내고 평문 비밀번호 키는 버린다", () => {
  const settings = sanitizeSettings({
    host: "  ftp.example.test  ",
    port: "8105",
    username: " myshop ",
    basePath: "sde_design",
    lastZipDirectory: "",
    rememberPassword: "yes",
    password: "평문이면 안 된다",
    secret: "이것도 안 된다",
  });
  assert.equal(settings.host, "ftp.example.test");
  assert.equal(settings.port, 8105);
  assert.equal(settings.username, "myshop");
  assert.equal(settings.basePath, "/", "슬래시로 시작하지 않는 경로는 기본값으로");
  assert.equal(settings.lastZipDirectory, null);
  assert.equal(settings.rememberPassword, false, "boolean이 아니면 저장하지 않음");
  assert.equal("password" in settings, false);
  assert.equal("secret" in settings, false);
});

test("포트 범위를 벗어나면 비워 둔다", () => {
  for (const port of [0, -1, 65536, 1.5, "abc", null]) {
    assert.equal(sanitizeSettings({ port }).port, null, String(port));
  }
  assert.equal(sanitizeSettings({ port: 22 }).port, 22);
});

test("비밀번호를 기억하지 않으면 암호문도 남기지 않는다", () => {
  const stored = toStoredSettings({
    ...DEFAULT_SETTINGS,
    rememberPassword: false,
    encryptedPassword: "AAAA",
  });
  assert.equal("encryptedPassword" in stored, false);
});

test("입력값을 저장했다가 그대로 되살린다", async () => {
  await withTempFile(async (file) => {
    const saved = await saveSettings(
      file,
      codec,
      {
        ...DEFAULT_SETTINGS,
        host: "ftp.example.test",
        port: 8105,
        username: "myshop",
        basePath: "/",
        lastZipDirectory: "C:\\Users\\tester\\Desktop\\Moireskins",
        rememberPassword: true,
      },
      SECRET,
    );
    assert.equal(saved.rememberPassword, true);

    const loaded = await loadSettings(file, codec);
    assert.equal(loaded.settings.host, "ftp.example.test");
    assert.equal(loaded.settings.port, 8105);
    assert.equal(loaded.settings.username, "myshop");
    assert.equal(loaded.settings.lastZipDirectory, "C:\\Users\\tester\\Desktop\\Moireskins");
    assert.equal(loaded.password, SECRET);
  });
});

test("저장 파일에 비밀번호 평문이 남지 않는다", async () => {
  await withTempFile(async (file) => {
    await saveSettings(file, codec, { ...DEFAULT_SETTINGS, rememberPassword: true }, SECRET);
    const raw = await readFile(file, "utf8");
    assert.equal(raw.includes(SECRET), false, "평문 비밀번호가 파일에 있으면 안 된다");
    assert.equal(JSON.parse(raw).password, undefined);
    assert.ok(JSON.parse(raw).encryptedPassword);
  });
});

test("비밀번호 저장을 끄면 이미 저장된 암호문도 지운다", async () => {
  await withTempFile(async (file) => {
    await saveSettings(file, codec, { ...DEFAULT_SETTINGS, rememberPassword: true }, SECRET);
    const kept = await loadSettings(file, codec);
    assert.equal(kept.password, SECRET);

    await saveSettings(file, codec, { ...kept.settings, rememberPassword: false }, null);
    const cleared = await loadSettings(file, codec);
    assert.equal(cleared.password, null);
    assert.equal(JSON.parse(await readFile(file, "utf8")).encryptedPassword, undefined);
  });
});

test("비밀번호를 새로 주지 않아도 이미 저장된 값은 유지된다", async () => {
  await withTempFile(async (file) => {
    await saveSettings(file, codec, { ...DEFAULT_SETTINGS, rememberPassword: true }, SECRET);
    const first = await loadSettings(file, codec);

    // 파일 고르기처럼 비밀번호와 무관한 저장이 일어나는 경우.
    await saveSettings(file, codec, { ...first.settings, lastZipDirectory: "D:\\themes" }, null);
    const second = await loadSettings(file, codec);
    assert.equal(second.password, SECRET);
    assert.equal(second.settings.lastZipDirectory, "D:\\themes");
  });
});

test("OS 암호화를 못 쓰면 비밀번호를 저장하지 않는다", async () => {
  await withTempFile(async (file) => {
    await saveSettings(file, unavailableCodec, { ...DEFAULT_SETTINGS, rememberPassword: true, host: "a.test" }, SECRET);
    const raw = JSON.parse(await readFile(file, "utf8"));
    assert.equal(raw.encryptedPassword, undefined);
    assert.equal(raw.host, "a.test");
    const loaded = await loadSettings(file, unavailableCodec);
    assert.equal(loaded.password, null);
  });
});

test("암호문을 풀지 못해도 나머지 입력값은 살린다", async () => {
  await withTempFile(async (file) => {
    await writeFile(
      file,
      JSON.stringify({ version: 1, host: "a.test", port: 8105, username: "myshop", basePath: "/", rememberPassword: true, encryptedPassword: "!!not-base64!!" }),
      "utf8",
    );
    const loaded = await loadSettings(file, {
      available: true,
      encrypt: () => "",
      decrypt: () => {
        throw new Error("다른 PC에서 만든 값");
      },
    });
    assert.equal(loaded.password, null);
    assert.equal(loaded.settings.host, "a.test");
    assert.equal(loaded.settings.port, 8105);
  });
});

test("깨진 설정 파일은 기본값으로 되돌린다", async () => {
  await withTempFile(async (file) => {
    await writeFile(file, "{ 이건 JSON이 아니다", "utf8");
    const loaded = await loadSettings(file, codec);
    assert.deepEqual(loaded.settings, DEFAULT_SETTINGS);
    assert.equal(loaded.password, null);
  });
});

test("마지막 폴더가 없어지면 기본 폴더로 되돌아간다", () => {
  const downloads = "C:\\Users\\tester\\Downloads";
  const last = "C:\\Users\\tester\\Desktop\\Moireskins";
  assert.equal(resolveZipDialogDirectory(last, downloads, (path) => path === last), last);
  assert.equal(resolveZipDialogDirectory(last, downloads, () => false), downloads);
  assert.equal(resolveZipDialogDirectory(null, downloads, () => true), downloads);
});
