import { cp, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const target = join(root, "dist", "renderer");
await mkdir(target, { recursive: true });
await cp(join(root, "src", "renderer", "index.html"), join(target, "index.html"));
console.log("copied renderer/index.html");
