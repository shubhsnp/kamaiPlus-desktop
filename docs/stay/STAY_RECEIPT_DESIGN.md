# KAMAI PLUS STAY — RECEIPT DESIGN & PRINTING SPECIFICATIONS

**Product:** Kamai Plus Stay  
**Version:** 1.2.0  
**Authority:** UI/UX Director & Hospitality Systems Architect  
**Last Updated:** November 2026  

---

## 1. Supported Print Formats

Kamai Plus Stay supports two distinct receipt formats configured via an instant toggle on the receipt modal:

| Format | Target Hardware | CSS / Layout Width | Best Use Case |
|---|---|---|---|
| **Standard (A4 / Letter)** | Laser / Inkjet Printer | `max-w-xl` (100% printable paper view) | Corporate guests, GST filing, official lodge register records |
| **Thermal (80mm / 3-inch)** | POS Thermal Receipt Printer (USB / Bluetooth / Network) | `max-w-[340px]` font-mono | Fast front-desk checkout, budget lodges, low-cost paper roll |

---

## 2. Receipt Field Specification

Every receipt generated across `PaymentReceiptModal.tsx` and `FinalReceipt.tsx` adheres to the following layout:

```text
+-------------------------------------------------------+
|                    HOTEL PARAS INN                    |
|             Station Road, Kolhapur - 416001           |
|                 Phone: +91 98220 12345                |
|                                                       |
|             [ ADVANCE DEPOSIT RECEIPT ]               |
+-------------------------------------------------------+
| Receipt No: REC-2611-0001     Date: 2026-11-17 10:30  |
| Guest Name: Sachin Kulkarni   Room: 102               |
| Phone:      9822012345        Booking: STY-4819       |
| Stay:       2026-11-17 to 2026-11-19 (2 Nights)       |
+-------------------------------------------------------+
|                                                       |
|                 AMOUNT RECEIVED (प्राप्त रक्कम)        |
|                       ₹1,000.00                       |
|                 [ UPI - Ref: 439201928312 ]           |
|                                                       |
+-------------------------------------------------------+
| Total Estimated Charges:                     ₹2,400.00 |
| Total Amount Received:                       ₹1,000.00 |
| Balance Due (बाकी रक्कम):                     ₹1,400.00 |
+-------------------------------------------------------+
| Thank you for your visit! (मुक्कामासाठी धन्यवाद!)     |
| Computer generated receipt. Valid without signature.  |
+-------------------------------------------------------+
```

---

## 3. Print Styling & CSS Optimization

1. **Clean Screen vs Print Separation:**
   All navigation buttons, close buttons, format toggles, and WhatsApp trigger pills carry the Tailwind `print:hidden` class, ensuring they never appear on physical paper.
2. **Page Break Rules:**
   - `page-break-inside: avoid` on the totals block and header.
   - Thermal mode uses pure monochrome black/white typography with zero gray borders for high thermal print contrast.
3. **Receipt Number Generation:**
   - Advance / Partial / Refund Receipts: `REC-[UUID_SHORT]` (e.g. `REC-4A8F9B2C`).
   - Final Settlement Receipts: `FIN-[BOOKING_REF]` (e.g. `FIN-STY-4819`).
   - Guarantees zero duplicate receipt numbers.
