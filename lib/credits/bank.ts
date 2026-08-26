import "server-only";

export function bankTransferConfig() {
  const bankName = process.env.MOLIVE_BANK_NAME?.trim() ?? "";
  const accountNumber = process.env.MOLIVE_BANK_ACCOUNT?.trim() ?? "";
  const accountHolder = process.env.MOLIVE_BANK_HOLDER?.trim() ?? "";
  return { bankName, accountNumber, accountHolder, available: Boolean(bankName && accountNumber && accountHolder) };
}
