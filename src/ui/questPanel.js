import { PARK_QUESTS, countCompletedQuests, isQuestDone, questProgressLabel } from '../data/parkQuests.js';

const TOTAL = 6;

export function renderQuestPanel(panelEl, progress) {
  const done = countCompletedQuests(progress);
  panelEl.innerHTML = `
    <div class="quest-sheet">
      <header class="quest-sheet-head">
        <h2 id="quest-title">園區任務</h2>
        <span class="quest-count">${done} / ${TOTAL} 完成</span>
        <button type="button" id="btn-quest-close" class="quest-close" aria-label="關閉">×</button>
      </header>
      <div class="quest-progress" role="progressbar" aria-valuenow="${done}" aria-valuemin="0" aria-valuemax="${TOTAL}">
        <div class="quest-progress-fill" style="width: ${(done / TOTAL) * 100}%"></div>
      </div>
      <p class="quest-note">任務只解鎖裝飾與徽章；所有領域導讀與完整法規連結隨時都能看。</p>
      <ul class="quest-rows">
        ${PARK_QUESTS.map((q) => {
          const complete = isQuestDone(q, progress);
          const title = q.areaShort ? `${q.areaShort}｜${q.title}` : q.title;
          return `
            <li class="quest-row ${complete ? 'done' : ''}">
              <span class="quest-status" aria-hidden="true">${complete ? '✓' : ''}</span>
              <div class="quest-copy">
                <strong>${title}</strong>
                <p>${q.desc}</p>
              </div>
              <span class="quest-unlock">${questProgressLabel(q, progress)}</span>
            </li>
          `;
        }).join('')}
      </ul>
    </div>
  `;
}
