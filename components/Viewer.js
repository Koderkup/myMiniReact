import { createElement, useMemo, createFragment } from '../core/mini-react';
import { html } from '../core/html';

export const Viewer = (props) => {
  const { count } = props;

  const textValue = useMemo(() => {
    if (count % 2 === 0) return 'even';
    return 'odd';
  }, [count]);

  // using createElement and createFragment
  // return createElement("div", null,
  //   createFragment([
  //     createElement("h2", null, `Counter: ${count}`),
  //     createElement("h3", null, `This is ${textValue} number`)
  //   ]));

  // Or using html tag
  return html`<div>
    <h2>Counter: ${count}</h2>
    <h3>This ${textValue} number</h3>
  </div>`;
};
