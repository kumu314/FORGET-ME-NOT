import { defineConfig } from 'vitest/config';

/**
 * 单测只覆盖成员C的纯逻辑（数值/判定/输入语义），不加载 Phaser 运行时，
 * 因此用 node 环境并在测试里 mock 掉 `phaser`。
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
