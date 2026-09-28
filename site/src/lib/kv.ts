// Memory arithmetic shared by the widgets. All sizes in MiB.

interface ModelShape {
  size_mb: number;
  layers: number;
  kv_heads: number;
  head_dim: number;
}

/** Reads the attributes getModels() put on an <option>. */
export const modelFromOption = (o: HTMLOptionElement): ModelShape => ({
  size_mb: Number(o.dataset.size),
  layers: Number(o.dataset.layers),
  kv_heads: Number(o.dataset.kvHeads),
  head_dim: Number(o.dataset.headDim),
});

const MiB = 1024 * 1024;

/** K and V, per layer, per KV head, per head dimension. */
export const kvBytesPerToken = (m: ModelShape, dtypeBytes: number) => 2 * m.layers * m.kv_heads * m.head_dim * dtypeBytes;

export function vramAccount(input: { totalMb: number; takenMb: number; model: ModelShape; workspaceMb: number }) {
  const { totalMb, takenMb, model, workspaceMb } = input;
  const leftMb = totalMb - takenMb - model.size_mb;
  const kvMb = leftMb - workspaceMb;
  const tokens = kvMb > 0 ? Math.floor((kvMb * MiB) / kvBytesPerToken(model, 2)) : 0;
  return { leftMb, tokens, fits: leftMb >= 0 };
}

export type KvStatus = 'over-free' | 'no-room' | 'preempt' | 'tight' | 'ok';

export function kvCalc(input: {
  totalMb: number;
  taxMb: number;
  model: ModelShape;
  dtypeBytes: number;
  concurrency: number;
  promptTokens: number;
  outputTokens: number;
  utilization: number;
  workspaceMb: number;
}) {
  const { totalMb, taxMb, model, dtypeBytes, concurrency, promptTokens, outputTokens, utilization, workspaceMb } = input;
  const budgetMb = totalMb * utilization;
  const freeMb = totalMb - taxMb;
  const poolMb = budgetMb - model.size_mb - workspaceMb;
  const perToken = kvBytesPerToken(model, dtypeBytes);
  const seqTokens = promptTokens + outputTokens;
  const neededMb = (concurrency * seqTokens * perToken) / MiB;
  const maxSequences = poolMb > 0 ? Math.floor((poolMb * MiB) / (seqTokens * perToken)) : 0;
  const status: KvStatus =
    budgetMb > freeMb ? 'over-free' : poolMb <= 0 ? 'no-room' : neededMb > poolMb ? 'preempt' : neededMb > 0.85 * poolMb ? 'tight' : 'ok';
  return { budgetMb, freeMb, poolMb, perToken, neededMb, maxSequences, status };
}
