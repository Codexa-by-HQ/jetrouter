import process from "node:process";
const override = process.argv.find((arg) => arg.startsWith("--entry="));
const entry = override
  ? override.slice("--entry=".length)
  : new URL("../src/index.js", import.meta.url).href;
export const {
  Router,
  createRouter,
  addRoute,
  findRoute,
  findAllRoutes,
  removeRoute,
  routeToRegExp,
} = await import(entry);
