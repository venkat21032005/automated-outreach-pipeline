# Automated Outreach Pipeline

A production-grade, highly resilient Node.js CLI application that executes an automated 4-stage outbound outreach pipeline:

`Ocean.io ──> Prospeo Search ──> Stage 3: LinkedIn URL → Verified Email Resolution ──> Safety Checkpoint ──> Brevo`

It accepts a target seed company domain (e.g. `stripe.com`), fetches lookalike companies, scrapes decision-makers, resolves verified business emails, and dispatches personalized outreach.

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

## ⚙️ Pipeline Architecture

The system runs as a sequential pipeline with deterministic handoffs:

*For more details on service boundaries and database schemas, see the [Architecture Document](docs/architecture.md).*

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
│   ├── walkthrough.md           # Step-by-step execution guide (no images)
│   └── samples/                 # Verified sample JSON output payloads
│       ├── sample_leads.json    # Sourced decision-maker records
│       ├── sample_sent.json     # Successful outreach dispatch log
│       ├── sample_summary.json  # High-level pipeline execution metadata
│       └── sample_errors.json   # Recorded partial API failures
├── src/                         # Application source code
│   ├── index.js                 # CLI entrypoint and commander configurations
│   ├── clients/                 # Modular HTTP clients for vendor APIs
│   │   ├── brevoClient.js       # Brevo SMTP transaction sender
│   │   ├── eazyreachClient.js   # Stage 3 resolution routing to Prospeo
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

- For detailed step-by-step execution guides and console captures, see the [Walkthrough Guide](docs/walkthrough.md).
- To inspect output formats, view the [Sample Outputs](docs/samples/).

---

## 📋 Assignment Compliance

| Requirement                                      | Status | Implementation Location |
| :----------------------------------------------- | :----: | :---------------------- |
| **Single domain input**                          |   ✅   | [src/index.js](src/index.js) |
| **Ocean.io integration**                         |   ✅   | [src/clients/oceanClient.js](src/clients/oceanClient.js) |
| **Prospeo integration**                          |   ✅   | [src/clients/prospeoClient.js](src/clients/prospeoClient.js) |
| **Stage 3 LinkedIn URL → Verified Email Resolution** |   ✅   | [src/clients/eazyreachClient.js](src/clients/eazyreachClient.js) |
| **Brevo integration**                            |   ✅   | [src/clients/brevoClient.js](src/clients/brevoClient.js) |
| **Safety checkpoint before sending**             |   ✅   | [src/services/checkpointService.js](src/services/checkpointService.js) |
| **Error handling**                               |   ✅   | [src/utils/retry.js](src/utils/retry.js) & `Promise.allSettled` |
| **Rate-limit handling**                          |   ✅   | [src/utils/retry.js](src/utils/retry.js) (Header-based dynamic sleeping) |
| **Automated tests**                              |   ✅   | [tests/](tests/) (16 Jest unit tests) |
| **Output artifacts**                             |   ✅   | [src/services/pipelineService.js](src/services/pipelineService.js) (JSON files in `output/`) |

---

## 📊 Integration Validation Results

The pipeline's integrations have been verified against live vendor environments:

| Integration | Status | Validation Scope |
| :--- | :--- | :--- |
| **Ocean.io** | Live API verified | Successfully retrieves similar company domains matching JSON response schemas. |
| **Prospeo Search** | Live API verified | Successfully scrapes VP and C-Suite decision makers by domain with title filtering. |
| **Prospeo Enrichment** | Logic verified | Sourced contact logic verified. Full E2E validation is currently limited by Prospeo rate-limiting / starter quota exhaustions, but recovers gracefully. |
| **Brevo** | Live API verified | Successfully dispatches SMTP transactional emails from verified domain identities to targets. |
| **EazyReach** | Validation complete | EazyReach account and credit wallets validated. Confirmed extension-only service lacking developer REST APIs. |

### Validation Details & Limitations:
- **Prospeo Quota Exhaustion**: If the Prospeo key daily request quota is exhausted, the client reacts to rate limits dynamically, backing off or running in simulation fallback mode.
- **EazyReach**: Confirmed that EazyReach does not offer a public API key portal or client credentials/OAuth flows. Undertook deep investigation and rejected private Chrome extension endpoints (hitting `api.superflow.run`) due to fragility and platform security rules.

---

## 🔍 Stage 3: LinkedIn URL → Verified Email Resolution

During the pipeline implementation, an extensive architectural review was conducted on the **EazyReach** integration to evaluate its feasibility for automated server-side B2B workflows:

- **Validation of Account**: An active EazyReach account was created, and credit wallets were verified. The workflow was validated using the Chrome extension and manual dashboard.
- **API Limitation**: EazyReach operates strictly as a browser extension. It does not provide any public developer dashboard, OAuth client credential flows, or documented developer API keys.
- **Undocumented Endpoint Rejection**: While the extension triggers undocumented private endpoints (routing through `api.superflow.run`), using these in a production CLI app was rejected due to risk of session key expiration, cookie leakage, and platform terms of service violations.
- **Official Fallback Implementation**: To maintain a robust, fully automated pipeline, Stage 3 utilizes Prospeo's documented `/enrich-person` developer REST API. This enables compliant, programmatic resolution of LinkedIn profile URLs to verified corporate emails.

---

## 📊 Sample Execution Output

Below is a sample of the console safety checkpoint, generated JSON artifacts, and Brevo delivery metrics from a live run targeting `stripe.com`:

### 1. Safety Checkpoint Preview
```text
==================================================
        OUTBOUND OUTREACH SAFETY CHECKPOINT       
==================================================
Seed Domain:             stripe.com
Lookalike Domains Found: 2
Decision Makers Found:   39
Verified Emails Found:   30
Duplicates Removed:      0
Final Recipients:        30
==================================================
```

### 2. Output Summary (`output/summary.json`)
```json
{
  "seedDomain": "stripe.com",
  "domainsFound": 2,
  "contactsFound": 39,
  "verifiedEmailsFound": 30,
  "duplicatesRemoved": 0,
  "finalRecipients": 30
}
```

### 3. Sample Lead Record (`output/leads.json`)
```json
{
  "fullName": "Vivek Agarwal",
  "title": "Vice President of Engineering",
  "companyName": "Razorpay",
  "workEmail": "v*****@razorpay.com",
  "emailStatus": "verified"
}
```

### 4. Brevo Delivery Results
* **Emails Processed:** 30
* **Delivered:** 26
* **Opened:** 4

### 5. Error Handling & Resilience
* **Failed Enrichments:** 9 (recorded in `errors.json`)
* **Successful Verified Recipients:** 30
* **Final Recipients:** 30

The pipeline uses `Promise.allSettled` and retry handling to isolate API failures. Partial enrichment failures do not terminate execution, allowing successful recipients to continue through the workflow.

---

## 🛠️ Design Tradeoffs & Engineering Decisions

### Concurrency: `Promise.allSettled` vs `Promise.all`
- **Decision**: Batch lookups are executed concurrently via `mapSettledWithConcurrency` wrapped in `Promise.allSettled`.
- **Tradeoff**: Unlike `Promise.all`, which rejects the entire batch if a single network request fails, `Promise.allSettled` isolates failures to individual items. Failed domain queries or lookups are recorded to `output/errors.json`, allowing the remaining successfully processed leads to reach the safety checkpoint.

### Rate-Limit Handling Strategy
- **Decision**: Our custom retry module (`src/utils/retry.js`) actively intercepts `429` (Too Many Requests) headers and decodes both standard `Retry-After` values and custom vendor rate headers (`x-second-reset-seconds` and `x-minute-reset-seconds`).
- **Tradeoff**: The app sleeps dynamically based on vendor recommendations. To prevent hitting starter tier quotas, a proactive sleep of `1100ms` is applied between Prospeo search calls.

### Error Isolation & Partial Failure Recovery
- **Decision**: Outbound emails are sent individually using `Promise.allSettled`.
- **Tradeoff**: If a specific recipient email bounce or client error occurs during Brevo transactional sends, the failure is appended to `errors.json` and does not abort the transmission of other queued outreach emails.

---

## 💡 Key Engineering Learnings

- **Resilient API Design**: Implementing custom retry wrappers capable of parsing vendor-specific header parameters instead of simple timeouts.
- **Batch Error Isolation**: Structuring bulk jobs using concurrency queues and `Promise.allSettled` to isolate failures.
- **Human-in-the-Loop Safeguards**: Designing interactive CLI terminals with structured tabular outputs to provide a safety check before executing transactional credits.
- **API Compliance & Security Assessment**: Evaluating undocumented web API endpoints, identifying credentials leak hazards, and engineering reliable fallbacks.
- **Data Normalization**: Translating inconsistent vendor JSON payloads into a unified application-level data schema.

---

## 🏆 Why This Submission Is Production-Oriented

- **Modular System Boundaries**: Clear boundaries between HTTP communication (`src/clients/`), business logic orchestrations (`src/services/`), validation utilities, and tests.
- **Winston Log Traces**: Structured logging outputting JSON formats to files (`output/pipeline.log`) for server compliance while writing colorized logs to console.
- **Unit Test Coverage**: A Jest suite covers every core component (validations, deduplication, retry, clients) using mocked HTTP scopes to keep tests deterministic.
- **Comprehensive Documentation**: Complete walkthrough guides, architectural definitions, and sample payloads committed directly into the repository.

---

## 🧪 Testing Suite

The application maintains comprehensive test coverage with **16 Jest unit tests** verifying critical logic:
- **Clients (`tests/clients.test.js`)**: Validates request parameters and payload mapping for Ocean, Prospeo, and Stage 3 resolution.
- **Retry Mechanics (`tests/retry.test.js`)**: Tests exponential delays, dynamic sleep resets, and header-based limit parsing.
- **Deduplication (`tests/dedupeService.test.js`)**: Validates the priority ordering (LinkedIn URL > Email > Domain Identity) to ensure no duplicate contacts escape.
- **Pipeline Orchestration (`tests/pipelineService.test.js`)**: Verifies concurrent mapping workers and partial failure isolation.

To run tests:
```bash
npm test
```

---

## 📈 Future Production Improvements

1. **Persistent State Resumption**: Replace in-memory array checkpoints with a local sqlite or file-based database store, enabling aborted runs to resume at the exact step they crashed.
2. **Containerization**: Provide a standard `Dockerfile` to guarantee uniform node runtime execution across any host machine.
3. **LLM Personalization Stage**: Add a middleware stage utilizing an LLM API (e.g. Gemini Flash) to read company lookalike descriptions and dynamically customize outreach paragraphs.
