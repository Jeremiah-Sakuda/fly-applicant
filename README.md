# Fly Applicant

A fruit fly's brain applies to 1,000 jobs a day. The wiring is real, the clicks are real, the job market is a joke.

**Watch it live:** https://fly-office.vercel.app

- **Brain.** All 166,700 annotated neurons of the MaleCNS v1.0 connectome (HHMI Janelia and Google Research) with 25.6 million signed, normalized connections. Leaky integrate-and-fire dynamics at 20 ms steps, following the parameters of [Fly64](https://github.com/ornata/fly). Runs at about 0.8–0.9× real time on an M3 Pro.
- **Output.** Every DNg100 spike (the descending neuron that drives forward walking, 2 cells) becomes one click in a real Chromium browser via Playwright. The steering neurons DNa02 and DNg13 scroll the feed. On the résumé form, each spike types one letter.
- **Input.** The job board's outcomes go back into the brain. A rejection injects current into the 38 bitter taste neurons (LB1a–d, Gr33a+). The interview injects current into the 23 sugar taste neurons (LB3c, Gr64f+). Cell-type matches come from the 2026 adult gustatory connectome paper in *Cell*.
- **Studio.** A three.js scene of a hologram fly at a tiny desk with a vertical monitor. The monitor shows the actual board page, streamed live. Inside the head, every one of the 140,638 neurons with a soma coordinate sits at its real position and lights up when it spikes. DNg100's real traced skeleton carries each spike from the brain down the neck.

## Fly Office: the live 3D page

`web/office/` is a standalone page: a lit bedroom-office where a cartoon fly sleeps, walks to its desk and applies to jobs forever, with a live brain panel. The brain runs in your browser in a Web Worker: all 166,700 neurons and the 2.75 million connections with at least 10 synapses (54% of all synapses), each neuron's input renormalized. It spikes at about 9,100 cells per step, close to the full model's 10,900, and DNg100 fires at about 0.75 Hz per cell.

```bash
.venv/bin/python -m flyjobs export-web
.venv/bin/python -m flyjobs office
```

Then open http://127.0.0.1:8780/.

The room runs on a sim clock. The fly sleeps until 7 AM, walks to the desk, applies until 6:30 PM or 30 applications, then burns out and goes to bed. The sky in the window, the sunlight on the floor and the room lights follow the clock, and the desk lamp clicks off at bedtime. Its phone runs FlyMail, where rejections, auto-replies, recruiter spam, unpaid take-homes, personality tests, reposted jobs and nepotism announcements arrive. About 58% of applications are ghosted and about 40% get a rejection, so FlyMail gets a readable trickle, and its banners are spaced at least 4.5 seconds apart. The 100× skip runs the real brain as fast as the device allows (about 13× real time on an M3 Pro) and draws the remaining DNg100 clicks from the brain's live measured firing rate; the skip banner shows both numbers. A fruit fly lives about 50 days, so every 50 sim days a new generation inherits the job search. Before bed and right after the alarm, it doomscrolls Buzz, a short-video app full of job-search content, in the dark with the phone lighting its face. Each swipe is a DNg100 spike after a short dwell, each new video pulses the 275 LC10a visual neurons, and the panel tracks screen time. Every video is also a dopamine hit: it stimulates the 316 PAM reward neurons and lowers a dopamine receptor sensitivity dial by 4%, which sleep only partly restores. That dial is our model, not something in the connectome. It scales every synapse from the 392 dopamine neurons, and fully fried it lowers mushroom body output by about 15% in the simulation (`node tools/dopamine_test.js`). A fried fly has a shorter attention span, scrolls longer, goes to bed later, and smokes. A new generation starts fresh. Some postings route through Workdaze, where each DNg100 spike types one letter of the résumé before the session expires. The only interview it ever gets is a one-way AI interview with HireBot 9000, where each DNg100 spike is a "bzz" in the transcript.

To share it outside Claude, build the static site and deploy the folder to any static host:

```bash
.venv/bin/python tools/build_site.py
cd dist/fly-office && vercel deploy --prod
```

Controls: camera presets, Send rejection (bitter neurons), AI interview (sugar neurons for hope, then bitter), Ring phone (JO-B hearing neurons, wakes the fly), sound, and 1×/2×/4× speed. Walking speed and stepping follow DNg100's firing rate, steering wobble follows DNa02/DNg13, and every click on Easy Apply is a DNg100 spike. The day schedule, the route and the job market are scripted.

## Run it

```bash
./run --autostart
```

The first run creates `.venv`, installs Chromium, downloads about 1.1 GB from the public `flyem-male-cns` bucket and compiles it into `data/` in roughly 20 seconds. Then open http://127.0.0.1:8765/studio.html to watch, or look at the headed Chromium windows.

| Command | What it does |
|---|---|
| `./run --autostart` | Brain, board, studio, and a visible browser the fly drives |
| `./run --headless --autostart --record out/run.mp4` | Same, recorded to a 1080×1920 30 fps video plus `out/run.events.json` |
| `.venv/bin/python -m flyjobs cut out/run.mp4` | Edits the recording into the 35 s reel at `out/reel.mp4` |
| `.venv/bin/python -m flyjobs cut out/run.mp4 --no-captions --out out/reel_clean.mp4` | Same cut without burned-in captions |
| `.venv/bin/python -m flyjobs serve` | Server only; press Start in the studio page (no clicks happen without the driver) |
| `.venv/bin/python -m pytest -q` | Tests, including checks against the real data |

Studio keys: `1` desk, `2` screen, `3` brain, `a` auto director, space to start or pause.

A full run to 1,000 applications takes about 25 minutes. Most gaps are about one second. The Workdaze form adds about 20 seconds each time because the fly types 18 letters one spike at a time.

## What is real and what is not

- **Real:** the neuron list, soma positions, connections and neurotransmitter signs; the DNg100 and taste-neuron skeletons; the fact that nothing on the browser side decides when to click.
- **Modeled:** the dynamics. Leaky integrate-and-fire with tonic drive just under threshold and random kicks is a standard simplification, not a fitted model of this fly.
- **Not there:** sensing and learning. The fly never sees the posting and no synapse changes. Taste input lights up the taste neurons but has no measurable effect on the DNg100 click rate (tested across seeds). It is button mashing shaped by real wiring, which is what the caption says.
- **Scripted:** the job market. Postings, rejection copy and latencies are seeded comedy, and exactly one interview is scheduled, on application 612 by default (`--interview-at`).

## Files

| Path | Role |
|---|---|
| `flyjobs/data.py` | Download and compile MaleCNS, resolve the pins, fetch skeletons |
| `flyjobs/model.py` | The LIF brain and its input and output pins |
| `flyjobs/outcomes.py` | The mock job market |
| `flyjobs/server.py` | aiohttp server, brain thread, websocket streams |
| `flyjobs/driver.py` | Playwright clicks and typing, board-to-monitor streaming, recording |
| `flyjobs/cut.py` | Automatic reel edit from the run's event log |
| `web/board.html` | Hatchery, the job board, and Workdaze, the résumé-retype portal |
| `web/studio.html` | The 3D studio |
| `tools/snap.py`, `tools/realtime.py` | Framing snapshots and a real-time check |

## Sources

- MaleCNS v1.0 flat connectome, skeletons: `gs://flyem-male-cns/v1.0/`
- Fly64 by ornata, whose data preparation and LIF parameters this follows: https://github.com/ornata/fly
- Gustatory cell types: "The complete gustatory connectome of adult Drosophila reveals how taste guides feeding, foraging, and social behavior", *Cell* (2026)
