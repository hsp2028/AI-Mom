import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

interface PlannerInput {
  macroGoal: string;
  role: 'Student' | 'Professional' | 'Entrepreneur';
  name: string;
}

export async function POST(req: NextRequest) {
  let role: 'Student' | 'Professional' | 'Entrepreneur' = 'Student';
  try {
    const body = await req.json() as PlannerInput;
    const { macroGoal, name = 'Vineet' } = body;
    role = body.role || 'Student';

    if (!macroGoal || !macroGoal.trim()) {
      return NextResponse.json({ error: "Macro goal is required" }, { status: 400 });
    }

    const prompt = `
      You are "AI-Mom", a deeply caring, protective, and no-nonsense Indian mother who acts as an accountability partner for your child, ${name}, who is working as a ${role}.
      ${name} has set a massive, overarching macro-goal: "${macroGoal}".
      
      Your job is to act like a smart, proactive Indian mother and break this large, intimidating goal down into EXACTLY 4 sequential, manageable sub-tasks that lead up to completing this goal.
      
      For each of the 4 sub-tasks:
      1. Provide a direct, action-oriented title in AI-Mom's strict yet encouraging tone (e.g., "Review Chapter 3 and don't daydream!", "Draft the marketing pitch without checking your phone!").
      2. Choose the most appropriate category from: "Education", "Work", "Finance", "Strategy", "Personal", "Health".
      3. Set an estimated effort in hours (an integer from 1 to 5).
      4. Stagger them in a logical sequence of hours from now. The first task should be done very soon, and the subsequent tasks should be spaced out further (e.g., Task 1: due in 2 hours, Task 2: due in 12 hours, Task 3: due in 24 hours, Task 4: due in 48 hours). Generate the "dueDateOffsetHours" as a positive integer.
      
      Return a JSON response adhering EXACTLY to the response schema.
    `;

    // Helper for calling Gemini
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
                  subtasks: {
                    type: Type.ARRAY,
                    description: "An array of exactly 4 sequential tasks.",
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: {
                          type: Type.STRING,
                          description: "The name of the subtask in AI-Mom's voice."
                        },
                        category: {
                          type: Type.STRING,
                          description: "The category of the subtask."
                        },
                        estimatedEffort: {
                          type: Type.INTEGER,
                          description: "The estimated effort in hours (1-5)."
                        },
                        dueDateOffsetHours: {
                          type: Type.INTEGER,
                          description: "Hours from now when this subtask is due."
                        }
                      },
                      required: ["title", "category", "estimatedEffort", "dueDateOffsetHours"]
                    }
                  }
                },
                required: ["subtasks"]
              }
            }
          });
        } catch (err: any) {
          attempt++;
          if (attempt >= retries) {
            throw err;
          }
          await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, attempt - 1)));
        }
      }
    };

    let response;
    try {
      response = await callGeminiWithRetry("gemini-3.5-flash");
    } catch (primaryError) {
      console.log("[Info] gemini-3.5-flash busy in planner, trying gemini-3.1-flash-lite");
      try {
        response = await callGeminiWithRetry("gemini-3.1-flash-lite");
      } catch (fallbackError) {
        console.log("[Info] gemini-3.1-flash-lite busy in planner, trying gemini-flash-latest");
        try {
          response = await callGeminiWithRetry("gemini-flash-latest");
        } catch (finalError) {
          throw finalError; // Proceed to static fallback
        }
      }
    }

    const resultText = response.text || "{}";
    const resultJson = JSON.parse(resultText);

    if (!resultJson.subtasks || !Array.isArray(resultJson.subtasks) || resultJson.subtasks.length === 0) {
      throw new Error("Invalid format from Gemini planner");
    }

    // Ensure exactly 4 tasks or adjust length
    let finalSubtasks = resultJson.subtasks;
    if (finalSubtasks.length > 4) {
      finalSubtasks = finalSubtasks.slice(0, 4);
    }

    return NextResponse.json({ subtasks: finalSubtasks });

  } catch (error: any) {
    console.log("[Info] Fallback planner triggered:", error?.message || error);

    // Provide a robust fallback based on role
    let subtasks = [];
    if (role === 'Student') {
      subtasks = [
        { title: "Review introductory notes & syllabus carefully!", category: "Education", estimatedEffort: 1, dueDateOffsetHours: 2 },
        { title: "Deep dive into main chapters - NO mobile phone allowed!", category: "Education", estimatedEffort: 3, dueDateOffsetHours: 12 },
        { title: "Attempt past year papers bacha, show me your score!", category: "Education", estimatedEffort: 4, dueDateOffsetHours: 24 },
        { title: "Final revision, eat some almonds, and sleep on time!", category: "Education", estimatedEffort: 2, dueDateOffsetHours: 48 }
      ];
    } else if (role === 'Professional') {
      subtasks = [
        { title: "Create draft strategy outline & project guidelines", category: "Work", estimatedEffort: 1, dueDateOffsetHours: 3 },
        { title: "Align with team stakeholders - don't procrastinate!", category: "Work", estimatedEffort: 2, dueDateOffsetHours: 10 },
        { title: "Execute core project components and double check everything", category: "Work", estimatedEffort: 5, dueDateOffsetHours: 24 },
        { title: "Compile final report and submit before deadline!", category: "Work", estimatedEffort: 3, dueDateOffsetHours: 36 }
      ];
    } else {
      subtasks = [
        { title: "Brainstorm high-level goals & target KPIs", category: "Strategy", estimatedEffort: 2, dueDateOffsetHours: 4 },
        { title: "Prepare financial models bacha, Sharma ji is watching!", category: "Finance", estimatedEffort: 3, dueDateOffsetHours: 16 },
        { title: "Draft investor pitch deck presentation layout", category: "Strategy", estimatedEffort: 4, dueDateOffsetHours: 28 },
        { title: "Final pitch check with advisors, do not mess this up!", category: "Strategy", estimatedEffort: 3, dueDateOffsetHours: 44 }
      ];
    }

    return NextResponse.json({ subtasks });
  }
}
