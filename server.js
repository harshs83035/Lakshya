require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

// Increase payload limit to prevent 413 errors
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// --- API KEY CHECK ---
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ FATAL ERROR: GEMINI_API_KEY is missing in Render Environment Variables!");
} else {
    console.log("✅ GEMINI_API_KEY loaded successfully!");
}

// --- AI CLIENT ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- TEST KEY ROUTE ---
app.get('/test-key', (req, res) => {
    if (process.env.GEMINI_API_KEY) {
        res.send({ status: "OK", message: "API key is loaded!" });
    } else {
        res.status(500).send({ status: "Error", message: "API key not found!" });
    }
});

// --- POWER TEAM MATCH ROUTE ---
app.post('/api/match', async (req, res) => {
    try {
        const { user_name, business_name, description, ideal_customer, roster_subset } = req.body;

        console.log(`Processing request for: ${user_name}`);

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
You are a **BNI Power Team Mapper**.

TASK:
1. Analyze the user's business description.
2. From the roster provided, select the top 6-8 members who would make the best referral partners (Power Team).
3. Explain the connection.

USER PROFILE:
Name: ${user_name}
Business: ${business_name}
What they do: ${description}
Ideal Client: ${ideal_customer || "Not specified"}

ROSTER CANDIDATES (JSON):
${JSON.stringify(roster_subset)}

OUTPUT SCHEMA (JSON Only):
{
  "user_profile": {
    "detected_primary_category": "string",
    "detected_industry_bucket": "string",
    "power_team_name": "string",
    "power_team_logic": "string"
  },
  "recommendations": [
    {
      "member_id": "string (must match input id)",
      "match_score": number (1-100),
      "why_this_member": "string",
      "referral_angle": "string"
    }
  ]
}
        `;

        // --- FIXED: use generateText, not generateContent ---
        const result = await model.generateText(prompt, { maxOutputTokens: 1024 });
        let text = result.text;

        // Remove ```json or ``` markers
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        console.log("AI Response received successfully");

        try {
            const jsonData = JSON.parse(text);
            res.json(jsonData);
        } catch (parseError) {
            console.error("JSON Parse Error:", parseError);
            console.error("Raw Text was:", text);
            throw new Error("AI returned invalid JSON format");
        }

    } catch (error) {
        console.error("SERVER ERROR DETAILS:", error);
        res.status(500).json({
            error: "Server Error",
            details: error.message
        });
    }
});

// --- START SERVER ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
