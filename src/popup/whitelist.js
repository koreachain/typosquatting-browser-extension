async function loadWhitelist() {
  const result = await browserAPI.storage.local.get(["whitelist"]);
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
}

async function addDomain() {
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

  const result = await browserAPI.storage.local.get(["whitelist"]);
  const whitelist = result.whitelist || [];
  if (!whitelist.includes(domain)) {
    whitelist.push(domain);
    await browserAPI.storage.local.set({ whitelist: whitelist });
    input.value = "";
    loadWhitelist();
  } else {
    input.value = "";
    alert("This domain is already in your whitelist.");
  }
}

async function addCurrentDomain() {
  const tabs = await browserAPI.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (tabs[0]) {
    const url = new URL(tabs[0].url);
    const domain = url.hostname;

    const result = await browserAPI.storage.local.get(["whitelist"]);
    const whitelist = result.whitelist || [];
    if (!whitelist.includes(domain)) {
      whitelist.push(domain);
      await browserAPI.storage.local.set({ whitelist: whitelist });
      loadWhitelist();
    } else {
      alert("This domain is already in your whitelist.");
    }
  }
}

async function removeDomain(domain) {
  const result = await browserAPI.storage.local.get(["whitelist"]);
  let whitelist = result.whitelist || [];
  whitelist = whitelist.filter((d) => d !== domain);
  await browserAPI.storage.local.set({ whitelist: whitelist });
  loadWhitelist();
}
