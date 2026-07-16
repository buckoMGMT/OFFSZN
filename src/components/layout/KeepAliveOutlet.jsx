// §2 — Native tab-stack preservation. Instead of letting React Router unmount
// a tab's page when you switch away, every visited tab root stays MOUNTED and
// is hidden with display:none. Component state (inner tabs, filters, forms,
// open drill details) survives untouched, and each tab's scroll offset on the
// .app-scroll container is saved on blur / restored on focus.
// Memory cap: only the 7 tab roots are ever cached — no unbounded history.
import { useRef, useLayoutEffect } from "react";
import { useLocation, useOutlet } from "react-router-dom";

const TAB_PATHS = new Set(["/", "/track", "/drills", "/clans", "/rewards", "/studio", "/profile"]);

export default function KeepAliveOutlet() {
  const { pathname } = useLocation();
  const outlet = useOutlet();
  const cacheRef = useRef(new Map());
  const scrollPos = useRef({});

  const isTab = TAB_PATHS.has(pathname);
  // Keep the active tab's element fresh in the cache (same position → state persists)
  if (isTab) cacheRef.current.set(pathname, outlet);

  // Restore this tab's scroll offset on focus; save it on blur (cleanup)
  useLayoutEffect(() => {
    const scroller = document.querySelector(".app-scroll");
    if (scroller && isTab) scroller.scrollTop = scrollPos.current[pathname] || 0;
    return () => {
      if (scroller) scrollPos.current[pathname] = scroller.scrollTop;
    };
  }, [pathname, isTab]);

  return (
    <>
      {[...cacheRef.current.entries()].map(([path, el]) => (
        <div key={path} style={{ display: path === pathname ? "block" : "none" }}>
          {el}
        </div>
      ))}
      {!isTab && outlet}
    </>
  );
}