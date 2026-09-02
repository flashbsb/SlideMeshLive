# Contributing to SlideMeshLive

Thank you for your interest in contributing to **SlideMeshLive**! 🎉

We welcome contributions of all kinds: bug reports, documentation improvements, new interactive features, UI/UX enhancements, and translation refinements.

---

## 🛠️ Getting Started

### Prerequisites
- **Python:** 3.9 or higher (standard library with optional `livereload`).
- **Node.js:** v18+ (for local live-server dev tooling, optional).
- **Web Browser:** Modern browser supporting ES6 Modules, CSS Custom Properties, and BroadcastChannel/WebRTC.

### Local Setup
1. **Clone the repository:**
   ```bash
   git clone https://github.com/flashbsb/SlideMeshLive.git
   cd SlideMeshLive
   ```
2. **Start the local server:**
   ```bash
   # Python server (recommended with Gatekeeper API & full backend support)
   python3 server.py --port 8080

   # Or via npm
   npm run py
   ```
3. **Run the initial setup wizard (if `config/security.json` does not exist):**
   Navigate to `http://localhost:8080/setup.html` in your browser, or run:
   ```bash
   python3 server.py --setup
   ```

---

## 🧪 Testing Guidelines

Before opening a Pull Request, **all automated tests must pass 100%**:

```bash
# Run the complete test suite
python3 tests/test_suite.py

# Or via npm
npm test
```

When adding new features or fixing bugs:
- Add corresponding unit/integration test assertions in `tests/test_suite.py`.
- Ensure tests clean up any temporary directories or test archives.

---

## 📐 Coding Standards & Architecture

1. **Frontend:**
   - Pure **Vanilla JavaScript** (ES6 Modules). Avoid heavy runtime frameworks or bundler dependencies.
   - Standard **Vanilla CSS** with design tokens and CSS Variables in `css/base.css` and `css/components.css`.
   - Accessible, semantic HTML5 with descriptive IDs and ARIA attributes.
2. **Backend:**
   - Clean, dependency-light Python (`server.py`) leveraging standard library modules (`http.server`, `socketserver`, `json`, `urllib`, `zipfile`, `hashlib`, `hmac`).
   - Secure-by-default HTTP endpoints with Path Traversal protection, Zip Slip guards, and MIME-type validation.
3. **Internationalization (i18n):**
   - Keep translation keys symmetrical in `js/core/i18n-engine.js` across `pt-BR` and `en-US`.

---

## 🌿 Git & Commit Conventions

We follow **Conventional Commits**:
- `feat(...)`: A new feature or capability.
- `fix(...)`: A bug fix.
- `docs(...)`: Documentation updates.
- `style(...)`: Formatting, whitespace, UI styling tweaks without logic changes.
- `refactor(...)`: Code refactoring without behavioral alterations.
- `test(...)`: Adding or updating test suites.
- `chore(...)`: Tooling, build config, dependencies, or `.gitignore` updates.

### Pull Request Process
1. Fork the repo and create your feature branch: `git checkout -b feat/my-awesome-feature`.
2. Commit your changes following conventional commits.
3. Run the test suite: `python3 tests/test_suite.py`.
4. Push to your fork and submit a Pull Request targeting `main`.
5. Clearly describe the problem and solution in the PR description.
