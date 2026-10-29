# Calendar → Clockify Sync

A Google Apps Script that turns your Google Calendar into accurate **Clockify** time entries, with a **validate-before-register** workflow so nothing is written until you have seen what the script decided and why.

Built for consultants who split their week across several clients, internal work and management blocks, and who were losing hours every Friday reconstructing timesheets from memory.

## What it does

1. Reads the week's events from your calendar.
2. Classifies each one by rule (see below) into **register**, **skip** or **needs a decision**.
3. Prints a report with the reason behind every decision, billable vs non-billable hours, and the events it could not classify.
4. On `registerWeek()` it creates the Clockify entries, resolving (or creating) the right **task**, and skipping entries that already exist.

## Classification rules

| Situation | Result |
|---|---|
| All-day, declined, or shorter than the minimum duration | Skipped |
| Title starts with a block prefix (`[DOC]`, `[MGMT]`, `[INTERNAL]`) | Logged with a fixed task, always non-billable |
| Client matched by title keyword **or** attendee e-mail domain, with external attendees | Billable client meeting |
| Client matched but no attendees (typical for meetings copied from Teams) and a client hint in the title | Billable client meeting |
| Client matched, nobody external | Non-billable internal work for that client |
| Only internal attendees | Internal project, non-billable |
| External attendees that map to no client | **Gray zone**: reported for you to decide |

**Domain learning:** when a meeting is matched by title and has an external attendee, the attendee's domain is remembered, so the next meeting with that client is recognised even if the title has no keyword.

## Setup

1. Create a new Apps Script project and copy the files in `src/` (or use [clasp](https://github.com/google/clasp)).
2. In **Project Settings → Script properties** add:
   - `CLOCKIFY_API_KEY`
   - `CLOCKIFY_WORKSPACE_ID`
3. Edit `Config.gs`: your internal e-mail domain(s), your clients (keywords, domains, Clockify project IDs) and your internal project.
4. Run `validateWeek()` and read the log. Adjust the config until the report matches reality.
5. Run `registerWeek()`. Optionally run `setupWeeklyTrigger()` to register every Friday and e-mail yourself the report.

> Secrets are never stored in code. If you fork this, keep your key in Script Properties and rotate it if it is ever exposed.

## Architecture

```
Code.gs        entry points, orchestration, report, domain learning, trigger
Classifier.gs  pure classification logic (no Apps Script services)  ← unit-tested
Clockify.gs    REST client: user, tasks (resolve/create), entries
Config.gs      non-secret configuration
tests/         Node tests that load the .gs files unchanged in a vm sandbox
```

Keeping the decision logic pure is what makes the rules testable: the 11 tests in `tests/` cover each branch above without touching Google or Clockify.

## Tests

```bash
npm test      # or: node tests/classifier.test.js
```

## Possible extensions

- Weekly capacity/budget alerts per project (read hours already logged and compare to a planned figure).
- Approval-request helper for the end of each period.
- Audit pass that flags entries without a task or with suspicious durations.

## Author

Michel Urrutia Salgado · IT Project Manager & IT Governance · [LinkedIn](https://www.linkedin.com/in/michel-urrutia-salgado-9a4b3755/)

MIT licensed.
