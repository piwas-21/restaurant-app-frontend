export const getFullImageUrl = (url: string) => {
  if (url.startsWith('/images')) return url;

  if (url.startsWith('http')) return url;

  return 'https://lh3.google.com/u/0/d/' + url;
};
