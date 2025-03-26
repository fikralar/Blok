// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "blokSite",
    title: "Siteyi Engelle",
    contexts: ["page"]
  });
  
  // Initialize rules when extension is installed
  updateBlockingRules();
});

// Context menu handler - right-click to block site
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "blokSite") {
    const url = new URL(tab.url);
    const domain = url.hostname.replace('www.', '');
    
    chrome.storage.sync.get({ engellenenSirketler: [] }, (result) => {
      let sirketler = result.engellenenSirketler;
      if (!sirketler.includes(domain)) {
        sirketler.push(domain);
        chrome.storage.sync.set({ engellenenSirketler: sirketler }, () => {
          updateBlockingRules();
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'images/icon128.png',
            title: 'Site Engellendi',
            message: domain + ' engelleme listesine eklendi.'
          });
        });
      }
    });
  }
});

// Rule updating function - creates dynamic blocking rules
function updateBlockingRules() {
  chrome.storage.sync.get('engellenenSirketler', (result) => {
    const sirketler = result.engellenenSirketler || [];
    
    // Get existing rules
    chrome.declarativeNetRequest.getDynamicRules((existingRules) => {
      const existingRuleIds = existingRules.map(rule => rule.id);
      
      let ruleCounter = 1;
      const newRules = [];
      
      // For each domain, create multiple rules to ensure complete blocking
      sirketler.forEach((domain) => {
        // Clean the domain input
        const cleanedDomain = domain.trim().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
        
        // 1. Block main domain - highest priority
        newRules.push({
          id: ruleCounter++,
          priority: 100,
          action: { type: "block" },
          condition: {
            urlFilter: `*://*.${cleanedDomain}/*`,
            resourceTypes: ["main_frame", "sub_frame", "stylesheet", "script", "image", 
                          "font", "object", "xmlhttprequest", "ping", "csp_report", 
                          "media", "websocket", "webtransport", "other"]
          }
        });
        
        // 2. Block the domain exactly without www
        newRules.push({
          id: ruleCounter++,
          priority: 90,
          action: { type: "block" },
          condition: {
            urlFilter: `*://${cleanedDomain}/*`,
            resourceTypes: ["main_frame", "sub_frame", "stylesheet", "script", "image", 
                          "font", "object", "xmlhttprequest", "ping", "csp_report", 
                          "media", "websocket", "webtransport", "other"]
          }
        });
        
        // 3. Block domain as a third-party request (for analytics, ads, etc.)
        newRules.push({
          id: ruleCounter++,
          priority: 80,
          action: { type: "block" },
          condition: {
            urlFilter: `*://*.${cleanedDomain}/*`,
            resourceTypes: ["script", "image", "xmlhttprequest", "ping", "other"],
            domainType: "thirdParty"
          }
        });
        
        // 4. Block subdomain.domain.com pattern
        const domainParts = cleanedDomain.split('.');
        if (domainParts.length >= 2) {
          const baseDomain = domainParts.slice(domainParts.length - 2).join('.');
          newRules.push({
            id: ruleCounter++,
            priority: 70,
            action: { type: "block" },
            condition: {
              urlFilter: `*://*.${baseDomain}/*`,
              resourceTypes: ["main_frame", "sub_frame", "stylesheet", "script", "image", 
                            "font", "object", "xmlhttprequest", "ping", "csp_report", 
                            "media", "websocket", "webtransport", "other"]
            }
          });
        }
      });
      
      // Update dynamic rules
      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingRuleIds,
        addRules: newRules
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error updating rules:', chrome.runtime.lastError);
        } else {
          console.log('Blocking rules updated successfully');
          console.log(`Created ${newRules.length} rules for ${sirketler.length} domains`);
          
          // Notify content scripts about updated rules
          chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
              chrome.tabs.sendMessage(tab.id, { action: 'rulesUpdated' }).catch(() => {
                // Suppress errors for tabs that don't have the content script
              });
            });
          });
        }
      });
    });
  });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateRules') {
    updateBlockingRules();
    sendResponse({ success: true });
  }
  return true; // Indicates async response
});

// Listen for tab updates to apply filtering
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Inject the content script logic to handle search results
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: () => {
        // This will trigger the content script to run again
        document.dispatchEvent(new CustomEvent('BLOK_UPDATE_RESULTS'));
      }
    }).catch(err => console.error('Script injection error:', err));
  }
});