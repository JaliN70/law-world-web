const KEY = 'law-world-progress-v1';

export const LAW_PASS_INTRO_QUESTS = ['F1', 'B1', 'T1', 'A1', 'W1', 'E1'];

const defaultState = () => ({
  visited: false,
  introSeen: false,
  tutorialDone: false,
  tutorialStep: 0,
  questsDone: {},
  unlocks: {},
  visitDays: [],
  reduceMotion: false,
  preferList: false,
  areaProgress: {},
  nightMode: false,
  /** 法規通達成當下是否已自動顯示過證書（重整後不重複跳出） */
  lawPassCertAutoShown: false,
});

export function countIntroQuestsComplete(state) {
  return LAW_PASS_INTRO_QUESTS.filter((id) => state.questsDone[id]).length;
}

export function isLawPassComplete(state) {
  return LAW_PASS_INTRO_QUESTS.every((id) => state.questsDone[id]);
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return defaultState();
  }
}

export function saveProgress(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

export function markVisitDay(state) {
  const today = new Date().toISOString().slice(0, 10);
  if (!state.visitDays.includes(today)) {
    state.visitDays = [...state.visitDays, today].slice(-30);
  }
  saveProgress(state);
}

export function completeQuest(state, questId, unlockMesh) {
  state.questsDone[questId] = true;
  if (unlockMesh) state.unlocks[unlockMesh] = true;
  saveProgress(state);
  return state;
}

export function countAreasWithQuest(state) {
  const prefixes = ['F', 'B', 'T', 'A', 'W', 'E'];
  return prefixes.filter((p) =>
    Object.keys(state.questsDone).some((k) => k.startsWith(p))
  ).length;
}
