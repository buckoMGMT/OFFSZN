// One video player instance app-wide. openPlayer(video) mounts the full-screen
// player; minimize() shrinks it to a draggable floating card that keeps playing;
// restore() re-expands; close() tears it down. Because there's a single <video>
// element rendered by the provider, minimizing/restoring never double-plays audio.
import { createContext, useContext, useState, useCallback } from "react";

const MiniPlayerContext = createContext(null);

export function MiniPlayerProvider({ children }) {
  const [video, setVideo] = useState(null); // { url, title, author }
  const [minimized, setMinimized] = useState(false);

  const openPlayer = useCallback((v) => { setVideo(v); setMinimized(false); }, []);
  const minimize = useCallback(() => setMinimized(true), []);
  const restore = useCallback(() => setMinimized(false), []);
  const close = useCallback(() => { setVideo(null); setMinimized(false); }, []);

  return (
    <MiniPlayerContext.Provider value={{ video, minimized, openPlayer, minimize, restore, close }}>
      {children}
    </MiniPlayerContext.Provider>
  );
}

export function useMiniPlayer() {
  const ctx = useContext(MiniPlayerContext);
  if (!ctx) throw new Error("useMiniPlayer must be used within MiniPlayerProvider");
  return ctx;
}