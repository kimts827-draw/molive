import ssh2 from "ssh2";

const { Server, utils } = ssh2;
const { STATUS_CODE } = utils.sftp;

const DIR_MODE = 0o040755;
const FILE_MODE = 0o100644;

/**
 * 테스트용 최소 인메모리 SFTP 서버.
 * 설치기가 실제 SFTP 왕복(OPENDIR/MKDIR/OPEN/WRITE/CLOSE)을 제대로 하는지 확인하는 용도다.
 */
export async function startMockSftpServer(options = {}) {
  const failWrites = new Set(options.failWrites ?? []);
  const files = new Map(); // path -> Buffer
  const home = options.home ?? "/";
  const directories = new Set(["/"]);
  for (const path of [home, ...(options.directories ?? ["/sde_design"])]) {
    for (let current = path; current.length > 1; current = current.slice(0, current.lastIndexOf("/")) || "/") {
      directories.add(current); // 상위 디렉터리까지 함께 만들어 둔다.
    }
  }
  const hostKey = utils.generateKeyPairSync("ed25519").private;

  const attrsFor = (isDirectory, size) => ({
    mode: isDirectory ? DIR_MODE : FILE_MODE,
    uid: 0,
    gid: 0,
    size: isDirectory ? 4096 : size,
    atime: 0,
    mtime: 0,
  });

  const server = new Server({ hostKeys: [hostKey] }, (client) => {
    client.on("authentication", (ctx) => ctx.accept());
    client.on("ready", () => {
      client.on("session", (acceptSession) => {
        const session = acceptSession();
        session.on("sftp", (acceptSftp) => {
          const sftp = acceptSftp();
          const handles = new Map();
          let nextHandle = 1;
          const open = (payload) => {
            const id = nextHandle++;
            handles.set(id, payload);
            return Buffer.from(String(id));
          };
          const get = (handle) => handles.get(Number(handle.toString()));

          sftp.on("REALPATH", (reqid, target) => {
            // 로그인 직후 상대 경로는 홈 디렉터리로 풀어 준다. (실제 SFTP 서버와 동일)
            const relative = target === "." || target === "" ? "" : target;
            const absolute = target.startsWith("/") ? target : `${home === "/" ? "" : home}/${relative}`.replace(/\/$/, "") || "/";
            sftp.name(reqid, [{ filename: absolute, longname: absolute, attrs: attrsFor(true, 0) }]);
          });

          sftp.on("OPENDIR", (reqid, target) => {
            if (!directories.has(target)) return sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE);
            sftp.handle(reqid, open({ kind: "dir", path: target, done: false }));
          });

          sftp.on("READDIR", (reqid, handle) => {
            const entry = get(handle);
            if (!entry || entry.kind !== "dir") return sftp.status(reqid, STATUS_CODE.FAILURE);
            if (entry.done) return sftp.status(reqid, STATUS_CODE.EOF);
            entry.done = true;
            const prefix = entry.path === "/" ? "/" : `${entry.path}/`;
            const names = [];
            for (const directory of directories) {
              if (directory === entry.path || !directory.startsWith(prefix)) continue;
              const rest = directory.slice(prefix.length);
              if (rest.includes("/")) continue;
              names.push({ filename: rest, longname: `drwxr-xr-x 1 0 0 4096 ${rest}`, attrs: attrsFor(true, 0) });
            }
            for (const [file, data] of files) {
              if (!file.startsWith(prefix)) continue;
              const rest = file.slice(prefix.length);
              if (rest.includes("/")) continue;
              names.push({ filename: rest, longname: `-rw-r--r-- 1 0 0 ${data.length} ${rest}`, attrs: attrsFor(false, data.length) });
            }
            sftp.name(reqid, names);
          });

          const respondStat = (reqid, target) => {
            if (directories.has(target)) return sftp.attrs(reqid, attrsFor(true, 0));
            const data = files.get(target);
            if (data) return sftp.attrs(reqid, attrsFor(false, data.length));
            return sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE);
          };
          sftp.on("STAT", respondStat);
          sftp.on("LSTAT", respondStat);

          sftp.on("MKDIR", (reqid, target) => {
            if (directories.has(target) || files.has(target)) return sftp.status(reqid, STATUS_CODE.FAILURE);
            const parent = target.slice(0, target.lastIndexOf("/")) || "/";
            if (!directories.has(parent)) return sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE);
            directories.add(target);
            sftp.status(reqid, STATUS_CODE.OK);
          });

          sftp.on("OPEN", (reqid, target) => {
            if (failWrites.has(target)) return sftp.status(reqid, STATUS_CODE.PERMISSION_DENIED);
            const parent = target.slice(0, target.lastIndexOf("/")) || "/";
            if (!directories.has(parent)) return sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE);
            sftp.handle(reqid, open({ kind: "file", path: target, chunks: [] }));
          });

          sftp.on("WRITE", (reqid, handle, offset, data) => {
            const entry = get(handle);
            if (!entry || entry.kind !== "file") return sftp.status(reqid, STATUS_CODE.FAILURE);
            entry.chunks.push({ offset, data: Buffer.from(data) });
            sftp.status(reqid, STATUS_CODE.OK);
          });

          sftp.on("FSTAT", (reqid, handle) => {
            const entry = get(handle);
            if (!entry) return sftp.status(reqid, STATUS_CODE.FAILURE);
            return sftp.attrs(reqid, attrsFor(entry.kind === "dir", 0));
          });

          sftp.on("FSETSTAT", (reqid) => sftp.status(reqid, STATUS_CODE.OK));
          sftp.on("SETSTAT", (reqid) => sftp.status(reqid, STATUS_CODE.OK));

          sftp.on("CLOSE", (reqid, handle) => {
            const entry = get(handle);
            if (entry && entry.kind === "file") {
              const size = entry.chunks.reduce((max, chunk) => Math.max(max, chunk.offset + chunk.data.length), 0);
              const buffer = Buffer.alloc(size);
              for (const chunk of entry.chunks) chunk.data.copy(buffer, chunk.offset);
              files.set(entry.path, buffer); // 기존 내용은 그대로 대체된다 = 덮어쓰기
            }
            handles.delete(Number(handle.toString()));
            sftp.status(reqid, STATUS_CODE.OK);
          });
        });
      });
    });
    client.on("error", () => {});
  });

  const port = await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });

  return {
    port,
    files,
    directories,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
