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

// 3. Chat with the candidate's agent (used by the "recruiter" view)
app.post("/api/chat", async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    const data = await aicooFetch("/chat", {
      method: "POST",
      body: {
        message,
        conversationId,
        stream: false,
      },
    });
    res.json(data);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message, details: e.data });
  }
});

// 4. Direct tool call — used for the explicit "Schedule Interview" button
app.post("/api/schedule", async (req, res) => {
  try {
    const { candidateName, datetime, recruiterEmail } = req.body;
    const data = await aicooFetch("/tools", {
      method: "POST",
      body: {
        tool: "schedule_meeting",
        params: {
          title: `Interview: ${candidateName}`,
          time: datetime,
          attendees: recruiterEmail ? [recruiterEmail] : [],
        },
      },
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
