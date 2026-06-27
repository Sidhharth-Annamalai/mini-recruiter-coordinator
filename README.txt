# Mini Recruiter Coordinator

Built for the AICOO Hackathon — *"Build products where agents coordinate."*

Turns a candidate's profile into a live Aicoo agent in seconds, then hands you a shareable link a recruiter can open and talk to directly. No signup wall for the recruiter, no PDF resume, no email back-and-forth — just a conversation with an agent that actually knows the candidate.

## What it does

1. **Candidate fills in a short profile** (name, target role, skills, availability).
2. The app calls Aicoo's API to spin up an agent and saves that profile as context (`/init` + `/accumulate`).
3. The app generates a **share link** (`/share/create`) — Aicoo's own hosted page where anyone can chat with that agent.
4. The candidate sends the link to a recruiter. The recruiter opens it, asks questions, and the agent answers using only the context it was given.
5. Optionally, an interview time can be booked directly through Aicoo's calendar tool (`schedule_meeting`) from the app.

## Aicoo features used

- `POST /init` — initializes the workspace for a new agent
- `POST /accumulate` — saves the candidate's profile as context the agent reads from
- `POST /share/create` — generates the recruiter-facing share link (the actual agent-to-agent handoff point)
- `POST /tools` (`schedule_meeting`) — books a real calendar event with the recruiter as an attendee, triggering a real calendar invite

## Tech stack

Node.js, Express (backend proxy that holds the API key), vanilla HTML/CSS/JS (frontend) — kept deliberately simple so the Aicoo integration is easy to follow in the code.

## Running it locally

**Requirements:** Node.js (v18+) and an Aicoo API key.

```bash
git clone https://github.com/Sidhharth-Annamalai/mini-recruiter-coordinator.git
cd mini-recruiter-coordinator
npm install
cp .env.example .env
```

Open `.env` and add your key from [aicoo.io/settings/api-keys](https://www.aicoo.io/settings/api-keys):

```
AICOO_API_KEY=aicoo_sk_live_your_key_here
```

Then start the app:

```bash
npm start
```

Open **http://localhost:3000**.

## Live demo

**https://mini-recruiter-coordinator.onrender.com**

(Note: free Render instances spin down after inactivity, so the first load after a quiet period can take 20-30 seconds to wake up.)

## Why this matters

Recruiting (and a lot of other cross-person work — sales, support, research) runs on static documents and email ping-pong today. This shows what it looks like when the "document" is a live agent instead: it answers questions instantly, only shares what it's allowed to, and can actually take action (booking the interview) rather than just describing a person.

## Team coordination during the hackathon

> TODO before submitting: actually do this, then rewrite this section in past tense with a real screenshot.
> Per the hackathon rules, projects should also use AI COO itself (not just the API) for team communication and task tracking during the build. Use the AI COO chat to log your own task list / decisions as you build (you can literally `POST /accumulate` your own to-dos, or just chat with your agent about hackathon progress), screenshot it, and describe it here.

## Known limitations

- The share link opens on Aicoo's own hosted page, not embedded in this app — Aicoo's page does not currently allow iframe embedding, so this app's job ends at generating and handing off the link.
- The `calendar` tool namespace must be enabled on the Aicoo workspace for scheduling to work (`POST /api/enable-namespace/calendar` — already done for this deployment's API key). A fresh workspace/key would need this run once.
- Free-tier Render hosting spins down when idle, so the live demo link may take ~20-30s to respond on the first request after inactivity.