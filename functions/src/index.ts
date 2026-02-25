
/**
 * CLOUD FUNCTION ENTRY POINT
 * This replaces server-proxy.ts for production deployment.
 */

import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as express from "express";
import * as cors from "cors";
import { GoogleGenAI } from "@google/genai";

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const app = express();

// Automatically allow cross-origin requests
app.use(cors({ origin: true }));
app.use(express.json());

// --- HELPER: Get or Create User ---
const getOrCreateUser = async (email: string) => {
  const userRef = db.collection('users').doc(email);
  const doc = await userRef.get();

  if (!doc.exists) {
    const newUser = {
      email,
      credits: 5,
      isPro: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await userRef.set(newUser);
    return newUser;
  }
  return doc.data();
};

// --- ROUTE: Get User ---
// Added /api prefix to match Hosting rewrites and frontend calls
app.get('/api/user', async (req, res) => {
  const email = req.query.email as string;
  if (!email) {
    res.status(400).json({ message: 'Email is required' });
    return;
  }

  try {
    const userData = await getOrCreateUser(email);
    res.status(200).json(userData);
  } catch (error: any) {
    console.error("Database Error:", error);
    res.status(500).json({ message: 'Failed to fetch user profile' });
  }
});

// --- ROUTE: Generate Background ---
// Added /api prefix to match Hosting rewrites and frontend calls
app.post('/api/generate-background', async (req, res) => {
  const { theme, email } = req.body;

  if (!theme || !email) {
    res.status(400).json({ message: 'Theme and Email are required' });
    return;
  }

  // 1. Check API Key
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API_KEY is not set in environment variables");
    res.status(500).json({ message: 'Server misconfiguration: API Key missing' });
    return;
  }

  const userRef = db.collection('users').doc(email);

  try {
    // 2. Transaction: Deduct Credit
    await db.runTransaction(async (t) => {
      const doc = await t.get(userRef);
      if (!doc.exists) throw new Error("User not found");
      
      const data = doc.data();
      if (!data || data.credits < 1) throw new Error("Insufficient credits");
      
      t.update(userRef, { credits: data.credits - 1 });
    });

    // 3. Initialize AI
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Hyper-realistic, high-fidelity professional photography of a man wearing a high-performance waterproof outdoor jacket walking on a scenic mountain trek trail. 
      CRITICAL COMPOSITION: The man MUST be positioned on the extreme RIGHT third of the frame. 
      The left two-thirds of the image MUST remain clear of any major subjects to allow for text placement.
      Theme: ${theme}. 
      Atmosphere: Bright natural daylight, cinematic lighting, sharp crisp details, vibrant colors. 
      Style: High-end retail brand photography for an outdoor gear company. 
      No text, no watermarks, no logos in the image. Masterpiece quality.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: "16:9" } }
    });

    // 4. Extract Image
    let imageUrl = null;
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!imageUrl) throw new Error("AI returned no image");

    // 5. Get final credit balance
    const finalUserDoc = await userRef.get();
    const currentCredits = finalUserDoc.data()?.credits || 0;

    res.status(200).json({ imageUrl, credits: currentCredits });

  } catch (error: any) {
    console.error("Backend Generation Error:", error);
    
    // Refund logic
    if (error.message?.includes("AI") || error.message?.includes("GoogleGenAI")) {
       try {
         await userRef.update({ credits: admin.firestore.FieldValue.increment(1) });
       } catch (refundErr) {
         console.error("Failed to refund credit:", refundErr);
       }
    }

    const statusCode = error.message === "Insufficient credits" ? 403 : 500;
    res.status(statusCode).json({ message: error.message || 'Internal Server Error' });
  }
});

// Export the Express app as a Cloud Function named 'api'
export const api = onRequest({ secrets: ["API_KEY"] }, app);
