import { NextRequest, NextResponse } from "next/server";
import { generateQuiz, generateScenarioAnalysis, explainConcept } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, topic, difficulty, scenario, concept, level } = body;

  switch (action) {
    case "quiz": {
      const result = await generateQuiz(topic || "temel finans", difficulty || "kolay");
      let parsed;
      try {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(result);
      } catch {
        parsed = {
          question: "Soru oluşturulamadı. Lütfen tekrar deneyin.",
          options: [],
          correctIndex: 0,
          explanation: "",
          difficulty: difficulty || "kolay",
          topic: topic || "temel finans",
        };
      }
      return NextResponse.json({ quiz: parsed });
    }

    case "scenario": {
      const result = await generateScenarioAnalysis(
        scenario || "Kredi kartı asgari ödeme yaparsam ne olur?",
      );
      let parsed;
      try {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(result);
      } catch {
        parsed = {
          scenario,
          analysis: "Analiz oluşturulamadı.",
          risks: [],
          recommendations: [],
          financialImpact: "",
        };
      }
      return NextResponse.json({ analysis: parsed });
    }

    case "explain": {
      const explanation = await explainConcept(
        concept || "enflasyon",
        level || "başlangıç",
      );
      return NextResponse.json({ explanation });
    }

    default:
      return NextResponse.json(
        { error: "Geçersiz action. quiz, scenario veya explain kullanın." },
        { status: 400 },
      );
  }
}
