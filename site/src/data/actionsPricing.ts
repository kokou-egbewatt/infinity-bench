// GitHub-hosted runner prices and included minutes, for the break-even lab.
// Published figures, not measurements: recheck against the sources before relying on them.
//
// Rates: https://docs.github.com/en/billing/reference/actions-runner-pricing
// Included minutes: https://docs.github.com/en/billing/concepts/product-billing/github-actions
// Self-hosted charge: https://github.blog/changelog/2025-12-16-coming-soon-simpler-pricing-and-a-better-experience-for-github-actions/
//   announced at $0.002 a minute from 2026-03-01, then postponed with no new date.

export const PRICING_CHECKED = '2026-10-14';

export interface RunnerPrice {
  id: string;
  label: string;
  /** USD per minute; each job is rounded up to a whole minute. */
  perMinute: number;
  /** Larger runners cannot use a plan's included minutes. */
  includedApplies: boolean;
}

export const RUNNER_PRICES: RunnerPrice[] = [
  { id: 'linux-2', label: 'Linux 2-core', perMinute: 0.006, includedApplies: true },
  { id: 'linux-2-arm', label: 'Linux 2-core arm64', perMinute: 0.005, includedApplies: true },
  { id: 'linux-4', label: 'Linux 4-core, larger', perMinute: 0.012, includedApplies: false },
  { id: 'linux-8', label: 'Linux 8-core, larger', perMinute: 0.022, includedApplies: false },
  { id: 'linux-16', label: 'Linux 16-core, larger', perMinute: 0.042, includedApplies: false },
];

export interface Plan {
  id: string;
  label: string;
  /** Included minutes per month for private repositories. */
  included: number;
}

export const PLANS: Plan[] = [
  { id: 'free', label: 'Free', included: 2000 },
  { id: 'pro', label: 'Pro', included: 3000 },
  { id: 'free-org', label: 'Free for organizations', included: 2000 },
  { id: 'team', label: 'Team', included: 3000 },
  { id: 'enterprise', label: 'Enterprise Cloud', included: 50000 },
];

/** The announced, postponed per-minute charge on self-hosted runners, in USD. */
export const SELF_HOSTED_CHARGE = 0.002;
