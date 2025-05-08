import fs from "fs/promises";
import path from "node:path";

class DomainNode {
  constructor() {
    this.children = new Map();
    this.isEndOfDomain = false;
  }
}

class DomainTrie {
  constructor() {
    this.root = new DomainNode();
  }

  addDomain(domain) {
    const parts = domain.split(".");
    let current = this.root;

    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      if (!current.children.has(part)) {
        current.children.set(part, new DomainNode());
      }
      current = current.children.get(part);
    }

    current.isEndOfDomain = true;
  }

  matchDomain(domain) {
    const parts = domain.split(".");
    return this._matchDomainParts(parts, 0, this.root, false);
  }

  _matchDomainParts(parts, index, node, foundComplete) {
    if (index === parts.length) {
      return foundComplete;
    }

    const part = parts[parts.length - 1 - index];

    if (node.children.has(part)) {
      const childNode = node.children.get(part);
      const newFoundComplete = foundComplete || childNode.isEndOfDomain;

      if (
        this._matchDomainParts(parts, index + 1, childNode, newFoundComplete)
      ) {
        return true;
      }
    }

    return foundComplete;
  }
}

export class DomainManager {
  constructor() {
    this.domainTrie = new DomainTrie();
  }

  async loadDomains(domainFile) {
    const data = await fs.readFile(
      path.isAbsolute(domainFile)
        ? domainFile
        : path.resolve(process.cwd(), domainFile),
      "utf-8"
    );

    const lines = data.split("\n");
    for (const line of lines) {
      const domain = line.trim();
      if (domain) {
        this.domainTrie.addDomain(domain);
      }
    }
  }

  isChinaDomain(domain) {
    return this.domainTrie.matchDomain(domain);
  }
}
