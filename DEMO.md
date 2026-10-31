# Demo run sheet (2–3 min video)

Recording at https://trailhead-sar.vercel.app at 1440 px wide. Before you hit record: **Reset**, confirm the footer reads "Decision support only…", and check the Weather tab badge says **Live NWS**. The demo runs on bundled terrain with canned fallbacks, so it works even if Claude, NWS or Overpass are down. Layout: map on the left (sticky), demo card and tabs on the right (**Operations · Cell · Clues · Weather · Log**).

Target timing in brackets. Spoken lines are written to be read aloud as-is.

## Intro (~20 s)
| Click | Say |
|---|---|
| (App open, empty map) | "This is Trailhead, for the incident commander of a small volunteer search-and-rescue team. Professional SAR teams use Bayesian search theory to decide where to look next. Volunteer ICs rarely have time to do that math at 2 a.m., so they use whiteboards and gut feel." |
| **Load demo scenario** (header) | "Mount Washington, real OpenStreetMap terrain. A day hiker is overdue from the Lakes of the Clouds hut. The status bar keeps the vitals in view: last known point, how long he's been missing, Rest of World, urgency, exposure." |

## The search (~1 min 50 s)
| # | Click | Say |
|---|---|---|
| 0 | **Receive call-out → pre-fill subject**; check **Fitness = High** and **Experience = Some or Experienced** on the card (the story is tuned for a fit hiker), then **Confirm subject** | "The wife's call comes in. Claude reads it into a structured subject: age, fitness, gear, when he was last seen. I confirm every field. From that, the model draws the distance rings, how far people like Dan are usually found, and scores the relative urgency chart ICs are trained on: measured response, thirteen of twenty-one." |
| 1 | **Receive radio report → parse**; check the cells read **E10, F10, G10, G9** (add E10 by clicking it on the map if Claude left it out), then **Apply to map** | "Team 1 radios in. Claude turns the report into cells and a detection estimate, but it only proposes. Nothing changes until I click Apply. The trail cells cool, and Rest of World ticks up." |
| 2 | **Receive radio report → parse**, then **Apply to map** | "Team 2 line-searches around the hut. Probability moves downhill into the two drainages. Claude explains the shift and names the assumption it's least sure about." |
| 3 | **Receive radio report → parse**, point at the amber card, then **Apply to map** | "Fog. Claude flags this parse as low confidence: verify with team. Detection is only 25 percent, so these cells are barely cleared, and the weather tab shows the forecast cutting expected detection." |
| 4 | Clue: click **small ×1.5** (the highlighted button). *Not medium.* | "Team 4 found a wrapper at G13. The AI never weights clues. I decide how much it matters. It's a busy trail, so I give it a small boost." |
| 5 | **Receive radio report → parse**, then **Apply to map** | "Team 2 clears the Ammonoosuc Ravine. Now the Dry River drainage stands out." |
| 6 | **Prefill assignment: Team 3 → G14**, then **Assign** in Suggestions, keep the reason, **Assign with reason** | "The model ranks the wrapper cell first and the fogged cell second. But his wife says he always follows water downhill. I send Team 3 to G14, the model's number three. The app asks why and logs it. It doesn't argue." |
| 7 | **Log subject located** | "Found in G14, beside the Dry River. The model narrowed the field; the human made the call." |

## Close (~30 s)
| Click | Say |
|---|---|
| **Publish to CalTopo** (header) → **Publish**, then **Open map ↗** | "One click puts the probability zones, suggestions, team outlines and markers onto the team's CalTopo map, the tool SAR teams already use, in a folder Trailhead owns. Human-drawn features are never touched, and the subject's personal details never leave this laptop." |
| **Log** tab, point at the audit log | "Every report, AI proposal, IC edit, clue, override and publish is logged for the after-action review." |
| (Point at ROW and footer) | "What could go wrong? Claude could misread a report, so the IC confirms every number. The map could look more certain than it is, so Rest of World is always on screen and the app never says stop searching. If the API is down, manual entry works the same." |
| (Hold on map) | "Trailhead does the arithmetic and the transcription. Every judgment stays with the incident commander." |

## If something goes wrong on camera
- **Picked the wrong clue boost:** a dialog asks before anything but small. Click **Cancel**. If medium was applied anyway, G14 becomes #2 and line 6 no longer fits: **Reset** and start over.
- **Claude read something differently:** that is the review card doing its job. Fix the field or cell and apply; the story needs the cells listed above and a fit subject.
- **Parse is slow or fails:** the canned parse or canned subject fills the card (amber tag); keep going.
- **Weather badge says "Using cached weather":** fine for the demo. Optionally say "when the weather service is down, it says so."
- **"Publish to CalTopo" button is missing:** the three `CALTOPO_*` variables are not set in Vercel (see NOTES.md). Use **Export for CalTopo** instead and say "the file imports straight into CalTopo."
- **Subject card says the model suggests ~60 % outside the grid:** that's honest; a hiker missing 6 h is often beyond a 4 km box. Say "the model flags it; the IC keeps ROW at 10 % because he was headed for the summit in fog."
