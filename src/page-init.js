/**
 * Page Initialization Script
 * Handles both MV2 and MV3 initialization paths
 */

// fixes already defined class Option, ugly ....
delete window.Option;

const html = document.documentElement;

// Detect manifest version
const manifestVersion = chrome.runtime.getManifest().manifest_version;
const isMV3 = manifestVersion === 3;

// parse parameters
const parameters = {};
for (let t of location.search.substr(1).split('&')) {
  if (t) {
    let p = t.split("=");
    parameters[p[0]] = p[1] || true;
  }
}

if (parameters.title)
  document.title = chrome.i18n.getMessage(parameters.title) || parameters.title;

if (parameters.withIcon)
  document.head.querySelector("link[rel='shortcut icon']").remove();

if (parameters.style)
  html.style = parameters.style;

if ((performance.now() < 60))
  document.documentElement.classList.add("visible");

html.dataset.bidi = parameters.bidi ? chrome.i18n.getMessage("@@bidi_dir") : "ltr";

/**
 * Update theme styles from storage
 */
async function updateThemeStyle() {
  if (isMV3) {
    // MV3: Get styles from chrome.storage
    const result = await chrome.storage.local.get([
      'style/theme',
      'style/background',
      'style/background-filter',
      'style/dock',
      'style/preload-images'
    ]);
    document.getElementById("style-theme").textContent = result['style/theme'] || '';
    document.getElementById("style-background").textContent = result['style/background'] || '';
    document.getElementById("style-background-filter").textContent = result['style/background-filter'] || '';
    document.getElementById("style-dock").textContent = result['style/dock'] || '';

    // preload images
    const imagesNeeded = (result['style/preload-images'] || "").split(",").filter(s => s.trim().length);
    const imagesLoaded = (html.dataset.preloadedImages || '').split(" ").filter(s => s.trim().length);
    const imagesNotLoaded = imagesNeeded.filter(src => !imagesLoaded.includes(src));

    if (imagesNotLoaded.length) {
      await Promise.all(imagesNotLoaded.map(src => new Promise(r => {
        const image = new Image();
        image.onerror = image.onload = r;
        image.src = src;
      })));
      html.dataset.preloadedImages = imagesNeeded.join(" ");
      if (html.classList.contains("visible")) {
        await new Promise(r => setTimeout(r, 200)); // give some time for bgr-transitions
      }
    }
  } else {
    // MV2: Get styles from localStorage
    document.getElementById("style-theme").textContent = localStorage.getItem('style/theme') || '';
    document.getElementById("style-background").textContent = localStorage.getItem('style/background') || '';
    document.getElementById("style-background-filter").textContent = localStorage.getItem('style/background-filter') || '';
    document.getElementById("style-dock").textContent = localStorage.getItem('style/dock') || '';

    // preload images
    const imagesNeeded = (localStorage.getItem('style/preload-images') || "").split(",").filter(s => s.trim().length);
    const imagesLoaded = (html.dataset.preloadedImages || '').split(" ").filter(s => s.trim().length);
    const imagesNotLoaded = imagesNeeded.filter(src => !imagesLoaded.includes(src));

    if (imagesNotLoaded.length) {
      await Promise.all(imagesNotLoaded.map(src => new Promise(r => {
        const image = new Image();
        image.onerror = image.onload = r;
        image.src = src;
      })));
      html.dataset.preloadedImages = imagesNeeded.join(" ");
      if (html.classList.contains("visible")) {
        await new Promise(r => setTimeout(r, 200));
      }
    }
  }
}

/**
 * Initialize for MV3
 */
async function initMV3() {
  console.log('[MV3 Init] Starting...');

  // Wait for service worker to be ready
  await new Promise((resolve, reject) => {
    console.log('[MV3 Init] Pinging service worker...');
    chrome.runtime.sendMessage({ action: 'ping' }, response => {
      if (chrome.runtime.lastError) {
        console.log('[MV3 Init] Ping failed, retrying...', chrome.runtime.lastError);
        // Service worker not ready, wait and retry
        setTimeout(() => {
          chrome.runtime.sendMessage({ action: 'ping' }, () => resolve());
        }, 100);
      } else {
        console.log('[MV3 Init] Service worker ready');
        resolve();
      }
    });
  });

  console.log('[MV3 Init] Loading background.js...');

  // For now, load UI from old background.js (UI components still there)
  // This is a transitional step - UI components will be migrated later
  const script = document.createElement('script');
  script.src = 'background.js';
  script.onerror = (e) => {
    console.error('[MV3 Init] Failed to load background.js:', e);
  };
  script.onload = async () => {
    console.log('[MV3 Init] background.js loaded');
    console.log('[MV3 Init] window.apiReady =', window.apiReady);

    // Wait for apiReady
    if (window.apiReady) {
      try {
        const api = await window.apiReady;
        console.log('[MV3 Init] API ready, creating UI:', parameters.ui);
        const ui = new (api.ui["init" + parameters.ui](window))();
        document.body.appendChild(ui);

        // Dispatch events through messaging
        chrome.runtime.sendMessage({
          action: 'dispatchEvent',
          eventName: 'session/view-created',
          waitForResponse: false
        });

        window.addEventListener("beforeunload", () => {
          chrome.runtime.sendMessage({
            action: 'dispatchEvent',
            eventName: 'session/view-removed',
            waitForResponse: false
          });
        });

        await ui.isReady;
        console.log('[MV3 Init] UI ready');
      } catch (err) {
        console.error('[MV3 Init] Error initializing UI:', err);
      }
    } else {
      console.error('[MV3 Init] window.apiReady is not defined!');
    }
  };
  document.head.appendChild(script);
}

/**
 * Initialize for MV2
 */
async function initMV2() {
  const b = chrome.extension.getBackgroundPage();
  const api = await ((b && b.apiReady) ? b.apiReady : new Promise(r => chrome.runtime.getBackgroundPage(b => r(b.apiReady))));

  const ui = new (api.ui["init" + parameters.ui](window))();
  document.body.appendChild(ui);

  addEventListener("beforeunload", () => (api.extensionEvent.dispatch("session/view-removed", null, false)));
  api.extensionEvent.dispatch("session/view-created", null, false);

  await ui.isReady;
}

// Main initialization
let backgroundReady;
if (parameters.theme) {
  backgroundReady = updateThemeStyle();
  if (isMV3) {
    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        const styleKeys = ['style/theme', 'style/background', 'style/background-filter', 'style/dock'];
        if (styleKeys.some(key => key in changes)) {
          updateThemeStyle();
        }
      }
    });
  } else {
    addEventListener("style/change", updateThemeStyle);
  }
} else {
  backgroundReady = Promise.resolve();
}

backgroundReady.then(() => html.classList.add("background-ready"));

(
  html.classList.contains("visible")
    ? Promise.resolve()
    : backgroundReady
)
  .then(() => isMV3 ? initMV3() : initMV2())
  .then(() => {
    if (!html.classList.contains("visible")) {
      const t = html.clientWidth;
      html.classList.add("visible");
    }
  })
  .catch(err => {
    console.log("parameters", parameters);
    console.error(err);
  })
  .then(() => {
    if (chrome.runtime.id == "kjkbcegjfanmgocnecnngfcmmojheiam")
      return;

    // debug - only for MV2
    if (!isMV3) {
      window.addEventListener("keydown", event => {
        switch (event.keyCode) {
          case 117: //F6
            event.preventDefault();
            const backgroundPage = chrome.extension.getBackgroundPage();
            backgroundPage.location.reload();
            setTimeout(() => {
              chrome.extension.getViews({ type: "tab" }).forEach(view => {
                view.location.reload();
              });
            }, 100);
            break;
        }
      });
    }
  });
