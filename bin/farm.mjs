#!/usr/bin/env node
import { loadEnv } from '../src/env.mjs';
import { RagnaPlaceClient } from '../src/client.mjs';
import { resolveItem, classifySources } from '../src/sources.mjs';
import { parseArgs } from '../src/args.mjs';

loadEnv();

const { query, flags } = parseArgs(process.argv.slice(2));

if (!query) {
  console.error('Uso: npm run farm -- "nome do item" [--gateway iro]');
  process.exit(1);
}

const gateway = flags.gateway ?? process.env.RAGNAPLACE_GATEWAY ?? 'iro';
const client = new RagnaPlaceClient({ apiKey: process.env.RAGNAPLACE_API_KEY });

/**
 * Estimativa TEÓRICA (limite superior) de itens/hora: assume que todo spawn
 * é morto assim que nasce. É um número pra RANQUEAR opções entre si, não uma
 * previsão real de farm (mata mais devagar, compete com outros players, etc).
 */
function itemsPerHour({ respawn, amount, chance, dropAmount }) {
  if (!respawn || !amount || chance == null) return null;
  const spawnsPerHour = (amount / respawn) * 3600;
  return spawnsPerHour * (chance / 10000) * (dropAmount ?? 1);
}

function pct(chance) {
  if (chance == null) return '?%';
  return `${(chance / 100).toFixed(2)}%`;
}

async function main() {
  console.log(`Calculando farm de "${query}" no gateway "${gateway}"...\n`);

  const { item } = await resolveItem(client, gateway, query);

  if (!item) {
    console.log('Nenhum item encontrado com esse nome.');
    return;
  }

  console.log(`=== Farm de: ${item.name} (id ${item.id}) ===`);
  console.log(item.url);
  console.log('');

  const sources = await classifySources(client, gateway, item);

  if (!sources.hasDirectFarm) {
    console.log('⚠️  Não há como calcular farm por monstro: este item não tem drop em mapa aberto.');
    if (sources.monsterDrops.some((d) => d.onlyInInstance)) {
      console.log('    Os monstros que dropam ele só aparecem dentro de INSTÂNCIA (veja "ragna-buscar" para detalhes).');
    }
    if (sources.quests.length) {
      console.log(`    Fontes alternativas: quest(s) — ${sources.quests.map((q) => q.name).join(', ')}`);
    }
    if (sources.achievements.length) {
      console.log(`    Fontes alternativas: achievement(s) — ${sources.achievements.map((a) => a.name).join(', ')}`);
    }
    if (sources.boxes.length) {
      console.log(`    Fontes alternativas: caixa(s) — ${sources.boxes.map((b) => b.name).join(', ')}`);
    }
    console.log('\n    Rode "npm run buscar -- \\"' + query + '\\"" pra ver os detalhes completos dessas fontes.');
    return;
  }

  const rows = [];
  const instanceRows = [];

  for (const drop of sources.monsterDrops) {
    for (const spawn of drop.normalSpawns) {
      const rate = itemsPerHour({
        respawn: spawn.respawn,
        amount: spawn.amount,
        chance: drop.chance,
        dropAmount: drop.amount,
      });
      rows.push({
        map: spawn.map?.name ?? spawn.map?.id ?? '?',
        mob: drop.mob.name,
        level: drop.mob.level,
        chance: drop.chance,
        isMvpDrop: drop.isMvpDrop,
        respawn: spawn.respawn,
        spawnAmount: spawn.amount,
        rate,
      });
    }
    for (const spawn of drop.instanceSpawns) {
      const rate = itemsPerHour({
        respawn: spawn.respawn,
        amount: spawn.amount,
        chance: drop.chance,
        dropAmount: drop.amount,
      });
      instanceRows.push({
        map: spawn.map?.name ?? spawn.map?.id ?? '?',
        mob: drop.mob.name,
        chance: drop.chance,
        rate,
      });
    }
  }

  rows.sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));

  console.log('--- Melhores mapas pra farmar (mapa aberto, ranqueado por estimativa teórica) ---');
  console.log('    (assume matar 100% dos spawns instantaneamente — use como comparação relativa, não previsão real)\n');

  for (const r of rows) {
    const mvp = r.isMvpDrop ? ' [MVP]' : '';
    const rateStr = r.rate != null ? `${r.rate.toFixed(2)} itens/h (teórico)` : 'sem dados suficientes';
    console.log(
      `  • ${r.map} — ${r.mob} (Lv ${r.level ?? '?'})${mvp}: ${pct(r.chance)} de drop, respawn ${r.respawn}s x${r.spawnAmount} → ${rateStr}`
    );
  }

  if (instanceRows.length) {
    console.log('\n--- Também disponível dentro de instância (não contabilizado acima) ---');
    for (const r of instanceRows) {
      const rateStr = r.rate != null ? `${r.rate.toFixed(2)} itens/h (teórico, dentro da instância)` : 'sem dados suficientes';
      console.log(`  • ${r.map} — ${r.mob}: ${pct(r.chance)} de drop → ${rateStr}`);
    }
  }

  const noSpawnMobs = sources.monsterDrops.filter((d) => d.noKnownSpawn);
  if (noSpawnMobs.length) {
    console.log('\n--- Monstros sem spawn conhecido nos dados (não entraram no ranking) ---');
    for (const d of noSpawnMobs) {
      console.log(`  • ${d.mob.name} — ${pct(d.chance)} de drop`);
    }
  }
}

main().catch((err) => {
  console.error(`Erro: ${err.message}`);
  process.exit(1);
});
