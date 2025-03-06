// Use the appropriate API based on browser environment
const browserAPI = typeof browser !== "undefined" ? browser : chrome;
let warningBar = null;

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
      const result = await browserAPI.storage.sync.get(["whitelist"]);
      const whitelist = result.whitelist || [];
      if (!whitelist.includes(domain)) {
        whitelist.push(domain);
        browserAPI.storage.sync.set({ whitelist });
      }
      warningBar.remove();
    });

  // Add wildcard whitelist button listener
  document
    .getElementById("wildcard-whitelist-btn")
    .addEventListener("click", () => {
      const result = browserAPI.storage.sync.get(["whitelist"]);
      const whitelist = result.whitelist || [];
      const wildcardDomain = `*.${rootDomain}`;
      if (!whitelist.includes(wildcardDomain)) {
        whitelist.push(wildcardDomain);
        browserAPI.storage.sync.set({ whitelist });
      }
      warningBar.remove();
    });

  document.getElementById("close-warning-btn").addEventListener("click", () => {
    warningBar.remove();
  });
}

async function checkDomain() {
  const currentDomain = getDomain(window.location.href);

  const result = await browserAPI.storage.sync.get(["whitelist"]);
  const whitelist = result.whitelist || [];

  if (!isWhitelisted(currentDomain, whitelist)) {
    createWarningBar(currentDomain);
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
