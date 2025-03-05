// Use the appropriate API based on browser environment
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

let enablePreemptiveChecks = true;
let enableCountryBlock = true;
let sessionAllowedDomains = [];

browserAPI.runtime.onInstalled.addListener(() => {
  // Initialize with empty whitelist and enabled preemptive checks
  const result = browserAPI.storage.local.get([
    "whitelist",
    "enablePreemptiveChecks",
  ]);
  if (!result.whitelist) {
    browserAPI.storage.local.set({ whitelist: [] });
  }
  if (result.enablePreemptiveChecks === undefined) {
    browserAPI.storage.local.set({ enablePreemptiveChecks: true });
  }
  if (result.enableCountryBlock === undefined) {
    browserAPI.storage.local.set({ enableCountryBlock: true });
  }
});

// Listen for tab updates
browserAPI.webNavigation.onCommitted.addListener((details) => {
  // Only check main frame navigations
  if (details.frameId === 0) {
    checkTabNavigation(details.tabId, details.url);
  }
});

// Geolocation Checks
async function checkIPGeolocation(url) {
  const result = await browserAPI.storage.local.get(["enableCountryBlock"]);
  if (!result.enableCountryBlock) {
    return {
      status: "disabled",
    };
  }

  try {
    const hostname = new URL(url).hostname;
    const response = await fetch(`http://ip-api.com/json/${hostname}`);
    const data = await response.json();

    return {
      status: "enabled",
      country: data.country,
      countryCode: data.countryCode,
      region: data.regionName,
      city: data.city,
      ip: data.query,
      isp: data.isp,
      risk: await assessGeographicalRisk(data.countryCode),
    };
  } catch (error) {
    return {
      error: "Geolocation lookup failed",
    };
  }
}

async function assessGeographicalRisk(countryCode) {
  const result = await browserAPI.storage.local.get(["blockedCountries"]);
  const blockedCountries = result.blockedCountries || [];

  if (blockedCountries.map((c) => JSON.parse(c).code).includes(countryCode)) {
    return "High";
  }
  return "Low";
}

function getDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return "";
  }
}

function isWhitelisted(domain, whitelist) {
  // Direct match
  if (whitelist.includes(domain)) {
    return true;
  }

  // Check for wildcard matches
  for (const entry of whitelist) {
    if (entry.startsWith("*.") && domain.endsWith(entry.substring(2))) {
      return true;
    }
  }

  return false;
}

async function checkTabNavigation(tabId, url) {
  const result = await browserAPI.storage.local.get([
    "whitelist",
    "enablePreemptiveChecks",
  ]);
  if (!result.enablePreemptiveChecks) return;

  const whitelist = result.whitelist || [];
  const domain = getDomain(url);

  // Skip about:, chrome:, moz:, file: and empty URLs
  if (
    !domain ||
    url.startsWith("about:") ||
    url.startsWith("chrome:") ||
    url.startsWith("moz:") ||
    url.startsWith("file:") ||
    url.includes("confirmation.html")
  ) {
    return;
  }

  // Skip whitelisted domains and session-allowed domains
  if (
    isWhitelisted(domain, whitelist) ||
    sessionAllowedDomains.includes(domain)
  ) {
    return;
  }

  // Create a confirmation popup
  browserAPI.tabs.update(tabId, {
    url: browserAPI.runtime.getURL(
      `confirmation.html?domain=${encodeURIComponent(domain)}&url=${encodeURIComponent(url)}&tabId=${tabId}`,
    ),
  });
}

// Listen for messages from confirmation.html
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "continueNavigation") {
    // Add domain to session-allowed list
    const domain = message.domain;
    if (domain && !sessionAllowedDomains.includes(domain)) {
      sessionAllowedDomains.push(domain);
    }
    browserAPI.tabs.update(message.tabId, { url: message.url });
  } else if (message.action === "whitelistAndContinue") {
    // Add domain to global whitelist
    browserAPI.storage.local.get(["whitelist"]).then((result) => {
      const whitelist = result.whitelist || [];
      if (!whitelist.includes(message.domain)) {
        whitelist.push(message.domain);
        browserAPI.storage.local.set({ whitelist }).then(() => {
          browserAPI.tabs.update(message.tabId, { url: message.url });
        });
      } else {
        browserAPI.tabs.update(message.tabId, { url: message.url });
      }
    });
  } else if (message.action === "exitNavigation") {
    browserAPI.tabs.remove(message.tabId);
  } else if (message.action === "togglePreemptiveChecks") {
    browserAPI.storage.local.set({ enablePreemptiveChecks: message.enabled });
  } else if (message.action === "toggleCountryBlock") {
    browserAPI.storage.local.set({ enableCountryBlock: message.enabled });
  } else if (message.action === "securityCheck") {
    // Handle security check requests
    Promise.all([checkIPGeolocation(message.url)])
      .then(([geoCheck]) => {
        sendResponse({ geo: geoCheck });
      })
      .catch((error) => {
        sendResponse({ error: error.message });
      });
    return true;
  }
});

// Clear session-allowed domains when browser is closed (via extension unload)
browserAPI.runtime.onSuspend?.addListener(() => {
  sessionAllowedDomains = [];
});
