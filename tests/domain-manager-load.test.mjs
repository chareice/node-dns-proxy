import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { DomainManager } from "../src/domain-manager.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("DomainManager - loadDomains", () => {
  it("should load domains", async () => {
    const manager = new DomainManager();
    await manager.loadDomains(path.join(__dirname, "fixtures", "domains.txt"));
    assert.strictEqual(manager.isChinaDomain("baidu.com"), true);
    assert.strictEqual(manager.isChinaDomain("google.com"), false);
  });
});
