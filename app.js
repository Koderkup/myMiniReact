import { createElement, start } from './core/mini-react';
import { Counter } from './components/Counter';
import { html } from './core/html';

export function App() {
  // return createElement('div', null,
  //   createElement('h1', null, 'My mini-React'),
  //   createElement(Counter)
  // );

  // or using JSX
  return html`<div>
    <h1>Fiber Implementation: Multiple Component Instances</h1>
    <${Counter} />
    <${Counter} />
    <div>
      <${Counter} />
      <div>
        <${Counter} />
        <p>Nested counter</p>
        <div><${Counter} /></div>
      </div>
    </div>
  </div>`;
}

start(App, document.getElementById('root'));
