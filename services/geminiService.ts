
import { GoogleGenAI } from "@google/genai";

interface GenerateResponse {
  imageUrl: string | null;
  credits: number;
}

interface UserProfile {
  credits: number;
  isPro: boolean;
  email: string;
}

export const getUserProfile = async (email: string): Promise<UserProfile | null> => {
  try {
    const response = await fetch(`/api/user?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) throw new Error('Failed to fetch user');
    return await response.json();
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
};

export const generateNewPrompt = async (theme: string, email: string): Promise<{prompt: string | null, credits: number}> => {
  try {
    // 1. Deduct credit via backend
    const deductResponse = await fetch('/api/deduct-credit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, amount: 1 }),
    });

    if (!deductResponse.ok) {
      const errorData = await deductResponse.json();
      throw new Error(errorData.message || 'Failed to deduct credit');
    }

    const { credits } = await deductResponse.json();

    // 2. Call Gemini API
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const ai = new GoogleGenAI({ apiKey });
    const promptInstruction = `You are an expert AI image prompt engineer. Generate a highly detailed, hyper-realistic image generation prompt for an outdoor clothing brand banner. 
The theme is: ${theme}.
CRITICAL REQUIREMENT: The prompt MUST specify that the main subject (a person wearing outdoor gear) is positioned on the extreme RIGHT third of the frame, leaving the left two-thirds completely empty/clear for text placement.
The prompt should describe the lighting, atmosphere, and camera style (high-end retail photography).
Do not include any conversational text, just the prompt itself.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: promptInstruction,
    });

    return {
      prompt: response.text || null,
      credits
    };
  } catch (error) {
    console.error("Frontend error generating prompt:", error);
    // Refund credit if Gemini fails
    try {
      await fetch('/api/refund-credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, amount: 1 }),
      });
    } catch (e) {
      console.error("Refund failed", e);
    }
    return { prompt: null, credits: -1 }; 
  }
};

export const generateOutdoorBackground = async (prompt: string, email: string): Promise<GenerateResponse> => {
  try {
    // 1. Deduct credit via backend
    const deductResponse = await fetch('/api/deduct-credit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, amount: 1 }),
    });

    if (!deductResponse.ok) {
      const errorData = await deductResponse.json();
      throw new Error(errorData.message || 'Failed to deduct credit');
    }

    const { credits } = await deductResponse.json();

    // 2. Call Gemini API
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: "16:9" } }
    });

    let imageUrl = null;
    if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const base64EncodeString = part.inlineData.data;
                imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${base64EncodeString}`;
                break;
            }
        }
    }

    if (!imageUrl) {
        throw new Error("No image generated");
    }

    return {
      imageUrl,
      credits
    };
  } catch (error) {
    console.error("Frontend error generating background:", error);
    // Refund credit if Gemini fails
    try {
      await fetch('/api/refund-credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, amount: 1 }),
      });
    } catch (e) {
      console.error("Refund failed", e);
    }
    return { imageUrl: null, credits: -1 }; 
  }
};
