#!/usr/bin/env node

/**
 * Detector simple de texto generado por IA usando la API de Hugging Face.
 *
 * Uso:
 *   node detect-ai.js "Este es el texto a analizar"
 *
 * Requiere una variable de entorno HF_API_TOKEN. Puedes obtener una gratis en:
 *   https://huggingface.co/settings/tokens
 *
 * Modelo por defecto: roberta-base-openai-detector
 * Alternativa: HelloSimpleAI/chatgpt-detector-roberta
 */

const MODEL = process.env.HF_MODEL || "roberta-base-openai-detector";
const API_URL = `https://api-inference.huggingface.co/models/${MODEL}`;
const TOKEN = process.env.HF_API_TOKEN;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function printUsage() {
  console.log(`\nUso: HF_API_TOKEN=tu_token node detect-ai.js "texto a analizar"`);
  console.log(`\nObtén un token gratuito en: https://huggingface.co/settings/tokens`);
  console.log(`\nModelo actual: ${MODEL}`);
}

async function detect(text, retries = 5) {
  if (!TOKEN) {
    throw new Error("Falta la variable de entorno HF_API_TOKEN.");
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: text }),
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(`Error ${response.status}: ${JSON.stringify(body)}`);
  }

  // El modelo a veces tarda en cargar en la API gratuita
  if (body.error && body.error.includes("currently loading") && retries > 0) {
    const estimatedTime = body.estimated_time || 20;
    console.log(`⏳ El modelo se está cargando. Esperando ~${Math.ceil(estimatedTime)}s...`);
    await sleep(estimatedTime * 1000);
    return detect(text, retries - 1);
  }

  return body;
}

function interpret(result) {
  // Formato esperado: [[{ label: "LABEL_0", score: 0.99 }, { label: "LABEL_1", score: 0.01 }]]
  if (!Array.isArray(result) || !result[0]) {
    return { error: `Formato inesperado de respuesta: ${JSON.stringify(result)}` };
  }

  const scores = Array.isArray(result[0]) ? result[0] : result;

  const human = scores.find((s) => s.label === "LABEL_0" || s.label === "Real" || s.label === "Human");
  const ai = scores.find((s) => s.label === "LABEL_1" || s.label === "Fake" || s.label === "AI");

  if (!human || !ai) {
    return { raw: scores };
  }

  return {
    humanScore: (human.score * 100).toFixed(2),
    aiScore: (ai.score * 100).toFixed(2),
    verdict: ai.score > human.score ? "🤖 Probablemente generado por IA" : "🧑 Probablemente escrito por humano",
  };
}

async function main() {
  const text = process.argv.slice(2).join(" ").trim();

  if (!text) {
    console.log("❌ Debes proporcionar un texto para analizar.");
    printUsage();
    process.exit(1);
  }

  console.log(`🔍 Analizando con el modelo: ${MODEL}\n`);
  console.log(`📝 Texto (${text.length} caracteres):\n${text}\n`);

  try {
    const result = await detect(text);
    const interpretation = interpret(result);

    if (interpretation.error) {
      console.log("⚠️", interpretation.error);
      process.exit(1);
    }

    if (interpretation.raw) {
      console.log("📊 Resultado crudo de la API:");
      console.table(interpretation.raw);
    } else {
      console.log(`📊 Probabilidad humana: ${interpretation.humanScore}%`);
      console.log(`📊 Probabilidad de IA:  ${interpretation.aiScore}%`);
      console.log(`\n${interpretation.verdict}`);
    }
  } catch (err) {
    console.error("❌ Error:", err.message);
    printUsage();
    process.exit(1);
  }
}

main();
