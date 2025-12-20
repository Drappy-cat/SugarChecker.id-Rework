document.addEventListener('DOMContentLoaded', () => {
  console.log("SugarChecker v3.1 - Force Rewrite");

  // ===== Theme Toggle Logic (Robust) =====
  const THEME_KEY = 'sc-theme';
  // Select ALL theme toggles (class or ID based)
  const toggles = document.querySelectorAll('#theme-toggle, .theme-toggle');

  function getStoredTheme() {
    try {
      return localStorage.getItem(THEME_KEY) || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } catch (e) {
      return 'light';
    }
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) { /* ignore */ }

    // Sync all checkboxes
    toggles.forEach(t => t.checked = (theme === 'dark'));
  }

  // Initialize Theme
  setTheme(getStoredTheme());

  // Bind Events
  toggles.forEach(t => {
    t.addEventListener('change', () => {
      setTheme(t.checked ? 'dark' : 'light');
    });
  });

  // ===== DOM Elements =====
  const els = {
    // Sections
    welcomeInfo: document.getElementById('welcome-info'),
    landing: document.getElementById('landing'),
    detail: document.getElementById('detail'),
    meterSection: document.getElementById('sugar-meter'),

    // Buttons
    goToListBtn: document.getElementById('go-to-main'),
    goHome: document.getElementById('go-home'),
    backBtn: document.getElementById('back-to-home'),
    backMeterBtn: document.getElementById('back-from-meter'),
    autoNavMeterBtn: document.getElementById('nav-meter-btn'),
    navMeterBtn: document.getElementById('nav-calc-btn'),

    openInfoBtn: document.getElementById('open-info'),
    openScannerBtn: document.getElementById('open-scanner'),

    // Search
    searchForm: document.getElementById('search-form'),
    searchInput: document.getElementById('search-input'),
    resultsWrap: document.getElementById('search-results'),
    suggestionsContainer: document.getElementById('search-suggestions'),

    // Detail
    namaMakanan: document.getElementById('nama-makanan'),
    ukuranPorsi: document.getElementById('ukuran-porsi'),
    tabelGizi: document.getElementById('tabel-gizi'),
    persenAKG: document.getElementById('persen-akg'),
    rincianMakro: document.getElementById('rincian-makro'),
    fotoMakanan: document.getElementById('foto-makanan'),
    fotoMakananNA: document.getElementById('foto-makanan-na'),
    infoManufaktur: document.getElementById('info-manufaktur'),
    infoUkuran: document.getElementById('info-ukuran'),
    infoBarcode: document.getElementById('info-barcode'),
    infoBarcodeImg: document.getElementById('info-barcode-img'),
    infoKal: document.getElementById('info-kalori'),
    infoLemak: document.getElementById('info-lemak'),
    infoKarbo: document.getElementById('info-karbo'),
    infoProtein: document.getElementById('info-protein'),

    // Meter
    meterSearch: document.getElementById('meter-search'),
    meterSort: document.getElementById('meter-sort'),
    meterGrid: document.getElementById('meter-product-grid'),
    meterPagination: document.getElementById('meter-pagination'),
    meterScanBtn: document.getElementById('meter-scan-btn'),
    gaugeValue: document.getElementById('gauge-value'),
    gaugeStatus: document.getElementById('gauge-status'),
    gaugeWarning: document.getElementById('gauge-warning'),
    gaugeNeedle: document.getElementById('gauge-needle'),
    selectedList: document.getElementById('selected-products-list'),

    // Charts (New)
    sugarPie: document.getElementById('sugar-pie'),
    sugarPieText: document.getElementById('sugar-pie-text'),
    sugarDetailText: document.getElementById('sugar-detail-text'),
    detailSugarSpoonImg: document.getElementById('detail-sugar-spoon-img'),
  };

  let macroChart;
  let CSV_DATA = [];

  // Meter State
  let METER_STATE = {
    selected: [],
    page: 1,
    itemsPerPage: 20,
    search: '',
    sort: 'asc'
  };

  // ===== Navigation Logic =====
  function show(sectionId) {
    // 1. Hide All Sections
    [els.welcomeInfo, els.landing, els.detail, els.meterSection].forEach(el => {
      if (el) el.hidden = true;
    });

    // 2. Map 'home' -> 'landing' 
    let target = null;
    if (sectionId === 'home') target = els.landing;
    else if (sectionId === 'info') target = els.welcomeInfo;
    else if (sectionId === 'meter') target = els.meterSection;
    else if (sectionId === 'detail') target = els.detail;
    else target = document.getElementById(sectionId);

    if (target) target.hidden = false;

    // 3. Update Navbar Buttons Visibility
    if (els.autoNavMeterBtn) els.autoNavMeterBtn.hidden = !(sectionId === 'home' || sectionId === 'detail');
    if (els.openInfoBtn) els.openInfoBtn.hidden = (sectionId === 'info');

    // Scroll top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ===== Event Listeners =====
  if (els.goToListBtn) {
    els.goToListBtn.addEventListener('click', (e) => {
      e.preventDefault();
      show('home');
    });
  }

  if (els.goHome) els.goHome.addEventListener('click', (e) => { e.preventDefault(); show('home'); });
  if (els.backBtn) els.backBtn.addEventListener('click', () => show('home'));
  if (els.backMeterBtn) els.backMeterBtn.addEventListener('click', () => show('home'));

  if (els.openInfoBtn) els.openInfoBtn.addEventListener('click', () => show('info'));
  if (els.autoNavMeterBtn) els.autoNavMeterBtn.addEventListener('click', () => show('meter'));

  const navCalc = document.getElementById('nav-calc-btn');
  if (navCalc) navCalc.addEventListener('click', () => show('meter'));

  // Scanner Buttons
  if (els.openScannerBtn) els.openScannerBtn.addEventListener('click', openScanner);
  if (els.meterScanBtn) els.meterScanBtn.addEventListener('click', openScanner);

  // Search
  if (els.searchForm) els.searchForm.addEventListener('submit', e => {
    e.preventDefault();
    if (els.searchInput) doSearch(els.searchInput.value);
  });

  if (els.searchInput) els.searchInput.addEventListener('input', () => {
    const q = els.searchInput.value.trim();
    if (!q) {
      if (els.resultsWrap) els.resultsWrap.innerHTML = '';
      renderSuggestions([]);
      return;
    }
    getSuggestions(q);
  });

  document.addEventListener('click', e => {
    if (els.suggestionsContainer && els.searchForm && !els.searchForm.contains(e.target)) {
      els.suggestionsContainer.style.display = 'none';
    }
  });

  // ===== CSV Loading =====
  async function loadCSV() {
    try {
      const res = await fetch('./dataset/composition.csv');
      if (!res.ok) throw new Error(`HTTP error! ${res.status}`);
      const text = await res.text();
      const lines = text.trim().split('\n');

      function parseLine(line) {
        let cols = [];
        let inQuote = false;
        let current = '';
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') inQuote = !inQuote;
          else if (char === ',' && !inQuote) {
            cols.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        cols.push(current.trim());
        return cols.map(c => c.replace(/^"|"$/g, '').trim());
      }

      const headers = parseLine(lines[0]);
      return lines.slice(1).map(line => {
        if (!line.trim()) return null;
        const cols = parseLine(line);
        const obj = {};
        headers.forEach((h, i) => {
          const val = (cols[i] || '');
          const toNum = (v) => parseFloat(v.replace(/,/g, '.')) || 0;

          switch (h) {
            case 'Nama Produk': obj['product_name'] = val; break;
            case 'Produksi': obj['brand'] = val; break;
            case 'Ukuran/Berat': obj['weight'] = val; obj['nf_serving_size'] = val; break;
            case 'Satuan': obj['unit'] = val; break;
            case 'Kalori Total (kkal)': obj['nf_calories'] = toNum(val); break;
            case '% AKG_Kalori': obj['akg_calories'] = toNum(val); break;
            case 'Gula Total (gr)': obj['nf_total_sugars'] = toNum(val); break;
            case 'Konversi Gula Per Sendok Makan': obj['sugar_spoons'] = toNum(val); break;
            case '% Rekomendasi': obj['sugar_recommendation_percent'] = toNum(val); break;
            case 'Karbohidrat Total (gr)': obj['nf_total_carbs'] = toNum(val); break;
            case '% AKG_Karbohidrat': obj['akg_carbs'] = toNum(val); break;
            case 'Lemak Total (gr)': obj['nf_total_fat'] = toNum(val); break;
            case '% AKG_Lemak': obj['akg_fat'] = toNum(val); break;
            case 'Lemak Jenuh (gr)': obj['nf_saturated_fat'] = toNum(val); break;
            case '% AKG_Lemak Jenuh': obj['akg_saturated_fat'] = toNum(val); break;
            case 'Protein': obj['nf_protein'] = toNum(val); break;
            case '% AKG_Protein': obj['akg_protein'] = toNum(val); break;
            case 'Garam (mg)': obj['nf_sodium'] = toNum(val); break;
            case '% AKG_Garam': obj['akg_sodium'] = toNum(val); break;
            case 'Kode Barcode': obj['barcode'] = val.replace(/\s+/g, ''); break;
            case 'Link Gambar Barcode': obj['barcode_image'] = val; break;
            case 'Link Gambar Produk': obj['main_image'] = val; break;
            default: obj[h] = val; break;
          }
        });
        return obj;
      }).filter(item => item !== null);
    } catch (e) {
      console.warn("CSV load failed", e);
      return [];
    }
  }

  // Load Data
  loadCSV().then(data => {
    CSV_DATA = data;
    console.log("CSV Loaded:", CSV_DATA.length);
  });

  // ===== Helpers =====
  function transformGoogleDriveUrl(url) {
    if (!url || url.toUpperCase() === 'NULL')
      return 'https://placehold.co/64x64/e0e0e0/757575?text=No+Image';
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) return `https://lh3.googleusercontent.com/d/${match[1]}`;
    return url;
  }

  function renderResults(list) {
    if (!els.resultsWrap) return;
    els.resultsWrap.innerHTML = '';
    if (!list.length) {
      els.resultsWrap.innerHTML = '<div class="card" style="grid-column:1/-1;text-align:center">Tidak ada hasil.</div>';
      return;
    }
    list.forEach(p => {
      const card = document.createElement('div');
      card.className = 'result-card'; card.role = 'button'; card.tabIndex = 0;
      const img = document.createElement('img');
      img.className = 'result-thumb';
      img.src = (p.main_image && p.main_image !== 'NULL') ? transformGoogleDriveUrl(p.main_image) : 'https://placehold.co/64x64/e0e0e0/757575?text=No+Image';
      const meta = document.createElement('div'); meta.className = 'result-meta';
      const title = document.createElement('div'); title.className = 'result-title'; title.textContent = p.product_name;
      const sub = document.createElement('div'); sub.className = 'result-sub';
      sub.textContent = `${p.brand || 'Tanpa Merek'} • ${p.barcode || '-'}`;
      meta.append(title, sub);
      card.append(img, meta);
      card.addEventListener('click', () => openDetail(p));
      els.resultsWrap.appendChild(card);
    });
  }

  function doSearch(q) {
    const query = (q || '').trim().toLowerCase();
    if (!query || query.length < 2) {
      if (els.resultsWrap) els.resultsWrap.innerHTML = '';
      return;
    }
    const filtered = CSV_DATA.filter(p => (p.product_name || '').toLowerCase().includes(query));
    renderResults(filtered);
  }

  function renderSuggestions(suggestions) {
    if (!els.suggestionsContainer) return;
    els.suggestionsContainer.innerHTML = '';
    if (!suggestions.length) { els.suggestionsContainer.style.display = 'none'; return; }
    suggestions.forEach(s => {
      const item = document.createElement('div'); item.className = 'suggestion-item';
      item.textContent = s.product_name;
      item.addEventListener('click', () => {
        if (els.searchInput) els.searchInput.value = s.product_name;
        doSearch(s.product_name);
      });
      els.suggestionsContainer.appendChild(item);
    });
    els.suggestionsContainer.style.display = 'block';
  }

  function getSuggestions(query) {
    const filtered = CSV_DATA.filter(p => (p.product_name || '').toLowerCase().includes(query.toLowerCase()));
    renderSuggestions(filtered.slice(0, 10));
  }

  // ===== Detail Logic =====
  function openDetail(p) {
    if (els.namaMakanan) els.namaMakanan.textContent = p.product_name;
    if (els.ukuranPorsi) els.ukuranPorsi.textContent = (p.nf_serving_size || 100) + ' g';

    if (p.main_image) {
      if (els.fotoMakanan) { els.fotoMakanan.src = transformGoogleDriveUrl(p.main_image); els.fotoMakanan.hidden = false; }
      if (els.fotoMakananNA) els.fotoMakananNA.hidden = true;
    } else {
      if (els.fotoMakanan) els.fotoMakanan.hidden = true;
      if (els.fotoMakananNA) els.fotoMakananNA.hidden = false;
    }

    if (p.barcode_image && p.barcode_image !== 'NULL') {
      if (els.infoBarcodeImg) { els.infoBarcodeImg.src = transformGoogleDriveUrl(p.barcode_image); els.infoBarcodeImg.hidden = false; }
    } else {
      if (els.infoBarcodeImg) { els.infoBarcodeImg.src = 'https://placehold.co/64x64/e0e0e0/757575?text=No+Image'; els.infoBarcodeImg.hidden = false; }
    }

    if (els.infoManufaktur) els.infoManufaktur.textContent = p.brand || '-';
    if (els.infoUkuran) els.infoUkuran.textContent = p.weight ? `${p.weight} ${p.unit || ''}` : '-';
    if (els.infoBarcode) els.infoBarcode.textContent = p.barcode || '-';

    if (els.tabelGizi) {
      els.tabelGizi.innerHTML = '';
      const addRow = (label, val, unit, akgVal) => {
        const tr = document.createElement('tr');
        const displayVal = `${val} ${unit}`;

        let akgDisplay = '-';
        if (akgVal !== undefined && akgVal !== null && !isNaN(akgVal)) {
          akgDisplay = `${akgVal}%`;
        }

        tr.innerHTML = `<td>${label}</td><td style="text-align:right">${displayVal}</td><td style="text-align:right; font-weight:bold; color:var(--accent-2)">${akgDisplay}</td>`;
        els.tabelGizi.appendChild(tr);
      };

      const energyCal = parseFloat(p.nf_calories) || 0;
      const energyAkg = (energyCal / 2150) * 100;
      addRow('Energi Total', p.nf_calories || 0, 'kkal', energyAkg.toFixed(1).replace('.', ','));
      addRow('Lemak Total', p.nf_total_fat || 0, 'g', p.akg_fat);
      addRow('Lemak Jenuh', p.nf_saturated_fat || 0, 'g', p.akg_saturated_fat);
      addRow('Protein', p.nf_protein || 0, 'g', p.akg_protein);
      addRow('Karbohidrat', p.nf_total_carbs || 0, 'g', p.akg_carbs);
      addRow('Gula Total', p.nf_total_sugars || 0, 'g', null);

      if (p.sugar_spoons) {
        // Removed from table as per request
      }
      addRow('Garam (Natrium)', p.nf_sodium || 0, 'mg', p.akg_sodium);
    }

    if (els.infoKal) els.infoKal.textContent = (p.nf_calories || 0) + ' Kkal';
    if (els.infoLemak) els.infoLemak.textContent = (p.nf_total_fat || 0) + ' g';
    if (els.infoKarbo) els.infoKarbo.textContent = (p.nf_total_carbs || 0) + ' g';
    if (els.infoProtein) els.infoProtein.textContent = (p.nf_protein || 0) + ' g';

    if (els.persenAKG) {
      const cal = parseFloat(p.nf_calories) || 0;
      const pct = (cal / 2150) * 100;
      els.persenAKG.textContent = `≈ ${pct.toFixed(1).replace('.', ',')}% dari AKG*`;
    }

    // Macro Chart (Now Energy AKG Chart)
    const ctx = document.getElementById('macro-chart') ? document.getElementById('macro-chart').getContext('2d') : null;
    if (ctx) {
      if (macroChart) macroChart.destroy();

      const cal = parseFloat(p.nf_calories) || 0;
      const totalAKG = 2150;
      let pct = (cal / totalAKG) * 100;
      // Clamp for visual chart only, not value
      const visualPct = Math.min(pct, 100);

      // Hide textual breakdown
      if (els.rincianMakro) els.rincianMakro.style.display = 'none';

      macroChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Energi Terpenuhi', 'Sisa'],
          datasets: [{
            data: [visualPct, 100 - visualPct],
            backgroundColor: ['#fbc02d', '#e0e0e0'],
            borderWidth: 0
          }]
        },
        options: {
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (c) {
                  return c.parsed.toFixed(1) + '%';
                }
              }
            }
          },
          cutout: '70%'
        }
      });
    }

    // Sugar Pie Chart
    const dailySugarLimit = 50;
    const sugarVal = parseFloat(p.nf_total_sugars) || 0;
    const sugarPercent = Math.round((sugarVal / dailySugarLimit) * 100);

    if (els.sugarPie) {
      // Clamp CSS only for visual circle limit (max 100)
      els.sugarPie.style.setProperty('--p', Math.min(sugarPercent, 100));
      // Tooltip Data
      els.sugarPie.setAttribute('data-label', `${sugarVal}g`);

      let color = '#4caf50';
      if (sugarPercent > 50) color = '#ff9800';
      if (sugarPercent >= 100) color = '#f44336';
      els.sugarPie.style.setProperty('--c', color);
    }
    if (els.sugarPieText) els.sugarPieText.textContent = `${sugarPercent}%`;

    if (els.sugarDetailText) {
      let msg = `<strong>${sugarVal}g</strong> terpenuhi dari batas harian <strong>${dailySugarLimit}g</strong>`;
      if (sugarPercent >= 100) {
        msg += `<br><span style="color:#d32f2f; font-weight:bold; display:block; margin-top:5px;">⚠️ Melebihi batas konsumsi harian!</span>`;
      }
      els.sugarDetailText.innerHTML = msg;
    }

    // Spoon Visual Logic
    const spoonTextEl = document.getElementById('sugar-spoon-count');
    if (spoonTextEl) {
      spoonTextEl.textContent = p.sugar_spoons ? `~ ${p.sugar_spoons} sdm` : '';
    }



    show('detail');
  }

  // ===== Sugar Meter Logic =====
  if (els.meterSearch) els.meterSearch.addEventListener('input', (e) => {
    METER_STATE.search = e.target.value;
    METER_STATE.page = 1;
    renderMeterGrid();
  });

  if (els.meterSort) els.meterSort.addEventListener('change', (e) => {
    METER_STATE.sort = e.target.value;
    METER_STATE.page = 1;
    renderMeterGrid();
  });

  function getFilteredMeterData() {
    let data = [...CSV_DATA];
    if (METER_STATE.search) {
      const q = METER_STATE.search.toLowerCase();
      data = data.filter(p => (p.product_name || '').toLowerCase().includes(q));
    }
    data.sort((a, b) => {
      const nameA = (a.product_name || '').toLowerCase();
      const nameB = (b.product_name || '').toLowerCase();
      if (METER_STATE.sort === 'asc') return nameA.localeCompare(nameB);
      return nameB.localeCompare(nameA);
    });
    return data;
  }

  function updateGauge() {
    const MAX_SUGAR = 50;
    const MAX_VISUAL = 75;
    const totalSugar = METER_STATE.selected.reduce((acc, curr) => acc + (parseFloat(curr.nf_total_sugars) || 0), 0);
    const percentage = MAX_SUGAR > 0 ? (totalSugar / MAX_SUGAR) * 100 : 0;

    if (els.gaugeValue) els.gaugeValue.textContent = `${totalSugar.toFixed(1)} g`;

    let statusText = "Aman";
    let statusColor = "#4caf50";

    if (totalSugar > MAX_SUGAR) {
      statusText = "Berlebih!";
      statusColor = "#d32f2f";
    } else if (totalSugar > 25) {
      statusText = "Waspada";
      statusColor = "#ff9800";
    }

    if (els.gaugeStatus) {
      els.gaugeStatus.textContent = `${statusText} (${Math.round(percentage)}%)`;
      els.gaugeStatus.style.color = statusColor;
    }

    if (els.gaugeWarning) els.gaugeWarning.style.display = totalSugar > MAX_SUGAR ? 'block' : 'none';
    if (els.gaugeValue) els.gaugeValue.style.color = totalSugar > MAX_SUGAR ? 'var(--danger)' : 'var(--text)';

    if (els.gaugeNeedle) {
      let val = Math.min(totalSugar, MAX_VISUAL);
      let ratio = val / MAX_VISUAL;
      let deg = -90 + (ratio * 180);
      els.gaugeNeedle.style.transform = `rotate(${deg}deg)`;
    }
  }

  function renderMeterGrid() {
    if (!els.meterGrid) return;
    els.meterGrid.innerHTML = '';
    const data = getFilteredMeterData();
    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / METER_STATE.itemsPerPage);
    if (METER_STATE.page > totalPages) METER_STATE.page = totalPages || 1;

    const start = (METER_STATE.page - 1) * METER_STATE.itemsPerPage;
    const end = start + METER_STATE.itemsPerPage;
    const pageData = data.slice(start, end);

    if (pageData.length === 0) {
      els.meterGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center">Tidak ada produk ditemukan.</div>';
    } else {
      pageData.forEach(p => {
        const card = document.createElement('div');
        card.className = 'result-card';
        card.style.flexDirection = 'column'; card.style.alignItems = 'flex-start';

        const img = document.createElement('img');
        img.className = 'result-thumb'; img.style.width = '100%'; img.style.height = '120px';
        img.src = (p.main_image && p.main_image !== 'NULL') ? transformGoogleDriveUrl(p.main_image) : 'https://placehold.co/64x64/e0e0e0/757575?text=No+Image';

        const meta = document.createElement('div'); meta.style.width = '100%';
        meta.innerHTML = `<div class="result-title" style="margin-top:8px">${p.product_name}</div>
                          <div class="result-sub">${p.brand || ''}</div>
                          <div style="font-size:0.9rem; margin-top:4px; color:var(--text)">Gula: <strong>${p.nf_total_sugars || 0} g</strong></div>`;

        const btn = document.createElement('button');
        btn.className = 'btn-add'; btn.textContent = '+ Tambah';
        if (METER_STATE.selected.length >= 10) {
          btn.disabled = true; btn.textContent = 'Penuh (Max 10)';
        }
        btn.addEventListener('click', () => addMeterProduct(p));
        card.append(img, meta, btn);
        els.meterGrid.appendChild(card);
      });
    }
    renderPagination(totalPages);
  }

  function addMeterProduct(p) {
    if (METER_STATE.selected.length >= 10) return;
    METER_STATE.selected.push(p);
    updateGauge();
    renderSelectedList();
    renderMeterGrid();
  }

  window.addMeterProduct = addMeterProduct;

  function removeMeterProduct(index) {
    METER_STATE.selected.splice(index, 1);
    updateGauge();
    renderSelectedList();
    renderMeterGrid();
  }

  function renderSelectedList() {
    if (!els.selectedList) return;
    els.selectedList.innerHTML = '';
    if (METER_STATE.selected.length === 0) {
      els.selectedList.innerHTML = '<p class="empty-hint" style="text-align:center; color: var(--text-muted);">Belum ada produk dipilih (Max 10)</p>';
      return;
    }
    METER_STATE.selected.forEach((p, idx) => {
      const div = document.createElement('div'); div.className = 'selected-item';
      const infoDiv = document.createElement('div');
      infoDiv.style.flex = '1'; infoDiv.style.cursor = 'pointer'; infoDiv.title = 'Lihat Detail';
      infoDiv.innerHTML = `<div class="selected-item-name" style="text-decoration:underline">${p.product_name}</div><div class="selected-item-val">Gula ${p.nf_total_sugars || 0} g</div>`;
      infoDiv.addEventListener('click', () => openDetail(p));

      const btn = document.createElement('button');
      btn.className = 'remove-btn'; btn.innerHTML = '×';
      btn.addEventListener('click', (e) => { e.stopPropagation(); removeMeterProduct(idx); });

      div.appendChild(infoDiv); div.appendChild(btn);
      els.selectedList.appendChild(div);
    });
  }

  function renderPagination(totalPages) {
    if (!els.meterPagination) return;
    els.meterPagination.innerHTML = '';
    if (totalPages <= 1) return;

    const createBtn = (page, text, isActive = false) => {
      const b = document.createElement('button');
      b.className = `page-btn ${isActive ? 'active' : ''}`;
      b.textContent = text;
      b.addEventListener('click', () => { METER_STATE.page = page; renderMeterGrid(); });
      return b;
    };
    if (METER_STATE.page > 1) els.meterPagination.appendChild(createBtn(METER_STATE.page - 1, '«'));
    for (let i = 1; i <= totalPages; i++) {
      els.meterPagination.appendChild(createBtn(i, i, i === METER_STATE.page));
    }
    if (METER_STATE.page < totalPages) els.meterPagination.appendChild(createBtn(METER_STATE.page + 1, '»'));
  }

  // ===== Scanner Logic =====
  let html5Qrcode;
  const modal = document.getElementById('scanner-modal');
  const cameraSelect = document.getElementById('camera-select');
  const closeEls = modal ? Array.from(modal.querySelectorAll('[data-close]')) : [];

  async function openScanner() {
    if (!modal) return;
    modal.hidden = false; modal.setAttribute('aria-hidden', 'false');
    try {
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || !cameras.length) { alert('Kamera tidak ditemukan.'); return; }
      const activeCamId = cameras[0].id;
      if (cameraSelect) {
        cameraSelect.innerHTML = '';
        cameras.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id; opt.textContent = c.label;
          if (c.id === activeCamId) opt.selected = true;
          cameraSelect.appendChild(opt);
        });
      }
      if (!html5Qrcode) html5Qrcode = new Html5Qrcode('qr-reader');
      await html5Qrcode.start(activeCamId, { fps: 10, qrbox: { width: 250, height: 150 } },
        (txt) => handleScanResult(txt), () => { });
    } catch (e) {
      console.error(e); alert('Gagal akses kamera.');
    }
  }

  function stopScanner() {
    if (html5Qrcode && html5Qrcode.isScanning) {
      html5Qrcode.stop().then(() => { if (modal) modal.hidden = true; });
    } else { if (modal) modal.hidden = true; }
  }

  closeEls.forEach(el => el.addEventListener('click', stopScanner));

  function handleScanResult(code) {
    const product = CSV_DATA.find(p => p.barcode === code);
    const isMeterMode = (els.meterSection && !els.meterSection.hidden);

    if (product) {
      if (isMeterMode) {
        if (confirm(`Tambahkan "${product.product_name}" ke kalkulator?`)) { addMeterProduct(product); stopScanner(); }
      } else {
        openDetail(product); stopScanner();
      }
    } else {
      alert('Produk tidak ditemukan.');
    }
  }

  // Initial Load Route
  if (location.hash === '#home') show('home');
  else show('info');

});