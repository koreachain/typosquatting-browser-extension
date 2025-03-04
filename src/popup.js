// Use the appropriate API based on browser environment
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

document.addEventListener("DOMContentLoaded", function () {
  // Load and display whitelist
  loadWhitelist();

  // Load toggle state
  loadToggleState();

  // Add domain button
  document.getElementById("add-domain").addEventListener("click", function () {
    addDomain();
  });

  // Add current domain button
  document.getElementById("add-current").addEventListener("click", function () {
    addCurrentDomain();
  });

  // Enter key in input field
  document
    .getElementById("new-domain")
    .addEventListener("keyup", function (event) {
      if (event.key === "Enter") {
        addDomain();
      }
    });

  // Export domains button
  document
    .getElementById("export-domains")
    .addEventListener("click", function () {
      exportDomains();
    });

  // Import domains button
  document
    .getElementById("import-domains")
    .addEventListener("click", function () {
      document.getElementById("import-file").click();
    });

  // Import file change
  document
    .getElementById("import-file")
    .addEventListener("change", function (event) {
      importDomains(event);
    });

  // Preemptive check toggle
  document
    .getElementById("preemptive-check-toggle")
    .addEventListener("change", function () {
      togglePreemptiveChecks(this.checked);
    });
});

function loadWhitelist() {
  browserAPI.storage.local.get(["whitelist"], function (result) {
    const whitelist = result.whitelist || [];
    const whitelistElement = document.getElementById("whitelist");
    whitelistElement.innerHTML = "";

    // Sort the whitelist alphabetically (case-insensitive)
    whitelist.sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );

    if (whitelist.length === 0) {
      whitelistElement.innerHTML =
        '<li class="empty-list">No domains in whitelist</li>';
      return;
    }

    whitelist.forEach(function (domain) {
      const li = document.createElement("li");

      const domainEntry = document.createElement("div");
      domainEntry.className = "domain-entry";

      // Text for the domain
      const domainText = document.createTextNode(domain);
      domainEntry.appendChild(domainText);

      // Add wildcard badge if it's a wildcard domain
      if (domain.startsWith("*.")) {
        const badge = document.createElement("span");
        badge.className = "wildcard-badge";
        badge.textContent = "WILDCARD";
        domainEntry.appendChild(badge);
      }

      li.appendChild(domainEntry);

      const removeButton = document.createElement("button");
      removeButton.textContent = "Remove";
      removeButton.className = "remove-btn";
      removeButton.addEventListener("click", function () {
        removeDomain(domain);
      });

      li.appendChild(removeButton);
      whitelistElement.appendChild(li);
    });
  });
}

function loadToggleState() {
  browserAPI.storage.local.get(["enablePreemptiveChecks"], function (result) {
    document.getElementById("preemptive-check-toggle").checked =
      result.enablePreemptiveChecks === undefined
        ? true
        : result.enablePreemptiveChecks;
  });
}

function togglePreemptiveChecks(enabled) {
  browserAPI.runtime.sendMessage({
    action: "togglePreemptiveChecks",
    enabled: enabled,
  });
}

function addDomain() {
  const input = document.getElementById("new-domain");
  let domain = input.value.trim();

  // Basic validation
  if (!domain) {
    return;
  }

  // Remove protocol if present
  if (domain.startsWith("http://") || domain.startsWith("https://")) {
    domain = domain.split("//")[1];
  }

  // Remove path and query parameters if present
  domain = domain.split("/")[0];

  browserAPI.storage.local.get(["whitelist"], function (result) {
    const whitelist = result.whitelist || [];
    if (!whitelist.includes(domain)) {
      whitelist.push(domain);
      browserAPI.storage.local.set({ whitelist: whitelist }, function () {
        input.value = "";
        loadWhitelist();
      });
    } else {
      input.value = "";
      alert("This domain is already in your whitelist.");
    }
  });
}

function addCurrentDomain() {
  browserAPI.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs[0]) {
      const url = new URL(tabs[0].url);
      const domain = url.hostname;

      browserAPI.storage.local.get(["whitelist"], function (result) {
        const whitelist = result.whitelist || [];
        if (!whitelist.includes(domain)) {
          whitelist.push(domain);
          browserAPI.storage.local.set({ whitelist: whitelist }, function () {
            loadWhitelist();
          });
        } else {
          alert("This domain is already in your whitelist.");
        }
      });
    }
  });
}

function removeDomain(domain) {
  browserAPI.storage.local.get(["whitelist"], function (result) {
    let whitelist = result.whitelist || [];
    whitelist = whitelist.filter((d) => d !== domain);
    browserAPI.storage.local.set({ whitelist: whitelist }, function () {
      loadWhitelist();
    });
  });
}

function exportDomains() {
  browserAPI.storage.local.get(["whitelist"], function (result) {
    const whitelist = result.whitelist || [];
    const dataStr = JSON.stringify(whitelist, null, 2);
    const dataUri =
      "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

    const exportLink = document.createElement("a");
    exportLink.setAttribute("href", dataUri);
    exportLink.setAttribute(
      "download",
      "whitelist_domains_" + new Date().toISOString().split("T")[0] + ".json",
    );
    exportLink.click();
  });
}

function importDomains(event) {
  const file = event.target.files[0];

  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      const importedData = JSON.parse(e.target.result);

      if (!Array.isArray(importedData)) {
        alert(
          "Invalid format. The imported file must contain a JSON array of domains.",
        );
        return;
      }

      browserAPI.storage.local.get(["whitelist"], function (result) {
        let whitelist = result.whitelist || [];

        // Add unique domains from imported list
        importedData.forEach(function (domain) {
          if (typeof domain === "string" && !whitelist.includes(domain)) {
            whitelist.push(domain);
          }
        });

        browserAPI.storage.local.set({ whitelist: whitelist }, function () {
          loadWhitelist();
          alert(`Successfully imported ${importedData.length} domains.`);
        });
      });
    } catch (error) {
      alert("Error parsing the imported file: " + error.message);
    }
  };

  reader.readAsText(file);
  // Reset the file input so the same file can be imported again if needed
  event.target.value = null;
}
