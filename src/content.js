// Use the appropriate API based on browser environment
const browserAPI = typeof browser !== "undefined" ? browser : chrome;
let warningBar = null;

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
  const domainParts = domain.split(".");
  let rootDomain = domain;
  if (domainParts.length > 2) {
    rootDomain = domainParts.slice(domainParts.length - 2).join(".");
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
        const result = await getStorageWithFallback(["whitelist"]);
        const whitelist = result.whitelist || [];
        if (!whitelist.includes(domain)) {
          whitelist.push(domain);
          await setStorageWithFallback({ whitelist });
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
        const result = await getStorageWithFallback(["whitelist"]);
        const whitelist = result.whitelist || [];
        const wildcardDomain = `*.${rootDomain}`;
        if (!whitelist.includes(wildcardDomain)) {
          whitelist.push(wildcardDomain);
          await setStorageWithFallback({ whitelist });
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

    const result = await getStorageWithFallback(["whitelist"]);
    const whitelist = result.whitelist || [];

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
    checkDomain();
  }
});
