# API-Ragnaplace

Ferramentas de linha de comando sobre a [RagnaPlace Public API](https://ragnaplace.com/api):
buscador de fontes de item, calculadora de eficiência de farm e exportador de
site estático (item + monstro).

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

## Site estático (item + monstro)

Gera um mini-site HTML puro (sem servidor, sem framework) com uma página por
item e por monstro, mais um índice com busca client-side. Pensado pra
hospedar de graça (GitHub Pages, Netlify) sem gastar rate limit em cada
visita — os requests só acontecem uma vez, no momento da geração.

```bash
npm run gerar-site
npm run gerar-site -- --gateway kro --out dist
```

**Limite importante:** o endpoint `/search` da API retorna no máximo 400
resultados por tipo (20 páginas × 20/página), então o site gerado cobre os
primeiros ~400 itens e ~400 monstros do gateway — não o catálogo completo.
Cada item/monstro custa 1 request (sem chamadas extras em cascata), então o
teto de 400 req/60s é tranquilo mesmo pro conjunto inteiro.

O resultado fica em `dist/<gateway>/`: abra `dist/<gateway>/index.html` no
navegador pra testar localmente, ou suba a pasta inteira num host estático.

## Rate limit

O cliente (`src/client.mjs`) limita a 380 requests/60s por padrão (a chave
tem limite de 400/60s) e respeita o header `Retry-After` em respostas `429`.
Buscas por item que envolvem vários monstros/quests fazem uma request extra
por entidade para checar spawns/instância — itens muito populares podem
demorar alguns segundos.
