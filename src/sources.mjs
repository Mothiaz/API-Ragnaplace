const CATEGORY_INSTANCE_HINTS = ['instance', 'instância', 'instancia', 'dungeon'];

/**
 * Mapas de instância no RO seguem o padrão "<numero>@<nome>" (ex: "1@abyss").
 * É o sinal mais confiável disponível nos dados pra saber se um spawn/NPC
 * está dentro de uma instância em vez de um mapa aberto normal.
 */
export function isInstanceMap(mapId) {
  return typeof mapId === 'string' && /^\d+@/.test(mapId);
}

function looksLikeInstance(...tagLists) {
  return tagLists
    .flat()
    .filter(Boolean)
    .some((tag) => CATEGORY_INSTANCE_HINTS.some((hint) => tag.toLowerCase().includes(hint)));
}

/**
 * Busca o item pelo nome e resolve pro id mais provável.
 * Retorna { item, alternatives } onde alternatives são outros resultados da busca.
 */
export async function resolveItem(client, gateway, query) {
  const result = await client.search(gateway, { type: 'item', q: query, limit: 10 });
  const candidates = result.items ?? [];

  if (candidates.length === 0) {
    return { item: null, alternatives: [] };
  }

  const exact = candidates.find((c) => c.name?.toLowerCase() === query.toLowerCase());
  const chosen = exact ?? candidates[0];
  const item = await client.item(gateway, chosen.id);

  return {
    item,
    alternatives: candidates.filter((c) => c.id !== chosen.id),
  };
}

/**
 * Enriquece um monsterDrop com os spawns reais do monstro (mapa, respawn,
 * quantidade), separando spawns em mapa normal vs. spawns só-em-instância.
 */
async function enrichMonsterDrop(client, gateway, drop) {
  let mobDetail = null;
  try {
    mobDetail = await client.mob(gateway, drop.mob.id);
  } catch (err) {
    console.error(`  [aviso] não foi possível carregar detalhes de ${drop.mob.name}: ${err.message}`);
  }

  const spawns = mobDetail?.spawns ?? [];
  const normalSpawns = spawns.filter((s) => !isInstanceMap(s.map?.id));
  const instanceSpawns = spawns.filter((s) => isInstanceMap(s.map?.id));

  return {
    ...drop,
    spawns,
    normalSpawns,
    instanceSpawns,
    onlyInInstance: spawns.length > 0 && normalSpawns.length === 0,
    noKnownSpawn: spawns.length === 0,
  };
}

async function enrichQuest(client, gateway, questRef) {
  let detail = null;
  try {
    detail = await client.quest(gateway, questRef.id);
  } catch (err) {
    console.error(`  [aviso] não foi possível carregar detalhes da quest ${questRef.name}: ${err.message}`);
  }

  const requiresInstance =
    isInstanceMap(detail?.npcMapId) || looksLikeInstance(detail?.categories, detail?.subcategories);

  return {
    ...questRef,
    npcMapId: detail?.npcMapId ?? null,
    summary: detail?.summary ?? null,
    requiresInstance,
  };
}

async function enrichAchievement(client, gateway, achievementRef) {
  let detail = null;
  try {
    detail = await client.achievement(gateway, achievementRef.id);
  } catch (err) {
    console.error(
      `  [aviso] não foi possível carregar detalhes da conquista ${achievementRef.name}: ${err.message}`
    );
  }

  return {
    ...achievementRef,
    summary: detail?.summary ?? null,
  };
}

/**
 * Classifica e enriquece todas as fontes de obtenção conhecidas de um item.
 * Faz chamadas extras à API (mob/quest/achievement) pra poder sinalizar
 * corretamente instâncias — por isso é assíncrona e custa requests.
 */
export async function classifySources(client, gateway, item) {
  const monsterDrops = [];
  for (const drop of item.monsterDrops ?? []) {
    monsterDrops.push(await enrichMonsterDrop(client, gateway, drop));
  }

  const quests = [];
  for (const q of item.quests ?? []) {
    quests.push(await enrichQuest(client, gateway, q));
  }

  const achievements = [];
  for (const a of item.achievements ?? []) {
    achievements.push(await enrichAchievement(client, gateway, a));
  }

  const boxes = item.containedIn ?? [];

  return {
    monsterDrops,
    quests,
    achievements,
    boxes,
    hasDirectFarm: monsterDrops.some((d) => !d.onlyInInstance && !d.noKnownSpawn),
  };
}
