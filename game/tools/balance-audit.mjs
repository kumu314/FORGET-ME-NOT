import { pathToFileURL } from 'node:url';
import { LIFE_PHASES } from '../src/config/gameConfig.js';
import { STAGE_LAYOUTS, WORLD_WIDTH } from '../src/config/stageLayout.js';
import { BOSS, MONSTERS } from '../src/config/aiConfig.js';
import { STAGE_SPAWNS } from '../src/ai/StageSpawns.js';
import { rangedResourceEnvelope, stagePacingEnvelope } from '../src/entities/balanceMath.js';

export function auditBalance() {
  return {
    evidenceType: 'Configuration arithmetic; no physics, AI combat, player wins, or human playtests',
    stageTargetSeconds: [480, 900],
    phases: Object.fromEntries(LIFE_PHASES.map((phaseId) => {
      const spawn = STAGE_SPAWNS[phaseId];
      return [phaseId, {
        pacing: stagePacingEnvelope(phaseId, {
          worldWidth: WORLD_WIDTH,
          spawnX: STAGE_LAYOUTS[phaseId].spawn.x,
        }),
        monsters: spawn.monsters.length,
        monsterHpBeforeArmor: spawn.monsters.reduce((total, monster) => total + MONSTERS[monster.type].hp, 0),
        bossHp: spawn.boss ? BOSS[spawn.boss.kind].hp : null,
        ranged: rangedResourceEnvelope(phaseId),
      }];
    })),
    elderCost3Candidate: rangedResourceEnvelope('elder', { cost: 3 }),
    unmeasured: ['Stage clear duration', 'Block versus rush win rates', 'AI/projectile collision outcomes', 'Subjective spell feel'],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(auditBalance(), null, 2));
}
