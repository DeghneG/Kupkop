# KupKop (kup·kop)

> **Mobile-web network for street animal emergencies.**  
> Fast, camera-verified emergency dispatch, single-responder claim locking, and 14-day clinic recovery tracking.

---

## 🐾 What is KupKop?

In the Philippines and many urban centers, street animals (*aspins* and *puspins*) face critical emergencies—hit-and-runs, severe fractures, abuse, or poisoning. Existing response efforts are often scattered across messy social media posts with stale photos, unverified locations, and duplicate or abandoned rescue attempts.

**KupKop** is designed for the high-stress reality of street emergencies:
- **Fast:** A citizen can file an emergency report in under 15 seconds.
- **Verifiable:** Eliminates stale or fabricated posts through live camera verification and server timestamps.
- **Coordinated:** Prevents overlapping volunteer runs through single-responder claim locks.
- **Accountable:** Tracks admitted animals with an automatic 14-day clinic inactivity clock.

---

## ⚡ Core Pillars

### 1. Emergency SOS
- **Live Camera Only:** No camera roll or gallery uploads—ensures the animal is physically present right now.
- **GPS Coordinates & Server Timestamps:** Location locked with server-side time tracking (`now()`) to prevent stale reports.
- **High-Contrast, 3-Tap Flow:** Large emergency touch targets built for one-handed use outdoors in glaring sun or night conditions.

### 2. Live Feed & Single-Responder Claim Lock
- **Realtime Dispatch:** Local nearby feed triaged by severity (*Hit-and-Run / Bleeding*, *Fracture*, *Trapped / Abused*, *Sick / Mange*).
- **Claim Lock:** When an authorized volunteer or facility claims a case, it locks instantly so multiple responders don't duplicate travel or medical costs.
- **Automated Escalation:** Tunable escalation ladder widens dispatch radius if a critical case has no responder.

### 3. 14-Day Facility Clock
- **Intake & Recovery Tracking:** Once admitted, facilities log updates as animals transition from *Admitted* ➔ *Healing* ➔ *Resolved*.
- **Inactivity Warning:** Cases without updates within 14 days flip to *Overdue*, protecting animals from neglect.

### 4. Rafa — First-Aid & Emergency Assistant
- **Calm, Warm First-Aid Helper:** Powered by the Google Gemini API.
- **Bilingual:** Speaks fluent English and Filipino (*Tagalog*).
- **Safety First:** Strict guardrails—guides users on keeping a safe distance, stopping bleeding, and keeping animals warm, while strictly refusing human drug dosages or unqualified diagnoses.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [Next.js](https://nextjs.org/) (App Router, Turbopack) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) (Semantic system tokens, daylight light mode & OLED dark mode) |
| **Database & Auth** | [Supabase](https://supabase.com/) (PostgreSQL with strict Row-Level Security, Storage, Email & Google Auth) |
| **AI Assistant** | [Google Gemini API](https://ai.google.dev/) (Rafa emergency first-aid triage) |
| **Motion** | [GSAP](https://gsap.com/) & `@gsap/react` (Accessible, transform/opacity only, respects `prefers-reduced-motion`) |

---

## 🔒 Roles & Security Model

KupKop enforces strict multi-role permission boundaries in PostgreSQL via Row-Level Security (RLS):

- **Citizen:** Can submit live SOS emergencies, view public feeds, and chat with Rafa. Cannot claim cases or approve credentials.
- **Volunteer:** Verified by admins; can claim active incidents and submit on-scene updates.
- **Facility:** Listed clinics and shelters; can admit claimed animals and manage 14-day recovery logs.
- **Admin:** Manages role applications, case escalations, and system integrity.

*Users can never change or escalate their own roles.*

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Google Gemini API](https://aistudio.google.com/) key

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/Kupkop.git
cd Kupkop

# Install dependencies
npm install

# Setup environment variables
cp .env.local.example .env.local
```

Fill in your `.env.local` credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
GEMINI_API_KEY=your-gemini-api-key
```

### Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser (or use responsive device mode at 390px / 430px for the mobile experience).

---

## 📌 Development Roadmap

- [x] **Phase 0: Setup & Prototype** — App shell, Apple System tokens, zero-flash dark theme, Supabase schema & RLS policies, Auth callback & modal.
- [ ] **Phase 1: SOS Flow** — Live camera capture constraint, GPS acquisition, 3-tap submission.
- [ ] **Phase 2: Feed & Claim Lock** — Realtime subscription, claim race resolution, escalation timers.
- [ ] **Phase 3: Clinic Tracking** — 14-day inactivity countdown, status transitions.
- [ ] **Phase 4: Rafa AI** — `/api/chat` route, safety guardrails, offline first-aid cards.
- [ ] **Phase 5: Bystander & Admin Flags** — Plate photo blurring, volunteer verification queue.
- [ ] **Phase 6: Outdoor Field Testing** — Real-phone sunlight usability tests.

---

## 📄 License

Prototype built for street animal welfare. All rights reserved.
