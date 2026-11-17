# Kamai Plus Stay — Validation Standard

---

## 1. Guiding Philosophy

1. **Inline Field Placement**: Error messages appear directly underneath the affected input, not in an abstract list at the top of the dialog.
2. **Actionable Suggestions**: Never state merely *"Invalid input"*; tell the operator exactly what to do (e.g. *"कृपया पाहुण्याचा वैध १०-अंकी मोबाईल नंबर प्रविष्ट करा"*).
3. **Data Preservation**: Validation errors never wipe previously entered data.
4. **Bilingual Messages**: All messages originate from `src/lib/stay/validationMessages.ts` and support Marathi (`mr`) and English (`en`).

---

## 2. Standard Validation Rules & Messages

| Field | Validation Rule | Marathi Message | English Message |
|---|---|---|---|
| **Category** | Required, non-empty ID | कृपया खोलीचा प्रकार निवडा (उदा. Deluxe AC, Double) | Please select a room category (e.g. Deluxe AC, Double) |
| **Check-in Date** | Required, valid YYYY-MM-DD, >= today | कृपया चेक-इन तारीख निवडा | Please select a check-in date |
| **Check-out Date** | Required, valid YYYY-MM-DD, > check-in | चेक-आउट तारीख ही चेक-इन तारखेनंतरची असणे आवश्यक आहे | Check-out date must be strictly after the check-in date |
| **Guest Name** | Required, trimmed length >= 2 chars | कृपया पाहुण्याचे पूर्ण नाव प्रविष्ट करा | Please enter the guest full name |
| **Guest Phone** | Required, 10 to 15 digits | कृपया पाहुण्याचा वैध १०-अंकी मोबाईल नंबर प्रविष्ट करा | Please enter a valid 10-digit mobile number for the guest |
| **Room Number** | Required, unique within business | कृपया खोली क्रमांक प्रविष्ट करा (उदा. 101, 204) | Please enter a room number (e.g. 101, 204) |
| **Tariff** | Non-negative integer paise | दर शून्य किंवा त्याहून अधिक वैध रक्कम असावा | Tariff must be a valid non-negative amount |
| **Advance Payment** | <= Total estimated bill | आगाऊ रक्कम एकूण बिलापेक्षा जास्त असू शकत नाही | Advance payment cannot exceed the total estimated bill |
| **Room Availability** | Overlapping confirmed booking check | निवडलेली खोली या तारखांसाठी आधीच बुक केलेली आहे | The selected room is already booked for these dates |
