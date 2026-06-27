// Mini Recruiter Coordinator — backend
// This server holds YOUR Aicoo API key and proxies calls to https://www.aicoo.io/api/v1
// so the key never has to live in the browser.

const express = require("express");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const AICOO_API_KEY = process.env.AICOO_API_KEY;
const BASE_URL = "https://www.aicoo.io/api/v1";

if (!AICOO_API_KEY) {
  console.warn(
    "WARNING: AICOO_API_KEY is not set. Create a .env file with AICOO_API_KEY=aicoo_sk_live_..."
  );
}

function authHeaders() {
  return {
    Authorization: `Bearer ${AICOO_API_KEY}`,
    "Content-Type": "application/json",
  };
}

// Generic helper to call any Aicoo endpoint
async function aicooFetch(endpoint, options = {}) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: options.method || "GET",
    headers: authHeaders(),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Aicoo API error: ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// 1. Initialize workspace (call once on candidate setup)
app.post("/api/setup", async (req, res) => {
  try {
    const init = await aicooFetch("/init", { method: "POST", body: {} });

    // Save candidate info as context the agent can read
    const { name, role, skills, availability } = req.body;
    const noteContent = `# Candidate Profile: ${name}

**Target Role:** ${role}
**Skills:** ${skills}
**Availability:** ${availability}

This is the candidate's profile. When a recruiter asks questions, answer
based on this profile. If the recruiter wants to schedule an interview,
use the schedule_meeting tool.
`;

    await aicooFetch("/accumulate", {
      method: "POST",
      body: {
        texts: [
          {
            title: "Candidate Profile",
            content: noteContent,
            folder: "General",
          },
        ],
      },
    });

    res.json({ success: true, init });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message, details: e.data });
  }
});

// 2. Create a share link for this candidate's agent (the "agent-to-agent" handoff point)
app.post("/api/create-link", async (req, res) => {
  try {
    const data = await aicooFetch("/share/create", {
      method: "POST",
      body: {
        scope: "all",
        access: "read_calendar_write", // allows the agent to also create calendar events for scheduling
        label: req.body.label || "Recruiter access",
        expiresIn: "7d",
        identity: { loadCoo: true, loadUser: true, loadPolicy: true },
      },
    });
    res.json(data);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message, details: e.data });
  }
});

// 3. Direct tool call — wired to the "Schedule interview" button.
// Verified against the real schema from GET /api/tools (namespace: calendar):
// schedule_meeting requires { title, startDateTime, endDateTime } in ISO 8601,
// with optional { description, attendees[], timeZone }.
// Note: the "calendar" namespace must be enabled first — see /api/enable-namespace/calendar.
app.post("/api/schedule", async (req, res) => {
  try {
    const { candidateName, datetime, durationMinutes, recruiterEmail } = req.body;

    if (!datetime) {
      return res.status(400).json({ error: "datetime is required" });
    }

    const start = new Date(datetime);
    if (isNaN(start.getTime())) {
      return res.status(400).json({ error: "datetime could not be parsed — expected an ISO-ish date string" });
    }
    const minutes = Number(durationMinutes) > 0 ? Number(durationMinutes) : 30;
    const end = new Date(start.getTime() + minutes * 60000);

    const data = await aicooFetch("/tools", {
      method: "POST",
      body: {
        tool: "schedule_meeting",
        params: {
          title: `Interview: ${candidateName}`,
          startDateTime: start.toISOString(),
          endDateTime: end.toISOString(),
          attendees: recruiterEmail ? [recruiterEmail] : [],
        },
      },
    });
    res.json(data);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message, details: e.data });
  }
});

// Helper route: lists Aicoo's available tools and their parameter schemas.
// Hit this in your browser at /api/tools-list (or curl it) to confirm the
// exact fields schedule_meeting expects before trusting /api/schedule.
app.get("/api/tools-list", async (req, res) => {
  try {
    const data = await aicooFetch("/tools", { method: "GET" });
    res.json(data);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message, details: e.data });
  }
});

// Helper route: view which tool namespaces are currently enabled.
app.get("/api/namespaces", async (req, res) => {
  try {
    const data = await aicooFetch("/tools/namespaces", { method: "GET" });
    res.json(data);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message, details: e.data });
  }
});

// Helper route: enable a namespace (e.g. "calendar") so its tools become callable.
// Visit /api/enable-namespace/calendar in your browser to enable the calendar tools.
app.post("/api/enable-namespace/:namespace", async (req, res) => {
  try {
    const data = await aicooFetch("/tools/namespaces", {
      method: "PUT",
      body: { enable: [req.params.namespace] },
    });
    res.json(data);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message, details: e.data });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Mini Recruiter Coordinator running at http://localhost:${PORT}`);
});