import { createElement } from './mini-react';

/**
 * Tagged template literal for a simple JSX-like syntax.
 * Allows writing:
 *
 * html`<div id="root"><h1>${title}</h1><${Button} text="Click" /></div>`
 *
 * How it works:
 * 1. Replaces all inserts ${...} with placeholders ___VAL_N___
 * 2. Parses the resulting string as HTML
 * 3. Restores the real values from the values array by indices
 */
export const html = (strings, ...values) => {
  // 1 Build intermediate string with placeholders
  // Replace all JavaScript expressions ${...} with unique markers ___VAL_0___, ___VAL_1___, etc.
  // This is needed so the parser can correctly process the HTML structure,
  // without confusing JavaScript expressions with HTML attributes or text
  let result = '';
  const valRegex = /___VAL_(\d+)___/g; // Regex for finding placeholders
  for (let i = 0; i < strings.length; i++) {
    result += strings[i]; // Add the string part of the template
    if (i < values.length) {
      // Replace JavaScript expression with placeholder index
      result += `___VAL_${i}___`;
    }
  }

  /**
   * Parses child elements from the inner content of a tag.
   * Handles mixed content: text, tags, self-closing tags.
   *
   * Algorithm:
   * 1. Iterate through the string character by character
   * 2. Accumulate text until encountering '<'
   * 3. On encountering '<', handle the tag (self-closing or paired)
   * 4. For paired tags, track nesting depth
   *
   * @param {string} inner - Inner content of the tag
   * @returns {Array} - Array of child elements (text, elements, components)
   */
  const parseChildren = (inner) => {
    const children = [];
    let i = 0; // Index of current position in the string
    let textBuffer = ''; // Buffer for accumulating text between tags

    /**
     * Saves accumulated text as a child element.
     * Replaces placeholders with real values from the values array.
     */
    const flushText = () => {
      if (textBuffer.trim()) {
        // Replace ___VAL_N___ placeholders with real values
        children.push(textBuffer.replace(valRegex, (_, idx) => values[idx]));
      }
      textBuffer = ''; // Clear the buffer
    };

    // Iterate through the entire string
    while (i < inner.length) {
      // If this is not the start of a tag - accumulate text
      if (inner[i] !== '<') {
        textBuffer += inner[i++];
        continue;
      }

      // Encountered '<' - save accumulated text
      flushText();

      // Check if this is a self-closing tag <tag />
      if (inner.slice(i).match(/^<[^>]+\/>/)) {
        // Find the end of the self-closing tag
        const end = inner.indexOf('>', i) + 1;
        const tagStr = inner.slice(i, end);
        // Recursively parse the tag and add to children
        children.push(parse(tagStr));
        i = end; // Move past the tag
        continue;
      }

      // This is a paired tag <tag>...</tag>
      // Need to find the matching closing tag, accounting for nesting
      let depth = 0; // Tag nesting depth
      let start = i; // Start of opening tag

      // Look for the closing tag, tracking nesting
      while (i < inner.length) {
        // Encountered an opening tag (not self-closing and not closing)
        if (
          inner[i] === '<' &&
          inner[i + 1] !== '/' &&
          !inner.slice(i).match(/^<[^>]+\/>/)
        ) {
          depth++; // Increase nesting depth
        }

        // Encountered a closing tag </tag>
        if (inner[i] === '<' && inner[i + 1] === '/') {
          depth--; // Decrease nesting depth
        }

        i++;

        // If depth returned to 0 and we're at the closing bracket - found end of tag
        if (depth === 0 && inner[i - 1] === '>') {
          break;
        }
      }

      // Extract the full tag (opening + content + closing)
      const tagStr = inner.slice(start, i);
      // Recursively parse the tag and add to children
      children.push(parse(tagStr));
    }

    // Save remaining text after the last tag
    flushText();
    return children;
  };

  /**
   * Parses tag attributes from an attribute string.
   *
   * Supports two value types:
   * 1. Strings: key="value"
   * 2. JavaScript expressions: key=${expression} (replaced with ___VAL_N___)
   *
   * Normalizes event names for native DOM elements (onClick -> onclick).
   *
   * @param {string} attrs - Attribute string (e.g.: 'id="root" onClick=${handler}')
   * @param {boolean} isNative - true if this is a native DOM element (not a component)
   * @returns {Object} - Object with props
   */
  const parseProps = (attrs, isNative) => {
    const props = {};
    // Regex for finding attributes:
    // - Attribute name: [a-zA-Z0-9_$\-:]+ (letters, digits, _, $, -, :)
    // - Value: either a quoted string "value" or a placeholder ___VAL_N___
    const attrRegex =
      /([a-zA-Z0-9_$\-:]+)\s*=\s*(?:"([^"]*)"|___VAL_(\d+)___)/g;
    let match;

    while ((match = attrRegex.exec(attrs))) {
      let [, key, strVal, exprIdx] = match;

      // Normalize name for events on native elements
      // React uses onClick, but DOM requires onclick (lowercase)
      if (isNative && /^on[A-Z]/.test(key)) {
        key = key.toLowerCase();
      }

      // Determine the attribute value
      if (exprIdx !== undefined) {
        // This is a JavaScript expression - get the real value from the values array
        // e.g.: onClick=${handler} -> props.onClick = handler (function)
        props[key] = values[Number(exprIdx)];
      } else {
        // This is a string value - keep it as is
        // e.g.: id="root" -> props.id = "root"
        props[key] = strVal;
      }
    }
    return props;
  };

  /**
   * Recursive parser for HTML-like string.
   *
   * Handles three node types:
   * 1. Self-closing tags: <tag />
   * 2. Paired tags: <tag>...</tag>
   * 3. Text nodes: plain text
   *
   * Supports components via placeholders: <${Component} />
   *
   * @param {string} str - String to parse (can be a tag or text)
   * @returns {Object|string} - Virtual node or text
   */
  const parse = (str) => {
    // Regex for paired tags: <tag attrs>content</tag>
    // Groups: 1 - tag name, 2 - attributes, 3 - content
    const tagRegex =
      /^<([A-Za-z0-9_$\-]+|___VAL_\d+___)([^>]*)>([\s\S]*?)<\/\1>$/;

    // Regex for self-closing tags: <tag attrs />
    // Groups: 1 - tag name, 2 - attributes
    const selfClosingTagRegex = /^<([A-Za-z0-9_$\-]+|___VAL_\d+___)([^>]*)\/>$/;

    // 1. Check if this is a self-closing tag <tag ... />
    let match = selfClosingTagRegex.exec(str);
    if (match) {
      let [, type, attrs] = match;

      // Check if this is a placeholder for a component <${Component} />
      const valTypeMatch = /^___VAL_(\d+)___$/.exec(type);
      if (valTypeMatch) {
        // This is a component - get the real component function from values
        type = values[Number(valTypeMatch[1])];
      }

      // Parse attributes
      // isNative = true only for string types (DOM elements)
      const props = parseProps(attrs, typeof type === 'string');

      // Create element without children (self-closing tag)
      return createElement(type, props);
    }

    // 2. Check if this is a paired tag <tag>...</tag>
    match = tagRegex.exec(str);
    if (match) {
      let [, type, attrs, inner] = match;
      // inner - content between opening and closing tags

      // Check if this is a placeholder for a component <${Component}>
      const valTypeMatch = /^___VAL_(\d+)___$/.exec(type);
      if (valTypeMatch) {
        // This is a component - get the real component function from values
        type = values[Number(valTypeMatch[1])];
      }

      // Parse attributes
      const props = parseProps(attrs, typeof type === 'string');

      // Parse child elements (nested tags, components, text)
      // Use parseChildren function to correctly handle mixed content
      const children = parseChildren(inner);

      // Create element with children
      return createElement(type, props, ...children);
    }

    // 3. This is plain text (not a tag)
    // Replace placeholders with real values
    return str.replace(valRegex, (_, idx) => values[idx]);
  };

  // 4 Run the parser on the processed string
  // Remove extra whitespace at the beginning and end, then parse
  // The result is a virtual node (vnode) that can be used in createElement
  return parse(result.trim());
};
