'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useTranslation } from '@/lib/i18n';
import { MessageSquare, Copy, ExternalLink, Check, AlertCircle } from 'lucide-react';
import { generateWhatsAppReceiptLink } from '@/lib/utils';

export interface WhatsAppShareData {
  guestPhone: string;
  guestName: string;
  lodgeName: string;
  roomNumber?: string;
  bookingRef: string;
  amountRupees: number;
  balanceDueRupees?: number;
  receiptNumber: string;
  receiptType: 'advance' | 'partial' | 'final' | 'refund';
  stayDates?: {
    checkIn: string;
    checkOut: string;
    nights: number;
  };
}

interface WhatsAppShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  data: WhatsAppShareData;
}

export const WhatsAppShareDialog: React.FC<WhatsAppShareDialogProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  const { language } = useTranslation();
  const isMarathi = language === 'mr';

  const [phone, setPhone] = useState(data.guestPhone || '');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Generate appropriate message text
  const getReceiptTitle = () => {
    switch (data.receiptType) {
      case 'advance':
        return isMarathi ? 'अ‍ॅडव्हान्स पेमेंट पावती' : 'Advance Payment Receipt';
      case 'partial':
        return isMarathi ? 'पेमेंट पावती' : 'Payment Receipt';
      case 'final':
        return isMarathi ? 'अंतिम बिल व पावती' : 'Final Bill & Receipt';
      case 'refund':
        return isMarathi ? 'रिफंड / परतावा पावती' : 'Refund Receipt';
    }
  };

  const messageText = isMarathi
    ? `नमस्कार ${data.guestName}जी,

आपल्या *${data.lodgeName}* मधील मुक्कामाची ${getReceiptTitle()} खालीलप्रमाणे आहे:

📄 *पावती क्र:* ${data.receiptNumber}
🔖 *बुकिंग संदर्भ:* ${data.bookingRef}
${data.roomNumber ? `🚪 *खोली क्रमांक:* ${data.roomNumber}\n` : ''}${
        data.stayDates
          ? `📅 *मुक्काम:* ${data.stayDates.checkIn} ते ${data.stayDates.checkOut} (${data.stayDates.nights} रात्री)\n`
          : ''
      }💵 *${data.receiptType === 'refund' ? 'परतावा रक्कम' : 'प्राप्त रक्कम'}:* ₹${data.amountRupees.toFixed(2)}
${
  data.balanceDueRupees !== undefined && data.balanceDueRupees > 0
    ? `⚠️ *बाकी शिल्लक रक्कम:* ₹${data.balanceDueRupees.toFixed(2)}\n`
    : '✅ *शिल्लक रक्कम:* ₹0.00 (पूर्ण चुकते)\n'
}
धन्यवाद!
*${data.lodgeName}*`
    : `Dear ${data.guestName},

Thank you for staying at *${data.lodgeName}*. Here is your ${getReceiptTitle()}:

📄 *Receipt No:* ${data.receiptNumber}
🔖 *Booking Ref:* ${data.bookingRef}
${data.roomNumber ? `🚪 *Room Number:* ${data.roomNumber}\n` : ''}${
        data.stayDates
          ? `📅 *Stay:* ${data.stayDates.checkIn} to ${data.stayDates.checkOut} (${data.stayDates.nights} Nights)\n`
          : ''
      }💵 *${data.receiptType === 'refund' ? 'Refund Amount' : 'Amount Received'}:* ₹${data.amountRupees.toFixed(2)}
${
  data.balanceDueRupees !== undefined && data.balanceDueRupees > 0
    ? `⚠️ *Balance Due:* ₹${data.balanceDueRupees.toFixed(2)}\n`
    : '✅ *Balance Due:* ₹0.00 (Fully Settled)\n'
}
Thank you!
*${data.lodgeName}*`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setErrorMsg(isMarathi ? 'कॉपी करता आले नाही' : 'Failed to copy');
    }
  };

  const handleOpenWhatsApp = () => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 10) {
      setErrorMsg(isMarathi ? 'कृपया वैध १०-अंकी मोबाईल नंबर प्रविष्ट करा' : 'Please enter a valid 10-digit mobile number');
      return;
    }
    setErrorMsg('');

    const url = generateWhatsAppReceiptLink(phone, messageText);
    window.open(url, '_blank');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-emerald-600" />
          <span className="font-black text-slate-900 dark:text-slate-100">
            {isMarathi ? 'व्हॉट्सअ‍ॅपवर पावती पाठवा' : 'Share Receipt on WhatsApp'}
          </span>
        </div>
      }
      description={
        isMarathi
          ? 'पाहुण्यांच्या मोबाईलवर थेट पावतीचा संदेश पाठवा'
          : 'Send formatted payment receipt details directly to guest WhatsApp'
      }
      size="md"
    >
      <div className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Mobile Number input with confirmation */}
        <div>
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
            {isMarathi ? 'पाहुण्याचा व्हॉट्सअ‍ॅप नंबर' : 'Guest WhatsApp Mobile Number'}
          </label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 9822012345"
            className="font-mono text-sm"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            {isMarathi
              ? '१०-अंकी नंबर प्रविष्ट करा. भारताचा कोड (+91) आपोआप जोडला जाईल.'
              : 'Enter 10-digit mobile number. Country code (+91) will be prepended automatically.'}
          </p>
        </div>

        {/* Message Preview Box */}
        <div>
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
            {isMarathi ? 'संदेश पूर्वावलोकन (Message Preview)' : 'Message Preview'}
          </label>
          <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-3.5 text-xs text-slate-800 dark:text-slate-200 font-sans whitespace-pre-line leading-relaxed max-h-56 overflow-y-auto">
            {messageText}
          </div>
        </div>

        {/* Note on Truthful Fallback */}
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] font-medium text-amber-900 leading-normal">
          {isMarathi
            ? 'टीप: "व्हॉट्सअ‍ॅप उघडा" वर क्लिक केल्यावर व्हॉट्सअ‍ॅप ॲप/वेब उघडेल. आपण संदेश पाठवण्यापूर्वी आवश्यक असल्यास पावतीचा फोटो किंवा पीडीएफ फाईल जोडू शकता.'
            : 'Note: Clicking "Open WhatsApp" will launch WhatsApp with the prepared text. You can attach a printed photo or saved PDF receipt before pressing send.'}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="flex items-center gap-1.5"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? (isMarathi ? 'कॉपी झाले!' : 'Copied!') : isMarathi ? 'मेसेज कॉपी करा' : 'Copy Message'}</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              {isMarathi ? 'बंद करा' : 'Close'}
            </Button>

            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleOpenWhatsApp}
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 font-bold px-5"
            >
              <ExternalLink className="w-4 h-4" />
              <span>{isMarathi ? 'व्हॉट्सअ‍ॅप उघडा' : 'Open WhatsApp'}</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
