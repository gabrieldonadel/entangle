import React from "react";

const REPO = "gabrieldonadel/entangle";

function parseLastPage(linkHeader: string | null): number | null {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="last"/);
  return match ? Number(match[1]) : null;
}

export function useGitHubContributors(): number | null {
  const [count, setCount] = React.useState<number | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    fetch(
      `https://api.github.com/repos/${REPO}/contributors?per_page=1&anon=1`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        if (!r.ok) return;
        const last = parseLastPage(r.headers.get("Link"));
        if (last != null) {
          setCount(last);
          return;
        }
        const data = (await r.json()) as unknown[];
        setCount(Array.isArray(data) ? data.length : 0);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return count;
}
