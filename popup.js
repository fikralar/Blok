document.addEventListener('DOMContentLoaded', () => {
  const ekleButon = document.getElementById('ekleButon');
  const yeniSiteInput = document.getElementById('yeniSite');
  const engelliListe = document.getElementById('engelliListe');
  const tumunuTemizle = document.getElementById('tumunuTemizle');
  const statusElement = document.createElement('div');
  
  // Add status element to DOM
  statusElement.id = 'status';
  statusElement.style.marginTop = '10px';
  statusElement.style.padding = '5px';
  statusElement.style.textAlign = 'center';
  document.body.appendChild(statusElement);
  
  // Function to show status message
  function showStatus(message, isError = false) {
    statusElement.textContent = message;
    statusElement.style.color = isError ? '#d32f2f' : '#4CAF50';
    statusElement.style.display = 'block';
    
    setTimeout(() => {
      statusElement.style.display = 'none';
    }, 3000);
  }
  
  // Function to clean domain input
  function cleanDomain(input) {
    // Remove protocol and paths
    let domain = input.trim().toLowerCase();
    
    // Remove http://, https://, www., and anything after /
    domain = domain.replace(/^(https?:\/\/)?(www\.)?/, '');
    domain = domain.split('/')[0];
    
    return domain;
  }
  
  // Function to refresh the list of blocked sites
  function refreshList() {
    chrome.storage.sync.get('engellenenSirketler', (result) => {
      engelliListe.innerHTML = '';
      const sites = result.engellenenSirketler || [];
      
      if (sites.length === 0) {
        const emptyMessage = document.createElement('li');
        emptyMessage.textContent = 'Henüz engellenen site yok.';
        emptyMessage.style.fontStyle = 'italic';
        emptyMessage.style.color = '#999';
        engelliListe.appendChild(emptyMessage);
      } else {
        sites.sort().forEach(domain => {
          let li = document.createElement('li');
          li.textContent = domain;
          
          let removeBtn = document.createElement('button');
          removeBtn.textContent = 'Sil';
          removeBtn.className = 'sil';
          removeBtn.onclick = () => removeSite(domain);
          
          li.appendChild(removeBtn);
          engelliListe.appendChild(li);
        });
      }
    });
  }
  
  // Function to remove a site from the blocked list
  function removeSite(domain) {
    chrome.storage.sync.get('engellenenSirketler', (result) => {
      const updatedList = result.engellenenSirketler.filter(site => site !== domain);
      
      chrome.storage.sync.set({ engellenenSirketler: updatedList }, () => {
        chrome.runtime.sendMessage({ action: 'updateRules' }, (response) => {
          if (chrome.runtime.lastError) {
            showStatus('Hata: Ayarlar güncellenemedi.', true);
          } else {
            showStatus(`${domain} engelleme listesinden kaldırıldı.`);
            refreshList();
          }
        });
      });
    });
  }
  
  // Add a new site to the blocked list
  ekleButon.onclick = () => {
    let domain = cleanDomain(yeniSiteInput.value);
    
    if (!domain) {
      showStatus('Lütfen geçerli bir site adı girin.', true);
      return;
    }
    
    chrome.storage.sync.get({ engellenenSirketler: [] }, (result) => {
      const sirketler = result.engellenenSirketler;
      
      if (sirketler.includes(domain)) {
        showStatus('Bu site zaten engelli!', true);
        return;
      }
      
      sirketler.push(domain);
      
      chrome.storage.sync.set({ engellenenSirketler: sirketler }, () => {
        chrome.runtime.sendMessage({ action: 'updateRules' }, (response) => {
          if (chrome.runtime.lastError) {
            showStatus('Hata: Ayarlar güncellenemedi.', true);
          } else {
            showStatus(`${domain} engelleme listesine eklendi.`);
            yeniSiteInput.value = '';
            refreshList();
          }
        });
      });
    });
  };
  
  // Allow adding by pressing Enter
  yeniSiteInput.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
      ekleButon.click();
    }
  });
  
  // Clear all blocked sites
  tumunuTemizle.onclick = () => {
    if (confirm('Tüm engellenen siteleri listeden kaldırmak istediğinizden emin misiniz?')) {
      chrome.storage.sync.set({ engellenenSirketler: [] }, () => {
        chrome.runtime.sendMessage({ action: 'updateRules' }, (response) => {
          if (chrome.runtime.lastError) {
            showStatus('Hata: Ayarlar güncellenemedi.', true);
          } else {
            showStatus('Tüm engellenen siteler kaldırıldı.');
            refreshList();
          }
        });
      });
    }
  };
  
  // Add current site button
  const currentSiteBtn = document.createElement('button');
  currentSiteBtn.textContent = 'Bu Siteyi Engelle';
  currentSiteBtn.style.marginTop = '15px';
  currentSiteBtn.style.backgroundColor = '#4CAF50';
  
  currentSiteBtn.onclick = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        try {
          const url = new URL(tabs[0].url);
          const domain = url.hostname.replace('www.', '');
          
          yeniSiteInput.value = domain;
          ekleButon.click();
        } catch (e) {
          showStatus('Geçerli site alınamadı.', true);
        }
      }
    });
  };
  
  document.body.insertBefore(currentSiteBtn, tumunuTemizle);
  
  // Initialize the list
  refreshList();
  
  // Check for active tab and enable/disable current site button
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      try {
        const url = new URL(tabs[0].url);
        // Disable for chrome:// urls and similar
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          currentSiteBtn.disabled = true;
          currentSiteBtn.title = 'Bu sayfada kullanılamaz';
        }
      } catch (e) {
        currentSiteBtn.disabled = true;
      }
    }
  });
  
  // Add export/import functionality
  const exportBtn = document.createElement('button');
  exportBtn.textContent = 'Listeyi Dışa Aktar';
  exportBtn.style.marginTop = '10px';
  exportBtn.style.backgroundColor = '#2196F3';
  
  exportBtn.onclick = () => {
    chrome.storage.sync.get('engellenenSirketler', (result) => {
      const sites = result.engellenenSirketler || [];
      const blob = new Blob([JSON.stringify(sites, null, 2)], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'blok-engellenen-siteler.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };
  
  // Add import functionality
  const importInput = document.createElement('input');
  importInput.type = 'file';
  importInput.accept = '.json';
  importInput.style.display = 'none';
  
  const importBtn = document.createElement('button');
  importBtn.textContent = 'Listeyi İçe Aktar';
  importBtn.style.marginTop = '5px';
  importBtn.style.backgroundColor = '#FF9800';
  
  importBtn.onclick = () => importInput.click();
  
  importInput.onchange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const sites = JSON.parse(e.target.result);
          if (Array.isArray(sites)) {
            chrome.storage.sync.set({ engellenenSirketler: sites }, () => {
              chrome.runtime.sendMessage({ action: 'updateRules' });
              showStatus('Liste başarıyla içe aktarıldı.');
              refreshList();
            });
          } else {
            showStatus('Geçersiz liste formatı!', true);
          }
        } catch (err) {
          showStatus('Dosya okunamadı!', true);
        }
      };
      reader.readAsText(file);
    }
  };
  
  // Add buttons to the document
  document.body.appendChild(exportBtn);
  document.body.appendChild(importBtn);
  document.body.appendChild(importInput);
});