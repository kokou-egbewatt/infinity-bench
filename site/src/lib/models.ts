import { getCollection } from 'astro:content';

/**
 * Models from models.yaml for one runtime, smallest first, with the data- attributes the widget
 * scripts read. Throws when `selected` is not one of them.
 */
export async function getModels(runtime: 'llama.cpp' | 'vllm', selected: string, who: string) {
  const models = (await getCollection('models'))
    .filter((m) => m.data.runtime === runtime)
    .sort((a, b) => a.data.size_mb - b.data.size_mb)
    .map(({ id, data: m }) => ({
      id,
      label: `${m.name} ${m.quantization}`,
      size_mb: m.size_mb,
      selected: id === selected,
      attrs: { 'data-size': m.size_mb, 'data-layers': m.layers, 'data-kv-heads': m.kv_heads, 'data-head-dim': m.head_dim },
    }));
  if (!models.some((m) => m.selected)) throw new Error(`${who}: model ${selected} is not a ${runtime} model in models.yaml`);
  return models;
}
