import { useState, useMemo, useCallback } from "react";

const MAX_REGIONS = 18, MAX_SEARCHES = 14, MAX_SRUS = 12, MAX_OFFSETS = 10;
const REGION_LETTERS = "ABCDEFGHIJKLMNOPQR".split("");

/* ═══ DARK THEME ═══ remaps the Tailwind palette used in this file when .sm-dark is set */
const DARK_CSS = `
.sm-dark { color-scheme: dark; }
.sm-dark.bg-gray-100, .sm-dark .bg-gray-100 { background-color:#0e1318 !important; }
.sm-dark .bg-white { background-color:#181f27 !important; }
.sm-dark .bg-gray-50 { background-color:#1f2731 !important; }
.sm-dark .bg-gray-200 { background-color:#283038 !important; }
.sm-dark .bg-gray-300 { background-color:#323c47 !important; }
.sm-dark .bg-gray-700 { background-color:#0a0e13 !important; }
.sm-dark .bg-gray-800 { background-color:#05080c !important; }
.sm-dark .text-gray-900 { color:#e7ecf2 !important; }
.sm-dark .text-gray-700 { color:#cdd5df !important; }
.sm-dark .text-gray-600 { color:#a9b3bf !important; }
.sm-dark .text-gray-500 { color:#8a94a1 !important; }
.sm-dark .text-gray-400 { color:#6c7682 !important; }
.sm-dark .bg-blue-50 { background-color:#142539 !important; }
.sm-dark .bg-green-50 { background-color:#102d1d !important; }
.sm-dark .bg-emerald-50 { background-color:#0e2d27 !important; }
.sm-dark .bg-emerald-100 { background-color:#143b35 !important; }
.sm-dark .bg-emerald-200 { background-color:#1b4d44 !important; }
.sm-dark .bg-emerald-300 { background-color:#1f5e52 !important; }
.sm-dark .bg-amber-50 { background-color:#352a10 !important; }
.sm-dark .bg-indigo-50 { background-color:#1b1e42 !important; }
.sm-dark .bg-purple-50 { background-color:#271a3a !important; }
.sm-dark .bg-yellow-50 { background-color:#352f10 !important; }
.sm-dark .text-blue-700 { color:#7fb4f2 !important; }
.sm-dark .text-green-700, .sm-dark .text-green-800 { color:#5fd08a !important; }
.sm-dark .text-emerald-700 { color:#55d8ad !important; }
.sm-dark .text-emerald-800 { color:#74e2bb !important; }
.sm-dark .text-emerald-900 { color:#9feccd !important; }
.sm-dark .text-amber-800 { color:#e3b765 !important; }
.sm-dark .text-indigo-700 { color:#9ca2f2 !important; }
.sm-dark .text-purple-700 { color:#c490e2 !important; }
.sm-dark .text-red-600 { color:#f08a8a !important; }
.sm-dark .text-red-300 { color:#f0a8a8 !important; }
.sm-dark .border, .sm-dark .border-b, .sm-dark .border-r, .sm-dark .border-collapse td, .sm-dark .border-collapse th { border-color:#2a333d !important; }
.sm-dark .border-gray-300 { border-color:#384350 !important; }
.sm-dark input { background-color:#1f2731 !important; color:#e7ecf2 !important; }
.sm-dark input::placeholder { color:#6c7682 !important; }
.sm-dark .bg-amber-50.border-amber-400, .sm-dark input.border-amber-400 { background-color:#352a10 !important; border-color:#b9892f !important; }
.sm-dark .bg-yellow-50.border-yellow-300, .sm-dark input.border-yellow-300, .sm-dark input.border-yellow-400 { background-color:#352f10 !important; border-color:#b9a52f !important; }
`;

/* ═══ DATA FACTORIES ═══ */
const mkRegion = (letter) => ({ letter, poc: 0, area: 0, numSegments: 1 });
const mkGndSeg = (reg, num) => ({
  id: `${reg}${String(num).padStart(2,"0")}`, region: reg, segNum: num,
  length: 0, baseline: 0, areaOverride: null, sweepWidth: 0, searchSpeed: 0,
  timeOverride: null, // null = use calculated minimum; number = user override
  tracks: 1,          // A11a Team Tracks — manual, default 1 (matches original)
});
const mkEval = (name="") => ({ name, ratings: {} });
const mkSRU = (id="", region="A") => ({ id, region, sweepWidth:0, fuelEndurance:0, daylightEndurance:0, observerEndurance:0, craftSpeed:0 });
const mkOffset = (val=0) => ({ offset: val });
// A sub-area (Section A column). pAlongTrack feeds Section C POC; from ASAD chart or Section D's D23.
const mkSubArea = (letter="A") => ({ letter, flightLength:0, searchAreaLength:0, pAlongTrack:0.989, selectedOffsetIdx:null });
// Section D POC calculator — all inputs in MILES from the LKP
const mkDSeg = () => ({ startPoint: 0, endPoint: 0, leftOffset: 0, rightOffset: 0, oppositeSides: true });
const mkAirSetup = () => ({
  subAreas: [mkSubArea("A")],
  srus: [mkSRU("SRU-1","A")],
  offsets: [mkOffset(2),mkOffset(4),mkOffset(5),mkOffset(6),mkOffset(8),mkOffset(10)],
  useD: false,            // auto-opens when a 2nd sub-area is added
  dSeg: mkDSeg(),
});

/* ═══ GROUND CALCS — verified against original SearchManager (VM session 07/03/26) ═══
   The original rounds INTERMEDIATE values and computes forward from the rounded
   numbers. Matching its output requires matching its rounding, not just formulas. */
const r1 = v => Math.round(v * 10) / 10;
const r2 = v => Math.round(v * 100) / 100;
const r3 = v => Math.round(v * 1000) / 1000;

// A7: Segment Area = L×B, or user override for non-rectangular segments
const segArea = seg => (seg.areaOverride != null && seg.areaOverride > 0) ? seg.areaOverride : seg.length * seg.baseline;

// Consensus (verified): region POC weight = column sum ÷ grand total of ALL votes
function consensusPOCs(regions, evaluators) {
  const colSums = regions.map(r => evaluators.reduce((s, e) => s + (e.ratings[r.letter] || 0), 0));
  const grand = colSums.reduce((a, b) => a + b, 0);
  return { pocs: regions.map((_, i) => grand > 0 ? colSums[i] / grand : 0), grand };
}

// A8 for Search #1: Segment POC = regionPOC × (segArea ÷ regionArea), region area = Σ its segments (verified)
function basePocs(segments, regions) {
  const regArea = {};
  segments.forEach(s => { regArea[s.region] = (regArea[s.region] || 0) + segArea(s); });
  return segments.map(s => {
    const r = regions.find(r => r.letter === s.region);
    return r && regArea[s.region] > 0 ? r3((segArea(s) / regArea[s.region]) * r.poc) : 0;
  });
}

function calcGndSeg(seg, startPoc) {
  const area = segArea(seg);
  // A11: default Time to Search = (A5 ÷ A10) rounded to 1 decimal (verified: 2/3→0.700), user-overridable
  const minTime = seg.searchSpeed > 0 ? r1(seg.length / seg.searchSpeed) : 0;
  const timeToSearch = seg.timeOverride !== null && seg.timeOverride > 0 ? seg.timeOverride : minTime;
  // A11a: Team Tracks is a MANUAL value, default 1 (verified: original never auto-computes it)
  const teamTracks = Math.max(1, Math.round(seg.tracks || 1));
  // A11b: Time in Segment = A11 × A11a (verified: follows TTS override exactly)
  const timeInSeg = timeToSearch * teamTracks;
  // A12: PSR = (A10 × A9 × A8) ÷ A7 — a RATE, no time component (verified exact: 0.412/0.448/0.484)
  const psr = area > 0 ? (seg.searchSpeed * seg.sweepWidth * startPoc) / area : 0;
  return { area, poc: startPoc, minTime, timeToSearch, teamTracks, timeInSeg, psr };
}

function calcGndSearch(seg, startPoc, assigned) {
  const c = calcGndSeg(seg, startPoc);
  // B14: Spacing = A6×5280 ÷ B13 ÷ A11a, integer ft, DISPLAY ONLY — does not feed coverage (verified)
  const sp = assigned > 0 && c.teamTracks > 0 ? Math.round((seg.baseline * 5280) / (assigned * c.teamTracks)) : 0;
  // B15: Coverage = (B13 × A10 × A11b × A9÷5280) ÷ A7, rounded to 2 decimals (verified: 221×2×1.5×30/5280/6→0.63)
  const covRaw = c.area > 0 ? (assigned * seg.searchSpeed * c.timeInSeg * (seg.sweepWidth / 5280)) / c.area : 0;
  const cov = r2(covRaw);
  // B16: POD = 1 − e^(−C) computed from the ROUNDED coverage (verified: 0.63→0.467, not 0.466)
  const pod = cov > 0 ? 1 - Math.exp(-cov) : 0;
  // B17/B18: rounded to 3 decimals; the rounded values chain forward (verified)
  const pos = r3(c.poc * pod);
  const pocRem = r3(Math.max(0, c.poc - pos));
  // B19: PSR After = (A10 × A9 × B18rounded) ÷ A7 (verified exact: 0.304)
  const psrAfter = c.area > 0 ? (seg.searchSpeed * seg.sweepWidth * pocRem) / c.area : 0;
  return { ...c, sp, cov, pod, pos, pocRem, psrAfter };
}

// CARRY-FORWARD (verified): Search N starting POC = Search N−1 POC Remaining, per segment
function chainPocs(segments, regions, gndSearches, uptoExclusive) {
  let pocs = basePocs(segments, regions);
  for (let n = 1; n < uptoExclusive; n++) {
    const srch = gndSearches[n];
    if (!srch) continue;
    pocs = pocs.map((p, i) => calcGndSearch(segments[i], p, (srch.assignments && srch.assignments[i]) || 0).pocRem);
  }
  return pocs;
}

/* ═══ ASAD TABLES — All Flight Types (Student Guide Appendix A) ═══ */
const ASAD_OFFSET = [ // [offset_nm, P_offset]
[0,0],[.5,.147],[1,.231],[1.5,.273],[2,.328],[2.5,.382],[3,.412],[3.5,.450],[4,.483],[4.5,.504],
[5,.534],[5.5,.567],[6,.569],[6.5,.571],[7,.595],[7.5,.609],[8,.623],[8.5,.628],[9,.639],[9.5,.672],
[10,.685],[10.5,.699],[11,.708],[11.5,.712],[12,.731],[12.5,.748],[13,.755],[13.5,.761],[14,.782],[14.5,.784],
[15,.786],[15.5,.788],[16,.790],[16.5,.792],[17,.803],[17.5,.805],[18,.811],[18.5,.814],[19,.818],[19.5,.824],
[20,.828],[20.5,.840],[21,.853],[21.5,.856],[22,.858],[22.5,.860],[23,.870],[23.5,.872],[24,.874],[24.5,.876],
[25,.878],[25.5,.879],[26,.880],[26.5,.881],[27,.887],[27.5,.889],[28,.891],[28.5,.893],[29,.903],[29.5,.905],
[30,.908],[30.5,.910],[31,.916],[31.5,.918],[32,.924],[32.5,.926],[33,.929],[33.5,.931],[34,.937],[34.5,.939],
[35,.950],[35.5,.950],[36,.951],[36.5,.952],[37,.952],[37.5,.953],[38,.954],[38.5,.958],[39,.959],[39.5,.959],
[40,.960],[40.5,.960],[41,.961],[41.5,.962],[42,.962],[42.5,.963],[43,.963],[43.5,.963],[44,.964],[44.5,.964],
[45,.965],[45.5,.965],[46,.966],[46.5,.966],[47,.966],[47.5,.967],[48,.968],[48.5,.970],[49,.971],[49.5,.972],[50,.973]
];
const ASAD_TRACK = [ // [%distance, P_along_track]
[0,.029],[1,.037],[2,.046],[3,.055],[4,.063],[5,.080],[6,.097],[7,.101],[8,.113],[9,.122],
[10,.130],[11,.134],[12,.143],[13,.155],[14,.164],[15,.181],[16,.183],[17,.185],[18,.193],[19,.206],
[20,.207],[21,.208],[22,.210],[23,.218],[24,.231],[25,.240],[26,.248],[27,.256],[28,.269],[29,.282],
[30,.286],[31,.298],[32,.311],[33,.315],[34,.324],[35,.340],[36,.349],[37,.353],[38,.357],[39,.370],
[40,.375],[41,.382],[42,.391],[43,.399],[44,.408],[45,.416],[46,.420],[47,.424],[48,.429],[49,.434],
[50,.441],[51,.445],[52,.448],[53,.450],[54,.457],[55,.466],[56,.475],[57,.477],[58,.479],[59,.481],
[60,.487],[61,.492],[62,.496],[63,.508],[64,.510],[65,.513],[66,.521],[67,.526],[68,.529],[69,.538],
[70,.546],[71,.550],[72,.555],[73,.559],[74,.571],[75,.580],[76,.584],[77,.597],[78,.605],[79,.618],
[80,.626],[81,.647],[82,.651],[83,.658],[84,.668],[85,.681],[86,.689],[87,.692],[88,.702],[89,.714],
[90,.723],[91,.748],[92,.761],[93,.782],[94,.790],[95,.803],[96,.815],[97,.818],[98,.824],[99,.853],[100,.945],[110,.989]
];
function asadLookup(table, val) {
  if (val <= table[0][0]) return table[0][1];
  if (val >= table[table.length-1][0]) return table[table.length-1][1];
  for (let i = 1; i < table.length; i++) {
    if (val <= table[i][0]) {
      const [x0,y0] = table[i-1], [x1,y1] = table[i];
      return y0 + (y1-y0) * (val-x0) / (x1-x0); // linear interpolation
    }
  }
  return table[table.length-1][1];
}

/* ═══ AIR CALCS ═══ */
function calcSRU(sru) {
  const endurance = Math.min(
    sru.fuelEndurance > 0 ? sru.fuelEndurance : Infinity,
    sru.daylightEndurance > 0 ? sru.daylightEndurance : Infinity,
    sru.observerEndurance > 0 ? sru.observerEndurance : Infinity
  );
  const searchEndurance = isFinite(endurance) ? endurance : 0;
  const mileage = searchEndurance * sru.craftSpeed;
  return { searchEndurance, mileage };
}
function calcAirSearch(setup) {
  const sruBase = setup.srus.map(s => ({ ...s, ...calcSRU(s) })); // B6 searchEndurance, B8 mileage

  // ── Section D (optional, shared calculator) ──
  const d = setup.dSeg || mkDSeg();
  // % along total track is based on the sub-area's own flight length entered in D's owning sub-area;
  // here we use sub-area A's flight length as the reference total track for the D scratch calc.
  const refFlight = (setup.subAreas[0]?.flightLength) || 0;
  const dStartPct = refFlight > 0 ? (d.startPoint / refFlight) * 100 : 0;       // D21a
  const dEndPct   = refFlight > 0 ? (d.endPoint   / refFlight) * 100 : 0;       // D22a
  const dStartProb = d.startPoint <= 0 ? 0 : asadLookup(ASAD_TRACK, dStartPct); // D21b (LKP rule)
  const dInclDest = refFlight > 0 && d.endPoint >= refFlight;
  const dEndProb = dInclDest ? asadLookup(ASAD_TRACK, 110) : asadLookup(ASAD_TRACK, dEndPct); // D22b
  const dAlong = Math.max(0, dEndProb - dStartProb);                            // D23
  const dLB = asadLookup(ASAD_OFFSET, d.leftOffset)  / 2;                       // D24a
  const dRB = asadLookup(ASAD_OFFSET, d.rightOffset) / 2;                       // D25a
  const dOffset = d.oppositeSides ? (dRB + dLB) : Math.abs(dRB - dLB);          // D26
  const dPOC = dAlong * dOffset;                                                // D27
  const dCalc = { dStartPct, dEndPct, dStartProb, dEndProb, dAlong, dLB, dRB, dOffset, dPOC, refFlight };

  // ── Section B chain, computed per SRU using its assigned sub-area ──
  const b9ByRegion = {}, a2ByRegion = {};
  setup.subAreas.forEach(sa => {
    b9ByRegion[sa.letter] = sruBase.filter(s=>s.region===sa.letter).reduce((a,s)=>a+s.mileage,0);
    a2ByRegion[sa.letter] = sa.searchAreaLength;
  });
  const sruFlat = sruBase.map(s => {
    const b9 = b9ByRegion[s.region] || 0;                          // B9 (within sub-area)
    const trackPortion = b9 > 0 ? s.mileage / b9 : 0;              // B10
    const segLength = trackPortion * (a2ByRegion[s.region] || 0);  // B11 = B10 × A2
    const numTracks = segLength > 0 ? s.mileage / segLength : 0;   // B12
    const fullTracks = Math.round(numTracks);                      // B13
    return { ...s, b9, trackPortion, segLength, numTracks, fullTracks };
  });

  // ── Per sub-area: Section C comparison ──
  const subCalcs = setup.subAreas.map(sa => {
    const mine = sruFlat.filter(s => s.region === sa.letter);
    const active = mine.filter(s => s.fullTracks > 0);
    const avgFullTracks = active.length ? active.reduce((a,s)=>a+s.fullTracks,0)/active.length : 0;
    const avgSweepWidth = active.length ? active.reduce((a,s)=>a+s.sweepWidth,0)/active.length : 0;
    const offsetCalcs = setup.offsets.map(o => {
      const segWidth = 2 * o.offset;                                       // C15
      const trackSpacing = avgFullTracks > 0 ? segWidth / avgFullTracks : 0; // C16
      const coverage = trackSpacing > 0 ? avgSweepWidth / trackSpacing : 0;  // C17
      const pod = coverage > 0 ? 1 - Math.exp(-coverage) : 0;                // C18
      const pOffset = asadLookup(ASAD_OFFSET, o.offset);                     // P_offset
      const poc = sa.pAlongTrack * pOffset;                                  // C19 = P_T × P_offset
      const pos = pod * poc;                                                 // C20
      return { ...o, segWidth, trackSpacing, coverage, pod, pOffset, poc, pos };
    });
    const bestPOS = offsetCalcs.reduce((b,o)=>o.pos>b?o.pos:b,0);
    const idx = (sa.selectedOffsetIdx != null && offsetCalcs[sa.selectedOffsetIdx]) ? sa.selectedOffsetIdx : null;
    const chosenPOS = idx != null ? offsetCalcs[idx].pos : 0;
    return { letter: sa.letter, srus: mine, avgFullTracks, avgSweepWidth, offsetCalcs, bestPOS, chosenIdx: idx, chosenPOS };
  });

  const totalMileage = sruBase.reduce((a,s)=>a+s.mileage,0);
  const totalPOS = subCalcs.reduce((a,sc)=>a+sc.chosenPOS,0);
  return { sruBase, sruFlat, subCalcs, totalMileage, totalPOS, dCalc };
}

/* ═══ SHARED COMPONENTS ═══ */
function In({ value, onChange, className="", type="number", step, min, placeholder, dec }) {
  const [draft, setDraft] = useState(null); // null = not editing, use parent value
  const [prevValue, setPrevValue] = useState(value);
  const isEditing = draft !== null;
  const fmt = v => (dec!=null && type==="number" && v!=null && isFinite(v)) ? Number(v).toFixed(dec) : (v ?? "");
  const displayValue = isEditing ? draft : fmt(value);

  const commit = (raw) => {
    const v = type === "number" ? (raw === "" || raw === "-" ? 0 : parseFloat(raw)) : raw;
    if (type === "number" && isNaN(v)) { setDraft(null); return; }
    onChange(v);
    setDraft(null);
  };

  return <input type="text" inputMode={type==="number"?"decimal":"text"}
    value={displayValue} placeholder={placeholder} step={step} min={min}
    onFocus={e => { setPrevValue(value); setDraft(String(value ?? "")); e.target.select(); }}
    onChange={e => setDraft(e.target.value)}
    onBlur={e => { if (isEditing) commit(draft); }}
    onKeyDown={e => {
      if (e.key === "Enter") { e.target.blur(); }
      else if (e.key === "Escape") { setDraft(null); onChange(prevValue); e.target.blur(); }
    }}
    className={`w-full border border-gray-300 px-1 py-0.5 text-xs text-center rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 bg-white ${className}`}/>;
}
function Cv({ value, fmt="dec3", className="" }) {
  let d="";
  if (value!=null && !isNaN(value) && isFinite(value)) {
    if (fmt==="dec3") d=value.toFixed(3); else if (fmt==="dec2") d=value.toFixed(2);
    else if (fmt==="dec1") d=value.toFixed(1); else if (fmt==="int") d=Math.round(value).toString();
    else d=value.toString();
  }
  return <div className={`text-xs text-center font-mono py-0.5 px-0.5 ${className}`}>{d}</div>;
}
// Hover "i" — instant styled tooltip (native title was slow / rendered oversized on Linux)
function Info({ tip }) {
  return <span className="relative inline-block ml-1 align-middle group">
    <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-gray-300 text-gray-700 text-[8px] font-bold leading-none cursor-help">i</span>
    <span className="pointer-events-none absolute left-4 -top-1 z-50 hidden group-hover:block w-60 bg-gray-800 text-white text-[10px] font-normal normal-case rounded p-2 shadow-lg whitespace-normal text-left">{tip}</span>
  </span>;
}

/* ═══ REGIONS PANEL — POC auto-fills from Consensus; Area auto-sums from segments ═══ */
function RegionsPanel({ regions, onUpdate, consensusActive }) {
  const u = (i,f,v) => { const n=[...regions]; n[i]={...n[i],[f]:v}; onUpdate(n); };
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-gray-700">Regions</span>
        <div className="flex gap-1">
          <button onClick={()=>regions.length<MAX_REGIONS&&onUpdate([...regions,mkRegion(REGION_LETTERS[regions.length])])} className="text-[10px] px-1.5 py-0.5 bg-green-600 text-white rounded">+</button>
          <button onClick={()=>regions.length>1&&onUpdate(regions.slice(0,-1))} className="text-[10px] px-1.5 py-0.5 bg-red-600 text-white rounded">−</button>
        </div>
      </div>
      <table className="text-xs border-collapse w-full"><thead><tr className="bg-gray-700 text-white">
        <th className="px-1 py-0.5">Rgn</th><th className="px-1 py-0.5">POC</th><th className="px-1 py-0.5">Area</th><th className="px-1 py-0.5">Segs</th>
      </tr></thead><tbody>{regions.map((r,i)=>(
        <tr key={i} className={i%2?"bg-gray-50":"bg-white"}>
          <td className="px-1 py-0.5 font-bold text-gray-600 text-center">{r.letter}</td>
          <td className="px-0.5">{consensusActive
            ? <Cv value={r.poc} className="text-blue-700 font-semibold"/>
            : <In value={r.poc} onChange={v=>u(i,"poc",v)} step="0.001" className="w-14"/>}</td>
          <td className="px-0.5"><Cv value={r.area} fmt="dec2" className="text-gray-600"/></td>
          <td className="px-0.5"><In value={r.numSegments} onChange={v=>u(i,"numSegments",Math.max(1,Math.round(v)))} step="1" min="1" className="w-10"/></td>
        </tr>))}</tbody>
        <tfoot><tr className="bg-gray-200 font-bold text-xs">
          <td></td><td className="text-center">{regions.reduce((a,r)=>a+r.poc,0).toFixed(3)}</td>
          <td className="text-center">{regions.reduce((a,r)=>a+r.area,0).toFixed(2)}</td>
          <td className="text-center">{regions.reduce((a,r)=>a+r.numSegments,0)}</td>
        </tr></tfoot>
      </table>
    </div>
  );
}

/* ═══ CONSENSUS PANEL — auto-applies to Region POC (weight = column Σ ÷ grand Σ, verified) ═══ */
function ConsensusPanel({ regions, evaluators, onUpdateEval }) {
  const uN=(i,n)=>{const e=[...evaluators];e[i]={...e[i],name:n};onUpdateEval(e);};
  const uR=(ei,rl,v)=>{const e=[...evaluators];e[ei]={...e[ei],ratings:{...e[ei].ratings,[rl]:v}};onUpdateEval(e);};
  const { pocs, grand } = consensusPOCs(regions, evaluators);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-gray-700">Consensus <span className="font-normal text-[9px] text-gray-400">auto-applies to Region POC</span></span>
        <div className="flex gap-1">
          <button onClick={()=>onUpdateEval([...evaluators,mkEval("")])} className="text-[10px] px-1.5 py-0.5 bg-green-600 text-white rounded">+</button>
          <button onClick={()=>evaluators.length>1&&onUpdateEval(evaluators.slice(0,-1))} className="text-[10px] px-1.5 py-0.5 bg-red-600 text-white rounded">−</button>
        </div>
      </div>
      <div className="overflow-x-auto"><table className="text-xs border-collapse"><thead><tr className="bg-gray-700 text-white">
        <th className="px-1 py-0.5 text-left min-w-[60px]">Name</th>
        {regions.map(r=><th key={r.letter} className="px-1 py-0.5 min-w-[36px]">{r.letter}</th>)}
        <th className="px-1 py-0.5 min-w-[40px] text-red-300">Total</th>
      </tr></thead><tbody>{evaluators.map((ev,ei)=>{
        const total=regions.reduce((s,r)=>s+(ev.ratings[r.letter]||0),0);
        return(<tr key={ei} className={ei%2?"bg-gray-50":"bg-white"}>
          <td className="px-0.5"><In value={ev.name} type="text" onChange={v=>uN(ei,v)} placeholder="Name" className="w-14 text-[10px]"/></td>
          {regions.map(r=><td key={r.letter} className="px-0.5"><In value={ev.ratings[r.letter]||0} onChange={v=>uR(ei,r.letter,v)} step="1" className="w-9 text-[10px]"/></td>)}
          <td className="px-1 text-center font-bold text-red-600">{total}</td>
        </tr>);})}</tbody>
        <tfoot><tr className="bg-gray-200 font-bold">
          <td className="px-1 py-0.5 text-[10px]">Weights</td>
          {regions.map((r,i)=><td key={r.letter} className="px-1 text-center font-mono text-[10px]">{grand>0?pocs[i].toFixed(3).replace(/^0/,""):"—"}</td>)}
          <td className="px-1 text-center text-[10px]">{grand||""}</td>
        </tr></tfoot>
      </table></div>
    </div>
  );
}

/* ═══ GROUND SEGMENTS TABLE ═══ */
function GndSegTable({ segments, startPocs, onUpdateSeg, searchAssign, onUpdateAssign }) {
  const calcs = useMemo(()=>segments.map((s,i)=>calcGndSeg(s,startPocs[i]||0)),[segments,startPocs]);
  const weights = useMemo(()=>{const p=calcs.map(c=>c.psr);const t=p.reduce((a,b)=>a+b,0);return p.map(v=>t>0?v/t:0);},[calcs]);
  const sCalcs = useMemo(()=>searchAssign?segments.map((s,i)=>calcGndSearch(s,startPocs[i]||0,searchAssign[i]||0)):null,[segments,startPocs,searchAssign]);
  const totalPOS = sCalcs?sCalcs.reduce((a,c)=>a+c.pos,0):0;
  const u=(i,f,v)=>{const n=[...segments];n[i]={...n[i],[f]:v};onUpdateSeg(n);};

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-bold text-gray-700">Segments</span>
        <div className="flex gap-1 text-[10px] text-gray-400 overflow-x-auto">
          <span>PSR weight<Info tip="Each segment's share of total PSR — where effort pays off most."/>:</span>{weights.map((w,i)=><span key={i} className="font-mono">.{Math.round(w*1000).toString().padStart(3,"0")}</span>)}
        </div>
      </div>
      <div className="overflow-x-auto border rounded"><table className="text-xs border-collapse"><tbody>
        {/* Segment ID */}
        <tr className="bg-gray-200"><td className="px-2 py-0.5 font-bold sticky left-0 bg-gray-200 z-10 border-r min-w-[130px]">4. Segment<Info tip="Segment ID: region letter + number. Segments are the pieces each region is divided into for searching."/></td>
          {segments.map((s,i)=><td key={i} className="px-0.5 py-0.5 text-center font-bold min-w-[60px]">{s.id}</td>)}</tr>
        {/* A5: Length */}
        <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">5. Length (mi)<Info tip="Length of the segment along the direction of searcher travel, in miles."/></td>
          {segments.map((s,i)=><td key={i} className="px-0.5 py-0.5"><In value={s.length} onChange={v=>u(i,"length",v)} step="0.01" className="text-[10px]"/></td>)}</tr>
        {/* A6: Baseline */}
        <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">6. Baseline (mi)<Info tip="Width of the segment perpendicular to travel, in miles. Searcher spacing divides this line among the team."/></td>
          {segments.map((s,i)=><td key={i} className="px-0.5 py-0.5"><In value={s.baseline} onChange={v=>u(i,"baseline",v)} step="0.01" className="text-[10px]"/></td>)}</tr>
        {/* A7: Area — computed L×B, overridable for non-rectangular segments */}
        <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">7. Area (mi²)<Info tip="Segment area in square miles. Defaults to Length × Baseline — type a different value for non-rectangular segments. Region Area is the sum of its segments."/></td>
          {segments.map((s,i)=>{
            const computed = (s.length||0)*(s.baseline||0);
            const overridden = s.areaOverride != null && s.areaOverride > 0;
            return <td key={i} className="px-0.5 py-0.5"><In value={overridden ? s.areaOverride : computed}
              onChange={v=>u(i,"areaOverride", v>0 && Math.abs(v-computed)>1e-9 ? v : null)} step="0.01"
              className={`text-[10px] ${overridden?"bg-amber-50 border-amber-400":""}`}/></td>;
          })}</tr>
        {/* A8: POC (calculated) */}
        <tr className="border-b bg-blue-50"><td className="px-2 py-0.5 font-semibold text-blue-700 bg-blue-50 sticky left-0 z-10 border-r">8. Seg POC<Info tip="Probability the subject is in this segment: region POC split by this segment's share of the region's area. In Search #2 and later this is the previous search's POC Remaining, carried forward."/></td>
          {calcs.map((c,i)=><td key={i}><Cv value={c.poc} className="text-blue-700 font-semibold"/></td>)}</tr>
        {/* A9: Sweep Width */}
        <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">9. Sweep Width (ft)<Info tip="Effective sweep width per searcher, in feet, from sweep width tables or detection experiments."/></td>
          {segments.map((s,i)=><td key={i} className="px-0.5 py-0.5"><In value={s.sweepWidth} onChange={v=>u(i,"sweepWidth",v)} step="1" className="text-[10px]"/></td>)}</tr>
        {/* A10: Speed */}
        <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">10. Speed (mph)<Info tip="Searcher travel speed while searching, mph."/></td>
          {segments.map((s,i)=><td key={i} className="px-0.5 py-0.5"><In value={s.searchSpeed} onChange={v=>u(i,"searchSpeed",v)} step="0.01" className="text-[10px]"/></td>)}</tr>
        {/* A11: Time to Search — EDITABLE, defaults to min */}
        <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">
          11. Time to Search (hr)<Info tip="Hours the team will spend searching. Defaults to Length ÷ Speed rounded to 1 decimal (the original's rule, shown as 3 decimals like the book); type to override."/></td>
          {segments.map((s,i)=><td key={i} className="px-0.5 py-0.5">
            <In value={s.timeOverride !== null ? s.timeOverride : (calcs[i]?.minTime || 0)} dec={3}
              onChange={v => u(i, "timeOverride", v > 0 ? v : null)}
              step="0.1" className={`text-[10px] ${s.timeOverride !== null ? "bg-yellow-50 border-yellow-400" : ""}`}/>
          </td>)}</tr>
        {/* A11a: Team Tracks — manual, default 1 (matches original) */}
        <tr className="border-b bg-green-50"><td className="px-2 py-0.5 font-semibold text-green-700 bg-green-50 sticky left-0 z-10 border-r">11a. Team Tracks<Info tip="Number of passes the team makes through the segment. Manual value, default 1 — matches the original program."/></td>
          {segments.map((s,i)=><td key={i} className="px-0.5 py-0.5"><In value={s.tracks||1} onChange={v=>u(i,"tracks",Math.max(1,Math.round(v)))} step="1" min="1" className="text-[10px]"/></td>)}</tr>
        {/* A11b: Time in Segment = A11 × A11a (verified) */}
        <tr className="border-b bg-green-50"><td className="px-2 py-0.5 font-semibold text-green-700 bg-green-50 sticky left-0 z-10 border-r">11b. Time in Seg (hr)<Info tip="Total time in the segment = Time to Search × Team Tracks. This drives Coverage."/></td>
          {calcs.map((c,i)=><td key={i}><Cv value={c.timeInSeg} className="text-green-700"/></td>)}</tr>
        {/* A12: PSR — FIXED: (A10 × A9 × A8) ÷ A7 */}
        <tr className="border-b bg-amber-50"><td className="px-2 py-0.5 font-bold text-amber-800 bg-amber-50 sticky left-0 z-10 border-r">12. PSR<Info tip="Probable Success Rate — how much POC one unit of effort recovers here (Speed × Sweep × POC ÷ Area). Ranks segments; Auto-Allocate pours searchers until PSR-After levels out."/></td>
          {calcs.map((c,i)=><td key={i}><Cv value={c.psr} fmt="dec2" className="text-amber-800 font-bold"/></td>)}</tr>

        {/* Section B: Search Allocation */}
        {searchAssign&&<>
          <tr className="bg-gray-300"><td colSpan={segments.length+1} className="px-2 py-0.5 font-bold text-[10px]">
            B — EFFORT ALLOCATION | {Object.values(searchAssign).reduce((a,b)=>a+b,0)} searchers | POS: {(totalPOS*100).toFixed(1)}%</td></tr>
          {/* B13: Searchers */}
          <tr className="border-b"><td className="px-2 py-0.5 font-semibold bg-yellow-50 sticky left-0 z-10 border-r">13. Searchers<Info tip="Searchers assigned to this segment this period. Auto-Allocate fills these; you can edit any cell by hand."/></td>
            {segments.map((_,i)=><td key={i} className="px-0.5 py-0.5"><In value={searchAssign[i]||0} onChange={v=>onUpdateAssign(i,v)} step="1" min="0" className="text-[10px] bg-yellow-50 border-yellow-300"/></td>)}</tr>
          {/* B14: Spacing */}
          <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">14. Spacing (ft)<Info tip="Distance between searchers on the baseline, in feet (Baseline × 5280 ÷ Searchers ÷ Tracks). Display only — the original does not use it in Coverage."/></td>
            {sCalcs.map((c,i)=><td key={i}><Cv value={c.sp} fmt="int" className="bg-gray-100"/></td>)}</tr>
          {/* B15: Coverage = effort-based (verified against original; NOT sweep÷spacing) */}
          <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">15. Coverage<Info tip="Effort ÷ area: (Searchers × Speed × Time in Seg × Sweep÷5280) ÷ Area, rounded to 2 decimals like the original. POD is computed from the rounded value."/></td>
            {sCalcs.map((c,i)=><td key={i}><Cv value={c.cov} fmt="dec2" className="bg-gray-100"/></td>)}</tr>
          {/* B16: POD */}
          <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-blue-700 bg-blue-50 sticky left-0 z-10 border-r">16. POD<Info tip="Probability of detecting the subject IF they are in the segment: 1 − e^(−Coverage)."/></td>
            {sCalcs.map((c,i)=><td key={i}><Cv value={c.pod} className="bg-blue-50 text-blue-700 font-semibold"/></td>)}</tr>
          {/* B17: POS */}
          <tr className="border-b bg-emerald-50"><td className="px-2 py-0.5 font-bold text-emerald-800 bg-emerald-100 sticky left-0 z-10 border-r">17. POS<Info tip="Probability of success this search = POC × POD."/></td>
            {sCalcs.map((c,i)=><td key={i}><Cv value={c.pos} className="text-emerald-800 font-bold"/></td>)}</tr>
          {/* B18: POC Remaining */}
          <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">18. POC Remain<Info tip="POC left after this search (POC − POS). Becomes this segment's starting POC next search period."/></td>
            {sCalcs.map((c,i)=><td key={i}><Cv value={c.pocRem} className="bg-gray-100"/></td>)}</tr>
          {/* B19: PSR After — FIXED: (A10 × A9 × B18) ÷ A7 */}
          <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">19. PSR After<Info tip="PSR recomputed with POC Remaining. Auto-Allocate equalizes this across every funded segment — the original's optimizer behavior."/></td>
            {sCalcs.map((c,i)=><td key={i}><Cv value={c.psrAfter} fmt="dec2" className="bg-gray-100"/></td>)}</tr>
        </>}
      </tbody></table></div>
    </div>
  );
}

/* ═══ AIR ASAD WORKSHEET — Sections A, B, C, and optional D ═══ */
function AirSRUTable({ setup, onUpdate }) {
  const res = useMemo(()=>calcAirSearch(setup),[setup]);
  const uSRU=(i,f,v)=>{const s={...setup,srus:[...setup.srus]};s.srus[i]={...s.srus[i],[f]:v};onUpdate(s);};
  const uOff=(i,f,v)=>{const s={...setup,offsets:[...setup.offsets]};s.offsets[i]={...s.offsets[i],[f]:v};onUpdate(s);};
  const uSA=(i,f,v)=>{const s={...setup,subAreas:[...setup.subAreas]};s.subAreas[i]={...s.subAreas[i],[f]:v};onUpdate(s);};
  const uD=(f,v)=>onUpdate({...setup,dSeg:{...(setup.dSeg||mkDSeg()),[f]:v}});
  const d = res.dCalc;
  const multi = setup.subAreas.length > 1;
  const letters = setup.subAreas.map(sa=>sa.letter);

  const addSubArea=()=>{
    if(setup.subAreas.length>=MAX_REGIONS) return;
    const letter = REGION_LETTERS[setup.subAreas.length];
    onUpdate({...setup, subAreas:[...setup.subAreas, mkSubArea(letter)], useD:true}); // adding a sub-area opens D
  };
  const rmSubArea=()=>{
    if(setup.subAreas.length<=1) return;
    const dropped = setup.subAreas[setup.subAreas.length-1].letter;
    onUpdate({...setup,
      subAreas:setup.subAreas.slice(0,-1),
      srus:setup.srus.map(s=>s.region===dropped?{...s,region:setup.subAreas[0].letter}:s)});
  };

  return (
    <div className="flex flex-col gap-3">
      {/* ── Section A — Search Area & Sub-Areas ── */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-gray-700">A — SEARCH AREA & SUB-AREAS <span className="font-normal text-gray-400">(1 column per sub-area)</span></span>
          <div className="flex gap-1">
            <button onClick={addSubArea} className="text-[10px] px-1.5 py-0.5 bg-green-600 text-white rounded">+ Sub-Area</button>
            <button onClick={rmSubArea} className="text-[10px] px-1.5 py-0.5 bg-red-600 text-white rounded">− Sub-Area</button>
          </div>
        </div>
        <div className="border rounded overflow-x-auto"><table className="text-xs border-collapse"><tbody>
          <tr className="bg-gray-200"><td className="px-2 py-0.5 font-bold sticky left-0 bg-gray-200 z-10 border-r min-w-[200px]">Sub-Area</td>
            {setup.subAreas.map((sa,i)=><td key={i} className="px-1 py-0.5 text-center font-bold min-w-[80px]">{sa.letter}</td>)}</tr>
          <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">1. Length of Flight (nm)</td>
            {setup.subAreas.map((sa,i)=><td key={i} className="px-0.5 py-0.5"><In value={sa.flightLength} onChange={v=>uSA(i,"flightLength",v)} step="1" className="text-[10px]"/></td>)}</tr>
          <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">2. Length of Search Area (nm)
            <button onClick={()=>setup.subAreas.forEach((sa,i)=>uSA(i,"searchAreaLength",(sa.flightLength||0)+20))} className="ml-1 text-[9px] px-1 bg-gray-500 text-white rounded" title="flight + 20 nm">+20</button></td>
            {setup.subAreas.map((sa,i)=><td key={i} className="px-0.5 py-0.5"><In value={sa.searchAreaLength} onChange={v=>uSA(i,"searchAreaLength",v)} step="1" className="text-[10px]"/></td>)}</tr>
        </tbody></table></div>
        {!multi && <div className="mt-1 text-[10px] text-gray-400">One sub-area = whole-route search. Add a sub-area to segment the search (jurisdiction, terrain, sweep-width changes); that opens Section D for per-segment POC.</div>}
        <div className="mt-1 px-2 py-0.5 bg-gray-800 text-white rounded text-xs inline-block">Total SRU Mileage: <span className="font-mono font-bold">{res.totalMileage.toFixed(1)} nm</span></div>
      </div>

      {/* ── Section B ── */}
      <div className="overflow-x-auto">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-gray-700">B — EFFORT & SEARCH SET-UP <span className="font-normal text-gray-400">(1 column per SRU)</span></span>
          <div className="flex gap-1">
            <button onClick={()=>setup.srus.length<MAX_SRUS&&onUpdate({...setup,srus:[...setup.srus,mkSRU(`SRU-${setup.srus.length+1}`,setup.subAreas[0].letter)]})} className="text-[10px] px-1.5 py-0.5 bg-green-600 text-white rounded">+ SRU</button>
            <button onClick={()=>setup.srus.length>1&&onUpdate({...setup,srus:setup.srus.slice(0,-1)})} className="text-[10px] px-1.5 py-0.5 bg-red-600 text-white rounded">− SRU</button>
          </div>
        </div>
        <div className="border rounded"><table className="text-xs border-collapse"><tbody>
          <tr className="bg-gray-200"><td className="px-2 py-0.5 font-bold sticky left-0 bg-gray-200 z-10 border-r min-w-[200px]">3. SRU Designation</td>
            {setup.srus.map((s,i)=><td key={i} className="px-0.5 py-0.5 min-w-[80px]"><In value={s.id} type="text" onChange={v=>uSRU(i,"id",v)} className="text-[10px] font-bold"/></td>)}</tr>
          {multi && <tr className="border-b bg-blue-50"><td className="px-2 py-0.5 font-semibold text-blue-700 bg-blue-50 sticky left-0 z-10 border-r">3a. Region</td>
            {setup.srus.map((s,i)=><td key={i} className="px-0.5 py-0.5 text-center">
              <select value={s.region} onChange={e=>uSRU(i,"region",e.target.value)} className="text-[10px] border border-gray-300 rounded bg-white px-0.5 py-0.5">
                {letters.map(l=><option key={l} value={l}>{l}</option>)}
              </select></td>)}</tr>}
          <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">4. Sweep Width — corrected (nm)</td>
            {setup.srus.map((s,i)=><td key={i} className="px-0.5 py-0.5"><In value={s.sweepWidth} onChange={v=>uSRU(i,"sweepWidth",v)} step="0.01" className="text-[10px]"/></td>)}</tr>
          <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">5a. Endurance — Fuel (hr)</td>
            {setup.srus.map((s,i)=><td key={i} className="px-0.5 py-0.5"><In value={s.fuelEndurance} onChange={v=>uSRU(i,"fuelEndurance",v)} step="0.1" className="text-[10px]"/></td>)}</tr>
          <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">5b. Endurance — Daylight/Wx (hr)</td>
            {setup.srus.map((s,i)=><td key={i} className="px-0.5 py-0.5"><In value={s.daylightEndurance} onChange={v=>uSRU(i,"daylightEndurance",v)} step="0.1" className="text-[10px]"/></td>)}</tr>
          <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">5c. Endurance — Observer (hr)</td>
            {setup.srus.map((s,i)=><td key={i} className="px-0.5 py-0.5"><In value={s.observerEndurance} onChange={v=>uSRU(i,"observerEndurance",v)} step="0.1" className="text-[10px]"/></td>)}</tr>
          <tr className="border-b bg-green-50"><td className="px-2 py-0.5 font-semibold text-green-700 bg-green-50 sticky left-0 z-10 border-r">6. Search Endurance <span className="font-normal text-[9px]">least of 5a/b/c</span></td>
            {res.sruFlat.map((s,i)=><td key={i}><Cv value={s.searchEndurance} fmt="dec1" className="text-green-700 font-semibold"/></td>)}</tr>
          <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">7. Search Craft Speed (kts)</td>
            {setup.srus.map((s,i)=><td key={i} className="px-0.5 py-0.5"><In value={s.craftSpeed} onChange={v=>uSRU(i,"craftSpeed",v)} step="1" className="text-[10px]"/></td>)}</tr>
          <tr className="border-b bg-green-50"><td className="px-2 py-0.5 font-semibold text-green-700 bg-green-50 sticky left-0 z-10 border-r">8. SRU Mileage <span className="font-normal text-[9px]">B6×B7</span></td>
            {res.sruFlat.map((s,i)=><td key={i}><Cv value={s.mileage} fmt="dec1" className="text-green-700 font-bold"/></td>)}</tr>
          <tr className="border-b bg-green-50"><td className="px-2 py-0.5 font-semibold text-green-700 bg-green-50 sticky left-0 z-10 border-r">9. Total Mileage in Sub-Area <span className="font-normal text-[9px]">Σ B8 in region</span></td>
            {res.sruFlat.map((s,i)=><td key={i}><Cv value={s.b9} fmt="dec1" className="text-green-700"/></td>)}</tr>
          <tr className="border-b bg-green-50"><td className="px-2 py-0.5 font-semibold text-green-700 bg-green-50 sticky left-0 z-10 border-r">10. Track Portion <span className="font-normal text-[9px]">B8÷B9</span></td>
            {res.sruFlat.map((s,i)=><td key={i}><Cv value={s.trackPortion} className="text-green-700"/></td>)}</tr>
          <tr className="border-b bg-green-50"><td className="px-2 py-0.5 font-semibold text-green-700 bg-green-50 sticky left-0 z-10 border-r">11. Segment Length (nm) <span className="font-normal text-[9px]">B10×A2</span></td>
            {res.sruFlat.map((s,i)=><td key={i}><Cv value={s.segLength} fmt="dec1" className="text-green-700"/></td>)}</tr>
          <tr className="border-b bg-green-50"><td className="px-2 py-0.5 font-semibold text-green-700 bg-green-50 sticky left-0 z-10 border-r">12. Number of Tracks <span className="font-normal text-[9px]">B8÷B11</span></td>
            {res.sruFlat.map((s,i)=><td key={i}><Cv value={s.numTracks} fmt="dec2" className="text-green-700"/></td>)}</tr>
          <tr className="border-b bg-amber-50"><td className="px-2 py-0.5 font-bold text-amber-800 bg-amber-50 sticky left-0 z-10 border-r">13. Full Tracks <span className="font-normal text-[9px]">round B12</span></td>
            {res.sruFlat.map((s,i)=><td key={i}><Cv value={s.fullTracks} fmt="int" className="text-amber-800 font-bold"/></td>)}</tr>
        </tbody></table></div>
      </div>

      {/* ── Section C — one POS comparison per sub-area ── */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-gray-700">C — POS COMPARISONS <span className="font-normal text-gray-400">(click a POS cell to select the offset for each sub-area)</span></span>
          <div className="flex gap-1">
            <button onClick={()=>setup.offsets.length<MAX_OFFSETS&&onUpdate({...setup,offsets:[...setup.offsets,mkOffset(0)]})} className="text-[10px] px-1.5 py-0.5 bg-green-600 text-white rounded">+ Offset</button>
            <button onClick={()=>setup.offsets.length>1&&onUpdate({...setup,offsets:setup.offsets.slice(0,-1)})} className="text-[10px] px-1.5 py-0.5 bg-red-600 text-white rounded">− Offset</button>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {res.subCalcs.map((sc,si)=>(
            <div key={si} className="border rounded">
              <div className="bg-gray-700 text-white px-2 py-1 flex items-center justify-between text-xs flex-wrap gap-2">
                <span className="font-bold">Sub-Area {sc.letter}{multi?` — POS Comparison`:""}</span>
                <span className="flex items-center gap-1 text-gray-300">Prob Along Track (P_T):
                  <span onClick={e=>e.stopPropagation()}><In value={setup.subAreas[si].pAlongTrack} onChange={v=>uSA(si,"pAlongTrack",v)} step="0.001" className="w-16"/></span>
                  {sc.chosenIdx!=null && <span className="ml-2">selected POS <span className="font-mono font-bold text-emerald-300">{(sc.chosenPOS*100).toFixed(1)}%</span></span>}</span>
              </div>
              <div className="overflow-x-auto"><table className="text-xs border-collapse"><tbody>
                <tr className="bg-gray-200"><td className="px-2 py-0.5 font-bold sticky left-0 bg-gray-200 z-10 border-r min-w-[200px]">14. Offset (nm)</td>
                  {setup.offsets.map((o,i)=><td key={i} className="px-0.5 py-0.5 min-w-[70px]"><In value={o.offset} onChange={v=>uOff(i,"offset",v)} step="0.5" className="text-[10px]"/></td>)}</tr>
                <tr className="border-b bg-green-50"><td className="px-2 py-0.5 font-semibold text-green-700 bg-green-50 sticky left-0 z-10 border-r">15. Search Segment Width (nm) <span className="font-normal text-[9px]">2×offset</span></td>
                  {sc.offsetCalcs.map((o,i)=><td key={i}><Cv value={o.segWidth} fmt="dec1" className="text-green-700"/></td>)}</tr>
                <tr className="border-b bg-green-50"><td className="px-2 py-0.5 font-semibold text-green-700 bg-green-50 sticky left-0 z-10 border-r">16. Track Spacing (nm) <span className="font-normal text-[9px]">C15÷B13</span></td>
                  {sc.offsetCalcs.map((o,i)=><td key={i}><Cv value={o.trackSpacing} fmt="dec2" className="text-green-700"/></td>)}</tr>
                <tr className="border-b bg-green-50"><td className="px-2 py-0.5 font-semibold text-green-700 bg-green-50 sticky left-0 z-10 border-r">17. Coverage <span className="font-normal text-[9px]">B4÷C16</span></td>
                  {sc.offsetCalcs.map((o,i)=><td key={i}><Cv value={o.coverage} fmt="dec2" className="text-green-700"/></td>)}</tr>
                <tr className="border-b bg-blue-50"><td className="px-2 py-0.5 font-semibold text-blue-700 bg-blue-50 sticky left-0 z-10 border-r">18. POD <span className="font-normal text-[9px]">1−e^(−C)</span></td>
                  {sc.offsetCalcs.map((o,i)=><td key={i}><Cv value={o.pod} className="text-blue-700 font-semibold"/></td>)}</tr>
                <tr className="border-b bg-indigo-50"><td className="px-2 py-0.5 font-semibold text-indigo-700 bg-indigo-50 sticky left-0 z-10 border-r">P_offset <span className="font-normal text-[9px]">ASAD chart</span></td>
                  {sc.offsetCalcs.map((o,i)=><td key={i}><Cv value={o.pOffset} className="text-indigo-700"/></td>)}</tr>
                <tr className="border-b bg-purple-50"><td className="px-2 py-0.5 font-semibold text-purple-700 bg-purple-50 sticky left-0 z-10 border-r">19. POC <span className="font-normal text-[9px]">P_T×P_offset</span></td>
                  {sc.offsetCalcs.map((o,i)=><td key={i}><Cv value={o.poc} className="text-purple-700 font-semibold"/></td>)}</tr>
                <tr className="border-b bg-emerald-50"><td className="px-2 py-0.5 font-bold text-emerald-800 bg-emerald-100 sticky left-0 z-10 border-r">20. POS <span className="font-normal text-[9px]">POD×POC · click to select</span></td>
                  {sc.offsetCalcs.map((o,i)=>{
                    const isBest = Math.abs(o.pos-sc.bestPOS)<0.0001 && sc.bestPOS>0;
                    const isSel = sc.chosenIdx===i;
                    return <td key={i} onClick={()=>uSA(si,"selectedOffsetIdx", isSel?null:i)} className="cursor-pointer">
                      <Cv value={o.pos} className={`font-bold ${isSel?"bg-emerald-300 text-emerald-900 ring-2 ring-emerald-600":isBest?"text-emerald-800 bg-emerald-200":"text-emerald-700 hover:bg-emerald-100"}`}/></td>;
                  })}</tr>
              </tbody></table></div>
            </div>
          ))}
        </div>
        {res.totalPOS > 0 && <div className="mt-2 px-3 py-1.5 bg-gray-800 rounded text-white text-xs">
          POS This Search{multi?" (Σ sub-areas)":""}: <span className="font-mono font-bold text-emerald-400">{(res.totalPOS*100).toFixed(1)}%</span>
        </div>}
      </div>

      {/* ── Section D (optional) ── */}
      <div className="border rounded">
        <button onClick={()=>onUpdate({...setup,useD:!setup.useD})}
          className="w-full text-left bg-gray-700 text-white px-2 py-1 text-xs font-bold flex items-center justify-between">
          <span>D — POC CALCULATIONS <span className="font-normal text-gray-300">(partial track, off-center, or per-segment — uses Sub-Area A's flight length as the total track)</span></span>
          <span className="font-mono">{setup.useD?"▼ hide":"▶ show"}</span>
        </button>
        {setup.useD && <div className="p-2">
          <div className="text-[10px] text-gray-500 mb-2">Enter distances in <b>nautical miles from the LKP</b> (total track = Sub-Area A flight length = {d.refFlight||0} nm). Copy the resulting <b>D23</b> into the matching sub-area's <b>P_T</b> above and pick that offset — POC (Line 19) then equals D27. D27 here is the fully-worked POC for reference.</div>
          <div className="grid gap-x-6 gap-y-1 text-xs" style={{gridTemplateColumns:"auto auto"}}>
            <div className="flex items-center justify-between gap-2"><span className="font-semibold text-gray-600">21. Segment Start Point (nm from LKP)</span>
              <In value={setup.dSeg.startPoint} onChange={v=>uD("startPoint",v)} step="1" className="w-16"/></div>
            <div className="flex items-center justify-between gap-2"><span className="font-semibold text-gray-600">22. Segment End Point (nm from LKP)</span>
              <In value={setup.dSeg.endPoint} onChange={v=>uD("endPoint",v)} step="1" className="w-16"/></div>
            <div className="flex items-center justify-between gap-2 text-gray-500"><span>21a. SP % Along Track <span className="text-[9px]">D21÷A1</span></span>
              <span className="font-mono">{d.dStartPct.toFixed(1)}%</span></div>
            <div className="flex items-center justify-between gap-2 text-gray-500"><span>22a. EP % Along Track <span className="text-[9px]">D22÷A1</span></span>
              <span className="font-mono">{d.dEndPct.toFixed(1)}%</span></div>
            <div className="flex items-center justify-between gap-2 text-gray-500"><span>21b. SP Prob Along Track</span>
              <span className="font-mono">{d.dStartProb.toFixed(3)}</span></div>
            <div className="flex items-center justify-between gap-2 text-gray-500"><span>22b. EP Prob Along Track</span>
              <span className="font-mono">{d.dEndProb.toFixed(3)}</span></div>
            <div className="flex items-center justify-between gap-2 col-span-2 bg-green-50 px-1 rounded"><span className="font-semibold text-green-700">23. Probability Along Track <span className="text-[9px]">D22b−D21b</span></span>
              <span className="font-mono font-bold text-green-700">{d.dAlong.toFixed(3)}</span></div>
            <div className="flex items-center justify-between gap-2"><span className="font-semibold text-gray-600">24. Left Border Offset (nm)</span>
              <In value={setup.dSeg.leftOffset} onChange={v=>uD("leftOffset",v)} step="0.5" className="w-16"/></div>
            <div className="flex items-center justify-between gap-2"><span className="font-semibold text-gray-600">25. Right Border Offset (nm)</span>
              <In value={setup.dSeg.rightOffset} onChange={v=>uD("rightOffset",v)} step="0.5" className="w-16"/></div>
            <div className="flex items-center justify-between gap-2 text-gray-500"><span>24a. LB Prob Offset <span className="text-[9px]">ASAD÷2</span></span>
              <span className="font-mono">{d.dLB.toFixed(3)}</span></div>
            <div className="flex items-center justify-between gap-2 text-gray-500"><span>25a. RB Prob Offset <span className="text-[9px]">ASAD÷2</span></span>
              <span className="font-mono">{d.dRB.toFixed(3)}</span></div>
            <div className="flex items-center gap-2 col-span-2"><span className="font-semibold text-gray-600">Borders are on:</span>
              <label className="flex items-center gap-1"><input type="radio" checked={setup.dSeg.oppositeSides} onChange={()=>uD("oppositeSides",true)}/>opposite sides of centerline (add)</label>
              <label className="flex items-center gap-1"><input type="radio" checked={!setup.dSeg.oppositeSides} onChange={()=>uD("oppositeSides",false)}/>same side (subtract)</label></div>
            <div className="flex items-center justify-between gap-2 col-span-2 bg-green-50 px-1 rounded"><span className="font-semibold text-green-700">26. Probability of Offset <span className="text-[9px]">D25a±D24a</span></span>
              <span className="font-mono font-bold text-green-700">{d.dOffset.toFixed(3)}</span></div>
            <div className="flex items-center justify-between gap-2 col-span-2 bg-purple-100 px-1 rounded"><span className="font-bold text-purple-800">27. POC <span className="text-[9px] font-normal">D23×D26</span></span>
              <span className="font-mono font-black text-purple-800">{d.dPOC.toFixed(3)}</span></div>
          </div>
          <div className="mt-2 text-[10px] text-gray-400">Per Appendix C: segment starting at the LKP (0 nm) → D21b treated as 0; segment reaching the destination → D22b uses the over-100% value (0.989).</div>
        </div>}
      </div>
    </div>
  );
}

/* ═══ MAIN APP ═══ */
export default function App() {
  const [dark, setDark] = useState(false);
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().split("T")[0]);
  const [incidentTime, setIncidentTime] = useState("00:00");
  const [location, setLocation] = useState("");
  const [code, setCode] = useState("");
  const [wsType, setWsType] = useState("ground");
  const [activeTab, setActiveTab] = useState("setup");

  const [regions, setRegions] = useState(()=>[{...mkRegion("A"), numSegments:1}]);
  const [evaluators, setEvaluators] = useState([mkEval("")]);
  const [gndSegs, setGndSegs] = useState(()=>[mkGndSeg("A",1)]);
  const [gndSearches, setGndSearches] = useState({});
  const [airSetups, setAirSetups] = useState({setup: mkAirSetup()});

  const rebuildSegs = useCallback((nr)=>{
    setRegions(nr);
    const ns=[];nr.forEach(r=>{for(let i=1;i<=r.numSegments;i++){const ex=gndSegs.find(s=>s.region===r.letter&&s.segNum===i);ns.push(ex||mkGndSeg(r.letter,i));}});
    setGndSegs(ns);
  },[gndSegs]);

  // Regions with POC auto-derived from consensus (when votes exist) and Area = Σ segment areas.
  // Matches original: no Apply step, everything recomputes live.
  const consensus = useMemo(()=>consensusPOCs(regions, evaluators),[regions, evaluators]);
  const regionsEff = useMemo(()=>regions.map((r,i)=>({
    ...r,
    poc: consensus.grand > 0 ? consensus.pocs[i] : r.poc,
    area: gndSegs.filter(s=>s.region===r.letter).reduce((a,s)=>a+segArea(s),0),
  })),[regions, consensus, gndSegs]);

  const activeSearchNum = activeTab.startsWith("search-")?parseInt(activeTab.split("-")[1]):null;

  // Starting POC per segment for the current view: Setup/#1 = from regions; #N = chained from #N−1 (verified)
  const startPocs = useMemo(()=>chainPocs(gndSegs, regionsEff, gndSearches, activeSearchNum||1),
    [gndSegs, regionsEff, gndSearches, activeSearchNum]);
  const searchPOS = (n)=>{ // total POS of search n under chained POCs
    const pocs = chainPocs(gndSegs, regionsEff, gndSearches, n);
    const srch = gndSearches[n]; if(!srch) return 0;
    return gndSegs.reduce((s,seg,i)=>s+calcGndSearch(seg,pocs[i],(srch.assignments&&srch.assignments[i])||0).pos,0);
  };
  const gndNextNum = Object.keys(gndSearches).length+1;
  const airNextNum = Object.keys(airSetups).filter(k=>k.startsWith("search-")).length+1;

  const createSearch=()=>{
    const n = wsType==="ground"?gndNextNum:airNextNum;
    if(n>MAX_SEARCHES)return;
    if(wsType==="ground") setGndSearches(p=>({...p,[n]:{assignments:{},totalSearchers:0}}));
    else setAirSetups(p=>({...p,[`search-${n}`]:mkAirSetup()}));
    setActiveTab(`search-${n}`);
  };

  // Optimize (verified against original): PSR-equalization "water-fill".
  // Pour searchers into segments so every funded segment's PSR-After lands on a
  // common level λ; segments whose starting PSR is below λ get zero. The original
  // produced 221/79 with equal PSR-After 0.960/0.960 — this reproduces that.
  const allocateSearchers = (searchNum, total) => {
    const pocs = chainPocs(gndSegs, regionsEff, gndSearches, searchNum);
    const cs = gndSegs.map((s,i)=>({s,i,c:calcGndSeg(s,pocs[i])}))
      .filter(x=>x.c.area>0 && x.s.searchSpeed>0 && x.s.sweepWidth>0 && x.c.timeInSeg>0 && x.c.poc>0);
    const assigns = {}; gndSegs.forEach((_,i)=>{assigns[i]=0;});
    if (total>0 && cs.length>0) {
      // searchers needed (unrounded) to pull segment PSR-After down to level lam
      const needed=(x,lam)=>{
        if (x.c.psr<=lam) return 0;
        const k=(x.s.searchSpeed*x.s.sweepWidth)/x.c.area;      // PSR per unit POC
        const podT=1-(lam/k)/x.c.poc;                            // POD needed to reach lam
        if (podT<=0) return 0;
        const cov=-Math.log(Math.max(1-podT,1e-9));
        return (cov*x.c.area*5280)/(x.s.searchSpeed*x.c.timeInSeg*x.s.sweepWidth);
      };
      let lo=0, hi=Math.max(...cs.map(x=>x.c.psr));
      for (let it=0; it<60; it++){
        const mid=(lo+hi)/2;
        (cs.reduce((a,x)=>a+needed(x,mid),0) > total) ? lo=mid : hi=mid;
      }
      let used=0;
      cs.forEach(x=>{ const n=Math.floor(needed(x,hi)); assigns[x.i]=n; used+=n; });
      // distribute integer remainder by marginal POS gain (unrounded coverage so +1 always registers)
      const posU=(x,n)=>{const cov=(n*x.s.searchSpeed*x.c.timeInSeg*x.s.sweepWidth/5280)/x.c.area;return x.c.poc*(1-Math.exp(-cov));};
      while (used<total){
        let best=null, bg=0;
        cs.forEach(x=>{ const g=posU(x,assigns[x.i]+1)-posU(x,assigns[x.i]); if(g>bg){bg=g;best=x;} });
        if (!best) break;
        assigns[best.i]++; used++;
      }
    }
    setGndSearches(p=>({...p,[searchNum]:{...p[searchNum],assignments:assigns,totalSearchers:total}}));
  };

  // Delete a search period (confirm like the original), renumber the ones after it
  const deleteSearch = (n) => {
    if (!window.confirm(`Delete Search #${n}?`)) return;
    setGndSearches(p=>{
      const q={};
      Object.keys(p).map(Number).forEach(k=>{ if(k<n) q[k]=p[k]; else if(k>n) q[k-1]=p[k]; });
      return q;
    });
    setActiveTab(n>1?`search-${n-1}`:"setup");
  };

  return (
    <div style={{fontFamily:"'Inter',system-ui,sans-serif"}} className={`${dark?"sm-dark ":""}h-screen flex flex-col bg-gray-100`}>
      <style>{DARK_CSS}</style>
      <div className="bg-amber-500 text-black px-3 py-0.5 text-center text-[11px] font-semibold shrink-0">
        ⚠ TESTING ONLY — not validated for operational search. Found a bug? Email <a href="mailto:peter.dellavecchia@cowg.cap.gov" className="underline">peter.dellavecchia@cowg.cap.gov</a>
      </div>
      <div className="bg-gray-800 text-white px-3 py-1.5 flex items-center justify-between text-sm shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-emerald-500 rounded flex items-center justify-center text-white">
            {wsType==="ground"
              ? <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M6 2h3.5v8.5c0 .8.5 1.5 1.3 1.8l7 2.6c1 .4 1.7 1.3 1.7 2.4V20H6V2z"/></svg>
              : <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>}
          </div>
          <span className="font-bold">Search Manager</span>
          <span className="text-gray-400">— [{wsType==="ground"?"Ground Search":"Air Search (ASAD)"}]</span>
        </div>
        <div className="flex gap-1 items-center">
          <button onClick={()=>setDark(d=>!d)} title="Toggle dark mode"
            className="px-2 py-1 rounded text-xs font-semibold bg-gray-600 hover:bg-gray-500 mr-1">{dark?"☀ Light":"🌙 Dark"}</button>
          <button onClick={()=>{setWsType("ground");setActiveTab("setup");}}
            className={`px-3 py-1 rounded text-xs font-semibold ${wsType==="ground"?"bg-emerald-600":"bg-gray-600 hover:bg-gray-500"}`}>Ground Search</button>
          <button onClick={()=>{setWsType("air");setActiveTab("setup");}}
            className={`px-3 py-1 rounded text-xs font-semibold ${wsType==="air"?"bg-blue-600":"bg-gray-600 hover:bg-gray-500"}`}>Air Search</button>
        </div>
      </div>

      <div className="bg-gray-700 px-2 py-1 flex items-center gap-0.5 overflow-x-auto shrink-0">
        <button onClick={()=>setActiveTab("setup")}
          className={`px-3 py-1 text-xs font-semibold rounded-t shrink-0 ${activeTab==="setup"?"bg-gray-100 text-gray-900":"text-gray-300 hover:text-white"}`}>Setup</button>
        {Array.from({length:MAX_SEARCHES},(_,i)=>i+1).map(n=>{
          const exists = wsType==="ground"?gndSearches[n]:airSetups[`search-${n}`];
          return <button key={n} onClick={()=>exists&&setActiveTab(`search-${n}`)} disabled={!exists}
            className={`px-2 py-1 text-xs font-semibold rounded-t shrink-0 ${activeTab===`search-${n}`?"bg-gray-100 text-gray-900":exists?"text-gray-300 hover:text-white":"text-gray-500 opacity-40 cursor-default"}`}>Search #{n}</button>;
        })}
      </div>

      <div className="bg-white border-b px-3 py-1.5 flex items-center gap-3 text-xs shrink-0 flex-wrap">
        <label className="flex items-center gap-1"><span className="font-semibold text-gray-600">Date:</span>
          <In value={incidentDate} type="date" onChange={setIncidentDate} className="w-28"/></label>
        <label className="flex items-center gap-1"><span className="font-semibold text-gray-600">Time:</span>
          <In value={incidentTime} type="time" onChange={setIncidentTime} className="w-20"/></label>
        <label className="flex items-center gap-1"><span className="font-semibold text-gray-600">Location:</span>
          <In value={location} type="text" onChange={setLocation} className="w-32"/></label>
        <label className="flex items-center gap-1"><span className="font-semibold text-gray-600">Code:</span>
          <In value={code} type="text" onChange={setCode} className="w-20"/></label>
        <button onClick={createSearch} className="ml-auto px-3 py-1 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700 shrink-0">Create Search</button>
      </div>

      {wsType==="ground" ? (
        <div className="flex-1 flex flex-col p-2 gap-2 overflow-hidden min-h-0">
          <div className="flex gap-2 shrink-0" style={{maxHeight:"50%"}}>
            <div className="overflow-y-auto border rounded bg-white p-2" style={{minWidth:210,maxWidth:220}}>
              <RegionsPanel regions={regionsEff} onUpdate={rebuildSegs} consensusActive={consensus.grand>0}/></div>
            <div className="overflow-auto border rounded bg-white p-2 flex-1">
              <ConsensusPanel regions={regions} evaluators={evaluators} onUpdateEval={setEvaluators}/></div>
            {activeSearchNum&&gndSearches[activeSearchNum]&&(
              <div className="border rounded bg-white p-3 shrink-0 flex flex-col items-center justify-center gap-1" style={{minWidth:150}}>
                <div className="text-xs font-bold text-gray-500">Search #{activeSearchNum}</div>
                <div className="text-xs text-gray-400">POS</div>
                <div className="text-2xl font-mono font-black text-emerald-600">
                  {(searchPOS(activeSearchNum)*100).toFixed(1)}%</div>
                <div className="text-xs text-gray-400">POScum</div>
                <div className="text-lg font-mono font-bold text-gray-700">
                  {(Object.keys(gndSearches).map(Number).filter(k=>k<=activeSearchNum).reduce((cum,k)=>cum+searchPOS(k),0)*100).toFixed(1)}%</div>
                <div className="w-full border-t mt-1 pt-1.5 flex flex-col items-center gap-1">
                  <label className="text-[10px] font-semibold text-gray-500">Total Searchers</label>
                  <In value={gndSearches[activeSearchNum].totalSearchers||0} step="1" min="0" className="w-16"
                    onChange={v=>setGndSearches(p=>({...p,[activeSearchNum]:{...p[activeSearchNum],totalSearchers:Math.max(0,Math.round(v))}}))}/>
                  <button onClick={()=>allocateSearchers(activeSearchNum, gndSearches[activeSearchNum].totalSearchers||0)}
                    className="px-2 py-1 bg-emerald-600 text-white rounded text-[10px] font-bold hover:bg-emerald-700 w-full">Auto-Allocate</button>
                  <button onClick={()=>deleteSearch(activeSearchNum)}
                    className="px-2 py-1 bg-red-600 text-white rounded text-[10px] font-bold hover:bg-red-700 w-full">Delete This Search</button>
                  {(() => { const tot=gndSearches[activeSearchNum].totalSearchers||0;
                    const used=Object.values(gndSearches[activeSearchNum].assignments||{}).reduce((a,b)=>a+b,0);
                    return tot>0 && <div className="text-[9px] text-gray-400">{used} of {tot} placed{used<tot?" (rest add no POS)":""}</div>; })()}
                </div>
              </div>)}
          </div>
          <div className="overflow-auto border rounded bg-white p-2 flex-1 min-h-0">
            <GndSegTable segments={gndSegs} startPocs={startPocs} onUpdateSeg={setGndSegs}
              searchAssign={activeSearchNum?gndSearches[activeSearchNum]?.assignments:null}
              onUpdateAssign={activeSearchNum?(i,v)=>setGndSearches(p=>({...p,[activeSearchNum]:{...p[activeSearchNum],assignments:{...p[activeSearchNum].assignments,[i]:Math.max(0,Math.round(v))}}})):null}/></div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-3">
          <AirSRUTable
            setup={activeSearchNum&&airSetups[`search-${activeSearchNum}`]?airSetups[`search-${activeSearchNum}`]:airSetups.setup}
            onUpdate={(data)=>{
              if(activeSearchNum&&airSetups[`search-${activeSearchNum}`]) setAirSetups(p=>({...p,[`search-${activeSearchNum}`]:data}));
              else setAirSetups(p=>({...p,setup:data}));
            }}/>
        </div>
      )}
    </div>
  );
}
