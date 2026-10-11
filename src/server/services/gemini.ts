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

export const GEMINI_FLASH_MODEL = 'gemini-3.8-flash';
