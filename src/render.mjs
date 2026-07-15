export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function layout({ title, gateway, body, backHref = '../../index.html' }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} — RagnaPlace (${escapeHtml(gateway)})</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 780px; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; color: #1a1a1a; background: #fff; }
  a { color: #2563eb; }
  h1 { margin-bottom: 0.2rem; }
  .meta { color: #666; font-size: 0.9rem; margin-bottom: 1.5rem; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  th, td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid #eee; font-size: 0.9rem; }
  th { color: #666; font-weight: 600; }
  .tag { display: inline-block; background: #f0f0f0; border-radius: 4px; padding: 0.1rem 0.5rem; font-size: 0.8rem; margin-right: 0.3rem; }
  .warn { color: #b45309; }
  .back { display: inline-block; margin-bottom: 1rem; }
  img.icon { vertical-align: middle; height: 24px; margin-right: 0.3rem; }
  @media (prefers-color-scheme: dark) {
    body { color: #eee; background: #111; }
    th, td { border-color: #333; }
    .tag { background: #222; }
  }
</style>
</head>
<body>
<a class="back" href="${backHref}">&larr; voltar</a>
${body}
</body>
</html>`;
}

export function renderItemPage(gateway, item) {
  const drops = (item.monsterDrops ?? [])
    .slice()
    .sort((a, b) => (b.chance ?? 0) - (a.chance ?? 0));

  const dropsHtml = drops.length
    ? `<table>
        <tr><th>Monstro</th><th>Lv</th><th>Chance</th><th>Qtd</th><th></th></tr>
        ${drops
          .map(
            (d) => `<tr>
              <td><a href="../../mob/${d.mob.id}/index.html">${escapeHtml(d.mob.name)}</a></td>
              <td>${d.mob.level ?? '?'}</td>
              <td>${d.chance != null ? (d.chance / 100).toFixed(2) + '%' : '?'}</td>
              <td>${d.amount ?? 1}</td>
              <td>${d.isMvpDrop ? '<span class="tag">MVP</span>' : ''}</td>
            </tr>`
          )
          .join('')}
      </table>`
    : '<p>Nenhum monstro conhecido dropa este item.</p>';

  const quests = item.quests ?? [];
  const achievements = item.achievements ?? [];
  const boxes = item.containedIn ?? [];

  const listLinks = (entries) =>
    entries.length
      ? `<ul>${entries.map((e) => `<li>${escapeHtml(e.name)}</li>`).join('')}</ul>`
      : '<p>Nenhum.</p>';

  const warn =
    drops.length === 0 && (quests.length || achievements.length || boxes.length)
      ? '<p class="warn">⚠️ Item não farmável de monstro em mapa aberto — veja quests/achievements/caixas abaixo.</p>'
      : '';

  const body = `
    <h1>${item.image?.item ? `<img class="icon" src="${escapeHtml(item.image.item)}" alt="">` : ''}${escapeHtml(item.name)}</h1>
    <p class="meta">id ${item.id} · ${escapeHtml((item.categories ?? []).join(', ') || 'sem categoria')}</p>
    ${warn}
    <h2>Monstros que dropam</h2>
    ${dropsHtml}
    <h2>Quests que recompensam</h2>
    ${listLinks(quests)}
    <h2>Achievements que recompensam</h2>
    ${listLinks(achievements)}
    <h2>Caixas que contêm</h2>
    ${listLinks(boxes)}
  `;

  return layout({ title: item.name ?? `item ${item.id}`, gateway, body });
}

export function renderMobPage(gateway, mob) {
  const drops = (mob.drops ?? []).slice().sort((a, b) => (b.chance ?? 0) - (a.chance ?? 0));
  const spawns = mob.spawns ?? [];

  const dropsHtml = drops.length
    ? `<table>
        <tr><th>Item</th><th>Chance</th><th>Qtd</th><th></th></tr>
        ${drops
          .map(
            (d) => `<tr>
              <td><a href="../../item/${d.item.id}/index.html">${escapeHtml(d.item.name)}</a></td>
              <td>${d.chance != null ? (d.chance / 100).toFixed(2) + '%' : '?'}</td>
              <td>${d.amount ?? 1}</td>
              <td>${d.isMvpDrop ? '<span class="tag">MVP</span>' : ''}</td>
            </tr>`
          )
          .join('')}
      </table>`
    : '<p>Nenhum drop conhecido.</p>';

  const spawnsHtml = spawns.length
    ? `<table>
        <tr><th>Mapa</th><th>Respawn</th><th>Qtd</th></tr>
        ${spawns
          .map(
            (s) => `<tr>
              <td>${escapeHtml(s.map?.name ?? s.map?.id ?? '?')}</td>
              <td>${s.respawn != null ? s.respawn + 's' : '?'}</td>
              <td>${s.amount ?? '?'}</td>
            </tr>`
          )
          .join('')}
      </table>`
    : '<p>Nenhum spawn em mapa registrado.</p>';

  const body = `
    <h1>${mob.image?.static ? `<img class="icon" src="${escapeHtml(mob.image.static)}" alt="">` : ''}${escapeHtml(mob.name)}</h1>
    <p class="meta">id ${mob.id} · Lv ${mob.level ?? '?'} · ${escapeHtml(mob.race ?? '?')} · ${escapeHtml(mob.element ?? '?')}</p>
    <h2>Drops</h2>
    ${dropsHtml}
    <h2>Spawns</h2>
    ${spawnsHtml}
  `;

  return layout({ title: mob.name ?? `mob ${mob.id}`, gateway, body });
}

export function renderIndexPage(gateway, { items, mobs }) {
  // Embutido inline (em vez de fetch('manifest.json')) porque abrir o HTML
  // direto com file:// bloqueia fetch entre arquivos locais por CORS.
  const manifestJson = JSON.stringify({ items, mobs }).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>RagnaPlace DB (${escapeHtml(gateway)})</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 780px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; background: #fff; }
  input { width: 100%; padding: 0.6rem; font-size: 1rem; box-sizing: border-box; margin-bottom: 1rem; }
  ul { list-style: none; padding: 0; }
  li { padding: 0.3rem 0; }
  a { color: #2563eb; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .tag { color: #666; font-size: 0.8rem; }
  @media (prefers-color-scheme: dark) {
    body { color: #eee; background: #111; }
    input { background: #222; color: #eee; border: 1px solid #444; }
  }
</style>
</head>
<body>
  <h1>RagnaPlace DB — ${escapeHtml(gateway)}</h1>
  <p>${items.length} itens · ${mobs.length} monstros (gerado estaticamente)</p>
  <input id="q" type="search" placeholder="Buscar item ou monstro...">
  <ul id="results"></ul>
  <script>
    const manifest = ${manifestJson};

    const all = [
      ...manifest.items.map(i => ({ ...i, kind: 'item' })),
      ...manifest.mobs.map(m => ({ ...m, kind: 'mob' })),
    ].sort((a, b) => a.name.localeCompare(b.name));

    function escapeHtml(s) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function render(q) {
      const results = document.getElementById('results');
      const filtered = q
        ? all.filter(m => m.name.toLowerCase().includes(q))
        : all;

      results.innerHTML = filtered
        .map(m => '<li><a href="' + m.kind + '/' + m.id + '/index.html">' + escapeHtml(m.name) + '</a> <span class="tag">' + m.kind + '</span></li>')
        .join('');
    }

    render('');

    document.getElementById('q').addEventListener('input', (e) => {
      render(e.target.value.trim().toLowerCase());
    });
  </script>
</body>
</html>`;
}
