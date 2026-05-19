import { NextRequest, NextResponse } from "next/server";
import { generateQuiz, generateScenarioAnalysis, explainConcept } from "@/lib/gemini";
import {
  assertGeminiConfigured,
  geminiErrorResponse,
  getAiMeta,
} from "@/lib/gemini-required";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    assertGeminiConfigured();
    const body = await req.json();
    const { action, topic, difficulty, scenario, concept, level } = body;

    switch (action) {
      case "quiz": {
        const result = await generateQuiz(topic || "temel finans", difficulty || "kolay");
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(result);
        return NextResponse.json({ quiz: parsed, ...getAiMeta() });
      }

      case "scenario": {
        const result = await generateScenarioAnalysis(
          scenario || "Kredi kartı asgari ödeme yaparsam ne olur?",
        );
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(result);
        return NextResponse.json({ analysis: parsed, ...getAiMeta() });
      }

      case "explain": {
        const explanation = await explainConcept(
          concept || "enflasyon",
          level || "başlangıç",
        );
        return NextResponse.json({ explanation, ...getAiMeta() });
      }

      default:
        return NextResponse.json(
          { error: "Geçersiz action. quiz, scenario veya explain kullanın." },
          { status: 400 },
        );
    }
  } catch (err) {
    return geminiErrorResponse(err);
  }
}
