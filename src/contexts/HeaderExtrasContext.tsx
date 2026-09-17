import { createContext, useContext, useEffect, type ReactNode } from 'react';

// Lets a page render content directly into MainLayout's sticky header row -
// e.g. Explore's condensed search bar - instead of a second sticky bar of
// its own. MainLayout owns the actual header markup/positioning: `search`
// renders to the left of the Explore/Map/For You nav links (which always
// stay in place), `actions` to their right, before the account controls.
export interface HeaderExtras {
  search?: ReactNode;
  actions?: ReactNode;
}

type SetHeaderExtras = (extras: HeaderExtras | null) => void;

export const HeaderExtrasContext = createContext<SetHeaderExtras | null>(null);

export function useHeaderExtras(extras: HeaderExtras | null) {
  const setHeaderExtras = useContext(HeaderExtrasContext);

  // Pushes the latest content on every change, with no cleanup attached to
  // this effect - so an update (e.g. every keystroke in a condensed search
  // input) replaces MainLayout's rendered content in place, in a single
  // render, the same way any other prop update would. Earlier this was one
  // effect whose cleanup called setHeaderExtras(null) before every re-run;
  // that briefly unmounted whatever was showing (its cleanup firing ahead
  // of the new value being set) and remounted a fresh copy, which dropped
  // focus out of a header search input after every single character typed.
  useEffect(() => {
    if (!setHeaderExtras) {
      return;
    }
    setHeaderExtras(extras);
  }, [setHeaderExtras, extras?.search, extras?.actions]);

  // Separately, clears MainLayout's header back to normal only on true
  // unmount (route change away from this page) - otherwise the last extras
  // rendered here would keep showing on whatever page comes next.
  useEffect(() => {
    if (!setHeaderExtras) {
      return;
    }
    return () => setHeaderExtras(null);
  }, [setHeaderExtras]);
}
