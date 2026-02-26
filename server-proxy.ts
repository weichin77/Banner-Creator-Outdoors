
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
export const handleDeductCredit = async (req: any, res: any) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { email } = req.body;
  const amount = 1; // Hardcoded to prevent client manipulation

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  const userRef = db.collection('users').doc(email);

  try {
    let newCredits = 0;
    await db.runTransaction(async (t: any) => {
      const doc = await t.get(userRef);
      if (!doc.exists) {
        throw new Error("User not found");
      }
      const data = doc.data();
      if (!data || data.credits < amount) {
        throw new Error("Insufficient credits");
      }
      newCredits = data.credits - amount;
      t.update(userRef, { credits: newCredits });
    });

    res.status(200).json({ credits: newCredits });
  } catch (error: any) {
    console.error("Deduct Credit Error:", error);
    const statusCode = error.message === "Insufficient credits" ? 403 : 500;
    res.status(statusCode).json({ message: error.message || 'Internal Server Error' });
  }
};

export const handleRefundCredit = async (req: any, res: any) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { email } = req.body;
  const amount = 1; // Hardcoded to prevent client manipulation

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  const userRef = db.collection('users').doc(email);

  try {
    let newCredits = 0;
    await db.runTransaction(async (t: any) => {
      const doc = await t.get(userRef);
      if (!doc.exists) {
        throw new Error("User not found");
      }
      const data = doc.data();
      newCredits = data.credits + amount;
      t.update(userRef, { credits: newCredits });
    });

    res.status(200).json({ credits: newCredits });
  } catch (error: any) {
    console.error("Refund Credit Error:", error);
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};
