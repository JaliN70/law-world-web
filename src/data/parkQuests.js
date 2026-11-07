/** 園區任務列表（對齊設計稿 05-quest-panel.png + PDF §4.4） */

import { countAreasWithQuest } from '../state/storage.js';

export const PARK_QUESTS = [
  {
    id: 'F1',
    areaId: 'fire',
    areaShort: '消防',
    title: '設置義務入門',
    desc: '讀第 14 條滅火器、第 15 條室內消防栓導讀',
    unlock: '解鎖：消火栓亮燈',
    questKey: 'F1',
  },
  {
    id: 'E1',
    areaId: 'electrical',
    areaShort: '電氣',
    title: '通則第一步',
    desc: '讀通則第 3–4 條，答出低壓適用範圍',
    unlock: '解鎖：變壓器表情',
    questKey: 'E1',
  },
  {
    id: 'W1',
    areaId: 'water',
    areaShort: '給排水',
    title: '兩套標準',
    desc: '分辨自來水／下水道兩套標準的總則',
    unlock: '解鎖：水渠流水',
    unlockProgress: true,
    questKey: 'W1',
  },
  {
    id: 'A1',
    areaId: 'accessibility',
    areaShort: '無障礙',
    title: '通路與坡道',
    desc: '讀第二章無障礙通路導讀',
    unlock: '解鎖：導盲磚發光',
    questKey: 'A1',
  },
  {
    id: 'cross-3',
    cross: true,
    title: '三域巡禮',
    desc: '完成 3 個領域的入門任務',
    unlock: '解鎖：各島碼頭路燈',
    unlockProgress: true,
    needAreas: 3,
  },
  {
    id: 'cross-law',
    cross: true,
    title: '法規通',
    desc: '六區入門任務全部完成',
    unlock: '解鎖：中央 logo 微光＋岸緣光',
    unlockProgress: true,
    needAreas: 6,
  },
];

export function countCompletedQuests(progress) {
  return PARK_QUESTS.filter((q) => isQuestDone(q, progress)).length;
}

export function isQuestDone(quest, progress) {
  if (quest.cross) {
    const n = countAreasWithQuest(progress);
    return n >= (quest.needAreas || 6);
  }
  return Boolean(progress.questsDone[quest.questKey]);
}

export function questProgressLabel(quest, progress) {
  if (!quest.unlockProgress) return quest.unlock;
  if (quest.id === 'cross-3') {
    const n = countAreasWithQuest(progress);
    return `${quest.unlock} ${Math.min(n, 3)}/3`;
  }
  if (quest.id === 'cross-law') {
    const n = countAreasWithQuest(progress);
    return `${quest.unlock} ${Math.min(n, 6)}/6`;
  }
  if (quest.id === 'W1') {
    const done = progress.questsDone.W1;
    return `${quest.unlock} ${done ? '1/1' : '0/1'}`;
  }
  return quest.unlock;
}
