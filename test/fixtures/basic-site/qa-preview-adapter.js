export default {
  title: { zh: "Fixture 预览", en: "Fixture preview" },
  parse(value) {
    return value;
  },
  render(container) {
    container.textContent = "fixture QA preview";
    return { destroy() {} };
  },
};
