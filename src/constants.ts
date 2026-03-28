
export const viewToPath = {
  'landing': '/',
  'dashboard': '/studio',
  'magazine': '/magazine',
  'podcasts': '/podcasts',
  'pricing': '/pricing',
  'account': '/account',
  'admin': '/admin',
  'auth': '/login',
  'signup': '/signup',
  'review': '/review',
  'guide': '/guide',
  'faq': '/faq',
  'terms': '/terms',
  'privacy': '/privacy',
  'contact': '/contact',
  'referrals': '/referrals'
};

export const pathToView = Object.fromEntries(
  Object.entries(viewToPath).map(([view, path]) => [path, view])
);

export const normalizePath = (path: string) => {
  if (path === '/') return '/';
  return path.endsWith('/') ? path.slice(0, -1) : path;
};

export const getViewFromPath = () => {
  let path = normalizePath(window.location.pathname);
  
  // Check for review with ID: /review/{id}
  if (path.startsWith('/review/')) {
    return 'review';
  }
  
  // Check for podcast with ID: /podcasts/{id}
  if (path.startsWith('/podcasts/')) {
    return 'podcasts';
  }
  
  return pathToView[path] || 'landing';
};
