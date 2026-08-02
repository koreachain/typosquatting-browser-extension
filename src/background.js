// Use the appropriate API based on browser environment
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

let enablePreemptiveChecks = true;
let enableCountryBlock = true;
let sessionAllowedDomains = [];

// Throttling for navigation checks
const navigationCheckThrottle = new Map();
const THROTTLE_DELAY = 100; // 100ms throttle

// Geolocation cache with TTL
const geolocationCache = new Map();
const GEOCACHE_TTL = 300000; // 5 minutes cache TTL
const GEOCACHE_MAX_SIZE = 1000; // Maximum cache entries

// Whitelist cache for background script
let cachedWhitelist = null;
let whitelistCacheTimestamp = 0;
const WHITELIST_CACHE_TTL = 5000; // 5 seconds cache TTL

// Helper function to safely get storage
async function getStorageWithFallback(keys) {
  try {
    const result = await browserAPI.storage.local.get(keys);
    return result;
  } catch (error) {
    console.error('Failed to get from local storage:', error);
    return {};
  }
}

// Get whitelist with caching
async function getWhitelist() {
  const now = Date.now();
  if (cachedWhitelist !== null && (now - whitelistCacheTimestamp) < WHITELIST_CACHE_TTL) {
    return cachedWhitelist;
  }
  
  const result = await getStorageWithFallback(["whitelist"]);
  cachedWhitelist = result.whitelist || [];
  whitelistCacheTimestamp = now;
  return cachedWhitelist;
}

// Helper function to safely set storage
async function setStorageWithFallback(data) {
  try {
    await browserAPI.storage.local.set(data);
  } catch (error) {
    console.error('Failed to set local storage:', error);
    throw error;
  }
}

browserAPI.runtime.onInstalled.addListener(async () => {
  try {
    // Initialize with empty whitelist and enabled preemptive checks
    const result = await browserAPI.storage.local.get([
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
      await browserAPI.storage.local.set(updates);
    }
  } catch (error) {
    console.error('Failed to initialize extension settings:', error);
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
    
    // Check cache first
    const now = Date.now();
    const cached = geolocationCache.get(hostname);
    if (cached && (now - cached.timestamp) < GEOCACHE_TTL) {
      return cached.data;
    }
    
    const response = await fetch(`http://ip-api.com/json/${hostname}`);
    const data = await response.json();

    const geoData = {
      status: "enabled",
      country: data.country,
      countryCode: data.countryCode,
      region: data.regionName,
      city: data.city,
      ip: data.query,
      isp: data.isp,
      risk: await assessGeographicalRisk(data.countryCode),
    };
    
    // Cache the result
    geolocationCache.set(hostname, {
      data: geoData,
      timestamp: now
    });
    
    // Clean up cache if too large
    if (geolocationCache.size > GEOCACHE_MAX_SIZE) {
      const oldestAllowed = now - GEOCACHE_TTL;
      for (const [key, value] of geolocationCache) {
        if (value.timestamp < oldestAllowed) {
          geolocationCache.delete(key);
        }
      }
    }
    
    return geoData;
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
  const now = Date.now();
  const lastCheck = navigationCheckThrottle.get(tabId);
  
  // Throttle checks for the same tab
  if (lastCheck && (now - lastCheck) < THROTTLE_DELAY) {
    return;
  }
  navigationCheckThrottle.set(tabId, now);
  
  // Clean up old throttle entries periodically
  if (navigationCheckThrottle.size > 100) {
    const oldestAllowed = now - THROTTLE_DELAY * 10;
    for (const [key, value] of navigationCheckThrottle) {
      if (value < oldestAllowed) {
        navigationCheckThrottle.delete(key);
      }
    }
  }

  const result = await getStorageWithFallback(["enablePreemptiveChecks"]);
  if (!result.enablePreemptiveChecks) return;

  const whitelist = await getWhitelist();
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
    getWhitelist().then((whitelist) => {
      if (!whitelist.includes(message.domain)) {
        whitelist.push(message.domain);
        setStorageWithFallback({ whitelist }).then(() => {
          // Update cache
          cachedWhitelist = whitelist;
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

// Listen for storage changes to invalidate caches
browserAPI.storage.onChanged.addListener((changes) => {
  if (changes.whitelist) {
    cachedWhitelist = null;
    whitelistCacheTimestamp = 0;
  }
});
