import "server-only";

export const installerRelease = {
  version: process.env.INSTALLER_VERSION?.trim() || "0.1.0",
  downloadPath: "/api/installer/download",
} as const;

export function getInstallerDownloadUrl() {
  const value = process.env.INSTALLER_DOWNLOAD_URL?.trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}
