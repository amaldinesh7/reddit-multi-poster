export const normalizeSubredditKey = (name: string): string => {
  return name.trim().replace(/^r\//i, '').toLowerCase();
};
