import { describe, it, expect } from 'vitest';
import { BOSS } from '../src/config/aiConfig.js';

/**
 * Boss 登场/结算台词契约（issue #34，GDD §4.5）
 * 台词是"影响面=共享配置"的内容资产，单测锁住存在性与关键原文。
 */
describe('Boss 登场/结算台词（issue #34）', () => {
  it('班主任与老板都配置了非空登场与结算台词', () => {
    for (const kind of ['teacher', 'employer']) {
      const lines = BOSS[kind].lines;
      expect(lines, `${kind} 缺少 lines 配置`).toBeTruthy();
      expect(lines.intro.length, `${kind} 登场台词为空`).toBeGreaterThan(4);
      expect(lines.defeat.length, `${kind} 结算台词为空`).toBeGreaterThan(4);
    }
  });

  it('班主任台词保留 GDD §4.5 关键原文', () => {
    expect(BOSS.teacher.lines.intro).toContain('最吵');
    expect(BOSS.teacher.lines.defeat).toContain('交卷吧');
  });

  it('老板台词覆盖登场与暴雨骤停的结算意象', () => {
    expect(BOSS.employer.lines.intro).toContain('通宵');
    expect(BOSS.employer.lines.defeat).toContain('暴雨');
  });
});
