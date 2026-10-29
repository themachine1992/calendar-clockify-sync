// Run: node tests/classifier.test.js
const assert = require("assert");
const { classifyEvent, CONFIG } = require("./load.js");

const at = (h, m = 0) => new Date(Date.UTC(2026, 9, 26, h, m));
const ev = (o) => Object.assign({ title: "x", start: at(10), end: at(11), allDay: false, myStatus: "ACCEPTED", attendees: [] }, o);
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

t("skips declined events", () => assert.strictEqual(classifyEvent(ev({ myStatus: "DECLINED" }), CONFIG, {}).action, "skip"));
t("skips short events", () => assert.strictEqual(classifyEvent(ev({ end: at(10, 10) }), CONFIG, {}).action, "skip"));
t("skips all-day events", () => assert.strictEqual(classifyEvent(ev({ allDay: true }), CONFIG, {}).action, "skip"));

t("client meeting with external attendee is billable", () => {
  const c = classifyEvent(ev({ title: "Acme sprint review", attendees: ["me@mycompany.com", "ana@acme.com"] }), CONFIG, {});
  assert.strictEqual(c.action, "register");
  assert.strictEqual(c.project.name, "Acme Corp");
  assert.strictEqual(c.billable, true);
});

t("client keyword with no external attendee is non-billable internal work", () => {
  const c = classifyEvent(ev({ title: "Acme prep", attendees: ["me@mycompany.com"] }), CONFIG, {});
  assert.strictEqual(c.billable, false);
  assert.strictEqual(c.task, "Internal meeting");
});

t("client hint in title without attendee list is billable", () => {
  const c = classifyEvent(ev({ title: "Client: Acme weekly" }), CONFIG, {});
  assert.strictEqual(c.billable, true);
});

t("[DOC] block is always non-billable with fixed task", () => {
  const c = classifyEvent(ev({ title: "[DOC] Acme weekly report" }), CONFIG, {});
  assert.strictEqual(c.task, "Documentation");
  assert.strictEqual(c.billable, false);
});

t("[DOC] block without client goes to the gray zone", () => {
  assert.strictEqual(classifyEvent(ev({ title: "[DOC] something" }), CONFIG, {}).action, "gray");
});

t("unmapped external domain goes to the gray zone", () => {
  const c = classifyEvent(ev({ title: "Intro call", attendees: ["x@unknown.org"] }), CONFIG, {});
  assert.strictEqual(c.action, "gray");
});

t("learned domain maps an unmapped meeting to a project", () => {
  const c = classifyEvent(ev({ title: "Intro call", attendees: ["x@unknown.org"] }), CONFIG, { "unknown.org": "Globex" });
  assert.strictEqual(c.project.name, "Globex");
});

t("internal-only meeting goes to the internal project", () => {
  const c = classifyEvent(ev({ title: "Team sync", attendees: ["a@mycompany.com"] }), CONFIG, {});
  assert.strictEqual(c.project.name, "Internal");
  assert.strictEqual(c.billable, false);
});
console.log(n + " tests passed");
