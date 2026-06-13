import { useState, useMemo, useCallback } from "react";

const MAX_REGIONS = 18, MAX_SEARCHES = 14, MAX_SRUS = 12, MAX_OFFSETS = 10;
const REGION_LETTERS = "ABCDEFGHIJKLMNOPQR".split("");

/* ═══ DATA FACTORIES ═══ */
const mkRegion = (letter) => ({ letter, poc: 0, area: 0, numSegments: 1 });
const mkGndSeg = (reg, num) => ({
  id: `${reg}${String(num).padStart(2,"0")}`, region: reg, segNum: num,
  length: 0, baseline: 0, area: 0, sweepWidth: 0, searchSpeed: 0,
  timeOverride: null, // null = use calculated minimum; number = user override
});
const mkEval = (name="") => ({ name, ratings: {} });
const mkSRU = (id="") => ({ id, sweepWidth:0, fuelEndurance:0, daylightEndurance:0, observerEndurance:0, craftSpeed:0 });
const mkAirRegion = (letter="A") => ({ letter, trackStartPct: 0, trackEndPct: 0 });
const mkOffset = (val=0) => ({ offset: val });
const mkAirSetup = () => ({ flightLength:0, searchAreaLength:0,
  airRegions: Array.from({length:3},(_,i)=>mkAirRegion(REGION_LETTERS[i])),
  srus: Array.from({length:4},(_,i)=>mkSRU(`SRU-${i+1}`)),
  offsets:[mkOffset(2),mkOffset(4),mkOffset(5),mkOffset(6),mkOffset(8),mkOffset(10)] });

/* ═══ GROUND CALCS — matches Student Guide Rev 07/15 ═══ */
function calcGndSeg(seg, regions) {
  const r = regions.find(r => r.letter === seg.region);
  // A8: Segment POC = (A7 ÷ A2) × A3
  const poc = r && r.area > 0 ? (seg.area / r.area) * r.poc : 0;
  // A11: Time to Search = A5÷A10, or max desired search time (user override)
  const minTime = seg.searchSpeed > 0 ? seg.length / seg.searchSpeed : 0;
  const timeToSearch = seg.timeOverride !== null && seg.timeOverride > 0 ? seg.timeOverride : minTime;
  // A11a: Team Tracks = [(A11 × A10) ÷ A5] rounded to whole number
  const teamTracks = seg.length > 0 && seg.searchSpeed > 0
    ? Math.max(1, Math.round((timeToSearch * seg.searchSpeed) / seg.length)) : 1;
  // A11b: Time in Search Segment = [(A11a ÷ A10) × A5]
  const timeInSeg = seg.searchSpeed > 0 && seg.length > 0
    ? (teamTracks / seg.searchSpeed) * seg.length : 0;
  // A12: PSR = [(A10 × A9 × A8) ÷ A7] — NO time component, it's a RATE
  const psr = seg.area > 0 ? (seg.searchSpeed * seg.sweepWidth * poc) / seg.area : 0;
  return { poc, minTime, timeToSearch, teamTracks, timeInSeg, psr };
}

function calcGndSearch(seg, regions, assigned) {
  const c = calcGndSeg(seg, regions);
  // B14: Spacing = A6 × 5280 ÷ B13 ÷ A11a
  const sp = assigned > 0 && c.teamTracks > 0 ? (seg.baseline * 5280) / (assigned * c.teamTracks) : 0;
  // B15: Coverage = A9 ÷ B14
  const cov = sp > 0 ? seg.sweepWidth / sp : 0;
  // B16: POD = 1 − e^(−C)
  const pod = cov > 0 ? 1 - Math.exp(-cov) : 0;
  // B17: POS = A8 × B16
  const pos = c.poc * pod;
  // B18: POC Remaining = A8 − B17
  const pocRem = Math.max(0, c.poc - pos);
  // B19: PSR After = [(A10 × A9 × B18) ÷ A7] — NO time component
  const psrAfter = seg.area > 0 ? (seg.searchSpeed * seg.sweepWidth * pocRem) / seg.area : 0;
  return { ...c, sp, cov, pod, pos, pocRem, psrAfter };
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
  const sruCalcs = setup.srus.map(s => ({ ...s, ...calcSRU(s) }));
  const totalMileage = sruCalcs.reduce((a, s) => a + s.mileage, 0);
  const sruDerived = sruCalcs.map(s => {
    const trackPortion = totalMileage > 0 ? s.mileage / totalMileage : 0;
    const segLength = trackPortion * setup.flightLength;
    const numTracks = segLength > 0 ? s.mileage / segLength : 0;
    const fullTracks = Math.floor(numTracks);
    return { ...s, trackPortion, segLength, numTracks, fullTracks };
  });
  const activeSRUs = sruDerived.filter(s => s.fullTracks > 0);
  const avgFullTracks = activeSRUs.length > 0 ? activeSRUs.reduce((a,s)=>a+s.fullTracks,0) / activeSRUs.length : 0;
  const avgSweepWidth = activeSRUs.length > 0 ? activeSRUs.reduce((a,s)=>a+s.sweepWidth,0) / activeSRUs.length : 0;

  // D section: per-region ASAD-based probability calculations
  const regionCalcs = (setup.airRegions || []).map(r => {
    // D23: Prob Along Track = ASAD_TRACK(endPct) - ASAD_TRACK(startPct)
    const ptEnd = asadLookup(ASAD_TRACK, r.trackEndPct);
    const ptStart = asadLookup(ASAD_TRACK, r.trackStartPct);
    const probAlongTrack = Math.max(0, ptEnd - ptStart);
    return { ...r, probAlongTrack, ptEnd, ptStart };
  });

  // C section: For each offset, compute POC from ASAD tables via D
  const offsetCalcs = setup.offsets.map(o => {
    const segWidth = 2 * o.offset;
    const trackSpacing = avgFullTracks > 0 ? segWidth / avgFullTracks : 0;
    const coverage = trackSpacing > 0 ? avgSweepWidth / trackSpacing : 0;
    const pod = coverage > 0 ? 1 - Math.exp(-coverage) : 0;

    // P_offset from ASAD table (symmetric: equal distance both sides)
    const pOffset = asadLookup(ASAD_OFFSET, o.offset);

    // POC = sum over regions of (P_along_track × P_offset)
    // For symmetric search, P_offset is the full table value
    // For asymmetric (D section), each border is looked up ÷ 2 then combined
    let poc = 0;
    regionCalcs.forEach(r => {
      poc += r.probAlongTrack * pOffset;
    });

    const pos = pod * poc;
    return { ...o, segWidth, trackSpacing, coverage, pod, pOffset, poc, pos };
  });
  return { sruDerived, totalMileage, regionCalcs, offsetCalcs };
}

/* ═══ SHARED COMPONENTS ═══ */
function In({ value, onChange, className="", type="number", step, min, placeholder }) {
  const [draft, setDraft] = useState(null); // null = not editing, use parent value
  const [prevValue, setPrevValue] = useState(value);
  const isEditing = draft !== null;
  const displayValue = isEditing ? draft : (value ?? "");

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

/* ═══ REGIONS PANEL ═══ */
function RegionsPanel({ regions, onUpdate }) {
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
          <td className="px-0.5"><In value={r.poc} onChange={v=>u(i,"poc",v)} step="0.001" className="w-14"/></td>
          <td className="px-0.5"><In value={r.area} onChange={v=>u(i,"area",v)} step="0.01" className="w-14"/></td>
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

/* ═══ CONSENSUS PANEL ═══ */
function ConsensusPanel({ regions, evaluators, onUpdateEval, onApply }) {
  const uN=(i,n)=>{const e=[...evaluators];e[i]={...e[i],name:n};onUpdateEval(e);};
  const uR=(ei,rl,v)=>{const e=[...evaluators];e[ei]={...e[ei],ratings:{...e[ei].ratings,[rl]:v}};onUpdateEval(e);};
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-gray-700">Consensus</span>
        <div className="flex gap-1">
          <button onClick={onApply} className="text-[10px] px-2 py-0.5 bg-blue-600 text-white rounded font-semibold">Apply →</button>
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
        </tr>);})}</tbody></table></div>
    </div>
  );
}

/* ═══ GROUND SEGMENTS TABLE ═══ */
function GndSegTable({ segments, regions, onUpdateSeg, searchAssign, onUpdateAssign }) {
  const calcs = useMemo(()=>segments.map(s=>calcGndSeg(s,regions)),[segments,regions]);
  const weights = useMemo(()=>{const p=calcs.map(c=>c.psr);const t=p.reduce((a,b)=>a+b,0);return p.map(v=>t>0?v/t:0);},[calcs]);
  const sCalcs = useMemo(()=>searchAssign?segments.map((s,i)=>calcGndSearch(s,regions,searchAssign[i]||0)):null,[segments,regions,searchAssign]);
  const totalPOS = sCalcs?sCalcs.reduce((a,c)=>a+c.pos,0):0;
  const u=(i,f,v)=>{const n=[...segments];n[i]={...n[i],[f]:v};onUpdateSeg(n);};

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-bold text-gray-700">Segments</span>
        <div className="flex gap-1 text-[10px] text-gray-400 overflow-x-auto">
          <span>Wt:</span>{weights.map((w,i)=><span key={i} className="font-mono">.{Math.round(w*1000).toString().padStart(3,"0")}</span>)}
        </div>
      </div>
      <div className="overflow-x-auto border rounded"><table className="text-xs border-collapse"><tbody>
        {/* Segment ID */}
        <tr className="bg-gray-200"><td className="px-2 py-0.5 font-bold sticky left-0 bg-gray-200 z-10 border-r min-w-[130px]">4. Segment</td>
          {segments.map((s,i)=><td key={i} className="px-0.5 py-0.5 text-center font-bold min-w-[60px]">{s.id}</td>)}</tr>
        {/* A5: Length */}
        <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">5. Length (mi)</td>
          {segments.map((s,i)=><td key={i} className="px-0.5 py-0.5"><In value={s.length} onChange={v=>u(i,"length",v)} step="0.01" className="text-[10px]"/></td>)}</tr>
        {/* A6: Baseline */}
        <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">6. Baseline (mi)</td>
          {segments.map((s,i)=><td key={i} className="px-0.5 py-0.5"><In value={s.baseline} onChange={v=>u(i,"baseline",v)} step="0.01" className="text-[10px]"/></td>)}</tr>
        {/* A7: Area */}
        <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">7. Area (mi²)</td>
          {segments.map((s,i)=><td key={i} className="px-0.5 py-0.5"><In value={s.area} onChange={v=>u(i,"area",v)} step="0.01" className="text-[10px]"/></td>)}</tr>
        {/* A8: POC (calculated) */}
        <tr className="border-b bg-blue-50"><td className="px-2 py-0.5 font-semibold text-blue-700 bg-blue-50 sticky left-0 z-10 border-r">8. Seg POC <span className="font-normal text-[9px]">(A7÷A2)×A3</span></td>
          {calcs.map((c,i)=><td key={i}><Cv value={c.poc} className="text-blue-700 font-semibold"/></td>)}</tr>
        {/* A9: Sweep Width */}
        <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">9. Sweep Width (ft)</td>
          {segments.map((s,i)=><td key={i} className="px-0.5 py-0.5"><In value={s.sweepWidth} onChange={v=>u(i,"sweepWidth",v)} step="1" className="text-[10px]"/></td>)}</tr>
        {/* A10: Speed */}
        <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">10. Speed (mph)</td>
          {segments.map((s,i)=><td key={i} className="px-0.5 py-0.5"><In value={s.searchSpeed} onChange={v=>u(i,"searchSpeed",v)} step="0.01" className="text-[10px]"/></td>)}</tr>
        {/* A11: Time to Search — EDITABLE, defaults to min */}
        <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">
          11. Time to Search (hr) <span className="font-normal text-[9px] text-gray-400">min={calcs[0]?.minTime.toFixed(1)||"—"}</span></td>
          {segments.map((s,i)=><td key={i} className="px-0.5 py-0.5">
            <In value={s.timeOverride !== null ? s.timeOverride : (calcs[i]?.minTime || 0)}
              onChange={v => u(i, "timeOverride", v > 0 ? v : null)}
              step="0.1" className={`text-[10px] ${s.timeOverride !== null ? "bg-yellow-50 border-yellow-400" : ""}`}/>
          </td>)}</tr>
        {/* A11a: Team Tracks (calculated) */}
        <tr className="border-b bg-green-50"><td className="px-2 py-0.5 font-semibold text-green-700 bg-green-50 sticky left-0 z-10 border-r">11a. Team Tracks <span className="font-normal text-[9px]">(A11×A10)÷A5</span></td>
          {calcs.map((c,i)=><td key={i}><Cv value={c.teamTracks} fmt="int" className="text-green-700 font-semibold"/></td>)}</tr>
        {/* A11b: Time in Segment (calculated) */}
        <tr className="border-b bg-green-50"><td className="px-2 py-0.5 font-semibold text-green-700 bg-green-50 sticky left-0 z-10 border-r">11b. Time in Seg (hr) <span className="font-normal text-[9px]">(A11a÷A10)×A5</span></td>
          {calcs.map((c,i)=><td key={i}><Cv value={c.timeInSeg} fmt="dec1" className="text-green-700"/></td>)}</tr>
        {/* A12: PSR — FIXED: (A10 × A9 × A8) ÷ A7 */}
        <tr className="border-b bg-amber-50"><td className="px-2 py-0.5 font-bold text-amber-800 bg-amber-50 sticky left-0 z-10 border-r">12. PSR <span className="font-normal text-[9px]">(A10×A9×A8)÷A7</span></td>
          {calcs.map((c,i)=><td key={i}><Cv value={c.psr} fmt="dec2" className="text-amber-800 font-bold"/></td>)}</tr>

        {/* Section B: Search Allocation */}
        {searchAssign&&<>
          <tr className="bg-gray-300"><td colSpan={segments.length+1} className="px-2 py-0.5 font-bold text-[10px]">
            B — EFFORT ALLOCATION | {Object.values(searchAssign).reduce((a,b)=>a+b,0)} searchers | POS: {(totalPOS*100).toFixed(1)}%</td></tr>
          {/* B13: Searchers */}
          <tr className="border-b"><td className="px-2 py-0.5 font-semibold bg-yellow-50 sticky left-0 z-10 border-r">13. Searchers</td>
            {segments.map((_,i)=><td key={i} className="px-0.5 py-0.5"><In value={searchAssign[i]||0} onChange={v=>onUpdateAssign(i,v)} step="1" min="0" className="text-[10px] bg-yellow-50 border-yellow-300"/></td>)}</tr>
          {/* B14: Spacing */}
          <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">14. Spacing (ft) <span className="font-normal text-[9px]">A6×5280÷B13÷A11a</span></td>
            {sCalcs.map((c,i)=><td key={i}><Cv value={c.sp} fmt="int" className="bg-gray-100"/></td>)}</tr>
          {/* B15: Coverage */}
          <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">15. Coverage <span className="font-normal text-[9px]">A9÷B14</span></td>
            {sCalcs.map((c,i)=><td key={i}><Cv value={c.cov} fmt="dec2" className="bg-gray-100"/></td>)}</tr>
          {/* B16: POD */}
          <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-blue-700 bg-blue-50 sticky left-0 z-10 border-r">16. POD <span className="font-normal text-[9px]">1−e^(−C)</span></td>
            {sCalcs.map((c,i)=><td key={i}><Cv value={c.pod} className="bg-blue-50 text-blue-700 font-semibold"/></td>)}</tr>
          {/* B17: POS */}
          <tr className="border-b bg-emerald-50"><td className="px-2 py-0.5 font-bold text-emerald-800 bg-emerald-100 sticky left-0 z-10 border-r">17. POS <span className="font-normal text-[9px]">A8×B16</span></td>
            {sCalcs.map((c,i)=><td key={i}><Cv value={c.pos} className="text-emerald-800 font-bold"/></td>)}</tr>
          {/* B18: POC Remaining */}
          <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">18. POC Remain <span className="font-normal text-[9px]">A8−B17</span></td>
            {sCalcs.map((c,i)=><td key={i}><Cv value={c.pocRem} className="bg-gray-100"/></td>)}</tr>
          {/* B19: PSR After — FIXED: (A10 × A9 × B18) ÷ A7 */}
          <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">19. PSR After <span className="font-normal text-[9px]">(A10×A9×B18)÷A7</span></td>
            {sCalcs.map((c,i)=><td key={i}><Cv value={c.psrAfter} fmt="dec2" className="bg-gray-100"/></td>)}</tr>
        </>}
      </tbody></table></div>
    </div>
  );
}

/* ═══ AIR SRU TABLE with Regions + D Section ═══ */
function AirSRUTable({ setup, onUpdate }) {
  const res = useMemo(()=>calcAirSearch(setup),[setup]);
  const uSRU=(i,f,v)=>{const s={...setup,srus:[...setup.srus]};s.srus[i]={...s.srus[i],[f]:v};onUpdate(s);};
  const uOff=(i,f,v)=>{const s={...setup,offsets:[...setup.offsets]};s.offsets[i]={...s.offsets[i],[f]:v};onUpdate(s);};
  const uReg=(i,f,v)=>{const s={...setup,airRegions:[...setup.airRegions]};s.airRegions[i]={...s.airRegions[i],[f]:v};onUpdate(s);};
  const addReg=()=>(setup.airRegions||[]).length<MAX_REGIONS&&onUpdate({...setup,airRegions:[...(setup.airRegions||[]),mkAirRegion(REGION_LETTERS[(setup.airRegions||[]).length])]});
  const rmReg=()=>(setup.airRegions||[]).length>1&&onUpdate({...setup,airRegions:setup.airRegions.slice(0,-1)});
  const bestPOS = res.offsetCalcs.reduce((b,o)=>o.pos>b?o.pos:b,0);

  return (
    <div className="flex flex-col gap-3">
      {/* Area params */}
      <div className="flex items-center gap-4 text-xs flex-wrap">
        <label className="flex items-center gap-1"><span className="font-semibold text-gray-600">Flight Length (nm):</span>
          <In value={setup.flightLength} onChange={v=>onUpdate({...setup,flightLength:v})} step="1" className="w-20"/></label>
        <label className="flex items-center gap-1"><span className="font-semibold text-gray-600">Search Area Length (nm):</span>
          <In value={setup.searchAreaLength} onChange={v=>onUpdate({...setup,searchAreaLength:v})} step="1" className="w-20"/></label>
        <div className="ml-4 px-2 py-1 bg-gray-800 text-white rounded text-xs">
          Total Mileage: <span className="font-mono font-bold">{res.totalMileage.toFixed(1)} nm</span></div>
      </div>

      <div className="flex gap-3">
        {/* A/D: Regions Panel */}
        <div className="shrink-0" style={{minWidth:320}}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-gray-700">A/D — REGIONS & TRACK PROBABILITY</span>
            <div className="flex gap-1">
              <button onClick={addReg} className="text-[10px] px-1.5 py-0.5 bg-green-600 text-white rounded">+</button>
              <button onClick={rmReg} className="text-[10px] px-1.5 py-0.5 bg-red-600 text-white rounded">−</button>
            </div>
          </div>
          <div className="border rounded overflow-hidden">
            <table className="text-xs border-collapse w-full"><thead><tr className="bg-gray-700 text-white">
              <th className="px-1 py-0.5">Rgn</th>
              <th className="px-1 py-0.5">Trk Start %</th>
              <th className="px-1 py-0.5">Trk End %</th>
              <th className="px-1 py-0.5 bg-green-800">D23: P Along</th>
            </tr></thead><tbody>{(setup.airRegions||[]).map((r,i)=>(
              <tr key={i} className={i%2?"bg-gray-50":"bg-white"}>
                <td className="px-1 py-0.5 font-bold text-gray-600 text-center">{r.letter}</td>
                <td className="px-0.5"><In value={r.trackStartPct} onChange={v=>uReg(i,"trackStartPct",v)} step="1" className="w-14"/></td>
                <td className="px-0.5"><In value={r.trackEndPct} onChange={v=>uReg(i,"trackEndPct",v)} step="1" className="w-14"/></td>
                <td className="px-1 py-0.5"><Cv value={res.regionCalcs[i]?.probAlongTrack} className="text-green-700 font-semibold bg-green-50"/></td>
              </tr>))}</tbody>
              <tfoot><tr className="bg-gray-200 font-bold text-xs">
                <td></td>
                <td colSpan={2}></td>
                <td className="text-center">{res.regionCalcs.reduce((a,r)=>a+r.probAlongTrack,0).toFixed(3)}</td>
              </tr></tfoot>
            </table>
          </div>
          <div className="mt-1 text-[10px] text-gray-400">
            D23: P_along = ASAD_TRACK(end%) − ASAD_TRACK(start%) | POC = P_along × P_offset (from ASAD tables)
          </div>
        </div>

        {/* B: SRU Setup */}
        <div className="flex-1 overflow-x-auto">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-gray-700">B — SRU EFFORT & SEARCH SET-UP</span>
            <div className="flex gap-1">
              <button onClick={()=>setup.srus.length<MAX_SRUS&&onUpdate({...setup,srus:[...setup.srus,mkSRU(`SRU-${setup.srus.length+1}`)]})} className="text-[10px] px-1.5 py-0.5 bg-green-600 text-white rounded">+ SRU</button>
              <button onClick={()=>setup.srus.length>1&&onUpdate({...setup,srus:setup.srus.slice(0,-1)})} className="text-[10px] px-1.5 py-0.5 bg-red-600 text-white rounded">− SRU</button>
            </div>
          </div>
          <div className="border rounded"><table className="text-xs border-collapse"><tbody>
            <tr className="bg-gray-200"><td className="px-2 py-0.5 font-bold sticky left-0 bg-gray-200 z-10 border-r min-w-[150px]">3. SRU Designation</td>
              {setup.srus.map((s,i)=><td key={i} className="px-0.5 py-0.5 min-w-[75px]"><In value={s.id} type="text" onChange={v=>uSRU(i,"id",v)} className="text-[10px] font-bold"/></td>)}</tr>
            <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">4. Sweep Width (nm)</td>
              {setup.srus.map((s,i)=><td key={i} className="px-0.5 py-0.5"><In value={s.sweepWidth} onChange={v=>uSRU(i,"sweepWidth",v)} step="0.01" className="text-[10px]"/></td>)}</tr>
            <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">5a. Fuel Endurance (hr)</td>
              {setup.srus.map((s,i)=><td key={i} className="px-0.5 py-0.5"><In value={s.fuelEndurance} onChange={v=>uSRU(i,"fuelEndurance",v)} step="0.1" className="text-[10px]"/></td>)}</tr>
            <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">5b. Daylight Endurance (hr)</td>
              {setup.srus.map((s,i)=><td key={i} className="px-0.5 py-0.5"><In value={s.daylightEndurance} onChange={v=>uSRU(i,"daylightEndurance",v)} step="0.1" className="text-[10px]"/></td>)}</tr>
            <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">5c. Observer Endurance (hr)</td>
              {setup.srus.map((s,i)=><td key={i} className="px-0.5 py-0.5"><In value={s.observerEndurance} onChange={v=>uSRU(i,"observerEndurance",v)} step="0.1" className="text-[10px]"/></td>)}</tr>
            <tr className="border-b bg-green-50"><td className="px-2 py-0.5 font-semibold text-green-700 bg-green-50 sticky left-0 z-10 border-r">6. Search Endurance (hr)</td>
              {res.sruDerived.map((s,i)=><td key={i}><Cv value={s.searchEndurance} fmt="dec2" className="text-green-700 font-semibold"/></td>)}</tr>
            <tr className="border-b"><td className="px-2 py-0.5 font-semibold text-gray-600 bg-gray-50 sticky left-0 z-10 border-r">7. Craft Speed (kts)</td>
              {setup.srus.map((s,i)=><td key={i} className="px-0.5 py-0.5"><In value={s.craftSpeed} onChange={v=>uSRU(i,"craftSpeed",v)} step="1" className="text-[10px]"/></td>)}</tr>
            <tr className="border-b bg-green-50"><td className="px-2 py-0.5 font-semibold text-green-700 bg-green-50 sticky left-0 z-10 border-r">8. SRU Mileage (nm)</td>
              {res.sruDerived.map((s,i)=><td key={i}><Cv value={s.mileage} fmt="dec1" className="text-green-700 font-bold"/></td>)}</tr>
            <tr className="border-b bg-green-50"><td className="px-2 py-0.5 font-semibold text-green-700 bg-green-50 sticky left-0 z-10 border-r">10. Track Portion</td>
              {res.sruDerived.map((s,i)=><td key={i}><Cv value={s.trackPortion} className="text-green-700"/></td>)}</tr>
            <tr className="border-b bg-green-50"><td className="px-2 py-0.5 font-semibold text-green-700 bg-green-50 sticky left-0 z-10 border-r">11. Segment Length (nm)</td>
              {res.sruDerived.map((s,i)=><td key={i}><Cv value={s.segLength} fmt="dec1" className="text-green-700"/></td>)}</tr>
            <tr className="border-b bg-green-50"><td className="px-2 py-0.5 font-semibold text-green-700 bg-green-50 sticky left-0 z-10 border-r">12. Number of Tracks</td>
              {res.sruDerived.map((s,i)=><td key={i}><Cv value={s.numTracks} fmt="dec2" className="text-green-700"/></td>)}</tr>
            <tr className="border-b bg-amber-50"><td className="px-2 py-0.5 font-bold text-amber-800 bg-amber-50 sticky left-0 z-10 border-r">13. Full Tracks</td>
              {res.sruDerived.map((s,i)=><td key={i}><Cv value={s.fullTracks} fmt="int" className="text-amber-800 font-bold"/></td>)}</tr>
          </tbody></table></div>
        </div>
      </div>

      {/* Section C: POS Comparisons — POC now auto-calculated from D */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-gray-700">C — POS COMPARISONS BY OFFSET <span className="font-normal text-gray-400">(POC from regions via D)</span></span>
          <div className="flex gap-1">
            <button onClick={()=>setup.offsets.length<MAX_OFFSETS&&onUpdate({...setup,offsets:[...setup.offsets,mkOffset(0)]})} className="text-[10px] px-1.5 py-0.5 bg-green-600 text-white rounded">+ Offset</button>
            <button onClick={()=>setup.offsets.length>1&&onUpdate({...setup,offsets:setup.offsets.slice(0,-1)})} className="text-[10px] px-1.5 py-0.5 bg-red-600 text-white rounded">− Offset</button>
          </div>
        </div>
        <div className="overflow-x-auto border rounded"><table className="text-xs border-collapse"><tbody>
          <tr className="bg-gray-200"><td className="px-2 py-0.5 font-bold sticky left-0 bg-gray-200 z-10 border-r min-w-[150px]">14. Offset (nm)</td>
            {setup.offsets.map((o,i)=><td key={i} className="px-0.5 py-0.5 min-w-[70px]"><In value={o.offset} onChange={v=>uOff(i,"offset",v)} step="0.5" className="text-[10px]"/></td>)}</tr>
          <tr className="border-b bg-green-50"><td className="px-2 py-0.5 font-semibold text-green-700 bg-green-50 sticky left-0 z-10 border-r">15. Seg Width (nm)</td>
            {res.offsetCalcs.map((o,i)=><td key={i}><Cv value={o.segWidth} fmt="dec1" className="text-green-700"/></td>)}</tr>
          <tr className="border-b bg-green-50"><td className="px-2 py-0.5 font-semibold text-green-700 bg-green-50 sticky left-0 z-10 border-r">16. Track Spacing (nm)</td>
            {res.offsetCalcs.map((o,i)=><td key={i}><Cv value={o.trackSpacing} fmt="dec2" className="text-green-700"/></td>)}</tr>
          <tr className="border-b bg-green-50"><td className="px-2 py-0.5 font-semibold text-green-700 bg-green-50 sticky left-0 z-10 border-r">17. Coverage (W/S)</td>
            {res.offsetCalcs.map((o,i)=><td key={i}><Cv value={o.coverage} fmt="dec2" className="text-green-700"/></td>)}</tr>
          <tr className="border-b bg-blue-50"><td className="px-2 py-0.5 font-semibold text-blue-700 bg-blue-50 sticky left-0 z-10 border-r">18. POD</td>
            {res.offsetCalcs.map((o,i)=><td key={i}><Cv value={o.pod} className="text-blue-700 font-semibold"/></td>)}</tr>
          <tr className="border-b bg-indigo-50"><td className="px-2 py-0.5 font-semibold text-indigo-700 bg-indigo-50 sticky left-0 z-10 border-r">P_offset <span className="font-normal text-[9px]">(ASAD table)</span></td>
            {res.offsetCalcs.map((o,i)=><td key={i}><Cv value={o.pOffset} className="text-indigo-700"/></td>)}</tr>
          <tr className="border-b bg-purple-50"><td className="px-2 py-0.5 font-semibold text-purple-700 bg-purple-50 sticky left-0 z-10 border-r">19. POC <span className="font-normal text-[9px]">ΣP_along × P_offset</span></td>
            {res.offsetCalcs.map((o,i)=><td key={i}><Cv value={o.poc} className="text-purple-700 font-semibold"/></td>)}</tr>
          <tr className="border-b bg-emerald-50"><td className="px-2 py-0.5 font-bold text-emerald-800 bg-emerald-100 sticky left-0 z-10 border-r">20. POS <span className="font-normal text-[9px]">POD×POC</span></td>
            {res.offsetCalcs.map((o,i)=><td key={i}><Cv value={o.pos} className={`font-bold ${Math.abs(o.pos-bestPOS)<0.0001&&bestPOS>0?"text-emerald-800 bg-emerald-200":"text-emerald-700"}`}/></td>)}</tr>
        </tbody></table></div>
        {bestPOS > 0 && <div className="mt-1 px-2 py-1 bg-gray-800 rounded text-white text-xs">
          Best POS: <span className="font-mono font-bold text-emerald-400">{(bestPOS*100).toFixed(1)}%</span> at offset {res.offsetCalcs.find(o=>Math.abs(o.pos-bestPOS)<0.0001)?.offset} nm
        </div>}
      </div>
    </div>
  );
}

/* ═══ MAIN APP ═══ */
export default function App() {
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().split("T")[0]);
  const [incidentTime, setIncidentTime] = useState("00:00");
  const [location, setLocation] = useState("");
  const [code, setCode] = useState("");
  const [wsType, setWsType] = useState("ground");
  const [activeTab, setActiveTab] = useState("setup");

  const [regions, setRegions] = useState(()=>Array.from({length:6},(_,i)=>mkRegion(REGION_LETTERS[i])));
  const [evaluators, setEvaluators] = useState([mkEval(""),mkEval(""),mkEval("")]);
  const [gndSegs, setGndSegs] = useState([]);
  const [gndSearches, setGndSearches] = useState({});
  const [airSetups, setAirSetups] = useState({setup: mkAirSetup()});

  const rebuildSegs = useCallback((nr)=>{
    setRegions(nr);
    const ns=[];nr.forEach(r=>{for(let i=1;i<=r.numSegments;i++){const ex=gndSegs.find(s=>s.region===r.letter&&s.segNum===i);ns.push(ex||mkGndSeg(r.letter,i));}});
    setGndSegs(ns);
  },[gndSegs]);

  const applyConsensus=()=>{
    const avgs=regions.map(r=>{const v=evaluators.map(e=>e.ratings[r.letter]||0).filter(v=>v>0);return v.length>0?v.reduce((a,b)=>a+b,0)/v.length:0;});
    const t=avgs.reduce((a,b)=>a+b,0);
    setRegions(regions.map((r,i)=>({...r,poc:t>0?avgs[i]/t:0})));
  };

  const activeSearchNum = activeTab.startsWith("search-")?parseInt(activeTab.split("-")[1]):null;
  const gndNextNum = Object.keys(gndSearches).length+1;
  const airNextNum = Object.keys(airSetups).filter(k=>k.startsWith("search-")).length+1;

  const createSearch=()=>{
    const n = wsType==="ground"?gndNextNum:airNextNum;
    if(n>MAX_SEARCHES)return;
    if(wsType==="ground") setGndSearches(p=>({...p,[n]:{assignments:{}}}));
    else setAirSetups(p=>({...p,[`search-${n}`]:mkAirSetup()}));
    setActiveTab(`search-${n}`);
  };

  return (
    <div style={{fontFamily:"'Inter',system-ui,sans-serif"}} className="h-screen flex flex-col bg-gray-100">
      <div className="bg-gray-800 text-white px-3 py-1.5 flex items-center justify-between text-sm shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-emerald-500 rounded flex items-center justify-center text-[10px] font-black">SM</div>
          <span className="font-bold">Search Manager</span>
          <span className="text-gray-400">— [{wsType==="ground"?"Ground Search":"Air Search (ASAD)"}]</span>
        </div>
        <div className="flex gap-1">
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
              <RegionsPanel regions={regions} onUpdate={rebuildSegs}/></div>
            <div className="overflow-auto border rounded bg-white p-2 flex-1">
              <ConsensusPanel regions={regions} evaluators={evaluators} onUpdateEval={setEvaluators} onApply={applyConsensus}/></div>
            {activeSearchNum&&gndSearches[activeSearchNum]&&(
              <div className="border rounded bg-white p-3 shrink-0 flex flex-col items-center justify-center" style={{minWidth:130}}>
                <div className="text-xs font-bold text-gray-500 mb-1">Search #{activeSearchNum}</div>
                <div className="text-xs text-gray-400">POS</div>
                <div className="text-2xl font-mono font-black text-emerald-600">
                  {(gndSegs.reduce((s,seg,i)=>s+calcGndSearch(seg,regions,gndSearches[activeSearchNum].assignments[i]||0).pos,0)*100).toFixed(1)}%</div>
                <div className="text-xs text-gray-400 mt-2">POScum</div>
                <div className="text-lg font-mono font-bold text-gray-700">
                  {(Object.keys(gndSearches).filter(k=>parseInt(k)<=activeSearchNum).reduce((cum,k)=>
                    cum+gndSegs.reduce((s,seg,i)=>s+calcGndSearch(seg,regions,gndSearches[k].assignments[i]||0).pos,0),0)*100).toFixed(1)}%</div>
              </div>)}
          </div>
          <div className="overflow-auto border rounded bg-white p-2 flex-1 min-h-0">
            <GndSegTable segments={gndSegs} regions={regions} onUpdateSeg={setGndSegs}
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
