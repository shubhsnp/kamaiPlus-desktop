# KAMAI PLUS STAY — USER EXPERIENCE & DESIGN GUIDELINES

**Product:** Kamai Plus Stay  
**Version:** 1.2.0  
**Authority:** UI/UX Director & Hospitality Usability Specialist  
**Last Updated:** November 2026  

---

## 1. Product Design Philosophy

> **"कमीत कमी क्लिक्स. कमीत कमी टायपिंग. शून्य गोंधळ. जास्तीत जास्त काम."**  
> *(Minimum clicks. Minimum typing. Zero confusion. Maximum work completed.)*

Our users are Indian lodge owners and front-desk receptionists who may:
- Have limited computer literacy.
- Be accustomed to physical paper registers.
- Feel comfortable primarily in Marathi.
- Need to check in guests quickly at odd hours.

Every screen must immediately answer three questions:
1. **What am I looking at?**
2. **What should I do next?**
3. **How do I know the operation succeeded?**

---

## 2. Mandatory Interaction Standards

### 2.1 The Minimum-Click Rule
- Common operations must be achievable directly from the primary view.
- Available room cards must feature a direct `+ चेक-इन (Quick Check-in)` action.
- Occupied room cards must feature a direct `बिल व चेक-आउट (Bill & Checkout)` action.
- Cleaning room cards must feature a direct `✓ सफाई झाली (Mark Cleaned)` action.

### 2.2 Self-Explaining Input Fields
Every input field must provide immediate contextual clarity:
- **Label:** Clear, non-technical label in Marathi and English.
- **Placeholder:** Showing a concrete example (e.g. `उदा. सचिन कुलकर्णी`, `९८२२०१२३४५`, `१२००`).
- **Guidance Text:** Short subtext explaining how the value is used.
- **Error Preservation:** If validation fails, entered values must NEVER be wiped.

### 2.3 Semantic Color System
| Meaning | Status | Tailwind Colors | Visual Purpose |
|---|---|---|---|
| **Available** | `available` | Emerald / Green (`bg-emerald-50 border-emerald-300 text-emerald-800`) | Ready for guest check-in |
| **Occupied** | `occupied` | Rose / Red (`bg-rose-50 border-rose-300 text-rose-800`) | In-house guest staying |
| **Cleaning** | `cleaning` | Amber / Orange (`bg-amber-50 border-amber-300 text-amber-800`) | Needs housekeeping attention |
| **Maintenance** | `maintenance` | Slate / Gray (`bg-slate-100 border-slate-300 text-slate-700`) | Out of order / under repair |

### 2.4 Human-Friendly Empty States
Never display technical errors like *"Record not found in indexedDB"*.
- Empty Bookings: *"अद्याप कोणतेही बुकिंग नाही. नवीन बुकिंग तयार करण्यासाठी वर क्लिक करा."*
- Empty Rooms: *"अद्याप खोल्या जोडल्या नाहीत. लॉज व्यवस्थापनासाठी खोल्या जोडा."*
- Empty Payments: *"या मुक्कामासाठी अद्याप कोणतेही पेमेंट नोंदवले नाही."*

---

## 3. Accessibility & Layout Rules

1. **Touch & Desktop Sizing:** All clickable buttons, inputs, and category cards must have a minimum target height of `40px` (ideally `44px`).
2. **Typography:** Key numbers (Room number, Amount in Rupees, Receipt Number) must be displayed in bold 16px–24px fonts for easy readability from 2 feet away.
3. **No Marathi Truncation:** Label containers must use flexible layouts (`whitespace-normal` or `min-w-fit`) to prevent Marathi Unicode characters and matras from being cut off.
