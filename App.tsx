
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { toJpeg } from 'html-to-image';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { BannerConfig, UserAccount } from './types';
import BannerPreview from './components/BannerPreview';
import { generateOutdoorBackground, getUserProfile } from './services/geminiService';
import { languages, translations } from './i18n';

const App: React.FC = () => {
  const bannerRef = useRef<HTMLDivElement>(null);
  const [customTheme, setCustomTheme] = useState('');
  
  // Initialize with a placeholder, but credits will be fetched from DB
  const [user, setUser] = useState<UserAccount>({
    credits: 0, // Start at 0 until loaded
    isPro: false,
    email: 'user@example.com' // In a real app, this comes from Auth provider
  });
  
  const [config, setConfig] = useState<BannerConfig>({
    title: '杜戛地 探拓戶外',
    discount: '秋冬外套88折',
    discount2: '全館新品登場',
    theme: 'nature',
    backgroundImage: 'https://images.unsplash.com/photo-1522163182402-834f871fd851?q=80&w=1644&auto=format&fit=crop', 
    overlayOpacity: 0.45,
    width: 1644,
    height: 604,
    titleX: 10,
    titleY: 35,
    discountX: 10,
    discountY: 52,
    discount2X: 10,
    discount2Y: 65,
  });
  
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showBilling, setShowBilling] = useState(false);
  const [isUserLoaded, setIsUserLoaded] = useState(false);
  const [lang, setLang] = useState('en');

  const t = (key: string) => translations[lang]?.[key] || translations['en'][key] || key;

  // Load User Profile from Database on Mount
  useEffect(() => {
    const loadUser = async () => {
      // In a real app, 'user@example.com' would be retrieved from auth state (e.g., Firebase Auth)
      const profile = await getUserProfile(user.email);
      if (profile) {
        setUser(profile);
      }
      setIsUserLoaded(true);
    };
    loadUser();
  }, []);

  const handleUpdateConfig = useCallback((updates: Partial<BannerConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const handleGenerateBackground = useCallback(async () => {
    if (user.credits <= 0) {
      setShowBilling(true);
      return;
    }

    setLoading(true);
    const themeToUse = customTheme.trim() 
      ? `${config.theme} scenery, ${customTheme.trim()}` 
      : config.theme;
      
    // Pass email to backend to ensure credits are deducted from correct account
    const result = await generateOutdoorBackground(themeToUse, user.email);
    
    if (result.imageUrl) {
      setConfig(prev => ({ ...prev, backgroundImage: result.imageUrl }));
      // Update credits from server response to ensure sync
      setUser(prev => ({ ...prev, credits: result.credits }));
    } else if (result.credits === -1) {
      // Error handling (credits -1 indicates failure in service layer)
      // Check if we need to show billing based on server error message is handled in service/proxy
      // But here we can re-check credits just in case
      const profile = await getUserProfile(user.email);
      if (profile) setUser(profile);
    }
    setLoading(false);
  }, [config.theme, customTheme, user.credits, user.email]);

  const handleSubscribe = async () => {
    setLoading(true);
    // Simulation of payment success
    setTimeout(() => {
      // Optimistic update
      setUser(prev => ({
        ...prev,
        credits: prev.credits + 100,
        isPro: true
      }));
      setLoading(false);
      setShowBilling(false);
      // In production: Call backend to verify payment and add credits
    }, 1500);
  };

  const handleExport = async () => {
    if (!bannerRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toJpeg(bannerRef.current, { 
        quality: 0.95,
        pixelRatio: 2,
        width: config.width,
        height: config.height,
        cacheBust: true,
      });
      const link = document.createElement('a');
      link.download = `outdoors-banner-${Date.now()}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1115] pb-20 text-white/90 font-['Noto_Sans_TC'] selection:bg-orange-500/30">
      <header className="bg-black/50 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(234,88,12,0.4)]">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <div className="hidden xs:block">
              <h1 className="text-lg font-black tracking-tighter leading-none uppercase italic">{t('appTitle')}</h1>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <select 
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="bg-white/5 border border-white/10 text-white/80 text-xs font-bold px-2 py-1.5 rounded-lg outline-none focus:border-orange-500 transition-colors"
            >
              {Object.entries(languages).map(([code, name]) => (
                <option key={code} value={code} className="bg-[#1a1c23]">{name}</option>
              ))}
            </select>

            <div className="hidden sm:flex items-center bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
              <span className="text-[10px] font-black text-white/40 mr-2 uppercase tracking-wider">{t('credits')}</span>
              <span className={`text-sm font-black ${isUserLoaded ? 'text-orange-500' : 'text-gray-500 animate-pulse'}`}>
                {isUserLoaded ? user.credits : '...'}
              </span>
            </div>
            
            <button 
              onClick={handleGenerateBackground}
              disabled={loading || !isUserLoaded}
              className={`group flex items-center space-x-2 px-4 sm:px-6 py-2.5 rounded-full font-bold transition-all border border-white/20 ${
                loading || !isUserLoaded
                ? 'bg-white/5 text-white/30 cursor-not-allowed opacity-50' 
                : 'bg-white/10 text-white hover:bg-orange-600 hover:border-orange-500 shadow-xl active:scale-95'
              }`}
            >
              {loading ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              <span className="text-sm sm:text-base whitespace-nowrap">{loading ? t('generatingBtn') : t('generateBtn')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1644px] mx-auto px-4 mt-6 sm:mt-12 space-y-8 sm:space-y-12 pb-20">
        <section className="touch-none">
          <div className="relative group/banner ring-1 ring-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <BannerPreview ref={bannerRef} config={config} onUpdateConfig={handleUpdateConfig} />
            <div className="absolute top-4 left-4 pointer-events-none opacity-0 group-hover/banner:opacity-100 transition-opacity bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-[10px] font-bold uppercase tracking-widest text-orange-400">
              {t('dragHint')}
            </div>
          </div>
        </section>

        <section className="flex justify-center">
          <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            <div className="bg-[#1a1c23] p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-orange-600/10 blur-[80px]"></div>
              <h3 className="text-xs font-black mb-6 text-white/40 uppercase tracking-[0.3em]">{t('bannerContent')}</h3>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">{t('width')}</label>
                    <input 
                      type="number" 
                      value={config.width}
                      onChange={(e) => setConfig(prev => ({ ...prev, width: parseInt(e.target.value) || 0 }))}
                      className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-orange-500 outline-none font-bold text-white transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">{t('height')}</label>
                    <input 
                      type="number" 
                      value={config.height}
                      onChange={(e) => setConfig(prev => ({ ...prev, height: parseInt(e.target.value) || 0 }))}
                      className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:border-orange-500 outline-none font-bold text-white transition-all text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-3">{t('mainHeading')}</label>
                  <input 
                    type="text" 
                    value={config.title}
                    onChange={(e) => setConfig(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-5 py-4 bg-black/40 border border-white/10 rounded-2xl focus:border-orange-500 outline-none font-bold text-white transition-all text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-3">{t('promo1')}</label>
                  <input 
                    type="text" 
                    value={config.discount}
                    onChange={(e) => setConfig(prev => ({ ...prev, discount: e.target.value }))}
                    className="w-full px-5 py-4 bg-black/40 border border-white/10 rounded-2xl focus:border-orange-500 outline-none font-bold text-white transition-all text-sm"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-3">{t('promo2')}</label>
                  <input 
                    type="text" 
                    value={config.discount2}
                    onChange={(e) => setConfig(prev => ({ ...prev, discount2: e.target.value }))}
                    className="w-full px-5 py-4 bg-black/40 border border-white/10 rounded-2xl focus:border-orange-500 outline-none font-bold text-white transition-all text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-3">{t('scenery')}</label>
                    <select 
                      value={config.theme}
                      onChange={(e) => setConfig(prev => ({ ...prev, theme: e.target.value }))}
                      className="w-full px-4 py-4 bg-black/40 border border-white/10 rounded-2xl focus:border-orange-500 outline-none font-bold text-white transition-all text-sm appearance-none"
                    >
                      <option value="nature">{t('mistyMountains')}</option>
                      <option value="tactical">{t('tacticalForest')}</option>
                      <option value="urban">{t('urbanHeights')}</option>
                      <option value="winter">{t('glacierPeak')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-3">{t('atmosphere')}</label>
                    <input 
                      type="range" min="0" max="1" step="0.01"
                      value={config.overlayOpacity}
                      onChange={(e) => setConfig(prev => ({ ...prev, overlayOpacity: parseFloat(e.target.value) }))}
                      className="w-full h-1 mt-6 bg-white/10 rounded-full appearance-none cursor-pointer accent-orange-600"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#1a1c23] p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
               <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-600/10 blur-[80px]"></div>
               <h3 className="text-xs font-black mb-6 text-white/40 uppercase tracking-[0.3em]">{t('precisionControls')}</h3>
               
               <div className="space-y-8">
                 <div className="space-y-4">
                   <div className="flex justify-between">
                     <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">{t('headingXY')}</label>
                     <span className="text-[10px] font-mono text-orange-500">{config.titleX}%, {config.titleY}%</span>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                     <input 
                      type="range" min="0" max="100"
                      value={config.titleX}
                      onChange={(e) => setConfig(prev => ({ ...prev, titleX: parseInt(e.target.value) }))}
                      className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-orange-600"
                     />
                     <input 
                      type="range" min="0" max="100"
                      value={config.titleY}
                      onChange={(e) => setConfig(prev => ({ ...prev, titleY: parseInt(e.target.value) }))}
                      className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-orange-600"
                     />
                   </div>
                 </div>

                 <div className="space-y-4 pt-6 border-t border-white/5">
                   <div className="flex justify-between">
                     <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">{t('promo1XY')}</label>
                     <span className="text-[10px] font-mono text-orange-500">{config.discountX}%, {config.discountY}%</span>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                     <input 
                      type="range" min="0" max="100"
                      value={config.discountX}
                      onChange={(e) => setConfig(prev => ({ ...prev, discountX: parseInt(e.target.value) }))}
                      className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-orange-600"
                     />
                     <input 
                      type="range" min="0" max="100"
                      value={config.discountY}
                      onChange={(e) => setConfig(prev => ({ ...prev, discountY: parseInt(e.target.value) }))}
                      className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-orange-600"
                     />
                   </div>
                 </div>

                 <div className="space-y-4 pt-6 border-t border-white/5">
                   <div className="flex justify-between">
                     <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">{t('promo2XY')}</label>
                     <span className="text-[10px] font-mono text-orange-500">{config.discount2X}%, {config.discount2Y}%</span>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                     <input 
                      type="range" min="0" max="100"
                      value={config.discount2X}
                      onChange={(e) => setConfig(prev => ({ ...prev, discount2X: parseInt(e.target.value) }))}
                      className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-orange-600"
                     />
                     <input 
                      type="range" min="0" max="100"
                      value={config.discount2Y}
                      onChange={(e) => setConfig(prev => ({ ...prev, discount2Y: parseInt(e.target.value) }))}
                      className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-orange-600"
                     />
                   </div>
                 </div>

                 <div className="pt-4">
                  <button 
                    onClick={handleExport}
                    disabled={exporting}
                    className="w-full group bg-orange-600 hover:bg-orange-500 text-white py-5 rounded-2xl font-black text-lg transition-all shadow-xl active:scale-[0.98] flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed uppercase"
                  >
                    {exporting ? (
                      <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 group-hover:translate-y-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    )}
                    <span>{exporting ? t('exportingBtn') : t('exportBtn')}</span>
                  </button>
                 </div>
               </div>
            </div>
          </div>
        </section>
      </main>

      {/* Billing Modal */}
      {showBilling && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#1a1c23] rounded-[40px] p-10 border border-white/10 shadow-2xl text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-500 via-orange-300 to-orange-500"></div>
            <h2 className="text-3xl font-black mb-2 uppercase tracking-tight">{t('insufficientCredits')}</h2>
            <p className="text-white/50 mb-8 font-medium">{t('subscribeDesc')}</p>
            <div className="bg-black/40 rounded-3xl p-6 mb-8 border border-white/5">
              <div className="text-orange-500 font-black text-4xl mb-1">USD $20<span className="text-sm text-white/40 ml-1">{t('perMonth')}</span></div>
              <div className="text-white font-bold text-lg mb-4">{t('monthlyCredits')}</div>
            </div>
            
            <div className="mb-4 relative z-10">
              <PayPalScriptProvider options={{ 
                clientId: (import.meta as any).env.VITE_PAYPAL_CLIENT_ID || "test",
                currency: "USD",
                intent: "capture"
              }}>
                <PayPalButtons 
                  style={{ layout: "vertical", color: "gold", shape: "rect", label: "subscribe" }}
                  createOrder={async () => {
                    try {
                      const res = await fetch("/api/paypal/create-order", { method: "POST" });
                      const order = await res.json();
                      if (order.id) {
                        return order.id;
                      } else {
                        throw new Error("Failed to create order");
                      }
                    } catch (err) {
                      console.error(err);
                      alert(t('paypalInitError'));
                      return "";
                    }
                  }}
                  onApprove={async (data) => {
                    setLoading(true);
                    try {
                      const res = await fetch("/api/paypal/capture-order", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ orderID: data.orderID, email: user.email })
                      });
                      const capture = await res.json();
                      if (capture.success) {
                        setUser(prev => ({ ...prev, credits: prev.credits + 100, isPro: true }));
                        setShowBilling(false);
                      } else {
                        alert(t('paymentFailed'));
                      }
                    } catch (err) {
                      console.error(err);
                      alert(t('paymentError'));
                    } finally {
                      setLoading(false);
                    }
                  }}
                />
              </PayPalScriptProvider>
            </div>

            <button onClick={() => setShowBilling(false)} className="text-white/30 hover:text-white/60 text-sm font-bold transition-colors uppercase tracking-widest">{t('maybeLater')}</button>
          </div>
        </div>
      )}

      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-orange-900/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 blur-[120px] rounded-full"></div>
      </div>
    </div>
  );
};

export default App;
