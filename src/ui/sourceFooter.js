import { AREAS } from '../data/areas.js';

const disclaimer = '以全國法規資料庫最新公布為準';

export function renderSourceFooter(areaId, ref = {}) {
  const area = AREAS[areaId];
  if (!area) return '';
  const lawName = ref.lawName || area.lawName;
  const amended = ref.amended || area.amended;
  const article = ref.article || ref.sectionNote || '—';
  const title = ref.title || '—';
  const moj = ref.mojUrl || area.lawAllUrl;
  const mojLink = moj
    ? `<a href="${moj}" target="_blank" rel="noopener noreferrer">全國法規資料庫</a>`
    : `<span>${area.lawAllNote || '設計時依該站頁面補上'}</span>`;
  return `
    <footer class="source-footer">
      <div><strong>法規名稱</strong>：${lawName}</div>
      <div><strong>條號／章節</strong>：${article}</div>
      <div><strong>標題</strong>：${title}</div>
      <div><strong>修正日</strong>：${amended}</div>
      <div><strong>原站連結</strong>：<a href="${area.siteUrl}" target="_blank" rel="noopener noreferrer">${area.siteUrl}</a></div>
      <div><strong>全國法規資料庫</strong>：${mojLink}</div>
      <p class="source-note">${disclaimer}</p>
    </footer>
  `;
}
