# SlideMeshLive — Real-Time Interactive Synchronized HTML Presentation Platform

<div align="center">

[![English](https://img.shields.io/badge/Documentation-English-blue.svg)](./README.md)
[![Português](https://img.shields.io/badge/Documentação-Português-green.svg)](./README.pt-BR.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES_Modules-f7df1e?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
[![Python](https://img.shields.io/badge/Python-3.9+-3776ab?logo=python&logoColor=white)](https://python.org)

**[🇺🇸 Read in English](./README.md)** &nbsp;|&nbsp; **[🇧🇷 Leia em Português](./README.pt-BR.md)**

</div>

> **Decoupled real-time presentation platform** for modern stages and audiences. Built with a high-performance **Presenter Stage** (clean projection, speaker notes, live polling, and moderation) and an **Audience Smartphone Interface** (deep-dive content, instant voting, and moderated Q&A).

---

## 1. Architectural Overview

The platform uses native web standards (**HTML5, Vanilla CSS3, and JavaScript ES Modules**) backed by a high-efficiency local Python sequential event hub (`server.py`) or cloud **Firebase** (Hosting, Authentication, and Realtime Database). It features triple local fallback redundancy (Sequential HTTP Hub + BroadcastChannel + Storage Event) achieving sub-50ms synchronization latency.

```text
                       PRESENTER (Main Stage / Laptop)
                                      │
                         ┌────────────┴────────────┐
                         │    Presenter Engine     │
                         │                         │
                         │ • Clean Stage View      │
                         │ • Private Speaker Notes │
                         │ • Live Polling Controls │
                         │ • Q&A Moderation Queue  │
                         │ • Dynamic QR Code       │
                         └────────────┬────────────┘
                                      │
                     Real-Time Bidirectional Sync
                   Python Hub (/api/sync) / Broadcast
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            ▼                         ▼                         ▼
    📱 Audience Device 1      📱 Audience Device 2      📱 Audience Device N
   ┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
   │ • Deep Dive Text │      │ • Deep Dive Text │      │ • Deep Dive Text │
   │ • Rich Tables    │      │ • Rich Tables    │      │ • Rich Tables    │
   │ • Anonymous Auth │      │ • Anonymous Auth │      │ • Anonymous Auth │
   │ • Single Vote    │      │ • Single Vote    │      │ • Single Vote    │
   │ • Ask Questions  │      │ • Ask Questions  │      │ • Ask Questions  │
   └──────────────────┘      └──────────────────┘      └──────────────────┘
```

---

## 2. Business Logic & Security Principles

1. **Free Reading vs. Authenticated Interaction**:
   - The audience can navigate and read all slides, summaries, tables, and diagrams **without any login**.
   - Actions that mutate state (voting in polls or submitting questions) require instant, seamless authentication.
2. **Guaranteed Privacy & Anonymity**:
   - The presenter and other attendees **never see real names or email addresses**.
   - The system generates an anonymous alias for public display (e.g., `Participant #42`).
3. **Strict Single-Vote Lock**:
   - Each participant can vote **only once** per poll. Enforced atomically on both client and server.
4. **Real-Time Q&A Moderation Queue**:
   - Submitted questions enter a control room moderation queue (`Pending`, `Approved`, `Answered`, `Featured`).
   - The presenter can **feature any question on the main stage screen** with floating animations.
5. **Rate Limiting & Anti-Abuse**:
   - 25s cooldown between questions and a maximum limit of 3 pending questions per participant.
   - The moderator can ban abusive participants in a single click.
6. **Session Lifecycle & Clean Shutdown**:
   - Closing the session via `[ 🛑 End Session ]` locks the presentation and disables further votes and questions.

---

## 3. Project Structure

```text
SlideMeshLive/
├── index.html                               # Portal / Presentation Catalog
├── import.html                              # SlideMesh Studio (Creation, Import & Editing)
├── docs.html                                # Dynamic Markdown Documentation Viewer
├── server.py                                # High-Performance Local Python Event Hub
├── README.md                                # Official Documentation (English)
├── README.pt-BR.md                          # Official Documentation (Portuguese)
│
├── css/                                     # Modular Design System
│   ├── base.css                             # HSL Design Tokens, Inter/Mono fonts, visual themes
│   ├── animations.css                       # Transition, pulse, and fade animations
│   ├── components.css                       # Buttons, modals, live poll charts, badges
│   ├── presenter.css                        # Stage layout, split-screen, and control dock
│   └── audience.css                         # Mobile-first smartphone layout
│
├── js/                                      # JavaScript Architecture (ES Modules)
│   ├── config.js                            # App configuration and Firebase credentials
│   ├── core/                                # Core Engine Subsystems
│   │   ├── presentation-engine.js           # Dynamic slide loader and HTML renderer
│   │   ├── realtime-engine.js               # Real-time synchronization (LAN Hub + Local)
│   │   ├── conversion-engine.js             # Semantic PPTX/DOCX/MD/PDF converter & templates
│   │   ├── i18n-engine.js                   # Symmetric Internationalization (en-US / pt-BR)
│   │   ├── theme-engine.js                  # Theme engine (Dark, Light, Slate, High Contrast)
│   │   ├── session-manager.js               # State snapshot manager and CSV/MD export
│   │   ├── auth-engine.js                   # Secure participant identity management
│   │   ├── interaction-engine.js            # Live polls, single-vote lock, and tallying
│   │   ├── moderation-engine.js             # Q&A moderation queue and stage projection
│   │   ├── security-guard.js                # Rate limiting, anti-abuse, and session limits
│   │   └── qr-engine.js                     # Dynamic QR Code generation
│   ├── presenter/
│   │   └── presenter-app.js                 # Presenter stage controller
│   └── audience/
│       └── audience-app.js                  # Audience mobile application controller
│
├── presenter/                               # Presenter Stage Environment
│   └── index.html                           # Main Stage Screen + Shortcut Controller
│
├── admin/                                   # Moderator & Control Room Environment
│   └── index.html                           # Live Moderation Console, Polling, & Remote Control
│
├── audience/                                # Audience Environment
│   └── index.html                           # Mobile Smartphone Interface
│
├── presentations/                           # Presentations Storage Directory
│   ├── catalog.json                         # Central registry of available presentations
│   ├── slidemesh-showcase/                  # Interactive Showcase Presentation
│   └── treinamento-interno-pin/             # PIN-Protected Technical Presentation
│
└── tools/                                   # Command-Line Utilities
    └── import_presentation.py               # CLI presentation import tool
```

---

## 4. Quick Start (Local Execution)

### 4.1 Prerequisites
- Python 3.8+ installed.
- Modern web browser (Chrome, Edge, Firefox, Safari).

### 4.2 Run in 1 Command
Run the server inside the project root:

```bash
cd /home/flashbsb/projetos/SlideMeshLive
python3 server.py
```

The terminal will display the local and Wi-Fi network endpoints:
- **Main Portal:** `http://localhost:8000/`
- **SlideMesh Studio:** `http://localhost:8000/import.html`
- **Presenter Stage:** `http://localhost:8000/presenter/?presentation=slidemesh-showcase`
- **Control Room / Admin:** `http://localhost:8000/admin/?presentation=slidemesh-showcase`
- **Audience Smartphone:** `http://<YOUR_COMPUTER_IP>:8000/audience/?presentation=slidemesh-showcase`

---

## 5. SlideMesh Studio — Web Creation, Import & Editing

**SlideMesh Studio** is an integrated visual authoring suite accessible from the portal or directly at [`import.html`](http://localhost:8000/import.html):

### 5.1 Create a Presentation from Scratch (with Templates)
1. On the main portal, click **`✨ Create New`** (or open `import.html?mode=new`).
2. Choose from 4 structured templates:
   - **👔 Executive & Pitch:** 5 slides (Cover, Challenge, Solution, Live Validation Poll, Next Steps).
   - **🎓 Class & Training:** 4 slides (Objectives, Conceptual Architecture, Live Quiz, Study Summary).
   - **🚀 Product Demo:** 4 slides (Overview, Innovative Features, Live Voting, Closing).
   - **📄 Blank Canvas:** 1 clean slide for complete authoring freedom.
3. Edit titles, bullets, speaker notes, audience summaries, and detailed sections in real time with auto-save to `localStorage`.
4. Upload images to enable the **Split-Screen (2 columns)** layout on the stage screen.
5. Click **`🚀 Publish Presentation`**.

### 5.2 Edit Existing Presentations
1. On the main portal, find the presentation card and click **`✏️ Edit`**.
2. The Studio loads all slides, polls, and notes automatically.
3. Modify any content, add new slides, reorder sequence (`🔼` / `🔽`), exclude slides (`☑️`), or convert slides into live polls (`⚡`).
4. Click **`💾 Save Changes`** to atomically update files on the server.

### 5.3 Import External Documents
1. In the Studio, switch to the **`📁 Import File`** tab.
2. Drag and drop any **PowerPoint (`.pptx`)**, **Word (`.docx`)**, **Markdown (`.md`)**, **HTML (`.html`)**, or **PDF (`.pdf`)** file.
3. The semantic engine extracts headlines, bullets, speaker notes, and embedded media.
4. Review side-by-side and publish with 1 click.

### 5.4 Command-Line Interface (CLI)
You can also import presentations and documents via terminal:
```bash
# Import a PowerPoint deck (.pptx)
python3 tools/import_presentation.py my_decks/architecture.pptx --title "Cloud Architecture"

# Import a Word document (.docx)
python3 tools/import_presentation.py docs/handbook.docx --title "Network Handbook"

# Import Markdown notes (.md) with custom session code and PIN security
python3 tools/import_presentation.py notes.md --session LIVE2026 --security pin
```

---

## 6. Presenter Stage Keyboard Shortcuts

| Key | Action | Description |
| :--- | :--- | :--- |
| `→` / `Space` | **Next Slide** | Advance to the next slide |
| `←` | **Previous Slide** | Return to the previous slide |
| `V` | **Toggle Live Poll** | Open or close voting on the current slide |
| `R` | **Reveal Results** | Show or hide the animated vote chart on the stage |
| `Z` | **Reset Votes** | Clear votes for the active poll |
| `Q` | **Giant QR Code** | Display full-screen QR Code for audience onboarding |
| `M` | **Questions Wall** | Open floating wall of moderated audience questions |
| `P` | **Pulpit Mode** | Reveal private speaker notes |
| `F` | **Fullscreen** | Toggle browser fullscreen mode |

---

## 7. License

Distributed under the MIT License. See [LICENSE](LICENSE) for more details.
