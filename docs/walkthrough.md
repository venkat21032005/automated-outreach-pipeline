# Automated Outreach Pipeline - Step-by-Step Walkthrough

This document provides a detailed end-to-end walkthrough of the **Automated Outreach Pipeline** command-line interface (CLI) application. It explains each stage, details input and output structures, and presents visual evidence of execution via terminal screenshots.

> [!NOTE]
> **Verified Run Environment**: The console output screenshots and sample JSON payloads in this guide and the `docs/samples/` folder are derived from verified pipeline execution simulation runs (mock-mode) to provide complete visual and schema validations without exposing sensitive credentials or exhausting API key quotas.

---

## 1. Assignment Overview

The outreach pipeline is designed to automate B2B outbound campaigns starting from a single target company domain. The execution flows sequentially through 4 core vendor integrations, passing data from one step to the next:

1. **Ocean.io**: Slices lookalike company domains related to the target seed domain.
2. **Prospeo Search**: Scrapes contacts and filters for decision-makers (C-Suite & Vice Presidents) from each lookalike domain.
3. **EazyReach Replacement (Prospeo Enrichment)**: Resolves the decision-maker LinkedIn URLs into verified corporate emails.
4. **Safety Checkpoint**: Pauses execution, prints a summary table of retrieved leads, and prompts the operator for a strict manual confirmation (`yes`).
5. **Brevo**: Renders personalized outreach templates and dispatches transactional emails.

---

## 2. End-to-End Pipeline Explanation

### Stage 1: Sourcing Lookalikes (Ocean.io)
The pipeline begins by sending the seed company domain (e.g. `stripe.com`) to the Ocean.io lookalike lookup endpoint. 
- **Endpoint**: `/v3/search/companies`
- **Request Type**: `POST`
- **Parameters**: `lookalikeDomains: [seedDomain]`, `excludeDomains: [seedDomain]`
- **Response**: List of domains of lookalike companies.

### Stage 2: Sourcing Contacts (Prospeo Search)
For each lookalike company domain retrieved, the pipeline queries Prospeo to find active decision-makers.
- **Endpoint**: `/search-person`
- **Request Type**: `POST`
- **Parameters**: `person_search: domain`, filters for job titles containing C-Suite (`chief`, `ceo`, `cto`, `cfo`, etc.) and `Vice President`.
- **Response**: List of contact records containing full names, job titles, and LinkedIn profile URLs.

### Stage 3: Contact Enrichment (Prospeo Fallback)
LinkedIn URLs sourced in Stage 2 are enriched using Prospeo's official `/enrich-person` endpoint (replacing the undocumented EazyReach private endpoints) to find verified work email addresses.
- **Endpoint**: `/enrich-person`
- **Request Type**: `POST`
- **Parameters**: `linkedin_url`, `only_verified_email: true`
- **Response**: Enriched contact record with a `workEmail` and an `emailStatus` (e.g., `verified` or `deliverable`).

### Stage 4: Safety Checkpoint & Brevo Outbound
Before emails are dispatched, the pipeline displays an interactive safety checkpoint showing sourced metrics. The operator must type `yes` to execute the Brevo SMTP transaction.
- **Brevo Endpoint**: `/smtp/email`
- **Request Type**: `POST`
- **Payload**: Sender credentials (name and verified email from `.env`), recipient email/name, subject, text, and html outreach body.

---

## 3. Visual Execution Evidence

Below is a walk-through of a successful execution of the pipeline CLI, showing the console output and logs.

### Step 1: Starting the Pipeline
The CLI parses the seed company domain, reads environment configurations, and initializes the pipeline service.

![CLI Pipeline Startup](../images/01_pipeline_start.png)
*Caption: CLI startup parsing parameters, displaying loaded environment configuration, and initiating the lookalike company search.*

### Step 2: Sourcing Company Lookalikes
The application queries Ocean.io to fetch similar domains while applying exclusions.

![Ocean.io Sourcing](../images/02_ocean_lookalikes.png)
*Caption: Ocean.io stage completes, successfully fetching similar lookalike domains and writing logs.*

### Step 3: Scraping Decision-Makers
The pipeline queries Prospeo for each lookalike domain to find decision-makers and their LinkedIn URLs, keeping track of rate limits and sleep delays.

![Prospeo Search](../images/03_prospeo_contacts.png)
*Caption: Sourcing decision-makers for similar domains, demonstrating rate-limiting delays and filters.*

### Step 4: Safety Checkpoint Console Table
Once LinkedIn-to-email enrichment is complete, the application formats a summary metrics table and lists the target recipients.

![Safety Checkpoint Table](../images/04_safety_checkpoint.png)
*Caption: Safety checkpoint showing domains found, contacts found, verified emails, and requiring operator confirmation.*

### Step 5: Brevo Transactional Sending
If the operator inputs `yes`, the pipeline composes personalized templates and dispatches the outreach emails via Brevo.

![Brevo SMTP Dispatch](../images/05_brevo_dispatch.png)
*Caption: Dispatched transactional emails via Brevo, rendering logs and final completed timestamps.*

---

## 4. Input and Output Examples

### Sample Input Command
```bash
node src/index.js stripe.com
```

### Sample Leads Output (`output/leads.json`)
Sourced and verified decision-makers:
```json
[
  {
    "fullName": "Alice Smith",
    "firstName": "Alice",
    "title": "CEO",
    "companyName": "Lookalike Inc",
    "companyDomain": "lookalike.com",
    "linkedinUrl": "https://www.linkedin.com/in/alicesmith",
    "workEmail": "alice.smith@lookalike.com",
    "emailStatus": "verified"
  }
]
```

### Sample Send Summary (`output/summary.json`)
```json
{
  "seedDomain": "stripe.com",
  "domainsFound": 1,
  "contactsFound": 1,
  "verifiedEmailsFound": 1,
  "duplicatesRemoved": 0,
  "finalRecipients": 1,
  "errors": 0,
  "generatedAt": "2026-06-06T11:51:26.137Z",
  "sent": 1,
  "completedAt": "2026-06-06T11:51:26.143Z"
}
```

---

## 5. Error Handling and Resiliency

To prevent a single API error from crashing the entire execution, the pipeline implements:
- **Promise.allSettled**: Processes target domains and contact list enrichments concurrently. If a single domain lookup fails, the rest of the batch completes normally.
- **Partial Failure Recording**: Any failed HTTP requests are translated into standard error records (containing the vendor, status code, and response body) and saved to `output/errors.json`.
- **Automatic Retry Wrapper**: Built-in exponential backoff retry mechanism (`src/utils/retry.js`) that retries transient failures (status 429, 500+) and parses rate-limiting headers to pause request threads dynamically.

---

## 6. Known Limitations

When running this pipeline in production, the following limitations should be noted:
1. **API Rate-Limiting Overhead**: To prevent rate limit blockages on the Prospeo Starter plan (1 request/sec), the CLI introduces a proactive `1100ms` delay between requests. This makes the execution slower but guarantees key safety.
2. **Brevo Sender Domain Verification**: Brevo requires that the sender identity (`BREVO_SENDER_EMAIL` in `.env`) has been verified and matches the account’s domain settings. Standard outbound transactions fail if the email is not verified on the account.
3. **In-Memory Resumption**: The current pipeline state checkpoint is stored in-memory during execution. If the Node process is killed mid-run, you must run the pipeline from Stage 1 again.
4. **EazyReach REST Availability**: EazyReach lacks public developer API interfaces, requiring the pipeline to fallback to Prospeo's `/enrich-person` developer endpoint for automated LinkedIn-to-email resolution.
