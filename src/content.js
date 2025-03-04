// Use the appropriate API based on browser environment
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

let warningBar = null;

function getDomain(url) {
  const a = document.createElement("a");
  a.href = url;
  return a.hostname;
}

function createWarningBar(domain) {
  // Remove existing warning bar if it exists
  if (warningBar) {
    warningBar.remove();
  }

  // Create warning bar
  warningBar = document.createElement("div");
  warningBar.id = "whitelist-warning-bar";
  warningBar.innerHTML = `
    <span class="warning-text">⚠️ Non-whitelisted domain: <strong>${domain}</strong> could be insecure</span>
    <button id="whitelist-btn">Whitelist this domain</button>
    <button id="close-warning-btn">×</button>
  `;

  // Insert at the top of the body
  document.body.insertBefore(warningBar, document.body.firstChild);

  // Add event listeners
  document.getElementById("whitelist-btn").addEventListener("click", () => {
    browserAPI.storage.local.get(["whitelist"], (result) => {
      const whitelist = result.whitelist || [];
      if (!whitelist.includes(domain)) {
        whitelist.push(domain);
        browserAPI.storage.local.set({ whitelist });
      }
      warningBar.remove();
    });
  });

  document.getElementById("close-warning-btn").addEventListener("click", () => {
    warningBar.remove();
  });
}

function checkDomain() {
  const currentDomain = getDomain(window.location.href);

  browserAPI.storage.local.get(["whitelist"], (result) => {
    const whitelist = result.whitelist || [];
    if (!whitelist.includes(currentDomain)) {
      createWarningBar(currentDomain);
    }
  });
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
