import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

/** 렌더러에는 아래 동작만 노출한다. Node·fs·ssh2는 넘기지 않는다. */
contextBridge.exposeInMainWorld("installer", {
  loadSettings: () => ipcRenderer.invoke("settings:load"),
  saveSettings: (input: {
    host: string;
    port: number | string;
    username: string;
    basePath: string;
    rememberPassword: boolean;
    password?: string;
  }) => ipcRenderer.invoke("settings:save", input),
  pickZip: () => ipcRenderer.invoke("zip:pick"),
  connect: (input: { host: string; port: number; username: string; password: string; basePath: string }) =>
    ipcRenderer.invoke("sftp:connect", input),
  list: (input: { path: string }) => ipcRenderer.invoke("sftp:list", input),
  disconnect: () => ipcRenderer.invoke("sftp:disconnect"),
  install: (input: { skinName: string }) => ipcRenderer.invoke("install:start", input),
  onProgress: (listener: (progress: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, progress: unknown) => listener(progress);
    ipcRenderer.on("install:progress", handler);
    return () => ipcRenderer.off("install:progress", handler);
  },
});
