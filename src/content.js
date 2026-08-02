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

let warningBar = null;

// Cache for whitelist to avoid repeated storage reads
let cachedWhitelist = null;
let whitelistCacheTimestamp = 0;
const CACHE_TTL = 5000; // 5 seconds cache TTL

/**
 * Safely read data from browser local storage with fallback
 */
async function getStorageWithFallback(keys) {
  try {
    return await browserAPI.storage.local.get(keys);
  } catch (error) {
    console.error("Failed to get from local storage:", error);
    return {};
  }
}

/**
 * Safely write data to browser local storage
 */
async function setStorageWithFallback(data) {
  try {
    await browserAPI.storage.local.set(data);
  } catch (error) {
    console.error("Failed to set local storage:", error);
    throw error;
  }
}

/**
 * Get whitelist with in-memory TTL caching
 */
async function getWhitelist() {
  const now = Date.now();
  if (cachedWhitelist !== null && now - whitelistCacheTimestamp < CACHE_TTL) {
    return cachedWhitelist;
  }

  const result = await getStorageWithFallback(["whitelist"]);
  cachedWhitelist = Array.isArray(result.whitelist) ? result.whitelist : [];
  whitelistCacheTimestamp = now;
  return cachedWhitelist;
}

/**
 * Extract hostname from a URL string
 */
function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * Extract root domain accurately, handling both standard domains (example.com)
 * and country-code second-level domains (example.co.uk, google.com.br).
 */
function getRootDomain(domain) {
  if (!domain) return "";
  const domainParts = domain.split(".");
  if (domainParts.length <= 2) return domain;

  const lastPart = domainParts[domainParts.length - 1].toLowerCase();
  const secondLastPart = domainParts[domainParts.length - 2].toLowerCase();

  if (CC_TLDS.has(lastPart) && CC_SLDS.has(secondLastPart)) {
    return domainParts.slice(-3).join(".");
  }

  return domainParts.slice(-2).join(".");
}

/**
 * Basic HTML escaping to prevent DOM-based XSS injections
 */
function escapeHTML(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, (m) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[m];
  });
}

/**
 * Check if domain is whitelisted (handles exact and wildcard matches safely)
 */
function isWhitelisted(domain, whitelist) {
  if (!domain || !Array.isArray(whitelist)) return false;

  if (whitelist.includes(domain)) {
    return true;
  }

  for (const entry of whitelist) {
    if (entry.startsWith("*.")) {
      const suffix = entry.slice(2);
      // Ensures sub.example.com matches *.example.com, but badexample.com does NOT match *.example.com
      if (domain === suffix || domain.endsWith(`.${suffix}`)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Helper to update whitelist storage and state in a single call
 */
async function addToWhitelist(entry) {
  try {
    const whitelist = await getWhitelist();
    if (!whitelist.includes(entry)) {
      const updatedWhitelist = [...whitelist, entry];
      await setStorageWithFallback({ whitelist: updatedWhitelist });
      cachedWhitelist = updatedWhitelist;
      whitelistCacheTimestamp = Date.now();
    }
    if (warningBar) {
      warningBar.remove();
      warningBar = null;
    }
  } catch (error) {
    console.error("Failed to update whitelist:", error);
  }
}

/**
 * Inject warning bar UI at top of page body
 */
function createWarningBar(domain) {
  if (warningBar) {
    warningBar.remove();
  }

  const rootDomain = getRootDomain(domain);
  const safeDomain = escapeHTML(domain);
  const safeRootDomain = escapeHTML(rootDomain);

  warningBar = document.createElement("div");
  warningBar.id = "whitelist-warning-bar";
  warningBar.innerHTML = `
    <span class="warning-text">⚠️ Non-whitelisted domain: <strong>${safeDomain}</strong> could be insecure</span>
    <button id="whitelist-btn">Whitelist this domain</button>
    <button id="wildcard-whitelist-btn">Whitelist *.${safeRootDomain}</button>
    <button id="close-warning-btn">×</button>
  `;

  document.body.insertBefore(warningBar, document.body.firstChild);

  // Bind events scoped directly to the newly created element (faster & safer than document.getElementById)
  warningBar.querySelector("#whitelist-btn")?.addEventListener("click", () => addToWhitelist(domain));
  warningBar.querySelector("#wildcard-whitelist-btn")?.addEventListener("click", () => addToWhitelist(`*.${rootDomain}`));
  warningBar.querySelector("#close-warning-btn")?.addEventListener("click", () => {
    warningBar?.remove();
    warningBar = null;
  });
}

/**
 * Evaluates current tab URL against the whitelist
 */
async function checkDomain() {
  try {
    const currentDomain = getDomain(window.location.href);
    if (!currentDomain) return;

    const whitelist = await getWhitelist();

    if (!isWhitelisted(currentDomain, whitelist)) {
      createWarningBar(currentDomain);
    } else if (warningBar) {
      warningBar.remove();
      warningBar = null;
    }
  } catch (error) {
    console.error("Failed to check domain:", error);
  }
}

// Initialize check on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", checkDomain);
} else {
  checkDomain();
}

// Invalidate cache and re-check if storage changes externally
browserAPI.storage.onChanged.addListener((changes) => {
  if (changes.whitelist) {
    cachedWhitelist = null;
    whitelistCacheTimestamp = 0;
    checkDomain();
  }
});
