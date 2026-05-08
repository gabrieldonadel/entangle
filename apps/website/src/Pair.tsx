import React from "react";

// TODO: swap in the App Store URL once the iOS app is published.
const APP_STORE_URL: string | null = null;

export default function Pair() {
  const params = new URLSearchParams(window.location.search);
  const host = params.get("host");
  const port = params.get("port");
  const token = params.get("token");

  const hasParams = Boolean(host && port && token);
  const fallbackScheme = hasParams
    ? `entangle://pair?host=${encodeURIComponent(host!)}&port=${encodeURIComponent(
        port!,
      )}&token=${encodeURIComponent(token!)}`
    : "entangle://pair";

  // If iOS recognised the universal link it would have opened the app
  // already; if we render here, the app is missing or the user came from
  // a non-iOS device. Try the custom scheme once after a short beat —
  // succeeds for users who already installed but for some reason hit the
  // web fallback (e.g. tapped the link in Slack on macOS).
  React.useEffect(() => {
    if (!hasParams) return;
    const t = window.setTimeout(() => {
      window.location.replace(fallbackScheme);
    }, 250);
    return () => window.clearTimeout(t);
  }, [hasParams, fallbackScheme]);

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    document.body.setAttribute("data-theme", "dark");
  }, []);

  return (
    <main style={styles.root}>
      <section style={styles.card}>
        <span style={styles.eyebrow}>Pair · Entangle</span>
        <h1 style={styles.heading}>
          Open in the Entangle iPhone app to finish pairing.
        </h1>
        <p style={styles.lede}>
          {hasParams
            ? "If the app didn't open automatically, tap the button below."
            : "This link is missing pairing details. Open the Mac app and scan the QR code with your iPhone Camera."}
        </p>

        <div style={styles.actions}>
          {hasParams ? (
            <a href={fallbackScheme} style={styles.primary}>
              Open in Entangle
            </a>
          ) : null}
          {APP_STORE_URL ? (
            <a href={APP_STORE_URL} style={styles.ghost}>
              Get the iPhone app
            </a>
          ) : (
            <span style={styles.coming}>iPhone app coming soon to the App Store</span>
          )}
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    background:
      "radial-gradient(900px 500px at 100% 30%, rgba(163,187,214,0.12), transparent 65%), linear-gradient(180deg, #0a0c10, #0e1014 35%, #0e1014 65%, #0a0c10)",
    color: "#f5f7fa",
    fontFamily:
      '"Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  },
  card: {
    width: "100%",
    maxWidth: 520,
    padding: "36px 32px",
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(26,29,36,0.72)",
    boxShadow: "0 30px 60px -20px rgba(0,0,0,0.6)",
    backdropFilter: "blur(20px) saturate(140%)",
  },
  eyebrow: {
    fontFamily:
      '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
    fontSize: 11,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "#8a93a6",
  },
  heading: {
    fontFamily:
      '"Inter Tight", -apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
    fontSize: 28,
    lineHeight: 1.15,
    letterSpacing: "-0.02em",
    margin: "16px 0 12px",
    fontWeight: 600,
  },
  lede: {
    color: "#8a93a6",
    fontSize: 15,
    lineHeight: 1.55,
    margin: 0,
    marginBottom: 24,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
  },
  primary: {
    display: "inline-flex",
    alignItems: "center",
    padding: "12px 20px",
    borderRadius: 999,
    background: "#fff",
    color: "#0e1014",
    fontWeight: 500,
    fontSize: 15,
    textDecoration: "none",
  },
  ghost: {
    display: "inline-flex",
    alignItems: "center",
    padding: "12px 20px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.14)",
    color: "#f5f7fa",
    fontSize: 15,
    textDecoration: "none",
  },
  coming: {
    fontSize: 13,
    color: "#5a6378",
    alignSelf: "center",
  },
};
