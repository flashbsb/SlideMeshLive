# SlideMeshLive — Real-Time Interactive Synchronized HTML Presentation Platform

<div align="center">

[![English](https://img.shields.io/badge/Documentation-English-blue.svg)](./README.md)
[![Português](https://img.shields.io/badge/Documentação-Português-green.svg)](./README.pt-BR.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES_Modules-f7df1e?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
[![Python](https://img.shields.io/badge/Python-3.9+-3776ab?logo=python&logoColor=white)](https://python.org)

**[🇺🇸 Read in English](./README.md)** &nbsp;|&nbsp; **[🇧🇷 Leia em Português](./README.pt-BR.md)**

</div>

> **Decoupled real-time presentation platform** for modern stages and audiences. Built with a high-performance **Presenter Stage** (clean projection, split-screen mode, speaker notes, and moderation), **Control Room / Admin** (remote control, Q&A moderation queue, and executive reporting), and an **Audience Smartphone Interface** (deep-dive content, instant voting, haptic feedback, and moderated Q&A).

---

## 1. Architectural Overview

**SlideMeshLive** was engineered with a modular architecture based on native web standards (**HTML5, Vanilla CSS3, and JavaScript ES Modules**) and a high-performance local Python backend (`server.py`) featuring triple local fallback redundancy (Sequential HTTP Event Hub + BroadcastChannel + Storage Event) achieving sub-50ms synchronization latency on local networks (LAN / Wi-Fi) without external cloud dependencies.

```text
                       PRESENTER (Main Stage / Laptop)
                                      │
                         ┌────────────┴────────────┐
                         │    Presenter Engine     │
                         │                         │
                         │ • Clean & Split Screen  │
                         │ • Pulpit Mode & Timer   │
                         │ • Live Polling Controls │
                         │ • Q&A Questions Wall    │
                         │ • Dynamic QR Code       │
                         └────────────┬────────────┘
                                      │
                     Real-Time Bidirectional Sync
                   Python Hub (/api/sync) / Broadcast
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            ▼                         ▼                         ▼
    🛡️ Control Room (Admin)   📱 Audience Device 1      📱 Audience Device N
   ┌──────────────────────┐  ┌──────────────────┐      ┌──────────────────┐
   │ • Remote Slide Nav   │  │ • Deep Dive Text │      │ • Deep Dive Text │
   │ • 4-Phase Moderation │  │ • Rich Tables    │      │ • Rich Tables    │
   │ • Dynamic QR Host    │  │ • Anonymous Auth │      │ • Anonymous Auth │
   │ • CSV/MD Export      │  │ • Single Vote    │      │ • Single Vote    │
   │ • Stage Analytics    │  │ • Ask Questions  │      │ • Ask Questions  │
   └──────────────────────┘  │ • Haptic Haptics │      │ • Haptic Haptics │
                             └──────────────────┘      └──────────────────┘
```

---

## 2. Business Logic & Security Principles

1. **100% Autonomous Offline Operation (Local Area Network / Wi-Fi)**:
   - Operates completely without internet. The local Python server manages presence heartbeats, single-vote locks, live polls, and audience questions locally.
2. **Free Reading vs. Secure Authenticated Interaction**:
   - The audience can navigate and read all slides, summaries, tables, and diagrams **without any signup or login**.
   - Interactive mutations (voting in polls or submitting questions) use secure participant identity with single-vote locking.
3. **Guaranteed Privacy & Anonymity**:
   - The presenter and other attendees **never see real names or email addresses**.
   - The system generates an anonymous alias for public display (e.g., `Participant #83`).
4. **Strict Single-Vote Lock**:
   - Each participant can vote **only once** per poll. Enforced atomically on both client and server.
5. **4-Phase Q&A Moderation Queue**:
   - Audience questions flow through: `Pending` ➔ `Approved` ➔ `Featured` ➔ `Answered`.
   - The moderator or presenter can **feature any question on the main stage screen** with floating animations.
6. **Rate Limiting & Anti-Abuse (SecurityGuard)**:
   - 25s cooldown between questions and a maximum limit of 3 pending questions per participant.
   - The moderator can suspend abusive participants in a single click.
7. **Session Resilience & Disk State Snapshotting**:
   - The Python server saves atomic disk snapshots (`snapshot_state.json`), preserving votes and questions across unexpected restarts.
8. **Data Export & Executive Reporting**:
   - The control room exports complete session engagement reports in **Structured CSV**, **Executive Markdown**, and **Self-Contained Standalone HTML/PDF Slide Decks**.
9. **Dynamic Audience Pacing Lock**:
   - Intelligent forward navigation lock preventing attendees from peeking ahead of the presenter's stage slide (`lock_future`), preserving narrative surprise and engagement.
   - Allows attendees to freely review past slides while providing real-time dynamic switching (`Free Navigation`, `Future Lock`, `Strict Sync`) from the Control Room or Pulpit.
10. **Pre-Flight Diagnostics, Media Audit & Local Wi-Fi Capacity**:
    - The server statically audits deck assets (`GET /api/diagnostics`), identifying heavy slides (>500KB) and calculating instant burst throughput in MB across 30+ connected smartphones.
    - The Control Room displays a live Health HUD with health score badges, recommended local Wi-Fi attendee capacity, real-time latency monitoring, and resident memory/uptime telemetry.
    - SlideMesh Studio includes a built-in 1-click HTML5 Canvas compressor for Full HD WebP optimization (<300KB).
11. **Cinematic Stage Transitions & GPU-Accelerated Animations**:
    - The clean stage screen supports 5 high-fidelity transition presets accelerated strictly via GPU hardware (`transform` and `opacity` with zero layout reflows): `fade`, `slide` (3D navigation-direction-aware), `zoom`, `dissolve`, and `stagger` (cascading bullet reveals).
    - Fully configurable globally in `manifest.json` (`theme.transition`) and per-slide in `slides.json` (`presenter.transition`) via SlideMesh Studio.
    - Strict WCAG accessibility compliance with instant, graceful motion suppression under `@media (prefers-reduced-motion: reduce)`.

---

## 3. Project Structure

```text
SlideMeshLive/
├── index.html                               # Main Portal / Presentation Catalog
├── import.html                              # SlideMesh Studio (Creation, Import & Editing)
├── docs.html                                # Dynamic Markdown Documentation Viewer
├── server.py                                # Local Python Server with Sequential HTTP Hub
├── README.md                                # Official Documentation (English)
├── README.pt-BR.md                          # Official Documentation (Portuguese)
│
├── css/                                     # Modular Design System
│   ├── base.css                             # HSL Design Tokens, Inter/Mono fonts, 4 visual themes
│   ├── animations.css                       # Transition, pulse, floating, and fade animations
│   ├── components.css                       # Buttons, modals, live poll charts, badges, drawer
│   ├── presenter.css                        # Stage layout, split-screen, and control dock
│   ├── audience.css                         # Mobile-first smartphone layout with haptics
│   └── admin.css                            # Control Room / Moderation Console layout
│
├── js/                                      # JavaScript Architecture (ES Modules)
│   ├── config.js                            # App configuration and environment credentials
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
│   ├── audience/
│   │   └── audience-app.js                  # Audience mobile application controller
│   └── admin/
│       └── admin-app.js                     # Control Room / Moderator controller
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
│   ├── slidemesh-showcase/                  # Official Showcase Presentation
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
- **Presenter Stage:** `http://localhost:8000/presenter/?presentation=slidemesh-showcase&session=SHOWCASE2026`
- **Control Room / Admin:** `http://localhost:8000/admin/?presentation=slidemesh-showcase&session=SHOWCASE2026`
- **Audience Smartphone:** `http://<YOUR_COMPUTER_IP>:8000/audience/?presentation=slidemesh-showcase&session=SHOWCASE2026`

---

## 5. SlideMesh Studio — Web Creation, Import & Editing

**SlideMesh Studio** (`import.html`) is an integrated visual authoring suite accessible from the portal:

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
| `→` / `Space` / `PageDown` | **Next Slide** | Advance to the next slide |
| `←` / `PageUp` | **Previous Slide** | Return to the previous slide |
| `F` | **Fullscreen** | Toggle browser fullscreen mode |
| `P` | **Pulpit Mode** | Reveal private speaker notes and presentation timer |
| `Q` | **Giant QR Code** | Display full-screen central QR Code for audience onboarding |
| `W` | **Toggle Mini QR** | Hide/show the mini QR Code in the projection footer |
| `M` | **Questions Wall** | Open floating wall of moderated audience questions |
| `V` | **Toggle Live Poll** | Open or close voting on the active slide |
| `R` | **Reveal Results** | Show or hide the animated vote chart on the stage |
| `B` | **Blackout Mode** | Blank the stage screen to redirect full audience focus to the speaker |
| `Esc` | **Close Modals** | Close the questions wall or giant QR modal |

---

## 7. Design System & Accessibility

- **4 Modern Visual Themes:** `Dark` (Default), `Light`, `Slate`, and `High Contrast` (WCAG 2.2 AAA).
- **Haptic Touch Feedback:** Native `navigator.vibrate` on smartphone vote casts and question submissions.
- **Tailored Typography:** `Inter` font for text clarity and `JetBrains Mono` for code blocks and metrics.
- **Symmetric i18n:** 100% full instant switching between **Portuguese (pt-BR)** and **English (en-US)**.

---

## 8. License

Distributed under the MIT License. See [LICENSE](LICENSE) for more details.
