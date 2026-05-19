export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { warnIfGeminiMissingOnBoot } = await import("@/lib/gemini-required");
    warnIfGeminiMissingOnBoot();
  }
}
