export const SCORES = {
  stage1: {
    title: '操场上的纸飞机', bpm: 144, lead: 'square', bass: 'triangle', attack: 0.004, release: 0.03,
    roots: [48, 45, 53, 55, 48, 45, 53, 55],
    melody: [
      [72, 76, 79, 76, 74, 76, 72, null], [69, 72, 76, 79, 76, 72, 69, null],
      [77, 81, 84, 81, 79, 77, 76, 72], [74, 79, 83, 79, 77, 74, 71, null],
      [72, 79, 84, 79, 76, 74, 72, null], [69, 76, 81, 79, 76, 72, 69, null],
      [77, 79, 81, 84, 81, 79, 77, 76], [74, 71, 67, null, 72, null, null, null],
    ],
  },
  stage2: {
    title: '雨夜末班车', bpm: 108, lead: 'sawtooth', bass: 'sawtooth', attack: 0.035, release: 0.12,
    roots: [45, 41, 48, 43, 45, 41, 48, 43],
    melody: [
      [69, null, 72, 76, 79, null, 76, 72], [65, null, 69, 72, 76, null, 72, 69],
      [67, null, 72, 76, 79, null, 76, 72], [67, null, 71, 74, 77, null, 74, 71],
      [76, null, 79, 81, 79, null, 76, 72], [77, null, 76, 72, 69, null, 65, 69],
      [72, null, 76, 79, 84, null, 79, 76], [74, null, 71, 67, 69, null, null, null],
    ],
  },
  stage3: {
    title: '长椅边的黄昏', bpm: 66, lead: 'sine', bass: 'triangle', attack: 0.09, release: 0.3,
    roots: [48, 53, 45, 55, 48, 53, 55, 48],
    melody: [
      [76, null, null, 79, 74, null, 72, null], [77, null, null, 76, 72, null, null, null],
      [72, null, null, 76, 69, null, 72, null], [71, null, null, 74, 67, null, null, null],
      [76, null, null, 79, 84, null, 79, null], [77, null, null, 76, 72, null, null, null],
      [74, null, 71, null, 67, null, 71, null], [72, null, null, null, null, null, null, null],
    ],
  },
};

const frequency = (midi) => 440 * 2 ** ((midi - 69) / 12);

export function scoreStep(key, step) {
  const score = SCORES[key];
  const bar = Math.floor(step / 8) % score.roots.length;
  const beat = step % 8;
  const duration = 30 / score.bpm;
  const notes = [];
  const add = (midi, type, dur, vol, attack = score.attack, release = score.release, cutoff) => {
    notes.push({ type, f0: frequency(midi), dur, vol, at: attack, rel: release, cutoff });
  };
  const melody = score.melody[bar][beat];
  if (melody !== null) add(melody, score.lead, duration * 0.85, key === 'stage2' ? 0.027 : 0.045);
  if (key === 'stage1' && beat % 2 === 0) {
    add(score.roots[bar] + (beat === 4 ? 7 : 0), score.bass, duration * 1.7, 0.065);
  }
  if (key === 'stage2') {
    add(score.roots[bar] - 12 + (beat % 2 ? 12 : 0), score.bass, duration * 0.7, 0.035, 0.008, 0.04, 650);
    if (beat === 0) {
      for (const interval of [12, bar % 4 === 0 ? 15 : 16, 19]) add(score.roots[bar] + interval, 'sawtooth', duration * 7, 0.012, 0.18, 0.3, 1200);
    }
    if (beat % 2 === 0) notes.push({ type: 'sine', f0: 110, f1: 40, dur: 0.12, vol: 0.07, at: 0.003, rel: 0.03 });
  }
  if (key === 'stage3' && beat === 0) {
    for (const interval of [0, 7, bar === 2 ? 15 : 16]) add(score.roots[bar] + interval, score.bass, duration * 7, 0.022, 0.25, 0.4);
  }
  return { duration, notes };
}
