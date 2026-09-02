import { defineConfig } from "astro/config";
import { antvSite } from "../../dist/index.js";
import { siteConfig } from "./site.config.mjs";

export default defineConfig({
  base: "/platform/",
  integrations: antvSite({
    ...siteConfig,
    output: "./dist-base",
  }),
});
