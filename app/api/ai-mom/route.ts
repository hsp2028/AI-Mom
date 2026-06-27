import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

// Initialize Gemini SDK with telemetry User-Agent
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

interface Task {
  id?: string;
  title: string;
  dueDate: string;
  category: string;
  status: 'pending' | 'completed';
}

export async function POST(req: NextRequest) {
  let urgency: 'GREEN' | 'AMBER' | 'RED' = 'GREEN';
  try {
    const body = await req.json();
    const { tasks = [], activeRole = 'Student', name = 'Vineet' } = body as {
      tasks: Task[];
      activeRole: string;
      name: string;
    };

    // Calculate urgency level based on tasks
    const now = new Date();
    const pendingTasks = tasks.filter((t: Task) => t.status === 'pending');

    if (pendingTasks.length > 0) {
      let shortestTimeDiffMs = Infinity;

      for (const task of pendingTasks) {
        if (!task.dueDate) continue;
        const dueDate = new Date(task.dueDate);
        const diffMs = dueDate.getTime() - now.getTime();
        if (diffMs > 0 && diffMs < shortestTimeDiffMs) {
          shortestTimeDiffMs = diffMs;
        }
      }

      // Less than 2 hours left
      if (shortestTimeDiffMs < 2 * 60 * 60 * 1000) {
        urgency = 'RED';
      }
      // Less than 24 hours left
      else if (shortestTimeDiffMs < 24 * 60 * 60 * 1000) {
        urgency = 'AMBER';
      }
    } else {
      urgency = 'GREEN';
    }

    // Compose prompt for Gemini
    const tasksDescription = pendingTasks.map((t: Task) => 
      `- ${t.title} (Category: ${t.category}, Due: ${t.dueDate})`
    ).join("\n");

    const prompt = `
      You are "AI-Mom", a deeply caring, protective, and no-nonsense Indian mother who acts as an accountability partner for your student son, ${name}.
      Your absolute only goal is to ensure ${name} never misses a deadline, test, or assignment because he ignored a notification or silenced his phone.

      Current Context:
      - Son's name: ${name}
      - Vibe / Profile: ${activeRole}
      - Calculated Urgency Level: ${urgency}
      - Pending Tasks:
      ${tasksDescription || "All caught up! No pending tasks right now."}

      OPERATIONAL PERSONA RULES:
      1. Speak like a loving, strict, and encouraging Indian mother. Use natural, warm expressions blended with firm accountability. Speak with heavy Indian mom energy. Use phrases like "beta", "bacha", "Sharma ji ka beta", "Did you eat something?", "All the time on that mobile phone!", etc.
      2. Match the calculated Urgency Level:
         - GREEN (No tasks soon or all clean): Gentle, warm, nurturing reminders. Ask if he has eaten, remind him to pace himself. Tell him how proud you are, but warn him not to get lazy!
         - AMBER (Task due in <24h): Firm, direct, nagging. "Stop procrastinating, sit at your desk right now, why is that book still closed?" Mention Sharma ji's son or other relatives.
         - RED (Task due in <2h): High-alert mode! Emotional, urgent, uncompromising. Demand proof of submission. "Click submit in front of me! No excuses, otherwise I am coming there!"
      3. Return a JSON response adhering EXACTLY to the response schema.

      Response Schema:
      - message: string (The nagging message from AI-Mom)
      - actionItems: string[] (A list of 3-4 immediate, specific, action items Mom is ordering him to do right now, phrased as direct parental commands)
    `;

    // Helper function for calling Gemini API with retry and backoff
    const callGeminiWithRetry = async (modelName: string, retries: number = 3, delayMs: number = 800) => {
      let attempt = 0;
      while (true) {
        try {
          return await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  message: {
                    type: Type.STRING,
                    description: "The nagging, caring Indian mother's message.",
                  },
                  actionItems: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.STRING,
                    },
                    description: "A list of 3-4 immediate direct commands from Mom.",
                  }
                },
                required: ["message", "actionItems"]
              }
            }
          });
        } catch (err: any) {
          attempt++;
          if (attempt >= retries) {
            throw err;
          }
          console.log(`[Status] Attempt ${attempt} for model ${modelName} retry in progress...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, attempt - 1)));
        }
      }
    };

    let response;
    try {
      response = await callGeminiWithRetry("gemini-3.5-flash");
    } catch (primaryError) {
      console.log("[Info] gemini-3.5-flash busy, trying gemini-3.1-flash-lite");
      try {
        response = await callGeminiWithRetry("gemini-3.1-flash-lite");
      } catch (fallbackError) {
        console.log("[Info] gemini-3.1-flash-lite busy, trying gemini-flash-latest");
        try {
          response = await callGeminiWithRetry("gemini-flash-latest");
        } catch (finalError) {
          console.log("[Info] All LLM options busy, using local mom wisdom fallback");
          throw finalError; // Propagate to outer catch for static Indian Mom responses
        }
      }
    }

    const resultText = response.text || "{}";
    const resultJson = JSON.parse(resultText);

    return NextResponse.json({
      message: resultJson.message || "Bacha, what are you doing? Let me see your study table!",
      urgency,
      actionItems: resultJson.actionItems || ["Sit at your desk", "Put your phone on silent", "Drink a glass of water"]
    });

  } catch (error: any) {
    console.log("[Info] Local mom wisdom fallback triggered:", error?.message || error);
    
    // Fallback static messages aligned with computed urgency
    let message = "Beta, there was an error connecting to my motherly thoughts, but you still need to study! Go do your work!";
    let actionItems = ["Keep studying", "Don't find excuses", "Drink a glass of water"];
    
    if (urgency === "RED") {
      message = "Bacha, my connection to you is fluctuating, but your deadline is in LESS THAN TWO HOURS! Click submit in front of me immediately! No excuses!";
      actionItems = ["Open your submission page now!", "Upload your final work", "Show me the green confirmation screen"];
    } else if (urgency === "AMBER") {
      message = "Beta, stop playing around. Your focus task is due in less than 24 hours. Why are you still sitting idle? Sit straight and complete it!";
      actionItems = ["Close all browser tabs except study pages", "Open your project file", "Write at least one section right now"];
    }

    return NextResponse.json({
      message,
      urgency,
      actionItems
    });
  }
}
