import { useEffect, useState } from 'react';

export type SectionId = 'home' | 'draw' | 'groups' | 'knockout' | 'road' | 'stats' | 'recap' | 'poster' | 'settings';

export interface Route {
  section: SectionId;
  param?: string;
}

const SECTIONS: SectionId[] = ['home', 'draw', 'groups', 'knockout', 'road', 'stats', 'recap', 'poster', 'settings'];

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const section = (SECTIONS.includes(parts[0] as SectionId) ? parts[0] : 'home') as SectionId;
  return { section, param: parts[1] ? decodeURIComponent(parts[1]) : undefined };
}

export function navigate(section: SectionId, param?: string) {
  const next = `#/${section}${param ? '/' + encodeURIComponent(param) : ''}`;
  if (window.location.hash !== next) window.location.hash = next;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
