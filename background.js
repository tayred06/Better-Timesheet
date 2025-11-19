const trackedSites = [
  "jira.com",
  "github.com",
  "figma.com",
  "stackoverflow.com"
];

console.log('[TimeTracker] Background script loaded');

let currentSite = null;
let lastTime = Date.now();

console.log('[TimeTracker] Initial state:', { currentSite, lastTime });

// Helper function for wildcard matching
function matchesWildcard(str, rule) {
  // Escape regex characters except *
  const escapeRegex = (s) => s.replace(/([.+?^=!:${}()|[\]\/\\])/g, "\\$1");
  // Replace * with .*
  const regexString = "^" + rule.split("*").map(escapeRegex).join(".*") + "$";
  const regex = new RegExp(regexString);
  return regex.test(str);
}

// Met à jour le site actif
async function updateActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs.length) return;

  // Check if url is present (it might not be for some system pages)
  if (!tabs[0].url) return;

  try {
    const url = new URL(tabs[0].url);
    const hostname = url.hostname;
    const fullUrl = tabs[0].url;

    // Get all tracked sites from storage
    chrome.storage.local.get(null, (data) => {
      const allSites = Object.keys(data).filter(k =>
        k !== "__projects__" &&
        k !== "__notes__" &&
        k !== "__ui_state__" &&
        k !== "__timesheet_url__"
      );

      console.log(`[TimeTracker] Checking URL: ${fullUrl}`);
      console.log(`[TimeTracker] Tracked sites:`, allSites);

      // Find a match
      let foundSite = null;

      for (const site of allSites) {
        if (site.includes('*')) {
          // Wildcard match
          if (matchesWildcard(fullUrl, site)) {
            foundSite = site;
            console.log(`[TimeTracker] Wildcard match found: ${site}`);
            break;
          }
        } else {
          // Exact hostname match
          if (hostname === site || hostname.endsWith("." + site)) {
            foundSite = site;
            console.log(`[TimeTracker] Hostname match found: ${site}`);
            break;
          }
        }
      }

      // Update tracking
      if (foundSite) {
        if (currentSite !== foundSite) {
          console.log(`[TimeTracker] Switching from ${currentSite} to ${foundSite}`);
          // Save time for previous site
          if (currentSite) saveTime(currentSite);
          // Start tracking new site
          currentSite = foundSite;
          lastTime = Date.now();
        }
      } else {
        // Not on a tracked site
        console.log(`[TimeTracker] No match found for ${hostname}`);
        if (currentSite) {
          saveTime(currentSite);
          currentSite = null;
        }
      }
    });
  } catch (e) {
    // Ignore invalid URLs
    console.log("Invalid URL:", tabs[0].url);
  }
}

// Sauvegarde le temps passé
function saveTime(site) {
  const now = Date.now();
  const secondsSpent = Math.floor((now - lastTime) / 1000);

  console.log(`[TimeTracker] Saving time for ${site}: ${secondsSpent} seconds`);

  if (secondsSpent > 0) {
    chrome.storage.local.get([site], result => {
      const prev = result[site] || 0;
      const newTotal = prev + secondsSpent;
      chrome.storage.local.set({ [site]: newTotal }, () => {
        console.log(`[TimeTracker] Saved ${site}: ${newTotal} total seconds`);
      });
    });
  }

  lastTime = now;
}

// Use alarms API for reliable periodic saves (service workers can sleep)
chrome.alarms.create('saveTimer', { periodInMinutes: 1 / 6 }); // Every 10 seconds

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'saveTimer' && currentSite) {
    const now = Date.now();
    const secondsSpent = Math.floor((now - lastTime) / 1000);

    console.log(`[TimeTracker] Periodic save - Current site: ${currentSite}, seconds: ${secondsSpent}`);

    if (secondsSpent > 0) {
      chrome.storage.local.get([currentSite], result => {
        const prev = result[currentSite] || 0;
        const newTotal = prev + secondsSpent;
        chrome.storage.local.set({ [currentSite]: newTotal }, () => {
          console.log(`[TimeTracker] Periodic save complete: ${currentSite} = ${newTotal}s`);
        });
      });
      lastTime = now;
    }
  }
});

// Détecte les changements d’onglets
chrome.tabs.onActivated.addListener(updateActiveTab);

// Détecte les changements d’URL
chrome.tabs.onUpdated.addListener(updateActiveTab);

// Quand Chrome se ferme ou l’extension s’arrête
chrome.runtime.onSuspend.addListener(() => {
  if (currentSite) saveTime(currentSite);
});

// Open side panel on action click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));
