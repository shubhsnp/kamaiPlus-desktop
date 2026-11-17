# KAMAI PLUS STAY — USER ACCEPTANCE TESTING (UAT) SCENARIOS

**Product:** Kamai Plus Stay  
**Version:** 1.2.0  
**Authority:** QA Lead & Hospitality Operations Consultant  
**Last Updated:** November 2026  

---

## 1. UAT Execution Scenarios

### Scenario 1: Standard Cash Walk-in (Late Night Arrival)
- **Actor:** Night Receptionist.
- **Story:** Guest walks in at 11:30 PM requesting a standard AC room for 1 night. Tariff is ₹1,200. Guest hands over ₹500 cash advance.
- **Steps:**
  1. Click `+ चेक-इन` on green Room 101 card.
  2. Enter Mobile `9822011111` and Name `Rahul Sharma`.
  3. Enter Advance `500` under Cash.
  4. Click `चेक-इन पूर्ण करा`.
- **Expected Outcome:**
  - Advance Deposit Receipt modal opens showing `प्राप्त रक्कम: ₹500.00`, `बाकी: ₹700.00`.
  - Room 101 turns red (`Occupied`).
  - Total operational time < 40 seconds.

### Scenario 2: UPI Walk-in with WhatsApp Receipt Sharing
- **Actor:** Day Receptionist.
- **Story:** Guest pays full stay of ₹2,400 via PhonePe/GPay QR code and requests receipt on WhatsApp.
- **Steps:**
  1. Open `+ नवीन वॉक-इन`.
  2. Select 2 nights, enter guest details.
  3. Select Payment Method `UPI / QR कोड`, enter UTR `439201928312`.
  4. Submit check-in.
  5. In receipt modal, click `व्हॉट्सअ‍ॅप (WhatsApp)`.
  6. Confirm guest number and click `व्हॉट्सअ‍ॅप उघडा`.
- **Expected Outcome:**
  - Pre-filled Marathi WhatsApp receipt message loads in browser.
  - Zero balance due indicated.

### Scenario 3: Returning Guest Phone Autocomplete
- **Actor:** Receptionist.
- **Story:** Regular guest `Sachin Kulkarni` visits again.
- **Steps:**
  1. Type `9822012345` in phone field.
- **Expected Outcome:**
  - Guest name auto-fills as `सचिन कुलकर्णी` without re-typing.

### Scenario 4: Mid-Stay Room Service Charge & Folio Inspection
- **Story:** Guest in Room 102 orders extra mattress and tea (₹350).
- **Steps:**
  1. Open Room 102 Folio from Room Rack or Checkout page.
  2. Click `खर्च जोडा (Add Charge)`.
  3. Enter Description `Extra Bed & Tea`, Amount `350`.
- **Expected Outcome:**
  - Folio total updates immediately to ₹350 higher in integer paise.
  - Balance due recalculates in real time.

### Scenario 5: Early Checkout with Excess Advance Refund
- **Story:** Guest booked 3 nights with full advance of ₹3,600, but checks out after 1 night (₹1,200). Lodge refunds ₹2,400 in cash.
- **Steps:**
  1. Open Folio for the booking.
  2. Click `रिफंड / परतावा (Issue Refund)`.
  3. Enter `2400`, Method `Cash`, Reason `Guest departed 2 days early`.
  4. Submit refund.
- **Expected Outcome:**
  - Refund receipt `REC-XXXXXXXX` generated.
  - Negative credit posted to folio; net balance due reconciled to ₹0.00.

### Scenario 6: Express Checkout & 80mm Thermal Receipt
- **Story:** Guest ready to leave. Pays remaining ₹700 balance via card.
- **Steps:**
  1. Click `बिल व चेक-आउट` on Room 101 card.
  2. Select Card, enter `700`, click `पेमेंट जमा करा आणि चेक-आउट पूर्ण करा`.
  3. In receipt modal, toggle `थर्मल (80mm)`.
  4. Click `प्रिंट करा`.
- **Expected Outcome:**
  - Clean thermal layout prints.
  - Room 101 switches automatically to Amber (`Cleaning Required`).
  - Appears on Housekeeping Board.

### Scenario 7: Housekeeping Turnover
- **Story:** Housekeeper finishes cleaning Room 101.
- **Steps:**
  1. Open Housekeeping Board.
  2. Click `सफाई पूर्ण झाली (Mark Cleaned)`.
- **Expected Outcome:**
  - Room status returns to `available` (Green).
  - Ready for immediate walk-in on Room Rack.
