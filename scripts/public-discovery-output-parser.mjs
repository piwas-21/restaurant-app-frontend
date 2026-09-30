// Linear scans of our emitted HTML/XML; excludes script bodies from visible-text assertions.
export function attribute(tag, name) {
  const prefix = ` ${name.toLowerCase()}="`;
  // HTML attribute names are case-insensitive; React emits hrefLang. ASCII-only folding
  // preserves offsets even when preceding attribute values contain non-ASCII letters.
  const folded = tag.replace(/[A-Z]/g, (character) => character.toLowerCase());
  const start = folded.indexOf(prefix);
  if (start < 0) return undefined;
  const valueStart = start + prefix.length;
  const end = tag.indexOf('"', valueStart);
  return end < 0 ? undefined : tag.slice(valueStart, end).replaceAll('&amp;', '&');
}

export function tags(html, name) {
  const result = [];
  let cursor = 0;
  const prefix = `<${name}`;
  while (cursor < html.length) {
    const start = html.indexOf(prefix, cursor);
    if (start < 0) break;
    const end = html.indexOf('>', start + prefix.length);
    if (end < 0) break;
    const boundary = html[start + prefix.length];
    if ([' ', '>', '\n', '\t', '/'].includes(boundary)) result.push(html.slice(start, end + 1));
    cursor = end + 1;
  }
  return result;
}

export function elements(text, name) {
  const result = [];
  const opening = `<${name}`;
  const closing = `</${name}>`;
  let cursor = 0;
  while (cursor < text.length) {
    const start = text.indexOf(opening, cursor);
    if (start < 0) break;
    if (![' ', '>', '\n', '\t'].includes(text[start + opening.length])) {
      cursor = start + opening.length;
      continue;
    }
    const bodyStart = text.indexOf('>', start + opening.length);
    if (bodyStart < 0) break;
    const end = text.indexOf(closing, bodyStart + 1);
    if (end < 0) break;
    result.push({ tag: text.slice(start, bodyStart + 1), body: text.slice(bodyStart + 1, end) });
    cursor = end + closing.length;
  }
  return result;
}

export function bodyText(html) {
  let result = '';
  let cursor = 0;
  while (cursor < html.length) {
    const start = html.indexOf('<', cursor);
    if (start < 0) {
      result += html.slice(cursor);
      break;
    }
    result += html.slice(cursor, start) + ' ';
    const end = html.indexOf('>', start + 1);
    if (end < 0) break;
    const hidden = ['script', 'style'].find((name) => html.startsWith(`<${name}`, start));
    if (hidden) {
      const closing = `</${hidden}>`;
      const hiddenEnd = html.indexOf(closing, end + 1);
      if (hiddenEnd < 0) break;
      cursor = hiddenEnd + closing.length;
    } else cursor = end + 1;
  }
  return result.replace(/\s+/g, ' ');
}
