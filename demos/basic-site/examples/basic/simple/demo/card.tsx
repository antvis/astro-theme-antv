/** @jsxRuntime classic */
/** @jsx createElement */

type Child = Node | string;

const createElement = (
  tagName: string,
  attributes: Record<string, string> | null,
  ...children: Child[]
): HTMLElement => {
  const element = document.createElement(tagName);
  for (const [name, value] of Object.entries(attributes || {})) {
    element.setAttribute(name, value);
  }
  element.append(...children);
  return element;
};

const title: string = 'hello from tsx';
const card = (
  <section data-demo-kind="tsx">
    <strong>{title}</strong>
  </section>
);
const container = document.querySelector<HTMLElement>('#container');
if (!container) throw new Error('Demo container is missing.');
container.append(card);
