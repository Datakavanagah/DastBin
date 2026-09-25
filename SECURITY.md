# Security Policy

## Supported version

Security fixes are applied to the latest version on the `main` branch.

## Reporting a vulnerability

Please do not disclose a suspected vulnerability in a public issue. Use GitHub's **Report a vulnerability** flow in the repository Security tab when available, or contact the repository owner privately.

Include a concise description, reproduction steps, affected browser/runtime and the potential impact. Avoid including real camera captures, credentials or other sensitive data.

## Security model

Dastbin AI performs hand inference locally in the browser. It does not require an API key and does not intentionally upload camera frames. Browser permissions, local storage and deployment headers are still part of the security boundary, so deployments should always use HTTPS and current dependencies.
