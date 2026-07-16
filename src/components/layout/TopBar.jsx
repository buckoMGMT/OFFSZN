// Persistent sticky app header. Root tab paths show the OFFSZN wordmark;
// nested views (review, AUP, checkout results, etc.) swap it for an
// iOS-style back button that safely pops the navigation stack.
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import BrandMark from "@/components/BrandMark";

const ROOT_PATHS = new Set(["/", "/track", "/drills", "/clans", "/rewards", "/studio", "/profile"]);

export default function TopBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isRoot = ROOT_PATHS.has(pathname);

  // Safe pop: go back if there's a stack to pop, otherwise land on home.
  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/", { replace: true });
  };

  return (
    <header
      className="sticky top-0 z-[70]"
      style={{
        height: "var(--topbar-h)",
        paddingTop: "env(safe-area-inset-top)",
        background: "color-mix(in srgb, var(--surface-0) 85%, transparent)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div className="mx-auto flex items-center px-4" style={{ maxWidth: 480, height: 48 }}>
        {isRoot ? (
          <span key="logo" className="animate-count-up flex items-center">
            <BrandMark size="sm" />
          </span>
        ) : (
          <button
            key="back"
            onClick={goBack}
            aria-label="Back"
            className="animate-count-up flex items-center -ml-2 pr-3"
            style={{ color: "var(--accent)", minHeight: 44, background: "transparent", border: "none" }}
          >
            <ChevronLeft size={24} strokeWidth={2.25} />
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 15, fontWeight: 500 }}>Back</span>
          </button>
        )}
      </div>
    </header>
  );
}