// Global array to store blocked domains
let engellenenSirketler = [];

// Function to update the list of blocked sites
function updateBlockedSites() {
  chrome.storage.sync.get('engellenenSirketler', (result) => {
    engellenenSirketler = result.engellenenSirketler || [];
    console.log('Blocked sites updated:', engellenenSirketler);
    hideSearchResults();
  });
}

// Function to check if a URL should be blocked
function shouldBlock(url) {
  if (!url) return false;
  
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    
    // More aggressive blocking: check if any part of the blocked domain appears in the URL
    return engellenenSirketler.some(blockedDomain => {
      // Clean the blockedDomain (remove www, http, etc)
      const cleanDomain = blockedDomain.trim().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
      
      // Check if domain contains the blocked domain, or if blocked domain contains this domain
      // This catches both example.com and subdomains like news.example.com
      return domain.includes(cleanDomain) || 
             // Also check if this is a subdomain of a blocked domain
             (domain.endsWith('.' + cleanDomain)) ||
             // Handle edge cases where the domain might be referenced in parameters
             url.includes(cleanDomain);
    });
  } catch (e) {
    console.error('Error parsing URL:', e);
    return false;
  }
}

// Function to block all iframes and embeds from blocked domains
function blockEmbeddedContent() {
  // Block iframes that might load blocked content
  document.querySelectorAll('iframe').forEach(iframe => {
    if (iframe.src && shouldBlock(iframe.src)) {
      console.log('Blocked iframe:', iframe.src);
      iframe.src = 'about:blank';
      iframe.style.display = 'none';
    }
  });
  
  // Block embedded objects (Flash, etc)
  document.querySelectorAll('object, embed').forEach(object => {
    if (object.data && shouldBlock(object.data)) {
      console.log('Blocked embedded object:', object.data);
      object.data = '';
      object.style.display = 'none';
    }
  });
  
  // Block images from blocked domains
  document.querySelectorAll('img').forEach(img => {
    if (img.src && shouldBlock(img.src)) {
      console.log('Blocked image:', img.src);
      img.src = '';
      img.style.display = 'none';
    }
  });
  
  // Block scripts from blocked domains
  document.querySelectorAll('script').forEach(script => {
    if (script.src && shouldBlock(script.src)) {
      console.log('Blocked script:', script.src);
      script.remove(); // Completely remove the script
    }
  });
  
  // Block video elements
  document.querySelectorAll('video, audio').forEach(media => {
    if (media.src && shouldBlock(media.src)) {
      console.log('Blocked media element:', media.src);
      media.src = '';
      media.style.display = 'none';
    }
  });
}

// Function to hide search results based on the current page
function hideSearchResults() {
  console.log('Hiding search results and blocking embedded content...');
  
  // Always block embedded content, regardless of site
  blockEmbeddedContent();
  
  // Detect which search engine we're on
  const isGoogle = window.location.hostname.includes('google');
  const isBing = window.location.hostname.includes('bing');
  const isYandex = window.location.hostname.includes('yandex');
  const isDuckDuckGo = window.location.hostname.includes('duckduckgo');
  
  // Google search results selectors
  if (isGoogle) {
    // Modern Google search results
    const googleSelectors = [
      // Main results
      'div.g', 
      // Modern structure 
      'div[data-sokoban-container]',
      // Another common structure
      'div.MjjYud',
      // Specific result items
      'div.hlcw0c'
    ];
    
    googleSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(result => {
        const links = result.querySelectorAll('a[href]');
        
        for (const link of links) {
          if (link.href && !link.href.startsWith('javascript:') && shouldBlock(link.href)) {
            console.log('Blocked Google result:', link.href);
            result.style.display = 'none';
            break;
          }
        }
      });
    });
  }
  
  // Bing search results
  else if (isBing) {
    document.querySelectorAll('li.b_algo, .b_results > .b_something').forEach(result => {
      const links = result.querySelectorAll('a[href]');
      for (const link of links) {
        if (shouldBlock(link.href)) {
          console.log('Blocked Bing result:', link.href);
          result.style.display = 'none';
          break;
        }
      }
    });
  }
  
  // Yandex search results
  else if (isYandex) {
    document.querySelectorAll('.serp-item').forEach(result => {
      const links = result.querySelectorAll('a[href]');
      for (const link of links) {
        if (shouldBlock(link.href)) {
          console.log('Blocked Yandex result:', link.href);
          result.style.display = 'none';
          break;
        }
      }
    });
  }
  
  // DuckDuckGo search results
  else if (isDuckDuckGo) {
    document.querySelectorAll('.result, .nrn-react-div').forEach(result => {
      const links = result.querySelectorAll('a[href]');
      for (const link of links) {
        if (shouldBlock(link.href)) {
          console.log('Blocked DuckDuckGo result:', link.href);
          result.style.display = 'none';
          break;
        }
      }
    });
  }
  
  // Generic approach for other search engines
  else {
    const genericSelectors = [
      '.result', '.searchResult', '.search-result', 
      'article', '.item', '.listing', '.entry'
    ];
    
    genericSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(result => {
        const links = result.querySelectorAll('a[href]');
        for (const link of links) {
          if (shouldBlock(link.href)) {
            console.log('Blocked generic result:', link.href);
            result.style.display = 'none';
            break;
          }
        }
      });
    });
  }
}

// Set up mutation observer to watch for dynamic content changes
const observerConfig = { 
  childList: true, 
  subtree: true,
  attributes: false,
  characterData: false
};

// Debounce function to limit how often the hideSearchResults runs
function debounce(func, wait) {
  let timeout;
  return function() {
    clearTimeout(timeout);
    timeout = setTimeout(func, wait);
  };
}

// Create a debounced version of the hide function
const debouncedHide = debounce(hideSearchResults, 300);

// Create and start the observer
const observer = new MutationObserver((mutations) => {
  // Check if any of the mutations contain search results
  let shouldUpdate = false;
  for (const mutation of mutations) {
    if (mutation.addedNodes.length > 0) {
      shouldUpdate = true;
      break;
    }
  }
  
  if (shouldUpdate) {
    debouncedHide();
  }
});

// Block network requests using fetch and XMLHttpRequest
function interceptNetworkRequests() {
  // Override fetch to block requests to blocked domains
  const originalFetch = window.fetch;
  window.fetch = function(resource, init) {
    if (typeof resource === 'string' && shouldBlock(resource)) {
      console.log('Blocked fetch request:', resource);
      return Promise.reject(new Error('Request blocked by Blok extension'));
    }
    return originalFetch.apply(this, arguments);
  };
  
  // Override XMLHttpRequest to block requests to blocked domains
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    if (shouldBlock(url)) {
      console.log('Blocked XMLHttpRequest:', url);
      this.abort();
      return;
    }
    return originalOpen.call(this, method, url, ...rest);
  };
  
  // Handle web beacons and tracking pixels
  const originalImageSrc = Object.getOwnPropertyDescriptor(Image.prototype, 'src');
  if (originalImageSrc) {
    Object.defineProperty(Image.prototype, 'src', {
      set: function(value) {
        if (shouldBlock(value)) {
          console.log('Blocked image request:', value);
          // Don't set the src if it's blocked
        } else {
          originalImageSrc.set.call(this, value);
        }
      },
      get: function() {
        return originalImageSrc.get.call(this);
      }
    });
  }
}

// Initialize the extension
function initialize() {
  updateBlockedSites();
  
  // Start observing the document
  observer.observe(document.body || document.documentElement, observerConfig);
  
  // Listen for custom event from background script
  document.addEventListener('BLOK_UPDATE_RESULTS', updateBlockedSites);
  
  // Intercept network requests
  interceptNetworkRequests();
  
  // Block requests via Content Security Policy (experimental)
  try {
    // Create a meta tag for Content-Security-Policy
    chrome.storage.sync.get('engellenenSirketler', (result) => {
      const sites = result.engellenenSirketler || [];
      if (sites.length > 0) {
        const cspContent = sites.map(site => {
          const clean = site.trim().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
          return `*.${clean}`;
        }).join(' ');
        
        const meta = document.createElement('meta');
        meta.httpEquiv = 'Content-Security-Policy';
        meta.content = `connect-src 'self' * 'unsafe-inline' 'unsafe-eval' blob: data: gap: ws: ; frame-src 'self' * 'unsafe-inline' 'unsafe-eval' blob: data: gap:; object-src 'self' * 'unsafe-inline' 'unsafe-eval' blob: data: gap:; script-src 'self' * 'unsafe-inline' 'unsafe-eval' blob: data: gap:; style-src 'self' * 'unsafe-inline' 'unsafe-eval' blob: data: gap:; img-src 'self' * 'unsafe-inline' 'unsafe-eval' blob: data: gap:; font-src 'self' * data:;`;
        document.head.appendChild(meta);
      }
    });
  } catch (e) {
    console.error('CSP injection error:', e);
  }
}

// Listen for updates from the background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'rulesUpdated') {
    updateBlockedSites();
  }
  return true;
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.engellenenSirketler) {
    updateBlockedSites();
  }
});

// Run even before DOM is ready (document_start)
updateBlockedSites();
interceptNetworkRequests();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Run an initial check immediately
hideSearchResults();

// Run additional checks frequently
setInterval(hideSearchResults, 1000);

// Set up checks for dynamic content loading
window.addEventListener('load', hideSearchResults);
window.addEventListener('DOMContentLoaded', hideSearchResults);
window.addEventListener('scroll', debounce(hideSearchResults, 200));
window.addEventListener('click', debounce(hideSearchResults, 100));