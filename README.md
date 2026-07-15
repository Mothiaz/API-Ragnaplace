# API-Ragnaplace

Ferramentas de linha de comando sobre a [RagnaPlace Public API](https://ragnaplace.com/api):
buscador de fontes de item e calculadora de eficiência de farm.

## Setup

1. `cp .env.example .env`
2. Preencha `RAGNAPLACE_API_KEY` no `.env` com sua chave (`rpk_...`).
3. Ajuste `RAGNAPLACE_GATEWAY` se não for jogar no `iro` (veja gateways disponíveis em `/v1/gateways`).

Requer Node.js 18+ (usa `fetch` nativo, sem dependências).

## Buscador

Mostra todas as fontes de obtenção conhecidas de um item: monstros que dropam
(com mapa e respawn), quests, achievements e caixas — sinalizando quando a
fonte envolve **instância** (mapas no padrão `1@nome`) em vez de farm livre.

```bash
npm run buscar -- "Old Card Album"
npm run buscar -- "Old Card Album" --gateway kro
```

## Calculadora de farm

Ranqueia mapa+monstro pela estimativa teórica de itens/hora
(`spawns/hora × chance de drop × quantidade`). É um limite superior — assume
que você mata cada spawn assim que ele nasce — útil pra **comparar** opções,
não como previsão exata.

Se o item só existir via quest/achievement/instância/caixa, a ferramenta avisa
isso em vez de inventar um número de farm.

```bash
npm run farm -- "Old Card Album"
```

## Rate limit

O cliente (`src/client.mjs`) limita a 380 requests/60s por padrão (a chave
tem limite de 400/60s) e respeita o header `Retry-After` em respostas `429`.
Buscas por item que envolvem vários monstros/quests fazem uma request extra
por entidade para checar spawns/instância — itens muito populares podem
demorar alguns segundos.
