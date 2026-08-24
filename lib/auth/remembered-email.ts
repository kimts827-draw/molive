export const rememberedEmailKey = "moire:login-email";

type ReadableEmailStorage = Pick<Storage, "getItem">;
type WritableEmailStorage = Pick<Storage, "setItem" | "removeItem">;

export function readRememberedEmail(storage: ReadableEmailStorage) {
  return storage.getItem(rememberedEmailKey)?.trim() ?? "";
}

export function updateRememberedEmail(storage: WritableEmailStorage, email: string, remember: boolean) {
  if (remember) storage.setItem(rememberedEmailKey, email.trim().toLowerCase());
  else storage.removeItem(rememberedEmailKey);
}
