#!/usr/bin/env node

/**
 * Check which Gemini models are available with your API key
 * Usage: node scripts/check-gemini-models.mjs
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local if it exists
const envPath = path.resolve(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, "utf-8");
  envFile.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").replace(/^["']|["']$/g, "");
        process.env[key.trim()] = value.trim();
      }
    }
  });
}

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ GEMINI_API_KEY not found in environment variables");
  console.error("Add it to your .env.local file:");
  console.error("GEMINI_API_KEY=your-api-key-here");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

// Models to test
const modelsToTest = [
  "gemini-pro",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
  "gemini-2.0-flash-exp",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
];

console.log("🔍 Testing Gemini models with your API key...\n");

let availableModels = [];

for (const modelName of modelsToTest) {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    // Try a simple test call
    const result = await model.generateContent("Say 'test'");
    const response = await result.response;
    const text = response.text();
    
    if (text) {
      console.log(`✅ ${modelName} - Available`);
      availableModels.push(modelName);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes("404") || errorMsg.includes("not found")) {
      console.log(`❌ ${modelName} - Not found`);
    } else {
      console.log(`⚠️  ${modelName} - Error: ${errorMsg.substring(0, 100)}`);
    }
  }
}

console.log("\n=== Summary ===");
if (availableModels.length > 0) {
  console.log(`✅ Found ${availableModels.length} available model(s):`);
  availableModels.forEach((model) => console.log(`   - ${model}`));
  console.log("\n💡 Update your code to use one of these models.");
} else {
  console.log("❌ No models found. Please check:");
  console.log("   1. Your API key is valid");
  console.log("   2. You have access to Gemini API");
  console.log("   3. Billing is enabled (if required)");
  console.log("   4. Visit https://ai.google.dev/models for latest model names");
}

