import { describe, expect, it } from 'vitest';
import { kvBytesPerToken, kvCalc, vramAccount } from './kv';

const llama8b = { size_mb: 4692, layers: 32, kv_heads: 8, head_dim: 128 };

describe('kvBytesPerToken', () => {
  it('is 128 KiB per token for Llama 3.1 8B in FP16', () => {
    expect(kvBytesPerToken(llama8b, 2)).toBe(128 * 1024);
  });
});

describe('vramAccount', () => {
  it('reports no context when the weights do not fit', () => {
    const r = vramAccount({ totalMb: 8151, takenMb: 4000, model: llama8b, workspaceMb: 600 });
    expect(r.fits).toBe(false);
    expect(r.tokens).toBe(0);
  });

  it('turns the space left after workspace into FP16 tokens', () => {
    const r = vramAccount({ totalMb: 8151, takenMb: 1000, model: llama8b, workspaceMb: 600 });
    expect(r.leftMb).toBe(2459);
    expect(r.tokens).toBe(Math.floor((1859 * 1024 * 1024) / (128 * 1024)));
  });
});

describe('kvCalc', () => {
  const base = {
    totalMb: 8151,
    taxMb: 2300,
    model: llama8b,
    dtypeBytes: 2,
    promptTokens: 1024,
    outputTokens: 256,
    workspaceMb: 600,
  };

  it('flags a budget larger than what the desktop leaves free', () => {
    expect(kvCalc({ ...base, concurrency: 1, utilization: 0.9 }).status).toBe('over-free');
  });

  it('halves KV per token with FP8', () => {
    const fp16 = kvCalc({ ...base, concurrency: 1, utilization: 0.7 });
    const fp8 = kvCalc({ ...base, dtypeBytes: 1, concurrency: 1, utilization: 0.7 });
    expect(fp8.perToken).toBe(fp16.perToken / 2);
    expect(fp8.maxSequences).toBeGreaterThanOrEqual(fp16.maxSequences * 2);
  });

  it('reports preemption once needed KV exceeds the pool', () => {
    const r = kvCalc({ ...base, concurrency: 32, utilization: 0.7 });
    expect(r.neededMb).toBeGreaterThan(r.poolMb);
    expect(r.status).toBe('preempt');
  });
});
