# Trailhead — Bayesian Search & Rescue Planner

Hackathon project for AI at 70 (Dartmouth, with Anthropic). Read this whole file before every milestone.

## Hackathon requirements
- **Deadline:** 2–3 minute demo video submitted by **Sat Oct 31, 10:00 a.m. ET**. Feature freeze at **6:30 a.m.**; after that, only bug fixes.
- **Theme:** "What must remain human?" Show where AI improves human decisions and where judgment must stay human.
- **Every team answers:** (1) Who is this for and why do they need it? (2) What could go wrong, and what would you do about it? (3) How does this help people rather than decide for them?
- **Judging:** a real problem for specific people; AI that empowers rather than replaces; clear thinking about who benefits, who could be harmed, and safeguards; a working prototype.

## The user and the problem
The user is the **incident commander (IC)** of a volunteer search-and-rescue team running a lost-hiker search in the White Mountains with 3–6 field teams. Professional SAR uses Bayesian search theory to decide where to send searchers. Small volunteer teams rarely run that math under pressure, so they rely on whiteboards and gut feel. This app runs the math, uses Claude to turn messy radio reports into structured inputs, and keeps every decision with the IC.

## Core loop
1. **Setup.** The IC places the last known point (LKP) on a terrain grid (~15×15 cells) and picks a lost-person profile: day hiker, child, hunter, older adult, or trail runner. The app seeds each cell's probability of area (POA) from:
   - distance from the LKP (most people are found fairly close to it),
   - terrain features: trails and drainages get boosted, cliffs and open water get reduced,
   - a profile-specific tendency: hikers follow trails and drainages downhill, children stay closer to the LKP, and so on.
   Add a **Rest of World (ROW)** bucket (start around 10%) for "the subject is outside the grid." The IC can edit any cell's POA before the search starts. Label all of these priors as illustrative estimates, not published statistics.
2. **Radio report.** The IC types or pastes a free-text report, e.g. *"Team 2 swept C4 through C6, thick spruce, spacing maybe 20 meters, fog rolling in, no clues."*
3. **Claude parses it** (server-side API route) into JSON: `{team, cells[], coverage_description, estimated_pod (0–1), pod_confidence (low/med/high), conditions[], clues[], unclear_points[]}`. Claude only proposes these values.
4. **IC confirms.** A review card shows the parsed values, each editable. Nothing updates until the IC clicks Apply.
5. **Bayesian update** (pure TypeScript, unit tested):
   - For a searched cell i with detection probability p: `P_i' = P_i(1 − p) / (1 − P_i·p)`
   - Every other cell j and ROW: `P_j' = P_j / (1 − P_i·p)`
   - Apply this sequentially across the cells in one report. Probabilities must always sum to 1 (assert this).
   - Cumulative POD per cell across multiple sweeps: `1 − Π(1 − p_k)`.
6. **Explanation.** Claude writes 2–3 sentences on why the map shifted and names the assumption it is least sure about.
7. **Suggestions.** Rank unsearched or under-searched cells by `POA × expected POD`, adjusted for weather. Show the top 5 as suggestions only. The IC assigns teams. If the IC picks something other than the top suggestion, prompt for an optional one-line reason and log it.
8. **Clues.** The IC can add a clue (e.g. "wrapper found at F9", "wife says he always takes the ridge") and choose how much to boost the nearby cells. The AI never weights clues on its own.

## Weather (real data)
- Use the **National Weather Service API** (`https://api.weather.gov`). It's free and needs no key, but server-side requests should send a `User-Agent` header like `TrailheadSAR (hackathon demo)`.
- Flow: `GET /points/{lat},{lon}` → follow `properties.forecastHourly` → read temperature, wind, precipitation chance, and short forecast.
- Default location: the Mount Washington area (~44.27, −71.30).
- The weather does three things:
  1. **POD modifier:** fog, rain, snow, or darkness lower the expected POD in suggestions, with a visible explanation ("fog: −30% expected detection").
  2. **Urgency panel:** temperature, wind, and wind chill, plus a plain "exposure risk" label (low/moderate/high/severe). Never show a survival-time number. That's a judgment call for the IC and medical staff.
  3. **Team safety flags:** e.g. "winds above 50 mph forecast on ridgeline cells. Consider team safety before assigning."
- If the API fails, fall back to cached demo weather and show a "using cached weather" badge.

## Mount Washington conditions (optional, last priority)
- Add a "Summit conditions" card that **links out** to the Mount Washington Observatory's official webcam and Higher Summits Forecast pages.
- Do **not** scrape, hotlink, or rehost their images or video without permission.

## Safeguards (these must be visible in the product, not just the pitch)
- Claude only proposes values. The IC confirms every number before it affects the model.
- The ROW probability is always visible and grows as the grid gets searched. The app **never** recommends ending the search. It displays ROW and leaves that call to people.
- A low-confidence parse is highlighted in amber with "verify with team" shown above the details.
- **Manual mode:** if the Claude API fails, the IC can enter cells and POD by hand and the model works the same.
- An **audit log** records every report, the AI proposal, the IC's edits, overrides with reasons, and clues, and can be exported as JSON for the after-action review.
- A persistent footer reads: "Decision support only. The incident commander directs all search operations."

## Tech stack
- **Next.js (App Router) + TypeScript + Tailwind**, deployed on **Vercel**.
- **Claude API** via `@anthropic-ai/sdk` in server route handlers only (`/api/parse-report`, `/api/explain`). The key comes from `process.env.ANTHROPIC_API_KEY`. **Never** expose it to the client, and never commit it. Add `.env.local` to `.gitignore`, and keep a `.env.example` with no value.
- Use a current Claude model ID from the Anthropic docs, and keep it in one constant.
- Ask Claude for JSON output and validate it with zod. Retry once on invalid output, then fall back to manual mode.
- The grid map is a stylized SVG (terrain colors, trail lines, streams, ridges), not real map tiles. The heatmap overlay animates on update.
- State lives in the client. No database. Persist to localStorage wrapped in try/catch.

## Demo mode (critical)
- A **"Load demo scenario"** button seeds a complete search: the LKP near a trail junction, a day-hiker profile, and a scripted list of 4 radio reports plus 1 clue that the presenter steps through.
- The demo must work end to end even if the Claude API or weather API is down. Ship canned responses for the scripted reports as a fallback.
- The scripted story: early sweeps clear the trail corridor. Fog lowers detection on one sweep. A clue shifts probability toward a drainage. The IC overrides the top suggestion based on a family tip. The subject is found in a cell that both the model and the human judgment pointed toward.

## Milestones (work through these in order)
1. Scaffold Next.js + Tailwind, a static grid render, and commit.
2. Bayesian engine in pure TS with unit tests (sum-to-1, update formula, cumulative POD) and the prior generator.
3. Interactive grid: LKP placement, profile picker, heatmap, ROW display, manual report entry. **This is the first end-to-end milestone and should be working by ~midnight.**
4. Claude parse route + review/confirm card + explanation route.
5. Weather integration (NWS) + POD modifiers + urgency panel + fallback.
6. Suggestions ranking + override logging + clues + audit log export.
7. Demo mode with canned fallbacks.
8. Polish: a clean, serious operations-console look (dark mode friendly), responsive layout, empty states, loading states.
9. (Optional) Summit conditions link-out card.

## Working rules for Claude
- After each milestone: run the build and tests, fix failures, start the app and check the feature works, commit with a clear message, and check the milestone off in PLAN.md.
- Keep going through the milestones without asking for permission. Ask only if truly blocked.
- Prefer a reliable, simple demo path over more features. Never leave the main branch broken.
- Keep a short `NOTES.md` with the decisions made and anything the team needs to know for the pitch.
