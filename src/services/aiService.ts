import { GoogleGenAI } from "@google/genai";
import { SubTask } from "../types";

export const aiService = {
  async generateSummary(tasks: { today: SubTask[], unfinished: SubTask[], delayed: SubTask[] }) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key is not configured.");
    }

    const ai = new GoogleGenAI({ apiKey });
    const model = "gemini-3-flash-preview";

    const prompt = `
      As a task management assistant, analyze the following tasks and provide a concise summary in Japanese.
      
      Today's Tasks:
      ${tasks.today.map(t => `- ${t.task_name} (${t.status})`).join('\n')}
      
      Unfinished Tasks:
      ${tasks.unfinished.map(t => `- ${t.task_name} (${t.status})`).join('\n')}
      
      Delayed Tasks:
      ${tasks.delayed.map(t => `- ${t.task_name} (${t.status}, Deadline: ${t.final_deadline})`).join('\n')}
      
      The summary should include:
      1. Overview of delayed tasks and their impact.
      2. Potential risks (e.g., tasks nearing deadline).
      3. Summary of today's progress.
      4. Recommendations for tomorrow.
    `;

    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });

      return response.text || "AI summary generation failed.";
    } catch (error) {
      console.error("AI Generation Error:", error);
      throw error;
    }
  }
};
