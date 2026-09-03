import { useEffect, useState } from 'react';

/* The two screens are unrelated, so they are addressed by URL rather than by
   an in-app control — nothing about either design has room for a switcher.
   Both the path and the hash are accepted: the dev server serves sub-paths,
   but a hash still works if the app is ever hosted somewhere that does not. */
export type Route = 'scan' | 'weight';

function read(): Route {
  if (typeof window === 'undefined') return 'scan';
  const here = `${window.location.pathname}${window.location.hash}`.toLowerCase();
  return here.includes('weight') ? 'weight' : 'scan';
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(read);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => setRoute(read());
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);
  return route;
}
