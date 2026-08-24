export function didUpdateProject(row: unknown): row is { id: string } {
  return Boolean(row && typeof row === "object" && "id" in row && typeof (row as { id?: unknown }).id === "string");
}
