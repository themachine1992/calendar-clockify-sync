/**
 * Pure classification logic: no Apps Script services here, so it can be unit-tested in Node.
 *
 * classifyEvent(event, config, domainMap) -> {
 *   action:   "register" | "skip" | "gray",
 *   reason:   human-readable explanation (shown in the validation report),
 *   project:  config project (when action = register),
 *   task:     task name,
 *   billable: boolean,
 *   learnDomain: { domain, projectName } | null
 * }
 *
 * event = { title, start: Date, end: Date, allDay, myStatus, attendees: [email] }
 */

function normalize_(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function domainOf_(email) {
  const m = String(email || "").toLowerCase().match(/@([^@\s>]+)$/);
  return m ? m[1] : "";
}

function durationMin_(ev) {
  return Math.round((ev.end - ev.start) / 60000);
}

function matchProjectByTitle_(title, config) {
  const t = normalize_(title);
  return config.PROJECTS.find(p => p.keywords.some(k => t.includes(normalize_(k)))) || null;
}

function matchProjectByDomain_(externalDomains, config, domainMap) {
  for (const d of externalDomains) {
    const learned = domainMap && domainMap[d];
    const p = config.PROJECTS.find(p => p.name === learned || (p.domains || []).includes(d));
    if (p) return p;
  }
  return null;
}

function blockPrefix_(title, config) {
  const key = Object.keys(config.BLOCK_PREFIXES).find(k => String(title).trim().toUpperCase().startsWith(k.toUpperCase()));
  return key ? { prefix: key, rule: config.BLOCK_PREFIXES[key] } : null;
}

function classifyEvent(ev, config, domainMap) {
  if (ev.allDay) return { action: "skip", reason: "all-day event" };
  if (ev.myStatus === "DECLINED" && config.SKIP_DECLINED) return { action: "skip", reason: "you declined it" };
  if (ev.myStatus === "UNANSWERED" && config.SKIP_UNANSWERED) return { action: "skip", reason: "invitation unanswered" };
  if (durationMin_(ev) < config.MIN_DURATION_MIN) return { action: "skip", reason: "shorter than " + config.MIN_DURATION_MIN + " min" };

  const internal = (config.INTERNAL_DOMAINS || []).map(d => d.toLowerCase());
  const external = [...new Set((ev.attendees || []).map(domainOf_).filter(d => d && !internal.includes(d)))];
  const byTitle = matchProjectByTitle_(ev.title, config);

  // 1) Scheduled blocks: always non-billable, fixed task.
  const blk = blockPrefix_(ev.title, config);
  if (blk) {
    if (blk.rule.task === null) {
      return { action: "register", project: config.INTERNAL_PROJECT, task: config.INTERNAL_PROJECT.defaultTask, billable: false, reason: "internal block " + blk.prefix };
    }
    if (!byTitle) return { action: "gray", reason: blk.prefix + " block without a recognisable client in the title" };
    return { action: "register", project: byTitle, task: blk.rule.task, billable: false, reason: blk.prefix + " block on " + byTitle.name };
  }

  // 2) Client resolved by title keyword or by attendee domain.
  const project = byTitle || matchProjectByDomain_(external, config, domainMap);
  const hintedClient = (config.CLIENT_TITLE_HINTS || []).some(h => normalize_(ev.title).includes(normalize_(h)));

  if (project && (external.length > 0 || hintedClient)) {
    const nonBillable = (config.NON_BILLABLE_KEYWORDS || []).some(k => normalize_(ev.title).includes(normalize_(k)));
    return {
      action: "register", project, task: "Client meeting", billable: !nonBillable,
      reason: external.length ? "external attendees from " + external.join(", ") : "client hint in the title",
      learnDomain: byTitle && external.length ? { domain: external[0], projectName: byTitle.name } : null
    };
  }

  // 3) Client project matched but nobody external: internal work for that client.
  if (project) {
    return { action: "register", project, task: "Internal meeting", billable: false, reason: "no external attendees: internal work on " + project.name };
  }

  // 4) Only internal attendees (or none): internal project.
  if (external.length === 0) {
    return { action: "register", project: config.INTERNAL_PROJECT, task: config.INTERNAL_PROJECT.defaultTask, billable: false, reason: "internal meeting" };
  }

  // 5) External attendees we cannot map: ask the human.
  return { action: "gray", reason: "external attendees (" + external.join(", ") + ") not mapped to any project" };
}

// Allows `node tests/*.test.js` without Apps Script; ignored by the Apps Script runtime.
if (typeof module !== "undefined") module.exports = { classifyEvent, normalize_, domainOf_ };
