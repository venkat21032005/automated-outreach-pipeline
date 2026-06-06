# Automated Outreach Pipeline

A single-command Node.js CLI that turns one seed company domain into a reviewed
list of personalized outreach emails:

`Ocean.io -> Prospeo -> Eazyreach -> safety checkpoint -> Brevo`

Every stage feeds the next automatically. The only manual input is the seed
domain, followed by the required yes/no safety confirmation immediately before
sending.

## Setup

Requirements: Node.js 18+ and API access for all four vendors.

```bash
npm install
copy .env.example .env
```

Fill in `.env` with real API credentials (Ocean.io, Prospeo, and Brevo) and a Brevo-verified sender. Since EazyReach does not offer a public developer API, Stage 3 automatically falls back to Prospeo's officially documented `/enrich-person` endpoint using your Prospeo key to enrich the LinkedIn URLs.

The CLI validates the API integrations before sourcing begins, preventing API credits from being spent when a required credential is missing.

Run the pipeline:

```bash
node src/index.js stripe.com
```

At the checkpoint, review the summary and recipients. Emails are sent only when
the operator types exactly `yes`. Any other response, including a non-interactive
terminal, cancels sending.

## Architecture

- `src/index.js`: CLI parsing and seed-domain validation
- `src/clients/`: one authenticated HTTP wrapper per vendor
- `src/services/pipelineService.js`: stage orchestration and persistence
- `src/services/dedupeService.js`: deterministic contact deduplication
- `src/services/checkpointService.js`: terminal summary and send confirmation
- `src/services/emailComposer.js`: personalized subject and body
- `src/utils/retry.js`: exponential backoff for network errors, HTTP 429, and 5xx
- `src/utils/normalize.js`: common contact shape and field cleanup

The normalized contact shape is:

```js
{
  fullName,
  firstName,
  title,
  companyName,
  companyDomain,
  linkedinUrl,
  workEmail,
  emailStatus
}
```

Prospeo lookups, Eazyreach enrichments, and Brevo sends use bounded concurrent
workers backed by `Promise.allSettled`. An individual failed domain, contact, or
delivery is recorded and does not crash the remaining work.

Deduplication precedence is LinkedIn URL, then email, then
`companyDomain + fullName`. Only records with both a LinkedIn URL and a verified,
syntactically valid work email reach the checkpoint.

## API Integration Notes

- **Brevo**: Hitting the officially documented SMTP transactional email endpoint `/smtp/email` using `api-key` header.
- **Prospeo**: Hitting the officially documented `/search-person` and `/enrich-person` endpoints using `X-KEY` header, with page limit controls.
- **Ocean.io**: Hitting the officially documented lookalike company lookup `/v3/search/companies` using `X-Api-Token` header.
- **EazyReach**: Because EazyReach does not provide a developer REST API, Stage 3 is executed using Prospeo's documented `/enrich-person` endpoint to resolve LinkedIn URLs to verified work emails.

For a demo, use low page limits and a Brevo test sender/account. Do not type
`yes` unless the displayed recipients are approved for outreach. Confirm that
your sending complies with applicable consent, opt-out, and anti-spam rules.

## Output

Each run writes:

- `output/leads.json`: enriched and deduplicated leads, including non-sendable leads
- `output/sent.json`: successful Brevo deliveries, or an empty array when cancelled
- `output/errors.json`: item-level partial failures with stage and HTTP details
- `output/summary.json`: checkpoint and final counts
- `output/pipeline.log`: structured execution logs

Output files are overwritten per run so the four artifacts describe one
consistent execution.

## Error Handling

- HTTP 429 and 5xx responses retry with exponential backoff.
- `Retry-After` is honored when present.
- Timeouts and network failures retry.
- HTTP 4xx responses other than 429 fail immediately and are recorded.
- Missing contacts, LinkedIn URLs, emails, or verified statuses are skipped.
- Failed enrichments and deliveries do not stop other contacts.

## Tests

```bash
npm test
```

Tests cover validation, retry behavior, deduplication, and bounded partial-failure
processing without calling vendor APIs.
