import { Client, type ConnectConfig, type SFTPWrapper, type Stats } from "ssh2";

/**
 * ssh2 위에 얹은 최소 SFTP 래퍼.
 * 자격 증명은 connect 호출 인자로만 들어오고, 이 모듈은 어디에도 기록하지 않는다.
 */

export type SftpCredentials = {
  host: string;
  port: number;
  username: string;
  password: string;
};

export class SftpSession {
  private client: Client | null = null;
  private sftp: SFTPWrapper | null = null;

  get connected(): boolean {
    return this.sftp !== null;
  }

  async connect(credentials: SftpCredentials, readyTimeout = 20000): Promise<void> {
    await this.end();
    const client = new Client();
    const config: ConnectConfig = {
      host: credentials.host,
      port: credentials.port,
      username: credentials.username,
      password: credentials.password,
      readyTimeout,
      keepaliveInterval: 10000,
      // Cafe24 디자인FTP는 구형 알고리즘만 받는 경우가 있어 legacy 후보를 뒤에 덧붙인다.
      // @types/ssh2의 AlgorithmList는 append/prepend/remove를 모두 요구한다. 빈 배열은 무동작.
      algorithms: {
        kex: { append: ["diffie-hellman-group14-sha1", "diffie-hellman-group1-sha1"], prepend: [], remove: [] },
        serverHostKey: { append: ["ssh-rsa", "ssh-dss"], prepend: [], remove: [] },
      },
    };

    await new Promise<void>((resolve, reject) => {
      const fail = (error: Error) => {
        client.removeAllListeners();
        client.end();
        reject(error);
      };
      client.on("ready", () => resolve());
      client.on("error", fail);
      client.connect(config);
    });

    const sftp = await new Promise<SFTPWrapper>((resolve, reject) => {
      client.sftp((error, handle) => (error ? reject(error) : resolve(handle)));
    });

    this.client = client;
    this.sftp = sftp;
  }

  private require(): SFTPWrapper {
    if (!this.sftp) throw new Error("SFTP에 연결되어 있지 않습니다.");
    return this.sftp;
  }

  async listDirectories(remotePath: string): Promise<string[]> {
    const sftp = this.require();
    const entries = await new Promise<Array<{ filename: string; attrs: Stats }>>((resolve, reject) => {
      sftp.readdir(remotePath, (error, list) => (error ? reject(error) : resolve(list)));
    });
    return entries
      .filter((entry) => entry.attrs.isDirectory())
      .map((entry) => entry.filename)
      .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  }

  /** 로그인 직후의 홈 디렉터리 등 상대 경로를 절대 경로로 바꾼다. */
  async realpath(remotePath: string): Promise<string> {
    const sftp = this.require();
    return new Promise((resolve, reject) => {
      sftp.realpath(remotePath, (error, absolute) => (error ? reject(error) : resolve(absolute)));
    });
  }

  async stat(remotePath: string): Promise<Stats | null> {
    const sftp = this.require();
    return new Promise((resolve, reject) => {
      sftp.stat(remotePath, (error, stats) => {
        if (!error) return resolve(stats);
        const code = (error as NodeJS.ErrnoException & { code?: number }).code;
        if (code === 2) return resolve(null); // SSH_FX_NO_SUCH_FILE
        return reject(error);
      });
    });
  }

  /** 이미 존재하면 성공으로 본다. 같은 이름의 파일이 있으면 실패. */
  async ensureDirectory(remotePath: string): Promise<void> {
    const sftp = this.require();
    const created = await new Promise<boolean>((resolve) => {
      sftp.mkdir(remotePath, (error) => resolve(!error));
    });
    if (created) return;
    const stats = await this.stat(remotePath);
    if (!stats) throw new Error(`디렉터리를 만들 수 없습니다: ${remotePath}`);
    if (!stats.isDirectory()) throw new Error(`같은 이름의 파일이 있어 디렉터리를 만들 수 없습니다: ${remotePath}`);
  }

  /** 기존 파일은 truncate 후 덮어쓴다. */
  async writeFile(remotePath: string, data: Buffer): Promise<void> {
    const sftp = this.require();
    await new Promise<void>((resolve, reject) => {
      sftp.writeFile(remotePath, data, { flag: "w" }, (error) => (error ? reject(error) : resolve()));
    });
  }

  async end(): Promise<void> {
    const client = this.client;
    this.sftp = null;
    this.client = null;
    if (!client) return;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 2000);
      client.once("close", () => {
        clearTimeout(timer);
        resolve();
      });
      client.end();
    });
  }
}
