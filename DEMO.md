# Demo run sheet (2–3 min video)

Recording at https://trailhead-sar.vercel.app. Before you hit record: open the app, click **Reset**, and confirm the footer reads "Decision support only…". The demo runs on bundled terrain with canned fallbacks, so it works even if Claude, NWS or Overpass are down.

Target timing is in brackets. The spoken lines are written to be read aloud as-is.

## Intro (~20 s)
| Click | Say |
|---|---|
| (App open, empty map) | "This is Trailhead, for the incident commander of a small volunteer search-and-rescue team. Professional SAR teams use Bayesian search theory to decide where to look next. Volunteer ICs rarely have time to do that math at 2 a.m., so they use whiteboards and gut feel." |
| **Load demo scenario** | "Dan, 58, a day hiker, left the Lakes of the Clouds hut on Mount Washington in fog. This is real OpenStreetMap terrain. The heatmap shows illustrative priors from his last known point and profile, and Rest of World stays visible the whole time." |

## The search (~1 min 50 s)
| # | Click | Say |
|---|---|---|
| 1 | **Receive radio report → parse**, then **Apply to map** on the review card | "Team 1 radios in. Claude turns the report into cells and a detection estimate, but it only proposes. Nothing changes until I click Apply. The trail corridor cools, and Rest of World ticks up." |
| 2 | **Receive radio report → parse**, then **Apply to map** | "Team 2 clears the corridors around the hut. Probability moves downhill into the two drainages. Claude explains the shift and names the assumption it's least sure about." |
| 3 | **Receive radio report → parse**, point at the amber card, then **Apply to map** | "Fog. Claude flags this parse as low confidence: verify with team. Detection is only 25%, so these cells are barely cleared, and the weather panel shows fog cutting expected detection." |
| 4 | Clue: click **small ×1.5** (the highlighted button). *Not medium.* | "Team 4 found a wrapper at G13. The AI never weights clues. I decide how much it matters. It's a busy trail, so I give it a small boost." |
| 5 | **Receive radio report → parse**, then **Apply to map** | "Team 2 clears the Ammonoosuc Ravine. Now the Dry River drainage stands out." |
| 6 | **Prefill assignment: Team 3 → G14**, then **Assign** in Suggestions, check the prefilled reason, **Assign with reason** | "The model ranks the wrapper cell first and the fogged cell second. But his wife says he always follows water downhill. I send Team 3 to G14, the model's number three. The app asks why and logs it. It doesn't argue." |
| 7 | **Log subject located** | "Found in G14, beside the Dry River. The model narrowed the field; the human made the call." |

## Close (~30 s)
| Click | Say |
|---|---|
| Scroll to audit log, point at **Export for CalTopo** | "Every report, AI proposal, IC edit, clue and override is in the audit log for the after-action review, and the grid exports straight into CalTopo, the tool SAR teams already use." |
| (Point at ROW and footer) | "What could go wrong? Claude could misread a report, so the IC confirms every number. The map could look more certain than it is, so Rest of World is always on screen and the app never says stop searching. If the API is down, manual entry works the same." |
| (Hold on map) | "Trailhead does the arithmetic and the transcription. Every judgment stays with the incident commander." |

## If something goes wrong on camera
- **Picked the wrong clue boost:** a confirm box appears for anything but small. Click **Cancel**. If medium was applied anyway, G14 becomes #2 and line 6 no longer fits: click **Reset** and start over.
- **Parse is slow or fails:** the canned parse fills the card; keep going.
- **Weather badge says "Using cached weather":** fine for the demo. Optionally say "when the weather service is down, it says so."
