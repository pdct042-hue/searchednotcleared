/* ═══ LANDING PAGE ═══ */

const Logo = ({ size = 48 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-label="Searched Not Cleared logo">
    <rect width="24" height="24" rx="5" fill="#0f172a" />
    {/* segment map: three regions, one searched (emerald), LKP marker */}
    <polygon points="3,3 13,3 3,10" fill="#334155" />
    <polygon points="13,3 21,3 21,12 9,21 3,21 3,10" fill="#10b981" />
    <polygon points="21,12 21,21 9,21" fill="#334155" />
    <path d="M3,10 13,3 M21,12 9,21" stroke="#0f172a" strokeWidth="1.2" fill="none" />
    <circle cx="14.5" cy="10.5" r="2" fill="#f59e0b" stroke="#0f172a" strokeWidth="0.8" />
  </svg>
);

const Step = ({ n, title, text }) => (
  <div className="flex gap-3">
    <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center text-sm font-bold shrink-0">{n}</div>
    <div>
      <div className="font-semibold text-slate-900">{title}</div>
      <div className="text-sm text-slate-600">{text}</div>
    </div>
  </div>
);

const Ref = ({ title, meta, href }) => (
  <li className="text-sm">
    {href
      ? <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-700 hover:underline">{title}</a>
      : <span className="font-medium text-slate-900">{title}</span>}
    <span className="text-slate-500"> — {meta}</span>
  </li>
);

export default function Landing({ onEnter }) {
  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* testing banner */}
      <div className="bg-amber-500 text-black px-3 py-1 text-center text-[11px] font-semibold">
        ⚠ TESTING ONLY — not validated for operational search. Found a bug? Email{" "}
        <a href="mailto:peter.dellavecchia@cowg.cap.gov" className="underline">peter.dellavecchia@cowg.cap.gov</a>
      </div>

      {/* hero */}
      <header className="bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-6 py-14 text-center">
          <div className="flex justify-center mb-5"><Logo size={72} /></div>
          <h1 className="text-4xl font-bold tracking-tight">Search Manager</h1>
          <p className="mt-2 text-lg text-emerald-400 font-semibold tracking-wide">SEARCHED ≠ CLEARED</p>
          <p className="mt-4 max-w-2xl mx-auto text-slate-300">
            Probability-based effort allocation worksheets for land search and rescue —
            a browser rebuild of the ISPC <em>SearchManager</em> planning tool (2002–2013),
            verified line-by-line against the original application.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
            <button onClick={() => onEnter("ground")}
              className="px-8 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold text-white shadow-lg">
              Ground Worksheet
              <span className="block text-xs font-normal text-emerald-100">PSR-Based Ground Effort Allocation</span>
            </button>
            <button onClick={() => onEnter("air")}
              className="px-8 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold text-white shadow-lg">
              Air Worksheet
              <span className="block text-xs font-normal text-blue-100">ASAD Air Resource Allocation</span>
            </button>
          </div>
        </div>
      </header>

      {/* what it is */}
      <main className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">What this is</h2>
          <p className="text-slate-700 leading-relaxed">
            The original <em>SearchManager</em> was a Windows/4D database application distributed with the
            Inland SAR Planning Course (ISPC). It implemented the course&apos;s two core planning worksheets —
            the PSR-Based Ground Effort Allocation Worksheet and the Air Search Area Determination (ASAD)
            worksheet — but it no longer runs on modern systems. This site rebuilds those worksheets for the
            browser, following the ISPC Student Guide (November 2016) and cross-checked against the original
            application running in a virtual machine. Nothing to install, nothing to license: open the
            worksheet, plan the search.
          </p>
        </section>

        {/* how it works */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-4">How it works</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <Step n="1" title="Define regions & segments"
              text="Break the search area into consensus regions and operational segments with measured areas." />
            <Step n="2" title="Establish consensus POC"
              text="Evaluators vote on where the subject is. The worksheet computes consensus probability of containment for every region and segment." />
            <Step n="3" title="Enter resources & detectability"
              text="Searchers, search speed, and effective sweep width (from detection experiments or field-measured range of detection)." />
            <Step n="4" title="Allocate effort & track results"
              text="Allocate by hand or use the PSR-equalization optimizer. The worksheet computes coverage, POD, POS, and carries remaining POC forward to the next operational period." />
          </div>
        </section>

        {/* references */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">References</h2>
          <ul className="space-y-2 list-disc pl-5">
            <Ref title="Inland SAR Planning Course — Student Guide (November 2016)"
              meta="National Search and Rescue School. Appendices C & D define the worksheets implemented here. Course material; not publicly hosted." />
            <Ref title="Sweep Width Estimation for Ground Search and Rescue (2004)"
              meta="Koester, Cooper, Frost & Robe. U.S. Coast Guard / DHS. Detection experiments and ground sweep width tables."
              href="https://www.dco.uscg.mil/Portals/9/CG-5R/nsarc/DetExpReport_2004_final_s.pdf" />
            <Ref title="Use of the Visual Range of Detection to Estimate Effective Sweep Width (2014)"
              meta="Koester et al., Wilderness & Environmental Medicine 25(2). The Rd field-measurement shortcut for sweep width."
              href="https://journals.sagepub.com/doi/full/10.1016/j.wem.2013.09.016" />
            <Ref title="A Method for Determining Effective Sweep Widths for Land Searches (2002)"
              meta="Robe & Frost. Procedures for conducting ground detection experiments."
              href="https://www.dco.uscg.mil/Portals/9/CG-5R/nsarc/LandSweepWidthDemoReportFinal.pdf" />
          </ul>
        </section>
      </main>

      {/* footer */}
      <footer className="border-t bg-white">
        <div className="max-w-4xl mx-auto px-6 py-6 text-xs text-slate-500 space-y-1">
          <p>⚠ This site is under active testing and has not been validated for operational search planning. Verify all numbers independently before use on a live incident.</p>
          <p>Built for the SAR community. Not affiliated with the National SAR School, U.S. Coast Guard, or U.S. Air Force.</p>
          <p>Bugs / feedback: <a href="mailto:peter.dellavecchia@cowg.cap.gov" className="text-emerald-700 hover:underline">peter.dellavecchia@cowg.cap.gov</a></p>
        </div>
      </footer>
    </div>
  );
}
