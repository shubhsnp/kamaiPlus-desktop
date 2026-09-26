'use client';

import React, { useState } from 'react';
import { Product } from '@/types';
import { formatINR } from '@/lib/utils';
import { generateCode128SVG } from '@/lib/barcode/barcodeGenerator';
import { getDesktopApi } from '@/lib/desktop/desktopBridge';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Printer, X, Copy, Check } from 'lucide-react';
import { tr } from '@/lib/i18n/core';

interface QuickBarcodePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  storeName?: string;
}

export const QuickBarcodePrintModal: React.FC<QuickBarcodePrintModalProps> = ({
  isOpen,
  onClose,
  product,
  storeName = 'KAMAI+ STORE',
}) => {
  const [copies, setCopies] = useState<number>(1);
  const [labelSize, setLabelSize] = useState<'50x25' | '38x25' | 'pos_58' | 'pos_80'>('50x25');
  const [isPrinting, setIsPrinting] = useState(false);

  if (!isOpen || !product) return null;

  const barcodeValue = product.barcode || product.id.slice(0, 10).toUpperCase();
  const svgMarkup = generateCode128SVG(barcodeValue, {
    height: 38,
    fontSize: 10,
    showText: true,
  });

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      // Build label HTML according to chosen size
      const labelsHtml = Array.from({ length: copies })
        .map(
          () => `
          <div class="barcode-card">
            <div class="store-title">${storeName}</div>
            <div class="prod-title">${product.name}</div>
            <div class="barcode-svg">${svgMarkup}</div>
            <div class="prod-price">₹${(product.selling_price / 100).toFixed(2)}</div>
          </div>
        `
        )
        .join('');

      const printHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Barcode - ${product.name}</title>
          <style>
            @page {
              margin: 0;
              size: auto;
            }
            body {
              margin: 0;
              padding: 4px;
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              flex-wrap: wrap;
              gap: 4px;
              justify-content: center;
              background: #fff;
            }
            .barcode-card {
              box-sizing: border-box;
              width: ${labelSize === '38x25' ? '140px' : labelSize === 'pos_58' ? '200px' : labelSize === 'pos_80' ? '280px' : '180px'};
              padding: 4px;
              text-align: center;
              page-break-inside: avoid;
              border: 1px dashed #ccc;
            }
            .store-title {
              font-size: 8.5px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #333;
            }
            .prod-title {
              font-size: 10px;
              font-weight: 700;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              margin: 1px 0;
            }
            .barcode-svg svg {
              width: 100%;
              max-height: 36px;
              display: block;
              margin: 0 auto;
            }
            .prod-price {
              font-size: 11px;
              font-weight: 900;
              margin-top: 1px;
            }
          </style>
        </head>
        <body>
          ${labelsHtml}
          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
        </html>
      `;

      const desktop = getDesktopApi();
      if (desktop && desktop.isDesktop) {
        await desktop.print({
          html: printHtml,
          paper: labelSize === 'pos_58' ? 'thermal-58' : 'thermal-80',
          silent: false,
        });
      } else {
        const printWindow = window.open('', '_blank', 'width=400,height=500');
        if (printWindow) {
          printWindow.document.write(printHtml);
          printWindow.document.close();
        }
      }
      onClose();
    } catch (e) {
      console.error('Barcode print error:', e);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={tr('1-Click Barcode Print')} size="sm">
      <div className="space-y-4">
        {/* Live Preview of Single Label */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center shadow-xs">
          <div className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-0.5">
            {storeName}
          </div>
          <div className="font-bold text-xs text-slate-900 line-clamp-1 max-w-[200px]">
            {product.name}
          </div>
          <div
            className="w-48 my-1 flex justify-center"
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
          <div className="font-mono font-black text-sm text-slate-900">
            {formatINR(product.selling_price)}
          </div>
        </div>

        {/* Configuration Controls */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              {tr('Copies')}
            </label>
            <div className="flex items-center gap-1">
              {[1, 5, 10, 20].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setCopies(num)}
                  className={`flex-1 py-1 rounded-lg text-xs font-bold border transition ${
                    copies === num
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              {tr('Label Size')}
            </label>
            <select
              value={labelSize}
              onChange={(e) => setLabelSize(e.target.value as any)}
              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="50x25">{tr('50 × 25 mm (Thermal)')}</option>
              <option value="38x25">{tr('38 × 25 mm (Jewellery/Mini)')}</option>
              <option value="pos_58">{tr('58mm Receipt Roll')}</option>
              <option value="pos_80">{tr('80mm Receipt Roll')}</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 py-2 text-xs font-bold"
          >
            {tr('Cancel')}
          </Button>
          <Button
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex-1 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{tr('Print')} {copies} {copies === 1 ? tr('Label') : tr('Labels')}</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
};
