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
  const countrySelect = document.getElementById("country-select");

  const result = await browserAPI.storage.sync.get(["blockedCountries"]);
  const blockedCountries = result.blockedCountries || [];
  if (!blockedCountries.includes(country)) {
    blockedCountries.push(country);
    await browserAPI.storage.sync.set({ blockedCountries });
    loadBlockedCountries();
    countrySelect.value = ""; // Reset selection
  }
}

async function removeCountry(coutryCode) {
  const result = await browserAPI.storage.sync.get(["blockedCountries"]);
  const blockedCountries = result.blockedCountries || [];
  const updatedCountries = blockedCountries.filter(
    (c) => JSON.parse(c).code !== coutryCode,
  );

  await browserAPI.storage.sync.set({
    blockedCountries: updatedCountries,
  });
  loadBlockedCountries();
}

async function loadBlockedCountries() {
  const result = await browserAPI.storage.sync.get(["blockedCountries"]);
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
}
