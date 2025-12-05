document.addEventListener('DOMContentLoaded', async () => {
  const THEME_KEY = 'sc-theme';
  const toggle = document.getElementById('theme-toggle');
  toggle.checked = (document.documentElement.getAttribute('data-theme') === 'dark');
  toggle.addEventListener('change', () => {
    const val = toggle.checked ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', val);
    localStorage.setItem(THEME_KEY, val);
  });

  // ===== DOM (Diperbarui) =====
  const welcomeInfo = document.getElementById('welcome-info'); // BARU
  const goToListBtn = document.getElementById('go-to-main');   // BARU
  const openInfoBtn = document.getElementById('open-info');     // BARU

  const landing = document.getElementById('landing');
  const detail = document.getElementById('detail');
  const ecodesInfo = document.getElementById('ecodes-info');
  const goHome = document.getElementById('go-home');
  const backBtn = document.getElementById('back-to-home');

  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  const resultsWrap = document.getElementById('search-results');
  const openScannerBtn = document.getElementById('open-scanner');
  const suggestionsContainer = document.getElementById('search-suggestions');

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

  let macroChart;

  // ===== CSV =====
  let CSV_DATA = [];

  async function loadCSV() {
    try {
      const res = await fetch('./dataset/composition.csv');
      if (!res.ok) throw new Error(`HTTP error! ${res.status}`);

      const text = await res.text();
      const lines = text.trim().split('\n');

      // Regex untuk split CSV yang menangani koma di dalam quotes
      // Menangkap: "quoted content" ATAU no-quotes-content
      const csvSplitRegex = /(?:,|^)(?:"([^"]*)"|([^",]*))/g;

      function parseLine(line) {
        const cols = [];
        let match;
        csvSplitRegex.lastIndex = 0; // Reset regex state

        // Loop selama masih ada match, tapi hati-hati infinite loop jika regex salah
        // Cara yang lebih aman untuk split sederhana:
        // Kita bisa pakai replace trick atau matchAll, tapi matchAll support browser lama terbatas?
        // Mari gunakan pendekatan match manual:

        // NOTE: Regex split global kadang tricky. Kita coba pendekatan replace comma delimiter
        // yang di luar quote dengan karakter unik, lalu split.
        // ATAU gunakan library sederhana. Tapi kita buat manual saja biar tanpa deps.

        // Pendekatan iteratif karakter per karakter lebih stabil untuk 'quote aware split'.
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
        cols.push(current.trim()); // kolom terakhir

        // Bersihkan quotes di awal/akhir hasil
        return cols.map(c => c.replace(/^"|"$/g, '').trim());
      }

      const headers = parseLine(lines[0]);

      return lines.slice(1).map(line => {
        if (!line.trim()) return null; // skip baris kosong
        const cols = parseLine(line);
        const obj = {};

        headers.forEach((h, i) => {
          const val = (cols[i] || '');

          // Helper untuk number (mengganti koma dengan titik, lalu parse)
          const toNum = (v) => {
            if (!v) return 0;
            // Hapus titik ribuan (jika ada, asumsi format Indo 1.000,00 -> 1000.00)
            // Tapi di CSV ini sepertinya tidak ada ribuan titik, hanya koma desimal.
            // Cth: "10,23" -> 10.23
            return parseFloat(v.replace(/,/g, '.')) || 0;
          };

          // Mapping Header Indonesia -> Key Internal
          switch (h) {
            case 'Nama Produk': obj['product_name'] = val; break;
            case 'Produksi': obj['brand'] = val; break;

            // Ukuran/Berat kadang dipakai sebagai Serving Size juga
            case 'Ukuran/Berat':
              obj['weight'] = val;
              obj['nf_serving_size'] = val; // Default ke berat total jika serving size tidak spesifik
              break;

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

            case 'Kode Barcode':
              // Barcode mungkin ada spasi, kita hapus spasi
              obj['barcode'] = val.replace(/\s+/g, '');
              break;

            case 'Link Gambar Barcode': obj['barcode_image'] = val; break;
            case 'Link Gambar Produk': obj['main_image'] = val; break;

            default: obj[h] = val; break; // Simpan field lain apa adanya
          }
        });

        // Nilai default
        if (!obj.category) obj.category = '';
        if (!obj.description) obj.description = '';

        // Hitungan manual jika perlu, atau gunakan dari CSV
        // Kita sudah ambil dari CSV jika ada.

        return obj;
      }).filter(item => item !== null); // Hapus yang null

    } catch (e) {
      console.warn("CSV gagal load, pakai demo", e);
      return [
        {
          product_name: 'Indomie Soto (Demo)',
          brand: 'Indomie',
          barcode: '8991234567890',
          main_image: null,
          nf_serving_size: 100,
          nf_calories: 380,
          nf_total_fat: 14,
          nf_saturated_fat: 6,
          nf_protein: 8,
          nf_total_carbs: 54,
          nf_total_sugars: 2,
          nf_sodium: 1200
        }
      ];
    }
  }

  // Load CSV data
  CSV_DATA = await loadCSV();

  // ===== HELPERS =====
  // Transform Google Drive URL to direct link
  function transformGoogleDriveUrl(url) {
    if (!url || url.toUpperCase() === 'NULL')
      return 'https://placehold.co/64x64/e0e0e0/757575?text=No+Image';

    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      // return `https://drive.google.com/uc?export=view&id=${match[1]}`;
      return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
    return url;
  }

  // ===== ROUTER (Diperbarui) =====
  function show(section) {
    // Sembunyikan semua dulu
    welcomeInfo.hidden = true;
    landing.hidden = true;
    detail.hidden = true;
    ecodesInfo.hidden = true;
    openInfoBtn.hidden = true; // Sembunyikan tombol 'Lihat Info' secara default

    if (section === 'info') {
      welcomeInfo.hidden = false;
      // Di halaman info, 'Lihat Info' tidak perlu (sudah ada tombol lanjutkan)
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (section === 'home') {
      landing.hidden = false;
      ecodesInfo.hidden = false;
      openInfoBtn.hidden = false; // Tampilkan tombol 'Lihat Info'
      searchInput.focus();
    } else { // detail
      detail.hidden = false;
      openInfoBtn.hidden = false; // Tampilkan tombol 'Lihat Info'
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // ===== EVENT LISTENERS (Diperbarui) =====
  goHome.addEventListener('click', () => { show('home'); });
  backBtn.addEventListener('click', () => { show('home'); });

  // Event listener baru: Lanjutkan ke Aplikasi Utama
  goToListBtn.addEventListener('click', () => { show('home'); });

  // Event listener baru: Lihat Info
  openInfoBtn.addEventListener('click', () => { show('info'); });

  // ... (Sisa event listener lama) ...
  searchForm.addEventListener('submit', e => { e.preventDefault(); doSearch(searchInput.value); });
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim();
    if (!q) { resultsWrap.innerHTML = ''; renderSuggestions([]); return; }
    getSuggestions(q);
  });
  document.addEventListener('click', e => { if (!searchForm.contains(e.target)) suggestionsContainer.style.display = 'none'; });


  // ===== SEARCH (Tidak Berubah) =====
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
      //   console.log("p.main_image:", p.main_image, "\nimg.src:", img.src);
      img.className = 'result-thumb';
      if (p.main_image && p.main_image !== 'NULL') img.src = transformGoogleDriveUrl(p.main_image);
      else img.src = 'https://placehold.co/64x64/e0e0e0/757575?text=No+Image';
      //   console.log("\n\np.main_image:", p.main_image, "\nimg.src:", img.src);
      img.alt = p.product_name;

      const meta = document.createElement('div'); meta.className = 'result-meta';
      const title = document.createElement('div'); title.className = 'result-title'; title.textContent = p.product_name;
      const sub = document.createElement('div'); sub.className = 'result-sub';
      sub.textContent = `${p.brand || 'Tanpa Merek'} • ${p.barcode || '-'}`;
      meta.append(title, sub);
      card.append(img, meta);

      card.addEventListener('click', () => openDetail(p));
      card.addEventListener('keyup', e => { if (e.key === 'Enter' || e.key === ' ') openDetail(p); });

      resultsWrap.appendChild(card);
    });
  }

  async function doSearch(q) {
    const query = (q || '').trim().toLowerCase();
    if (!query || query.length < 2) {
      resultsWrap.innerHTML = '';
      return;
    }

    // Cari di product_name saja untuk query suggestions
    const filtered = CSV_DATA.filter(p =>
      (p.product_name || '').toLowerCase().includes(query.toLowerCase())
    );
    // console.log(`Search for "${query}", found ${filtered.length} items.`);
    // console.log(JSON.stringify(filtered, null, 2));

    renderResults(filtered);
  }

  function renderSuggestions(suggestions) {
    // console.log("renderSuggestions: ", suggestions);
    suggestionsContainer.innerHTML = '';
    if (!suggestions.length) { suggestionsContainer.style.display = 'none'; return; }
    suggestions.forEach(s => {
      //   console.log("s:", JSON.stringify(s));
      //   console.log("s.product_name: ", s.product_name);
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
    // console.log("getSuggestions for:", query);

    // Cari di product_name saja untuk query suggestions
    const filtered = CSV_DATA.filter(p =>
      (p.product_name || '').toLowerCase().includes(query.toLowerCase())
    );
    // console.log(`Suggestions for "${query}", found ${filtered.length} items.`);

    // Tampilkan maksimal 10 saran saja
    renderSuggestions(filtered.slice(0, 10));
  }


  // ===== DETAIL (Tidak Berubah) =====
  function openDetail(p) {
    namaMakanan.textContent = p.product_name;
    ukuranPorsi.textContent = (p.nf_serving_size || 100) + ' g';

    if (p.main_image) {
      const transformed = transformGoogleDriveUrl(p.main_image);
      fotoMakanan.src = transformed;
      fotoMakanan.hidden = false;
      fotoMakananNA.hidden = true;
    } else { fotoMakanan.hidden = true; fotoMakananNA.hidden = false; }

    // Menampilkan barcode image jika ada
    // console.log("p.barcode_image:", p.barcode_image, "\ninfoBarcodeImg.src sebelum:", infoBarcodeImg.src);
    if (p.barcode_image && p.barcode_image !== 'NULL') {
      const transformed = transformGoogleDriveUrl(p.barcode_image);
      infoBarcodeImg.src = transformed;
      infoBarcodeImg.alt = `Barcode untuk ${p.product_name}`;
      infoBarcodeImg.hidden = false;
      // infoBarcodeImgNA.hidden = true;
    }
    else {
      // Menyembunyikan tulisan "Gambar barcode belum tersedia"  jika tidak ada
      infoBarcodeImg.src = 'https://placehold.co/64x64/e0e0e0/757575?text=No+Image';
      infoBarcodeImg.hidden = false;
    }

    infoManufaktur.textContent = p.brand || '-';
    infoUkuran.textContent = p.weight ? `${p.weight} ${p.unit || ''}` : '-';
    infoBarcode.textContent = p.barcode || '-';

    tabelGizi.innerHTML = '';

    // Helper untuk format baris tabel
    const addRow = (label, val, unit, akgVal) => {
      const tr = document.createElement('tr');
      // Jika ada nilai AKG, tampilkan di kolom nilai atau terpisah?
      // Desain tabel: Label | Nilai
      // Kita bisa format nilai: "X g (Y% AKG)"
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
    addRow('Gula Total', p.nf_total_sugars || 0, 'g', null); // Gula biasanya ga ada AKG spesifik di kemasan, tapi ada batas WHO

    if (p.sugar_spoons) {
      // Highlight konversi gula
      // Gunakan style inline untuk simplicity karena kita tidak ubah CSS file sesuai rencana awal yang JS centric
      const tr = document.createElement('tr');
      tr.style.backgroundColor = '#fff3e0'; // Agak kuning highlight
      tr.innerHTML = `<td style="font-weight:bold; color:#d84315">Setara Gula</td>
                        <td style="font-weight:bold; color:#d84315">~ ${p.sugar_spoons} Sendok Makan</td>`;
      tabelGizi.appendChild(tr);
    }

    addRow('Garam (Natrium)', p.nf_sodium || 0, 'mg', p.akg_sodium);

    // Update info cards di atas (Ringkasan)
    // Gunakan helper toNum untuk memastikan tipe data jika belum
    const cal = p.nf_calories || 0;
    infoKal.textContent = cal;
    infoLemak.textContent = (p.nf_total_fat || 0) + 'g';
    infoKarbo.textContent = (p.nf_total_carbs || 0) + 'g';
    infoProtein.textContent = (p.nf_protein || 0) + 'g';

    // Persen AKG Utama (Energi)
    if (p.akg_calories) {
      persenAKG.textContent = `≈ ${p.akg_calories}% dari AKG*`;
    } else {
      // Fallback hitung manual jika data kosong
      persenAKG.textContent = `≈ ${Math.round((parseFloat(cal) / 2000) * 100)}% dari AKG*`;
    }

    // Makro chart
    const ctx = document.getElementById('macro-chart').getContext('2d');
    if (macroChart) macroChart.destroy();
    const carbsGram = p.nf_total_carbs || 0;
    const proteinGram = p.nf_protein || 0;
    const fatGram = p.nf_total_fat || 0;
    const carbsCal = carbsGram * 4, proteinCal = proteinGram * 4, fatCal = fatGram * 9;
    const totalMacro = carbsCal + proteinCal + fatCal;
    const carbsPercent = totalMacro ? Math.round((carbsCal / totalMacro) * 100) : 0;
    const proteinPercent = totalMacro ? Math.round((proteinCal / totalMacro) * 100) : 0;
    const fatPercent = 100 - carbsPercent - proteinPercent;
    rincianMakro.textContent = `Karbohidrat ${carbsPercent}%, Protein ${proteinPercent}%, Lemak ${fatPercent}%`;

    const css = getComputedStyle(document.documentElement);
    macroChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Karbo', 'Protein', 'Lemak'],
        datasets: [{
          data: [carbsPercent, proteinPercent, fatPercent],
          backgroundColor: [
            css.getPropertyValue('--chart-carb')?.trim() || '#42a5f5',
            css.getPropertyValue('--chart-protein')?.trim() || '#66bb6a',
            css.getPropertyValue('--chart-fat')?.trim() || '#ff7043'
          ]
        }]
      },
      options: { plugins: { legend: { position: 'bottom' } }, cutout: '65%' }
    });

    show('detail');
  }

  // ===== SCANNER (Tidak Berubah) =====
  const modal = document.getElementById('scanner-modal');
  const closeEls = Array.from(modal.querySelectorAll('[data-close]'));
  const cameraSelect = document.getElementById('camera-select');
  const switchBtn = document.getElementById('switch-camera');
  const fileInput = document.getElementById('barcode-file');
  let html5Qrcode;
  let activeCamId = null;

  async function startWithCamera(deviceIdOrFacingMode) {
    if (!html5Qrcode) html5Qrcode = new Html5Qrcode('qr-reader');
    const config = {
      fps: 12,
      qrbox: { width: 260, height: 140 },
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E
      ]
    };
    await html5Qrcode.start(
      deviceIdOrFacingMode,
      config,
      async (decodedText) => {
        handleScanResult(decodedText);
      },
      _ => { }
    );
  }

  function bestBackCamera(cameras) {
    const back = cameras.find(c => /back|rear|environment/i.test(c.label));
    return back ? back.id : (cameras[0] && cameras[0].id);
  }

  function populateCameraSelect(cameras, selectedId) {
    cameraSelect.innerHTML = '';
    cameras.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id; opt.textContent = c.label || c.id;
      if (c.id === selectedId) opt.selected = true;
      cameraSelect.appendChild(opt);
    });
  }

  async function openScanner() {
    modal.hidden = false; modal.setAttribute('aria-hidden', 'false');
    try {
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) {
        alert('Kamera tidak ditemukan. Coba “Scan dari Foto”.');
        return;
      }
      activeCamId = bestBackCamera(cameras);
      populateCameraSelect(cameras, activeCamId);
      await startWithCamera(activeCamId);
    } catch (err) {
      console.error('Tidak bisa akses kamera:', err);
      try {
        await startWithCamera({ facingMode: 'environment' });
      } catch (e) {
        alert('Akses kamera gagal. Coba “Scan dari Foto”.');
      }
    }
  }

  function stopScanner() {
    if (html5Qrcode && html5Qrcode.isScanning) {
      html5Qrcode.stop().catch(() => { }).finally(() => {
        modal.hidden = true; modal.setAttribute('aria-hidden', 'true');
      });
    } else {
      modal.hidden = true; modal.setAttribute('aria-hidden', 'true');
    }
  }

  openScannerBtn.addEventListener('click', openScanner);
  cameraSelect.addEventListener('change', async () => {
    const newId = cameraSelect.value;
    if (newId && newId !== activeCamId) {
      await html5Qrcode.stop().catch(() => { });
      activeCamId = newId;
      await startWithCamera(activeCamId);
    }
  });
  switchBtn.addEventListener('click', async () => {
    const opts = Array.from(cameraSelect.options);
    if (opts.length < 2) return;
    const idx = opts.findIndex(o => o.value === cameraSelect.value);
    const next = opts[(idx + 1) % opts.length].value;
    cameraSelect.value = next;
    cameraSelect.dispatchEvent(new Event('change'));
  });
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (!html5Qrcode) html5Qrcode = new Html5Qrcode('qr-reader');
      // Hentikan kamera jika sedang aktif agar tidak bentrok
      if (html5Qrcode.isScanning) {
        await html5Qrcode.stop();
      }
      const result = await html5Qrcode.scanFile(file, true);
      handleScanResult(result);
    } catch (err) {
      // Tampilkan pesan error yang lebih spesifik
      const errorMessage = typeof err === 'string' ? err : err.message;
      console.error('Scan from file error:', errorMessage);
      alert(`Gagal memindai dari foto. Pesan: ${errorMessage}`);
    } finally {
      e.target.value = '';
    }
  });
  closeEls.forEach(el => el.addEventListener('click', stopScanner));
  modal.addEventListener('click', e => {
    if (e.target === modal || e.target.classList.contains('modal-backdrop')) stopScanner();
  });

  // Logika Awal (Diperbarui): Tampilkan halaman info di awal
  if (location.hash === '#home' || location.hash === '') {
    // Jika URL memiliki hash '#home' atau tidak ada hash sama sekali,
    // tampilkan halaman info
    show('info');
  } else {
    // Jika ada hash lain (misalnya setelah scan/klik, jika diimplementasikan),
    // maka tampilkan halaman utama/detail
    show('home');
    doSearch('Indomie');
  }

  function isValidEan13(code) {
    if (!/^\d{13}$/.test(code)) return false;
    const digits = code.split('').map(d => +d);
    const sum = digits.slice(0, 12).reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
    const check = (10 - (sum % 10)) % 10;
    return check === digits[12];
  }

  function normalizeBarcode(raw) {
    return String(raw || '').replace(/\D/g, '');
  }

  function handleScanResult(raw) {
    const code = normalizeBarcode(raw);

    const onlyDigitsLenOK = /^\d{8,14}$/.test(code);
    const ean13OK = (code.length !== 13) || isValidEan13(code);

    if (!onlyDigitsLenOK || !ean13OK) {
      alert('Barcode tidak valid. Pastikan EAN-13/EAN-8/UPC dengan digit benar.');
      return;
    }

    // Cari produk di CSV_DATA berdasarkan barcode
    const product = CSV_DATA.find(p => p.barcode === code);

    // LOGIC BARU: Cek apakah sedang di mode Meter atau Home
    if (activeCamId && document.getElementById('sugar-meter').hidden === false) {
      // Mode Meter
      if (product) {
        const confirmAdd = confirm(`Tambahkan "${product.product_name}" ke kalkulator?`);
        if (confirmAdd) {
          addMeterProduct(product);
          stopScanner();
        }
      } else {
        alert(`Produk dengan barcode ${code} tidak ditemukan.`);
      }
    } else {
      // Mode Home (Standard)
      if (product) {
        openDetail(product);
        stopScanner(); // Tutup modal setelah sukses
      } else {
        alert(`Produk dengan barcode ${code} tidak ditemukan di dalam data.`);
      }
    }
  }

  // ===== SUGAR METER LOGIC (NEW) =====
  let METER_STATE = {
    selected: [],
    page: 1,
    itemsPerPage: 20,
    search: '',
    sort: 'asc' // 'asc' or 'desc'
  };
  let METER_CHART = null;

  // DOM Elements for Meter
  const meterSection = document.getElementById('sugar-meter');
  const goMeterBtn = document.getElementById('go-to-meter');
  const backMeterBtn = document.getElementById('back-from-meter');
  const meterSearch = document.getElementById('meter-search');
  const meterSort = document.getElementById('meter-sort');
  const meterGrid = document.getElementById('meter-product-grid');
  const meterPagination = document.getElementById('meter-pagination');
  const selectedList = document.getElementById('selected-products-list');
  const gaugeValue = document.getElementById('gauge-value');
  const gaugeWarning = document.getElementById('gauge-warning');
  const meterScanBtn = document.getElementById('meter-scan-btn');
  const navMeterBtn = document.getElementById('nav-meter-btn'); // BARU

  // Navigation
  goMeterBtn.addEventListener('click', () => { show('meter'); });
  backMeterBtn.addEventListener('click', () => { show('home'); });
  if (navMeterBtn) navMeterBtn.addEventListener('click', () => { show('meter'); });

  // Event Listeners
  meterSearch.addEventListener('input', (e) => {
    METER_STATE.search = e.target.value;
    METER_STATE.page = 1;
    renderMeterGrid();
  });

  meterSort.addEventListener('change', (e) => {
    METER_STATE.sort = e.target.value;
    METER_STATE.page = 1;
    renderMeterGrid();
  });

  meterScanBtn.addEventListener('click', () => {
    // Buka scanner (re-use existing scanner)
    // Logika handleScanResult sudah dimodifikasi di atas untuk cek mode
    openScanner();
  });

  // Override show function to init Meter if needed
  const originalShow = show;
  show = function (section) {
    if (section === 'meter') {
      // Hide others
      welcomeInfo.hidden = true;
      landing.hidden = true;
      detail.hidden = true;
      ecodesInfo.hidden = true;

      meterSection.hidden = false;
      openInfoBtn.hidden = false;
      if (navMeterBtn) navMeterBtn.hidden = true; // Sembunyikan tombol nav ke diri sendiri saat di halaman meter

      renderMeterGrid();
      updateGauge();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      meterSection.hidden = true;
      // Call original
      // Kita copy logic originalShow karena overriding function variable kadang tricky kalau pakai const di dlm scope
      // Refactor manual bagian original 'show' di bawah

      welcomeInfo.hidden = true;
      landing.hidden = true;
      detail.hidden = true;
      ecodesInfo.hidden = true;
      openInfoBtn.hidden = true;
      if (navMeterBtn) navMeterBtn.hidden = true;

      if (section === 'info') {
        welcomeInfo.hidden = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (section === 'home') {
        landing.hidden = false;
        ecodesInfo.hidden = false;
        openInfoBtn.hidden = false;
        if (navMeterBtn) navMeterBtn.hidden = false; // Tampilkan di Home
        searchInput.focus();
      } else if (section === 'detail') { // detail
        detail.hidden = false;
        openInfoBtn.hidden = false;
        if (navMeterBtn) navMeterBtn.hidden = false; // Tampilkan di Detail
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };


  function getFilteredMeterData() {
    let data = [...CSV_DATA];

    // Filter Search
    if (METER_STATE.search) {
      const q = METER_STATE.search.toLowerCase();
      data = data.filter(p => (p.product_name || '').toLowerCase().includes(q));
    }

    // Sort
    data.sort((a, b) => {
      const nameA = (a.product_name || '').toLowerCase();
      const nameB = (b.product_name || '').toLowerCase();
      if (METER_STATE.sort === 'asc') return nameA.localeCompare(nameB);
      return nameB.localeCompare(nameA);
    });

    return data;
  }

  function renderMeterGrid() {
    meterGrid.innerHTML = '';
    const data = getFilteredMeterData();

    // Pagination
    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / METER_STATE.itemsPerPage);

    // Clamp page
    if (METER_STATE.page > totalPages) METER_STATE.page = totalPages || 1;

    const start = (METER_STATE.page - 1) * METER_STATE.itemsPerPage;
    const end = start + METER_STATE.itemsPerPage;
    const pageData = data.slice(start, end);

    // Render Grid
    if (pageData.length === 0) {
      meterGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center">Tidak ada produk ditemukan.</div>';
    } else {
      pageData.forEach(p => {
        const card = document.createElement('div');
        card.className = 'result-card';
        card.style.flexDirection = 'column';
        card.style.alignItems = 'flex-start';

        // Image
        const img = document.createElement('img');
        img.className = 'result-thumb';
        img.style.width = '100%';
        img.style.height = '120px';
        if (p.main_image && p.main_image !== 'NULL') img.src = transformGoogleDriveUrl(p.main_image);
        else img.src = 'https://placehold.co/64x64/e0e0e0/757575?text=No+Image';

        const meta = document.createElement('div');
        meta.style.width = '100%';
        meta.innerHTML = `<div class="result-title" style="margin-top:8px">${p.product_name}</div>
                                <div class="result-sub">${p.brand || ''}</div>
                                <div style="font-size:0.9rem; margin-top:4px; color:var(--text)">Gula: <strong>${p.nf_total_sugars || 0}g</strong></div>`;

        const btn = document.createElement('button');
        btn.className = 'btn-add';
        btn.textContent = '+ Tambah';
        // Disable jika sudah max 5 atau sudah ada di list (optional: boleh double?)
        // Requirement: Max 5 produk. Boleh double? Asumsi boleh.
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
    meterPagination.innerHTML = '';
    if (totalPages <= 1) return;

    // Simple pagination: Prev, 1 ... Current ... Total, Next
    // Untuk simplicity: Show all numbers if < 8, else abbreviated
    // Tampilkan window kecil sekitar current page

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

    // Prev
    if (METER_STATE.page > 1) {
      meterPagination.appendChild(createBtn(METER_STATE.page - 1, '«'));
    }

    // Logic window pagination simple
    let startPage = Math.max(1, METER_STATE.page - 2);
    let endPage = Math.min(totalPages, METER_STATE.page + 2);

    // Adjust window if near start/end
    if (startPage <= 2) endPage = Math.min(totalPages, 5);
    if (endPage >= totalPages - 1) startPage = Math.max(1, totalPages - 4);

    if (startPage > 1) {
      meterPagination.appendChild(createBtn(1, '1'));
      if (startPage > 2) {
        const span = document.createElement('span'); span.textContent = '...'; span.style.alignSelf = 'center';
        meterPagination.appendChild(span);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      meterPagination.appendChild(createBtn(i, i, i === METER_STATE.page));
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        const span = document.createElement('span'); span.textContent = '...'; span.style.alignSelf = 'center';
        meterPagination.appendChild(span);
      }
      meterPagination.appendChild(createBtn(totalPages, totalPages));
    }

    // Next
    if (METER_STATE.page < totalPages) {
      meterPagination.appendChild(createBtn(METER_STATE.page + 1, '»'));
    }
  }

  function addMeterProduct(p) {
    if (METER_STATE.selected.length >= 5) {
      alert("Maksimal 5 produk saja.");
      return;
    }
    // Add logic
    METER_STATE.selected.push(p);
    updateGauge();
    renderSelectedList();
    renderMeterGrid(); // Re-render to update button states (disabled state)
  }

  function removeMeterProduct(index) {
    METER_STATE.selected.splice(index, 1);
    updateGauge();
    renderSelectedList();
    renderMeterGrid();
  }

  function renderSelectedList() {
    selectedList.innerHTML = '';
    if (METER_STATE.selected.length === 0) {
      selectedList.innerHTML = '<p class="empty-hint" style="text-align:center; color: var(--text-muted);">Belum ada produk dipilih (Max 5)</p>';
      return;
    }

    METER_STATE.selected.forEach((p, idx) => {
      const div = document.createElement('div');
      div.className = 'selected-item';
      div.innerHTML = `
            <div class="selected-item-name">${p.product_name}</div>
            <div class="selected-item-val">${p.nf_total_sugars || 0}g</div>
          `;

      const btn = document.createElement('button');
      btn.className = 'remove-btn';
      btn.innerHTML = '×';
      btn.title = 'Hapus';
      btn.addEventListener('click', () => removeMeterProduct(idx));

      div.appendChild(btn);
      selectedList.appendChild(div);
    });
  }

  function updateGauge() {
    const MAX_SUGAR = 50; // 50g
    const totalSugar = METER_STATE.selected.reduce((acc, curr) => acc + (parseFloat(curr.nf_total_sugars) || 0), 0);

    gaugeValue.textContent = `${totalSugar.toFixed(1)}g`;

    if (totalSugar > MAX_SUGAR) {
      gaugeWarning.style.display = 'block';
      gaugeValue.style.color = 'var(--danger)';
    } else {
      gaugeWarning.style.display = 'none';
      gaugeValue.style.color = 'var(--text)';
    }

    // Update Chart
    const ctx = document.getElementById('sugar-gauge').getContext('2d');
    if (METER_CHART) METER_CHART.destroy();

    // Data chart
    // Bagian terisi = totalSugar (tapi max 50 untuk visual supaya tidak overlap parah, tapi kita bisa handle overflow color)
    // Kita buat gauge style doughnut half? Atau full?
    // Request: "gauge meter level"
    // Half doughnut is common for gauges.

    let fillVal = totalSugar;
    let emptyVal = Math.max(0, MAX_SUGAR - totalSugar);
    let overflowVal = 0;

    let bgColors = ['#4caf50', '#eee']; // Green, Grey

    if (totalSugar > MAX_SUGAR) {
      fillVal = MAX_SUGAR;
      emptyVal = 0;
      overflowVal = totalSugar - MAX_SUGAR; // Kita tidak visualisasikan overflow di chart doughnut standard dgn mudah tanpa tumpuk
      // Simple approach: Full Red circle if over limit? Or Full Bar.
      // Let's stick to standard gauge: Warning color if > 50% or > 80%?
      bgColors = ['#f44336', '#f44336']; // Merah semua
    } else if (totalSugar > 25) { // > 50% (25g) -> Warning Kuning/Orange
      bgColors = ['#ff9800', '#eee'];
    }

    METER_CHART = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Terisi', 'Sisa'],
        datasets: [{
          data: [fillVal, emptyVal],
          backgroundColor: bgColors,
          borderWidth: 0,
          circumference: 180, // Half circle
          rotation: 270 // Start from left (-90 deg from top)
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '80%', // Tipis
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        }
      }
    });
  }
  // Force refresh UI state to ensure nav button visibility
  if (!landing.hidden || !detail.hidden) {
    if (navMeterBtn) navMeterBtn.hidden = false;
  }
});