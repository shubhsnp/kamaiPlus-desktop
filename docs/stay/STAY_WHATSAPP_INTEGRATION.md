# KAMAI PLUS STAY — WHATSAPP INTEGRATION ARCHITECTURE

**Product:** Kamai Plus Stay (लॉज आणि हॉटेल व्यवस्थापन प्रणाली)  
**Version:** 1.2.0  
**Authority:** Permanent CTO & Integrations Specialist  
**Last Updated:** November 2026  

---

## 1. Product Objectives & User Workflow

Indian lodge operators rely heavily on WhatsApp as the default communication medium with guests.
The objective of this integration is to enable receptionists to transmit verified payment details and receipts to guests with a single click.

### Front-Desk Workflow:
1. Receptionist records a payment (Advance deposit, Partial payment, Checkout settlement, or Refund).
2. The receipt view displays a prominent green **"व्हॉट्सअ‍ॅप (WhatsApp)"** action button.
3. Clicking launches the `WhatsAppShareDialog` modal:
   - Displays the guest's mobile number (editable if the guest uses a different WhatsApp number).
   - Generates a cleanly formatted receipt summary in Marathi or English.
   - Shows a live preview of the message.
4. Receptionist clicks **"व्हॉट्सअ‍ॅप उघडा (Open WhatsApp)"**:
   - The desktop WhatsApp application or WhatsApp Web (`https://wa.me/91XXXXXXXXXX?text=...`) launches in the default browser.
   - The receptionist reviews the text, attaches the saved PDF/photo if desired, and presses send.

---

## 2. Standardized Message Templates

### 2.1 Advance Deposit Receipt (मराठी)
```text
नमस्कार [Guest Name]जी,

आपल्या *[Lodge Name]* मधील मुक्कामाची अ‍ॅडव्हान्स पेमेंट पावती खालीलप्रमाणे आहे:

📄 *पावती क्र:* REC-2611-0001
🔖 *बुकिंग संदर्भ:* STY-4819
🚪 *खोली क्रमांक:* 102
📅 *मुक्काम:* 2026-11-17 ते 2026-11-19 (2 रात्री)
💵 *प्राप्त रक्कम:* ₹1,000.00
⚠️ *बाकी शिल्लक रक्कम:* ₹1,400.00

धन्यवाद!
*[Lodge Name]*
```

### 2.2 Final Checkout Bill (मराठी)
```text
नमस्कार [Guest Name]जी,

आपल्या *[Lodge Name]* मधील मुक्कामाची अंतिम बिल व पावती खालीलप्रमाणे आहे:

📄 *पावती क्र:* FIN-STY-4819
🔖 *बुकिंग संदर्भ:* STY-4819
🚪 *खोली क्रमांक:* 102
📅 *मुक्काम:* 2026-11-17 ते 2026-11-19 (2 रात्री)
💵 *प्राप्त रक्कम:* ₹2,400.00
✅ *शिल्लक रक्कम:* ₹0.00 (पूर्ण चुकते)

धन्यवाद!
*[Lodge Name]*
```

---

## 3. Truthful Delivery Standard

Under the CTO Master Instruction guidelines:
- **No False Claims:** The software never claims *"WhatsApp receipt delivered"* merely because the browser opened a `wa.me` URL. The UI states: *"व्हॉट्सअ‍ॅप उघडा (Open WhatsApp)"*.
- **Attachment Guidance:** A clear contextual notice instructs the receptionist:
  > *"टीप: 'व्हॉट्सअ‍ॅप उघडा' वर क्लिक केल्यावर व्हॉट्सअ‍ॅप ॲप/वेब उघडेल. आपण संदेश पाठवण्यापूर्वी आवश्यक असल्यास पावतीचा फोटो किंवा पीडीएफ फाईल जोडू शकता."*
- **Privacy:** No sensitive PII (Aadhaar number, card CVV, internal ledger notes) is included in the URL.

---

## 4. Phase 2 Roadmap: WhatsApp Business Cloud API

For automated background delivery of signed PDF receipts directly from the server:
1. Register Meta WhatsApp Business Account (WABA).
2. Authorize template message: `stay_payment_receipt_v1`.
3. Dispatch via secure webhook to eliminate manual front-desk interaction.
