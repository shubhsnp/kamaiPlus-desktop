# Kamai Plus Stay — UI Component Standard

---

## 1. Overview

Kamai Plus Stay adheres strictly to the existing Kamai Plus design system (Next.js, Tailwind CSS, Lucide icons, Inter/system font typography). All touch targets are optimized for counter receptionists using desktop mouse or touch laptops.

---

## 2. Reusable Stay UI Component Inventory

### 2.1 `StayDatePicker` (`src/components/stay/ui/StayDatePicker.tsx`)
- **Purpose**: Calendar popup date selector replacing plain HTML `<input type="date">`.
- **Features**:
  - Month and year navigation (`<` / `>`).
  - Day names translated in Marathi (रवि, सोम, मंगळ, बुध, गुरु, शुक्र, शनि) and English (Sun, Mon, Tue...).
  - Today date highlighted (`bg-violet-50 text-violet-700`).
  - Selected date highlighted with solid violet (`bg-violet-600 text-white`).
  - MinDate and MaxDate constraints (past dates disabled for check-in).
  - Quick Presets: "आज (Today)", "उद्या (Tomorrow)", "+2 Nights", "+3 Nights".
  - Click outside detection.

### 2.2 `StayTimePicker` (`src/components/stay/ui/StayTimePicker.tsx`)
- **Purpose**: Hospitality hour selector replacing manual text typing.
- **Features**:
  - 12-hour AM/PM visual buttons.
  - Hour grid (1 to 12) & Minute grid (00, 15, 30, 45).
  - Quick Presets: "12:00 PM (Standard Check-in)", "11:00 AM (Standard Check-out)", "Now (सध्याची वेळ)".
  - Formats internally as 24-hour "HH:mm".

### 2.3 `RoomCategorySelector` (`src/components/stay/ui/RoomCategorySelector.tsx`)
- **Purpose**: Visual card category selector preventing selection desync.
- **Features**:
  - Card view showing Category Name, Code, Rack Rate, and Live Available Count.
  - Active checkmark on selection.
  - Inline **"+ प्रमाणित प्रकार तयार करा (Seed Standard Categories)"** button when 0 categories exist.

### 2.4 `StayStatusBadge` (`src/components/stay/ui/StayStatusBadge.tsx`)
- **Purpose**: Semantic color-coded badges for room and booking statuses.
- **Color Standards**:
  - Available (उपलब्ध): `bg-emerald-100 text-emerald-800 border-emerald-300`
  - Occupied (व्यापलेले): `bg-rose-100 text-rose-800 border-rose-300`
  - Reserved (राखीव): `bg-amber-100 text-amber-800 border-amber-300`
  - Cleaning (स्वच्छता): `bg-sky-100 text-sky-800 border-sky-300`
  - Maintenance (दुरुस्ती): `bg-slate-100 text-slate-800 border-slate-300`
  - Out of Service: `bg-red-100 text-red-900 border-red-300`
