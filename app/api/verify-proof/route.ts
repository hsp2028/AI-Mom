import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { textProof, fileName, fileData, role, taskTitle } = await req.json();

    if (!textProof || textProof.trim().length < 15) {
      return NextResponse.json({
        verified: false,
        feedback: "Mom knows you are cutting corners! Give a proper, detailed sentence summary of at least 15 characters, beta!"
      });
    }

    const prompt = `
      You are "AI-Mom", a deeply caring, strict, and no-nonsense Indian mother acting as an accountability partner for your child Vineet.
      Vineet is in the role of a "${role}".
      He has submitted proof of completing his high-urgency task: "${taskTitle}".
      
      Vineet's written proof: "${textProof}"
      ${fileName ? `He also uploaded a screenshot/document named: "${fileName}"` : ""}

      Analyze the written proof and file name carefully. If the proof is low-effort, gibberish (e.g. "asdfasdf", "done done", "completed"), or completely irrelevant to "${taskTitle}", you MUST reject it.
      If it looks like a genuine, honest summary/attempt, accept it.

      Respond ONLY in JSON format matching this schema:
      {
        "verified": boolean,
        "feedback": "Your nagging/encouraging Indian motherly reaction. If rejected, be firm and strict, ordering him to do it properly. If accepted, be proud and tell him to rest or eat something."
      }
    `;

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              verified: { type: Type.BOOLEAN },
              feedback: { type: Type.STRING }
            },
            required: ["verified", "feedback"]
          }
        }
      });
    } catch (e) {
      console.warn("Primary model failed for verification, using fallback lite:", e);
      response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              verified: { type: Type.BOOLEAN },
              feedback: { type: Type.STRING }
            },
            required: ["verified", "feedback"]
          }
        }
      });
    }

    const resultText = response.text || "{}";
    const resultJson = JSON.parse(resultText);

    return NextResponse.json({
      verified: resultJson.verified ?? false,
      feedback: resultJson.feedback || "Beta, do your work properly!"
    });

  } catch (error: any) {
    console.log("[Info] Verification error:", error?.message || error);
    // fallback logic if both models fail
    return NextResponse.json({
      verified: true,
      feedback: "Beta, my thoughts are hazy, but I will trust you this once. Rest now!"
    });
  }
}
