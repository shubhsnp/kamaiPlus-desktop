# Cost and Dependency Register

## Dependency priority
1. Reuse current app shell, admin control, feature switches, and local database patterns.
2. Reuse existing print, WhatsApp, reporting, and cloud sync infrastructure where relevant.
3. Add new Stay-specific domain models only where required.
4. Consider external services only after cost/approval review.

## Existing dependencies already used by the repo
- Next.js / React / TypeScript / Tailwind
- Electron + electron-builder
- Dexie + IndexedDB
- Firebase (optional)
- jsPDF / html2canvas / xlsx
- lucide-react

## Proposed Stay-specific dependencies
Keep the initial dependency set minimal. Prefer open-source and existing dependencies over new vendor services.

### Likely dependencies for later phases
- date/time utilities for booking calendars and room occupancy
- localization support for Marathi text if not already covered by the existing i18n layer
- optional local NLP library for rule-based Marathi assistant if needed

### External services requiring approval before use
- any paid WhatsApp or OTA integration
- paid AI assistant or NLP service
- payment gateway integrations
- direct booking / channel manager APIs
- cloud backups beyond existing app patterns

## Cost-control principles
- do not assume free APIs are available
- do not send guest data to external AI without explicit policy control
- do not add paid services to enable core Stay operations until the business case is approved
- prefer local, rule-based logic over external intelligence in the early phases

## Conclusion
The repo already contains most of the platform infrastructure needed to build Stay on a low-cost basis. The most important discipline is to avoid introducing paid services or new app layers before the initial sub-module is proven and approved.
