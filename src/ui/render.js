import { AREAS, AREA_ORDER, SOURCE_NOTE } from '../data/areas.js';
import { QUESTS, ACHIEVEMENTS, INTRO_QUESTS } from '../data/quests.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** 主要法規原文連結：全國法規資料庫全文頁；非法務部收錄者改連原站 */
export function lawLink(area) {
  const law = area.laws.find((l) => l.url);
  return law ? { href: law.url, label: '查看原文（全國法規資料庫）' } : { href: area.siteUrl, label: '查看原文（原站）' };
}

/** 出處列（藍圖 §4.3）：法規名稱、條號、標題、修正日、原站、全國法規資料庫 */
export function sourceRow(c) {
  const moj = c.moj
    ? `<a href="${esc(c.moj)}" target="_blank" rel="noopener">全國法規資料庫 ↗</a>`
    : '<span class="muted">本規範未收錄於全國法規資料庫，原文見原站</span>';
  return `<footer class="source">
    <dl>
      <div><dt>法規</dt><dd>${esc(c.law)}</dd></div>
      <div><dt>條號</dt><dd>${esc(c.article)}</dd></div>
      <div><dt>標題</dt><dd>${esc(c.title)}</dd></div>
      <div><dt>修正日</dt><dd>${esc(c.amended)}</dd></div>
    </dl>
    <p class="source-links"><a href="${esc(c.site)}" target="_blank" rel="noopener">原站 ↗</a>${moj}</p>
    <p class="source-note">${SOURCE_NOTE}</p>
  </footer>`;
}

/** 確認卡片（藍圖 §3.1） */
export function confirmCard(id, progress) {
  const a = AREAS[id];
  const { done, total } = progress.areaCount(id);
  const link = lawLink(a);
  return `
    <header class="card-head">
      <h2 id="card-title"><span class="card-icon" aria-hidden="true">${a.icon}</span>${esc(a.name)}</h2>
      <button type="button" class="link-btn close-btn" data-act="close" aria-label="返回概覽">✕ 返回概覽</button>
    </header>
    <p class="card-law">${esc(a.domain)}｜${a.laws.map((l) => esc(l.name)).join('、')}</p>
    <p class="card-intro">${esc(a.intro)}</p>
    <ul class="chips">
      <li>本區任務 ${done}/${total}</li>
      <li>教學約 ${a.minutes} 分鐘</li>
    </ul>
    <div class="card-actions">
      <button type="button" class="btn solid" data-act="lesson">本站教學／任務</button>
      <a class="btn outlined" href="${esc(a.siteUrl)}" target="_blank" rel="noopener" data-act="site">進入法規站 ↗</a>
    </div>
    <p class="card-source"><a href="${esc(link.href)}" target="_blank" rel="noopener">${link.label} ↗</a></p>`;
}

/** 列表檢視：六張大卡片（WebGL 不支援、載入逾 8 秒或使用者切換時） */
export function listCards(progress, thumbs = {}) {
  return AREA_ORDER.map((id) => {
    const a = AREAS[id];
    const { done, total } = progress.areaCount(id);
    const thumb = thumbs[id] ? `<img src="${thumbs[id]}" alt="" width="160" height="160" />` : `<span class="list-icon" aria-hidden="true">${a.icon}</span>`;
    return `<article class="list-card" data-area="${id}">
      <div class="list-thumb">${thumb}</div>
      <div class="list-body">
        <h3>${esc(a.name)}</h3>
        <p class="muted">${a.laws.map((l) => esc(l.name)).join('、')}</p>
        <p>${esc(a.intro)}</p>
        <p class="chips-inline">任務 ${done}/${total}・教學約 ${a.minutes} 分鐘</p>
        <div class="card-actions">
          <button type="button" class="btn solid" data-lesson="${id}">本站教學</button>
          <a class="btn outlined" href="${esc(a.siteUrl)}" target="_blank" rel="noopener">進入法規站 ↗</a>
        </div>
      </div>
    </article>`;
  }).join('');
}

/** 任務面板：每則任務對應真實條號或章節（藍圖 §4.4） */
export function questPanel(progress) {
  const ach = progress.achievements();
  const passCount = INTRO_QUESTS.filter((q) => progress.isDone(q)).length;
  const groups = AREA_ORDER.map((id) => {
    const a = AREAS[id];
    const items = QUESTS.filter((q) => q.area === id)
      .map((q) => {
        const card = a.cards.find((c) => c.id === q.id);
        const done = progress.isDone(q.id);
        return `<li class="quest ${done ? 'done' : ''}">
          <button type="button" data-quest="${q.id}">
            <span class="q-id">${q.id}</span>
            <span class="q-main"><strong>${esc(q.title)}</strong><small>${esc(card.cite.article)}</small></span>
            <span class="q-state">${done ? '✓ ' + esc(q.reward) : '解鎖：' + esc(q.reward)}</span>
          </button>
        </li>`;
      })
      .join('');
    return `<section class="quest-group"><h3>${a.icon} ${esc(a.name)}</h3><ul>${items}</ul></section>`;
  }).join('');
  const achList = ACHIEVEMENTS.map(
    (x) => `<li class="${ach.has(x.id) ? 'done' : ''}"><strong>${esc(x.title)}</strong><span>${esc(x.rule)}</span><em>${ach.has(x.id) ? '✓ ' : ''}${esc(x.reward)}</em></li>`
  ).join('');
  return `
    <header class="sheet-head">
      <h2>任務 ${progress.doneCount}/${QUESTS.length}</h2>
      <button type="button" class="link-btn close-btn" data-act="close" aria-label="關閉任務面板">✕ 關閉</button>
    </header>
    <p class="muted">任務只解鎖園區裝飾；所有導讀卡、法規站與原文從第一秒都能使用。</p>
    <div class="pass-meter" role="progressbar" aria-valuemin="0" aria-valuemax="6" aria-valuenow="${passCount}" aria-label="法規通進度">
      <span style="width:${(passCount / 6) * 100}%"></span><b>法規通 ${passCount}/6</b>
    </div>
    ${ach.has('lawPass') ? '<button type="button" class="btn solid wide" data-act="cert">查看法規通證書</button>' : ''}
    <section class="quest-group"><h3>跨區成就</h3><ul class="ach">${achList}</ul></section>
    ${groups}`;
}

export function certificate(progress) {
  const date = Object.entries(progress.state.done)
    .filter(([k]) => INTRO_QUESTS.includes(k))
    .map(([, v]) => v)
    .sort()
    .pop();
  const d = date ? new Date(date) : new Date();
  const when = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
  return `<div class="cert" role="document">
      <div class="cert-mark" aria-hidden="true"></div>
      <p class="cert-org">Tysic工程資訊部｜法規園區</p>
      <h2 id="cert-title">法規通</h2>
      <p>已完成六個法規領域的第一則任務</p>
      <ul class="cert-areas">${AREA_ORDER.map((id) => `<li>✓ ${esc(AREAS[id].name)}</li>`).join('')}</ul>
      <p class="muted">${when}</p>
      <div class="card-actions">
        <button type="button" class="btn outlined" data-act="print">列印</button>
        <button type="button" class="btn solid" data-act="close">回到園區</button>
      </div>
    </div>`;
}
