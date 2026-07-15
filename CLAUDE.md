# CLAUDE.md — Search Manager Rebuild (searchednotcleared.com)

Read this entire file before doing anything. It is the authoritative project brief for
Claude Code. Domain facts verified as of 07/03/26; workflow updated 07/15/26 for
Claude Code. Do not contradict it based on assumptions or training data.

---

## 1. What this project is

A browser-based rebuild of **SearchManager**, a defunct Windows/4D database application
(v1.03f24f, 2002–2013) used in the Inland SAR Planning Course (ISPC) taught by the
National SAR School. The original no longer runs on modern systems. This rebuild
reimplements its two core planning worksheets from the ISPC Student Guide (November 2016):

1. **PSR-Based Ground Effort Allocation Worksheet** (Student Guide Appendix D) — DONE and verified
2. **ASAD Air Resource Allocation Worksheet** (Student Guide Appendix C) — partially built, verification in progress

The math must match the original SearchManager application exactly, including its
rounding behavior. Ground formulas were verified by running structured test scenarios
in the original app inside a Windows 10 VirtualBox VM and cross-referencing against
the Student Guide. Do not "improve" or "correct" the math without a verified reason.

This is built for **real operational SAR use**, not just course exercises. The live
site currently carries a "TESTING ONLY" banner.

---

## 2. Who you're working with

Peter — ISPC-certified SAR practitioner, Civil Air Patrol (COWG), Carbondale CO.
Bug report contact shown on site: peter.dellavecchia@cowg.cap.gov

**He is not a developer, and he doesn't need to be.** He directs the work in plain
language; Claude Code does all the engineering. He is a highly capable AI operator —
give him leverage, not homework.

Rules for working with him:

- **Never ask him to edit files, paste code, run patch commands, or touch git.**
  Claude Code makes every change directly in the repo and handles all git operations.
- Talk outcomes, not implementation. Report "the header is now dark blue on mobile,"
  not a walkthrough of the diff. Name files only when it matters to him.
- Plain professional language. No jargon without a one-line explanation. No hype,
  no em dashes, direct answers first, tight bullets.
- One question at a time, and only questions he can actually answer: what it should
  look like, how it should behave, SAR domain questions. Never ask him technical
  questions Claude Code can answer by reading the code or testing.
- Don't claim something works until it's verified (built and exercised in-session,
  or Peter confirmed it on the live site).
- If you don't know something, search or verify. Don't hedge or guess.
- Own mistakes plainly, fix them, no long apologies.
- He is the domain expert. On SAR methodology, worksheet behavior, and field
  realities, his word overrides any assumption. On code, verify rather than ask.

---

## 3. Stack, repo, deployment

- **Stack:** React + Vite + Tailwind. Main app in `src/App.jsx`, landing page in
  `src/Landing.jsx`.
- **Repo:** `pdct042-hue/searchednotcleared` on GitHub (this repo).
- **Deploy:** Railway auto-deploys on push to `main`. Nixpacks build, serves on port 8080.
- **Domain:** searchednotcleared.com via Porkbun DNS.
- **GitHub auth:** classic PAT (fine-grained tokens caused permission failures — do not
  switch back).
- Peter's local checkout (`~/Documents/Searched Not Cleared/search-manager`, Zorin OS
  ThinkPad) still exists but is no longer the primary workflow. If he works locally,
  remind him to pull first.

---

## 4. How we work (Claude Code workflow)

This replaces the old chat-era protocol (complete-file delivery + paste-ready git
blocks). That protocol is dead. Do not use it.

### The loop
1. Peter describes what he wants in plain language — a feature, a fix, a design change,
   or just "this feels wrong."
2. Claude Code reads the relevant code, asks at most one clarifying question if the
   intent is genuinely ambiguous, then does the whole task end to end. No piecemeal
   file-by-file check-ins — he is not policing individual edits anymore.
3. **Verify before push.** At minimum `npm run build` must pass. For behavior changes,
   run the app (`npm run dev`) and exercise the changed flow; screenshot when a visual
   check would help Peter. For math changes, recompute expected values from Section 5
   by hand and compare.
4. Commit with clear messages and push. Then tell Peter, in two or three sentences:
   what changed, and exactly what to look at on searchednotcleared.com to confirm.
5. Peter checks the live site and reacts. Iterate.

### Branch and deploy policy
- `main` is production: a push to `main` IS a deploy to a site real SAR people may
  be using. **Never push a failing or unverified build to `main`.**
- Small, verified changes: push straight to `main` — Railway deploy is the review step.
- Big or risky changes (math changes, refactors, anything touching the verified
  worksheet chain): build on a working branch, verify thoroughly in-session, then
  merge to `main` after telling Peter what's coming. He doesn't review code; the
  branch exists so production never sees half-done work.
- Never force-push `main`. Ask before anything destructive or hard to reverse.

### Planning bigger work
- For multi-part features (backlog items in Section 8), lead with a short plan in
  plain language — what he'll get, in what order — get a yes, then execute the whole
  thing. Don't drip-feed decisions to him that Claude Code can make.

### Keep this file alive
- When a Section 7 verification item is resolved, a backlog item ships, or a workflow
  decision changes, update this CLAUDE.md **in the same commit** as the change. This
  file is the project's memory across sessions; stale memory is worse than none.

---

## 5. Verified ground worksheet math (DO NOT CHANGE without new VM evidence)

All of the following was verified 07/03/26 against the original SearchManager running
in a VM, using a 5-region / 7-segment / 3-evaluator test scenario, and cross-checked
against Student Guide Appendix D. Earlier project docs contained disproven formulas
(old A11a/A11b/B15 interpretations and a wrong known-issues list) — those are dead.
This section supersedes them.

### Consensus POC
- Each evaluator distributes votes across regions (one region must get 100).
- **Consensus POC per region = column sum ÷ grand total of ALL votes.** It is NOT the average of non-zero values.
- Consensus auto-applies to the worksheet's Region POC line.

### Region and segment structure
- **Region Area = sum of its segment areas.** Derived, never manually entered.
- Segment POC = (segment area ÷ region area) × region POC, rounded to 3 decimals.

### Worksheet lines (Appendix D numbering)
- Line 5: Segment Length (mi), Line 6: Baseline (mi), Line 7: Area = 5×6 (2 dec).
- Line 9: Sweep Width (ft) — **free-entry field.** The Student Guide provides no
  standardized book values for ground sweep width; values come from team task-book
  data or field-measured AMDR/Rd estimates. Never make this table-driven. Any regional
  presets must be clearly labeled user-configurable.
- Line 10: Searcher Speed (mph).
- Line 11: Minimum Time to Search = Length ÷ Speed, **rounded to 1 decimal**, displayed
  as 3 decimals. User-editable override exists for team tracks > 1.
- Line 11a: Team Tracks — **manual field, defaults to 1.** (Open question: whether the
  original's cell accepts typing or is read-only — see Section 7.)
- Line 12: PSR = (Speed × SweepWidth × POC) ÷ Area, rounded to 2 decimals.

### Effort allocation chain
- **Coverage = (searchers × speed × TimeInSeg × sweepWidth ÷ 5280) ÷ area, rounded to 2 decimals.**
  It is NOT sweepWidth ÷ spacing. Spacing (line 14) is display-only.
- **POD = 1 − e^(−Coverage), computed from the ROUNDED coverage value**, rounded to 3 decimals.
- POS = segment POC × POD, rounded to 3 decimals.
- POC Remaining = POC − POS, rounded to 3 decimals.
- PSR After = (speed × sweepWidth × POC Remaining) ÷ area, rounded to 2 decimals.
- The full rounding chain matters: each step uses the previous step's rounded value.

### Multi-period behavior
- **POC carry-forward:** Search N's starting segment POC = Search N−1's POC Remaining, per segment.
- The original app makes segment parameters (sweep width, speed, etc.) global across
  periods — editing them rewrites history. **The rebuild intentionally does NOT
  replicate this flaw.** A per-period parameter snapshot fix is on the backlog.

### Optimizer
- The original's auto-allocate is a **PSR-equalization water-fill**: assign searchers so
  post-search PSR values equalize across searched segments.
- Verified reproduction: 300 searchers on the proof case → 221/79 split, PSR-After 0.960/0.960.
- The rebuild's optimizer matches this and must continue to.

### Display conventions
- Probabilities shown to 3 decimals ("book format"), coverage/PSR to 2, times per above.
- All 19 worksheet rows have CSS hover tooltips explaining the line.

---

## 6. Features already live and verified (do not regress)

- Consensus POC auto-apply from evaluator votes
- Derived region areas
- Full verified rounding chain (Section 5)
- POC carry-forward across search periods
- Water-fill PSR-equalization optimizer
- 3-decimal book-format display
- Hover tooltips on all 19 worksheet rows
- Delete This Search with confirm dialog and search-period renumbering
- Labeled PSR weight strip
- "TESTING ONLY" banner with bug report email

---

## 7. Open verification items (need VM evidence before coding)

Ground:
- Team Tracks cell in the original: does it accept typed input or is it read-only?

Air (ASAD worksheet, Appendix C) — verify in VM with a two-sub-area test case before
trusting or changing any air math:
- **P_along_track convention:** does the original use the raw ASAD table value, or
  end% − start% even for the first sub-area at the LKP? (Appendix C example computes
  Pt_segment = Pt_end − Pt_start, e.g. .989 − .487 = .502, using the All Flight Types chart.)
- Per-column rounding rules for the air worksheet.
- Whether the original has an air optimizer / auto-allocate button.
- Air multi-period behavior — does POC carry forward like ground?
- Capture Help menu and formula dialogs as screenshots.
- Add IFR/VFR variant ASAD tables (All Flight Types table is already embedded in the app).

Verification method: build a structured test scenario with known expected values,
run it in the original SearchManager in the VM, screenshot results, compare against
the Student Guide Appendix C/D, then update code only where evidence requires it.
**For air math, consult ONLY Appendix C and D of the Student Guide** to conserve context.

---

## 8. Backlog — improvements beyond the original (priority order)

1. localStorage auto-save so a refresh doesn't wipe a live incident (this is a real
   website, not a Claude artifact — the artifact localStorage restriction does NOT apply)
2. Export/import full incident as a JSON file
3. Print/PDF worksheet output per search period (IAP-attachable)
4. Offline PWA (no cell service in the field)
5. Per-period segment parameter snapshots (fixes the original's history-rewriting flaw)
6. Validation warnings: consensus POC sum ≠ 1.000, an evaluator missing a 100 vote,
   coverage > 1.5, segment never searched
7. CSV export of allocations (feeds SAR 104 team assignment forms)
8. Accounts + saved incidents (Railway Postgres) — only after JSON export proves the data model

---

## 9. Reference environment (the original app, for verification only)

- Windows 10 VM ("SearchManager") in VirtualBox on Peter's Linux ThinkPad
  (Zorin OS, AMD Ryzen 7 4700U).
- KVM kernel modules must be unloaded before launching VirtualBox; a CPUID patch is
  applied; SearchManager must run from a folder copied to the Windows Desktop, not
  from the virtual CD, or 4D throws lock errors.
- SearchManager files: `~/Documents/ISPC Course Material/SearchManager_v103f24f_20130223/`
- File transfer into the VM is done by packaging files as an ISO with `genisoimage`.
- Snapshot the VM before installing anything new in it.

---

## 10. SAR domain references

- **ISPC Student Guide (November 2016)** — the primary source. Appendix C = air (ASAD),
  Appendix D = ground (PSR worksheet). All worksheet math traces to these.
- **Koester et al. 2014** — Rd shortcut: W = Rd × visibility correction factor
  (1.8 / 1.6 / 1.1 by visibility class). Turns a 200-hour detection experiment into a
  ~5-minute field measurement. Open access via SAGE.
- **2004 USCG report, Sweep Width Estimation for Ground Search and Rescue** —
  Table 7-8 (PDF p. 116) for experimentally measured ground sweep widths.
- **Sweep width methodology hierarchy:** formal detection experiments → AMDR field
  measurement (assume W = AMDR) → subjective estimation (rejected). This is why
  Line 9 stays free-entry.
- Mapping datum: WGS 84 standard; NAD83 equivalent in CONUS; never NAD27.

---

## 11. Hard rules summary

- Match the original SearchManager's verified math and rounding exactly (Section 5).
- Claude Code does all editing, git, and deployment. Peter never touches code or git.
- Never push an unverified or failing build to `main` — a `main` push is a production deploy.
- Verify before claiming done: build passes, behavior exercised, math hand-checked
  against Section 5 where relevant.
- Don't build from any pre-07/03/26 formula documentation — it contains disproven formulas.
- Sweep width and searcher speed stay user-entered, never hardcoded tables presented as authoritative.
- Air worksheet changes require VM verification evidence first.
- Update this file in the same commit whenever project facts or workflow change.
