// ==========================================
// Configurations & Global State
// ==========================================
const API_BASE_URL = 'https://instant-ledger-backend.yadoran217.workers.dev';
const LOCAL_FIRST_MODE = true;
const LOCAL_DB_KEY = 'instant_ledger_local_db';

let appState = {
  isOffline: false,
  currentReceipt: null,
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
  themeMenu: document.getElementById('theme-menu'),
  themeOptions: document.querySelectorAll('.theme-option'),
  btnThemeSettings: document.getElementById('btn-theme-settings'),
  btnSettingsBack: document.getElementById('btn-settings-back'),
  photoPickerModal: document.getElementById('photo-picker-modal'),
  btnClosePhotoPicker: document.getElementById('btn-close-photo-picker'),
  inputThemePhoto: document.getElementById('input-theme-photo'),
  savedPhotoGrid: document.getElementById('saved-photo-grid'),
  photoLibraryEmpty: document.getElementById('photo-library-empty'),
  photoPickerStatus: document.getElementById('photo-picker-status'),
  photoSelectionPreview: document.getElementById('photo-selection-preview'),
  photoSelectionImage: document.getElementById('photo-selection-image'),
  photoSelectionName: document.getElementById('photo-selection-name'),
  btnApplySelectedPhoto: document.getElementById('btn-apply-selected-photo'),
  photoCropModal: document.getElementById('photo-crop-modal'),
  photoCropCanvas: document.getElementById('photo-crop-canvas'),
  photoCropZoom: document.getElementById('photo-crop-zoom'),
  photoCropStatus: document.getElementById('photo-crop-status'),
  btnCancelPhotoCrop: document.getElementById('btn-cancel-photo-crop'),
  btnCancelPhotoCropText: document.getElementById('btn-cancel-photo-crop-text'),
  btnSavePhotoCrop: document.getElementById('btn-save-photo-crop'),
  photoTargetButtons: document.querySelectorAll('[data-photo-target]'),
  photoResetButtons: document.querySelectorAll('[data-photo-reset]'),
  toggleBackgroundPhotoDim: document.getElementById('toggle-background-photo-dim'),
  toggleWidgetPhotoDim: document.getElementById('toggle-widget-photo-dim'),
  widgetPhotoDimTitle: document.getElementById('widget-photo-dim-title'),
  selectPhotoWidget: document.getElementById('select-photo-widget'),
  inputThemePresetName: document.getElementById('input-theme-preset-name'),
  btnSaveThemePreset: document.getElementById('btn-save-theme-preset'),
  themePresetStatus: document.getElementById('theme-preset-status'),
  themePresetList: document.getElementById('theme-preset-list'),
  themePresetEmpty: document.getElementById('theme-preset-empty'),

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
  historyItemsList: document.getElementById('history-items-list'),
  btnExportBackup: document.getElementById('btn-export-backup'),
  inputRestoreBackup: document.getElementById('input-restore-backup'),
  receiptModal: document.getElementById('receipt-modal'),
  receiptModalImage: document.getElementById('receipt-modal-image'),
  receiptModalEmpty: document.getElementById('receipt-modal-empty'),
  btnCloseReceiptModal: document.getElementById('btn-close-receipt-modal'),
  inputQuickReceipt: document.getElementById('input-quick-receipt'),
  receiptCaptureStatus: document.getElementById('receipt-capture-status')
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

  initThemePicker();
  initThemePhotos();

  // イベントリスナー登録
  initNavigation();
  initSensorControls();
  initHistoryControls();
  initLocalVaultControls();
  
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

// ==========================================
// Local evidence vault & backup
// ==========================================
const receiptVault = {
  db: null,
  async open() {
    if (this.db) return this.db;
    this.db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('oaiso-local-vault', 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('receipts')) request.result.createObjectStore('receipts', { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.db;
  },
  async run(mode, action) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const request = action(db.transaction('receipts', mode).objectStore('receipts'));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  put(receipt) { return this.run('readwrite', store => store.put(receipt)); },
  get(id) { return this.run('readonly', store => store.get(id)); },
  getAll() { return this.run('readonly', store => store.getAll()); },
  clear() { return this.run('readwrite', store => store.clear()); }
};

function localRecords() {
  return JSON.parse(localStorage.getItem(LOCAL_DB_KEY) || '[]');
}

function persistLocalRecords(records) {
  localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(records));
}

function initLocalVaultControls() {
  documentElements.btnExportBackup.addEventListener('click', exportBackup);
  documentElements.inputRestoreBackup.addEventListener('change', restoreBackup);
  documentElements.btnCloseReceiptModal.addEventListener('click', closeReceiptModal);
  document.querySelector('[data-close-receipt-modal]').addEventListener('click', closeReceiptModal);
}

async function exportBackup() {
  const originalContent = documentElements.btnExportBackup.innerHTML;
  documentElements.btnExportBackup.disabled = true;
  documentElements.btnExportBackup.innerHTML = `<i data-lucide="loader" class="spin"></i> 作成中`;
  lucide.createIcons();
  try {
    const archive = {
      format: 'oaiso-backup',
      version: 1,
      createdAt: new Date().toISOString(),
      records: localRecords(),
      receipts: await receiptVault.getAll()
    };
    const blob = new Blob([JSON.stringify(archive)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Oaiso_Backup_${new Date().toISOString().slice(0, 10)}.oaiso`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error) {
    alert(`バックアップを作成できませんでした: ${error.message}`);
  } finally {
    documentElements.btnExportBackup.disabled = false;
    documentElements.btnExportBackup.innerHTML = originalContent;
    lucide.createIcons();
  }
}

async function restoreBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const archive = JSON.parse(await file.text());
    if (archive.format !== 'oaiso-backup' || !Array.isArray(archive.records) || !Array.isArray(archive.receipts)) throw new Error('Oaisoのバックアップファイルではありません');
    if (!confirm(`この端末のデータを、${archive.records.length}件のバックアップで置き換えます。続行しますか？`)) return;
    persistLocalRecords(archive.records);
    await receiptVault.clear();
    for (const receipt of archive.receipts) await receiptVault.put(receipt);
    appState.records = archive.records;
    renderDashboard();
    renderHistory();
    alert('バックアップから復元しました。');
  } catch (error) {
    alert(`復元できませんでした: ${error.message}`);
  } finally {
    event.target.value = '';
  }
}

async function showReceipt(receiptId) {
  const receipt = await receiptVault.get(receiptId);
  documentElements.receiptModalImage.classList.toggle('hidden', !receipt);
  documentElements.receiptModalEmpty.classList.toggle('hidden', Boolean(receipt));
  if (receipt) documentElements.receiptModalImage.src = receipt.dataUrl;
  documentElements.receiptModal.classList.remove('hidden');
}

function closeReceiptModal() {
  documentElements.receiptModal.classList.add('hidden');
  documentElements.receiptModalImage.src = '';
}

function initThemePicker() {
  const getCurrentTheme = () => document.documentElement.dataset.theme || 'light';
  const closeMenu = () => {
    documentElements.themeMenu.classList.add('hidden');
    documentElements.btnTheme.setAttribute('aria-expanded', 'false');
  };
  const applyTheme = (theme) => {
    if (theme === 'light') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    localStorage.setItem('instant-ledger-theme', theme);
    documentElements.themeOptions.forEach(option => option.classList.toggle('active', option.dataset.theme === theme));
    closeMenu();
  };

  documentElements.themeOptions.forEach(option => {
    option.classList.toggle('active', option.dataset.theme === getCurrentTheme());
    option.addEventListener('click', () => applyTheme(option.dataset.theme));
  });
  documentElements.btnThemeSettings.addEventListener('click', () => {
    closeMenu();
    switchTab('screen-theme-settings');
  });
  documentElements.btnSettingsBack.addEventListener('click', () => {
    documentElements.themeMenu.classList.remove('hidden');
    documentElements.btnTheme.setAttribute('aria-expanded', 'true');
    switchTab('screen-home');
  });
  documentElements.btnTheme.addEventListener('click', event => {
    event.stopPropagation();
    const isOpen = !documentElements.themeMenu.classList.contains('hidden');
    documentElements.themeMenu.classList.toggle('hidden', isOpen);
    documentElements.btnTheme.setAttribute('aria-expanded', String(!isOpen));
  });
  document.addEventListener('click', event => {
    if (!documentElements.themeMenu.contains(event.target) && event.target !== documentElements.btnTheme) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMenu();
  });
}

// ==========================================
// Theme photo library (device-local IndexedDB)
// ==========================================
const THEME_PHOTO_DB = 'instant-ledger-theme-photos';
const THEME_PHOTO_STORE = 'photos';
let activePhotoTarget = 'background';
let themePhotoObjectUrls = new Map();
let pendingThemePhoto = null;
let photoCropState = null;

function openThemePhotoDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(THEME_PHOTO_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(THEME_PHOTO_STORE)) {
        db.createObjectStore(THEME_PHOTO_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withThemePhotoStore(mode, operation) {
  const db = await openThemePhotoDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(THEME_PHOTO_STORE, mode);
    const store = transaction.objectStore(THEME_PHOTO_STORE);
    const request = operation(store);
    transaction.oncomplete = () => { db.close(); resolve(request?.result); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
    transaction.onabort = () => { db.close(); reject(transaction.error); };
  });
}

function initThemePhotos() {
  documentElements.btnSaveThemePreset.addEventListener('click', saveCurrentThemePreset);
  renderThemePresets();
  const savedDimSetting = localStorage.getItem('instant-ledger-background-photo-dim');
  documentElements.toggleBackgroundPhotoDim.checked = savedDimSetting !== 'false';
  documentElements.toggleBackgroundPhotoDim.addEventListener('change', () => {
    localStorage.setItem('instant-ledger-background-photo-dim', String(documentElements.toggleBackgroundPhotoDim.checked));
    restoreThemePhotoAssignments().catch(error => console.warn('背景写真の表示設定を反映できませんでした:', error));
  });
  documentElements.toggleWidgetPhotoDim.checked = getSelectedWidgetDimSetting();
  documentElements.toggleWidgetPhotoDim.addEventListener('change', () => {
    const settings = JSON.parse(localStorage.getItem('instant-ledger-widget-photo-dim-settings') || '{}');
    settings[documentElements.selectPhotoWidget.value] = documentElements.toggleWidgetPhotoDim.checked;
    localStorage.setItem('instant-ledger-widget-photo-dim-settings', JSON.stringify(settings));
    restoreThemePhotoAssignments().catch(error => console.warn('ウィジェット写真の表示設定を反映できませんでした:', error));
  });

  documentElements.photoTargetButtons.forEach(button => {
    button.addEventListener('click', async () => {
      activePhotoTarget = button.dataset.photoTarget;
      if (activePhotoTarget === 'widget') activePhotoTarget = `widget:${documentElements.selectPhotoWidget.value}`;
      const title = activePhotoTarget === 'background' ? '背景に使う写真' : 'ウィジェットに使う写真';
      document.getElementById('photo-picker-title').textContent = title;
      documentElements.photoPickerStatus.textContent = '';
      pendingThemePhoto = null;
      documentElements.photoSelectionPreview.classList.add('hidden');
      documentElements.photoPickerModal.classList.remove('hidden');
      await renderSavedThemePhotos();
    });
  });
  documentElements.photoResetButtons.forEach(button => {
    button.addEventListener('click', () => {
      const target = button.dataset.photoReset === 'widget' ? `widget:${documentElements.selectPhotoWidget.value}` : button.dataset.photoReset;
      resetThemePhoto(target);
    });
  });
  documentElements.selectPhotoWidget.addEventListener('change', updateSelectedWidgetSettings);
  updateSelectedWidgetSettings();

  documentElements.inputThemePhoto.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      documentElements.photoPickerStatus.textContent = '画像ファイルを選択してください。';
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      documentElements.photoPickerStatus.textContent = '写真は15MB以下のファイルを選択してください。';
      return;
    }
    try {
      const hash = await hashThemePhoto(file);
      const savedPhotos = (await withThemePhotoStore('readonly', store => store.getAll())).filter(photo => !photo.derived);
      const duplicate = await findDuplicateThemePhoto(savedPhotos, hash);
      if (duplicate) {
        documentElements.photoPickerStatus.textContent = '同じ写真は保存済みです。保存済みの写真を使用します。';
        selectThemePhotoCandidate(duplicate);
      } else {
        const photo = { id: crypto.randomUUID(), name: file.name, blob: file, hash, createdAt: Date.now() };
        await withThemePhotoStore('readwrite', store => store.put(photo));
        await renderSavedThemePhotos();
        selectThemePhotoCandidate(photo);
      }
    } catch (error) {
      documentElements.photoPickerStatus.textContent = `写真を保存できませんでした: ${error.message}`;
    }
  });

  documentElements.btnClosePhotoPicker.addEventListener('click', closeThemePhotoPicker);
  documentElements.btnApplySelectedPhoto.addEventListener('click', async () => {
    if (!pendingThemePhoto) return;
    await openPhotoCropper(pendingThemePhoto);
  });
  documentElements.btnCancelPhotoCrop.addEventListener('click', closePhotoCropper);
  documentElements.btnCancelPhotoCropText.addEventListener('click', closePhotoCropper);
  documentElements.photoCropZoom.addEventListener('input', () => {
    if (!photoCropState) return;
    photoCropState.zoom = Number(documentElements.photoCropZoom.value);
    drawPhotoCrop();
  });
  documentElements.photoCropCanvas.addEventListener('pointerdown', startPhotoCropDrag);
  documentElements.photoCropCanvas.addEventListener('pointermove', movePhotoCropDrag);
  documentElements.photoCropCanvas.addEventListener('pointerup', endPhotoCropDrag);
  documentElements.photoCropCanvas.addEventListener('pointercancel', endPhotoCropDrag);
  documentElements.btnSavePhotoCrop.addEventListener('click', savePhotoCrop);
  document.querySelectorAll('[data-close-photo-picker]').forEach(button => button.addEventListener('click', closeThemePhotoPicker));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (!documentElements.photoCropModal.classList.contains('hidden')) closePhotoCropper();
      else closeThemePhotoPicker();
    }
  });
  restoreThemePhotoAssignments().catch(error => console.warn('テーマ写真を読み込めませんでした:', error));
}

const THEME_PRESETS_KEY = 'instant-ledger-theme-presets';

function readThemePresets() {
  try {
    const presets = JSON.parse(localStorage.getItem(THEME_PRESETS_KEY) || '[]');
    return Array.isArray(presets) ? presets : [];
  } catch {
    return [];
  }
}

function saveCurrentThemePreset() {
  const name = documentElements.inputThemePresetName.value.trim();
  if (!name) {
    documentElements.themePresetStatus.textContent = '設定の名前を入力してください。';
    documentElements.inputThemePresetName.focus();
    return;
  }

  const presets = readThemePresets();
  presets.unshift({
    id: crypto.randomUUID(),
    name,
    savedAt: Date.now(),
    assignments: JSON.parse(localStorage.getItem('instant-ledger-theme-photo-assignments') || '{}'),
    backgroundDim: documentElements.toggleBackgroundPhotoDim.checked,
    widgetDimSettings: getAllWidgetDimSettings(),
    theme: localStorage.getItem('instant-ledger-theme') || 'light'
  });
  localStorage.setItem(THEME_PRESETS_KEY, JSON.stringify(presets));
  documentElements.inputThemePresetName.value = '';
  documentElements.themePresetStatus.textContent = `「${name}」を保存しました。`;
  renderThemePresets();
}

function renderThemePresets() {
  const presets = readThemePresets();
  documentElements.themePresetList.replaceChildren();
  documentElements.themePresetEmpty.classList.toggle('hidden', presets.length > 0);

  presets.forEach(preset => {
    const item = document.createElement('article');
    item.className = 'theme-preset-item';
    const info = document.createElement('div');
    info.className = 'theme-preset-info';
    const title = document.createElement('strong');
    title.textContent = preset.name;
    const date = document.createElement('small');
    date.textContent = new Date(preset.savedAt).toLocaleDateString('ja-JP');
    info.append(title, date);

    const actions = document.createElement('div');
    actions.className = 'theme-preset-actions';
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'theme-preset-apply';
    apply.textContent = '適用';
    apply.addEventListener('click', () => applyThemePreset(preset));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'theme-preset-delete';
    remove.textContent = '削除';
    remove.setAttribute('aria-label', `${preset.name}を削除`);
    remove.addEventListener('click', () => deleteThemePreset(preset.id));
    actions.append(apply, remove);
    item.append(info, actions);
    documentElements.themePresetList.append(item);
  });
}

function applyThemePreset(preset) {
  document.querySelector('.app-content').style.backgroundImage = '';
  document.querySelector('.app-content').style.backgroundSize = '';
  document.querySelector('.app-content').style.backgroundPosition = '';
  document.querySelectorAll('[data-photo-widget]').forEach(widget => {
    widget.style.backgroundImage = '';
    widget.style.backgroundSize = '';
    widget.style.backgroundPosition = '';
  });
  document.querySelector('[data-photo-target="background"]').textContent = '写真を選ぶ';
  document.querySelector('[data-photo-reset="background"]').classList.add('hidden');
  document.querySelector('[data-photo-target="widget"]').textContent = '写真を選ぶ';
  document.querySelector('[data-photo-reset="widget"]').classList.add('hidden');
  localStorage.setItem('instant-ledger-theme-photo-assignments', JSON.stringify(preset.assignments || {}));
  localStorage.setItem('instant-ledger-background-photo-dim', String(preset.backgroundDim !== false));
  localStorage.setItem('instant-ledger-widget-photo-dim-settings', JSON.stringify(preset.widgetDimSettings || {}));
  localStorage.setItem('instant-ledger-theme', preset.theme || 'light');

  if (preset.theme && preset.theme !== 'light') document.documentElement.dataset.theme = preset.theme;
  else delete document.documentElement.dataset.theme;
  documentElements.themeOptions.forEach(option => option.classList.toggle('active', option.dataset.theme === (preset.theme || 'light')));
  documentElements.toggleBackgroundPhotoDim.checked = preset.backgroundDim !== false;
  documentElements.toggleWidgetPhotoDim.checked = getSelectedWidgetDimSetting();
  updateSelectedWidgetSettings();
  restoreThemePhotoAssignments()
    .then(() => { documentElements.themePresetStatus.textContent = `「${preset.name}」を適用しました。`; })
    .catch(error => { documentElements.themePresetStatus.textContent = `設定を適用できませんでした: ${error.message}`; });
}

function deleteThemePreset(id) {
  const presets = readThemePresets().filter(preset => preset.id !== id);
  localStorage.setItem(THEME_PRESETS_KEY, JSON.stringify(presets));
  documentElements.themePresetStatus.textContent = '保存した設定を削除しました。';
  renderThemePresets();
}

async function hashThemePhoto(blob) {
  const bytes = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function findDuplicateThemePhoto(photos, hash) {
  for (const photo of photos) {
    const existingHash = photo.hash || await hashThemePhoto(photo.blob);
    if (existingHash === hash) return photo;
  }
  return null;
}

function closeThemePhotoPicker() {
  documentElements.photoPickerModal.classList.add('hidden');
}

async function renderSavedThemePhotos() {
  const photos = (await withThemePhotoStore('readonly', store => store.getAll())).filter(photo => !photo.derived);
  documentElements.savedPhotoGrid.replaceChildren();
  documentElements.photoLibraryEmpty.classList.toggle('hidden', photos.length > 0);
  photos.sort((a, b) => b.createdAt - a.createdAt).forEach(photo => {
    let url = themePhotoObjectUrls.get(photo.id);
    if (!url) {
      url = URL.createObjectURL(photo.blob);
      themePhotoObjectUrls.set(photo.id, url);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'saved-photo-item';
    button.dataset.photoId = photo.id;
    button.title = photo.name;
    button.innerHTML = `<img alt=""><span></span>`;
    button.querySelector('img').src = url;
    button.querySelector('span').textContent = photo.name;
    button.addEventListener('click', () => selectThemePhotoCandidate(photo));
    documentElements.savedPhotoGrid.append(button);
  });
}

function selectThemePhotoCandidate(photo) {
  let url = themePhotoObjectUrls.get(photo.id);
  if (!url) {
    url = URL.createObjectURL(photo.blob);
    themePhotoObjectUrls.set(photo.id, url);
  }
  pendingThemePhoto = photo;
  documentElements.savedPhotoGrid.querySelectorAll('.saved-photo-item').forEach(item => {
    item.classList.toggle('selected', item.dataset.photoId === photo.id);
  });
  const candidate = document.querySelector(`.saved-photo-item[data-photo-id="${photo.id}"]`);
  if (candidate) candidate.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  documentElements.photoSelectionImage.src = url;
  documentElements.photoSelectionName.textContent = photo.name;
  documentElements.photoSelectionPreview.classList.remove('hidden');
  documentElements.photoPickerStatus.textContent = 'プレビューを確認してから適用してください。';
}

async function openPhotoCropper(photo) {
  let url = themePhotoObjectUrls.get(photo.id);
  if (!url) {
    url = URL.createObjectURL(photo.blob);
    themePhotoObjectUrls.set(photo.id, url);
  }
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    documentElements.photoPickerStatus.textContent = '写真を開けませんでした。別の画像を選んでください。';
    return;
  }

  photoCropState = { photo, image, zoom: 1, centerX: 0, centerY: 0, dragging: false, initialized: false };
  documentElements.photoCropZoom.value = '1';
  documentElements.photoCropStatus.textContent = '';
  documentElements.photoCropModal.classList.remove('hidden');
  requestAnimationFrame(() => {
    const geometry = getPhotoCropGeometry();
    photoCropState.centerX = geometry.width / 2;
    photoCropState.centerY = geometry.height / 2;
    photoCropState.initialized = true;
    drawPhotoCrop();
  });
}

function getPhotoCropAspectRatio() {
  if (activePhotoTarget === 'background') return 0.56;
  const widgetId = activePhotoTarget.slice('widget:'.length);
  if (widgetId === 'pending' || widgetId === 'verified') return 1.55;
  if (widgetId === 'total') return 2.35;
  return 2.5;
}

function getPhotoCropGeometry() {
  const canvas = documentElements.photoCropCanvas;
  const width = canvas.clientWidth || canvas.parentElement.clientWidth || 320;
  const height = canvas.clientHeight || 300;
  const aspect = getPhotoCropAspectRatio();
  const image = photoCropState.image;
  const baseScale = Math.min(width * 0.86 / image.naturalWidth, height * 0.78 / image.naturalHeight);
  const imageWidth = image.naturalWidth * baseScale;
  const imageHeight = image.naturalHeight * baseScale;
  let cropWidth = Math.min(width * 0.76, imageWidth * 0.9, imageHeight * 0.9 * aspect);
  let cropHeight = cropWidth / aspect;
  if (cropHeight > imageHeight * 0.9) {
    cropHeight = imageHeight * 0.9;
    cropWidth = cropHeight * aspect;
  }
  return { width, height, cropX: (width - cropWidth) / 2, cropY: (height - cropHeight) / 2, cropWidth, cropHeight, baseScale };
}

function constrainPhotoCropPosition(geometry) {
  const state = photoCropState;
  const scale = geometry.baseScale * state.zoom;
  const imageWidth = state.image.naturalWidth * scale;
  const imageHeight = state.image.naturalHeight * scale;
  state.centerX = Math.min(geometry.cropX + geometry.cropWidth / 2, Math.max(geometry.cropX + geometry.cropWidth - imageWidth / 2, state.centerX));
  state.centerY = Math.min(geometry.cropY + geometry.cropHeight / 2, Math.max(geometry.cropY + geometry.cropHeight - imageHeight / 2, state.centerY));
  return { scale, imageWidth, imageHeight };
}

function drawPhotoCrop() {
  if (!photoCropState || documentElements.photoCropModal.classList.contains('hidden')) return;
  const canvas = documentElements.photoCropCanvas;
  const geometry = getPhotoCropGeometry();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(geometry.width * ratio);
  canvas.height = Math.round(geometry.height * ratio);
  const context = canvas.getContext('2d');
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.fillStyle = '#172033';
  context.fillRect(0, 0, geometry.width, geometry.height);

  const image = photoCropState.image;
  const { scale, imageWidth, imageHeight } = constrainPhotoCropPosition(geometry);
  const imageX = photoCropState.centerX - imageWidth / 2;
  const imageY = photoCropState.centerY - imageHeight / 2;
  context.drawImage(image, imageX, imageY, imageWidth, imageHeight);

  context.fillStyle = 'rgba(0, 0, 0, .58)';
  const cropRight = geometry.cropX + geometry.cropWidth;
  const cropBottom = geometry.cropY + geometry.cropHeight;
  context.fillRect(0, 0, geometry.width, geometry.cropY);
  context.fillRect(0, cropBottom, geometry.width, geometry.height - cropBottom);
  context.fillRect(0, geometry.cropY, geometry.cropX, geometry.cropHeight);
  context.fillRect(cropRight, geometry.cropY, geometry.width - cropRight, geometry.cropHeight);
  context.strokeStyle = 'rgba(0, 0, 0, .65)';
  context.lineWidth = 4;
  context.strokeRect(geometry.cropX, geometry.cropY, geometry.cropWidth, geometry.cropHeight);
  context.strokeStyle = '#fff';
  context.lineWidth = 2;
  context.strokeRect(geometry.cropX, geometry.cropY, geometry.cropWidth, geometry.cropHeight);
  context.fillStyle = '#fff';
  const handle = 8;
  [[geometry.cropX, geometry.cropY], [geometry.cropX + geometry.cropWidth, geometry.cropY], [geometry.cropX, geometry.cropY + geometry.cropHeight], [geometry.cropX + geometry.cropWidth, geometry.cropY + geometry.cropHeight]].forEach(([x, y]) => {
    context.fillRect(x - handle / 2, y - handle / 2, handle, handle);
  });
  photoCropState.geometry = geometry;
  photoCropState.imageScale = scale;
  photoCropState.imageX = imageX;
  photoCropState.imageY = imageY;
}

function startPhotoCropDrag(event) {
  if (!photoCropState) return;
  photoCropState.dragging = true;
  photoCropState.lastPointerX = event.clientX;
  photoCropState.lastPointerY = event.clientY;
  documentElements.photoCropCanvas.setPointerCapture(event.pointerId);
}

function movePhotoCropDrag(event) {
  if (!photoCropState?.dragging) return;
  photoCropState.centerX += event.clientX - photoCropState.lastPointerX;
  photoCropState.centerY += event.clientY - photoCropState.lastPointerY;
  photoCropState.lastPointerX = event.clientX;
  photoCropState.lastPointerY = event.clientY;
  drawPhotoCrop();
}

function endPhotoCropDrag() {
  if (photoCropState) photoCropState.dragging = false;
}

function closePhotoCropper() {
  documentElements.photoCropModal.classList.add('hidden');
  photoCropState = null;
}

async function savePhotoCrop() {
  if (!photoCropState) return;
  documentElements.btnSavePhotoCrop.disabled = true;
  documentElements.photoCropStatus.textContent = '範囲を保存しています…';
  try {
    const state = photoCropState;
    const geometry = state.geometry;
    const scale = state.imageScale;
    const sourceX = Math.max(0, (geometry.cropX - state.imageX) / scale);
    const sourceY = Math.max(0, (geometry.cropY - state.imageY) / scale);
    const sourceWidth = Math.min(state.image.naturalWidth - sourceX, geometry.cropWidth / scale);
    const sourceHeight = Math.min(state.image.naturalHeight - sourceY, geometry.cropHeight / scale);
    const outputScale = Math.min(1, 1600 / Math.max(sourceWidth, sourceHeight));
    const output = document.createElement('canvas');
    output.width = Math.max(1, Math.round(sourceWidth * outputScale));
    output.height = Math.max(1, Math.round(sourceHeight * outputScale));
    output.getContext('2d').drawImage(state.image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, output.width, output.height);
    const blob = await new Promise(resolve => output.toBlob(resolve, 'image/jpeg', .92));
    if (!blob) throw new Error('切り抜いた画像を作成できませんでした');

    const croppedPhoto = {
      id: crypto.randomUUID(),
      name: `${state.photo.name}（範囲選択）`,
      blob,
      createdAt: Date.now(),
      derived: true,
      sourceId: state.photo.id
    };
    await withThemePhotoStore('readwrite', store => store.put(croppedPhoto));
    closePhotoCropper();
    pendingThemePhoto = null;
    await selectThemePhoto(croppedPhoto);
  } catch (error) {
    documentElements.photoCropStatus.textContent = `範囲を保存できませんでした: ${error.message}`;
  } finally {
    documentElements.btnSavePhotoCrop.disabled = false;
  }
}

async function selectThemePhoto(photo) {
  let url = themePhotoObjectUrls.get(photo.id);
  if (!url) {
    url = URL.createObjectURL(photo.blob);
    themePhotoObjectUrls.set(photo.id, url);
  }
  const assignments = JSON.parse(localStorage.getItem('instant-ledger-theme-photo-assignments') || '{}');
  assignments[activePhotoTarget] = photo.id;
  localStorage.setItem('instant-ledger-theme-photo-assignments', JSON.stringify(assignments));
  applyThemePhoto(activePhotoTarget, url);
  closeThemePhotoPicker();
}

function applyThemePhoto(target, url) {
  const isWidget = target.startsWith('widget:') || target === 'widget';
  const button = document.querySelector(`[data-photo-target="${isWidget ? 'widget' : target}"]`);
  if (button) button.textContent = '写真を変更';
  const resetButton = document.querySelector(`[data-photo-reset="${isWidget ? 'widget' : target}"]`);
  if (resetButton) resetButton.classList.remove('hidden');
  if (!isWidget) {
    const dimPhoto = documentElements.toggleBackgroundPhotoDim.checked;
    const overlay = dimPhoto ? 'linear-gradient(rgba(255,255,255,.76), rgba(255,255,255,.76)), ' : '';
    document.querySelector('.app-content').style.backgroundImage = `${overlay}url("${url}")`;
    document.querySelector('.app-content').style.backgroundSize = 'cover';
    document.querySelector('.app-content').style.backgroundPosition = 'center';
  } else {
    const widgetId = target === 'widget' ? 'total' : target.slice('widget:'.length);
    const widget = document.querySelector(`[data-photo-widget="${widgetId}"]`);
    if (widget) {
      const dimPhoto = getWidgetDimSetting(widgetId);
      const overlay = dimPhoto ? 'linear-gradient(rgba(255,255,255,.72), rgba(255,255,255,.72)), ' : '';
      widget.style.backgroundImage = `${overlay}url("${url}")`;
      widget.style.backgroundSize = 'cover';
      widget.style.backgroundPosition = 'center';
    }
  }
}

function updateSelectedWidgetResetState() {
  const target = `widget:${documentElements.selectPhotoWidget.value}`;
  const assignments = JSON.parse(localStorage.getItem('instant-ledger-theme-photo-assignments') || '{}');
  document.querySelector('[data-photo-reset="widget"]').classList.toggle('hidden', !assignments[target]);
  document.querySelector('[data-photo-target="widget"]').textContent = assignments[target] ? '写真を変更' : '写真を選ぶ';
}

function getWidgetDimSetting(widgetId) {
  const settings = JSON.parse(localStorage.getItem('instant-ledger-widget-photo-dim-settings') || '{}');
  if (Object.prototype.hasOwnProperty.call(settings, widgetId)) return settings[widgetId];
  return localStorage.getItem('instant-ledger-widget-photo-dim') !== 'false';
}

function getSelectedWidgetDimSetting() {
  return getWidgetDimSetting(documentElements.selectPhotoWidget.value);
}

function getAllWidgetDimSettings() {
  const settings = JSON.parse(localStorage.getItem('instant-ledger-widget-photo-dim-settings') || '{}');
  document.querySelectorAll('[data-photo-widget]').forEach(widget => {
    const id = widget.dataset.photoWidget;
    if (!Object.prototype.hasOwnProperty.call(settings, id)) settings[id] = getWidgetDimSetting(id);
  });
  return settings;
}

function updateSelectedWidgetSettings() {
  documentElements.toggleWidgetPhotoDim.checked = getSelectedWidgetDimSetting();
  const selectedOption = documentElements.selectPhotoWidget.selectedOptions[0];
  documentElements.widgetPhotoDimTitle.textContent = `${selectedOption.textContent}の写真を薄く表示`;
  updateSelectedWidgetResetState();
}

function resetThemePhoto(target) {
  const assignments = JSON.parse(localStorage.getItem('instant-ledger-theme-photo-assignments') || '{}');
  delete assignments[target];
  if (Object.keys(assignments).length) {
    localStorage.setItem('instant-ledger-theme-photo-assignments', JSON.stringify(assignments));
  } else {
    localStorage.removeItem('instant-ledger-theme-photo-assignments');
  }

  const isWidget = target.startsWith('widget:') || target === 'widget';
  const button = document.querySelector(`[data-photo-target="${isWidget ? 'widget' : target}"]`);
  if (button) button.textContent = '写真を選ぶ';
  document.querySelector(`[data-photo-reset="${isWidget ? 'widget' : target}"]`)?.classList.add('hidden');
  if (target === 'background') {
    const content = document.querySelector('.app-content');
    content.style.backgroundImage = '';
    content.style.backgroundSize = '';
    content.style.backgroundPosition = '';
  } else {
    const widgetId = target === 'widget' ? 'total' : target.slice('widget:'.length);
    const widget = document.querySelector(`[data-photo-widget="${widgetId}"]`);
    if (widget) {
      widget.style.backgroundImage = '';
      widget.style.backgroundSize = '';
      widget.style.backgroundPosition = '';
    }
    updateSelectedWidgetResetState();
  }
}

async function restoreThemePhotoAssignments() {
  const assignments = JSON.parse(localStorage.getItem('instant-ledger-theme-photo-assignments') || '{}');
  if (assignments.widget && !assignments['widget:total']) {
    assignments['widget:total'] = assignments.widget;
    delete assignments.widget;
    localStorage.setItem('instant-ledger-theme-photo-assignments', JSON.stringify(assignments));
  }
  for (const [target, id] of Object.entries(assignments)) {
    const photo = await withThemePhotoStore('readonly', store => store.get(id));
    if (photo) {
      let url = themePhotoObjectUrls.get(photo.id);
      if (!url) {
        url = URL.createObjectURL(photo.blob);
        themePhotoObjectUrls.set(photo.id, url);
      }
      applyThemePhoto(target, url);
    }
  }
  updateSelectedWidgetResetState();
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

  // 画面ごとのフック処理
  if (screenId === 'screen-home') {
    renderDashboard();
  } else if (screenId === 'screen-history') {
    renderHistory();
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
    appState.currentReceipt = {
      id: `receipt_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      dataUrl,
      createdAt: new Date().toISOString(),
      mimeType: 'image/jpeg'
    };

    stopCamera();
  } else {
    // カメラが起動していなかった場合のモックフォールバック画像
    if (capturedImgEl) {
      capturedImgEl.src = 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=500&auto=format&fit=crop&q=60';
      capturedImgEl.classList.remove('hidden');
    }
    appState.currentReceipt = null;
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
// Receipt capture: 保存だけを行い、端末側では解析しない。
// ==========================================
function initSensorControls() {
  documentElements.inputQuickReceipt.addEventListener('change', async event => {
    const files = [...event.target.files].filter(file => file.type.startsWith('image/'));
    if (!files.length) return;
    documentElements.receiptCaptureStatus.textContent = '端末内に保存しています…';
    try {
      await Promise.all(files.map(async file => {
        if (file.size > 15 * 1024 * 1024) throw new Error(`${file.name} は15MB以下にしてください`);
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error(`${file.name} を読み込めませんでした`));
          reader.readAsDataURL(file);
        });
        await receiptVault.put({
          id: `receipt_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
          dataUrl,
          createdAt: new Date().toISOString(),
          mimeType: file.type
        });
      }));
      documentElements.receiptCaptureStatus.textContent = `${files.length}枚を端末に保存しました。履歴一覧からPCへ送信できます。`;
    } catch (error) {
      documentElements.receiptCaptureStatus.textContent = `保存できませんでした: ${error.message}`;
    } finally {
      event.target.value = '';
    }
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
  if (LOCAL_FIRST_MODE) {
    appState.isOffline = true;
    appState.records = localRecords();
    updateConnectionIndicator('local');
    renderDashboard();
    renderHistory();
    return;
  }
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
  if (LOCAL_FIRST_MODE || appState.isOffline) {
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
      receipt_id: payload.receiptId,
      status: 'PENDING'
    };
    appState.records.unshift(newRecord);
    persistLocalRecords(appState.records);
    appState.currentReceipt = null;
    
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
  if (LOCAL_FIRST_MODE || appState.isOffline) {
    // オフラインモード時の動作
    appState.records = appState.records.map(rec => {
      if (rec.id === id) {
        return { ...rec, status: 'VERIFIED' };
      }
      return rec;
    });
    persistLocalRecords(appState.records);
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
function updateConnectionIndicator(mode) {
  const badge = document.querySelector('.tax-badge');
  if (badge) {
    if (mode === 'local') {
      badge.style.color = '#10B981';
      badge.innerHTML = `<i data-lucide="shield-check" class="icon-tiny"></i> 端末内に保存中`;
    } else if (mode) {
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
  const receiptHTML = rec.receipt_id
    ? `<button class="btn-view-receipt" type="button" data-receipt-id="${rec.receipt_id}"><i data-lucide="image" class="icon-tiny"></i> レシートを見る</button>`
    : '';

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
    ${receiptHTML}
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

  const receiptBtn = card.querySelector('.btn-view-receipt');
  if (receiptBtn) {
    receiptBtn.addEventListener('click', async (event) => {
      event.stopPropagation();
      try {
        await showReceipt(receiptBtn.dataset.receiptId);
        lucide.createIcons();
      } catch (error) {
        alert(`レシート画像を開けませんでした: ${error.message}`);
      }
    });
  }

  return card;
}
