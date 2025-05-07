import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DomainManager } from "../src/domain-manager.mjs"; // Updated import path

describe("DomainManager - isChinaDomain", () => {
  let manager;

  // Helper function to set up domains for each test
  const setupDomains = (domains) => {
    manager = new DomainManager(); // Updated constructor call
    manager.domains = new Set(domains);
  };

  it("should return true for an exact match in the domain list", () => {
    setupDomains(["example.com.cn", "another.cn"]);
    assert.strictEqual(manager.isChinaDomain("example.com.cn"), true);
  });

  it("should return true for a subdomain of a domain in the list", () => {
    setupDomains(["example.com.cn", "another.cn"]);
    assert.strictEqual(manager.isChinaDomain("sub.example.com.cn"), true);
    assert.strictEqual(manager.isChinaDomain("deep.sub.another.cn"), true);
  });

  it("should return false for a domain not in the list or not a subdomain of any in the list", () => {
    setupDomains(["example.com.cn", "another.cn"]);
    assert.strictEqual(manager.isChinaDomain("google.com"), false);
    assert.strictEqual(manager.isChinaDomain("example.com"), false); // Not example.com.cn
  });

  it("should return false if the domain list is empty", () => {
    setupDomains([]);
    assert.strictEqual(manager.isChinaDomain("example.com.cn"), false);
  });

  it("should correctly match when domain to check is shorter than a chinaDomain but ends with it (edge case, typically invalid)", () => {
    // This case highlights that 'endsWith' might match 'cn' if 'example.cn' is to be checked against 'cn' in list.
    // The current behavior is what's tested.
    setupDomains(["cn"]);
    assert.strictEqual(manager.isChinaDomain("example.cn"), true);
  });

  it("should return false if domain to check is a superdomain of a chinaDomain", () => {
    setupDomains(["sub.example.com.cn"]);
    assert.strictEqual(manager.isChinaDomain("example.com.cn"), false);
  });

  it("should be case-sensitive as `endsWith` is case-sensitive and domains are added as-is", () => {
    setupDomains(["Example.com.cn"]);
    assert.strictEqual(
      manager.isChinaDomain("example.com.cn"),
      false,
      "Lowercase query should not match uppercase list item"
    );
    assert.strictEqual(
      manager.isChinaDomain("Example.com.cn"),
      true,
      "Exact case match"
    );
    assert.strictEqual(
      manager.isChinaDomain("sub.Example.com.cn"),
      true,
      "Subdomain with exact case match"
    );
    assert.strictEqual(
      manager.isChinaDomain("sub.example.com.cn"),
      false,
      "Subdomain with different case should not match"
    );
  });

  it("should handle various TLDs correctly based on the list", () => {
    setupDomains([".com.cn", ".net.cn", ".org.cn"]);
    assert.strictEqual(manager.isChinaDomain("my.site.com.cn"), true);
    assert.strictEqual(manager.isChinaDomain("another.site.net.cn"), true);
    assert.strictEqual(manager.isChinaDomain("test.org.cn"), true);
    assert.strictEqual(manager.isChinaDomain("my.site.com"), false);
  });

  it("should return true if the domain itself is a TLD that is in the list", () => {
    setupDomains(["cn", "com"]);
    assert.strictEqual(manager.isChinaDomain("cn"), true); // e.g. querying for "cn" itself
    assert.strictEqual(manager.isChinaDomain("com"), true); // e.g. querying for "com" itself
  });

  it("should correctly identify subdomains when the list contains broad TLDs", () => {
    setupDomains([".cn"]);
    assert.strictEqual(manager.isChinaDomain("example.cn"), true);
    assert.strictEqual(manager.isChinaDomain("sub.example.cn"), true);
    assert.strictEqual(manager.isChinaDomain("example.com"), false);
  });

  it("should return false for partial matches that are not at the end", () => {
    setupDomains(["example.com.cn"]);
    assert.strictEqual(manager.isChinaDomain("myexample.com.cn.net"), false); // list item is not at the end
    assert.strictEqual(manager.isChinaDomain("test.example.com.c"), false); // partial match of list item
  });
});
