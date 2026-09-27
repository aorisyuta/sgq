require('../src/js/spice.js');
const S = globalThis.Spice;
let fails = 0;
function ok(cond, msg, extra) { console.log((cond ? 'PASS ' : 'FAIL ') + msg + (extra !== undefined ? '  -> ' + extra : '')); if (!cond) fails++; }
const near = (a, b, tol) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const val = (r, name) => r.values[r.names.indexOf(name)];
const at = (r, name, t) => { const k = r.names.indexOf(name); let i = 0; while (i < r.x.length - 1 && r.x[i] < t) i++; return r.data[k][i]; };

// parseNum
ok(S.parseNum('4k7') === 4700, 'parse 4k7');
ok(near(S.parseNum('0.1u'), 1e-7, 1e-9), 'parse 0.1u');
ok(S.parseNum('1M') === 1e6, 'parse 1M = mega');
ok(near(S.parseNum('10mH'), 0.01, 1e-9), 'parse 10mH');
ok(S.parseNum('1meg') === 1e6, 'parse 1meg');
ok(near(S.parseNum('2R2'), 2.2, 1e-9), 'parse 2R2');

// divider
let r = S.simulate(`divider\nV1 in 0 10\nR1 in out 1k\nR2 out 0 1k\n.op`);
ok(near(val(r, 'v(out)'), 5, 1e-6), 'divider', val(r, 'v(out)'));
ok(near(val(r, 'i(v1)'), -0.005, 1e-6), 'source current', val(r, 'i(v1)'));

// diode
r = S.simulate(`d\nV1 a 0 5\nR1 a k 1k\nD1 k 0 D1N4148\n.model D1N4148 D(IS=2.52n N=1.752 RS=0.568)\n.op`);
ok(val(r, 'v(k)') > 0.6 && val(r, 'v(k)') < 0.8, 'diode drop', val(r, 'v(k)'));

// RC transient
r = S.simulate(`rc\nV1 in 0 PULSE(0 1 0 1n 1n 1 2)\nR1 in out 1k\nC1 out 0 1u\n.tran 10u 5m`);
ok(near(at(r, 'v(out)', 1e-3), 1 - Math.exp(-1), 0.01), 'RC tau', at(r, 'v(out)', 1e-3));

// RC AC
r = S.simulate(`ac\nV1 in 0 AC 1\nR1 in out 1k\nC1 out 0 159.155n\n.ac dec 20 10 100k`);
{ const k = r.names.indexOf('v(out)'); let best = 0; r.x.forEach((f, i) => { if (Math.abs(f - 1000) < Math.abs(r.x[best] - 1000)) best = i; });
  const mag = Math.hypot(r.re[k][best], r.im[k][best]); ok(near(mag, Math.SQRT1_2, 0.02), 'RC -3dB at 1kHz', mag + ' @ ' + r.x[best]); }

// BJT common emitter
r = S.simulate(`ce\nVCC vcc 0 12\nR1 vcc b 100k\nR2 b 0 22k\nRC vcc c 4.7k\nRE e 0 1k\nQ1 c b e Q2N3904\n.model Q2N3904 NPN(IS=6.734f BF=416.4 VAF=74.03)\n.op`);
ok(val(r, 'v(c)') > 3 && val(r, 'v(c)') < 9, 'CE bias Vc', val(r, 'v(c)'));
ok(near(val(r, 'v(b)') - val(r, 'v(e)'), 0.65, 0.12), 'Vbe', val(r, 'v(b)') - val(r, 'v(e)'));

// PNP
r = S.simulate(`pnp\nVCC vcc 0 12\nRB b 0 100k\nQ1 c b vcc QP\nRC c 0 1k\n.model QP PNP(IS=1e-14 BF=100)\n.op`);
ok(val(r, 'v(c)') > 5, 'PNP conducts', val(r, 'v(c)'));

// MOSFET switch
r = S.simulate(`nmos\nV1 vdd 0 12\nVG g 0 10\nRL vdd d 100\nM1 d g 0 0 NM\n.model NM NMOS(VTO=2 KP=5)\n.op`);
ok(val(r, 'v(d)') < 0.5, 'NMOS on', val(r, 'v(d)'));
r = S.simulate(`nmos\nV1 vdd 0 12\nVG g 0 0\nRL vdd d 100\nM1 d g 0 0 NM\n.model NM NMOS(VTO=2 KP=5)\n.op`);
ok(val(r, 'v(d)') > 11.9, 'NMOS off', val(r, 'v(d)'));
r = S.simulate(`pmos\nV1 vdd 0 12\nVG g 0 0\nRL d 0 100\nM1 d g vdd vdd PM\n.model PM PMOS(VTO=-2 KP=5)\n.op`);
ok(val(r, 'v(d)') > 11.5, 'PMOS on', val(r, 'v(d)'));

// JFET
r = S.simulate(`jfet\nVDD vdd 0 15\nRD vdd d 1k\nJ1 d 0 s JN\nRS s 0 470\n.model JN NJF(VTO=-2 BETA=1m)\n.op`);
ok(val(r, 'v(s)') > 0.2 && val(r, 'v(s)') < 2, 'JFET self bias', val(r, 'v(s)'));

// opamp non-inverting x11
r = S.simulate(`op\nVP vp 0 15\nVN vn 0 -15\nVIN in 0 0.5\nX1 in fb out vp vn opamp\nRF out fb 100k\nRG fb 0 10k\n.op`);
ok(near(val(r, 'v(out)'), 5.5, 0.01), 'opamp gain 11', val(r, 'v(out)'));
r = S.simulate(`op\nVP vp 0 15\nVN vn 0 -15\nVIN in 0 2\nX1 in fb out vp vn opamp\nRF out fb 100k\nRG fb 0 10k\n.op`);
ok(val(r, 'v(out)') > 14 && val(r, 'v(out)') < 15.01, 'opamp saturates', val(r, 'v(out)'));
// opamp AC GBW
r = S.simulate(`op\nVP vp 0 15\nVN vn 0 -15\nVIN in 0 0 AC 1\nX1 in fb out vp vn opamp gbw=1meg\nRF out fb 99k\nRG fb 0 1k\n.ac dec 10 10 1meg`);
{ const k = r.names.indexOf('v(out)'); const g0 = Math.hypot(r.re[k][0], r.im[k][0]); ok(near(g0, 100, 0.02), 'opamp AC gain100', g0);
  let i10 = r.x.findIndex(f => f >= 10000); const g = Math.hypot(r.re[k][i10], r.im[k][i10]); ok(g > 60 && g < 80, 'opamp pole ~10kHz', g); }

// regulator
r = S.simulate(`reg\nVIN in 0 12\nX1 in 0 out regulator v=5\nRL out 0 100\n.op`);
ok(near(val(r, 'v(out)'), 5, 0.01), '7805 out', val(r, 'v(out)'));
r = S.simulate(`reg\nVIN in 0 5\nX1 in 0 out regulator v=5\nRL out 0 100\n.op`);
ok(near(val(r, 'v(out)'), 3, 0.05), '7805 dropout', val(r, 'v(out)'));
r = S.simulate(`reg\nVIN in 0 -12\nX1 in 0 out regulator v=-5\nRL out 0 100\n.op`);
ok(near(val(r, 'v(out)'), -5, 0.01), '7905 out', val(r, 'v(out)'));

// zener
r = S.simulate(`z\nV1 a 0 12\nR1 a k 1k\nD1 0 k DZ\n.model DZ D(BV=5.1 IBV=5m)\n.op`);
ok(near(val(r, 'v(k)'), 5.1, 0.05), 'zener', val(r, 'v(k)'));

// 555 astable: R1=10k R2=47k C=10u -> f = 1.44/((10k+94k)*10u) = 1.385 Hz
{
  const t0 = Date.now();
  r = S.simulate(`555\nVCC vcc 0 5\nX1 0 thr out vcc ctl thr dis vcc ne555\nR1 vcc dis 1k\nR2 dis thr 10k\nC1 thr 0 1u\nC2 ctl 0 10n\nRL out 0 1k\n.tran 10u 60m uic`);
  const k = r.names.indexOf('v(out)'); const d = r.data[k]; let edges = [];
  for (let i = 1; i < d.length; i++) if (d[i - 1] < 2.5 && d[i] >= 2.5) edges.push(r.x[i]);
  const per = edges.length > 2 ? (edges[edges.length - 1] - edges[1]) / (edges.length - 2) : 0;
  const expect = 0.693 * (1e3 + 2 * 10e3) * 1e-6;
  ok(near(per, expect, 0.12), '555 period', per + ' vs ' + expect + ' pts=' + r.x.length + ' ' + (Date.now() - t0) + 'ms');
}

// LC + K transformer
r = S.simulate(`tx\nV1 p 0 SIN(0 10 50)\nL1 p 0 1\nL2 s 0 0.01\nK1 L1 L2 0.999\nRL s 0 1k\n.tran 0.1m 60m`);
{ const k = r.names.indexOf('v(s)'); let mx = 0; r.data[k].forEach((v, i) => { if (r.x[i] > 20e-3) mx = Math.max(mx, v); }); ok(near(mx, 1, 0.05), 'transformer 10:1', mx); }

// DC sweep
r = S.simulate(`dc\nV1 a 0 0\nR1 a k 1k\nD1 k 0 DD\n.model DD D(IS=1e-14)\n.dc V1 0 5 0.1`);
ok(r.x.length === 51, 'dc sweep points', r.x.length);

// subckt
r = S.simulate(`sub\n.subckt div in out\nR1 in out 1k\nR2 out 0 1k\n.ends\nV1 a 0 8\nX1 a b div\nX2 b c div\n.op`);
ok(near(val(r, 'v(c)'), 8 * (1/5) , 0.02) , 'subckt ladder', val(r, 'v(c)'));

// logic gate
S.defineBuiltin('74hc04', S.logicChip({ pins: 14, vcc: 14, gnd: 7, gates: [{ f: 'not', in: [1], out: 2 }] }));
r = S.simulate(`logic\nVCC vcc 0 5\nVIN a 0 PULSE(0 5 1m 1u 1u 1m 2m)\nX1 a y n3 n4 n5 n6 0 n8 n9 n10 n11 n12 n13 vcc 74hc04\n.tran 10u 4m`);
ok(at(r, 'v(y)', 0.5e-3) > 4.5 && at(r, 'v(y)', 1.5e-3) < 0.5, 'inverter', at(r, 'v(y)', 0.5e-3) + ' ' + at(r, 'v(y)', 1.5e-3));

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
