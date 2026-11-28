/* global document, innerWidth -- Browserlayout in Playwright. */
import assert from 'node:assert/strict';
export async function layout(p) {
  for (const width of [320, 375, 390, 430, 1280]) {
    await p.setViewportSize({ width, height: 844 });
    for (const size of ['100%', '200%']) {
      const fits = await p.evaluate((size) => {
        document.documentElement.style.fontSize = size;
        const targets = [
          ...document.querySelectorAll('a,button,input,select,summary'),
        ]
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width && r.height);
        return (
          targets.every((r) => r.height >= 44 && r.width >= 44) &&
          document.documentElement.scrollWidth <= innerWidth
        );
      }, size);
      assert.ok(fits, 'Horizontales Scrollen');
    }
  }
  await p.evaluate(() => {
    document.documentElement.style.fontSize = '100%';
  });
  await p.setViewportSize({ width: 390, height: 844 });
}
