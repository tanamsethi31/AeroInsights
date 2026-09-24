# Security policy

## Supported versions

Security fixes are applied on the `main` branch and deployed via Vercel. There is no separate LTS release line.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security problems.**

1. Use [GitHub Private Vulnerability Reporting](https://github.com/tanamsethi31/AeroInsights/security/advisories/new) for this repository, **or**
2. Email the maintainer with a clear description, impact, and steps to reproduce.

We aim to acknowledge reports within **72 hours** and will coordinate disclosure once a fix is available.

## Scope

In scope: Aeroinsights application code, API routes, authentication and authorization, Supabase RLS and storage policies, and dependency vulnerabilities surfaced by CI.

Out of scope: third-party services (Auth0, Supabase, Vercel) except where our integration misconfigures them.
