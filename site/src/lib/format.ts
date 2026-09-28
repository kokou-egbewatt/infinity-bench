/** YYYY-MM-DD in UTC, so a post dated 2026-10-06 never renders as the 5th west of Greenwich. */
/** MiB as GB. */
export const gb = (mb: number, digits = 2) => `${(mb / 1024).toFixed(digits)} GB`;

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Minutes at 230 wpm, rounded up. Tags and code fences don't count as reading. */
export function readTime(body = ''): number {
  const words = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .match(/[A-Za-z0-9][\w'’.-]*/g);
  return Math.max(1, Math.ceil((words?.length ?? 0) / 230));
}
