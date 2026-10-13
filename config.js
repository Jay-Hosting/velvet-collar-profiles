// Site settings.
// The site answers on velvetcollarsac.com (and the old profiles.jay-hosting.com during the move);
// each one talks to the API address on the same domain. No trailing slash.
window.VC_CONFIG = {
  API_URL: /(^|\.)velvetcollarsac\.com$/i.test(location.hostname) ? "https://api.velvetcollarsac.com" : "https://profiles-api.jay-hosting.com",
  // Shown on the landing page.
  GROUP_NAME: "Velvet Collar",
};
