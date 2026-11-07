import { AREAS } from '../data/areas.js';
import { renderSourceFooter } from './sourceFooter.js';
import { completeQuest } from '../state/storage.js';

export function openLessonSheet(sheetEl, areaId, progress, onProgress) {
  const area = AREAS[areaId];
  if (!area) return;
  const quest = area.quests[0];
  const questDone = progress.questsDone[quest?.id];

  const highlights = area.highlights
    .map(
      (h) => `
      <article class="lesson-card">
        <h4>${h.title}</h4>
        <p>${h.body}</p>
        ${h.quote ? `<blockquote>「${h.quote}」</blockquote>` : ''}
        ${renderSourceFooter(areaId, h)}
      </article>
    `
    )
    .join('');

  const quizHtml = quest
    ? `
    <section class="quiz-block" data-quest="${quest.id}" data-area="${areaId}">
      <h4>小測驗：${quest.title}</h4>
      <p>${quest.desc}</p>
      <div class="quiz-options">
        ${quest.options
          .map(
            (opt, i) =>
              `<button type="button" class="quiz-opt" data-i="${i}" ${questDone ? 'disabled' : ''}>${opt}</button>`
          )
          .join('')}
      </div>
      <p class="quiz-feedback hidden" role="status"></p>
      ${renderSourceFooter(areaId, quest.ref || {})}
    </section>
  `
    : '';

  sheetEl.innerHTML = `
    <div class="lesson-inner">
      <button type="button" class="card-close lesson-close" aria-label="關閉教學">✕</button>
      <h3 id="lesson-heading">${area.buildingName}｜本站教學</h3>
      <p class="lesson-overview">${area.categoriesSummary}</p>
      ${highlights}
      ${quizHtml}
    </div>
  `;
  sheetEl.classList.remove('hidden');

  sheetEl.querySelector('.lesson-close')?.addEventListener('click', () => {
    sheetEl.classList.add('hidden');
  });

  const feedback = sheetEl.querySelector('.quiz-feedback');
  sheetEl.querySelectorAll('.quiz-opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (questDone) return;
      const i = Number(btn.dataset.i);
      if (i === quest.answer) {
        feedback.textContent = '答對了！已解鎖本區裝飾。';
        feedback.classList.remove('hidden');
        feedback.classList.remove('error');
        completeQuest(progress, quest.id, quest.unlock);
        onProgress?.();
        sheetEl.querySelectorAll('.quiz-opt').forEach((b) => {
          b.disabled = true;
        });
      } else {
        feedback.textContent = `再試一次。提示：${quest.hint}`;
        feedback.classList.add('error');
        feedback.classList.remove('hidden');
      }
    });
  });
}
