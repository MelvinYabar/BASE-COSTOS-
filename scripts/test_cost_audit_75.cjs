const assert = require('node:assert/strict');
const fs = require('node:fs');
const A = require('../dist/analytics-core.js');
const audit = require('../dist/cost-audit-75.json');
const costs = require('../dist/costs.json');

assert.equal(audit.rows.length, 75);
assert.equal(new Set(audit.rows.map(row => row.code)).size, 75);
assert.equal(Object.values(audit.meta.statusCounts).reduce((a, b) => a + b, 0), 75);
const byCode = new Map(audit.rows.map(row => [row.code, row]));
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < .01, `${actual} vs ${expected}`);

near(byCode.get('7730979098120').referenceCost, 384.89 / 30); // Eutebrol XML amount already includes IGV.
near(byCode.get('7591821102071').referenceCost, 208.33 * 1.18 / 90); // Correct Natal variant.
near(byCode.get('7613326037037').referenceCost, 835.14 * 1.18 / 180); // Madopar by tablet.
assert.equal(byCode.get('7703153018849').referenceCost, null); // 2 mL invoice cannot cost 1 mL SKU.
assert.equal(byCode.get('7707239275775').referenceCost, null); // T4 is not T4-O.
assert.equal(byCode.get('736085410334').referenceCost, null); // Formula not confirmed.
near(byCode.get('7612797435601').referenceCost, 107.16); // Frasco, July invoice.
assert.ok(!costs.base.some(row => ['7707239275775', '736085410334'].includes(String(row.gtin))));
const eutebrol = costs.detail.find(row => row.gtin === '7730979098120' && row.invoice === 'F100-890644');
assert.ok(eutebrol);
assert.equal(A.purchaseCost(eutebrol, costs.meta.igvIncludedProviders).factor, 1);
assert.equal(fs.existsSync(require('node:path').join(__dirname, '..', 'dist', 'cost-audit-75.js')), true);
console.log('75 costos: GTIN únicos, evidencia e IGV verificados.');
