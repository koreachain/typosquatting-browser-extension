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

async function loadWhitelist() {
  try {
    const result = await getStorageWithFallback(["whitelist"]);
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
  } catch (error) {
    console.error('Failed to load whitelist:', error);
    const whitelistElement = document.getElementById("whitelist");
    whitelistElement.innerHTML = '<li class="empty-list error">Failed to load whitelist</li>';
  }
}

async function addDomain() {
  const input = document.getElementById("new-domain");
  let domain = input.value.trim();

  // Basic validation
  if (!domain) {
    return;
  }

  try {
    // Remove protocol if present
    if (domain.startsWith("http://") || domain.startsWith("https://")) {
      domain = domain.split("//")[1];
    }

    // Remove path and query parameters if present
    domain = domain.split("/")[0];

    const result = await getStorageWithFallback(["whitelist"]);
    const whitelist = result.whitelist || [];
    if (!whitelist.includes(domain)) {
      whitelist.push(domain);
      await setStorageWithFallback({ whitelist: whitelist });
      input.value = "";
      loadWhitelist();
    } else {
      input.value = "";
      alert("This domain is already in your whitelist.");
    }
  } catch (error) {
    console.error('Failed to add domain:', error);
    alert("Failed to add domain. Please try again.");
  }
}

async function addCurrentDomain() {
  try {
    const tabs = await browserAPI.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tabs[0]) {
      const url = new URL(tabs[0].url);
      const domain = url.hostname;

      const result = await getStorageWithFallback(["whitelist"]);
      const whitelist = result.whitelist || [];
      if (!whitelist.includes(domain)) {
        whitelist.push(domain);
        await setStorageWithFallback({ whitelist: whitelist });
        loadWhitelist();
      } else {
        alert("This domain is already in your whitelist.");
      }
    }
  } catch (error) {
    console.error('Failed to add current domain:', error);
    alert("Failed to add current domain. Please try again.");
  }
}

async function removeDomain(domain) {
  try {
    const result = await getStorageWithFallback(["whitelist"]);
    let whitelist = result.whitelist || [];
    whitelist = whitelist.filter((d) => d !== domain);
    await setStorageWithFallback({ whitelist: whitelist });
    loadWhitelist();
  } catch (error) {
    console.error('Failed to remove domain:', error);
    alert("Failed to remove domain. Please try again.");
  }
}
