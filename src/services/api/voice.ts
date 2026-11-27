/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Voice Assistant API Client Service
 */

import { safeFetchJson, fetchJsonOrThrow } from '../../utils/safeFetch';
import {
  VoiceAssistantResponse,
  VoiceAssistantSessionState,
  VoiceChatMessage,
} from './types';

export interface VoiceChatPayload {
  message?: string;
  query?: string;
  language: 'en' | 'hi' | 'mr';
  sessionState?: VoiceAssistantSessionState;
  conversationHistory?: VoiceChatMessage[];
  preferredSpeed?: number;
}

class VoiceApiService {
  /**
   * Sends transcribed or typed speech message to the multilingual AI assistant.
   */
  public async chat(
    payload: VoiceChatPayload,
    authToken?: string
  ): Promise<VoiceAssistantResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const effectivePayload = {
      ...payload,
      message: payload.message || payload.query || '',
    };

    const res = await safeFetchJson<{ success: boolean; response: VoiceAssistantResponse }>(
      '/api/v1/voice/chat',
      {
        method: 'POST',
        headers,
        body: JSON.stringify(effectivePayload),
      }
    );

    if (!res.ok || !res.data?.response) {
      throw new Error(res.error || 'Failed to communicate with Voice Assistant.');
    }

    return res.data.response;
  }
}

export const voiceApi = new VoiceApiService();
