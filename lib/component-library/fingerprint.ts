/**
 * target별 binding 값과 Cafe24 module attribute를 제외하고 tag/class/attribute 골격만 지문화합니다.
 * 문자열 비교라서 DOM parser나 브라우저 환경에 의존하지 않습니다.
 */
export function structuralFingerprint(html: string): string {
  const source = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\{\$[^}]+\}/g, "__binding__");
  const tokens: string[] = [];
  for (const match of source.matchAll(/<\/?([A-Za-z][A-Za-z0-9-]*)([^>]*)>/g)) {
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();
    if (fullTag.startsWith("</")) {
      tokens.push(`close:${tagName}`);
      continue;
    }

    const attributes = match[2];
    const classValue = attributes.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i)?.slice(1).find((value) => value !== undefined) ?? "";
    const classes = classValue.split(/\s+/).filter(Boolean);
    const attributeNames: string[] = [];
    for (const attribute of attributes.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/g)) {
      const name = attribute[1].toLowerCase();
      if (name !== "class" && name !== "module") attributeNames.push(name);
    }
    tokens.push(`open:${tagName}|classes:${classes.join(".")}|attrs:${attributeNames.sort().join(",")}|self:${fullTag.endsWith("/>") ? "1" : "0"}`);
  }
  return tokens.join("\n");
}
