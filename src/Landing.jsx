/* ═══ LANDING PAGE ═══ */

const Logo = ({ size = 48 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-label="Searched Not Cleared logo">
    <rect width="24" height="24" rx="5" fill="#0f172a" />
    <polygon points="3,3 13,3 3,10" fill="#334155" />
    <polygon points="13,3 21,3 21,12 9,21 3,21 3,10" fill="#10b981" />
    <polygon points="21,12 21,21 9,21" fill="#334155" />
    <path d="M3,10 13,3 M21,12 9,21" stroke="#0f172a" strokeWidth="1.2" fill="none" />
    <circle cx="14.5" cy="10.5" r="2" fill="#f59e0b" stroke="#0f172a" strokeWidth="0.8" />
  </svg>
);

const BootPrint = ({ size = 20 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
    <path d="M12 1.5c3.2 0 5.2 2.8 5.2 6.2 0 2.6-1 4.9-1.6 7H8.4c-.6-2.1-1.6-4.4-1.6-7 0-3.4 2-6.2 5.2-6.2z" />
    <path d="M9.2 16.5h5.6c.4 1.6.3 6-2.8 6s-3.2-4.4-2.8-6z" />
  </svg>
);

const Plane = ({ size = 20 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
    <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
  </svg>
);

/* faint topo contours for the hero */
const Topo = () => (
  <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 400" aria-hidden="true">
    {[
      "M-20,340 C120,300 200,360 340,320 S560,250 820,300",
      "M-20,290 C140,240 260,310 400,260 S620,190 820,240",
      "M-20,235 C160,180 300,250 460,195 S660,130 820,180",
      "M-20,175 C180,120 340,190 520,130 S700,80 820,120",
      "M-20,115 C200,65 380,130 580,70 S720,35 820,60",
    ].map((d, i) => (
      <path key={i} d={d} fill="none" stroke="#10b981" strokeOpacity="0.10" strokeWidth="1.5" />
    ))}
  </svg>
);

const Ref = ({ title, meta, href }) => (
  <li className="text-sm">
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald-700 hover:underline">{title}</a>
    <span className="text-slate-500">. {meta}</span>
  </li>
);

export default function Landing({ onEnter }) {
  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* testing banner */}
      <div className="bg-amber-500 text-black px-3 py-1 text-center text-[11px] font-semibold">
        ⚠ TESTING ONLY. Not validated for operational search planning. Found a bug? Email{" "}
        <a href="mailto:peter.dellavecchia@cowg.cap.gov" className="underline">peter.dellavecchia@cowg.cap.gov</a>
      </div>

      {/* hero */}
      <header className="relative overflow-hidden bg-slate-900 text-white">
        <Topo />
        <div className="relative max-w-4xl mx-auto px-6 py-14 text-center">
          <div className="flex justify-center mb-5"><Logo size={72} /></div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Searched <span className="text-emerald-400">≠</span> Cleared</h1>
          <p className="mt-4 max-w-2xl mx-auto text-slate-300 text-lg">
            Effort allocation worksheets for extended search operations, based on the methods
            taught in the Inland SAR Planning Course.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
            <button onClick={() => onEnter("ground")}
              className="px-8 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold text-white shadow-lg flex items-center justify-center gap-2">
              <BootPrint size={22} />
              <span className="text-left">Ground Worksheet
                <span className="block text-xs font-normal text-emerald-100">PSR-Based Ground Effort Allocation</span></span>
            </button>
            <button onClick={() => onEnter("air")}
              className="px-8 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold text-white shadow-lg flex items-center justify-center gap-2">
              <Plane size={22} />
              <span className="text-left">Air Worksheet
                <span className="block text-xs font-normal text-blue-100">ASAD Air Resource Allocation</span></span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-12">

        {/* the problem */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">After the initial response</h2>
          <div className="text-slate-700 leading-relaxed space-y-4">
            <p>
              Most subjects are found during the initial response, when hasty teams cover the trails,
              drainages, and other likely locations. When that fails, the search becomes a resource
              allocation problem. The remaining area is large, searchers and operational periods are
              limited, and each assignment needs to be planned against where the subject is most likely
              to be and how detectable they are in that terrain.
            </p>
            <p>
              These worksheets apply formal search theory to that problem. Evaluators establish a
              consensus probability of containment for each region. Effective sweep width quantifies
              detectability in each segment. From those inputs the worksheets calculate coverage,
              probability of detection, and probability of success, then adjust the remaining probability
              after each operational period so the next allocation is based on what is still unknown.
              A searched segment is not a cleared segment. The worksheets track how much probability
              remains in it.
            </p>
          </div>
        </section>

        {/* what this is */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">About this site</h2>
          <p className="text-slate-700 leading-relaxed">
            The Inland SAR Planning Course (ISPC) distributed a Windows application, SearchManager,
            that implemented its two core planning worksheets: the PSR-Based Ground Effort Allocation
            Worksheet and the ASAD Air Resource Allocation Worksheet. This site rebuilds both
            worksheets for the browser, following the ISPC
            Student Guide and cross-checked against the original application running in a virtual
            machine. It requires no installation and runs in any modern browser.
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Status: the ground worksheet, including the effort allocation optimizer, has been verified
            against the original application. Verification of the air worksheet is in progress.
          </p>
        </section>

        {/* resources */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-3">Resources</h2>
          <ul className="space-y-2 list-disc pl-5">
            <Ref title="Inland SAR Planning Course, National SAR School"
              meta="The five-day course these worksheets come from, taught by the joint USCG and USAF National SAR School."
              href="https://www.forcecom.uscg.mil/Our-Organization/FORCECOM-UNITS/TraCen-Yorktown/Training/Maritime-Search-Rescue/Inland-SAR/Inland-Course/" />
            <Ref title="Sweep Width Estimation for Ground Search and Rescue (2004)"
              meta="Koester, Cooper, Frost, and Robe. U.S. Coast Guard. Ground detection experiments and sweep width tables."
              href="https://www.dco.uscg.mil/Portals/9/CG-5R/nsarc/DetExpReport_2004_final_s.pdf" />
            <Ref title="Use of the Visual Range of Detection to Estimate Effective Sweep Width (2014)"
              meta="Koester et al., Wilderness and Environmental Medicine 25(2). Field measurement method for estimating sweep width from range of detection."
              href="https://journals.sagepub.com/doi/full/10.1016/j.wem.2013.09.016" />
            <Ref title="A Method for Determining Effective Sweep Widths for Land Searches (2002)"
              meta="Robe and Frost. Procedures for conducting ground detection experiments."
              href="https://www.dco.uscg.mil/Portals/9/CG-5R/nsarc/LandSweepWidthDemoReportFinal.pdf" />
          </ul>
        </section>
      </main>

      {/* footer */}
      <footer className="border-t bg-white">
        <div className="max-w-4xl mx-auto px-6 py-6 text-xs text-slate-500 space-y-1">
          <p>This site is under active testing and has not been validated for operational search planning.</p>
          <p>Not affiliated with the National SAR School, U.S. Coast Guard, or U.S. Air Force.</p>
          <p>Bugs and feedback: <a href="mailto:peter.dellavecchia@cowg.cap.gov" className="text-emerald-700 hover:underline">peter.dellavecchia@cowg.cap.gov</a></p>
        </div>
      </footer>
    </div>
  );
}
