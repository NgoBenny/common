const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const { assessReport } = require("../scripts/audit-dependencies.cjs");
const { expires, advisory } = require("../scripts/braces-patch.json");
const now = Date.parse("2026-10-03T00:00:00Z");
const report = () => ({
  metadata: {},
  vulnerabilities: {
    braces: {
      severity: "high",
      via: [
        { name: "braces", url: `https://github.com/advisories/${advisory}` },
      ],
    },
    micromatch: { severity: "high", via: ["braces"] },
    tailwindcss: { severity: "high", via: ["micromatch"] },
  },
});
assert.equal(assessReport(report(), now), true);
assert.equal(assessReport({ metadata: {}, vulnerabilities: {} }, now), false);
assert.throws(() => assessReport(report(), Date.parse(expires)), /expired/);
assert.throws(
  () => assessReport({ error: { code: "offline" } }, now),
  /Unexpected/,
);
const unknown = report();
unknown.vulnerabilities.braces.via.push({
  name: "braces",
  url: "https://github.com/advisories/new-advisory",
});
assert.throws(() => assessReport(unknown, now), /Unmitigated/);
const unrelated = report();
unrelated.vulnerabilities.other = {
  severity: "critical",
  via: [{ name: "other", url: "other" }],
};
assert.throws(() => assessReport(unrelated, now), /Unmitigated/);
const cycle = report();
cycle.vulnerabilities.braces.via = ["micromatch"];
assert.throws(() => assessReport(cycle, now), /Unmitigated/);
for (const consumer of [
  "tailwindcss",
  "@tailwindcss/typography",
  "postcss-nested",
]) {
  const consumerRequire = createRequire(
    require.resolve(`${consumer}/package.json`),
  );
  assert.equal(
    consumerRequire("postcss-selector-parser/package.json").version,
    "7.1.6",
  );
  const selector = ".prose :is(h1, h2) > a:hover";
  assert.equal(
    consumerRequire("postcss-selector-parser")().processSync(selector),
    selector,
  );
}
console.log(
  "Audit policy blocks new advisories, cyclic findings, network errors and expired reviews",
);
