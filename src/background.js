// Use the appropriate API based on browser environment
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

let enablePreemptiveChecks = true;
let sessionAllowedDomains = [];

browserAPI.runtime.onInstalled.addListener(() => {
  // Initialize with empty whitelist and enabled preemptive checks
  browserAPI.storage.local.get(
    ["whitelist", "enablePreemptiveChecks"],
    (result) => {
      if (!result.whitelist) {
        browserAPI.storage.local.set({ whitelist: [] });
      }
      if (result.enablePreemptiveChecks === undefined) {
        browserAPI.storage.local.set({ enablePreemptiveChecks: true });
      }
    },
  );
});

// Listen for tab updates
browserAPI.webNavigation.onCommitted.addListener((details) => {
  // Only check main frame navigations
  if (details.frameId === 0) {
    checkTabNavigation(details.tabId, details.url);
  }
});

function getDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return "";
  }
}

function checkTabNavigation(tabId, url) {
  browserAPI.storage.local.get(
    ["whitelist", "enablePreemptiveChecks"],
    (result) => {
      if (!result.enablePreemptiveChecks) {
        return;
      }

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
        whitelist.includes(domain) ||
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
    },
  );
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
    browserAPI.storage.local.get(["whitelist"], (result) => {
      const whitelist = result.whitelist || [];
      if (!whitelist.includes(message.domain)) {
        whitelist.push(message.domain);
        browserAPI.storage.local.set({ whitelist }, () => {
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
  }
});

// Clear session-allowed domains when browser is closed (via extension unload)
browserAPI.runtime.onSuspend?.addListener(() => {
  sessionAllowedDomains = [];
});
