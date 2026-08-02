// Use the appropriate API based on browser environment
const browserAPI = typeof browser !== "undefined" ? browser : chrome;
let warningBar = null;

// Cache for whitelist to avoid repeated storage reads
let cachedWhitelist = null;
let whitelistCacheTimestamp = 0;
const CACHE_TTL = 5000; // 5 seconds cache TTL

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

// Helper function to safely set storage
async function setStorageWithFallback(data) {
  try {
    await browserAPI.storage.local.set(data);
  } catch (error) {
    console.error('Failed to set local storage:', error);
    throw error;
  }
}

// Get whitelist with caching
async function getWhitelist() {
  const now = Date.now();
  if (cachedWhitelist !== null && (now - whitelistCacheTimestamp) < CACHE_TTL) {
    return cachedWhitelist;
  }
  
  const result = await getStorageWithFallback(["whitelist"]);
  cachedWhitelist = result.whitelist || [];
  whitelistCacheTimestamp = now;
  return cachedWhitelist;
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

function createWarningBar(domain) {
  // Remove existing warning bar if it exists
  if (warningBar) {
    warningBar.remove();
  }

  // Get root domain for wildcard suggestion
  // For domains like google.com.br, we want to extract google.com.br, not com.br
  const domainParts = domain.split(".");
  let rootDomain = domain;
  
  // Common country-code TLDs to help identify ccSLDs
  const ccTLDs = new Set([
    "br", "uk", "au", "jp", "de", "fr", "it", "es", "nl", "ru", 
    "cn", "in", "ca", "mx", "kr", "pl", "se", "no", "dk", "fi",
    "at", "ch", "be", "ie", "nz", "za", "ar", "cl", "co", "ve",
    "sg", "hk", "tw", "th", "ph", "my", "id", "vn", "eg", "sa",
    "ae", "il", "tr", "gr", "pt", "cz", "ro", "hu", "bg", "hr",
    "sk", "si", "ee", "lv", "lt", "lu", "mt", "cy"
  ]);
  
  if (domainParts.length === 2) {
    // Simple domain like google.com - use as-is
    rootDomain = domain;
  } else if (domainParts.length === 3) {
    // Could be www.google.com or google.com.br
    const tld = domainParts[2].toLowerCase();
    if (ccTLDs.has(tld)) {
      // Likely a ccSLD like google.com.br - use all 3 parts
      rootDomain = domain;
    } else {
      // Likely a subdomain like www.google.com - use last 2 parts
      rootDomain = domainParts.slice(1).join(".");
    }
  } else if (domainParts.length >= 4) {
    // For www.google.com.br (4 parts), use last 3 parts: google.com.br
    // For a.b.google.com.br (5 parts), use last 3 parts: google.com.br
    rootDomain = domainParts.slice(-3).join(".");
  }

  // Create warning bar with added wildcard option
  warningBar = document.createElement("div");
  warningBar.id = "whitelist-warning-bar";
  warningBar.innerHTML = `
    <span class="warning-text">⚠️ Non-whitelisted domain: <strong>${domain}</strong> could be insecure</span>
    <button id="whitelist-btn">Whitelist this domain</button>
    <button id="wildcard-whitelist-btn">Whitelist *.${rootDomain}</button>
    <button id="close-warning-btn">×</button>
  `;

  // Insert at the top of the body
  document.body.insertBefore(warningBar, document.body.firstChild);

  // Add event listeners
  document
    .getElementById("whitelist-btn")
    .addEventListener("click", async () => {
      try {
        const whitelist = await getWhitelist();
        if (!whitelist.includes(domain)) {
          whitelist.push(domain);
          await setStorageWithFallback({ whitelist });
          // Update cache
          cachedWhitelist = whitelist;
        }
        warningBar.remove();
      } catch (error) {
        console.error('Failed to whitelist domain:', error);
      }
    });

  // Add wildcard whitelist button listener
  document
    .getElementById("wildcard-whitelist-btn")
    .addEventListener("click", async () => {
      try {
        const whitelist = await getWhitelist();
        const wildcardDomain = `*.${rootDomain}`;
        if (!whitelist.includes(wildcardDomain)) {
          whitelist.push(wildcardDomain);
          await setStorageWithFallback({ whitelist });
          // Update cache
          cachedWhitelist = whitelist;
        }
        warningBar.remove();
      } catch (error) {
        console.error('Failed to whitelist wildcard domain:', error);
      }
    });

  document.getElementById("close-warning-btn").addEventListener("click", () => {
    warningBar.remove();
  });
}

async function checkDomain() {
  try {
    const currentDomain = getDomain(window.location.href);
    const whitelist = await getWhitelist();

    if (!isWhitelisted(currentDomain, whitelist)) {
      createWarningBar(currentDomain);
    }
  } catch (error) {
    console.error('Failed to check domain:', error);
  }
}

// Wait for the DOM to be ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", checkDomain);
} else {
  checkDomain();
}

// Listen for changes to the whitelist
browserAPI.storage.onChanged.addListener((changes) => {
  if (changes.whitelist) {
    // Invalidate cache when whitelist changes
    cachedWhitelist = null;
    whitelistCacheTimestamp = 0;
    checkDomain();
  }
});
