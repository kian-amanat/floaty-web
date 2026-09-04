import { useEffect, useState } from 'react';

/* The screens are unrelated, so they are addressed by URL rather than by an
   in-app control — no one of these designs has room for a switcher.
   Both the path and the hash are accepted: the dev server serves sub-paths,
   but a hash still works if the app is ever hosted somewhere that does not. */
export type Route = 'scan' | 'weight' | 'gooey' | 'login' | 'signup';

/* Off the web there is no URL to read, so the current route is held here and
   `go` notifies whoever is listening. */
let memory: Route | null = null;
const subs = new Set<() => void>();

function read(): Route {
  if (typeof window === 'undefined' || !window.location) return memory ?? 'scan';
  const here = `${window.location.pathname}${window.location.hash}`.toLowerCase();
  if (here.includes('weight')) return 'weight';
  if (here.includes('gooey')) return 'gooey';
  /* the more specific of the two first, so /signup is not read as a login */
  if (here.includes('signup')) return 'signup';
  if (here.includes('login')) return 'login';
  return memory ?? 'scan';
}

/** Move between screens from inside the app — the auth pair link to each other. */
export function go(next: Route) {
  memory = next;
  if (typeof window !== 'undefined' && window.location) {
    /* setting the hash fires hashchange, which the hook below is already on */
    window.location.hash = next;
    return;
  }
  subs.forEach((f) => f());
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(read);
  useEffect(() => {
    const sync = () => setRoute(read());
    subs.add(sync);
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', sync);
      window.addEventListener('hashchange', sync);
    }
    return () => {
      subs.delete(sync);
      if (typeof window !== 'undefined') {
        window.removeEventListener('popstate', sync);
        window.removeEventListener('hashchange', sync);
      }
    };
  }, []);
  return route;
}
