import React from "react";
import { Nav, Hero, HowItWorks, Screens, OpenSource, Footer } from "./components/sections";
import type { CursorPos, Theme, TrackpadDragHandler } from "./types";

const LATENCY_MS = 11;

export default function App() {
  const [theme, setTheme] = React.useState<Theme>("dark");
  const [cursorPos, setCursorPos] = React.useState<CursorPos>({ x: 0.5, y: 0.5 });
  const [interacting, setInteracting] = React.useState(false);
  const idleRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (interacting) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const dt = (now - start) / 1000;
      const x = 0.5 + 0.32 * Math.sin(dt * 0.5);
      const y = 0.5 + 0.22 * Math.sin(dt * 0.7 + 1);
      setCursorPos({ x, y });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [interacting]);

  const handleTrackpadDrag = React.useCallback<TrackpadDragHandler>((data) => {
    if (data.dragging === false) {
      if (idleRef.current) clearTimeout(idleRef.current);
      idleRef.current = setTimeout(() => setInteracting(false), 1500);
      return;
    }
    setInteracting(true);
    if (idleRef.current) clearTimeout(idleRef.current);
    setCursorPos({ x: data.x, y: data.y });
  }, []);

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.body.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <>
      <Nav theme={theme} setTheme={setTheme} />
      <Hero
        cursorPos={cursorPos}
        onTrackpadDrag={handleTrackpadDrag}
        latencyMs={LATENCY_MS}
      />
      <HowItWorks />
      <Screens />
      <OpenSource />
      <Footer />
    </>
  );
}
