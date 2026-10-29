/**
 * Non-secret configuration. Secrets (API key, workspace id) live in Script Properties:
 *   Project Settings > Script properties > CLOCKIFY_API_KEY, CLOCKIFY_WORKSPACE_ID
 * Never commit real keys or ids.
 */
const CONFIG = {
  TIMEZONE: "America/Santiago",
  MIN_DURATION_MIN: 15,              // ignore events shorter than this
  INTERNAL_DOMAINS: ["mycompany.com"], // attendees on these domains are "internal"
  SKIP_DECLINED: true,               // never log events you declined
  SKIP_UNANSWERED: false,            // true = also skip pending invitations
  REQUIRE_TASK: true,                // an entry without a task is not registered

  // One entry per client/project. Match by keyword in the event title or by the
  // attendees' email domain (domains are also learned automatically, see DomainMap).
  PROJECTS: [
    { name: "Acme Corp",  projectId: "PROJECT_ID_1", keywords: ["acme"],  domains: ["acme.com"] },
    { name: "Globex",     projectId: "PROJECT_ID_2", keywords: ["globex"], domains: ["globex.io"] }
  ],

  // Internal work is logged here, always non-billable.
  INTERNAL_PROJECT: { name: "Internal", projectId: "PROJECT_ID_INTERNAL", defaultTask: "Admin" },

  // Calendar blocks that start with a prefix are logged with a fixed task (non-billable).
  //   "[DOC] Acme - weekly report"  ->  task "Documentation" on the Acme project
  BLOCK_PREFIXES: {
    "[DOC]":    { task: "Documentation" },
    "[MGMT]":   { task: "Management" },
    "[INTERNAL]": { task: null }       // null = INTERNAL_PROJECT.defaultTask
  },

  // Meetings with a client where the calendar entry has no attendee list
  // (e.g. copied from Teams) would look internal; these title fragments mark them billable.
  CLIENT_TITLE_HINTS: ["client:", "client meeting"],

  NON_BILLABLE_KEYWORDS: ["lunch", "1:1", "internal"],
  TASKS: ["Consulting", "Documentation", "Client meeting", "Internal meeting", "Management", "Testing"]
};
