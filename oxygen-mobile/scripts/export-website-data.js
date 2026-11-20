// Run manually in the original website's browser DevTools console.
// Reads only the explicit personal-data keys below. Never exports auth tokens.
(() => {
  const keys = [
    "oxygen-notes-v1",
    "oxygen-todos-v1",
    "oxygen-events-v1",
    "oxygen-gaming-passport-v1",
    "oxygen-bookmarks-v1",
    "oxygen-calculator-history-v1",
    "oxygen-weather-city-v1",
    "oxygen-personalization-v1",
    "oxygen-chat-name-v1",
  ];
  const result = {
    format: "m8m8s-web-export-v1",
    storage: Object.fromEntries(
      keys.map((key) => [key, localStorage.getItem(key)]),
    ),
  };
  const anchor = document.createElement("a");
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(result)], { type: "application/json" }),
  );
  anchor.href = url;
  anchor.download = "M8M8S-website-data.json";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
})();
