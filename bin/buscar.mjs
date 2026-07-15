#!/usr/bin/env node
import { loadEnv } from '../src/env.mjs';
import { RagnaPlaceClient } from '../src/client.mjs';
import { resolveItem, classifySources } from '../src/sources.mjs';
import { parseArgs } from '../src/args.mjs';

loadEnv();

const { query, flags } = parseArgs(process.argv.slice(2));

if (!query) {
  console.error('Uso: npm run buscar -- "nome do item" [--gateway iro]');
  process.exit(1);
}

const gateway = flags.gateway ?? process.env.RAGNAPLACE_GATEWAY ?? 'iro';
const client = new RagnaPlaceClient({ apiKey: process.env.RAGNAPLACE_API_KEY });

function pct(chance) {
  if (chance == null) return '?%';
  return `${(chance / 100).toFixed(2)}%`;
}

function printMapList(spawns, { limit = 5 } = {}) {
  const shown = spawns.slice(0, limit);
  for (const s of shown) {
    const respawn = s.respawn != null ? `respawn ${s.respawn}s` : 'respawn ?';
    const amount = s.amount != null ? `${s.amount}x no mapa` : '';
    console.log(`      - ${s.map?.name ?? s.map?.id ?? '?'} (${respawn}, ${amount})`);
  }
  if (spawns.length > limit) {
    console.log(`      ... e mais ${spawns.length - limit} mapa(s).`);
  }
}

async function main() {
  console.log(`Buscando "${query}" no gateway "${gateway}"...\n`);

  const { item, alternatives } = await resolveItem(client, gateway, query);

  if (!item) {
    console.log('Nenhum item encontrado com esse nome.');
    return;
  }

  console.log(`=== ${item.name} (id ${item.id}) ===`);
  console.log(item.url);
  if (item.categories?.length) console.log(`Categorias: ${item.categories.join(', ')}`);
  console.log('');

  if (alternatives.length) {
    console.log(
      `(obs: outros resultados também bateram com a busca: ${alternatives
        .slice(0, 5)
        .map((a) => a.name)
        .join(', ')})\n`
    );
  }

  console.log('Consultando fontes de obtenção (drops, quests, achievements)...\n');
  const sources = await classifySources(client, gateway, item);

  if (!sources.hasDirectFarm && (sources.quests.length || sources.achievements.length || sources.boxes.length)) {
    console.log('⚠️  ESTE ITEM NÃO TEM DROP DE MONSTRO FARMÁVEL EM MAPA ABERTO.');
    console.log('    Ele só é obtido via quest, achievement, instância e/ou caixa — veja abaixo.\n');
  }

  if (sources.monsterDrops.length) {
    console.log('--- Monstros que dropam ---');
    const sorted = [...sources.monsterDrops].sort((a, b) => (b.chance ?? 0) - (a.chance ?? 0));
    for (const d of sorted) {
      const mvp = d.isMvpDrop ? ' [DROP DE MVP]' : '';
      console.log(`  • ${d.mob.name} (Lv ${d.mob.level ?? '?'}) — ${pct(d.chance)} x${d.amount ?? 1}${mvp}`);
      if (d.onlyInInstance) {
        console.log('      ⚠️ só encontrado em spawns dentro de INSTÂNCIA:');
        printMapList(d.instanceSpawns);
      } else if (d.noKnownSpawn) {
        console.log('      ⚠️ nenhum spawn em mapa registrado nos dados (verifique manualmente).');
      } else {
        printMapList(d.normalSpawns);
        if (d.instanceSpawns.length) {
          console.log(`      (+ também spawna em ${d.instanceSpawns.length} mapa(s) de instância)`);
        }
      }
    }
    console.log('');
  }

  if (sources.quests.length) {
    console.log('--- Quests que dão o item ---');
    for (const q of sources.quests) {
      const flag = q.requiresInstance ? ' ⚠️ [envolve INSTÂNCIA]' : '';
      console.log(`  • ${q.name}${flag}`);
      if (q.summary) console.log(`      ${q.summary}`);
      console.log(`      ${q.url}`);
    }
    console.log('');
  }

  if (sources.achievements.length) {
    console.log('--- Achievements que recompensam o item ---');
    for (const a of sources.achievements) {
      console.log(`  • ${a.name}`);
      if (a.summary) console.log(`      ${a.summary}`);
      console.log(`      ${a.url}`);
    }
    console.log('');
  }

  if (sources.boxes.length) {
    console.log('--- Caixas/pacotes que contêm o item ---');
    for (const b of sources.boxes) {
      console.log(`  • ${b.name}`);
      console.log(`      ${b.url}`);
    }
    console.log('');
  }

  if (
    !sources.monsterDrops.length &&
    !sources.quests.length &&
    !sources.achievements.length &&
    !sources.boxes.length
  ) {
    console.log('Nenhuma fonte de obtenção conhecida está registrada na API para este item.');
  }
}

main().catch((err) => {
  console.error(`Erro: ${err.message}`);
  process.exit(1);
});
