require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Initialize Gemini API
// CRITICAL: Ensure GEMINI_API_KEY is in your .env file
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Define the matching endpoint
app.post('/api/match', async (req, res) => {
    try {
        const { user_name, business_name, description, ideal_customer, roster_subset } = req.body;

        if (!roster_subset || roster_subset.length === 0) {
            return res.status(400).json({ error: "No roster data provided" });
        }

        // Initialize Model - Using Flash for speed/cost efficiency
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });

        // 6) EXACT AI PROMPT TO IMPLEMENT
        const prompt = `
        You are a **BNI Power Team Mapper**.

        Definition:
        A BNI Power Team is a set of complementary, non-competing professionals that serve the same type of client.

        TASK:
        1. Infer the user’s primary business category and 1–2 secondary categories.
        2. Identify what kind of Power Team ecosystem they belong to (give it a short name).
        3. From the roster provided, select 6–10 members who are strong complementary partners.
        4. Rank them best to worst and explain each in one short sentence.
        5. Use ONLY the roster data. Never invent names or categories.

        INPUT:

        USER:
        * name: ${user_name}
        * business_name: ${business_name}
        * description: ${description}
        * ideal_customer: ${ideal_customer || "Not specified"}

        ROSTER (JSON):
        ${JSON.stringify(roster_subset)}

        OUTPUT:

        Return ONLY valid JSON in this exact schema:

        {
          "user_profile": {
            "detected_primary_category": "",
            "detected_secondary_categories": [],
            "detected_industry_bucket": "",
            "power_team_name": "",
            "power_team_logic": ""
          },
          "recommendations": [
            {
              "member_id": "",
              "member_name": "",
              "category": "",
              "industry_bucket": "",
              "match_score": 0,
              "why_this_member": "",
              "referral_angle": ""
            }
          ],
          "notes": {
            "confidence": "low|medium|high",
            "missing_info_question": ""
          }
        }

        RULES:
        * Output JSON only
        * Never suggest members outside roster
        * Always give best-effort matches
        * If input is vague → confidence “low” and ask ONE question
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Parse and return JSON
        const jsonResponse = JSON.parse(text);
        res.json(jsonResponse);

    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ error: "Failed to process power team match." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`BNI Power Team Server running on port ${PORT}`);
});
