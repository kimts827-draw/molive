export type GenerationDestination =
  | { kind: "login"; href: string }
  | { kind: "project"; href: string }
  | { kind: "demo"; href: "/editor" }
  | { kind: "error"; message: string };

export function generationDestination(input: { status: number; projectId?: string; persistenceEnabled: boolean }): GenerationDestination {
  if (input.status === 401) return { kind: "login", href: "/login?next=%2F%23create" };
  if (input.projectId) return { kind: "project", href: `/editor?project=${encodeURIComponent(input.projectId)}` };
  if (input.persistenceEnabled) return { kind: "error", message: "프로젝트가 저장되지 않았습니다. 다시 시도해 주세요." };
  return { kind: "demo", href: "/editor" };
}
