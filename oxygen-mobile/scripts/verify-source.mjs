import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const baseline = JSON.parse(
  fs.readFileSync(
    new URL("../docs/source-baseline.json", import.meta.url),
    "utf8",
  ),
);
const changed = [];
for (const [file, expected] of Object.entries(baseline.files)) {
  const location = path.join(baseline.source, file);
  if (
    !fs.existsSync(location) ||
    crypto
      .createHash("sha256")
      .update(fs.readFileSync(location))
      .digest("hex") !== expected
  )
    changed.push(file);
}
if (changed.length) {
  console.error("Original website files changed:", changed);
  process.exitCode = 1;
} else
  console.log(
    `Original website preserved: ${Object.keys(baseline.files).length} source, asset, backend and pipeline checksums match.`,
  );
