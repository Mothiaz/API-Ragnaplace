#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadEnv } from '../src/env.mjs';
import { RagnaPlaceClient } from '../src/client.mjs';
import { parseArgs } from '../src/args.mjs';
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

async function main() {
  console.log(`Gerando site estático pro gateway "${gateway}"...\n`);

  console.log('Listando itens...');
  const itemRefs = await collectAllRefs('item');
  console.log(`  ${itemRefs.length} itens encontrados (teto da API: 400).`);

  console.log('Listando monstros...');
  const mobRefs = await collectAllRefs('mob');
  console.log(`  ${mobRefs.length} monstros encontrados (teto da API: 400).\n`);

  const itemDir = join(outDir, gateway, 'item');
  const mobDir = join(outDir, gateway, 'mob');
  await mkdir(itemDir, { recursive: true });
  await mkdir(mobDir, { recursive: true });

  const itemManifest = [];
  console.log('Baixando detalhes dos itens...');
  for (const [i, ref] of itemRefs.entries()) {
    const item = await client.item(gateway, ref.id);
    const dir = join(itemDir, String(item.id));
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'index.html'), renderItemPage(gateway, item));
    itemManifest.push({ id: item.id, name: item.name ?? ref.name ?? String(item.id) });
    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${itemRefs.length}`);
  }

  const mobManifest = [];
  console.log('Baixando detalhes dos monstros...');
  for (const [i, ref] of mobRefs.entries()) {
    const mob = await client.mob(gateway, ref.id);
    const dir = join(mobDir, String(mob.id));
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'index.html'), renderMobPage(gateway, mob));
    mobManifest.push({ id: mob.id, name: mob.name ?? ref.name ?? String(mob.id) });
    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${mobRefs.length}`);
  }

  const gatewayDir = join(outDir, gateway);
  await writeFile(
    join(gatewayDir, 'manifest.json'),
    JSON.stringify({ items: itemManifest, mobs: mobManifest })
  );
  await writeFile(
    join(gatewayDir, 'index.html'),
    renderIndexPage(gateway, { itemCount: itemManifest.length, mobCount: mobManifest.length })
  );

  console.log(`\nPronto! Site gerado em ${gatewayDir}/`);
  console.log(`Abra ${join(gatewayDir, 'index.html')} no navegador (ou suba a pasta num host estático).`);
}

main().catch((err) => {
  console.error(`Erro: ${err.message}`);
  process.exit(1);
});
