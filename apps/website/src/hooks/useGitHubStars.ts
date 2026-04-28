import React from "react";

const REPO = "gabrieldonadel/entangle";

type RepoResponse = { stargazers_count?: number };

export function useGitHubStars(): number | null {
  const [stars, setStars] = React.useState<number | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    fetch(`https://api.github.com/repos/${REPO}`, { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<RepoResponse>) : null))
      .then((data) => {
        if (data && typeof data.stargazers_count === "number") {
          setStars(data.stargazers_count);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return stars;
}

export function formatStarsCompact(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

export function formatStarsLong(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}
