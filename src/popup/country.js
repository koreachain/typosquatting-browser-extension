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

function loadCountries() {
  const countrySelect = document.getElementById("country-select");

  // Fetch countries from JSON
  fetch("countries.json")
    .then((response) => response.json())
    .then((data) => {
      // Sort countries alphabetically by name
      const sortedCountries = data.sort((a, b) => a.name.localeCompare(b.name));

      // Populate dropdown with sorted countries
      sortedCountries.forEach((country) => {
        const option = document.createElement("option");
        option.value = JSON.stringify(country);
        option.textContent = country.name;
        countrySelect.appendChild(option);
      });
    })
    .catch((error) => {
      console.error("Error loading countries:", error);

      // Fallback to a basic list if JSON loading fails
      const fallbackCountries = [
        { code: "US", name: "United States" },
        { code: "RU", name: "Russia" },
        { code: "CN", name: "China" },
      ].sort((a, b) => a.name.localeCompare(b.name));

      fallbackCountries.forEach((country) => {
        const option = document.createElement("option");
        option.value = JSON.stringify(country);
        option.textContent = country.name;
        countrySelect.appendChild(option);
      });
    });
}

async function blockCountry(country) {
  try {
    const countrySelect = document.getElementById("country-select");

    const result = await getStorageWithFallback(["blockedCountries"]);
    const blockedCountries = result.blockedCountries || [];
    if (!blockedCountries.includes(country)) {
      blockedCountries.push(country);
      await setStorageWithFallback({ blockedCountries });
      loadBlockedCountries();
      countrySelect.value = ""; // Reset selection
    }
  } catch (error) {
    console.error('Failed to block country:', error);
    alert("Failed to block country. Please try again.");
  }
}

async function removeCountry(coutryCode) {
  try {
    const result = await getStorageWithFallback(["blockedCountries"]);
    const blockedCountries = result.blockedCountries || [];
    const updatedCountries = blockedCountries.filter(
      (c) => JSON.parse(c).code !== coutryCode,
    );

    await setStorageWithFallback({
      blockedCountries: updatedCountries,
    });
    loadBlockedCountries();
  } catch (error) {
    console.error('Failed to remove country:', error);
    alert("Failed to remove country. Please try again.");
  }
}

async function loadBlockedCountries() {
  try {
    const result = await getStorageWithFallback(["blockedCountries"]);
    const blockedCountries = result.blockedCountries || [];
    const blockedCountriesElement = document.getElementById("blocked-countries");
    blockedCountriesElement.innerHTML = "";

    if (blockedCountries.length === 0) {
      blockedCountriesElement.innerHTML =
        '<li class="empty-list">No countries blocked</li>';
      return;
    }

    blockedCountries.forEach(function (c) {
      const country = JSON.parse(c);
      const li = document.createElement("li");

      const countryEntry = document.createElement("div");
      countryEntry.className = "domain-entry";

      // Text for the domain
      const countryText = document.createTextNode(country.name);
      countryEntry.appendChild(countryText);

      li.appendChild(countryEntry);

      const removeButton = document.createElement("button");
      removeButton.textContent = "Remove";
      removeButton.className = "remove-btn";
      removeButton.addEventListener("click", function () {
        removeCountry(country.code);
      });

      li.appendChild(removeButton);
      blockedCountriesElement.appendChild(li);
    });
  } catch (error) {
    console.error('Failed to load blocked countries:', error);
    const blockedCountriesElement = document.getElementById("blocked-countries");
    blockedCountriesElement.innerHTML = '<li class="empty-list error">Failed to load blocked countries</li>';
  }
}
