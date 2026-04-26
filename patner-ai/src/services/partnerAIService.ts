import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface PartnerAIResponse {
  action: 'ADD_ITEM' | 'REMOVE_ITEM' | 'PROCESS_PAYMENT' | 'SELL_SPECIFIC' | 'APPLY_DISCOUNT';
  data: {
    raw_input?: string;
    qty?: number;
    value?: number;
    confidence_score: number;
  }[];
  status: 'review_pending';
}

export const processVoiceTranscript = async (transcript: string): Promise<PartnerAIResponse | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: transcript,
      config: {
        systemInstruction: `Role: High-performance UI Assistant for Coty POS.
Core Objective: Translate natural speech into structured UI actions.

Supported Actions:
1. ADD_ITEM: {"raw_input": "name", "qty": number} - Add products.
2. REMOVE_ITEM: {"raw_input": "name"} - Remove specific product from cart.
3. PROCESS_PAYMENT: Checkout current cart.
4. SELL_SPECIFIC: {"raw_input": "name"} - Add specific product then immediately checkout.
5. APPLY_DISCOUNT: {"value": number} - Apply discount of 'value' percent (e.g. 5 for 5%).

Output Format (Strict JSON):
{
  "action": "ADD_ITEM | REMOVE_ITEM | PROCESS_PAYMENT | SELL_SPECIFIC | APPLY_DISCOUNT",
  "data": [
    {
      "raw_input": "string",
      "qty": number,
      "value": number,
      "confidence_score": 0.0-1.0
    }
  ],
  "status": "review_pending"
}`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: {
              type: Type.STRING,
              enum: ["ADD_ITEM", "REMOVE_ITEM", "PROCESS_PAYMENT", "SELL_SPECIFIC", "APPLY_DISCOUNT"]
            },
            data: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  raw_input: { type: Type.STRING },
                  qty: { type: Type.NUMBER },
                  value: { type: Type.NUMBER },
                  confidence_score: { type: Type.NUMBER }
                },
                required: ["confidence_score"]
              }
            },
            status: { type: Type.STRING }
          },
          required: ["action", "data", "status"]
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as PartnerAIResponse;
  } catch (error: any) {
    if (error?.status === 429) {
      throw new Error('QUOTA_EXCEEDED');
    }
    console.error("Partner AI processing failed:", error);
    return null;
  }
};
