import { AREAS } from '../data/areas.js';

const FOCUS_INTRO = {
  fire: '從「消防設計」設置義務入門，認識滅火器、室內消防栓到排煙設備。',
};

export function renderConfirmCard(areaId, progress) {
  const a = AREAS[areaId];
  if (!a) return '';
  const quest = a.quests[0];
  const questDone = progress.questsDone[quest?.id];
  const questDoneCount = questDone ? 1 : 0;
  const questTotal = 3;
  const intro = FOCUS_INTRO[areaId] || a.intro;
  const primaryLawUrl = a.lawAllUrl || a.siteUrl;

  return `
    <header class="focus-card-head">
      <div class="focus-card-title-row">
        <span class="focus-area-icon" aria-hidden="true">${areaIcon(areaId)}</span>
        <h2 id="card-title" class="card-title">${a.buildingName}</h2>
        <button type="button" id="btn-card-close-inline" class="focus-back" data-close-card>× 返回概覽</button>
      </div>
      <p class="card-domain">${a.domain}｜${a.lawName}</p>
    </header>
    <p class="card-intro focus-intro">${intro}</p>
    <div class="focus-pills">
      <span class="pill">本區任務 ${questDoneCount}/${questTotal}</span>
      <span class="pill">教學約 ${a.estMinutes} 分鐘</span>
    </div>
    <div class="card-actions thumb-actions focus-actions">
      <button type="button" class="btn-primary" data-action="lesson" data-area="${areaId}">本站教學／任務</button>
      <button type="button" class="btn-secondary btn-external" data-action="external" data-area="${areaId}">進入法規站</button>
    </div>
    <p class="card-links focus-law-link">
      <a href="${primaryLawUrl}" target="_blank" rel="noopener noreferrer" class="text-link law-link">查看原文（全國法規資料庫） ↗</a>
    </p>
  `;
}

function areaIcon(id) {
  const map = {
    fire: '🚒',
    building: '🏛',
    telecom: '📡',
    accessibility: '♿',
    water: '💧',
    electrical: '⚡',
  };
  return map[id] || '📋';
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
  cardEl.querySelector('[data-close-card]')?.addEventListener('click', () => handlers.close?.());
}
