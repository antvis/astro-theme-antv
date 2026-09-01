# Validation

The optimized architecture is validated against the real fixture in test/fixtures/basic-site.

## Commands

```sh
pnpm test
pnpm exec astro check --root test/fixtures/basic-site
pnpm exec astro build --root test/fixtures/basic-site
pnpm pack --dry-run
```

## Automated coverage

The test suite verifies that:

- the minimal strict configuration resolves with safe defaults;
- search and QA configuration resolve with safe defaults, package-owned service endpoints, validated built-in preview products, and consumer-relative custom adapter paths;
- controlled home slot paths resolve relative to the consumer and missing components fail before startup;
- output cannot escape or overlap protected consumer directories;
- the public package exposes `antvSite`, the Content Loader/Schema, and no executable CLI;
- the public `defineConfig` facade installs the integrations without a consumer-side Astro import;
- a consumer-owned page under the fixture's standard `src/pages` is preserved and built;
- localized documents build from the fixture's `docs` Content Collection through `getCollection()` and `render()`;
- localized MDX entries render expressions through the official Astro MDX integration and appear in document navigation;
- localized Markdown links and legacy `<code src>` references survive the processor compatibility layer;
- the @antv/site/qa and @antv/site/qa-entry subpaths and QA public types are published;
- the G2/G6/S2 adapter parsers enforce the shared payload policy and clean up instances after render failures;
- removed compiler, editor, and sandbox dependencies are absent;
- bilingual document, catalog, group, Demo, Result, sitemap, and robots routes build;
- the build emits a Pagefind index and renders the accessible search dialog;
- Astro `base` prefixes canonical URLs, navigation, Demo runners, QA routes, assets, and Pagefind paths;
- the development search endpoint exposes both live Content Collection documents and Demo records;
- the home page renders the package-owned QA entry with the configured default stack and consumer slots;
- a Demo with a relative import is emitted as a Vite ESM asset;
- Demo pages contain same-origin iframes, static source, and no playground or sandbox contract.

## Expected build properties

A fixture build produces static directory routes and assets under dist:

- localized documents and example pages;
- /demos/... runner pages;
- /{locale}/result/ QA pages when qa is configured;
- Vite-managed ESM chunks under /_assets/;
- Pagefind assets under /pagefind/;
- sitemap-index.xml and robots.txt.

The output must not contain the removed playground protocol, IIFE vendor globals, custom shared-vendor assets, or sandbox markup.

## Scope of the result

This validation covers trusted repository-authored examples on static hosting. It does not claim isolation for arbitrary user code, because public sandbox execution is intentionally outside the product scope.
