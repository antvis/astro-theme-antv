export const siteConfig = {
  site: {
    title: "Fixture",
    origin: "https://fixture.example.com",
    repository: "https://github.com/antvis/fixture",
    description: { zh: "测试站点", en: "Fixture site" },
  },
  content: {
    docs: "./docs",
    examples: "./examples",
  },
  navigation: [
    { text: { zh: "文档", en: "Docs" }, href: "/guide/" },
    { text: { zh: "示例", en: "Examples" }, href: "/examples/" },
    { text: { zh: "邮件", en: "Email" }, href: "mailto:team@example.com" },
  ],
  search: {
    aliases: { esm: ["module"] },
    pathBoosts: [{ prefix: "/guide/", weight: 500 }],
  },
  qa: {
    defaultStack: "s2",
    previewAdapters: {
      fixture: "./qa-preview-adapter.js",
    },
  },
  examples: [{ slug: "basic", title: { zh: "基础", en: "Basic" } }],
  home: {
    title: { zh: "静态文档与示例", en: "Static docs and examples" },
    description: { zh: "使用 Astro 构建。", en: "Built with Astro." },
    actions: [
      { text: { zh: "查看示例", en: "View examples" }, href: "/examples/" },
      { text: { zh: "电话联系", en: "Call us" }, href: "tel:+861012345678" },
    ],
  },
  slots: {
    home: {
      beforeFooter: ["./HomeSlot.astro"],
    },
  },
  theme: {
    tokens: {
      "--brand": "#5b5bd6",
      "--surface-raised": "#fefefe",
    },
  },
};
