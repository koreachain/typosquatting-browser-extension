// Use the appropriate API based on browser environment
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

let enablePreemptiveChecks = true;
let enableCountryBlock = true;
let sessionAllowedDomains = [];

// Helper function to safely get storage with fallback
async function getStorageWithFallback(keys) {
  try {
    const result = await browserAPI.storage.sync.get(keys);
    return result;
  } catch (error) {
    console.warn('Sync storage failed, falling back to local storage:', error);
    try {
      return await browserAPI.storage.local.get(keys);
    } catch (localError) {
      console.error('Both sync and local storage failed:', localError);
      return {};
    }
  }
}

// Helper function to safely set storage with fallback
async function setStorageWithFallback(data) {
  try {
    await browserAPI.storage.sync.set(data);
    // Also save to local storage as backup
    await browserAPI.storage.local.set(data);
  } catch (error) {
    console.warn('Sync storage failed, using local storage only:', error);
    try {
      await browserAPI.storage.local.set(data);
    } catch (localError) {
      console.error('Both sync and local storage failed:', localError);
      throw localError;
    }
  }
}

browserAPI.runtime.onInstalled.addListener(async () => {
  try {
    // Initialize with empty whitelist and enabled preemptive checks
    const result = await browserAPI.storage.sync.get([
      "whitelist",
      "enablePreemptiveChecks",
      "enableCountryBlock",
      "blockedCountries"
    ]);
    
    const updates = {};
    
    if (!result.whitelist) {
      updates.whitelist = [];
    }
    if (result.enablePreemptiveChecks === undefined) {
      updates.enablePreemptiveChecks = true;
    }
    if (result.enableCountryBlock === undefined) {
      updates.enableCountryBlock = true;
    }
    if (!result.blockedCountries) {
      updates.blockedCountries = [];
    }
    
    // Only update storage if there are changes needed
    if (Object.keys(updates).length > 0) {
      await browserAPI.storage.sync.set(updates);
    }
  } catch (error) {
    console.error('Failed to initialize extension settings:', error);
    
    // Fallback to local storage if sync fails
    try {
      const localResult = await browserAPI.storage.local.get([
        "whitelist",
        "enablePreemptiveChecks", 
        "enableCountryBlock",
        "blockedCountries"
      ]);
      
      const localUpdates = {};
      
      if (!localResult.whitelist) {
        localUpdates.whitelist = [];
      }
      if (localResult.enablePreemptiveChecks === undefined) {
        localUpdates.enablePreemptiveChecks = true;
      }
      if (localResult.enableCountryBlock === undefined) {
        localUpdates.enableCountryBlock = true;
      }
      if (!localResult.blockedCountries) {
        localUpdates.blockedCountries = [];
      }
      
      if (Object.keys(localUpdates).length > 0) {
        await browserAPI.storage.local.set(localUpdates);
      }
    } catch (localError) {
      console.error('Failed to initialize extension settings with local storage:', localError);
    }
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
  const result = await getStorageWithFallback(["enableCountryBlock"]);
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
  const result = await getStorageWithFallback(["blockedCountries"]);
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
  const result = await getStorageWithFallback([
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
    getStorageWithFallback(["whitelist"]).then((result) => {
      const whitelist = result.whitelist || [];
      if (!whitelist.includes(message.domain)) {
        whitelist.push(message.domain);
        setStorageWithFallback({ whitelist }).then(() => {
          browserAPI.tabs.update(message.tabId, { url: message.url });
        }).catch((error) => {
          console.error('Failed to save whitelist:', error);
          // Still navigate even if save failed
          browserAPI.tabs.update(message.tabId, { url: message.url });
        });
      } else {
        browserAPI.tabs.update(message.tabId, { url: message.url });
      }
    }).catch((error) => {
      console.error('Failed to get whitelist:', error);
      // Still navigate even if storage failed
      browserAPI.tabs.update(message.tabId, { url: message.url });
    });
  } else if (message.action === "exitNavigation") {
    browserAPI.tabs.remove(message.tabId);
  } else if (message.action === "togglePreemptiveChecks") {
    setStorageWithFallback({ enablePreemptiveChecks: message.enabled }).catch((error) => {
      console.error('Failed to save preemptive checks setting:', error);
    });
  } else if (message.action === "toggleCountryBlock") {
    setStorageWithFallback({ enableCountryBlock: message.enabled }).catch((error) => {
      console.error('Failed to save country block setting:', error);
    });
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
