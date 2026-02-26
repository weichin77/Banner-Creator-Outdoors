# Banner Pro Mobile (React Native)

This is the native Android (and iOS) version of the Banner Pro web application, built with React Native and Expo.

## Features
- Mobile-optimized UI (Touch-friendly, ScrollView, Native Inputs)
- Google Play Billing Integration (`react-native-iap`)
- Direct Export to Device Gallery (`expo-media-library` & `react-native-view-shot`)

## Prerequisites
To run this project on your local machine, you will need:
1. [Node.js](https://nodejs.org/) installed
2. [Android Studio](https://developer.android.com/studio) installed (for the Android Emulator)
3. An Expo account (optional, but recommended)

## How to Run Locally

1. **Download this folder** (`/android-app`) to your local computer.
2. Open a terminal in the folder and install dependencies:
   ```bash
   npm install
   ```
3. Start the Expo development server:
   ```bash
   npx expo start
   ```
4. Press `a` in the terminal to open the app in your Android Emulator, or scan the QR code with the Expo Go app on your physical Android device.

## Important Security Notice
Please read the `SECURITY_REPORT.md` file before publishing this app. 
**DO NOT** put your Gemini API key directly into this React Native codebase. You must set up a backend server to handle the AI generation and Google Play purchase verification.
