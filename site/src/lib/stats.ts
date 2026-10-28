export interface StatsInput {
  data: {
    date: Date;
    updated?: Date;
    draft: boolean;
    errata: unknown[];
  };
}

interface Stats {
  postCount: number;
  errataCount: number;
  lastMeasured: Date | null;
}

export function computeStats(posts: StatsInput[]): Stats {
  const live = posts.filter((p) => !p.data.draft);
  const last = live.map((p) => p.data.updated ?? p.data.date).sort((a, b) => b.valueOf() - a.valueOf())[0];
  return {
    postCount: live.length,
    errataCount: live.reduce((n, p) => n + p.data.errata.length, 0),
    lastMeasured: last ?? null,
  };
}
