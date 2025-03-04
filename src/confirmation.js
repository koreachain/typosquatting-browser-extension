// Use the appropriate API based on browser environment
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

document.addEventListener("DOMContentLoaded", function () {
  const urlParams = new URLSearchParams(window.location.search);
  const domain = urlParams.get("domain");
  const url = urlParams.get("url");
  const tabId = parseInt(urlParams.get("tabId"));

  document.getElementById("domain-name").textContent = domain;

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

  document
    .getElementById("just-continue")
    .addEventListener("click", function () {
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
