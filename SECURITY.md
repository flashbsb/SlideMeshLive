# Security Policy

## Supported Versions

Security updates are actively applied to the latest release and the `main` branch.

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

---

## Reporting a Vulnerability

We take the security of **SlideMeshLive** very seriously. If you discover a security vulnerability, please report it responsibly before disclosing it publicly.

### How to Report

1. **GitHub Security Advisories (Preferred):**
   Navigate to the repository's **Security** tab and click on **Report a vulnerability** to open a private security draft.
2. **Direct Contact:**
   Alternatively, contact the repository maintainers directly through private project channels.

### Information to Include

Please provide:
- A clear description of the vulnerability.
- Step-by-step instructions or Proof-of-Concept (PoC) to reproduce the issue.
- Potential impact and affected components (e.g., backend Gatekeeper, RBAC, Studio file upload, Realtime engine).
- Any proposed remediation or suggested patch.

### Response Timeline

- **Initial Response:** Within 48 hours acknowledging receipt of your report.
- **Triage & Status Update:** Within 5 business days with assessment and mitigation plan.
- **Resolution & Release:** We will coordinate with you on patch publication and release notes.

---

## Security Best Practices for Deployments

1. **First-Run Security Setup:**
   - Always run the **Setup Wizard** (`/setup.html` or `python3 server.py --setup`) on first deployment to configure a custom Master PIN, Administrator credentials, and RBAC policies.
   - Never run live event sessions using default example credentials (`security.example.json`).
2. **File Permissions & Secrets:**
   - Ensure `config/security.json` is protected with strict read/write file permissions (e.g., `chmod 600 config/security.json`) on multi-user hosting servers.
   - Never commit `config/security.json` or `.env` files into public version control.
3. **Network Isolation & HTTPS:**
   - In public venues and production events, deploy behind a reverse proxy (Nginx, Traefik, Caddy, Cloudflare) with valid SSL/TLS (HTTPS/WSS) certificates.
