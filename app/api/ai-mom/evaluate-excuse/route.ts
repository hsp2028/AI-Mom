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

interface ExcuseInput {
  excuse: string;
  action: 'Postpone' | 'Cancel';
  taskTitle: string;
  name: string;
  role: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ExcuseInput;
    const { excuse, action, taskTitle, name = 'Vineet', role = 'Student' } = body;

    if (!excuse || excuse.trim().length < 25) {
      return NextResponse.json({
        approved: false,
        feedback: "That is a terrible excuse! I did not raise a slacker. Back to work! Make sure your explanation is at least 25 characters long!"
      });
    }

    // Direct pre-check for obviously lazy words to match instruction guidelines strictly
    const lowercaseExcuse = excuse.toLowerCase();
    const lazyPhrases = ["i don't want to", "lazy", "later", "procrastinate", "don't feel like", "boring", "sleepy", "tomorrow", "play games", "netflix"];
    const containsLazy = lazyPhrases.some(phrase => lowercaseExcuse.includes(phrase));

    if (containsLazy) {
      return NextResponse.json({
        approved: false,
        feedback: "That is a terrible excuse! I did not raise a slacker. Back to work!"
      });
    }

    const prompt = `
      You are "AI-Mom", a deeply caring, protective, and no-nonsense Indian mother who acts as an accountability partner for your child, ${name}, who is a ${role}.
      ${name} is currently in a strict LOCKDOWN mode because they are missing the critical task: "${taskTitle}".
      They want to perform the following action: "${action}" (Postpone deadline by 24 hours or Cancel task entirely).
      They submitted the following reason/excuse: "${excuse}".

      Your job is to evaluate if this excuse is genuinely valid, realistic, and structural (e.g. medical emergency, client/external delay, power outage, severe sickness, hardware failure) OR if it is a lazy, procrastinating excuse.
      
      Determine if you should APPROVE or REJECT the request.
      - If APPROVED: You must provide a warm yet firm Indian Motherly response (e.g., "Fine, your health comes first. Rest up, but we finish this tomorrow.").
      - If REJECTED: You must provide an angry, stern response (e.g., "That is a terrible excuse! I did not raise a slacker. Back to work!").

      Return a JSON response adhering EXACTLY to this schema:
      {
        "approved": boolean,
        "feedback": string
      }
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            approved: {
              type: Type.BOOLEAN,
              description: "Whether the excuse is approved (true) or rejected (false)."
            },
            feedback: {
              type: Type.STRING,
              description: "The Indian Mother style feedback message."
            }
          },
          required: ["approved", "feedback"]
        }
      }
    });

    const resultText = response.text || "";
    const resultJson = JSON.parse(resultText);

    return NextResponse.json({
      approved: !!resultJson.approved,
      feedback: resultJson.feedback || "Back to work!"
    });

  } catch (err: any) {
    console.error("Error in excuse evaluation:", err);
    return NextResponse.json({
      approved: false,
      feedback: "That is a terrible excuse! I did not raise a slacker. Back to work!"
    });
  }
}
