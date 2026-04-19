import { readFileSync } from "node:fs";

const stdin = readFileSync(0, "utf8");
const payload = JSON.parse(stdin);
const output =
  payload?.input?.fixtures?.output_text ??
  `No fixture output provided for ${payload?.id ?? "unknown-case"}`;

process.stdout.write(String(output));
