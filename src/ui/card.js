import { AREAS } from '../data/areas.js';
import { renderSourceFooter } from './sourceFooter.js';

export function renderConfirmCard(areaId, progress) {
  const a = AREAS[areaId];
  if (!a) return '';
  const quest = a.quests[0];
  const done = progress.questsDone[quest?.id];
  const questLabel = done ? '已完成本區任務' : `任務：${quest?.title || '進行中'}`;
  const primaryLawUrl = a.lawAllUrl || a.siteUrl;
  return `
    <h2 id="card-title" class="card-title">${a.buildingName}</h2>
    <p class="card-domain">${a.domain}｜${a.lawName}</p>
    <p class="card-intro">${a.intro}</p>
    <p class="card-progress">${questLabel} · 預估 ${a.estMinutes} 分鐘</p>
    <div class="card-actions thumb-actions">
      <button type="button" class="btn-primary" data-action="lesson" data-area="${areaId}">本站教學／任務</button>
      <button type="button" class="btn-secondary" data-action="external" data-area="${areaId}">進入法規站 ↗</button>
    </div>
    <p class="card-links">
      <a href="${primaryLawUrl}" target="_blank" rel="noopener noreferrer" data-action="law">查看原文</a>
    </p>
    ${renderSourceFooter(areaId, { title: a.lawName, article: a.pcode ? `pcode ${a.pcode}` : '依該站分類' })}
  `;
}

export function bindCardActions(cardEl, handlers) {
  cardEl.querySelectorAll('[data-action]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const action = el.dataset.action;
      const area = el.dataset.area;
      if (action === 'external') {
        e.preventDefault();
        handlers.external(area);
      } else if (action === 'lesson') {
        e.preventDefault();
        handlers.lesson(area);
      }
    });
  });
}
