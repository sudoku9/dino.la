// Must run before esbuild is loaded so it uses this project's matching
// binary instead of a globally set (possibly newer) one.
delete process.env.ESBUILD_BINARY_PATH;

const { createServer } = await import("vite");

const host = process.env.HOST || "localhost";
const port = Number(process.env.PORT) || 5173;

const server = await createServer({
  configFile: "vite.config.ts",
  server: { host, port, strictPort: false }
});
await server.listen();
server.printUrls();
