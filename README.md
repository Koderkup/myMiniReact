# myMiniReact

All of React in ~200 lines of JavaScript – and you'll understand it forever.

A minimal React-like library built from scratch in pure JavaScript, demonstrating the core principles behind React's virtual DOM, hooks, reconciliation, and Fiber architecture.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Core Concepts](#core-concepts)
- [Project Structure](#project-structure)
- [Key Files](#key-files)
- [How It Works](#how-it-works)
- [Running the Project](#running-the-project)

## Overview

This project implements a mini-React engine from scratch. It covers:

- **Virtual DOM** – a lightweight in-memory representation of the UI
- **Reconciliation** – efficient diffing and updating of the real DOM
- **Hooks** – `useState` and `useMemo` for state and memoization
- **Fiber Architecture** – modern React-style node-based component tree management
- **JSX-like Syntax** – tagged template literals for declarative UI writing

The entire engine fits in a few hundred lines of JavaScript, proving that React's core ideas are elegant and understandable.

## Architecture

```
┌──────────────┐
│   index.html │  Entry point
└──────┬───────┘
       │
┌──────▼───────┐
│    app.js    │  Root component (App)
└──────┬───────┘
       │
┌──────▼───────────────────────────────────┐
│         core/mini-react.js               │  Empty – logic moved to fiber.js
└──────┬───────────────────────────────────┘
       │
┌──────▼──────────────┐     ┌──────────────────────┐
│    core/fiber.js    │     │    core/html.js       │
│  Fiber architecture │◄────│  JSX-like parser      │
│  - Fiber class      │     │  - html tagged        │
│  - push/popCurrent  │     │    template literal   │
│  - shallowEqual     │     │  - parseProps         │
│  - hooksEqual       │     │  - parseChildren      │
│  - markFiberDirty   │     │  - parse              │
│  - shouldBailout    │     │                       │
│  - commitFiberMemo  │     │                       │
│  - createElement    │     │                       │
│  - createFragment   │     │                       │
│  - useState         │     │                       │
│  - useMemo          │     │                       │
│  - renderApp        │     │                       │
│  - start            │     │                       │
└──────┬──────────────┘     └──────────────────────┘
       │
┌──────▼──────────┐
│  components/    │
│  Counter.js     │  Interactive component with useState
│  Viewer.js      │  Display component with useMemo
└─────────────────┘
```

## Core Concepts

### Virtual DOM

The virtual DOM is a plain JavaScript object describing what should appear on screen:

```javascript
{
  type: 'div',           // tag name or component function
  props: { ... },        // attributes/props
  children: [ ... ]      // nested virtual nodes
}
```

`createElement(type, props, ...children)` creates these virtual nodes. When `type` is a function, it's treated as a functional component and invoked to produce its subtree.

### Fiber Architecture

Fiber is a data structure representing a node in the component tree. Each component instance gets its own Fiber node, which stores:

- **Component state** (hooks array)
- **Tree relationships** (parent, child, sibling)
- **Metadata for reconciliation** (dirty flags, memoized props/hooks/vnode)

Key innovation: state lives in the Fiber node, not in a global Map keyed by component function. This allows the same component to be used multiple times with independent state.

### Reconciliation (Diffing)

Instead of re-rendering the entire DOM on every state change, the engine compares the new virtual tree with the old one and applies minimal updates:

1. **New node** → append to DOM
2. **Node removed** → remove from DOM (and clean up hooks)
3. **Node changed** (different type/value) → replace in DOM
4. **Node unchanged** → recursively diff children

### Hooks

#### useState

Stores mutable state for a component. Returns `[value, setValue]`. When `setValue` is called, the entire app re-renders.

```javascript
const [count, setCount] = useState(0);
```

#### useMemo

Memoizes a computed value. Recalculates only when dependencies change.

```javascript
const textValue = useMemo(() => {
  return count % 2 === 0 ? 'even' : 'odd';
}, [count]);
```

Both hooks share the same infrastructure:
1. Get current component context
2. Retrieve hooks array for that component
3. Use hook index to identify position
4. Compute/store value
5. Increment hook index

## Project Structure

```
myMiniReact/
├── index.html              # HTML entry point
├── app.js                  # Root App component
├── style.css               # Basic styling
├── core/
│   ├── mini-react.js       # Main engine exports (empty – logic in fiber.js)
│   ├── fiber.js            # Fiber architecture, hooks, reconciliation
│   └── html.js             # JSX-like tagged template literal parser
└── components/
    ├── Counter.js          # Counter component (interactive)
    └── Viewer.js           # Viewer component (display)
```

## Key Files

### `core/fiber.js` – The Engine

The heart of mini-React. Contains:

| Export | Purpose |
|--------|---------|
| `Fiber` class | Node structure for the component tree |
| `pushCurrentFiber()` | Sets active Fiber for current render |
| `popCurrentFiber()` | Restores previous Fiber from stack |
| `getCurrentFiber()` | Returns active Fiber node |
| `createElement()` | Creates virtual DOM nodes |
| `createFragment()` | Creates fragment nodes (invisible containers) |
| `useState()` | State management hook |
| `useMemo()` | Memoization hook |
| `shallowEqual()` | Object comparison for props |
| `hooksEqual()` | Hooks array comparison |
| `markFiberDirty()` | Marks node for re-render |
| `shouldBailout()` | Checks if render can be skipped |
| `commitFiberMemo()` | Saves post-render state |
| `renderApp()` | Main render cycle |
| `start()` | Application entry point |

### `core/html.js` – JSX-like Parser

Implements a tagged template literal (`html`) that parses HTML-like syntax into virtual DOM nodes.

**How it works:**
1. Replace `${...}` expressions with `___VAL_N___` placeholders
2. Parse the resulting string as HTML using regex-based traversal
3. Restore real values from the values array using placeholder indices

Supports:
- Self-closing tags: `<tag />`
- Paired tags: `<tag>content</tag>`
- Components: `<${Component} />`
- Text nodes
- Nested structures

### `app.js` – Root Component

Defines the application's top-level component:

```javascript
export function App() {
  return html`<div>
    <h1>Fiber Implementation: Multiple Component Instances</h1>
    <${Counter} />
    <${Counter} />
    ...
  </div>`;
}
```

This file demonstrates the Fiber feature: multiple instances of the `Counter` component, each with independent state.

### `components/Counter.js` – Interactive Component

Uses `useState` to manage click count and passes it to `Viewer`:

```javascript
export const Counter = () => {
  const [count, setCount] = useState(0);
  const onClick = () => setCount((prevValue) => prevValue + 1);
  return html`<div>
    <button onClick=${onClick}>Click me</button>
    <${Viewer} count=${count} />
  </div>`;
};
```

### `components/Viewer.js` – Display Component

Receives `count` as a prop and uses `useMemo` to compute even/odd classification without unnecessary recalculation:

```javascript
export const Viewer = (props) => {
  const { count } = props;
  const textValue = useMemo(() => {
    if (count % 2 === 0) return 'even';
    return 'odd';
  }, [count]);
  return html`<div>
    <h2>Counter: ${count}</h2>
    <h3>This ${textValue} number</h3>
  </div>`;
};
```

## How It Works

### 1. Initialization

```javascript
start(App, document.getElementById('root'));
```

`start()` stores the root element and App component, then calls `renderApp()`.

### 2. Render Cycle

`renderApp()` executes on every state change:

1. Reset hook index (`currentHook = 0`)
2. Set current component to `App`
3. Call `App()` to get new virtual tree
4. Call `updateElement()` to sync real DOM with virtual tree
5. Save new tree as old tree for next comparison
6. Reset current component

### 3. Update Process

When `setCount()` is called:
1. State is updated in the hooks array
2. `renderApp()` is triggered
3. App function is re-executed → new virtual tree
4. `updateElement()` diffs old vs new tree
5. Only changed DOM nodes are updated
6. Viewer receives new `count` prop → useMemo recalculates only if `count` changed

### 4. Fiber Context Stack

When a parent component renders a child component:
1. Parent's Fiber is pushed onto the stack
2. Child's Fiber becomes current
3. Child renders with its own hooks
4. Parent's Fiber is popped and restored

This ensures each component's hooks are correctly associated during render.

## Running the Project

### Prerequisites

- A modern browser (Chrome, Firefox, Edge, Safari)
- A local development server (the `file://` protocol won't work with ES modules)

### Quick Start

```bash
# Using Python
python -m http.server 8080

# Using Node.js
npx serve .

# Using VS Code
# Install "Live Server" extension and click "Open with Live Server"
```

Then open `http://localhost:8080` in your browser.

### What You'll See

- A heading: "Fiber Implementation: Multiple Component Instances"
- Multiple Counter instances, each with independent state
- Nested counters demonstrating tree depth
- Each counter shows its current value and whether it's even or odd

### Click the buttons

Each Counter manages its own state independently – click one without affecting others. This demonstrates the Fiber architecture's key advantage: independent state per component instance.

## Key Takeaways

1. **UI is a function of state** – change data, UI updates automatically
2. **Virtual DOM is just objects** – no magic, just JavaScript
3. **Reconciliation is tree diffing** – compare old and new, update what changed
4. **Hooks are just arrays with indices** – order matters, that's why rules exist
5. **Fiber enables independent state** – each component instance owns its hooks
6. **Bailout optimization** – skip re-renders when nothing changed

## Further Reading

- [React Docs](https://react.dev/)
- [React Fiber Architecture](https://react.dev/learn/rendering-lists)
- [Tagged Template Literals (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#tagged_templates)

---

Built to learn, not to production. Every line is intentional and understandable.
