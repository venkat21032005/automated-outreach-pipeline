# Automated Outreach Pipeline

A production-grade, highly resilient Node.js CLI application that executes an automated 4-stage cold outbound outreach pipeline:

`Ocean.io ──> Prospeo Search ──> EazyReach Replacement (Prospeo Enrichment) ──> Safety Checkpoint ──> Brevo`

It accepts a target seed company domain (e.g. `stripe.com`), fetches lookalike companies, scrapes decision-makers, resolves verified business emails, and automatically dispatches personalized outreach emails.

---

## 🚀 Recruiter Quick Start

Get the application running locally in under 60 seconds using mock mode (no API keys required):

```bash
# 1. Clone and install dependencies
git clone https://github.com/venkat21032005/automated-outreach-pipeline.git
cd automated-outreach-pipeline
npm install

# 2. Run the automated Jest test suite
npm test

# 3. Execute the pipeline in mock mode (uses mock data by default)
node src/index.js stripe.com
```

---

## 📂 Repository Directory Tree

Below is the layout of the codebase. Every module is isolated and follows single-responsibility principles:

```
.
├── .env.example                 # Environment variables template
├── .gitignore                   # Git ignore configurations (ignores secrets & outputs)
├── package.json                 # NPM scripts and dependencies configuration
├── README.md                    # Main recruiter documentation and guide
├── docs/                        # Complete documentation package
│   ├── architecture.md          # Technical specifications and system design
│   ├── walkthrough.md           # Step-by-step execution guide with screenshots
│   ├── images/                  # Diagrams and visual execution evidence
│   │   ├── architecture.png     # Pipeline flowchart diagram
│   │   └── *.png                # Terminal run screenshots
│   └── samples/                 # Verified sample JSON output payloads
│       ├── sample_leads.json    # Sourced decision-maker records
│       ├── sample_sent.json     # Successful outreach dispatch log
│       ├── sample_summary.json  # High-level pipeline execution metadata
│       └── sample_errors.json   # Recorded partial API failures
├── src/                         # Application source code
│   ├── index.js                 # CLI entrypoint and commander configurations
│   ├── clients/                 # Modular HTTP clients for vendor APIs
│   │   ├── brevoClient.js       # Brevo SMTP transaction sender
│   │   ├── eazyreachClient.js   # EazyReach placeholder routing to Prospeo
│   │   ├── oceanClient.js       # Ocean.io lookalike scraper
│   │   └── prospeoClient.js     # Prospeo search-person lookup client
│   ├── config/                  # Configuration validation rules
│   │   └── env.js               # Env variables loader and validation rules
│   ├── services/                # Core business and orchestration layers
│   │   ├── checkpointService.js # Console summary formatter and readline prompt
│   │   ├── dedupeService.js     # Multi-pass contact deduplication engine
│   │   ├── emailComposer.js     # Personalized outreach template engine
│   │   └── pipelineService.js   # Main E2E pipeline orchestrator
│   └── utils/                   # Shared validation and HTTP utilities
│       ├── logger.js            # Winston console & file logger
│       ├── normalize.js         # Contact & domain fields formatter
│       ├── retry.js             # Exponential backoff and rate-limit handler
│       └── validators.js        # Domain & email schema validators
└── tests/                       # Jest unit tests suite
    ├── clients.test.js          # API payload formatting and client tests
    ├── dedupeService.test.js    # Deduplication priorities tests
    ├── pipelineService.test.js  # Concurrency and batch processing tests
    ├── retry.test.js            # Backoff delays and header parsing tests
    └── validators.test.js       # Schema validator regex tests
```

- For detailed runtime details, see the [Step-by-Step Walkthrough](file:///C:/Users/venka/.gemini/antigravity/scratch/automated-outreach-pipeline/docs/walkthrough.md).
- To inspect output schemas, view the [Sample Outputs](file:///C:/Users/venka/.gemini/antigravity/scratch/automated-outreach-pipeline/docs/samples/).

---

## ⚙️ Architecture Overview

The system runs as a sequential pipeline with deterministic handoffs:

![Pipeline Architecture Diagram](docs/images/architecture.png)

```
  Input Domain (stripe.com)
            │
            ▼
┌───────────────────────┐
│     Ocean.io API      │ ──> Retrieves similar domains (excluding seed)
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│  Prospeo Search API   │ ──> Sourced C-Suite & VP contacts
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ Eazyreach Replacement │ ──> Resolves LinkedIn URLs to verified emails (Prospeo fallback)
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│   Safety Checkpoint   │ ──> Operator review of lead table before sending
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│       Brevo API       │ ──> Dispatches transactional outreach emails
└───────────────────────┘
```

- Sourced contacts undergo a **two-phase deduplication** process (first by LinkedIn URL, then by resolved email and domain identity) to avoid double-contacting prospects.
- High-level system design and data-flow charts are detailed in the [System Architecture Document](file:///C:/Users/venka/.gemini/antigravity/scratch/automated-outreach-pipeline/docs/architecture.md).

---

## 🛠️ Design Tradeoffs & Engineering Decisions

### 1. Concurrency: `Promise.allSettled` vs `Promise.all`
*   **Decision**: Batch requests are orchestrated using custom concurrency workers (`mapSettledWithConcurrency`) backed by `Promise.allSettled`.
*   **Tradeoff**: Using `Promise.all` would fail the entire pipeline if a single company domain failed or lacked contacts. `Promise.allSettled` isolates failures to the item level, allowing successfully retrieved leads to reach the safety checkpoint.

### 2. Rate-Limit Handling Strategy
*   **Decision**: The HTTP retry wrapper (`src/utils/retry.js`) actively parses vendor rate-limit headers (e.g. `Retry-After`, `x-second-reset-seconds`, and `x-minute-reset-seconds`) to calculate dynamic wait times, falling back to exponential backoff.
*   **Tradeoff**: This reactive approach is coupled with proactive sleep periods (e.g. `1100ms` between Prospeo searches) to guarantee compliance with API quotas without crashing.

### 3. Rejection of Undocumented EazyReach Endpoints
*   **Decision**: The team rejected private, undocumented EazyReach endpoints (e.g. reverse-engineered Chrome extension requests hitting private URLs like `api.superflow.run`).
*   **Rationale**: Using private endpoints violates developer terms of service, leads to instant IP bans, and is highly fragile. Stage 3 was routed to Prospeo's officially documented `/enrich-person` developer REST API.

---

## 📊 Live Integration Validation

The pipeline's integrations have been verified against live vendor environments:
- **Ocean.io Sourcing**: Confirmed response schema compatibility for lookalike queries. The pipeline correctly handles paginated search parameters (`searchAfter`) and normalizes nested company domain paths.
- **Prospeo Search**: Verified contact matching logic. Applied targeted `"person_search": domain` query parameters and filtered job titles. Tested that transient API rate limit headers (`x-second-reset-seconds` and `x-minute-reset-seconds`) are parsed and mapped to retry pauses.
- **EazyReach Investigation**: Evaluated EazyReach and confirmed it is an extension-only service lacking developer REST APIs or OAuth client access keys. Reverse-engineered private extension requests (hitting `api.superflow.run`) were rejected due to credential leakage and maintenance risks. The pipeline's compliant fallback maps enrichment requests to Prospeo's documented `/enrich-person` developer REST API.
- **Brevo Dispatch**: Dispatched live transactional emails from the verified sender identity (`venkat@venkatchowdary.site`) to test contacts. Confirmed that Brevo accepts outreach bodies, encodes signature structures, and returns valid message IDs.

---

## 🧪 Testing Suite

The application maintains comprehensive test coverage with **12 Jest unit tests** verifying critical logic:

- **Clients (`tests/clients.test.js`)**: Validates request parameters and payload mapping for Ocean, Prospeo, and EazyReach replacement endpoints under simulated conditions.
- **Retry Mechanics (`tests/retry.test.js`)**: Tests exponential delays, dynamic sleep resets, header-based limit parsing, and error-status filtering (e.g., retrying 429 and 500s while immediately rejecting 401 and 404s).
- **Deduplication (`tests/dedupeService.test.js`)**: Validates the priority ordering (LinkedIn URL > Email > Domain Identity) to ensure no duplicate contacts escape.
- **Pipeline Orchestration (`tests/pipelineService.test.js`)**: Verifies concurrent mapping workers and partial failure isolation.

To run tests:
```bash
npm test
```

---

## 📈 Future Production Improvements

1. **Redis Queue Integration**: Transition from in-memory arrays to a Redis-backed queue system (e.g., BullMQ) to handle larger seed batches and support pipeline pause/resume states across system crashes.
2. **Webhook Status Tracking**: Add webhook receivers to listen for Brevo delivery events (open rates, bounces, spam blocks) and save outbound metrics to a persistent database.
3. **Advanced LLM Personalization**: Integrate an LLM stage (e.g., Gemini Flash API) to read lookalike company descriptions and dynamically customize the email body copy for each specific decision-maker title.
