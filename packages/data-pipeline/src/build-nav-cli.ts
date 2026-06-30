import { buildNavGraphArtifacts } from "./build-nav-graph.js";

async function main(): Promise<void> {
  const nasrArg = process.argv.find((arg) => arg.startsWith("--nasr="));
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="));
  const cacheArg = process.argv.find((arg) => arg.startsWith("--cache="));

  await buildNavGraphArtifacts({
    nasrDir: nasrArg?.split("=")[1],
    outputDir: outputArg?.split("=")[1],
    cacheDir: cacheArg?.split("=")[1],
  });

  console.log("\nDone.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
