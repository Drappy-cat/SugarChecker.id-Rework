document.addEventListener('DOMContentLoaded', async () => {
  const THEME_KEY = 'sc-theme';
  const toggle = document.getElementById('theme-toggle');

  // Theme Toggle Logic
  if (toggle) {
    toggle.checked = (document.documentElement.getAttribute('data-theme') === 'dark');
    toggle.addEventListener('change', () => {
      const val = toggle.checked ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', val);
      localStorage.setItem(THEME_KEY, val);
    });
  }

  // ===== DOM Elements =====
  const welcomeInfo = document.getElementById('welcome-info');
  const goToListBtn = document.getElementById('go-to-main');
  const openInfoBtn = document.getElementById('open-info');
  const navMeterBtn = document.getElementById('nav-meter-btn');

  const landing = document.getElementById('landing');
  const detail = document.getElementById('detail');
  const meterSection = document.getElementById('sugar-meter');

  const goHome = document.getElementById('go-home');
  const backBtn = document.getElementById('back-to-home');

  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  const resultsWrap = document.getElementById('search-results');
  const openScannerBtn = document.getElementById('open-scanner');
  const suggestionsContainer = document.getElementById('search-suggestions');

  // Detail Elements
  const namaMakanan = document.getElementById('nama-makanan');
  const ukuranPorsi = document.getElementById('ukuran-porsi');
  const tabelGizi = document.getElementById('tabel-gizi');
  const persenAKG = document.getElementById('persen-akg');
  const rincianMakro = document.getElementById('rincian-makro');
  const fotoMakanan = document.getElementById('foto-makanan');
  const fotoMakananNA = document.getElementById('foto-makanan-na');
  const infoManufaktur = document.getElementById('info-manufaktur');
  const infoUkuran = document.getElementById('info-ukuran');
  const infoBarcode = document.getElementById('info-barcode');
  const infoBarcodeImg = document.getElementById('info-barcode-img');
  const infoKal = document.getElementById('info-kalori');
  const infoLemak = document.getElementById('info-lemak');
  const infoKarbo = document.getElementById('info-karbo');
  const infoProtein = document.getElementById('info-protein');

  // Sugar Meter Elements
  const goMeterBtn = document.getElementById('go-to-meter');
  const backMeterBtn = document.getElementById('back-from-meter');
  const meterSearch = document.getElementById('meter-search');
  const meterSort = document.getElementById('meter-sort');
  const meterGrid = document.getElementById('meter-product-grid');
  const meterPagination = document.getElementById('meter-pagination');

  // Checking Elements
  const selectedList = document.getElementById('selected-products-list');
  const gaugeValue = document.getElementById('gauge-value');
  const gaugeStatus = document.getElementById('gauge-status');
  const gaugeWarning = document.getElementById('gauge-warning');
  const gaugeNeedle = document.getElementById('gauge-needle');
  const meterScanBtn = document.getElementById('meter-scan-btn');

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
          if (char === '"') {
            inQuote = !inQuote;
          } else if (char === ',' && !inQuote) {
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

  CSV_DATA = await loadCSV();

  // ===== Helpers =====
  function transformGoogleDriveUrl(url) {
    if (!url || url.toUpperCase() === 'NULL')
      return 'https://placehold.co/64x64/e0e0e0/757575?text=No+Image';

    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
    return url;
  }

  // ===== Navigation Logic =====
  function show(sectionId) {
    [welcomeInfo, landing, detail, meterSection].forEach(el => {
      if (el) el.hidden = true;
    });

    const target = document.getElementById(sectionId === 'home' ? 'landing' :
      sectionId === 'info' ? 'welcome-info' :
        sectionId === 'meter' ? 'sugar-meter' : sectionId);
    if (target) target.hidden = false;

    if (navMeterBtn) {
      navMeterBtn.hidden = !(sectionId === 'home' || sectionId === 'detail');
    }

    if (openInfoBtn) {
      openInfoBtn.hidden = (sectionId === 'info');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (goToListBtn) goToListBtn.addEventListener('click', () => show('home'));
  if (openInfoBtn) openInfoBtn.addEventListener('click', () => show('info'));
  if (navMeterBtn) navMeterBtn.addEventListener('click', () => show('meter'));

  if (goHome) goHome.addEventListener('click', (e) => { e.preventDefault(); show('home'); });
  if (backBtn) backBtn.addEventListener('click', () => show('home'));

  if (goMeterBtn) goMeterBtn.addEventListener('click', () => show('meter'));
  if (backMeterBtn) backMeterBtn.addEventListener('click', () => show('home'));

  // ===== Search Logic =====
  if (searchForm) searchForm.addEventListener('submit', e => { e.preventDefault(); doSearch(searchInput.value); });
  if (searchInput) searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim();
    if (!q) { resultsWrap.innerHTML = ''; renderSuggestions([]); return; }
    getSuggestions(q);
  });
  document.addEventListener('click', e => {
    if (suggestionsContainer && !searchForm.contains(e.target)) suggestionsContainer.style.display = 'none';
  });

  function renderResults(list) {
    resultsWrap.innerHTML = '';
    if (!list.length) {
      resultsWrap.innerHTML = '<div class="card" style="grid-column:1/-1;text-align:center">Tidak ada hasil.</div>';
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
      resultsWrap.appendChild(card);
    });
  }

  function doSearch(q) {
    const query = (q || '').trim().toLowerCase();
    if (!query || query.length < 2) { resultsWrap.innerHTML = ''; return; }
    const filtered = CSV_DATA.filter(p => (p.product_name || '').toLowerCase().includes(query));
    renderResults(filtered);
  }

  function renderSuggestions(suggestions) {
    suggestionsContainer.innerHTML = '';
    if (!suggestions.length) { suggestionsContainer.style.display = 'none'; return; }
    suggestions.forEach(s => {
      const item = document.createElement('div'); item.className = 'suggestion-item';
      item.textContent = s.product_name;
      item.addEventListener('click', () => {
        searchInput.value = s.product_name;
        doSearch(s.product_name);
      });
      suggestionsContainer.appendChild(item);
    });
    suggestionsContainer.style.display = 'block';
  }

  function getSuggestions(query) {
    const filtered = CSV_DATA.filter(p => (p.product_name || '').toLowerCase().includes(query.toLowerCase()));
    renderSuggestions(filtered.slice(0, 10));
  }

  // ===== Detail Logic =====
  function openDetail(p) {
    namaMakanan.textContent = p.product_name;
    ukuranPorsi.textContent = (p.nf_serving_size || 100) + ' g';

    if (p.main_image) {
      fotoMakanan.src = transformGoogleDriveUrl(p.main_image);
      fotoMakanan.hidden = false;
      fotoMakananNA.hidden = true;
    } else { fotoMakanan.hidden = true; fotoMakananNA.hidden = false; }

    if (p.barcode_image && p.barcode_image !== 'NULL') {
      infoBarcodeImg.src = transformGoogleDriveUrl(p.barcode_image);
      infoBarcodeImg.hidden = false;
    } else {
      infoBarcodeImg.src = 'https://placehold.co/64x64/e0e0e0/757575?text=No+Image';
      infoBarcodeImg.hidden = false;
    }

    infoManufaktur.textContent = p.brand || '-';
    infoUkuran.textContent = p.weight ? `${p.weight} ${p.unit || ''}` : '-';
    infoBarcode.textContent = p.barcode || '-';

    tabelGizi.innerHTML = '';
    const addRow = (label, val, unit, akgVal) => {
      const tr = document.createElement('tr');
      let displayVal = `${val} ${unit}`;
      if (akgVal !== undefined && akgVal !== null) {
        displayVal += ` <small style="color:#666">(${akgVal}% AKG)</small>`;
      }
      tr.innerHTML = `<td>${label}</td><td>${displayVal}</td>`;
      tabelGizi.appendChild(tr);
    };

    addRow('Energi Total', p.nf_calories || 0, 'kkal', p.akg_calories);
    addRow('Lemak Total', p.nf_total_fat || 0, 'g', p.akg_fat);
    addRow('Lemak Jenuh', p.nf_saturated_fat || 0, 'g', p.akg_saturated_fat);
    addRow('Protein', p.nf_protein || 0, 'g', p.akg_protein);
    addRow('Karbohidrat', p.nf_total_carbs || 0, 'g', p.akg_carbs);
    addRow('Gula Total', p.nf_total_sugars || 0, 'g', null);

    if (p.sugar_spoons) {
      const tr = document.createElement('tr');
      tr.style.backgroundColor = '#fff3e0';
      tr.innerHTML = `<td style="font-weight:bold; color:#d84315">Setara Gula</td>
                      <td style="font-weight:bold; color:#d84315">~ ${p.sugar_spoons} Sendok Makan</td>`;
      tabelGizi.appendChild(tr);
    }

    addRow('Garam (Natrium)', p.nf_sodium || 0, 'mg', p.akg_sodium);

    infoKal.textContent = p.nf_calories || 0;
    infoLemak.textContent = (p.nf_total_fat || 0) + 'g';
    infoKarbo.textContent = (p.nf_total_carbs || 0) + 'g';
    infoProtein.textContent = (p.nf_protein || 0) + 'g';

    if (p.akg_calories) {
      persenAKG.textContent = `≈ ${p.akg_calories}% dari AKG*`;
    } else {
      persenAKG.textContent = `≈ ${Math.round(((p.nf_calories || 0) / 2000) * 100)}% dari AKG*`;
    }

    const ctx = document.getElementById('macro-chart').getContext('2d');
    if (macroChart) macroChart.destroy();

    const c = (p.nf_total_carbs || 0) * 4, pr = (p.nf_protein || 0) * 4, f = (p.nf_total_fat || 0) * 9;
    const total = c + pr + f;
    const cp = total ? Math.round(c / total * 100) : 0;
    const pp = total ? Math.round(pr / total * 100) : 0;
    const fp = 100 - cp - pp;

    rincianMakro.textContent = `Karbohidrat ${cp}%, Protein ${pp}%, Lemak ${fp}%`;

    macroChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Karbo', 'Protein', 'Lemak'],
        datasets: [{
          data: [cp, pp, fp],
          backgroundColor: ['#42a5f5', '#66bb6a', '#ff7043']
        }]
      },
      options: { plugins: { legend: { position: 'bottom' } }, cutout: '65%' }
    });

    show('detail');
  }

  // ===== Sugar Meter Logic (NATIVE GAUGE) =====
  if (meterSearch) meterSearch.addEventListener('input', (e) => {
    METER_STATE.search = e.target.value;
    METER_STATE.page = 1;
    renderMeterGrid();
  });

  if (meterSort) meterSort.addEventListener('change', (e) => {
    METER_STATE.sort = e.target.value;
    METER_STATE.page = 1;
    renderMeterGrid();
  });

  if (meterScanBtn) meterScanBtn.addEventListener('click', () => {
    openScanner();
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

  // Native Gauge Update Logic
  function updateGauge() {
    const MAX_SUGAR = 50;
    const MAX_VISUAL = 75; // Gauge max value
    const totalSugar = METER_STATE.selected.reduce((acc, curr) => acc + (parseFloat(curr.nf_total_sugars) || 0), 0);
    const percentage = MAX_SUGAR > 0 ? (totalSugar / MAX_SUGAR) * 100 : 0;

    if (gaugeValue) gaugeValue.textContent = `${totalSugar.toFixed(1)}g`;

    // Logic Warna & Status
    let statusText = "Aman";
    let statusColor = "#4caf50";

    if (totalSugar > MAX_SUGAR) {
      statusText = "Berlebih!";
      statusColor = "#d32f2f"; // Red
    } else if (totalSugar > 25) { // 25g - 50g
      statusText = "Waspada";
      statusColor = "#ff9800"; // Orange
    } else {
      statusText = "Aman";
      statusColor = "#4caf50"; // Green
    }

    if (gaugeStatus) {
      gaugeStatus.textContent = `${statusText} (${Math.round(percentage)}%)`;
      gaugeStatus.style.color = statusColor;
    }

    // Warning
    if (totalSugar > MAX_SUGAR) {
      if (gaugeWarning) gaugeWarning.style.display = 'block';
      if (gaugeValue) gaugeValue.style.color = 'var(--danger)';
    } else {
      if (gaugeWarning) gaugeWarning.style.display = 'none';
      if (gaugeValue) gaugeValue.style.color = 'var(--text)';
    }

    // Needle Rotation Logic
    // 0g = -90deg (Left)
    // 75g (Max) = +90deg (Right)
    // Range is 180 degrees.
    if (gaugeNeedle) {
      let val = Math.min(totalSugar, MAX_VISUAL);
      // Normalize val (0-75) to range (0-1)
      let ratio = val / MAX_VISUAL;
      // Map to -90 -> 90: -90 + (ratio * 180)
      let deg = -90 + (ratio * 180);
      gaugeNeedle.style.transform = `rotate(${deg}deg)`;
    }
  }

  function renderMeterGrid() {
    if (!meterGrid) return;
    meterGrid.innerHTML = '';
    const data = getFilteredMeterData();

    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / METER_STATE.itemsPerPage);
    if (METER_STATE.page > totalPages) METER_STATE.page = totalPages || 1;

    const start = (METER_STATE.page - 1) * METER_STATE.itemsPerPage;
    const end = start + METER_STATE.itemsPerPage;
    const pageData = data.slice(start, end);

    if (pageData.length === 0) {
      meterGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center">Tidak ada produk ditemukan.</div>';
    } else {
      pageData.forEach(p => {
        const card = document.createElement('div');
        card.className = 'result-card';
        card.style.flexDirection = 'column';
        card.style.alignItems = 'flex-start';

        const img = document.createElement('img');
        img.className = 'result-thumb';
        img.style.width = '100%';
        img.style.height = '120px';
        img.src = (p.main_image && p.main_image !== 'NULL') ? transformGoogleDriveUrl(p.main_image) : 'https://placehold.co/64x64/e0e0e0/757575?text=No+Image';

        const meta = document.createElement('div');
        meta.style.width = '100%';
        meta.innerHTML = `<div class="result-title" style="margin-top:8px">${p.product_name}</div>
                          <div class="result-sub">${p.brand || ''}</div>
                          <div style="font-size:0.9rem; margin-top:4px; color:var(--text)">Gula: <strong>${p.nf_total_sugars || 0}g</strong></div>`;

        const btn = document.createElement('button');
        btn.className = 'btn-add';
        btn.textContent = '+ Tambah';
        if (METER_STATE.selected.length >= 5) {
          btn.disabled = true;
          btn.textContent = 'Penuh (Max 5)';
        }
        btn.addEventListener('click', () => addMeterProduct(p));

        card.append(img, meta, btn);
        meterGrid.appendChild(card);
      });
    }
    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    if (!meterPagination) return;
    meterPagination.innerHTML = '';
    if (totalPages <= 1) return;

    const createBtn = (page, text, isActive = false) => {
      const b = document.createElement('button');
      b.className = `page-btn ${isActive ? 'active' : ''}`;
      b.textContent = text;
      b.addEventListener('click', () => {
        METER_STATE.page = page;
        renderMeterGrid();
      });
      return b;
    };

    if (METER_STATE.page > 1) meterPagination.appendChild(createBtn(METER_STATE.page - 1, '«'));

    let startPage = Math.max(1, METER_STATE.page - 2);
    let endPage = Math.min(totalPages, METER_STATE.page + 2);

    if (startPage > 1) {
      meterPagination.appendChild(createBtn(1, '1'));
      if (startPage > 2) meterPagination.appendChild(document.createTextNode('...'));
    }

    for (let i = startPage; i <= endPage; i++) {
      meterPagination.appendChild(createBtn(i, i, i === METER_STATE.page));
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) meterPagination.appendChild(document.createTextNode('...'));
      meterPagination.appendChild(createBtn(totalPages, totalPages));
    }

    if (METER_STATE.page < totalPages) meterPagination.appendChild(createBtn(METER_STATE.page + 1, '»'));
  }

  function addMeterProduct(p) {
    if (METER_STATE.selected.length >= 5) return;
    METER_STATE.selected.push(p);
    updateGauge();
    renderSelectedList();
    renderMeterGrid();
  }

  function removeMeterProduct(index) {
    METER_STATE.selected.splice(index, 1);
    updateGauge();
    renderSelectedList();
    renderMeterGrid();
  }

  function renderSelectedList() {
    if (!selectedList) return;
    selectedList.innerHTML = '';
    if (METER_STATE.selected.length === 0) {
      selectedList.innerHTML = '<p class="empty-hint" style="text-align:center; color: var(--text-muted);">Belum ada produk dipilih (Max 5)</p>';
      return;
    }
    METER_STATE.selected.forEach((p, idx) => {
      const div = document.createElement('div');
      div.className = 'selected-item';

      // Clickable Name Area
      const infoDiv = document.createElement('div');
      infoDiv.style.flex = '1';
      infoDiv.style.cursor = 'pointer';
      infoDiv.title = 'Lihat Detail';
      infoDiv.innerHTML = `<div class="selected-item-name" style="text-decoration:underline">${p.product_name}</div><div class="selected-item-val">${p.nf_total_sugars || 0}g</div>`;
      infoDiv.addEventListener('click', () => openDetail(p));

      const btn = document.createElement('button');
      btn.className = 'remove-btn';
      btn.innerHTML = '×';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeMeterProduct(idx);
      });

      div.appendChild(infoDiv);
      div.appendChild(btn);
      selectedList.appendChild(div);
    });
  }

  // ===== Scanner Logic =====
  let html5Qrcode;
  let activeCamId = null;
  const modal = document.getElementById('scanner-modal');
  const cameraSelect = document.getElementById('camera-select');
  const closeEls = modal ? Array.from(modal.querySelectorAll('[data-close]')) : [];

  async function openScanner() {
    if (!modal) return;
    modal.hidden = false; modal.setAttribute('aria-hidden', 'false');
    try {
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || !cameras.length) { alert('Kamera tidak ditemukan.'); return; }
      activeCamId = cameras[0].id;
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
      console.error(e);
      alert('Gagal akses kamera.');
    }
  }

  function stopScanner() {
    if (html5Qrcode && html5Qrcode.isScanning) {
      html5Qrcode.stop().then(() => {
        if (modal) modal.hidden = true;
      });
    } else {
      if (modal) modal.hidden = true;
    }
  }

  if (closeEls.length) closeEls.forEach(el => el.addEventListener('click', stopScanner));

  function handleScanResult(code) {
    const product = CSV_DATA.find(p => p.barcode === code);

    const isMeterMode = (document.getElementById('sugar-meter') && !document.getElementById('sugar-meter').hidden);

    if (isMeterMode) {
      if (product) {
        if (confirm(`Tambahkan "${product.product_name}" ke kalkulator?`)) {
          addMeterProduct(product);
          stopScanner();
        }
      } else {
        alert('Produk tidak ditemukan.');
      }
    } else {
      if (product) {
        openDetail(product);
        stopScanner();
      } else {
        alert('Produk tidak ditemukan.');
      }
    }
  }

  // ===== Initial Load =====
  if (location.hash === '#home') show('home');
  else show('info');

});