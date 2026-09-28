// Every series and planned post, with the issues each one is written from.
//
// Status is derived, never typed: a post is "ready" when every source issue
// is closed (or the source is a doc that exists), "waiting" otherwise,
// "rented" when it needs hardware beyond the RTX 5060, and "no source" when
// neither repo has an issue for it yet. An entry is published when a post's
// frontmatter `plan` names its `id`; the link and date come from that post.
//
// `priority` puts a post under Next up on the Series page. Lower sorts first.
// It is never shown: it's a rough intent, not a schedule or a promise of order.

import type { IssueStates, RepoKey } from '../lib/issues';

export const TOPICS = ['orchestration', 'serving', 'streaming', 'observability', 'agents', 'platform'] as const;
type Topic = (typeof TOPICS)[number];

export type Source =
  | { repo: RepoKey; issue: number }
  | { repo: RepoKey; doc: string; label: string };

interface PlannedPost {
  title: string;
  /** One or two sentences: the problem and what gets measured. Shown under Next up. */
  summary?: string;
  sources: Source[];
  priority?: number;
  rented?: boolean;
  /** Stable key a post's frontmatter `plan` points at. */
  id?: string;
}

/** A planned post with its published post attached, if there is one. */
export interface PlanEntry extends PlannedPost {
  slug?: string;
  published?: string; // YYYY-MM-DD
}

export interface Series {
  id: string;
  title: string;
  description: string;
  topic: Topic | 'mixed';
  home: { repo: RepoKey | 'both'; label: string; milestone?: number };
  posts: PlannedPost[];
}

export interface ResolvedSeries extends Omit<Series, 'posts'> {
  posts: PlanEntry[];
}

export type PostStatus = 'published' | 'ready' | 'waiting' | 'rented' | 'no-source';

export function postStatus(post: PlanEntry, states: IssueStates): PostStatus {
  if (post.slug) return 'published';
  if (post.rented) return 'rented';
  if (post.sources.length === 0) return 'no-source';
  const done = post.sources.every((s) => 'doc' in s || states.get(s.repo, s.issue) === 'closed');
  return done ? 'ready' : 'waiting';
}

const nm = (...issues: number[]): Source[] => issues.map((issue) => ({ repo: 'nm', issue }));
const ib = (...issues: number[]): Source[] => issues.map((issue) => ({ repo: 'ib', issue }));

export const SERIES: Series[] = [
  {
    id: 'rig',
    title: 'The rig',
    description:
      'What an 8 GB RTX 5060 in a Windows machine actually gives me before anything runs on it. Every other post is measured against these.',
    topic: 'mixed',
    home: { repo: 'ib', label: 'infinity-bench', milestone: 1 },
    posts: [
      {
        priority: 1,
        id: 'vram-accounting',
        title: 'VRAM accounting on Windows: how much of the 8 GB is actually free',
        summary:
          'Before any model loads, the desktop, the browser and WSL2 already hold part of the card. I measure each one, so every later post can say how much memory it really had.',
        sources: ib(10, 13),
      },
      {
        priority: 3,
        id: 'dcgm-geforce',
        title: 'dcgm-exporter on a GeForce card: which fields report',
        summary:
          'Most GPU monitoring guides assume datacenter cards. A month of scraping every DCGM field on the 5060, sorted into works, always zero, and not supported, with GPU_UTIL against SM_ACTIVE as the comparison that matters.',
        sources: nm(22),
      },
      {
        priority: 4,
        id: 'k3s-wsl2-gpu',
        title: 'k3s in WSL2 with a GPU, up and torn down by one command',
        summary:
          'The local cluster the rest of the series runs on: GPU Operator, device plugin and a GPU pod, timed from nothing to the first scheduled pod, and torn down again when it sits idle.',
        sources: [...nm(21), ...ib(2)],
      },
      {
        priority: 5,
        id: 'timeslice-mps',
        title: 'Time-slicing vs MPS on one card',
        summary:
          'Three small services share the GPU two ways. I compare latency and SM use, and what happens to the other two when one of them runs out of memory. MIG doesn\'t exist on this card, so it\'s out of scope here.',
        sources: [],
      },
      {
        priority: 7,
        id: 'ebpf-cuda-launch',
        title: 'eBPF on the CUDA launch path under WSL2',
        summary:
          'Tracing where the time goes between a kernel launch in Python and work starting on the GPU, and how much of it WSL2\'s GPU passthrough adds.',
        sources: [],
      },
    ],
  },
  {
    id: 'gateway',
    title: 'Gateway',
    description:
      'NeuroMesh phase 1: a gateway in front of a runtime in front of one real backend. TLS, retries, limits, and what each of them costs on one card.',
    topic: 'serving',
    home: { repo: 'nm', label: 'NeuroMesh phase 1', milestone: 1 },
    posts: [
      {
        title: 'Why the gateway never calls the control plane',
        sources: [{ repo: 'nm', doc: 'docs/adr/0002-control-plane-data-plane-split.md', label: 'ADR-0002' }],
      },
      { title: 'mTLS between gateway and runtime, locally', sources: nm(94, 8) },
      { title: 'Gateway overhead with a stub backend', sources: nm(13) },
      {
        priority: 2,
        id: 'vllm-8gb',
        title: 'vLLM on 8 GB: KV cache dtype, chunked prefill, and where it falls over',
        summary:
          'A 3B model hits the KV-cache wall after a handful of concurrent requests, the same wall an H100 hits much later. I sweep FP16 against FP8 KV cache and chunked prefill on and off, and report p99 time to first token and the batch size where preemption starts.',
        sources: nm(1, 2),
      },
      { title: 'Session affinity vs. KV-cache locality', sources: nm(18) },
      { title: 'Retrying failed inference calls at the gateway', sources: nm(5) },
      {
        priority: 10,
        id: 'serving-70b-rented',
        title: 'Triton vs vLLM vs TensorRT-LLM at 70B',
        summary:
          'The one post that needs a rented 8×H100 node. Same model, same FP8 quantization and the same concurrency sweep on all three servers, compared on goodput at a fixed latency target, with the rental cost stated.',
        sources: nm(1),
        rented: true,
      },
    ],
  },
  {
    id: 'streaming',
    title: 'Streaming',
    description:
      'Phase 2. Keeping a token stream open while the pod under it is drained, and what happens when the client reads slower than the model writes.',
    topic: 'streaming',
    home: { repo: 'nm', label: 'NeuroMesh phase 2', milestone: 2 },
    posts: [
      { title: 'Designing the stream engine and the session manager', sources: nm(24, 25) },
      { title: 'Sticky routing and session migration on drain', sources: nm(29, 30) },
      { title: 'Backpressure before there is a broker', sources: nm(35) },
      { title: 'Streaming benchmarks: time between tokens under load', sources: nm(36) },
    ],
  },
  {
    id: 'event-fabric',
    title: 'Event fabric',
    description: 'Phase 3. Picking a broker, shedding load on purpose during a 5× spike, and replaying what failed.',
    topic: 'platform',
    home: { repo: 'nm', label: 'NeuroMesh phase 3', milestone: 3 },
    posts: [
      { title: 'Kafka or Pulsar', sources: nm(38) },
      { title: 'Load shedding during a 5× spike', sources: nm(42, 46) },
      { title: 'Dead-letter queues and replay', sources: nm(43, 44) },
    ],
  },
  {
    id: 'scheduler',
    title: 'Scheduler',
    description:
      "Phase 4. GPU inventory, placement and autoscaling, designed for many cards and tested on one. MIG needs hardware I'll have to rent.",
    topic: 'orchestration',
    home: { repo: 'nm', label: 'NeuroMesh phase 4', milestone: 4 },
    posts: [
      { title: 'Modelling GPU inventory', sources: nm(48, 49) },
      {
        priority: 6,
        id: 'dra-one-device',
        title: 'DRA on k3s with one device',
        summary:
          'Dynamic Resource Allocation lets a pod ask for a GPU by its properties instead of by count. With a single device the scheduling is trivial, which makes the API and the move off the device plugin easy to see.',
        sources: nm(51),
      },
      { title: 'KV-cache-aware routing', sources: nm(50) },
      {
        priority: 8,
        id: 'kuberay-gang',
        title: 'KubeRay gang scheduling with one GPU and three jobs',
        summary:
          'Three Ray jobs that each want the whole GPU, run with and without gang admission. Partial scale-ups, deadlocks, and the GPU time they waste.',
        sources: [],
      },
      {
        priority: 9,
        id: 'kueue-fair-share',
        title: 'Kueue fair share with one GPU',
        summary:
          'Two tenants, one GPU. Quotas, borrowing and preemption in Kueue, and how long each tenant waits under each policy.',
        sources: [],
      },
      {
        priority: 11,
        id: 'goodput-keda',
        title: 'Goodput SLOs, and scaling on KV-cache utilization with KEDA',
        summary:
          'Autoscaling LLM serving on CPU scales on the wrong thing. I set an SLO on goodput and scale from one replica to two on KV-cache utilization and queue depth instead.',
        sources: nm(57),
      },
      { title: 'MIG support in the scheduler', sources: nm(52), rented: true },
      { title: 'Chaos test: losing the GPU mid-schedule', sources: nm(59) },
    ],
  },
  {
    id: 'observability',
    title: 'Observability and evals',
    description:
      'Phase 5. Traces, prompt lineage, token cost and evals, for failures that show up as wrong answers instead of errors.',
    topic: 'observability',
    home: { repo: 'nm', label: 'NeuroMesh phase 5', milestone: 5 },
    posts: [
      { title: 'The telemetry pipeline', sources: nm(60, 61) },
      { title: 'Prompt lineage, and which prompts not to keep', sources: nm(62, 63) },
      { title: 'Token cost accounting', sources: nm(64) },
      { title: 'What the telemetry costs', sources: nm(71) },
    ],
  },
  {
    id: 'agents',
    title: 'Agents',
    description: 'Phase 6. Durable execution for agents, starting with whether to use Temporal at all.',
    topic: 'agents',
    home: { repo: 'nm', label: 'NeuroMesh phase 6', milestone: 6 },
    posts: [
      { title: 'Temporal vs. our own durable execution', sources: nm(72, 73) },
      { title: 'Retries and compensation for agent steps', sources: nm(75, 76) },
      { title: 'Replaying agent runs', sources: nm(78) },
      { title: 'Chaos test: killing agent runs halfway', sources: nm(81) },
    ],
  },
  {
    id: 'operations',
    title: 'Running it for real',
    description: 'Phase 7. Terraform and Argo CD environments, canaries, SLOs that page someone, and a game day.',
    topic: 'platform',
    home: { repo: 'nm', label: 'NeuroMesh phase 7', milestone: 7 },
    posts: [
      {
        priority: 12,
        id: 'blueprint',
        title: 'The blueprint: Terraform, Argo CD and Backstage',
        summary:
          'The rest of this list, packaged so a new GPU workload can be requested from a template: Terraform modules underneath, Argo CD for the cluster add-ons, and Backstage in front.',
        sources: nm(90),
      },
      { title: 'Canary deploys for models', sources: nm(86) },
      { title: 'SLOs and paging with VMRule', sources: nm(91) },
      { title: 'Game day', sources: nm(93) },
    ],
  },
];

export const flatten = (series: ResolvedSeries[]) => series.flatMap((s) => s.posts.map((p) => ({ ...p, series: s })));

export const byPriority = <T extends PlannedPost>(posts: T[]) =>
  posts.filter((p) => p.priority).sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
