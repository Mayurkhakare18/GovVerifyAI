/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

export interface RouteMatch {
  path: string;
  params: Record<string, string>;
  searchParams: URLSearchParams;
}

export interface RouterContextType {
  currentPath: string;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  params: Record<string, string>;
  searchParams: URLSearchParams;
  intendedDestination: string | null;
  setIntendedDestination: (dest: string | null) => void;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

// Helper to extract params from path patterns like /app/history/:id
function matchRoute(pattern: string, pathname: string): Record<string, string> | null {
  const patternSegments = pattern.split('/').filter(Boolean);
  const pathSegments = pathname.split('/').filter(Boolean);

  if (patternSegments.length !== pathSegments.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let i = 0; i < patternSegments.length; i++) {
    const patternSeg = patternSegments[i];
    const pathSeg = pathSegments[i];

    if (patternSeg.startsWith(':')) {
      const paramName = patternSeg.slice(1);
      params[paramName] = decodeURIComponent(pathSeg);
    } else if (patternSeg !== pathSeg) {
      return null;
    }
  }

  return params;
}

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return typeof window !== 'undefined' ? window.location.pathname : '/';
  });
  const [searchParams, setSearchParams] = useState<URLSearchParams>(() => {
    return typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  });
  const [intendedDestination, setIntendedDestination] = useState<string | null>(null);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
      setSearchParams(new URLSearchParams(window.location.search));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    if (typeof window === 'undefined') return;

    const url = new URL(to, window.location.origin);
    const newPath = url.pathname;
    const newSearch = url.search;

    if (options?.replace) {
      window.history.replaceState({}, '', to);
    } else {
      window.history.pushState({}, '', to);
    }

    setCurrentPath(newPath);
    setSearchParams(new URLSearchParams(newSearch));

    // Scroll to top on page navigation unless there is an anchor hash
    if (!url.hash) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, []);

  // Compute params for known patterns
  const params = useMemo(() => {
    const historyDetailMatch = matchRoute('/app/history/:id', currentPath);
    if (historyDetailMatch) return historyDetailMatch;
    return {};
  }, [currentPath]);

  const value = useMemo(
    () => ({
      currentPath,
      navigate,
      params,
      searchParams,
      intendedDestination,
      setIntendedDestination,
    }),
    [currentPath, navigate, params, searchParams, intendedDestination]
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
};

export const useRouter = (): RouterContextType => {
  const context = useContext(RouterContext);
  if (!context) {
    return {
      currentPath: typeof window !== 'undefined' ? window.location.pathname : '/',
      navigate: (to: string) => {
        if (typeof window !== 'undefined') window.location.href = to;
      },
      params: {},
      searchParams: new URLSearchParams(),
      intendedDestination: null,
      setIntendedDestination: () => {},
    };
  }
  return context;
};

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  replace?: boolean;
}

export const Link: React.FC<LinkProps> = ({ href, replace, onClick, children, ...rest }) => {
  const { navigate } = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) onClick(e);

    // Allow default for new tab or modifier keys
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.altKey ||
      e.ctrlKey ||
      e.shiftKey
    ) {
      return;
    }

    // Only intercept local internal paths
    if (href.startsWith('/') && !href.startsWith('//')) {
      e.preventDefault();
      navigate(href, { replace });
    }
  };

  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
};
