// Loads the Apps Script sources (.gs) in a Node vm context so they can be unit-tested unchanged.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const read = f => fs.readFileSync(path.join(__dirname, "..", "src", f), "utf8");
const ctx = vm.createContext({});
vm.runInContext(read("Config.gs") + "\nthis.CONFIG = CONFIG;", ctx);
vm.runInContext(read("Classifier.gs") + "\nthis.classifyEvent = classifyEvent;", ctx);

module.exports = { classifyEvent: ctx.classifyEvent, CONFIG: ctx.CONFIG };
