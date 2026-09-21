/**
 * Module for managing the Fiber architecture.
 *
 * Fiber is a data structure representing a node in the component tree.
 * Each component instance has its own Fiber node, which stores:
 * - Component state (hooks)
 * - Relationships with parent, children, and siblings
 * - Metadata for reconciliation (matching old and new trees)
 *
 * The context stack allows hooks (useState, useMemo) to find their Fiber node
 * during component rendering.
 */

// Current active Fiber node in the rendering context
// Used by hooks to access their state storage
let currentFiber = null;

// Fiber node stack for supporting nested components
// When component A renders component B, A is saved in the stack,
// and B becomes currentFiber. After B renders, A is restored.
const fiberStack = [];

/**
 * Sets a new Fiber node as the current one in context.
 * Saves the previous current node to the stack for later restoration.
 *
 * Used when entering a component for rendering.
 *
 * @param {Fiber} fiber - Fiber node to make current
 */
export function pushCurrentFiber(fiber) {
  // Save the current node to the stack (can be null for root component)
  fiberStack.push(currentFiber);
  // Set the new node as current
  currentFiber = fiber;
}

/**
 * Restores the previous Fiber node from the stack.
 * Used when exiting a component after rendering.
 *
 * @returns {Fiber|null} - Restored Fiber node or null if stack is empty
 */
export function popCurrentFiber() {
  // Restore the previous node from the stack
  // If stack is empty, return null (using nullish coalescing operator ??)
  currentFiber = fiberStack.pop() ?? null;
}

/**
 * Returns the current active Fiber node.
 * Used by hooks (useState, useMemo) to access their state storage.
 *
 * @returns {Fiber|null} - Current Fiber node or null if no active context
 */
export function getCurrentFiber() {
  return currentFiber;
}

/**
 * Shallow comparison of two objects.
 *
 * Checks if objects are reference-equal or have the same keys with the same values.
 * Does NOT perform deep comparison of nested objects.
 *
 * Used for quick comparison of component props.
 *
 * @param {Object} a - First object to compare
 * @param {Object} b - Second object to compare
 * @returns {boolean} - true if objects are shallowly equal
 */
export function shallowEqual(a, b) {
  // If same reference - objects are definitely equal
  if (a === b) return true;

  // If one object is null/undefined - they are not equal
  if (!a || !b) return false;

  // Get keys of both objects
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  // If different number of keys - objects are not equal
  if (aKeys.length !== bKeys.length) return false;

  // Check that all values at the same keys are equal
  for (const k of aKeys) {
    // Compare by reference (not deeply!)
    if (a[k] !== b[k]) return false;
  }

  return true;
}

/**
 * Creates a snapshot (copy) of a hooks array for later comparison.
 *
 * Used for saving hook state after a successful render.
 * On the next render, the old and new snapshots can be compared to determine
 * if hooks (useState, useMemo) have changed.
 *
 * For useState, hooks[idx] holds the value itself (primitive or object).
 * For useMemo, hooks[idx] holds an object { value, deps }.
 *
 * @param {Array} hooks - Array of hooks to copy
 * @returns {Array} - Copy of the hooks array
 */
export function snapshotHooks(hooks) {
  // Create a shallow copy of the array
  // Important: this copies the array, but elements (objects) remain by reference
  return hooks.slice();
}

/**
 * Compares two hooks arrays for equality.
 *
 * Used to determine if component hooks have changed between renders.
 * This is the key check for bailout optimization - if hooks haven't changed,
 * the component render can be skipped.
 *
 * Supports two hook types:
 * 1. useState - value stored directly (primitive or object)
 * 2. useMemo - value stored as { value, deps }
 *
 * @param {Array} prev - Previous hooks array (snapshot after last render)
 * @param {Array} next - Current hooks array
 * @returns {boolean} - true if hooks haven't changed
 */
export function hooksEqual(prev, next) {
  // If same reference - hooks are definitely equal
  if (prev === next) return true;

  // If one array is missing - hooks are not equal
  if (!prev || !next) return false;

  // If different lengths - hooks are not equal (number of hooks changed)
  if (prev.length !== next.length) return false;

  // Compare each hook by index
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i]; // Previous hook value
    const b = next[i]; // Current hook value

    // Simple reference comparison - if references are equal, hook hasn't changed
    if (a === b) continue;

    // Special handling for useMemo: { value, deps }
    // If both values are objects with a deps field, compare their contents
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      const aDeps = a.deps;
      const bDeps = b.deps;

      // If both have dependency arrays - this is useMemo
      if (Array.isArray(aDeps) && Array.isArray(bDeps)) {
        // Compare the values
        if (a.value !== b.value) return false;

        // Compare dependency array lengths
        if (aDeps.length !== bDeps.length) return false;

        // Compare each dependency
        for (let d = 0; d < aDeps.length; d++) {
          if (aDeps[d] !== bDeps[d]) return false;
        }

        // useMemo hasn't changed - move to next hook
        continue;
      }
    }

    // If we got here - hooks are not equal
    return false;
  }

  // All hooks are equal
  return true;
}

/**
 * Marks a Fiber node as "dirty" (requiring render).
 *
 * Called when component state changes (e.g., via setState).
 * Also marks all parents as having "dirty" children (childDirty = true).
 *
 * This allows:
 * 1. Tracking which components need to be re-rendered
 * 2. Optimizing parent rendering - if a parent has childDirty = true,
 *    but its own props haven't changed, it still must render
 *    to update its child components
 *
 * @param {Fiber} fiber - Fiber node to mark as dirty
 */
export function markFiberDirty(fiber) {
  // Mark the node itself as requiring render
  fiber.dirty = true;

  // Walk up the tree and mark all parents
  // as having "dirty" children
  let p = fiber.parent;
  while (p) {
    p.childDirty = true;
    p = p.parent;
  }
}

/**
 * Checks if a component render can be skipped (bailout optimization).
 *
 * A component can be skipped if:
 * 1. The component itself is not marked "dirty" (dirty = false)
 * 2. There are no "dirty" children (childDirty = false)
 * 3. Props haven't changed (shallowEqual)
 * 4. Hooks haven't changed (hooksEqual)
 *
 * If all conditions are met, the memoized vnode can be returned
 * without re-invoking the component function.
 *
 * This is an important performance optimization - it avoids
 * unnecessary renders of components that haven't changed.
 *
 * @param {Fiber} fiber - Fiber node of the component to check
 * @param {Object} nextProps - New props to be passed to the component
 * @returns {boolean} - true if render can be skipped (bailout)
 */
export function shouldBailout(fiber, nextProps) {
  // If component is marked "dirty" - render is mandatory
  if (fiber.dirty) return false;

  // If there are "dirty" children - render is mandatory (need to update child components)
  if (fiber.childDirty) return false;

  // If props changed - render is mandatory
  // Compare memoized props (after last render) with new ones
  if (!shallowEqual(fiber.memoizedProps, nextProps)) return false;

  // If hooks changed - render is mandatory
  // Compare memoized hooks (after last render) with current ones
  if (!hooksEqual(fiber.memoizedHooks, fiber.hooks)) return false;

  // All checks passed - render can be skipped!
  return true;
}

/**
 * Saves memoized values after a successful component render.
 *
 * Called after a component has successfully rendered.
 * Saves a "snapshot" of the current state (props, hooks, vnode) for use
 * on the next render to optimize bailout.
 *
 * Also resets dirty and childDirty flags, since the component was just
 * rendered and is now "clean".
 *
 * @param {Fiber} fiber - Fiber node of the component
 * @param {Object} props - Props used during the render
 * @param {Object} vnode - Virtual node returned by the component
 */
export function commitFiberMemo(fiber, props, vnode) {
  // Save the props used during this render
  // They will be compared with new props on the next render
  fiber.memoizedProps = props;

  // Save a snapshot of current hooks
  // This will allow comparison with new hooks on the next render
  fiber.memoizedHooks = snapshotHooks(fiber.hooks);

  // Save the virtual node returned by the component
  // If bailout can be made on the next render, this vnode will be returned
  fiber.memoizedVNode = vnode;

  // Reset "dirty" flags - component was just rendered
  fiber.dirty = false; // Component itself is "clean"
  fiber.childDirty = false; // Children are also "clean" (until they change)
}

/**
 * Fiber class - represents a node in the component tree.
 *
 * Each component instance has its own Fiber node, which stores:
 * - Component state (array of hooks)
 * - Relationships with other nodes in the tree (parent, child, sibling)
 * - Metadata for reconciliation (matching old and new trees)
 *
 * Key difference from original implementation:
 * State is stored in the Fiber node, not in a global Map by component function.
 * This allows using one component multiple times with independent state.
 */
export class Fiber {
  /**
   * Creates a new Fiber node.
   *
   * @param {Function|string} type - Node type (component function or string for DOM element)
   * @param {Object} props - Props passed to the component
   * @param {Fiber|null} parent - Parent Fiber node in the tree
   * @param {string|null} key - Key for reconciliation optimization (optional)
   */
  constructor(type, props, parent = null, key = null) {
    // Flag: this node requires re-rendering
    // (setState, new prop, or force update)
    this.dirty = false;

    // Flag: one of child components requires re-rendering
    // (used for optimizing skipping parent render)
    this.childDirty = false;

    // Cache of last "committed" props after successful render
    // (for comparison on subsequent renders)
    this.memoizedProps = null;

    // Cache of last hook stores (useState/useMemo);
    // for comparison "has something changed"
    this.memoizedHooks = null;

    // Cache of last returned vnode - allows quickly returning previous result
    // without re-invoking the render function
    this.memoizedVNode = null;

    // Main node properties
    this.type = type; // Component function or string (tag name)
    this.props = props; // Component props
    this.parent = parent; // Reference to parent Fiber node
    this.key = key; // Key for reconciliation (helps match nodes)

    // Component state storage
    // KEY POINT: each component instance has its own hooks array!
    this.hooks = []; // Array for storing hook values (useState, useMemo, etc.)
    this.hookIndex = 0; // Index of current hook during rendering (resets to 0 for each render)

    // Fiber node tree structure
    // Used for tree navigation and reconciliation
    this.child = null; // Reference to first child Fiber node
    this.sibling = null; // Reference to next sibling node at the same level

    // Internal fields for reconciliation (matching old and new trees)
    // Used only during rendering, not part of public API

    // Cursor for traversing old child nodes during reconciliation
    // Helps reuse existing Fiber nodes on re-renders
    this._oldCursor = null;

    // Pointer to the last added child node (work in progress tail)
    // Used for fast O(1) appending of new child nodes to the end of the list
    this._wipTail = null;
  }
}
