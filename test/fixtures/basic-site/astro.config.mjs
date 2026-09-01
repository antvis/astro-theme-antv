import { defineConfig } from "astro/config";
import { antvSite } from "../../../dist/index.js";
import { siteConfig } from "./site.config.mjs";

export default defineConfig({
  integrations: antvSite(siteConfig),
});
