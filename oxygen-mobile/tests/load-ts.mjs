import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  ts = require("typescript");
export function loadTS(file, overrides = {}, cache = new Map()) {
  const absolute = path.resolve(file);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const source = fs.readFileSync(absolute, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  cache.set(absolute, module);
  const local = (name) => {
    if (name in overrides) return overrides[name];
    if (name.startsWith(".")) {
      const target = path.resolve(path.dirname(absolute), name);
      if (target.endsWith(".json"))
        return JSON.parse(fs.readFileSync(target, "utf8"));
      return loadTS(
        target.endsWith(".ts") ? target : target + ".ts",
        overrides,
        cache,
      );
    }
    return require(name);
  };
  new Function("require", "module", "exports", output)(
    local,
    module,
    module.exports,
  );
  return module.exports;
}
