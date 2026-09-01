import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';

hljs.registerLanguage('bash', bash);
hljs.registerLanguage('css', css);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('python', python);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('xml', xml);

hljs.registerAliases(['sh', 'shell'], { languageName: 'bash' });
hljs.registerAliases(['js', 'jsx'], { languageName: 'javascript' });
hljs.registerAliases(['ts', 'tsx'], { languageName: 'typescript' });
hljs.registerAliases(['html', 'svg'], { languageName: 'xml' });

const getDeclaredLanguage = (code: HTMLElement) =>
  Array.from(code.classList)
    .find((className) => className.startsWith('language-'))
    ?.slice('language-'.length);

export const highlightCodeBlocks = (target: HTMLElement) => {
  target.querySelectorAll<HTMLElement>('pre > code').forEach((code) => {
    if (code.dataset.highlighted === 'true') return;

    const source = code.textContent ?? '';
    const declaredLanguage = getDeclaredLanguage(code);
    const result =
      declaredLanguage && hljs.getLanguage(declaredLanguage)
        ? hljs.highlight(source, {
            language: declaredLanguage,
            ignoreIllegals: true,
          })
        : hljs.highlightAuto(source);

    code.innerHTML = result.value;
    code.classList.add('hljs');
    code.dataset.highlighted = 'true';
  });
};
