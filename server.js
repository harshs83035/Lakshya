require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(cors());

if (!process.env.GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY missing!");
    process.exit(1);
}

console.log("✅ GEMINI_API_KEY loaded!");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// -------- TEST ROUTE --------
app.get('/test-key', (req, res) => {
    res.json({ status: "OK", message: "API key is loaded!" });
});

// -------- MAIN AI ROUTE --------
app.post('/api/match', async (req, res) => {
    try {
        const { user_name, business_name, description, ideal_customer, roster_subset } = req.body;

        console.log(`Processing request for: ${user_name}`);

        const model = genAI.getGenerativeModel({
            model: "gemini-1.0-pro"
        });

        const prompt = `
You are a BNI Power Team Mapper.

USER PROFILE:
Name: ${user_name}
Business: ${business_name}
What they do: ${description}
Ideal Client: ${ideal_customer || "Not specified"}

ROSTER CANDIDATES (JSON):
${JSON.stringify(roster_subset)}

Return ONLY JSON in this format:

{
  "user_profile": {
    "detected_primary_category": "string",
    "detected_industry_bucket": "string",
    "power_team_name": "string",
    "power_team_logic": "string"
  },
  "recommendations": [
    {
      "member_id": "string",
      "match_score": 0,
      "why_this_member": "string",
      "referral_angle": "string"
    }
  ]
}
`;

        const result = await model.generateContent(prompt);

        let text = "";

        if (result.response && result.response.candidates) {
            text = result.response.candidates[0].content.parts[0].text;
        } else {
            throw new Error("Invalid AI response format");
        }

        text = text.replace(/```json/g, '')
                   .replace(/```/g, '')
                   .trim();

        console.log("Raw AI Output:", text);

        const jsonData = JSON.parse(text);

        res.json(jsonData);

    } catch (error) {
        console.error("SERVER ERROR:", error);

        res.status(500).json({
            error: "Server Error",
            details: error.message
        });
    }
});

// -------- START SERVER --------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
