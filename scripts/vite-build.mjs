// Must run before esbuild is loaded so it uses this project's matching binary.
delete process.env.ESBUILD_BINARY_PATH;

const { build } = await import("vite");

await build({ configFile: "vite.config.ts" });
