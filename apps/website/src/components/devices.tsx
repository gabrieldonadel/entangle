import React from "react";
import { CursorIcon } from "./atoms";
import type {
  AppView,
  CursorPos,
  TrackpadDragHandler,
} from "../types";

/* iPhone hardware frame */
type PhoneFrameProps = {
  children?: React.ReactNode;
  scale?: number;
  glow?: boolean;
};

export const PhoneFrame = ({
  children,
  scale = 1,
  glow = true,
}: PhoneFrameProps) => {
  const phoneStyle: React.CSSProperties = {
    width: 280 * scale,
    height: 580 * scale,
    borderRadius: 52 * scale,
    background: "linear-gradient(160deg, #2a2d34 0%, #0e1014 100%)",
    padding: 6 * scale,
    boxShadow: `
      inset 0 0 0 1.5px rgba(255,255,255,0.08),
      inset 0 0 0 3px rgba(0,0,0,0.4),
      0 30px 80px -20px rgba(0,0,0,0.6),
      0 0 0 0.5px rgba(255,255,255,0.04)
    `,
    position: "relative",
  };

  const screenStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    borderRadius: 46 * scale,
    background: "#0a0a0d",
    overflow: "hidden",
    position: "relative",
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {glow && (
        <div
          style={{
            position: "absolute",
            inset: -40,
            background:
              "radial-gradient(circle at 50% 50%, var(--accent-glow), transparent 65%)",
            filter: "blur(30px)",
            zIndex: -1,
          }}
        />
      )}
      <div style={phoneStyle}>
        <div style={screenStyle}>{children}</div>
        {/* Dynamic Island */}
        <div
          style={{
            position: "absolute",
            top: 14 * scale,
            left: "50%",
            transform: "translateX(-50%)",
            width: 96 * scale,
            height: 28 * scale,
            background: "#000",
            borderRadius: 20 * scale,
            zIndex: 10,
          }}
        />
      </div>
    </div>
  );
};

/* iOS status bar */
const StatusBar = ({ scale = 1 }: { scale?: number }) => (
  <div
    style={{
      height: 50 * scale,
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      padding: `0 ${24 * scale}px ${10 * scale}px`,
      color: "#fff",
      fontSize: 15 * scale,
      fontWeight: 600,
      fontFamily: "var(--font-display)",
      letterSpacing: "-0.01em",
    }}
  >
    <span>10:08</span>
    <div style={{ display: "flex", alignItems: "center", gap: 6 * scale }}>
      <svg
        width={17 * scale}
        height={11 * scale}
        viewBox="0 0 17 11"
        fill="#fff"
      >
        <rect x="0" y="7" width="3" height="4" rx="0.5" />
        <rect x="4.5" y="5" width="3" height="6" rx="0.5" />
        <rect x="9" y="2.5" width="3" height="8.5" rx="0.5" />
        <rect x="13.5" y="0" width="3" height="11" rx="0.5" />
      </svg>
      <svg
        width={15 * scale}
        height={11 * scale}
        viewBox="0 0 15 11"
        fill="#fff"
      >
        <path d="M7.5 2C5 2 2.7 2.9 1 4.4l1 1.2C3.5 4.4 5.4 3.7 7.5 3.7s4 0.7 5.5 1.9l1-1.2C12.3 2.9 10 2 7.5 2zm0 2.5C5.8 4.5 4.2 5.1 3 6.2l1.1 1.2c1-.9 2.2-1.4 3.4-1.4s2.5.5 3.4 1.4l1.1-1.2c-1.2-1.1-2.8-1.7-4.5-1.7zm0 2.7c-1 0-1.9.4-2.5 1l1 1.2c.4-.4.9-.6 1.5-.6s1.1.2 1.5.6l1-1.2c-.6-.6-1.5-1-2.5-1z" />
      </svg>
      <svg
        width={26 * scale}
        height={11 * scale}
        viewBox="0 0 26 11"
        fill="none"
      >
        <rect
          x="0.5"
          y="0.5"
          width="22"
          height="10"
          rx="2.5"
          stroke="#fff"
          strokeOpacity="0.5"
        />
        <rect x="2" y="2" width="19" height="7" rx="1" fill="#fff" />
        <rect
          x="23.5"
          y="3.5"
          width="2"
          height="4"
          rx="1"
          fill="#fff"
          fillOpacity="0.5"
        />
      </svg>
    </div>
  </div>
);

const DOCK_APPS = [
  { name: "Finder", color: "#3DA9FC", letter: "F" },
  { name: "Safari", color: "#1E88E5", letter: "S" },
  { name: "Mail", color: "#42A5F5", letter: "@" },
  { name: "Messages", color: "#34C759", letter: "·" },
  { name: "Notes", color: "#FFD83D", letter: "N" },
  { name: "Music", color: "#FA2D48", letter: "♪" },
  { name: "Terminal", color: "#1d1d1d", letter: ">_" },
  { name: "VS Code", color: "#0078D4", letter: "<>" },
  { name: "Slack", color: "#4A154B", letter: "#" },
  { name: "Linear", color: "#5E6AD2", letter: "L" },
  { name: "Figma", color: "#1E1E1E", letter: "F" },
  { name: "Discord", color: "#5865F2", letter: "D" },
];

/* The Entangle iOS app screen */
type EntangleAppScreenProps = {
  scale?: number;
  onTrackpadDrag?: TrackpadDragHandler;
  cursorPos?: CursorPos;
  latencyMs?: number;
  view?: AppView;
};

export const EntangleAppScreen = ({
  scale = 1,
  onTrackpadDrag,
  cursorPos,
  latencyMs = 2,
  view = "trackpad",
}: EntangleAppScreenProps) => {
  const trackpadRef = React.useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = React.useState(false);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onTrackpadDrag) return;
    const rect = trackpadRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onTrackpadDrag({
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
      dragging: true,
    });
  };

  const renderHeader = () => {
    if (view === "dock") {
      return (
        <div
          style={{ padding: `${4 * scale}px ${22 * scale}px ${10 * scale}px` }}
        >
          <div
            style={{
              fontSize: 22 * scale,
              fontWeight: 700,
              letterSpacing: "-0.025em",
              fontFamily: "var(--font-display)",
            }}
          >
            Dock
          </div>
          <div
            style={{
              fontSize: 12 * scale,
              color: "rgba(255,255,255,0.5)",
              marginTop: 2 * scale,
            }}
          >
            Tap an app to bring it to the front.
          </div>
        </div>
      );
    }
    if (view === "settings") {
      return (
        <div
          style={{ padding: `${4 * scale}px ${22 * scale}px ${10 * scale}px` }}
        >
          <div
            style={{
              fontSize: 22 * scale,
              fontWeight: 700,
              letterSpacing: "-0.025em",
              fontFamily: "var(--font-display)",
            }}
          >
            Settings
          </div>
          <div
            style={{
              fontSize: 12 * scale,
              color: "rgba(255,255,255,0.5)",
              marginTop: 2 * scale,
            }}
          >
            Tune to taste.
          </div>
        </div>
      );
    }
    return (
      <div
        style={{
          padding: `${4 * scale}px ${18 * scale}px ${12 * scale}px`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 8 * scale,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 12 * scale,
              color: "rgba(255,255,255,0.55)",
              marginBottom: 2 * scale,
            }}
          >
            Connected to
          </div>
          <div
            style={{
              fontSize: 17 * scale,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              fontFamily: "var(--font-display)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            MacBook Pro
          </div>
          <div
            style={{
              fontSize: 11 * scale,
              color: "rgba(255,255,255,0.4)",
              marginTop: 3 * scale,
              display: "flex",
              alignItems: "center",
              gap: 6 * scale,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 5 * scale,
                height: 5 * scale,
                borderRadius: "50%",
                background: "#7393B8",
                boxShadow: "0 0 6px #7393B8",
              }}
            />
            open · {latencyMs}ms
          </div>
        </div>
        <button
          style={{
            width: 28 * scale,
            height: 28 * scale,
            flexShrink: 0,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "grid",
            placeItems: "center",
            color: "rgba(255,255,255,0.6)",
          }}
        >
          <svg
            width={14 * scale}
            height={14 * scale}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="6" width="18" height="13" rx="2" />
            <path d="M7 11h.01M11 11h.01M15 11h.01M7 15h10" />
          </svg>
        </button>
      </div>
    );
  };

  const renderBody = () => {
    if (view === "dock") {
      return (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: `${4 * scale}px ${18 * scale}px 0`,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12 * scale,
              alignContent: "start",
              flex: 1,
            }}
          >
            {DOCK_APPS.map((a) => (
              <div
                key={a.name}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4 * scale,
                }}
              >
                <div
                  style={{
                    width: 48 * scale,
                    height: 48 * scale,
                    borderRadius: 12 * scale,
                    background: `linear-gradient(135deg, ${a.color}, ${a.color}cc)`,
                    display: "grid",
                    placeItems: "center",
                    color: "#fff",
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 16 * scale,
                    boxShadow:
                      "0 4px 12px -4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {a.letter}
                </div>
                <div
                  style={{
                    fontSize: 9 * scale,
                    color: "rgba(255,255,255,0.85)",
                    maxWidth: 60 * scale,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {a.name}
                </div>
                <span
                  style={{
                    width: 3 * scale,
                    height: 3 * scale,
                    borderRadius: "50%",
                    background: "#7393B8",
                    marginTop: -2 * scale,
                  }}
                />
              </div>
            ))}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 6 * scale,
              margin: `${10 * scale}px 0 ${4 * scale}px`,
            }}
          >
            {[
              { label: "Prev Space", glyph: "⌃←" },
              { label: "Mission Control", glyph: "⌃↑" },
              { label: "Next Space", glyph: "⌃→" },
            ].map((b) => (
              <div
                key={b.label}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 12 * scale,
                  padding: `${8 * scale}px 0`,
                  textAlign: "center",
                  color: "rgba(255,255,255,0.85)",
                }}
              >
                <div
                  style={{
                    fontSize: 14 * scale,
                    color: "#7393B8",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {b.glyph}
                </div>
                <div
                  style={{
                    fontSize: 8.5 * scale,
                    marginTop: 1 * scale,
                    color: "rgba(255,255,255,0.6)",
                  }}
                >
                  {b.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (view === "settings") {
      return (
        <div
          style={{
            flex: 1,
            padding: `${4 * scale}px ${16 * scale}px 0`,
            display: "flex",
            flexDirection: "column",
            gap: 10 * scale,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 14 * scale,
              padding: `${12 * scale}px ${14 * scale}px`,
              fontSize: 11 * scale,
            }}
          >
            <div
              style={{
                fontSize: 13 * scale,
                fontWeight: 700,
                marginBottom: 8 * scale,
                fontFamily: "var(--font-display)",
                letterSpacing: "-0.01em",
              }}
            >
              Connection
            </div>
            {[
              ["Status", "open"],
              ["Server", "MacBook Pro"],
              ["Host", "192.168.0.12:59593"],
              ["Latency", `${latencyMs}ms`],
              ["Protocol", "v1"],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: `${3 * scale}px 0`,
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                <span>{k}</span>
                <span
                  style={{
                    color: "rgba(255,255,255,0.95)",
                    fontFamily:
                      k === "Host" ? "var(--font-mono)" : "var(--font-body)",
                  }}
                >
                  {v}
                </span>
              </div>
            ))}
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 14 * scale,
              padding: `${12 * scale}px ${14 * scale}px`,
            }}
          >
            <div
              style={{
                fontSize: 13 * scale,
                fontWeight: 700,
                marginBottom: 8 * scale,
                fontFamily: "var(--font-display)",
                letterSpacing: "-0.01em",
              }}
            >
              Pointer sensitivity
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 6 * scale,
              }}
            >
              {(
                [
                  ["Slow", "1.0×", false],
                  ["Normal", "1.5×", true],
                  ["Fast", "2.5×", false],
                ] as const
              ).map(([label, sub, active]) => (
                <div
                  key={label}
                  style={{
                    padding: `${8 * scale}px 0`,
                    borderRadius: 10 * scale,
                    background: active ? "#1E88E5" : "rgba(255,255,255,0.05)",
                    textAlign: "center",
                    color: "#fff",
                  }}
                >
                  <div style={{ fontSize: 11 * scale, fontWeight: 600 }}>
                    {label}
                  </div>
                  <div
                    style={{
                      fontSize: 9 * scale,
                      opacity: 0.8,
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {sub}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 14 * scale,
              padding: `${12 * scale}px ${14 * scale}px`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10 * scale,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13 * scale,
                  fontWeight: 700,
                  fontFamily: "var(--font-display)",
                }}
              >
                Natural scroll
              </div>
              <div
                style={{
                  fontSize: 10 * scale,
                  color: "rgba(255,255,255,0.5)",
                  marginTop: 2 * scale,
                }}
              >
                Content follows fingers.
              </div>
            </div>
            <span
              style={{
                width: 36 * scale,
                height: 22 * scale,
                flexShrink: 0,
                borderRadius: 999,
                background: "#34C759",
                position: "relative",
                display: "inline-block",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 2 * scale,
                  left: 16 * scale,
                  width: 18 * scale,
                  height: 18 * scale,
                  borderRadius: "50%",
                  background: "#fff",
                }}
              />
            </span>
          </div>
        </div>
      );
    }
    // trackpad
    return (
      <div
        style={{
          flex: 1,
          padding: `0 ${16 * scale}px`,
          display: "flex",
          flexDirection: "column",
          paddingBottom: 0,
        }}
      >
        <div
          ref={trackpadRef}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDragging(true);
            handlePointerMove(e);
          }}
          onPointerMove={(e) => dragging && handlePointerMove(e)}
          onPointerUp={() => {
            setDragging(false);
            onTrackpadDrag && onTrackpadDrag({ dragging: false });
          }}
          style={{
            flex: 1,
            background: dragging
              ? "rgba(115,147,184,0.10)"
              : "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.04)",
            borderRadius: 16 * scale,
            position: "relative",
            touchAction: "none",
            transition: "background 0.2s ease",
            cursor: "crosshair",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
              backgroundSize: `${16 * scale}px ${16 * scale}px`,
              borderRadius: 16 * scale,
              pointerEvents: "none",
            }}
          />
          {cursorPos && dragging && (
            <div
              style={{
                position: "absolute",
                left: `${cursorPos.x * 100}%`,
                top: `${cursorPos.y * 100}%`,
                width: 36 * scale,
                height: 36 * scale,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(163,187,214,0.4), transparent 70%)",
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
              }}
            />
          )}
          <div
            style={{
              position: "absolute",
              bottom: 10 * scale,
              left: 0,
              right: 0,
              textAlign: "center",
              fontSize: 9 * scale,
              color: "rgba(255,255,255,0.25)",
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.02em",
              pointerEvents: "none",
            }}
          >
            drag · tap · 2-finger scroll · hold to drag
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#0a0a0d",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-body)",
      }}
    >
      <StatusBar scale={scale} />
      {renderHeader()}
      {renderBody()}

      <div
        style={{
          margin: `${10 * scale}px auto ${22 * scale}px`,
          padding: `${4 * scale}px`,
          display: "inline-flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 2 * scale,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.05)",
          borderRadius: 999 * scale,
          alignSelf: "center",
        }}
      >
        {[
          {
            label: "Trackpad",
            id: "trackpad",
            icon: (
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ display: "block" }}
              >
                <path d="M5 3l4 12 2-5 5-2L5 3z" transform="translate(0 3)" />
              </svg>
            ),
          },
          {
            label: "Dock",
            id: "dock",
            icon: (
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ display: "block" }}
              >
                <rect x="3" y="6" width="18" height="13" rx="2" />
              </svg>
            ),
          },
          {
            label: "Settings",
            id: "settings",
            icon: (
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ display: "block" }}
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            ),
          },
        ].map((t) => {
          const active = t.id === view;
          return (
            <div
              key={t.label}
              style={{
                padding: `${6 * scale}px ${14 * scale}px`,
                borderRadius: 999 * scale,
                background: active ? "rgba(255,255,255,0.10)" : "transparent",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2 * scale,
                color: active ? "#7393B8" : "rgba(255,255,255,0.5)",
                minWidth: 52 * scale,
              }}
            >
              <div style={{ width: 16 * scale, height: 16 * scale }}>
                {t.icon}
              </div>
              <div
                style={{ fontSize: 9 * scale, color: "rgba(255,255,255,0.7)" }}
              >
                {t.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* Mac frame — desktop window with menu bar + wallpaper */
type MacFrameProps = {
  children?: React.ReactNode;
  width?: number;
  height?: number;
  cursorPos?: CursorPos | null;
};

export const MacFrame = ({
  children,
  width = 720,
  height = 460,
  cursorPos = null,
}: MacFrameProps) => {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 14,
        overflow: "hidden",
        position: "relative",
        background: "linear-gradient(180deg, #1a1d24, #0e1014)",
        boxShadow: `
          inset 0 0 0 1px rgba(255,255,255,0.06),
          0 30px 60px -20px rgba(0,0,0,0.6),
          0 0 0 1px rgba(0,0,0,0.4)
        `,
      }}
    >
      <div
        style={{
          height: 26,
          background: "rgba(20, 23, 29, 0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          gap: 16,
          fontSize: 12,
          color: "rgba(255,255,255,0.85)",
          fontFamily: "var(--font-display)",
          fontWeight: 500,
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="rgba(255,255,255,0.85)"
        >
          <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
        </svg>
        <span style={{ fontWeight: 700 }}>Finder</span>
        <span style={{ opacity: 0.7 }}>File</span>
        <span style={{ opacity: 0.7 }}>Edit</span>
        <span style={{ opacity: 0.7 }}>View</span>
        <span style={{ opacity: 0.7 }}>Go</span>
        <span style={{ opacity: 0.7 }}>Window</span>
        <span style={{ opacity: 0.7 }}>Help</span>
        <div style={{ flex: 1 }} />
        <span
          style={{ opacity: 0.6, fontFamily: "var(--font-mono)", fontSize: 11 }}
        >
          10:08
        </span>
      </div>

      <div
        style={{
          position: "relative",
          height: "calc(100% - 26px)",
          background: `
            radial-gradient(ellipse at 30% 20%, rgba(115,147,184,0.25), transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(58,94,144,0.25), transparent 60%),
            linear-gradient(135deg, #1d2c44 0%, #0e1014 70%)
          `,
          overflow: "hidden",
        }}
      >
        {children}

        {cursorPos && (
          <div
            style={{
              position: "absolute",
              left: `${cursorPos.x * 100}%`,
              top: `${cursorPos.y * 100}%`,
              transform: "translate(-2px, -2px)",
              transition: "left 0.06s linear, top 0.06s linear",
              pointerEvents: "none",
              zIndex: 20,
            }}
          >
            <CursorIcon size={20} color="#fff" />
          </div>
        )}

        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: "50%",
            transform: "translateX(-50%)",
            height: 48,
            padding: "0 10px",
            background: "rgba(40, 44, 54, 0.55)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {[
            "#FF6B6B",
            "#4ECDC4",
            "#FFD93D",
            "#A8E6CF",
            "#7393B8",
            "#C7B8E0",
          ].map((c, i) => (
            <div
              key={i}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: `linear-gradient(135deg, ${c}, ${c}88)`,
                boxShadow:
                  "0 1px 2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
