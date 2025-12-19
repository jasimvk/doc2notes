import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

// Fail fast if API key is missing
if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY environment variable is required");
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Constants
const MAX_INPUT_LENGTH = 100000; // ~100k chars
const OPENAI_TIMEOUT_MS = 60000; // 60 seconds

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: OPENAI_TIMEOUT_MS
});

app.post("/summarize", async (req, res) => {
  try {
    const { text } = req.body;

    // Type validation
    if (typeof text !== "string") {
      return res.status(400).json({ error: "Text must be a string" });
    }

    // Empty check
    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      return res.status(400).json({ error: "Text is required" });
    }

    // Length limit
    if (trimmedText.length > MAX_INPUT_LENGTH) {
      return res.status(400).json({ error: "Text exceeds maximum length" });
    }

    const prompt = `You are a professional study assistant.
Given the content below:
1. Produce structured notes with headings
2. Extract key takeaways
3. Generate 5 self-test questions
Keep it concise and clear.
CONTENT:
${trimmedText}`;

    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: prompt
    });

    const output = response.output_text ?? "";

    res.json({
      result: output
    });

  } catch (err) {
    console.error("Summarize error:", err.message || err);

    // Handle specific OpenAI errors
    if (err instanceof OpenAI.APIError) {
      if (err.status === 429) {
        return res.status(503).json({ error: "Service temporarily unavailable" });
      }
      if (err.status >= 500) {
        return res.status(502).json({ error: "Upstream service error" });
      }
    }

    // Timeout errors
    if (err.code === "ETIMEDOUT" || err.message?.includes("timeout")) {
      return res.status(504).json({ error: "Request timed out" });
    }

    res.status(500).json({ error: "Failed to process document" });
  }
});

app.get("/", (_, res) => {
  res.send("Doc2Notes API is running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});