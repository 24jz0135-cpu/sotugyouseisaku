// ==========================================
// Configurations & Global State
// ==========================================
const API_BASE_URL = 'https://instant-ledger-backend.yadoran217.workers.dev';

let appState = {
  isOffline: false,
  records: [],
  currentTab: 'screen-home',
  // 擬似GPS座標（豊洲市場周辺をデフォルトに）
  gps: {
    latitude: 35.6445,
    longitude: 139.7915
  },
  sensorType: 'CAMERA',
  isRecording: false
};

// 実デバイス用メディア・認識オブジェクト
let activeVideoStream = null;
let audioContext = null;
let audioStream = null;
let speechRecognitionObj = null;

// ==========================================
// Mock Data Generators for Simulation
// ==========================================
const MOCK_RECEIPTS = [
  {
    vendor: '鮮魚田中 豊洲店',
    amount: 15400,
    category: '仕入高',
    rawText: 'レシート: 鮮魚田中\n日付: 2026/06/11\n本マグロ 中落ち ¥8,900\n真鯛 2匹 ¥6,500\n合計 ￥15,400',
    gps: { lat: 35.6445, lng: 139.7915 } // 豊洲市場
  },
  {
    vendor: '大黒屋青果 新宿店',
    amount: 6800,
    category: '仕入高',
    rawText: '領収書: 大黒屋青果\nアボカド 1箱 ¥2,800\nパクチー 大袋 ¥1,500\nレモン 20個 ¥2,500\n計 ￥6,800',
    gps: { lat: 35.6909, lng: 139.7003 } // 新宿
  },
  {
    vendor: '築地ミート 本店',
    amount: 24500,
    category: '仕入高',
    rawText: '築地ミート お買い上げ明細\n黒毛和牛 ロース 2kg ¥18,000\n国産豚バラ 3kg ¥6,500\n合計金額 ￥24,500',
    gps: { lat: 35.6655, lng: 139.7705 } // 築地
  },
  {
    vendor: '業務スーパー 新宿中央店',
    amount: 3200,
    category: '仕入高',
    rawText: 'レシート 業務スーパー\nオリーブオイル 5L ¥2,100\nパスタ 5kg ¥1,100\n計 ￥3,200',
    gps: { lat: 35.6938, lng: 139.7034 } // 新宿
  },
  {
    vendor: 'ダイソー 新宿サブナード店',
    amount: 1320,
    category: '消耗品費',
    rawText: '100円ショップ ダイソー\n紙コップ 200pcs ¥440\nペーパーナプキン ¥330\n除菌スプレー ¥550\n合計 ￥1,320',
    gps: { lat: 35.6925, lng: 139.7015 } // 新宿
  }
];

const MOCK_VOICES = [
  {
    text: '音声メモ: 「業務スーパーでトマトとパセリ、あとオリーブオイル買って現金で4,800円」',
    vendor: '業務スーパー 新宿中央店',
    amount: 4800,
    category: '仕入高',
    gps: { lat: 35.6938, lng: 139.7034 }
  },
  {
    text: '音声メモ: 「ダイソーで店舗のアルコール消毒用シートとペーパータオル買って1,650円」',
    vendor: 'ダイソー 新宿サブナード店',
    amount: 1650,
    category: '消耗品費',
    gps: { lat: 35.6925, lng: 139.7015 }
  },
  {
    text: '音声メモ: 「ガソリンスタンドで配達車の給油、カード払いで5,400円」',
    vendor: 'エネオス 新宿SS',
    amount: 5400,
    category: '旅費交通費',
    gps: { lat: 35.6895, lng: 139.6917 }
  }
];

// ==========================================
// DOM Elements
// ==========================================
const documentElements = {
  // Navigation & Screens
  navItems: document.querySelectorAll('.nav-item'),
  screens: document.querySelectorAll('.screen-panel'),
  
  // Dashboard
  summaryTotal: document.getElementById('summary-total'),
  summaryPendingCount: document.getElementById('summary-pending-count'),
  summaryPendingAmount: document.getElementById('summary-pending-amount'),
  summaryVerifiedCount: document.getElementById('summary-verified-count'),
  summaryVerifiedAmount: document.getElementById('summary-verified-amount'),
  categoryChart: document.getElementById('category-chart'),
  recentPendingList: document.getElementById('recent-pending-list'),
  btnRefresh: document.getElementById('btn-refresh'),
  btnTheme: document.getElementById('btn-theme'),

  // Sensors (Scan/Voice)
  tabCamera: document.getElementById('tab-camera'),
  tabVoice: document.getElementById('tab-voice'),
  panelCamera: document.getElementById('panel-camera'),
  panelVoice: document.getElementById('panel-voice'),
  btnCapture: document.getElementById('btn-capture'),
  btnRecord: document.getElementById('btn-record'),
  btnRecordText: document.getElementById('btn-record-text'),
  voiceWaveContainer: document.getElementById('voice-wave-container'),
  cameraLocation: document.getElementById('camera-location'),
  voiceLocation: document.getElementById('voice-location'),
  
  // Preview Card & Form
  factPreviewCard: document.getElementById('fact-preview-card'),
  inputVendor: document.getElementById('input-vendor'),
  inputAmount: document.getElementById('input-amount'),
  inputCategory: document.getElementById('input-category'),
  inputRawText: document.getElementById('input-rawtext'),
  spanLat: document.getElementById('span-lat'),
  spanLng: document.getElementById('span-lng'),
  btnSaveFact: document.getElementById('btn-save-fact'),
  btnCancelPreview: document.getElementById('btn-cancel-preview'),
  
  // History
  filterTabs: document.querySelectorAll('.filter-tab'),
  historyItemsList: document.getElementById('history-items-list')
};

// ==========================================
// Initialization & Events
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // Lucideアイコンのレンダリング
  lucide.createIcons();

  // スマホの擬似時間を現在時刻に更新する
  updateStatusTime();
  setInterval(updateStatusTime, 60000);

  initThemeToggle();

  // イベントリスナー登録
  initNavigation();
  initSensorControls();
  initFormControls();
  initHistoryControls();
  
  // データの初回取得
  fetchRecords();
});

function updateStatusTime() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;
  const statusTimeEl = document.getElementById('status-time');
  if (statusTimeEl) statusTimeEl.textContent = timeStr;
}

function initThemeToggle() {
  const updateThemeButton = () => {
    const isDark = document.documentElement.dataset.theme === 'dark';
    documentElements.btnTheme.setAttribute('aria-label', isDark ? '通常モードに切り替え' : 'ダークモードに切り替え');
    documentElements.btnTheme.title = isDark ? '通常モードに切り替え' : 'ダークモードに切り替え';
    documentElements.btnTheme.innerHTML = `<i data-lucide="${isDark ? 'sun' : 'moon'}"></i>`;
    lucide.createIcons();
  };

  updateThemeButton();
  documentElements.btnTheme.addEventListener('click', () => {
    const isDark = document.documentElement.dataset.theme === 'dark';
    if (isDark) {
      delete document.documentElement.dataset.theme;
      localStorage.setItem('instant-ledger-theme', 'light');
    } else {
      document.documentElement.dataset.theme = 'dark';
      localStorage.setItem('instant-ledger-theme', 'dark');
    }
    updateThemeButton();
  });
}

// ==========================================
// Tab Navigation
// ==========================================
function initNavigation() {
  documentElements.navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetScreen = item.getAttribute('data-target');
      switchTab(targetScreen);
    });
  });

  documentElements.btnRefresh.addEventListener('click', () => {
    // アニメーション効果
    const icon = documentElements.btnRefresh.querySelector('i');
    icon.classList.add('spin');
    fetchRecords().finally(() => {
      setTimeout(() => icon.classList.remove('spin'), 600);
    });
  });
}

function switchTab(screenId) {
  appState.currentTab = screenId;
  
  // ナビバーのアクティブクラス更新
  documentElements.navItems.forEach(btn => {
    if (btn.getAttribute('data-target') === screenId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // 画面表示切り替え
  documentElements.screens.forEach(screen => {
    if (screen.id === screenId) {
      screen.classList.add('active');
    } else {
      screen.classList.remove('active');
    }
  });

  // スキャン画面以外に切り替わった場合、カメラやマイクを完全に停止する
  if (screenId !== 'screen-scan') {
    stopCamera();
    stopRecording();
  }

  // 画面ごとのフック処理
  if (screenId === 'screen-home') {
    renderDashboard();
  } else if (screenId === 'screen-history') {
    renderHistory();
  } else if (screenId === 'screen-scan') {
    updateLocation();
    // カメラタブがアクティブならカメラを起動する
    if (appState.sensorType === 'CAMERA') {
      startCamera();
    }
  }
}

// ==========================================
// GPS Location & Reverse Geocoding
// ==========================================
async function updateLocation() {
  const loadingHTML = `<i data-lucide="loader" class="spin"></i> 位置情報を取得中...`;
  
  if (appState.sensorType === 'CAMERA') {
    documentElements.cameraLocation.innerHTML = loadingHTML;
  } else {
    documentElements.voiceLocation.innerHTML = loadingHTML;
  }
  lucide.createIcons();

  if (navigator.geolocation) {
    const options = {
      enableHighAccuracy: false, // デスクトップや屋内での取得成功率を高めるためfalseに
      timeout: 10000,            // タイムアウトを10秒に緩和
      maximumAge: 60000          // 60秒以内のキャッシュ位置情報の利用を許可
    };

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        appState.gps = { latitude: lat, longitude: lng };
        
        // フォーム用スパンを更新
        documentElements.spanLat.textContent = lat.toFixed(4);
        documentElements.spanLng.textContent = lng.toFixed(4);

        // 逆ジオコーディングで日本語住所を取得
        const address = await reverseGeocode(lat, lng);
        
        const successHTML = `<i data-lucide="map-pin"></i> ${address}`;
        if (appState.sensorType === 'CAMERA') {
          documentElements.cameraLocation.innerHTML = successHTML;
        } else {
          documentElements.voiceLocation.innerHTML = successHTML;
        }
        lucide.createIcons();
      },
      (error) => {
        console.warn("Geolocation API error, falling back to mock simulator.", error);
        useFallbackLocation("位置情報取得失敗 / ");
      },
      options
    );
  } else {
    console.warn("Geolocation is not supported by this browser. Falling back to mock simulator.");
    useFallbackLocation("非対応ブラウザ / ");
  }
}

// 住所解決（OpenStreetMap Nominatim）
async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=ja`;
    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'ja'
      }
    });
    if (!response.ok) throw new Error('Geocoding fetch failed');
    const data = await response.json();
    
    if (data && data.address) {
      const addr = data.address;
      // 日本語の住所パーツを順に結合
      const prefecture = addr.province || addr.prefecture || addr.state || '';
      const city = addr.city || addr.town || addr.city_district || addr.ward || addr.suburb || '';
      const neighbourhood = addr.neighbourhood || '';
      const road = addr.road || '';
      const name = data.name || '';
      
      let displayAddress = `${prefecture}${city}${neighbourhood}${road}`;
      
      // 建物名や地名があれば追加
      if (name && !displayAddress.includes(name)) {
        displayAddress += ` (${name})`;
      }
      
      return displayAddress.trim() || `緯度: ${lat.toFixed(4)}, 経度: ${lng.toFixed(4)}`;
    }
    return `緯度: ${lat.toFixed(4)}, 経度: ${lng.toFixed(4)}`;
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return `緯度: ${lat.toFixed(4)}, 経度: ${lng.toFixed(4)}`;
  }
}

// 許可拒否やエラー時のフォールバック位置設定
function useFallbackLocation(reasonPrefix = "") {
  if (appState.sensorType === 'CAMERA') {
    appState.gps = { latitude: 35.6445, longitude: 139.7915 }; // 豊洲市場
    documentElements.cameraLocation.innerHTML = `<i data-lucide="map-pin"></i> ${reasonPrefix}東京都江東区豊洲６丁目 (豊洲市場付近)`;
  } else {
    appState.gps = { latitude: 35.6909, longitude: 139.7003 }; // 新宿駅周辺
    documentElements.voiceLocation.innerHTML = `<i data-lucide="map-pin"></i> ${reasonPrefix}東京都新宿区新宿３丁目 (業務スーパー付近)`;
  }
  
  // フォーム用スパンを更新
  documentElements.spanLat.textContent = appState.gps.latitude.toFixed(4);
  documentElements.spanLng.textContent = appState.gps.longitude.toFixed(4);
  
  lucide.createIcons();
}

// ==========================================
// Real Camera Hardware Controller
// ==========================================
async function startCamera() {
  const videoEl = document.getElementById('camera-stream');
  const capturedImgEl = document.getElementById('camera-captured-img');
  const placeholderEl = document.getElementById('camera-preview-box');

  if (!videoEl || !capturedImgEl || !placeholderEl) return;

  // UI状態リセット
  capturedImgEl.classList.add('hidden');
  capturedImgEl.src = '';
  placeholderEl.classList.add('hidden');
  videoEl.classList.remove('hidden');

  if (activeVideoStream) {
    stopCamera();
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" } // 背面カメラを優先
      },
      audio: false
    });
    activeVideoStream = stream;
    videoEl.srcObject = stream;
  } catch (error) {
    console.error("Camera access failed:", error);
    // カメラ取得に失敗した場合はシミュレーション表示へ戻す
    videoEl.classList.add('hidden');
    placeholderEl.classList.remove('hidden');
  }
}

function stopCamera() {
  const videoEl = document.getElementById('camera-stream');
  if (activeVideoStream) {
    activeVideoStream.getTracks().forEach(track => track.stop());
    activeVideoStream = null;
  }
  if (videoEl) {
    videoEl.srcObject = null;
    videoEl.classList.add('hidden');
  }
}

function capturePhoto() {
  const videoEl = document.getElementById('camera-stream');
  const capturedImgEl = document.getElementById('camera-captured-img');
  const placeholderEl = document.getElementById('camera-preview-box');

  if (activeVideoStream && videoEl && capturedImgEl) {
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth || 640;
    canvas.height = videoEl.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg');
    capturedImgEl.src = dataUrl;
    capturedImgEl.classList.remove('hidden');

    stopCamera();
  } else {
    // カメラが起動していなかった場合のモックフォールバック画像
    if (capturedImgEl) {
      capturedImgEl.src = 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=500&auto=format&fit=crop&q=60';
      capturedImgEl.classList.remove('hidden');
    }
    if (placeholderEl) {
      placeholderEl.classList.add('hidden');
    }
  }
}

// ==========================================
// Real Microphone & Speech Recognition
// ==========================================
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn("Speech Recognition not supported in this browser.");
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'ja-JP';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    console.log("Speech transcript:", transcript);
    handleSpeechResult(transcript);
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    if (event.error === 'not-allowed') {
      alert("マイクのアクセス権限が拒否されています。");
    }
    stopRecording(true); // エラー時はモックデータでフォールバック
  };

  recognition.onend = () => {
    if (appState.isRecording) {
      stopRecording(false);
    }
  };

  return recognition;
}

async function startRecording() {
  if (appState.isRecording) return;
  
  appState.isRecording = true;
  documentElements.btnRecordText.textContent = "音声入力中 (クリックで終了)...";
  documentElements.voiceWaveContainer.classList.add('active');
  documentElements.voiceLocation.innerHTML = `<i data-lucide="mic" class="spin"></i> 音声を解析中...`;
  lucide.createIcons();

  // 1. 音声認識を起動
  if (!speechRecognitionObj) {
    speechRecognitionObj = initSpeechRecognition();
  }
  
  if (speechRecognitionObj) {
    try {
      speechRecognitionObj.start();
    } catch (e) {
      console.warn("SpeechRecognition already started:", e);
    }
  }

  // 2. Web Audio Analyserによるマイク音量連動アニメーション
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioStream = stream;
    
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 32;
    source.connect(analyser);
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function animateWave() {
      if (!appState.isRecording) return;
      requestAnimationFrame(animateWave);
      
      analyser.getByteFrequencyData(dataArray);
      const bars = document.querySelectorAll('.wave-bar');
      bars.forEach((bar, index) => {
        const val = dataArray[index] || 0;
        // マイク入力周波数を8px〜60pxの高さにマッピング
        const height = Math.min(60, Math.max(8, (val / 255) * 60));
        bar.style.height = `${height}px`;
      });
    }
    
    animateWave();
  } catch (error) {
    console.warn("Web Audio mic visualizer failed:", error);
    // マイク音量取得が不可の場合は、ランダム波形でシミュレート
    let timer = setInterval(() => {
      if (!appState.isRecording) {
        clearInterval(timer);
        return;
      }
      const bars = document.querySelectorAll('.wave-bar');
      bars.forEach(bar => {
        const height = Math.floor(Math.random() * 40) + 10;
        bar.style.height = `${height}px`;
      });
    }, 150);
  }

  // 自動タイムアウト（15秒）
  setTimeout(() => {
    if (appState.isRecording) {
      stopRecording(false);
    }
  }, 15000);
}

function stopRecording(useMockFallback = false) {
  if (!appState.isRecording) return;

  appState.isRecording = false;
  documentElements.btnRecordText.textContent = "音声メモを入力する";
  documentElements.voiceWaveContainer.classList.remove('active');
  lucide.createIcons();

  // 音声認識停止
  if (speechRecognitionObj) {
    try {
      speechRecognitionObj.stop();
    } catch (e) {}
  }

  // オーディオコンテキスト破棄
  if (audioStream) {
    audioStream.getTracks().forEach(track => track.stop());
    audioStream = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  // 位置情報更新
  updateLocation();

  if (useMockFallback) {
    setTimeout(() => {
      const idx = Math.floor(Math.random() * MOCK_VOICES.length);
      const mock = MOCK_VOICES[idx];
      handleSpeechResult(mock.text);
    }, 500);
  }
}

// 認識テキストの簡易構文解析＆フォーム投入
function handleSpeechResult(text) {
  documentElements.inputRawText.value = text;

  let vendor = "名称未設定";
  let amount = 0;
  let category = "仕入高";

  // 店舗名のキーワード一致
  const vendors = ["業務スーパー", "ダイソー", "鮮魚田中", "大黒屋青果", "築地ミート", "ガソリンスタンド", "エネオス"];
  for (const v of vendors) {
    if (text.includes(v)) {
      vendor = v;
      if (v === "エネオス" || v === "ガソリンスタンド") vendor = "エネオス 新宿SS";
      if (v === "業務スーパー") vendor = "業務スーパー 新宿中央店";
      if (v === "ダイソー") vendor = "ダイソー 新宿サブナード店";
      if (v === "鮮魚田中") vendor = "鮮魚田中 豊洲店";
      if (v === "大黒屋青果") vendor = "大黒屋青果 新宿店";
      if (v === "築地ミート") vendor = "築地ミート 本店";
      break;
    }
  }
  
  if (vendor === "名称未設定") {
    const match = text.match(/([^、。っ「」]*?)(で|にて)/);
    if (match && match[1]) {
      vendor = match[1].replace(/音声メモ:\s*「?/, "").trim();
    }
  }

  // 金額（漢数字/算用数字）のパース
  let cleanText = text.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
  let numMatch = cleanText.match(/(\d+)\s*万\s*(\d*)\s*千?/) || cleanText.match(/(\d+)\s*万/) || cleanText.match(/(\d+)\s*千/) || cleanText.match(/(\d+)\s*円/) || cleanText.match(/[\d,]+/);
  if (numMatch) {
    const rawNum = numMatch[0].replace(/,/g, "");
    if (rawNum.includes("万")) {
      const parts = rawNum.split("万");
      const man = parseInt(parts[0], 10) * 10000;
      let sen = 0;
      if (parts[1]) {
        sen = parseInt(parts[1].replace("千", ""), 10);
        if (sen < 10) sen = sen * 1000;
      }
      amount = man + sen;
    } else if (rawNum.includes("千")) {
      amount = parseInt(rawNum.replace("千", ""), 10) * 1000;
    } else {
      amount = parseInt(rawNum.replace("円", ""), 10) || 0;
    }
  }

  // 勘定科目の推測
  if (text.includes("消耗品") || text.includes("除菌") || text.includes("シート") || text.includes("紙コップ") || text.includes("ナプキン") || text.includes("ペン") || text.includes("封筒")) {
    category = "消耗品費";
  } else if (text.includes("ガソリン") || text.includes("タクシー") || text.includes("電車") || text.includes("切符") || text.includes("高速代") || text.includes("駐車代")) {
    category = "旅費交通費";
  } else if (text.includes("電気") || text.includes("ガス") || text.includes("水道") || text.includes("電気代")) {
    category = "水道光熱費";
  } else if (text.includes("仕入れ") || text.includes("トマト") || text.includes("マグロ") || text.includes("食材") || text.includes("肉") || text.includes("魚") || text.includes("青果")) {
    category = "仕入高";
  }

  documentElements.inputVendor.value = vendor;
  documentElements.inputAmount.value = amount || "";
  documentElements.inputCategory.value = category;

  documentElements.spanLat.textContent = appState.gps.latitude.toFixed(4);
  documentElements.spanLng.textContent = appState.gps.longitude.toFixed(4);

  // プレビューカード表示
  documentElements.factPreviewCard.classList.remove('hidden');
  documentElements.factPreviewCard.scrollIntoView({ behavior: 'smooth' });
}

// ==========================================
// Sensor Screen Logic (Camera / Voice Simulation)
// ==========================================
function initSensorControls() {
  // センサー切り替えタブ
  documentElements.tabCamera.addEventListener('click', () => {
    appState.sensorType = 'CAMERA';
    documentElements.tabCamera.classList.add('active');
    documentElements.tabVoice.classList.remove('active');
    documentElements.panelCamera.classList.add('active');
    documentElements.panelVoice.classList.remove('active');
    documentElements.factPreviewCard.classList.add('hidden');
    stopRecording();
    updateLocation();
    startCamera();
  });

  documentElements.tabVoice.addEventListener('click', () => {
    appState.sensorType = 'VOICE';
    documentElements.tabVoice.classList.add('active');
    documentElements.tabCamera.classList.remove('active');
    documentElements.panelVoice.classList.add('active');
    documentElements.panelCamera.classList.remove('active');
    documentElements.factPreviewCard.classList.add('hidden');
    stopCamera();
    updateLocation();
  });

  // レシート撮影ボタン
  documentElements.btnCapture.addEventListener('click', () => {
    const originalContent = documentElements.btnCapture.innerHTML;
    documentElements.btnCapture.disabled = true;
    documentElements.btnCapture.innerHTML = `<i data-lucide="loader" class="spin"></i> <span>OCR読み取り中...</span>`;
    lucide.createIcons();

    // 実際のカメラキャプチャを実行
    capturePhoto();

    setTimeout(() => {
      // ランダムにレシートを1件選択してフォームにセット (OCRシミュレーション)
      const idx = Math.floor(Math.random() * MOCK_RECEIPTS.length);
      const mock = MOCK_RECEIPTS[idx];
      
      documentElements.inputVendor.value = mock.vendor;
      documentElements.inputAmount.value = mock.amount;
      documentElements.inputCategory.value = mock.category;
      documentElements.inputRawText.value = mock.rawText;
      
      documentElements.spanLat.textContent = appState.gps.latitude.toFixed(4);
      documentElements.spanLng.textContent = appState.gps.longitude.toFixed(4);
      
      documentElements.factPreviewCard.classList.remove('hidden');
      documentElements.btnCapture.disabled = false;
      documentElements.btnCapture.innerHTML = originalContent;
      
      documentElements.factPreviewCard.scrollIntoView({ behavior: 'smooth' });
    }, 1200);
  });

  // 音声メモ入力ボタン
  documentElements.btnRecord.addEventListener('click', () => {
    if (appState.isRecording) {
      stopRecording(false);
    } else {
      startRecording();
    }
  });
}

// ==========================================
// Preview Form Logic
// ==========================================
function initFormControls() {
  documentElements.btnCancelPreview.addEventListener('click', () => {
    documentElements.factPreviewCard.classList.add('hidden');
    // キャンセルされた場合、カメラタブであればプレビューを再開
    if (appState.sensorType === 'CAMERA') {
      startCamera();
    }
  });

  documentElements.btnSaveFact.addEventListener('click', () => {
    const payload = {
      userId: 'user_shinjuku_001',
      timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
      latitude: appState.gps.latitude,
      longitude: appState.gps.longitude,
      sensorType: appState.sensorType,
      rawText: documentElements.inputRawText.value,
      amount: parseInt(documentElements.inputAmount.value, 10) || 0,
      category: documentElements.inputCategory.value,
      vendorName: documentElements.inputVendor.value
    };

    if (!payload.vendorName || !payload.amount) {
      alert("店舗名と金額を入力してください！");
      return;
    }

    // 保存ローディング
    documentElements.btnSaveFact.disabled = true;
    documentElements.btnSaveFact.innerHTML = `<i data-lucide="loader" class="spin"></i> <span>送信中...</span>`;
    lucide.createIcons();

    uploadRecord(payload).finally(() => {
      documentElements.btnSaveFact.disabled = false;
      documentElements.btnSaveFact.innerHTML = `<i data-lucide="check-circle-2"></i> <span>この経費を記録する</span>`;
      lucide.createIcons();
    });
  });
}

// ==========================================
// History Screen Logic (Filtering)
// ==========================================
let currentFilter = 'all';

function initHistoryControls() {
  documentElements.filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      documentElements.filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.getAttribute('data-filter');
      renderHistory();
    });
  });
}

// ==========================================
// API Interaction & State Sync
// ==========================================

// 1. レコード一覧の取得
async function fetchRecords() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/records`);
    if (!response.ok) throw new Error('サーバーエラー');
    const data = await response.json();
    appState.records = data;
    appState.isOffline = false;
    updateConnectionIndicator(true);
  } catch (error) {
    console.warn("Backend server is offline. Falling back to local offline storage.", error);
    appState.isOffline = true;
    updateConnectionIndicator(false);
    
    // オフライン時のローカルストレージ連携 (無ければモックデータを初期化)
    if (!localStorage.getItem('instant_ledger_local_db')) {
      // データベースに入れたのと同じシードデータを初期セット
      const mockSeeds = [
        {
          id: 'exp_fact_001',
          user_id: 'user_shinjuku_001',
          timestamp: '2026-06-11 06:30:00',
          latitude: 35.6445,
          longitude: 139.7915,
          sensor_type: 'CAMERA',
          raw_text: 'レシート: 鮮魚田中 合計 ￥15,400 本マグロほか',
          amount: 15400,
          category: '仕入高',
          vendor_name: '鮮魚田中 豊洲店',
          image_url: 'https://storage.cloudflare.com/receipts/001.jpg',
          status: 'VERIFIED'
        },
        {
          id: 'exp_fact_002',
          user_id: 'user_shinjuku_001',
          timestamp: '2026-06-11 15:00:00',
          latitude: 35.6909,
          longitude: 139.7003,
          sensor_type: 'VOICE',
          raw_text: '音声メモ: 「業務スーパーでパセリとトマト、現金で2,300円」',
          amount: 2300,
          category: '仕入高',
          vendor_name: '業務スーパー 新宿店',
          status: 'PENDING'
        }
      ];
      localStorage.setItem('instant_ledger_local_db', JSON.stringify(mockSeeds));
    }
    appState.records = JSON.parse(localStorage.getItem('instant_ledger_local_db'));
  }
  
  // 各画面の再描画
  renderDashboard();
  renderHistory();
}

// 2. 経費のアップロード
async function uploadRecord(payload) {
  if (appState.isOffline) {
    // オフラインモード時の動作シミュレーション
    const newRecord = {
      id: 'local_record_' + Date.now(),
      user_id: payload.userId,
      timestamp: payload.timestamp,
      latitude: payload.latitude,
      longitude: payload.longitude,
      sensor_type: payload.sensorType,
      raw_text: payload.rawText,
      amount: payload.amount,
      category: payload.category,
      vendor_name: payload.vendorName,
      status: 'PENDING'
    };
    appState.records.unshift(newRecord);
    localStorage.setItem('instant_ledger_local_db', JSON.stringify(appState.records));
    
    setTimeout(() => {
      documentElements.factPreviewCard.classList.add('hidden');
      switchTab('screen-history');
    }, 600);
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('送信に失敗しました');
    
    // アップロード成功後、再読込して履歴タブへ移動
    await fetchRecords();
    documentElements.factPreviewCard.classList.add('hidden');
    switchTab('screen-history');
  } catch (error) {
    alert("API送信エラー: " + error.message + "\nローカル開発サーバーが起動しているか確認してください。");
  }
}

// 3. レコードの確定 (Verify)
async function verifyRecord(id) {
  if (appState.isOffline) {
    // オフラインモード時の動作
    appState.records = appState.records.map(rec => {
      if (rec.id === id) {
        return { ...rec, status: 'VERIFIED' };
      }
      return rec;
    });
    localStorage.setItem('instant_ledger_local_db', JSON.stringify(appState.records));
    renderDashboard();
    renderHistory();
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    if (!response.ok) throw new Error('確定に失敗しました');
    
    // 成功したらデータを再取得して再描画
    await fetchRecords();
  } catch (error) {
    alert("API送信エラー: " + error.message);
  }
}

// 接続状態表示の更新 (オンライン/オフライン)
function updateConnectionIndicator(isOnline) {
  const badge = document.querySelector('.tax-badge');
  if (badge) {
    if (isOnline) {
      badge.style.color = '#60A5FA';
      badge.innerHTML = `<i data-lucide="award" class="icon-tiny"></i> 青色申告 (D1接続中)`;
    } else {
      badge.style.color = '#F59E0B';
      badge.innerHTML = `<i data-lucide="wifi-off" class="icon-tiny"></i> オフラインモード (デモ版)`;
    }
    lucide.createIcons();
  }
}

// ==========================================
// UI Rendering Logic (Dashboard & Lists)
// ==========================================

// ① ダッシュボードの描画
function renderDashboard() {
  let total = 0;
  let pendingCount = 0;
  let pendingAmount = 0;
  let verifiedCount = 0;
  let verifiedAmount = 0;
  
  const categories = {};

  appState.records.forEach(rec => {
    const amt = rec.amount || 0;
    total += amt;

    if (rec.status === 'VERIFIED') {
      verifiedCount++;
      verifiedAmount += amt;
    } else {
      pendingCount++;
      pendingAmount += amt;
    }

    // カテゴリ集計
    const cat = rec.category || 'その他';
    categories[cat] = (categories[cat] || 0) + amt;
  });

  // 値の反映
  documentElements.summaryTotal.textContent = `¥${total.toLocaleString()}`;
  documentElements.summaryPendingCount.textContent = `${pendingCount} 件`;
  documentElements.summaryPendingAmount.textContent = `¥${pendingAmount.toLocaleString()}`;
  documentElements.summaryVerifiedCount.textContent = `${verifiedCount} 件`;
  documentElements.summaryVerifiedAmount.textContent = `¥${verifiedAmount.toLocaleString()}`;

  // カテゴリ内訳バーの構築
  documentElements.categoryChart.innerHTML = '';
  const catEntries = Object.entries(categories).sort((a, b) => b[1] - a[1]);
  
  if (catEntries.length === 0) {
    documentElements.categoryChart.innerHTML = `<div class="no-data-msg">経費データがありません</div>`;
  } else {
    catEntries.forEach(([name, val]) => {
      const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
      
      const itemEl = document.createElement('div');
      itemEl.className = 'category-bar-item';
      itemEl.innerHTML = `
        <div class="cat-info">
          <span class="cat-name">${name}</span>
          <span class="cat-val">¥${val.toLocaleString()} (${pct}%)</span>
        </div>
        <div class="cat-track">
          <div class="cat-fill" style="width: ${pct}%"></div>
        </div>
      `;
      documentElements.categoryChart.appendChild(itemEl);
    });
  }

  // クイックアクセス未確定リストの描画
  documentElements.recentPendingList.innerHTML = '';
  const pendingRecords = appState.records.filter(r => r.status === 'PENDING').slice(0, 3);
  
  if (pendingRecords.length === 0) {
    documentElements.recentPendingList.innerHTML = `
      <div class="no-data-msg" style="background: rgba(16,185,129,0.05); border-radius: 12px; padding: 12px; border: 1px dashed rgba(16,185,129,0.2); color: #34D399;">
        <i data-lucide="check-check" class="icon-tiny"></i> 全ての現場ファクトが確定されています！
      </div>`;
  } else {
    pendingRecords.forEach(rec => {
      const card = createRecordCard(rec);
      documentElements.recentPendingList.appendChild(card);
    });
  }
  lucide.createIcons();
}

// ② 履歴一覧の描画
function renderHistory() {
  documentElements.historyItemsList.innerHTML = '';
  
  const filtered = appState.records.filter(rec => {
    if (currentFilter === 'all') return true;
    return rec.status === currentFilter;
  });

  if (filtered.length === 0) {
    documentElements.historyItemsList.innerHTML = `<div class="no-data-msg">該当する経費データがありません</div>`;
    return;
  }

  filtered.forEach(rec => {
    const card = createRecordCard(rec);
    documentElements.historyItemsList.appendChild(card);
  });
  
  lucide.createIcons();
}

// ③ 共通の履歴レコードカード生成用ヘルパー
function createRecordCard(rec) {
  const card = document.createElement('div');
  card.className = `record-item ${rec.status.toLowerCase()}`;
  
  const iconName = rec.sensor_type === 'CAMERA' ? 'camera' : (rec.sensor_type === 'VOICE' ? 'mic' : 'navigation');
  const dateStr = rec.timestamp ? rec.timestamp.substring(5, 16) : '日付不明'; // "MM-DD HH:MM"

  let actionHTML = '';
  if (rec.status === 'PENDING') {
    actionHTML = `
      <div class="record-actions">
        <span class="status-indicator pending"><i data-lucide="help-circle" class="icon-tiny"></i> 未確定</span>
        <button class="btn-verify" data-id="${rec.id}">
          <i data-lucide="check" class="icon-tiny"></i>
          <span>確定する</span>
        </button>
      </div>
    `;
  } else {
    actionHTML = `
      <div class="record-actions">
        <span class="status-indicator verified"><i data-lucide="check-check" class="icon-tiny"></i> 確定済み</span>
      </div>
    `;
  }

  card.innerHTML = `
    <div class="record-main">
      <div class="record-meta">
        <div class="sensor-icon">
          <i data-lucide="${iconName}"></i>
        </div>
        <div class="record-details">
          <span class="vendor">${rec.vendor_name || '名称未設定'}</span>
          <span class="datetime-location">
            <i data-lucide="clock" class="icon-tiny"></i> ${dateStr} 
            | <i data-lucide="map-pin" class="icon-tiny"></i> ${rec.latitude ? rec.latitude.toFixed(3) : '---'},${rec.longitude ? rec.longitude.toFixed(3) : '---'}
          </span>
        </div>
      </div>
      
      <div class="record-financial">
        <span class="amount">¥${(rec.amount || 0).toLocaleString()}</span>
        <span class="category-badge">${rec.category || '未分類'}</span>
      </div>
    </div>
    
    ${rec.raw_text ? `<div class="record-extra">${rec.raw_text}</div>` : ''}
    ${actionHTML}
  `;

  // 「確定」ボタンのイベント紐付け
  const verifyBtn = card.querySelector('.btn-verify');
  if (verifyBtn) {
    verifyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = verifyBtn.getAttribute('data-id');
      
      // ボタンのローディング表示
      verifyBtn.disabled = true;
      verifyBtn.innerHTML = `<i data-lucide="loader" class="spin icon-tiny"></i>`;
      lucide.createIcons();
      
      verifyRecord(id);
    });
  }

  return card;
}
