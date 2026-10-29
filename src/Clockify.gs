/** Thin Clockify REST client. Reads credentials from Script Properties. */

const CLOCKIFY_BASE = "https://api.clockify.me/api/v1";

function creds_() {
  const p = PropertiesService.getScriptProperties();
  const key = p.getProperty("CLOCKIFY_API_KEY");
  const ws = p.getProperty("CLOCKIFY_WORKSPACE_ID");
  if (!key || !ws) throw new Error("Set CLOCKIFY_API_KEY and CLOCKIFY_WORKSPACE_ID in Script Properties.");
  return { key, ws };
}

function clockify_(method, path, payload) {
  const { key } = creds_();
  const res = UrlFetchApp.fetch(CLOCKIFY_BASE + path, {
    method,
    contentType: "application/json",
    headers: { "X-Api-Key": key },
    payload: payload ? JSON.stringify(payload) : undefined,
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code >= 300) throw new Error("Clockify " + method + " " + path + " -> HTTP " + code + ": " + res.getContentText());
  const text = res.getContentText();
  return text ? JSON.parse(text) : {};
}

function currentUserId_() { return clockify_("get", "/user").id; }

function listTasks_(projectId) {
  const { ws } = creds_();
  return clockify_("get", "/workspaces/" + ws + "/projects/" + projectId + "/tasks?page-size=200");
}

/** Returns the task id, creating the task if `create` is true and it does not exist. */
function resolveTask_(projectId, taskName, create) {
  const { ws } = creds_();
  const norm = s => String(s).toLowerCase().trim();
  const found = listTasks_(projectId).find(t => norm(t.name) === norm(taskName));
  if (found) return found.id;
  if (!create) return null;
  return clockify_("post", "/workspaces/" + ws + "/projects/" + projectId + "/tasks", { name: taskName }).id;
}

function existingEntries_(userId, startIso, endIso) {
  const { ws } = creds_();
  return clockify_("get", "/workspaces/" + ws + "/user/" + userId + "/time-entries?start=" + startIso + "&end=" + endIso + "&page-size=500");
}

function postEntry_(entry) {
  const { ws } = creds_();
  return clockify_("post", "/workspaces/" + ws + "/time-entries", entry);
}
