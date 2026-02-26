
/**
 * BACKEND CODE (Node.js Environment)
 * This file should be deployed as a Google Cloud Function or a Serverless endpoint.
 * 
 * PRE-REQUISITES:
 * 1. npm install firebase-admin @google/genai
 * 2. Set process.env.API_KEY (Gemini)
 * 3. Set Google Application Credentials for Firebase Admin
 */

import { GoogleGenAI } from "@google/genai";
import * as admin from "firebase-admin";

// 1. Initialize Firebase Admin (Singleton pattern)
let db: any;
try {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  db = admin.firestore();
} catch (error) {
  console.warn("Firebase Admin initialization failed. Using mock DB.", error);
  // Mock DB implementation for dev environment without credentials
  const mockUsers: Record<string, any> = {};
  db = {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => ({
          exists: !!mockUsers[id],
          data: () => mockUsers[id]
        }),
        set: async (data: any) => { mockUsers[id] = data; },
        update: async (data: any) => { 
            if(mockUsers[id]) mockUsers[id] = { ...mockUsers[id], ...data }; 
        }
      })
    }),
    runTransaction: async (callback: any) => {
      // Simple mock transaction
      return callback({
        get: async (ref: any) => ref.get(),
        update: async (ref: any, data: any) => ref.update(data)
      });
    }
  };
}

// --- HELPER: Get or Create User ---
const getOrCreateUser = async (email: string) => {
  const userRef = db.collection('users').doc(email);
  const doc = await userRef.get();

  if (!doc.exists) {
    // New user gets 5 free credits
    const newUser = {
      email,
      credits: 5,
      isPro: false,
      createdAt: new Date() // Use Date for mock compatibility
    };
    await userRef.set(newUser);
    return newUser;
  }

  return doc.data();
};

// --- PAYPAL INTEGRATION ---
const getPayPalApiUrl = () => {
  return process.env.PAYPAL_ENVIRONMENT === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
};

const generatePayPalAccessToken = async () => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials are not configured.");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(`${getPayPalApiUrl()}/v1/oauth2/token`, {
    method: 'POST',
    body: 'grant_type=client_credentials',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  
  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Failed to generate Access Token: ${errorData}`);
  }
  
  const data = await response.json();
  return data.access_token;
};

export const handleCreatePayPalOrder = async (req: any, res: any) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  try {
    const accessToken = await generatePayPalAccessToken();
    const response = await fetch(`${getPayPalApiUrl()}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'USD',
              value: '20.00',
            },
            description: 'Premium Banner Creator Subscription (1 Month)',
          },
        ],
      }),
    });
    
    const order = await response.json();
    res.json(order);
  } catch (error: any) {
    console.error("PayPal Create Order Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const handleCapturePayPalOrder = async (req: any, res: any) => {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  try {
    const { orderID, email } = req.body;
    if (!orderID || !email) {
      return res.status(400).json({ message: 'Missing orderID or email' });
    }

    const accessToken = await generatePayPalAccessToken();
    const response = await fetch(`${getPayPalApiUrl()}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    const captureData = await response.json();

    if (captureData.status === 'COMPLETED') {
      // Update user in DB
      const userRef = db.collection('users').doc(email);
      await db.runTransaction(async (t: any) => {
        const doc = await t.get(userRef);
        if (doc.exists) {
          const data = doc.data();
          t.update(userRef, {
            credits: (data.credits || 0) + 100,
            isPro: true
          });
        }
      });
      res.json({ success: true, captureData });
    } else {
      res.status(400).json({ success: false, captureData });
    }
  } catch (error: any) {
    console.error("PayPal Capture Order Error:", error);
    res.status(500).json({ error: error.message });
  }
};
export const handleGetUser = async (req: any, res: any) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const email = req.query.email;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const userData = await getOrCreateUser(email);
    return res.status(200).json(userData);
  } catch (error: any) {
    console.error("Database Error:", error);
    return res.status(500).json({ message: 'Failed to fetch user profile' });
  }
};

// --- ENDPOINT: Generate Background ---
export const handleGeneratePrompt = async (req: any, res: any) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { theme, email } = req.body;

  if (!theme || !email) {
    return res.status(400).json({ message: 'Theme and Email are required' });
  }

  const userRef = db.collection('users').doc(email);

  try {
    // 1. Transaction: Deduct Credit
    await db.runTransaction(async (t: any) => {
      const doc = await t.get(userRef);
      if (!doc.exists) {
        throw new Error("User not found");
      }
      const data = doc.data();
      if (!data || data.credits < 1) {
        throw new Error("Insufficient credits");
      }
      t.update(userRef, { credits: data.credits - 1 });
    });

    // 2. Initialize AI
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
        throw new Error("API Key not found");
    }
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

    const doc = await userRef.get();
    res.status(200).json({ prompt: response.text, credits: doc.data().credits });
  } catch (error: any) {
    console.error("Generate Prompt Error:", error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

export const handleGenerateBackground = async (req: any, res: any) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { prompt, email } = req.body;

  if (!prompt || !email) {
    return res.status(400).json({ message: 'Prompt and Email are required' });
  }

  const userRef = db.collection('users').doc(email);

  try {
    // 1. Transaction: Deduct Credit
    // We deduct BEFORE generation to prevent abuse. We refund if generation fails.
    await db.runTransaction(async (t: any) => {
      const doc = await t.get(userRef);
      if (!doc.exists) {
        throw new Error("User not found");
      }
      const data = doc.data();
      if (!data || data.credits < 1) {
        throw new Error("Insufficient credits");
      }
      t.update(userRef, { credits: data.credits - 1 });
    });

    // 2. Initialize AI
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
        throw new Error("API Key not found");
    }
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: "16:9" } }
    });

    // 3. Extract Image
    let imageUrl = null;
    if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                break;
            }
        }
    }

    if (!imageUrl) {
      throw new Error("AI returned no image");
    }

    // 4. Get final credit balance to update UI
    const finalUserDoc = await userRef.get();
    const currentCredits = finalUserDoc.data()?.credits || 0;

    return res.status(200).json({ imageUrl, credits: currentCredits });

  } catch (error: any) {
    console.error("Backend Generation Error:", error);

    // Refund credit if the error was strictly AI generation failure (not insufficient funds)
    if (error.message === "AI returned no image" || error.message.includes("GoogleGenAI")) {
       // Mock DB update for refund
       try {
         const doc = await userRef.get();
         if (doc.exists) {
             await userRef.update({ credits: (doc.data().credits || 0) + 1 });
         }
       } catch (e) { console.error("Refund failed", e); }
    }

    const statusCode = error.message === "Insufficient credits" ? 403 : 500;
    return res.status(statusCode).json({ 
      message: error.message || 'Internal Server Error' 
    });
  }
};
