const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { mkdirSync } = require("node:fs");
async function main() {
  const path = process.argv[2];
  assert.match(path ?? "", /^\/post\/[0-9a-f-]{36}$/);
  const browser = await chromium.launch({ channel: "msedge" });
  mkdirSync(".backups/ui", { recursive: true });
  try {
    for (const [name, width, height] of [["mobile", 390, 844], ["desktop", 1440, 1000]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto("http://localhost:3000" + path);
      await page.getByRole("button", { name: "More comment options", exact: true }).click();
      const menu = page.getByRole("menu", { name: "More comment options", exact: true });
      await menu.waitFor({ state: "visible" });
      assert.equal(await menu.getByRole("menuitem", { name: "Edit comment" }).count(), 0, "Anonymous readers do not receive author controls");
      await page.screenshot({ path: `.backups/ui/content-menu-${name}.png`, animations: "disabled" });
      const box = await menu.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width && box.y + box.height <= height - 80);
      const item = await menu.getByRole("menuitem", { name: "Report comment" }).boundingBox();
      assert.ok(item.height >= 44, "Touch target must be comfortable");
      await menu.getByRole("menuitem", { name: "Report comment" }).click();
      const dialog = page.getByRole("dialog", { name: "Report comment", exact: true });
      await dialog.waitFor({ state: "visible" });
      await page.screenshot({ path: `.backups/ui/content-dialog-${name}.png`, animations: "disabled" });
      const modal = await dialog.boundingBox();
      assert.ok(modal.width <= width - 24 && modal.x >= 0, "Dialog stays inside the viewport");
      await dialog.getByRole("textbox", { name: "Reason", exact: true }).fill("QA retained draft");
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await dialog.waitFor({ state: "hidden" });
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log("Mobile/desktop content menus passed: permission presentation, touch targets, viewport fit, report dialog and cancellation.");
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
