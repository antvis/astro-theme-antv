# Basic site

A standalone Astro documentation site using the public `@antv/site` package API.
Requires Node.js >=22.12.0 and pnpm 10.34.5.

## Run independently

Copy this directory to its own location, then run:

```sh
pnpm install
pnpm dev
```

The demo requires `@antv/site@0.1.0` to be available in your npm registry.

Use `pnpm check`, `pnpm build`, and `pnpm preview` to check, build, and preview the
site.

Edit `astro.config.mjs` for site settings, `docs/` for localized documents,
`examples/` for demos, and `src/pages/` for consumer-owned pages.
