/**
 * Calendar -> Clockify sync.
 *
 *   validateWeek()      dry run: prints what WOULD be registered and what needs a decision
 *   registerWeek()      registers the current week (skips entries that already exist)
 *   setupWeeklyTrigger() installs a Friday-afternoon trigger that registers and emails a report
 *
 * Always run validate first: events are classified by rules, and the gray zone is for you to resolve.
 */

function validateWeek()  { run_(weekRange_(0), false); }
function registerWeek()  { run_(weekRange_(0), true); }
function validatePreviousWeek() { run_(weekRange_(-1), false); }
function registerPreviousWeek() { run_(weekRange_(-1), true); }

function weekRange_(offsetWeeks) {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);
  const end = new Date(monday);
  end.setDate(monday.getDate() + 7);
  return { start: monday, end };
}

function fetchEvents_(range) {
  const me = Session.getActiveUser().getEmail().toLowerCase();
  return CalendarApp.getDefaultCalendar().getEvents(range.start, range.end).map(e => {
    const guests = e.getGuestList(true);
    const mine = guests.find(g => g.getEmailAddress().toLowerCase() === me);
    return {
      id: e.getId(),
      title: e.getTitle(),
      start: e.getStartTime(),
      end: e.getEndTime(),
      allDay: e.isAllDayEvent(),
      myStatus: mine ? String(mine.getGuestStatus()) : "OWNER",
      attendees: guests.map(g => g.getEmailAddress())
    };
  });
}

function run_(range, doRegister) {
  const domainMap = DomainMap.load();
  const events = fetchEvents_(range);
  const report = { register: [], skip: [], gray: [], created: 0, duplicates: 0, errors: [] };

  const userId = doRegister ? currentUserId_() : null;
  const existing = doRegister
    ? existingEntries_(userId, range.start.toISOString(), range.end.toISOString())
    : [];

  events.forEach(ev => {
    const c = classifyEvent(ev, CONFIG, domainMap);
    if (c.action === "skip") { report.skip.push({ ev, c }); return; }
    if (c.action === "gray") { report.gray.push({ ev, c }); return; }
    report.register.push({ ev, c });
    if (c.learnDomain) DomainMap.learn(c.learnDomain.domain, c.learnDomain.projectName);
    if (!doRegister) return;

    try {
      const taskId = resolveTask_(c.project.projectId, c.task, true);
      if (!taskId && CONFIG.REQUIRE_TASK) { report.errors.push(ev.title + ": task not found"); return; }
      const startIso = ev.start.toISOString(), endIso = ev.end.toISOString();
      const dup = existing.some(x => x.timeInterval.start === startIso.replace(".000Z", "Z") && x.projectId === c.project.projectId);
      if (dup) { report.duplicates++; return; }
      postEntry_({ start: startIso, end: endIso, billable: c.billable, description: ev.title, projectId: c.project.projectId, taskId });
      report.created++;
    } catch (err) {
      report.errors.push(ev.title + ": " + err.message);
    }
  });

  const text = formatReport_(report, doRegister);
  Logger.log(text);
  return report;
}

function formatReport_(r, registered) {
  const hours = list => (list.reduce((a, x) => a + (x.ev.end - x.ev.start), 0) / 3600000).toFixed(1);
  const bill = r.register.filter(x => x.c.billable);
  const lines = [
    (registered ? "REGISTERED" : "VALIDATION (nothing written)") + " — " + r.register.length + " entries, " + hours(r.register) + " h",
    "  billable: " + hours(bill) + " h   non-billable: " + hours(r.register.filter(x => !x.c.billable)) + " h",
    ""
  ];
  r.register.forEach(x => lines.push("  + " + x.ev.title + " -> " + x.c.project.name + " / " + x.c.task + (x.c.billable ? " [billable]" : "") + "  (" + x.c.reason + ")"));
  if (r.gray.length) { lines.push("", "NEEDS A DECISION (" + r.gray.length + "):"); r.gray.forEach(x => lines.push("  ? " + x.ev.title + "  (" + x.c.reason + ")")); }
  if (r.skip.length) { lines.push("", "SKIPPED (" + r.skip.length + "):"); r.skip.forEach(x => lines.push("  - " + x.ev.title + "  (" + x.c.reason + ")")); }
  if (registered) lines.push("", "created: " + r.created + "  duplicates skipped: " + r.duplicates);
  if (r.errors.length) { lines.push("", "ERRORS:"); r.errors.forEach(e => lines.push("  ! " + e)); }
  return lines.join("\n");
}

/** Learns attendee-domain -> project so the next meeting with that client is recognised without keywords. */
const DomainMap = {
  load() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty("DOMAIN_MAP") || "{}"); } catch (e) { return {}; } },
  learn(domain, projectName) {
    const m = this.load();
    if (m[domain] === projectName) return;
    m[domain] = projectName;
    PropertiesService.getScriptProperties().setProperty("DOMAIN_MAP", JSON.stringify(m));
  },
  reset() { PropertiesService.getScriptProperties().deleteProperty("DOMAIN_MAP"); }
};

function setupWeeklyTrigger() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === "weeklyJob").forEach(ScriptApp.deleteTrigger);
  ScriptApp.newTrigger("weeklyJob").timeBased().onWeekDay(ScriptApp.WeekDay.FRIDAY).atHour(17).create();
}

function weeklyJob() {
  const r = run_(weekRange_(0), true);
  MailApp.sendEmail(Session.getActiveUser().getEmail(), "Weekly time-tracking report", formatReport_(r, true));
}
