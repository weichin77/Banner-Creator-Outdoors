# Security Report for Banner Pro Mobile

When converting a web application that relies on AI (Gemini API) and payments to a native Android application, several critical security differences emerge.

## 1. API Key Exposure (CRITICAL)
**Issue:** In the web version, the Gemini API key is often stored in environment variables and injected into the client, or handled by a serverless function. If you put the `GEMINI_API_KEY` directly into the React Native app (e.g., using `react-native-dotenv`), **it will be compiled into the APK**. Anyone can decompile your APK and steal your API key, racking up massive bills on your Google Cloud account.

**Solution:** 
*   **Never** put the Gemini API key in the React Native app.
*   The mobile app must make a request to your own secure backend server (e.g., an Express.js server or Firebase Cloud Function).
*   Your backend server holds the API key, calls the Gemini API, and returns the generated image URL to the mobile app.

## 2. Google Play Billing Verification (CRITICAL)
**Issue:** The `react-native-iap` library allows the client app to request a subscription purchase. However, a malicious user can use a modified APK or a tool like Lucky Patcher to spoof a successful purchase response on the device. If your app trusts the client-side success response and grants unlimited credits, you will lose revenue.

**Solution:**
*   When a purchase succeeds on the device, you receive a `purchaseToken`.
*   You **must** send this `purchaseToken` to your backend server.
*   Your backend server must use the Google Play Developer API to verify the token directly with Google's servers.
*   Only after your server confirms the purchase is valid should it update the user's database record to "Premium".

## 3. Image Export Permissions (Moderate)
**Issue:** Android requires explicit permissions to write files to the user's gallery. If not handled correctly, the app will crash when trying to export the banner.

**Solution:**
*   The `app.json` file has been configured with `android.permission.WRITE_EXTERNAL_STORAGE`.
*   The `App.tsx` code uses `expo-media-library` to explicitly request permission from the user at runtime before attempting to save the image.

## 4. Network Security (Standard)
**Issue:** Sending data over unencrypted HTTP connections allows man-in-the-middle attacks.

**Solution:**
*   Ensure your backend server uses HTTPS (`https://`). Android blocks cleartext HTTP traffic by default starting from Android 9 (Pie).
