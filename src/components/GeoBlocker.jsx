import { useState, useEffect } from "react";
import PlayDiagram from "@/components/ui/PlayDiagram";

// Checks if the user appears to be outside the US via a free IP geolocation API.
// If blocked, shows a full-screen message. Children render normally if US-based.
export default function GeoBlocker({ children }) {
  const [status, setStatus] = useState("checking"); // "checking" | "allowed" | "blocked"

  useEffect(() => {
    // If already checked this session, skip
    const cached = sessionStorage.getItem("pb_geo");
    if (cached === "us") { setStatus("allowed"); return; }
    if (cached === "blocked") { setStatus("blocked"); return; }

    fetch("https://ipapi.co/json/")
      .then(r => r.json())
      .then(data => {
        if (data.country_code === "US") {
          sessionStorage.setItem("pb_geo", "us");
          setStatus("allowed");
        } else {
          sessionStorage.setItem("pb_geo", "blocked");
          setStatus("blocked");
        }
      })
      .catch(() => {
        // On API failure, allow through — don't punish US users for a lookup error
        setStatus("allowed");
      });
  }, []);

  if (status === "checking") {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center" style={{ background: '#0D0D0F' }}>
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "blocked") {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center px-8 text-center" style={{ background: '#0D0D0F' }}>
        <PlayDiagram size={140} />
        <h1 className="font-anton text-3xl uppercase mt-6 mb-3" style={{ color: '#EDEEF0' }}>
          US Only
        </h1>
        <p className="font-elite text-sm leading-relaxed max-w-xs" style={{ color: '#9BA3AC' }}>
          The Playbook is currently available to residents of the United States only.
        </p>
        <div className="mt-8 p-4 rounded border max-w-xs w-full" style={{ background: '#1B1B1D', borderColor: '#5E646B' }}>
          <p className="font-work text-xs leading-relaxed" style={{ color: '#5A5D63' }}>
            This service is operated by <span style={{ color: '#9BA3AC' }}>Bucko Management LLC</span>, a Texas-based company. We do not currently offer our services to residents of the European Economic Area (EEA) or other regions outside the United States.
          </p>
        </div>
        <p className="font-elite text-[10px] uppercase tracking-widest mt-6" style={{ color: '#5E646B' }}>
          © {new Date().getFullYear()} Bucko Management LLC · PO Box 118141, Frisco, TX 75011
        </p>
      </div>
    );
  }

  return children;
}