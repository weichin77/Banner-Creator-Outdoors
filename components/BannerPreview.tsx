
import React, { forwardRef, useState, useCallback, useRef, useEffect } from 'react';
import { BannerConfig } from '../types';

interface BannerPreviewProps {
  config: BannerConfig;
  onUpdateConfig?: (updates: Partial<BannerConfig>) => void;
}

const BannerPreview = forwardRef<HTMLDivElement, BannerPreviewProps>(({ config, onUpdateConfig }, ref) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeDrag, setActiveDrag] = useState<'title' | 'discount' | 'discount2' | null>(null);

  const handleStartDrag = (type: 'title' | 'discount' | 'discount2') => (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setActiveDrag(type);
  };

  const handleMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!activeDrag || !containerRef.current || !onUpdateConfig) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const xPercent = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const yPercent = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));

    if (activeDrag === 'title') {
      onUpdateConfig({ titleX: Math.round(xPercent), titleY: Math.round(yPercent) });
    } else if (activeDrag === 'discount') {
      onUpdateConfig({ discountX: Math.round(xPercent), discountY: Math.round(yPercent) });
    } else if (activeDrag === 'discount2') {
      onUpdateConfig({ discount2X: Math.round(xPercent), discount2Y: Math.round(yPercent) });
    }
  }, [activeDrag, onUpdateConfig]);

  const handleEndDrag = useCallback(() => {
    setActiveDrag(null);
  }, []);

  useEffect(() => {
    if (activeDrag) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEndDrag);
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleEndDrag);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEndDrag);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEndDrag);
    };
  }, [activeDrag, handleMove, handleEndDrag]);

  const aspectRatio = config.width > 0 ? (config.height / config.width) * 100 : 0;

  /**
   * Renders the promotion text with a high-impact style.
   * Automatically detects and styles discount patterns like "88折" or "50%".
   */
  const renderStyledPromotion = (text: string) => {
    // Regex to capture common discount formats (e.g., 88折, 15% OFF, etc)
    const discountRegex = /(\d+折|\d+%\s*(OFF|off)?)/g;
    const parts = text.split(discountRegex);
    
    return (
      <div className="flex items-baseline font-bold text-orange-400 tracking-wider">
        {parts.map((part, i) => {
          if (!part) return null;
          // Check if this part matches the discount regex
          if (discountRegex.test(part)) {
            return (
              <span 
                key={i} 
                className="text-3xl md:text-5xl lg:text-7xl font-black text-orange-500 mx-1 md:mx-3 leading-none italic drop-shadow-[0_4px_12px_rgba(234,88,12,0.5)] bg-clip-text text-transparent bg-gradient-to-b from-orange-400 to-orange-600"
              >
                {part}
              </span>
            );
          }
          // Default text styling
          return (
            <span key={i} className="text-xl md:text-3xl lg:text-4xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] text-white/90">
              {part}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div 
      className={`relative w-full mx-auto overflow-hidden rounded-xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] border border-white/10 bg-[#0a0a0a] group ${activeDrag ? 'cursor-grabbing' : 'cursor-default'}`}
      style={{ maxWidth: config.width }}
      ref={(el) => {
        containerRef.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      }}
    >
      <div 
        className="relative w-full bg-[#0a0a0a]"
        style={{ 
            paddingBottom: `${aspectRatio}%`,
            width: '100%' 
        }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden pointer-events-none">
          {/* Main Background Layer */}
          {config.backgroundImage ? (
            <img 
              src={config.backgroundImage} 
              alt="Banner Background" 
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-105"
              crossOrigin="anonymous"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-tr from-slate-900 via-emerald-950 to-slate-900 flex items-center justify-center">
              <span className="text-white/5 text-6xl font-black italic tracking-widest animate-pulse uppercase">Outdoor Adventure</span>
            </div>
          )}

          {/* Overlays */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/p6-dark.png")' }}></div>
          <div 
            className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/50 to-transparent transition-opacity duration-500" 
            style={{ opacity: config.overlayOpacity }}
          ></div>
          <div 
            className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20"
            style={{ opacity: config.overlayOpacity * 0.5 }}
          ></div>
        </div>

        {/* Interaction Layer */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Heading Placement */}
          <div 
            className={`absolute select-none group/title ${activeDrag === 'title' ? 'cursor-grabbing z-20 scale-105' : 'cursor-grab hover:z-10 hover:scale-[1.02]'} transition-transform`}
            style={{ 
              left: `${config.titleX}%`, 
              top: `${config.titleY}%`,
              transform: 'translateY(-50%)' 
            }}
            onMouseDown={handleStartDrag('title')}
            onTouchStart={handleStartDrag('title')}
          >
            <h2 className={`text-xl md:text-4xl lg:text-6xl font-black tracking-tighter mb-0 leading-none uppercase italic opacity-95 drop-shadow-[0_4px_8px_rgba(0,0,0,0.7)] text-white whitespace-nowrap ${activeDrag === 'title' ? 'text-orange-200' : 'text-white'}`}>
              {config.title}
            </h2>
            <div className="absolute -inset-2 border-2 border-orange-500/0 group-hover/title:border-orange-500/20 rounded-lg transition-colors pointer-events-none"></div>
          </div>

          {/* Promotion 1 Placement */}
          <div 
            className={`absolute select-none group/discount ${activeDrag === 'discount' ? 'cursor-grabbing z-20 scale-105' : 'cursor-grab hover:z-10 hover:scale-[1.02]'} transition-transform`}
            style={{ 
              left: `${config.discountX}%`, 
              top: `${config.discountY}%`,
              transform: 'translateY(-50%)'
            }}
            onMouseDown={handleStartDrag('discount')}
            onTouchStart={handleStartDrag('discount')}
          >
            <div className="flex flex-col items-start whitespace-nowrap">
              {renderStyledPromotion(config.discount)}
            </div>
            <div className="absolute -inset-3 border-2 border-orange-500/0 group-hover/discount:border-orange-500/20 rounded-lg transition-colors pointer-events-none"></div>
          </div>

          {/* Promotion 2 Placement */}
          <div 
            className={`absolute select-none group/discount2 ${activeDrag === 'discount2' ? 'cursor-grabbing z-20 scale-105' : 'cursor-grab hover:z-10 hover:scale-[1.02]'} transition-transform`}
            style={{ 
              left: `${config.discount2X}%`, 
              top: `${config.discount2Y}%`,
              transform: 'translateY(-50%)'
            }}
            onMouseDown={handleStartDrag('discount2')}
            onTouchStart={handleStartDrag('discount2')}
          >
            <div className="flex flex-col items-start whitespace-nowrap">
              {renderStyledPromotion(config.discount2)}
            </div>
            <div className="absolute -inset-3 border-2 border-orange-500/0 group-hover/discount2:border-orange-500/20 rounded-lg transition-colors pointer-events-none"></div>
          </div>
        </div>
          
        {/* Decorative Layer (Non-interactive) */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-orange-600/50 to-transparent"></div>
          
          <div className="absolute bottom-3 right-4 md:bottom-4 md:right-8 flex flex-col items-end space-y-0.5 md:space-y-1">
            <div className="text-white/20 text-[7px] md:text-[9px] font-black italic tracking-widest uppercase select-none flex items-center space-x-1 md:space-x-2">
              <span className="w-1 h-1 rounded-full bg-orange-500 animate-ping"></span>
              <span>Premium Content Generation</span>
            </div>
            <div className="text-white/10 text-[6px] md:text-[8px] font-mono select-none uppercase">
              {config.width} x {config.height} PX
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default BannerPreview;
