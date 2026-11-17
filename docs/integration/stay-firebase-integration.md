# KAMAI STAY — FIREBASE INTEGRATION SPECIFICATION

**Document:** `docs/integration/stay-firebase-integration.md`  
**Purpose:** Architecture for synchronizing Stay data to Cloud Firestore while maintaining complete tenant and upstream isolation.  
**Last Updated:** November 2026  

---

## 1. Upstream Cloud Architecture Alignment

Kamai Plus defines an enterprise multi-tenant cloud standard in `docs/CLOUD_DATA_CONTRACT.md`.
Stay adheres 100% to this cloud standard:

```text
Firestore Root:
└── businesses/
    └── {bizId}/                       # bizId = "biz_" + Firebase UID
        ├── stay_rooms/                # Room records
        ├── stay_room_types/           # Category configurations
        ├── stay_bookings/             # Reservation & walk-in entities
        ├── stay_guests/               # Guest CRM profiles
        ├── stay_folios/               # Stay financial ledgers
        ├── stay_payments/             # Individual payment & refund records
        └── stay_housekeeping/         # Cleaning & maintenance tasks
```

---

## 2. Independent Development Firebase Environment

During independent development, Kamai Stay executes against an independent Firebase development project:

| Component | Independent Dev Project | Upstream Production Project | Integration Strategy |
|---|---|---|---|
| **Project ID** | `kamai-stay-dev` | `kamaiplus` | Kept separate in `.env.local` |
| **Firestore Database** | Isolated dev instance | Live production Firestore | Maps identical path schemas |
| **Authentication** | Dev Google OAuth client | Upstream Google OAuth client | Swapped via environment variables |
| **Hosting (Updates)** | Dev hosting channel | `kamaiplus-desktop.web.app` | Preserved untouched in `firebase.json` |

---

## 3. Firestore Security Rules Blueprint

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Multi-tenant business isolation rule
    match /businesses/{bizId} {
      allow read, write: if request.auth != null && request.auth.uid == bizId.replace('biz_', '');
      
      // Stay subcollections inherit tenant boundary
      match /stay_rooms/{roomId} {
        allow read, write: if request.auth != null && request.auth.uid == bizId.replace('biz_', '');
      }
      match /stay_bookings/{bookingId} {
        allow read, write: if request.auth != null && request.auth.uid == bizId.replace('biz_', '');
      }
      match /stay_folios/{folioId} {
        allow read, write: if request.auth != null && request.auth.uid == bizId.replace('biz_', '');
      }
      match /stay_payments/{paymentId} {
        allow read, write: if request.auth != null && request.auth.uid == bizId.replace('biz_', '');
      }
    }
  }
}
```
