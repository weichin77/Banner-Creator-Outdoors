import React, { useState, useRef, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  Alert,
  Platform,
  ImageBackground
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import ViewShot from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import * as Localization from 'expo-localization';
import { initBilling, purchaseSubscription, getAvailablePurchases } from './src/services/billing';
import { languages, translations } from './src/i18n';

// Note: In a real app, do NOT hardcode API keys. Call your secure backend.
const BACKEND_URL = 'https://your-secure-backend.com/api';

export default function App() {
  const [lang, setLang] = useState(() => {
    const locales = Localization.getLocales();
    const browserLang = locales[0]?.languageTag || 'en';
    if (languages[browserLang as keyof typeof languages]) return browserLang;
    const shortLang = browserLang.split('-')[0];
    if (languages[shortLang as keyof typeof languages]) return shortLang;
    if (browserLang.toLowerCase().startsWith('zh-tw') || browserLang.toLowerCase().startsWith('zh-hk')) return 'zh-TW';
    if (browserLang.toLowerCase().startsWith('zh')) return 'zh-CN';
    return 'en';
  });

  const t = (key: string) => translations[lang]?.[key] || translations['en'][key] || key;

  const [title, setTitle] = useState('OUTDOOR GEAR');
  const [discount, setDiscount] = useState('50% OFF');
  const [prompt, setPrompt] = useState('A misty mountain landscape at dawn');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [credits, setCredits] = useState(5);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const viewShotRef = useRef<ViewShot>(null);

  useEffect(() => {
    setupBilling();
  }, []);

  const setupBilling = async () => {
    try {
      await initBilling();
      const purchases = await getAvailablePurchases();
      // Check if user has an active subscription
      const hasSub = purchases.some(p => p.productId === 'premium_monthly');
      setIsSubscribed(hasSub);
      if (hasSub) setCredits(999);
    } catch (error) {
      console.error('Billing setup error:', error);
    }
  };

  const handleSubscribe = async () => {
    try {
      await purchaseSubscription('premium_monthly');
      setIsSubscribed(true);
      setCredits(999);
      Alert.alert('Success', 'You are now a Premium member!');
    } catch (error) {
      Alert.alert('Subscription Failed', 'Could not complete the purchase.');
    }
  };

  const handleGenerate = async () => {
    if (credits <= 0 && !isSubscribed) {
      Alert.alert(
        'Out of Credits',
        'Subscribe to Premium for unlimited generations.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Subscribe', onPress: handleSubscribe }
        ]
      );
      return;
    }

    setLoading(true);
    try {
      // SECURITY WARNING: Do not call Gemini directly from the mobile app.
      // The API key would be exposed in the APK.
      // Instead, call your backend which securely holds the Gemini API key.
      const response = await fetch(`${BACKEND_URL}/generate-background`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      
      if (!response.ok) throw new Error('Failed to generate');
      
      const data = await response.json();
      setBgImage(data.imageUrl);
      if (!isSubscribed) setCredits(c => c - 1);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate background. Check your connection.');
      // Fallback for demo purposes
      setBgImage('https://picsum.photos/800/600');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!viewShotRef.current?.capture) return;
    
    setExporting(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need gallery permissions to save the banner.');
        return;
      }

      const uri = await viewShotRef.current.capture();
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Success', 'Banner saved to your gallery!');
    } catch (error) {
      Alert.alert('Error', 'Failed to export banner.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('appTitle').toUpperCase()}</Text>
        <Text style={styles.creditsText}>{t('credits')} {isSubscribed ? '∞' : credits}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Banner Preview Area */}
        <View style={styles.previewContainer}>
          <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9 }} style={styles.banner}>
            <ImageBackground 
              source={{ uri: bgImage || 'https://picsum.photos/seed/placeholder/800/600' }} 
              style={styles.bannerBg}
            >
              <View style={styles.overlay} />
              <Text style={styles.bannerTitle}>{title}</Text>
              <Text style={styles.bannerDiscount}>{discount}</Text>
            </ImageBackground>
          </ViewShot>
        </View>

        {/* Controls */}
        <View style={styles.controlsCard}>
          <Text style={styles.label}>{t('mainHeading').toUpperCase()}</Text>
          <TextInput 
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholderTextColor="#666"
          />

          <Text style={styles.label}>{t('promo1').toUpperCase()}</Text>
          <TextInput 
            style={styles.input}
            value={discount}
            onChangeText={setDiscount}
            placeholderTextColor="#666"
          />

          <Text style={styles.label}>{t('promptSection').toUpperCase()}</Text>
          <TextInput 
            style={[styles.input, styles.textArea]}
            value={prompt}
            onChangeText={setPrompt}
            multiline
            numberOfLines={4}
            placeholderTextColor="#666"
          />

          <TouchableOpacity 
            style={styles.generateBtn} 
            onPress={handleGenerate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>{t('generateBtn').toUpperCase()}</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.exportBtn} 
          onPress={handleExport}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>{t('exportBtn').toUpperCase()}</Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1c23',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    fontStyle: 'italic',
  },
  creditsText: {
    color: '#f97316',
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  previewContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    aspectRatio: 16/9,
    backgroundColor: '#333',
  },
  banner: {
    flex: 1,
  },
  bannerBg: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  bannerDiscount: {
    color: '#f97316',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  controlsCard: {
    backgroundColor: '#1a1c23',
    padding: 20,
    borderRadius: 24,
    marginBottom: 24,
  },
  label: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 8,
    letterSpacing: 2,
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    color: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    fontWeight: 'bold',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  generateBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  exportBtn: {
    backgroundColor: '#ea580c',
    padding: 20,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  btnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
  }
});
