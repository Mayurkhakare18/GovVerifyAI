/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dotenv from 'dotenv';
dotenv.config();

import { GoogleGenAI } from '@google/genai';

/**
 * Validates Gemini API configuration status.
 */
export function getGeminiConfigStatus(): {
  isConfigured: boolean;
  message: string;
} {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    return {
      isConfigured: false,
      message: 'GEMINI_NOT_CONFIGURED: GEMINI_API_KEY environment variable is missing or empty.',
    };
  }

  return {
    isConfigured: true,
    message: 'Google Gemini API is configured.',
  };
}

let geminiClientInstance: GoogleGenAI | null = null;

/**
 * Returns a configured GoogleGenAI SDK client instance.
 * Conforms strictly to @google/genai guidelines with 'aistudio-build' telemetry.
 */
export function getGeminiClient(): GoogleGenAI {
  const status = getGeminiConfigStatus();
  if (!status.isConfigured) {
    throw new Error(status.message);
  }

  if (!geminiClientInstance) {
    geminiClientInstance = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  return geminiClientInstance;
}

export const GEMINI_FLASH_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

export const GEMINI_FALLBACK_MODELS = [
  GEMINI_FLASH_MODEL,
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
].filter((m, i, arr) => arr.indexOf(m) === i);

/**
 * Resilient content generation with automatic model fallback on HTTP 429 / RESOURCE_EXHAUSTED.
 */
export async function generateContentWithFallback(
  params: {
    model?: string;
    contents: any;
    config?: any;
  }
) {
  const gemini = getGeminiClient();
  const modelsToTry = [
    params.model || GEMINI_FLASH_MODEL,
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
  ].filter((m, i, arr) => arr.indexOf(m) === i);

  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      return await gemini.models.generateContent({
        ...params,
        model,
      });
    } catch (err: any) {
      lastError = err;
      const errMsg = String(err.message || err);
      const isQuotaOrRateLimit =
        err.status === 429 ||
        errMsg.includes('429') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('quota');

      if (isQuotaOrRateLimit) {
        console.warn(
          `[GovVerify AI] Gemini model ${model} quota exhausted (429). Attempting fallback model...`
        );
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

