import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, Keyboard, CheckCircle, Barcode as BarcodeIcon, AlertCircle } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Product } from '../../types';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductFound: (product: Product) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onProductFound,
}) => {
  const { dbState } = useStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [manualCode, setManualCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [recentScanned, setRecentScanned] = useState<Product | null>(null);

  // Play a quick POS register beep using Web Audio API
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // AudioContext may be restricted or unsupported
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setManualCode('');
      setRecentScanned(null);
      setCameraError(null);
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera API is not supported on this browser.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err) {
      console.warn('Camera access error:', err);
      setCameraError('Camera access unavailable or declined. You can type or simulate barcode below.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const handleLookup = (code: string) => {
    const trimmed = code.trim().toLowerCase();
    if (!trimmed) return;

    const found = dbState.products.find(
      (p) =>
        p.active &&
        (p.barcode?.toLowerCase() === trimmed ||
          p.sku.toLowerCase() === trimmed ||
          p.id.toLowerCase() === trimmed)
    );

    if (found) {
      playBeep();
      setRecentScanned(found);
      onProductFound(found);
      setManualCode('');
      setTimeout(() => {
        onClose();
      }, 700);
    } else {
      setCameraError(`No active product found matching barcode/SKU: "${code}"`);
    }
  };

  if (!isOpen) return null;

  const sampleBarcodes = dbState.products.slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold">Barcode &amp; SKU Scanner</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder area */}
        <div className="relative bg-black h-56 flex items-center justify-center overflow-hidden">
          {cameraActive ? (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Overlay target box */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-32 border-2 border-emerald-400 rounded-xl relative shadow-lg">
                  <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-emerald-400 -mt-1 -ml-1"></div>
                  <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-emerald-400 -mt-1 -mr-1"></div>
                  <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-emerald-400 -mb-1 -ml-1"></div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-emerald-400 -mb-1 -mr-1"></div>
                  {/* Laser line */}
                  <div className="w-full h-0.5 bg-red-500 absolute top-1/2 -translate-y-1/2 animate-pulse shadow-md shadow-red-500/50"></div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center p-6 text-slate-300">
              <Camera className="w-12 h-12 mx-auto mb-2 text-slate-500 opacity-60" />
              <p className="text-sm font-medium">Camera Viewfinder</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                {cameraError || 'Align physical product barcode with the scanner viewfinder'}
              </p>
            </div>
          )}

          {/* Success scan badge overlay */}
          {recentScanned && (
            <div className="absolute inset-0 bg-emerald-950/90 flex flex-col items-center justify-center p-4 text-white animate-in zoom-in-95">
              <CheckCircle className="w-12 h-12 text-emerald-400 mb-2" />
              <p className="font-bold text-base text-center">{recentScanned.name}</p>
              <p className="text-xs text-emerald-300 mt-1">
                {dbState.settings.currency}{recentScanned.sellingPrice.toLocaleString()} · Added to Cart
              </p>
            </div>
          )}
        </div>

        {/* Content & Quick Barcodes */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Manual input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Enter SKU or Barcode Manually
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLookup(manualCode);
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <Keyboard className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="e.g. SKU or barcode"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-xl shadow-sm transition active:scale-95"
              >
                Scan
              </button>
            </form>
          </div>

          {/* Quick Barcode Simulator for Demo / Testing */}
          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-slate-500">
              <BarcodeIcon className="w-3.5 h-3.5" />
              <span>Tap to Simulate Hardware Scan</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {sampleBarcodes.map((prod) => (
                <button
                  key={prod.id}
                  onClick={() => handleLookup(prod.barcode || prod.sku)}
                  className="w-full text-left p-2 rounded-lg bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-xs flex items-center justify-between transition group"
                >
                  <div className="truncate pr-2">
                    <span className="font-semibold text-slate-900 group-hover:text-emerald-900 block truncate">
                      {prod.name}
                    </span>
                    <span className="text-slate-500 font-mono text-[10px]">
                      SKU: {prod.sku} {prod.barcode && `· Barcode: ${prod.barcode}`}
                    </span>
                  </div>
                  <span className="font-bold text-emerald-700 whitespace-nowrap">
                    {dbState.settings.currency}{prod.sellingPrice.toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            Close Scanner
          </button>
        </div>
      </div>
    </div>
  );
};
