import * as RNIap from 'react-native-iap';
import { Platform } from 'react-native';

// Note: In a real app, you must verify purchases on your secure backend.
// Do not trust the client to verify purchases.
const BACKEND_URL = 'https://your-secure-backend.com/api';

const items = Platform.select({
  ios: ['premium_monthly'],
  android: ['premium_monthly']
}) || [];

export const initBilling = async () => {
  try {
    await RNIap.initConnection();
    if (Platform.OS === 'android') {
      await RNIap.flushFailedPurchasesCachedAsPendingAndroid();
    }
  } catch (err) {
    console.warn(err);
  }
};

export const getAvailablePurchases = async () => {
  try {
    const products = await RNIap.getSubscriptions({ skus: items });
    return products;
  } catch (err) {
    console.warn(err);
    return [];
  }
};

export const purchaseSubscription = async (sku: string) => {
  try {
    const purchase = await RNIap.requestSubscription({ sku });
    
    // SECURITY WARNING: 
    // You MUST send `purchase.purchaseToken` to your backend server.
    // Your backend server should call the Google Play Developer API to verify the token.
    // Do NOT grant premium access just because `requestSubscription` succeeded on the client.
    
    const response = await fetch(`${BACKEND_URL}/verify-purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: purchase.purchaseToken,
        productId: purchase.productId,
        platform: Platform.OS
      })
    });

    if (!response.ok) {
      throw new Error('Purchase verification failed on server');
    }

    await RNIap.finishTransaction({ purchase, isConsumable: false });
    return purchase;
  } catch (err) {
    console.warn(err);
    throw err;
  }
};
