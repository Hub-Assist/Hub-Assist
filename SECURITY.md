# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.x     | ✅        |

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Report vulnerabilities by emailing **security@hubassist.com** with:

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- Any suggested mitigations

You will receive an acknowledgement within **48 hours** and a resolution timeline within **7 days**.

## Security Measures

- Dependencies are scanned on every CI run via `npm audit` (frontend/backend) and `cargo audit` (contracts)
- CodeQL static analysis runs on every push and weekly
- Pull requests trigger automated dependency review via `actions/dependency-review-action`
