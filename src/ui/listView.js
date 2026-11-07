import { AREAS, AREA_IDS } from '../data/areas.js';

export function renderListCards(container) {
  container.innerHTML = AREA_IDS.map((id) => {
    const a = AREAS[id];
    const lawLink = a.lawAllUrl || a.siteUrl;
    return `
      <article class="list-card">
        <h3>${a.buildingName}</h3>
        <p>${a.intro}</p>
        <p class="list-law">${a.lawName}</p>
        <div class="list-card-actions">
          <button type="button" class="btn-primary" data-list-lesson="${id}">本站教學</button>
          <a class="btn-secondary btn-external" href="${a.siteUrl}" target="_blank" rel="noopener noreferrer">進入法規站</a>
        </div>
        <a class="text-link" href="${lawLink}" target="_blank" rel="noopener noreferrer">查看原文</a>
      </article>
    `;
  }).join('');
}
