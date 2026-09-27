const g = require('./load.js');
const { CADDoc: CD, CADSamples, SimNet, Spice: S, CADCore: C1, CADParts } = g;
let fails = 0;
const ok = (c, m, x) => { console.log((c ? 'PASS ' : 'FAIL ') + m + (x !== undefined ? ' -> ' + x : '')); if (!c) fails++; };
for (const smp of CADSamples) {
  const doc = CD.loadSample(smp);
  const nl = SimNet.schematicToNetlist(doc, {});
  console.log('---', smp.name); console.log(nl.text); console.log(nl.warnings.map(w => w.lv + ':' + w.t).join('\n'));
  try {
    const r = S.simulate(nl.text, { type: 'op' });
    ok(true, smp.id + ' op', r.names.map((n, i) => n + '=' + S.fmt(r.values[i], '', 3)).filter(s => s.startsWith('v(')).join(' '));
  } catch (e) { ok(false, smp.id + ' op', e.message); }
}
// 555 sample transient
{
  const doc = CD.loadSample(CADSamples[0]);
  const nl = SimNet.schematicToNetlist(doc, {});
  const t0 = Date.now();
  const r = S.simulate(nl.text, { type: 'tran', tstep: 1e-3, tstop: 3, uic: true });
  const k = r.names.findIndex(n => n === 'i(dd1)');
  let on = 0; r.data[k].forEach(v => { if (v > 1e-3) on++; });
  ok(on > 10 && on < r.x.length - 10, 'LED blinks', on + '/' + r.x.length + ' ' + (Date.now() - t0) + 'ms');
}
// astable multivibrator oscillation
{
  const doc = CD.loadSample(CADSamples[1]);
  const nl = SimNet.schematicToNetlist(doc, { tol: 0.01 });
  const t0 = Date.now();
  try {
    const r = S.simulate(nl.text, { type: 'tran', tstep: 5e-3, tstop: 4, uic: true });
    const k = r.names.findIndex(n => n === 'i(dd1)');
    let tr = 0, prev = 0; r.data[k].forEach(v => { const s = v > 2e-3 ? 1 : 0; if (s !== prev) tr++; prev = s; });
    ok(tr >= 4, 'multivibrator toggles', tr + ' ' + (Date.now() - t0) + 'ms');
  } catch (e) { ok(false, 'multivib', e.message); }
}
// all catalog entries produce netlist w/o exception
{
  let bad = 0, n = 0;
  for (const e of CADParts.LIB) {
    const doc = CD.newDoc();
    CD.addComponent(doc, e.sym, 0, 0, 0, { val: e.val, props: e.props || {} });
    try { SimNet.schematicToNetlist(doc, {}); n++; } catch (er) { bad++; if (bad < 5) console.log(e.id, er.message); }
    try { const fp = C1.SYM[e.sym].fp; if (fp && !C1.SYM[e.sym].simOnly) fp(doc.components[0]); } catch (er) { bad++; if (bad < 5) console.log('fp', e.id, er.message); }
  }
  ok(bad === 0, 'catalog netlist+fp', n);
}
console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
