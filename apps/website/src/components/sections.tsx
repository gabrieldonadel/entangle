import React from "react";
import {
  Logo,
  GitHubIcon,
  AppleIcon,
  StarIcon,
  ArrowRight,
  ConnectingWave,
} from "./atoms";
import { PhoneFrame, MacFrame, EntangleAppScreen } from "./devices";
import {
  useGitHubStars,
  formatStarsCompact,
  formatStarsLong,
} from "../hooks/useGitHubStars";
import type { AppView, CursorPos, Theme, TrackpadDragHandler } from "../types";

const GITHUB_URL = "https://github.com/gabrieldonadel/entangle";

type NavProps = { theme: Theme; setTheme: (t: Theme) => void };

export const Nav = ({ theme, setTheme }: NavProps) => {
  const stars = useGitHubStars();
  return (
  <header
    style={{
      position: "sticky",
      top: 0,
      zIndex: 50,
      backdropFilter: "blur(20px) saturate(140%)",
      WebkitBackdropFilter: "blur(20px) saturate(140%)",
      background: "color-mix(in srgb, var(--bg-1) 70%, transparent)",
      borderBottom: "1px solid var(--border)",
    }}
  >
    <div
      className="container"
      style={{
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Logo size={28} />
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 18,
            letterSpacing: "-0.02em",
          }}
        >
          Entangle
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--text-muted)",
            marginLeft: 6,
            padding: "2px 7px",
            border: "1px solid var(--border)",
            borderRadius: 6,
            letterSpacing: "0.06em",
          }}
        >
          v1.0 · OSS
        </span>
      </div>
      <nav style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <a
          href="#how"
          className="nav-link"
          style={{ fontSize: 14, color: "var(--text-muted)" }}
        >
          How it works
        </a>
        <a
          href="#screens"
          className="nav-link"
          style={{ fontSize: 14, color: "var(--text-muted)" }}
        >
          Screens
        </a>
        <a
          href="#oss"
          className="nav-link"
          style={{ fontSize: 14, color: "var(--text-muted)" }}
        >
          Open source
        </a>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            border: "1px solid var(--border)",
            display: "grid",
            placeItems: "center",
            color: "var(--text-muted)",
          }}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.64 13a9 9 0 1 1-10.63-10.6 1 1 0 0 1 1.05 1.14A7 7 0 0 0 20.5 11.94a1 1 0 0 1 1.14 1.06z" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="4" />
              <path
                d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="btn btn-ghost"
          style={{ padding: "8px 14px", fontSize: 13 }}
        >
          <GitHubIcon size={15} /> Star
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              padding: "1px 7px",
              borderRadius: 999,
              background: "var(--accent-glow)",
              color: "var(--accent)",
              marginLeft: 2,
            }}
          >
            {formatStarsCompact(stars)}
          </span>
        </a>
      </nav>
    </div>
  </header>
  );
};

type HeroStageProps = {
  cursorPos: CursorPos;
  onTrackpadDrag: TrackpadDragHandler;
  latencyMs: number;
};

const HeroStage = ({ cursorPos, onTrackpadDrag, latencyMs }: HeroStageProps) => {
  const stageRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);

  React.useEffect(() => {
    const update = () => {
      const w = stageRef.current?.offsetWidth || 1180;
      const s = Math.min(1, w / 1100);
      setScale(s);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div
      ref={stageRef}
      style={{
        position: "relative",
        width: "100%",
        height: 620 * scale,
        overflow: "visible",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: `translateX(-50%) scale(${scale})`,
          transformOrigin: "top center",
          width: 1100,
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          justifyItems: "center",
          gap: 0,
          padding: "60px 0 0",
          minHeight: 620,
        }}
      >
        <div
          style={{
            justifySelf: "end",
            transform: "translateY(20px)",
            position: "relative",
            zIndex: 4,
          }}
        >
          <MacFrame width={720} height={440} cursorPos={cursorPos}>
            <div
              style={{
                position: "absolute",
                top: 30,
                left: 40,
                width: 360,
                height: 240,
                background: "rgba(30,38,52,0.9)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5)",
                overflow: "hidden",
                zIndex: 10,
              }}
            >
              <div
                style={{
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  padding: "0 12px",
                  gap: 6,
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#FF5F57" }} />
                <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#FEBC2E" }} />
                <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#28C840" }} />
                <div
                  style={{
                    flex: 1,
                    textAlign: "center",
                    fontSize: 11,
                    color: "rgba(255,255,255,0.5)",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  Cycling.mp4
                </div>
              </div>
              <div
                style={{
                  height: "calc(100% - 28px)",
                  background: "linear-gradient(135deg, #2c3e58, #1d2c44)",
                  display: "grid",
                  placeItems: "center",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.15)",
                    backdropFilter: "blur(10px)",
                    display: "grid",
                    placeItems: "center",
                    border: "1px solid rgba(255,255,255,0.25)",
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <div
                  style={{
                    position: "absolute",
                    bottom: 16,
                    left: 16,
                    right: 16,
                    height: 3,
                    background: "rgba(255,255,255,0.2)",
                    borderRadius: 2,
                  }}
                >
                  <div
                    style={{ width: "37%", height: "100%", background: "#fff", borderRadius: 2 }}
                  />
                </div>
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                top: 16,
                right: 18,
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "rgba(255,255,255,0.4)",
                letterSpacing: "0.05em",
              }}
            >
              MacBook Pro · 10:08
            </div>
          </MacFrame>
        </div>

        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "30%",
            right: "30%",
            transform: "translateY(-30%)",
            height: 200,
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          <ConnectingWave />
        </div>

        <div
          style={{
            position: "absolute",
            top: "calc(50% - 80px)",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            borderRadius: 999,
            background: "var(--surface)",
            border: "1px solid var(--border-strong)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text)",
            zIndex: 5,
            boxShadow: "0 8px 24px -8px rgba(0,0,0,0.3)",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--accent)",
              boxShadow: "0 0 8px var(--accent)",
            }}
          />
          {latencyMs}ms · LAN
        </div>

        <div style={{ width: 0 }} />

        <div
          style={{
            justifySelf: "start",
            transform: "translateY(-30px)",
            zIndex: 4,
          }}
        >
          <PhoneFrame scale={0.95}>
            <EntangleAppScreen
              scale={0.95}
              onTrackpadDrag={onTrackpadDrag}
              cursorPos={cursorPos}
              latencyMs={latencyMs}
            />
          </PhoneFrame>
        </div>
      </div>
    </div>
  );
};

type HeroProps = HeroStageProps;

export const Hero = ({ cursorPos, onTrackpadDrag, latencyMs }: HeroProps) => (
  <section style={{ paddingTop: 56, paddingBottom: 0, position: "relative" }}>
    <div
      className="halo"
      style={{
        width: 600,
        height: 600,
        top: -100,
        left: "-10%",
        background: "var(--accent-glow)",
      }}
    />
    <div
      className="halo"
      style={{
        width: 500,
        height: 500,
        top: 100,
        right: "-8%",
        background: "var(--accent-glow)",
      }}
    />

    <div
      className="container"
      style={{ position: "relative", zIndex: 2, textAlign: "center" }}
    >
      <div
        className="eyebrow"
        style={{
          marginBottom: 20,
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--accent)",
            boxShadow: "0 0 8px var(--accent)",
          }}
        />
        Free · Open source · Built with Expo
      </div>

      <h1 className="h1" style={{ marginBottom: 22, maxWidth: 920, marginInline: "auto" }}>
        Your Mac's pointer,<br />
        <span
          style={{
            background: "linear-gradient(135deg, var(--orb-stop-0), var(--orb-stop-1))",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          entangled
        </span>{" "}
        with your phone.
      </h1>
      <p className="lede" style={{ marginInline: "auto", marginBottom: 36 }}>
        Entangle is a free, open-source remote that turns your iPhone into a pocket
        trackpad for any Mac on your network. Pause your bike, control your video.
        No accounts, no cloud.
      </p>

      <div
        style={{
          display: "flex",
          gap: 12,
          justifyContent: "center",
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <a className="btn btn-primary" href="#">
          <AppleIcon /> Download for iPhone
        </a>
        <a className="btn btn-ghost" href="#">
          <AppleIcon /> Mac App · DMG
        </a>
        <a
          className="btn btn-ghost"
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
        >
          <GitHubIcon /> Star on GitHub
          <ArrowRight />
        </a>
      </div>
      <div className="eyebrow" style={{ fontSize: 10, color: "var(--text-dim)" }}>
        Requires iOS 15.1+ · macOS 14+ · Wi-Fi or Bluetooth
      </div>
    </div>

    <div
      className="container"
      style={{ marginTop: 72, position: "relative", zIndex: 2 }}
    >
      <HeroStage
        cursorPos={cursorPos}
        onTrackpadDrag={onTrackpadDrag}
        latencyMs={latencyMs}
      />
    </div>
  </section>
);

export const HowItWorks = () => {
  const steps = [
    {
      n: "01",
      title: "Install on both",
      body: "Grab Entangle for Mac and iPhone. Both apps are free, signed, and notarized.",
      mono: "brew install --cask entangle",
    },
    {
      n: "02",
      title: "Pair in seconds",
      body: "Open Entangle on Mac. Your phone discovers it automatically over Bonjour. Tap to pair.",
      mono: "Bonjour · LAN-only · ~1.2s",
    },
    {
      n: "03",
      title: "Move, click, scroll",
      body: "Drag to move the cursor. Tap to click. Two-finger drag scrolls. Hold then drag works exactly like a Mac trackpad.",
      mono: "send → input.move(dx, dy)",
    },
  ];

  return (
    <section id="how" style={{ paddingTop: 140 }}>
      <div className="container">
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            How it works
          </div>
          <h2 className="h2">
            Three steps. No accounts.<br />No cloud. No noise.
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 20,
          }}
        >
          {steps.map((s, i) => (
            <div
              key={s.n}
              className="glass"
              style={{
                padding: 28,
                position: "relative",
                minHeight: 240,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--text-dim)",
                  letterSpacing: "0.1em",
                  marginBottom: 16,
                }}
              >
                {s.n} / 03
              </div>
              <h3 className="h3" style={{ marginBottom: 8 }}>
                {s.title}
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: 14.5, marginBottom: 18 }}>
                {s.body}
              </p>
              <div style={{ flex: 1 }} />
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11.5,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background:
                    "color-mix(in srgb, var(--accent-glow) 80%, transparent)",
                  color: "var(--accent)",
                  border: "1px solid var(--border)",
                  letterSpacing: "0.01em",
                  wordBreak: "break-word",
                }}
              >
                {s.mono}
              </div>

              {i < steps.length - 1 && (
                <div
                  style={{
                    position: "absolute",
                    right: -14,
                    top: "50%",
                    width: 28,
                    height: 1,
                    background:
                      "linear-gradient(90deg, var(--border-strong), transparent)",
                    zIndex: 5,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

type ScreenItem = { tag: string; view: AppView; title: string; body: string };

export const Screens = () => {
  const screens: ScreenItem[] = [
    {
      tag: "Trackpad",
      view: "trackpad",
      title: "Pixel-precise pointer",
      body: "A full-bleed surface tuned for natural cursor velocity. Tap, drag, hold-drag, scroll.",
    },
    {
      tag: "Dock",
      view: "dock",
      title: "Launch any app",
      body: "Your dock, in your pocket. Tap to open Safari, jump to Spotify, switch spaces.",
    },
    {
      tag: "Settings",
      view: "settings",
      title: "Tune everything",
      body: "Pointer speed, scroll inversion, haptic feedback. Sensible defaults out of the box.",
    },
  ];

  return (
    <section id="screens">
      <div className="container">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginBottom: 48,
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div className="eyebrow" style={{ marginBottom: 14 }}>
              What's inside
            </div>
            <h2 className="h2" style={{ maxWidth: 600 }}>
              Quiet, deliberate, native.
            </h2>
          </div>
          <p className="lede" style={{ maxWidth: 380 }}>
            No badges, no popovers, no upgrade prompts. Just a tool that does one
            thing and gets out of your way.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 24,
          }}
        >
          {screens.map((s) => (
            <div
              key={s.tag}
              className="glass"
              style={{
                padding: "32px 24px 24px",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0,
                minHeight: 460,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--accent)",
                  padding: "3px 10px",
                  borderRadius: 999,
                  background: "var(--accent-glow)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginBottom: 14,
                }}
              >
                {s.tag}
              </div>
              <h3 className="h3" style={{ marginBottom: 8, textAlign: "center" }}>
                {s.title}
              </h3>
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: 13.5,
                  textAlign: "center",
                  marginBottom: 24,
                  maxWidth: 280,
                }}
              >
                {s.body}
              </p>
              <PhoneFrame scale={0.62} glow={false}>
                <EntangleAppScreen scale={0.62} latencyMs={2} view={s.view} />
              </PhoneFrame>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const Row = ({
  k,
  v,
  valueColor,
}: {
  k: string;
  v: string;
  valueColor?: string;
}) => (
  <div style={{ display: "flex", gap: 10 }}>
    <span style={{ color: "var(--text-dim)", minWidth: 110 }}>{k}</span>
    <span style={{ color: "var(--text-muted)" }}>=</span>
    <span style={{ color: valueColor || "var(--text)" }}>"{v}"</span>
  </div>
);

export const OpenSource = () => {
  const stars = useGitHubStars();
  return (
  <section id="oss">
    <div className="container">
      <div
        className="glass"
        style={{
          padding: "56px 48px",
          position: "relative",
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: 48,
          alignItems: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.5,
            pointerEvents: "none",
            background:
              "radial-gradient(circle at 90% 10%, var(--accent-glow), transparent 50%)",
          }}
        />
        <div style={{ position: "relative" }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            MIT-licensed
          </div>
          <h2 className="h2" style={{ marginBottom: 14 }}>
            Free forever. Built in the open.
          </h2>
          <p className="lede" style={{ marginBottom: 24 }}>
            No accounts, no telemetry, no upsell. Inspect every line, file an issue,
            ship a PR. Built with Expo on iOS and macOS — one codebase, two native
            targets.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a
              className="btn btn-primary"
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
            >
              <GitHubIcon /> github.com/gabrieldonadel/entangle
            </a>
            <a
              className="btn btn-ghost"
              href={`${GITHUB_URL}/stargazers`}
              target="_blank"
              rel="noreferrer"
            >
              <StarIcon /> Star · {formatStarsLong(stars)}
            </a>
          </div>
        </div>

        <div style={{ position: "relative" }}>
          <div
            style={{
              background: "var(--bg-2)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 18,
              fontFamily: "var(--font-mono)",
              fontSize: 12.5,
              lineHeight: 1.7,
              boxShadow: "0 30px 60px -25px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", gap: 5, marginBottom: 14 }}>
              <div
                style={{ width: 9, height: 9, borderRadius: "50%", background: "#FF5F57" }}
              />
              <div
                style={{ width: 9, height: 9, borderRadius: "50%", background: "#FEBC2E" }}
              />
              <div
                style={{ width: 9, height: 9, borderRadius: "50%", background: "#28C840" }}
              />
            </div>
            <div style={{ color: "var(--text-dim)" }}>
              <span style={{ color: "var(--accent)" }}>$</span> entangle --about
            </div>
            <Row k="license" v="MIT" />
            <Row k="stack" v="Expo · React Native · Swift" />
            <Row k="protocol" v="Bonjour + WebSocket (LAN-only)" />
            <Row k="telemetry" v="none" valueColor="var(--accent)" />
            <Row k="cloud" v="never" valueColor="var(--accent)" />
            <Row k="contributors" v="38" />
          </div>
        </div>
      </div>
    </div>
  </section>
  );
};

export const Footer = () => (
  <footer
    style={{
      borderTop: "1px solid var(--border)",
      marginTop: 80,
      padding: "40px 0 64px",
    }}
  >
    <div
      className="container"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 24,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Logo size={22} />
        <span
          style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15 }}
        >
          Entangle
        </span>
        <span style={{ fontSize: 12, color: "var(--text-dim)", marginLeft: 8 }}>
          MIT © 2026 · Made with care, not pixels
        </span>
      </div>
      <div
        style={{
          display: "flex",
          gap: 22,
          fontSize: 13,
          color: "var(--text-muted)",
        }}
      >
        <a href={GITHUB_URL} target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a href={`${GITHUB_URL}/issues`} target="_blank" rel="noreferrer">
          Issues
        </a>
        <a href={`${GITHUB_URL}/releases`} target="_blank" rel="noreferrer">
          Releases
        </a>
        <a href="#">Privacy</a>
      </div>
    </div>
  </footer>
);
