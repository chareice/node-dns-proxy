import dgram from "node:dgram";
import axios from "axios";
import { program } from "commander";
import fs from "fs/promises";
import path from "node:path";
import logger from "./logger.mjs";
import { contextStorage } from "./context.mjs";
import { v4 as uuidv4 } from "uuid";

class DNSServer {
  #server;
  #options;

  constructor(options) {
    this.#options = options;
    this.#server = dgram.createSocket("udp4");
  }

  async run() {
    const { domain_file, china_server, trust_dns_server } = this.#options;

    const domainManager = new DomainManager(domain_file);
    await domainManager.loadDomains();

    this.#server.on("message", async (msg, rinfo) => {
      contextStorage.run({ reqId: uuidv4() }, async () => {
        const domain = getDomainFromDnsQuery(msg);
        logger.info({ domain }, "query");

        const isChinaDomain = domainManager.isChinaDomain(domain);

        if (isChinaDomain) {
          await this.forwardToUDP(msg, rinfo, china_server);
        } else {
          await this.handleDoh(msg, rinfo, trust_dns_server);
        }
      });
    });

    this.#server.bind(5300, () => {
      console.log("UDP server is listening on port 5300");
    });
  }

  async handleDoh(msg, rinfo, dohServer) {
    const dohResponse = await axios.post(dohServer, msg, {
      headers: {
        "Content-Type": "application/dns-message",
        Accept: "application/dns-message",
      },
      responseType: "arraybuffer",
    });

    this.#server.send(
      dohResponse.data,
      0,
      dohResponse.data.length,
      rinfo.port,
      rinfo.address
    );
  }

  async forwardToUDP(msg, rinfo, dnsServer) {
    const client = dgram.createSocket("udp4");
    client.send(msg, 0, msg.length, 53, dnsServer, () => {});

    client.on("message", (resp) => {
      server.send(resp, 0, resp.length, rinfo.port, rinfo.address);
      client.close();
    });
  }
}

function getDomainFromDnsQuery(msg) {
  const domain = msg.slice(12, msg.length - 4);
  let domainStr = "";
  for (let i = 0; i < domain.length; i++) {
    if (domain[i] === 0) break;
    domainStr += String.fromCharCode(domain[i]);
  }
  return domainStr;
}

class DomainManager {
  domainFile;
  domains;

  constructor(domainFile) {
    this.domainFile = domainFile;
    this.domains = new Set();
  }

  async loadDomains() {
    const data = await fs.readFile(
      path.isAbsolute(this.domainFile)
        ? this.domainFile
        : path.resolve(process.cwd(), this.domainFile),
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

program
  .command("start")
  .option("-f, --domain_file <file>", "domain file")
  .option("-p, --port <port>", "port", 53)
  .option("-c, --china_server <chinaServer>", "China DNS server", "223.5.5.5")
  .option(
    "-t, --trust_dns_server <trustDnsServer>",
    "Trust DNS server",
    "https://1.1.1.1/dns-query"
  )
  .action(async (options) => {
    const server = new DNSServer(options);
    await server.run();
  });

program.parse(process.argv);
