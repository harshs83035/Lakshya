require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

// ------------------------
// Middleware
// ------------------------
app.use(express.json({ limit: '10mb' })); // Prevent payload errors
app.use(cors());

// ------------------------
// Check API Key
// ------------------------
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY missing! Add it to Render environment variables.");
    process.exit(1);
} else {
    console.log("✅ GEMINI_API_KEY loaded successfully!");
}

// ------------------------
// Initialize AI Client
// ------------------------
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ------------------------
// Test Route
// ------------------------
app.get('/test-key', (req, res) => {
    res.json({ status: "OK", message: "API key is loaded!" });
});

// ------------------------
// Main AI Route
// ------------------------
app.post('/api/match', async (req, res) => {
    try {
        const { user_name, business_name, description, ideal_customer, roster_subset } = req.body;

        console.log(`Processing request for: ${user_name}`);

        // ------------------------
        // Compose prompt
        // ------------------------
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
}`;

        // ------------------------
        // AI Call with timeout (60s)
        // ------------------------
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        const result = await genAI.text.generate({
            model: "gemini-1.5-flash",
            prompt,
            temperature: 0,
            max_output_tokens: 1024,
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        // ------------------------
        // Parse AI response
        // ------------------------
        let text = result.output[0].content[0].text;
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
            const jsonData = JSON.parse(text);
            res.json(jsonData);
        } catch (parseError) {
            console.error("JSON Parse Error:", parseError);
            console.error("Raw AI Text:", text);
            res.status(500).json({
                error: "AI returned invalid JSON",
                details: parseError.message,
                raw: text
            });
        }

    } catch (error) {
        console.error("SERVER ERROR:", error);
        res.status(500).json({ error: "Server Error", details: error.message });
    }
});

// ------------------------
// Start Server
// ------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
