import { createElement, createFragment, useState } from '../core/mini-react';
import { Viewer } from './Viewer';
import { html } from '../core/html';

export const Counter = () => {
  const [count, setCount] = useState(0);
  const onClick = () => setCount((ildValue) => ildValue + 1);

  // Or using createElement and createFragment
  // return createElement("div", null,
  //   createFragment([
  //     createElement("button", { onclick: onClick }, `Click me`),
  //     createElement(Viewer, { count })
  //   ]));

  //  Or using html tag
  return html`<div>
    <button onClick=${onClick}>Click me</button>
    <${Viewer} count=${count} />
  </div>`;
};
