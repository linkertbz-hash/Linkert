# Parser — Structured-data organization service

**Public website:** https://parser.finansteh.ru  
**Role:** Product owner; requirements, issue investigation, implementation coordination and QA with AI-assisted workflows.

## Challenge

Organizations need to transform information from permitted public data sources into usable records without repetitive manual copy-and-paste work.

## Solution (publicly visible)

- A task-based workflow for requesting structured information.
- Data organization, filtering and export capabilities.
- Processing status feedback for users.
- Integrations with external services, subject to source permissions and terms.

## Main engineering themes

Input validation, processing reliability, handling inconsistent records, background tasks and user-facing error reporting. This case intentionally does not publish source-specific mechanisms or scraping techniques.

## What to see

Explore the public product description, onboarding and task creation experience.

## Result and next steps

A live web service being iteratively tested and improved. Data availability depends on the sources and their access policies; no extraction rate is promised.

## Technology accuracy

The production project uses a **Node.js / PostgreSQL** stack according to its current internal README. It is *not* claimed to be a Python project. A separate original Python learning project is part of the publication kit.

## Confidentiality

Private connectors, competitive methods, production source code, client data, secret keys and internal infrastructure are not disclosed.
