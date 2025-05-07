import dgram from "node:dgram";
import axios from "axios";
import { program } from "commander";

import logger from "./logger.mjs";
import { contextStorage } from "./context.mjs";
import { v4 as uuidv4 } from "uuid";
import { DomainManager } from "./domain-manager.mjs";

class DNSServer {
  #server;
  #options;

  constructor(options) {
    this.#options = options;
    this.#server = dgram.createSocket("udp4");
  }

  async run() {
    const { domain_file, china_server, trust_dns_server } = this.#options;

    const domainManager = new DomainManager();
    await domainManager.loadDomains(domain_file);

    this.#server.on("message", async (msg, rinfo) => {
      contextStorage.run({ reqId: uuidv4() }, async () => {
        const domain = getDomainFromDnsQuery(msg);
        logger.info({ domain }, "Received DNS query");

        const isChinaDomain = domainManager.isChinaDomain(domain);
        logger.info({ isChinaDomain }, "Domain classification");

        if (isChinaDomain) {
          logger.info("Forwarding to China DNS server");
          await this.forwardToUDP(msg, rinfo, china_server);
        } else {
          logger.info("Handling with DoH server");
          await this.handleDoh(msg, rinfo, trust_dns_server);
        }
      });
    });

    this.#server.bind(5300, () => {
      console.log("UDP server is listening on port 5300");
    });
  }

  async handleDoh(msg, rinfo, dohServer) {
    try {
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
      logger.info("Successfully forwarded DoH response to client");
    } catch (error) {
      logger.error(
        {
          dohServer,
          error: error.message,
          stack: error.stack,
        },
        "Error handling DoH request"
      );
    }
  }

  async forwardToUDP(msg, rinfo, dnsServer) {
    const client = dgram.createSocket("udp4");

    client.on("message", (resp) => {
      this.#server.send(resp, 0, resp.length, rinfo.port, rinfo.address);
      logger.info(
        {
          reqId: contextStorage.getStore()?.reqId,
        },
        "Successfully forwarded UDP response to client"
      );
      client.close();
    });

    client.on("error", (err) => {
      logger.error(
        {
          error: err.message,
          stack: err.stack,
        },
        "UDP client error"
      );
      client.close();
    });

    client.send(msg, 0, msg.length, 53, dnsServer, (err) => {
      if (err) {
        logger.error(
          {
            error: err.message,
            stack: err.stack,
          },
          "Error sending UDP message"
        );
        client.close();
      }
    });
  }
}

function getDomainFromDnsQuery(msg) {
  // The DNS query question section starts after a 12-byte header.
  // It ends 4 bytes before the end of the message (2 bytes for QTYPE, 2 bytes for QCLASS).
  const questionSection = msg.slice(12, msg.length - 4);
  let offset = 0;
  const labels = [];

  while (offset < questionSection.length) {
    const length = questionSection[offset];

    // A length of 0 indicates the end of the domain name.
    if (length === 0) {
      offset++; // Move past the null terminator
      break;
    }

    // Check for DNS pointers (compression). Not fully implementing decompression here for simplicity,
    // but recognizing it helps avoid misinterpreting pointer bytes as length bytes.
    // A pointer is indicated by the first two bits of the length byte being 11 (0xC0).
    if ((length & 0xc0) === 0xc0) {
      // For now, we'll just stop parsing if we encounter a pointer,
      // as fully resolving it would require parsing the rest of the message.
      // In many simple queries, pointers are not used for the first question name.
      // A more robust solution would handle pointers by jumping to the offset specified.
      logger.warn(
        "DNS pointer encountered in domain name, partial name might be returned."
      );
      break;
    }

    // Move past the length byte.
    offset++;

    // Ensure we don't read past the end of the buffer.
    if (offset + length > questionSection.length) {
      logger.error(
        "Malformed DNS query: label length exceeds question section."
      );
      return "[malformed_domain]"; // Or throw an error
    }

    const label = questionSection.toString("utf8", offset, offset + length);
    labels.push(label);
    offset += length;
  }

  // If no labels were parsed and we didn't just break on a root domain (offset might be 1 for final null byte)
  if (labels.length === 0 && offset <= 1) {
    // This could happen if the domain name is empty or just the root "."
    // or if we immediately hit a pointer we didn't process.
    // If offset is 1, it means we read a single null byte (root domain). Return "."
    if (offset === 1 && questionSection.length > 0 && questionSection[0] === 0)
      return ".";
    // Otherwise, it could be an issue or an unprocessed pointer.
    logger.warn(
      { questionSectionBytes: questionSection.toString("hex") },
      "Could not parse any labels from domain part."
    );
    // Fallback to old behavior for safety, though likely incorrect for these cases
    let fallbackDomainStr = "";
    for (let i = 0; i < questionSection.length; i++) {
      if (questionSection[i] === 0) break;
      fallbackDomainStr += String.fromCharCode(questionSection[i]);
    }
    return fallbackDomainStr || "[unknown_domain]";
  }

  return labels.join(".");
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
