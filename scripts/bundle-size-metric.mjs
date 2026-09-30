// A page inherits only layouts along its original App Router path, including route groups.
export function firstLoadJavaScript(pages, pageKey) {
  const segments = pageKey.split('/').filter(Boolean).slice(0, -1);
  const assets = new Set(pages[pageKey] ?? []);
  for (let depth = 0; depth <= segments.length; depth++) {
    const directory = segments.slice(0, depth).join('/');
    const layoutKey = directory ? `/${directory}/layout` : '/layout';
    for (const asset of pages[layoutKey] ?? []) assets.add(asset);
  }
  return [...assets].filter((asset) => asset.endsWith('.js'));
}
