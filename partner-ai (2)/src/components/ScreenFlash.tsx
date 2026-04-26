import React, { useState, useEffect } from 'react';
import { cn } from '../lib/utils';

// Custom event name
const SCREEN_FLASH_EVENT = 'app:screen-flash';

export type FlashType = 'error' | 'success' | 'warning';

// Sound utility
const playAlertSound = (type: FlashType) => {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return;
  
  const ctx = new AudioContextClass();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  
  if (type === 'error') {
    // Failed sound: Low-pitched, descending, slightly harsh
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.5);
    
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } else if (type === 'warning') {
    // Warning sound: Nice stereo sound, slightly higher pitched, pleasant
    const oscL = ctx.createOscillator();
    const oscR = ctx.createOscillator();
    const gainL = ctx.createGain();
    const gainR = ctx.createGain();
    const panL = ctx.createStereoPanner();
    const panR = ctx.createStereoPanner();
    
    oscL.type = 'sine';
    oscR.type = 'sine';
    
    // Slightly detuned for a richer "stereo" feel
    oscL.frequency.setValueAtTime(440, ctx.currentTime); // A4
    oscR.frequency.setValueAtTime(442, ctx.currentTime); 
    
    panL.pan.setValueAtTime(-0.8, ctx.currentTime); // Left
    panR.pan.setValueAtTime(0.8, ctx.currentTime);  // Right
    
    gainL.gain.setValueAtTime(0.5, ctx.currentTime);
    gainL.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
    gainR.gain.setValueAtTime(0.5, ctx.currentTime);
    gainR.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
    
    oscL.connect(panL);
    panL.connect(gainL);
    gainL.connect(ctx.destination);
    
    oscR.connect(panR);
    panR.connect(gainR);
    gainR.connect(ctx.destination);
    
    oscL.start();
    oscR.start();
    oscL.stop(ctx.currentTime + 0.8);
    oscR.stop(ctx.currentTime + 0.8);
  } else if (type === 'success') {
    // Success sound: Premium "iPhone-style" Success Chime
    // A clean, two-note ascending chime (E5 -> A5)
    const createNote = (freq: number, delay: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3);
      
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.3);
    };

    // E5 -> A5 (Classic Apple-esque success interval)
    createNote(659.25, 0);   // E5
    createNote(880.00, 0.1); // A5
  }
};

// Utility to trigger the flash
export const triggerScreenFlash = (type: FlashType = 'error') => {
  window.dispatchEvent(new CustomEvent(SCREEN_FLASH_EVENT, { detail: { type } }));
  playAlertSound(type);
};

export const ScreenFlash: React.FC = () => {
  const [flash, setFlash] = useState<{ active: boolean; type: FlashType }>({ active: false, type: 'error' });

  useEffect(() => {
    const handleFlash = (e: any) => {
      const type = e.detail?.type || 'error';
      setFlash({ active: true, type });
      // Reset after animation duration
      setTimeout(() => setFlash(prev => ({ ...prev, active: false })), 1600);
    };

    window.addEventListener(SCREEN_FLASH_EVENT, handleFlash);
    return () => window.removeEventListener(SCREEN_FLASH_EVENT, handleFlash);
  }, []);

  if (!flash.active) return null;

  return (
    <div className={cn(
      "screen-flash-overlay",
      flash.type === 'error' ? "screen-flash-error" : 
      flash.type === 'warning' ? "screen-flash-warning" :
      "screen-flash-success"
    )} />
  );
};
