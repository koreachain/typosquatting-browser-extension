// Use the appropriate API based on browser environment
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

document.addEventListener("DOMContentLoaded", async function () {
  const urlParams = new URLSearchParams(window.location.search);
  const domain = urlParams.get("domain");
  const warningType = urlParams.get("type");
  const url = urlParams.get("url");
  const tabId = parseInt(urlParams.get("tabId"));

  document.getElementById("domain-name").textContent = domain;

  const detailsElement = document.getElementById("security-details");

  // Fetch additional details
  const response = await browserAPI.runtime.sendMessage({
    action: "securityCheck",
    url: url,
  });

  if (response && response.geo) {
    if (response.geo.status === "disabled") {
      detailsElement.innerHTML = `
        <p>
          Geolocation checks disabled
        </p>
      `;
    }

    if (response.geo.status === "enabled" && response.geo) {
      if (response.geo.risk === "High") {
        document.getElementById("icon").textContent = "❗";
        document.getElementById("title").textContent = "Blocked Country";
        detailsElement.innerHTML = `
        <p>
          <strong>Geographical Risk Warning</strong><br>
          This domain originates from a country which you explicitly block.
        </p>
      `;

        document.getElementById("wildcard-continue").remove();
        document.getElementById("just-continue").remove();
      }

      detailsElement.innerHTML += `
      <p>
      <strong>Geolocation:</strong>
      <br>Country: ${response.geo.country || "Unknown"}
      <br>Region: ${response.geo.region || "Unknown"}
      <br>IP: ${response.geo.ip || "Unknown"}
      <br>ISP: ${response.geo.isp || "Unknown"}
      <br>Risk Level: <strong>${response.geo.risk || "Unknown"}</strong>
      </p>
    `;
    }
  }

  document
    .getElementById("whitelist-continue")
    .addEventListener("click", function () {
      browserAPI.runtime.sendMessage({
        action: "whitelistAndContinue",
        domain: domain,
        url: url,
        tabId: tabId,
      });
    });

  const wcelement = document.getElementById("wildcard-continue");
  wcelement &&
    wcelement.addEventListener("click", function () {
      // Get root domain for wildcard
      const domainParts = domain.split(".");
      let rootDomain = domain;
      if (domainParts.length > 2) {
        rootDomain = domainParts.slice(domainParts.length - 2).join(".");
      }

      browserAPI.runtime.sendMessage({
        action: "whitelistAndContinue",
        domain: `*.${rootDomain}`,
        url: url,
        tabId: tabId,
      });
    });

  const jcelement = document.getElementById("just-continue");
  jcelement &&
    jcelement.addEventListener("click", function () {
      browserAPI.runtime.sendMessage({
        action: "continueNavigation",
        domain: domain,
        url: url,
        tabId: tabId,
      });
    });

  document.getElementById("exit-page").addEventListener("click", function () {
    browserAPI.runtime.sendMessage({
      action: "exitNavigation",
      tabId: tabId,
    });
  });
});
