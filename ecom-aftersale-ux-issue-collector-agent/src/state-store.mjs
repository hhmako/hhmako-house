import fs from "node:fs";
import path from "node:path";

export class StateStore {
  constructor(file) {
    this.file = file;
    this.state = { handledMessageIds: [], candidates: {} };
    if (fs.existsSync(file)) {
      try {
        this.state = { ...this.state, ...JSON.parse(fs.readFileSync(file, "utf8")) };
      } catch {
        // A corrupt runtime file should not silently mark messages as handled.
      }
    }
  }

  has(messageId) {
    return this.state.handledMessageIds.includes(messageId);
  }

  mark(messageIds, result = {}) {
    this.state.handledMessageIds = [...new Set([...this.state.handledMessageIds, ...messageIds])].slice(-10000);
    for (const messageId of messageIds) this.state.candidates[messageId] = result;
    this.save();
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(this.state, null, 2));
    fs.renameSync(temp, this.file);
  }
}
