import fs from "fs/promises";
import path from "node:path";

export class DomainManager {
  domains;

  constructor() {
    this.domains = new Set();
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
      if (domain && !this.domains.has(domain)) {
        this.domains.add(domain);
      }
    }
  }

  isChinaDomain(domain) {
    for (const chinaDomain of this.domains) {
      if (domain.endsWith(chinaDomain)) {
        return true;
      }
    }
    return false;
  }
}
