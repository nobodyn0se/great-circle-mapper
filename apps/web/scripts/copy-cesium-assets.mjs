import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cesiumRoot = resolve(appRoot, "node_modules/cesium/Build/Cesium");
const destRoot = resolve(appRoot, "public/cesiumStatic");

if (!existsSync(cesiumRoot)) {
  console.error("Cesium package not found. Run pnpm install first.");
  process.exit(1);
}

if (existsSync(destRoot)) {
  rmSync(destRoot, { recursive: true, force: true });
}

mkdirSync(destRoot, { recursive: true });

for (const dir of ["ThirdParty", "Workers", "Assets", "Widgets"]) {
  cpSync(resolve(cesiumRoot, dir), resolve(destRoot, dir), { recursive: true });
}

console.log(`Copied Cesium assets to ${destRoot}`);
