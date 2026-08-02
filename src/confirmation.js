// Use the appropriate API based on browser environment
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

// Common Country-Code TLDs and Second-Level Domains for wildcard root extraction
const CC_TLDS = new Set([
  "br", "uk", "au", "jp", "de", "fr", "it", "es", "nl", "ru",
  "cn", "in", "ca", "mx", "kr", "pl", "se", "no", "dk", "fi",
  "at", "ch", "be", "ie", "nz", "za", "ar", "cl", "co", "ve",
  "sg", "hk", "tw", "th", "ph", "my", "id", "vn", "eg", "sa",
  "ae", "il", "tr", "gr", "pt", "cz", "ro", "hu", "bg", "hr",
  "sk", "si", "ee", "lv", "lt", "lu", "mt", "cy"
]);
const CC_SLDS = new Set(["com", "co", "net", "org", "gov", "edu", "ac"]);

/**
 * Extract the root domain accurately, handling both standard domains (example.com)
 * and country-code second-level domains (example.co.uk, google.com.br).
 */
function getRootDomain(domain) {
  if (!domain) return "";
  const domainParts = domain.split(".");
  if (domainParts.length <= 2) return domain;

  const lastPart = domainParts[domainParts.length - 1].toLowerCase();
  const secondLastPart = domainParts[domainParts.length - 2].toLowerCase();

  // Handle ccSLD patterns (e.g., google.com.br, amazon.co.uk)
  if (CC_TLDS.has(lastPart) && CC_SLDS.has(secondLastPart)) {
    return domainParts.slice(-3).join(".");
  }

  // Handle standard domains (e.g., www.amazon.de, sub.example.com)
  return domainParts.slice(-2).join(".");
}

/**
 * Basic HTML escaping to prevent DOM-based XSS when rendering dynamic metadata.
 */
function escapeHTML(str) {
  if (!str) return "Unknown";
  return String(str).replace(/[&<>"']/g, (m) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[m];
  });
}

document.addEventListener("DOMContentLoaded", async function () {
  const urlParams = new URLSearchParams(window.location.search);
  const domain = urlParams.get("domain") || "";
  const warningType = urlParams.get("type");
  const url = urlParams.get("url") || "";
  const tabId = parseInt(urlParams.get("tabId"), 10) || null;

  const domainNameElement = document.getElementById("domain-name");
  if (domainNameElement) {
    domainNameElement.textContent = domain;
  }

  const detailsElement = document.getElementById("security-details");

  // Fetch additional details from background worker
  try {
    const response = await browserAPI.runtime.sendMessage({
      action: "securityCheck",
      url: url,
    });

    if (response?.geo && detailsElement) {
      let contentHtml = "";

      if (response.geo.status === "disabled") {
        contentHtml = `<p>Geolocation checks disabled</p>`;
      } else if (response.geo.status === "enabled") {
        if (response.geo.risk === "High") {
          const iconElem = document.getElementById("icon");
          const titleElem = document.getElementById("title");
          if (iconElem) iconElem.textContent = "❗";
          if (titleElem) titleElem.textContent = "Blocked Country";

          contentHtml += `
            <p>
              <strong>Geographical Risk Warning</strong><br>
              This domain originates from a country which you explicitly block.
            </p>
          `;

          // Remove bypass options for high-risk domains
          document.getElementById("wildcard-continue")?.remove();
          document.getElementById("just-continue")?.remove();
        }

        contentHtml += `
          <p>
            <strong>Geolocation:</strong><br>
            Country: ${escapeHTML(response.geo.country)}<br>
            Region: ${escapeHTML(response.geo.region)}<br>
            IP: ${escapeHTML(response.geo.ip)}<br>
            ISP: ${escapeHTML(response.geo.isp)}<br>
            Risk Level: <strong>${escapeHTML(response.geo.risk)}</strong>
          </p>
        `;
      }

      detailsElement.innerHTML = contentHtml;
    }
  } catch (error) {
    console.error("Failed to fetch security details:", error);
  }

  // Event Listeners with Safe Optional Chaining
  document.getElementById("whitelist-continue")?.addEventListener("click", () => {
    browserAPI.runtime.sendMessage({
      action: "whitelistAndContinue",
      domain: domain,
      url: url,
      tabId: tabId,
    });
  });

  document.getElementById("wildcard-continue")?.addEventListener("click", () => {
    const rootDomain = getRootDomain(domain);
    browserAPI.runtime.sendMessage({
      action: "whitelistAndContinue",
      domain: `*.${rootDomain}`,
      url: url,
      tabId: tabId,
    });
  });

  document.getElementById("just-continue")?.addEventListener("click", () => {
    browserAPI.runtime.sendMessage({
      action: "continueNavigation",
      domain: domain,
      url: url,
      tabId: tabId,
    });
  });

  document.getElementById("exit-page")?.addEventListener("click", () => {
    browserAPI.runtime.sendMessage({
      action: "exitNavigation",
      tabId: tabId,
    });
  });
});
