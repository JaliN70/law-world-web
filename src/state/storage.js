const KEY = 'law-world-progress-v1';

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
});

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
