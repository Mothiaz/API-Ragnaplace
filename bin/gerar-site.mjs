#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadEnv } from '../src/env.mjs';
import { RagnaPlaceClient } from '../src/client.mjs';
import { parseArgs } from '../src/args.mjs';
import { parseIdSpec } from '../src/idspec.mjs';
import { itemDisplayName } from '../src/sources.mjs';
import { renderItemPage, renderMobPage, renderIndexPage } from '../src/render.mjs';

loadEnv();

const { flags } = parseArgs(process.argv.slice(2));
const gateway = flags.gateway ?? process.env.RAGNAPLACE_GATEWAY ?? 'iro';
const outDir = flags.out ?? 'dist';

const client = new RagnaPlaceClient({ apiKey: process.env.RAGNAPLACE_API_KEY });

/**
 * Junta todas as páginas de /search pro tipo dado. A API limita a no máximo
 * 20 páginas x 20/página = 400 resultados por busca — esse é o teto real
 * do que dá pra puxar sem uma query (`q`) mais específica.
 */
async function collectAllRefs(type) {
  const refs = [];
  let page = 1;
  while (page <= 20) {
    const result = await client.search(gateway, { type, page, limit: 20, order: 'id', dir: 'asc' });
    const items = result.items ?? [];
    refs.push(...items);
    if (items.length < 20 || page >= (result.pages ?? 1)) break;
    page++;
  }
  return refs;
}

/**
 * Baixa item/mob por uma lista explícita de IDs, em vez do /search (que
 * limita a 400 resultados). IDs que não existem (404) são pulados, sem
 * derrubar o processo — é esperado ter buracos numa faixa sequencial.
 */
async function fetchByIds(kind, ids) {
  const results = [];
  const skipped = [];

  for (const [i, id] of ids.entries()) {
    try {
      const detail = kind === 'item' ? await client.item(gateway, id) : await client.mob(gateway, id);
      results.push(detail);
    } catch (err) {
      if (err.status === 404) {
        skipped.push(id);
      } else {
        console.error(`  [aviso] falhou ${kind} ${id}: ${err.message}`);
      }
    }
    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${ids.length} (${kind})`);
  }

  if (skipped.length) {
    console.log(`  ${skipped.length} id(s) de ${kind} não existiam (pulados): ${skipped.slice(0, 20).join(', ')}${skipped.length > 20 ? '...' : ''}`);
  }

  return results;
}

async function main() {
  console.log(`Gerando site estático pro gateway "${gateway}"...\n`);

  const itemDir = join(outDir, gateway, 'item');
  const mobDir = join(outDir, gateway, 'mob');
  await mkdir(itemDir, { recursive: true });
  await mkdir(mobDir, { recursive: true });

  const itemManifest = [];
  const mobManifest = [];

  if (flags.items) {
    const itemIds = parseIdSpec(String(flags.items));
    console.log(`Baixando ${itemIds.length} item(ns) por ID (${flags.items})...`);
    const items = await fetchByIds('item', itemIds);
    for (const item of items) {
      const dir = join(itemDir, String(item.id));
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'index.html'), renderItemPage(gateway, item));
      itemManifest.push({ id: item.id, name: itemDisplayName(item) });
    }
  } else {
    console.log('Listando itens via /search...');
    const itemRefs = await collectAllRefs('item');
    console.log(`  ${itemRefs.length} itens encontrados (teto da API: 400; use --items=501-30000 pra ir além).`);
    for (const [i, ref] of itemRefs.entries()) {
      const item = await client.item(gateway, ref.id);
      const dir = join(itemDir, String(item.id));
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'index.html'), renderItemPage(gateway, item));
      itemManifest.push({ id: item.id, name: itemDisplayName(item) });
      if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${itemRefs.length}`);
    }
  }

  if (flags.mobs) {
    const mobIds = parseIdSpec(String(flags.mobs));
    console.log(`Baixando ${mobIds.length} mob(s) por ID (${flags.mobs})...`);
    const mobs = await fetchByIds('mob', mobIds);
    for (const mob of mobs) {
      const dir = join(mobDir, String(mob.id));
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'index.html'), renderMobPage(gateway, mob));
      mobManifest.push({ id: mob.id, name: mob.name ?? String(mob.id) });
    }
  } else {
    console.log('Listando monstros via /search...');
    const mobRefs = await collectAllRefs('mob');
    console.log(`  ${mobRefs.length} monstros encontrados (teto da API: 400; use --mobs=1001-3000 pra ir além).`);
    for (const [i, ref] of mobRefs.entries()) {
      const mob = await client.mob(gateway, ref.id);
      const dir = join(mobDir, String(mob.id));
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'index.html'), renderMobPage(gateway, mob));
      mobManifest.push({ id: mob.id, name: mob.name ?? ref.name ?? String(mob.id) });
      if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${mobRefs.length}`);
    }
  }

  const gatewayDir = join(outDir, gateway);
  await writeFile(
    join(gatewayDir, 'manifest.json'),
    JSON.stringify({ items: itemManifest, mobs: mobManifest })
  );
  await writeFile(
    join(gatewayDir, 'index.html'),
    renderIndexPage(gateway, { items: itemManifest, mobs: mobManifest })
  );

  console.log(`\nPronto! Site gerado em ${gatewayDir}/`);
  console.log(`Abra ${join(gatewayDir, 'index.html')} no navegador (ou suba a pasta num host estático).`);
}

main().catch((err) => {
  console.error(`Erro: ${err.message}`);
  process.exit(1);
});
