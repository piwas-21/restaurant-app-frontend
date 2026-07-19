export const getFullImageUrl = (url: string) => {
  // Absolute local paths (public assets: /images/…, /branding/… placeholder, etc.)
  // and absolute URLs pass through untouched; only bare backend ids get the
  // Google-Drive prefix. (Was `/images` only, which broke the /branding placeholder.)
  if (url.startsWith('/') || url.startsWith('http')) return url;

  return 'https://lh3.google.com/u/0/d/' + url;
};
