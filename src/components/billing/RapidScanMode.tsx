'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Button } from '@/components/ui/Button';
import { CartItem } from '@/types';
import { playBeepSound } from '@/lib/voice/speechParser';
import { Camera, AlertCircle, X, CheckCircle2, PackageOpen } from 'lucide-react';
import { formatINR } from '@/lib/utils';

interface RapidScanModeProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  cart: CartItem[];
}

export const RapidScanMode: React.FC<RapidScanModeProps> = ({
  isOpen,
  onClose,
  onScan,
  cart,
}) => {
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const containerId = 'rapid-barcode-viewport';
  
  // Show only the 3 most recent items added to cart
  const recentItems = [...cart].reverse().slice(0, 3);

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;

    if (isOpen) {
      setScannerError(null);
      setIsScanning(true);

      const timer = setTimeout(async () => {
        try {
          const formatsToSupport = [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.QR_CODE,
          ];

          html5QrCode = new Html5Qrcode(containerId, {
            formatsToSupport,
            verbose: false,
          });
          scannerRef.current = html5QrCode;

          const config = {
            fps: 15,
            qrbox: { width: 280, height: 180 },
            aspectRatio: 1.333,
          };

          await html5QrCode.start(
            { facingMode: 'environment' },
            config,
            (decodedText) => {
              const now = Date.now();
              // Prevent duplicate scans of the exact same barcode within 1.5 seconds
              if (
                lastScannedRef.current.code === decodedText &&
                now - lastScannedRef.current.time < 1500
              ) {
                return;
              }
              lastScannedRef.current = { code: decodedText, time: now };
              
              playBeepSound('success');
              if (navigator.vibrate) navigator.vibrate(80);
              onScan(decodedText);
            },
            () => {
              // Frame scanning callback
            }
          );
        } catch (err: any) {
          console.warn('Rapid scanner initialization error:', err);
          setScannerError(
            err?.message || 'Camera permission denied or camera not accessible.'
          );
          setIsScanning(false);
        }
      }, 400);

      return () => {
        clearTimeout(timer);
        if (html5QrCode && html5QrCode.isScanning) {
          html5QrCode.stop().catch(() => {}).finally(() => {
            html5QrCode?.clear();
          });
        }
      };
    }
  }, [isOpen, onScan]);

  const handleClose = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop().catch(() => {}).finally(() => {
        scannerRef.current?.clear();
        onClose();
      });
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col animate-in fade-in zoom-in-95 duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center animate-pulse">
            <Camera className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-white font-bold text-sm">Rapid Scan Mode</h2>
            <p className="text-emerald-400 text-[10px] font-bold tracking-wider uppercase">Point • Beep • Next</p>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="p-2 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Camera Viewport Area */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        <div id={containerId} className="w-full h-full object-cover" />

        {/* Animated Laser Scanning Line */}
        {isScanning && !scannerError && (
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-center items-center">
            <div className="w-72 h-48 border-2 border-emerald-500/80 rounded-2xl relative">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent absolute top-1/2 -translate-y-1/2 animate-pulse shadow-sm shadow-emerald-500" />
            </div>
            <p className="text-white/70 font-mono text-xs mt-6 bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">
              Hold barcode inside frame
            </p>
          </div>
        )}

        {scannerError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-300 bg-slate-950/90 z-10 space-y-4">
            <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-rose-400" />
            </div>
            <div>
              <h3 className="text-white font-bold mb-1">Camera Error</h3>
              <p className="text-sm text-slate-400 max-w-xs">{scannerError}</p>
            </div>
            <Button onClick={handleClose} variant="outline" className="mt-4 border-slate-700 text-white">
              Go Back to Billing
            </Button>
          </div>
        )}
      </div>

      {/* Recent Scanned Items (Bottom Panel) */}
      <div className="h-64 bg-slate-900 border-t border-slate-800 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex flex-col">
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-12 h-1.5 bg-slate-700 rounded-full" />
        </div>
        
        <div className="px-5 py-3 flex items-center justify-between border-b border-slate-800/50">
          <h3 className="text-slate-200 font-bold text-sm flex items-center gap-2">
            <PackageOpen className="w-4 h-4 text-emerald-400" />
            Recently Added ({cart.length})
          </h3>
          <span className="text-xl font-black text-white">
            {formatINR(cart.reduce((sum, item) => sum + (item.quantity * item.unit_price) / 100, 0))}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {recentItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
              <CheckCircle2 className="w-8 h-8 opacity-20" />
              <p className="text-xs font-medium">No items scanned yet.</p>
            </div>
          ) : (
            recentItems.map((item, idx) => (
              <div 
                key={`${item.product_id}-${idx}`}
                className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex items-center justify-between animate-in slide-in-from-bottom-2 fade-in"
              >
                <div>
                  <h4 className="text-white font-bold text-sm truncate max-w-[200px]">{item.product_name}</h4>
                  <p className="text-xs text-emerald-400 font-mono mt-0.5">
                    {item.quantity} {item.unit} x {formatINR(item.unit_price / 100)}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-white font-black">
                    {formatINR((item.quantity * item.unit_price) / 100)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-slate-900 border-t border-slate-800">
          <Button 
            onClick={handleClose} 
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-xl shadow-emerald-900/20"
          >
            Finish & Checkout
          </Button>
        </div>
      </div>
    </div>
  );
};
