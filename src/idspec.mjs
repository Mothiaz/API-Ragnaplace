/**
 * Faz parse de uma spec de IDs tipo "501-600,650,700-705" numa lista de
 * inteiros únicos e ordenados. Usado pra pular o /search (limitado a 400
 * resultados) e buscar itens/mobs direto por ID.
 */
export function parseIdSpec(spec) {
  const ids = new Set();

  for (const part of spec.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const from = Number(rangeMatch[1]);
      const to = Number(rangeMatch[2]);
      const [lo, hi] = from <= to ? [from, to] : [to, from];
      for (let id = lo; id <= hi; id++) ids.add(id);
      continue;
    }

    if (/^\d+$/.test(trimmed)) {
      ids.add(Number(trimmed));
      continue;
    }

    throw new Error(`Spec de ID inválida: "${trimmed}" (use números ou faixas tipo 501-600)`);
  }

  return [...ids].sort((a, b) => a - b);
}
