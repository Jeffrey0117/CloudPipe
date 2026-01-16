/**
 * CloudPipe Dashboard
 */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// 狀態
let currentType = null;
let existingServices = [];
let existingApps = [];
let authToken = localStorage.getItem('cloudpipe_token');

// DOM 元素 (在 DOMContentLoaded 後賦值)
let loginScreen, dashboard, passwordInput, loginBtn, loginError, logoutBtn;
let uploadZone, uploadTitle, guideText, nameInput, nameLabel, serviceName;
let nameSuffix, nameHint, dropzone, fileInput, uploadHint, uploadStatus;
let statusText, deployedList;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 取得 DOM 元素
  loginScreen = $('#loginScreen');
  dashboard = $('#dashboard');
  passwordInput = $('#passwordInput');
  loginBtn = $('#loginBtn');
  loginError = $('#loginError');
  logoutBtn = $('#logoutBtn');
  uploadZone = $('#uploadZone');
  uploadTitle = $('#uploadTitle');
  guideText = $('#guideText');
  nameInput = $('#nameInput');
  nameLabel = $('#nameLabel');
  serviceName = $('#serviceName');
  nameSuffix = $('#nameSuffix');
  nameHint = $('#nameHint');
  dropzone = $('#dropzone');
  fileInput = $('#fileInput');
  uploadHint = $('#uploadHint');
  uploadStatus = $('#uploadStatus');
  statusText = $('#statusText');
  deployedList = $('#deployedList');

  // 只在 admin 頁面執行
  if (!loginScreen) return;

  initLogin();
  initCards();
  initUpload();

  // 檢查登入狀態
  if (authToken) {
    verifyToken();
  }
});

// ========== 登入相關 ==========

function initLogin() {
  // Enter 鍵登入
  passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') doLogin();
  });

  loginBtn.addEventListener('click', doLogin);
  logoutBtn.addEventListener('click', doLogout);
}

async function doLogin() {
  const password = passwordInput.value.trim();
  if (!password) return;

  loginError.classList.add('hidden');
  loginBtn.disabled = true;
  loginBtn.textContent = '...';

  try {
    const res = await fetch('/api/_admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const data = await res.json();

    if (data.success) {
      authToken = data.token;
      localStorage.setItem('cloudpipe_token', authToken);
      showDashboard();
    } else {
      loginError.classList.remove('hidden');
      passwordInput.value = '';
      passwordInput.focus();
    }
  } catch (err) {
    loginError.textContent = '連線失敗';
    loginError.classList.remove('hidden');
  }

  loginBtn.disabled = false;
  loginBtn.textContent = 'Login';
}

async function verifyToken() {
  try {
    const res = await fetch('/api/_admin/verify', {
      headers: { 'authorization': `Bearer ${authToken}` }
    });

    if (res.ok) {
      showDashboard();
    } else {
      doLogout();
    }
  } catch {
    doLogout();
  }
}

function showDashboard() {
  loginScreen.classList.add('hidden');
  dashboard.classList.remove('hidden');
  loadDeployed();
}

function doLogout() {
  authToken = null;
  localStorage.removeItem('cloudpipe_token');
  loginScreen.classList.remove('hidden');
  dashboard.classList.add('hidden');
  passwordInput.value = '';
}

// 卡片點擊
function initCards() {
  $$('.card').forEach(card => {
    card.addEventListener('click', () => {
      const type = card.dataset.type;
      
      // 切換 active
      $$('.card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      
      // 顯示上傳區
      showUpload(type);
    });
  });
  
  // 關閉按鈕
  $('#closeUpload').addEventListener('click', hideUpload);
}

// 顯示上傳區
function showUpload(type) {
  currentType = type;
  uploadZone.classList.remove('hidden');
  uploadStatus.classList.add('hidden');
  dropzone.style.display = 'block';
  serviceName.value = '';

  if (type === 'service') {
    uploadTitle.textContent = '上傳 API 服務';
    nameLabel.textContent = 'API 名稱';
    nameSuffix.textContent = '';
    serviceName.placeholder = 'ytdownload';
    uploadHint.textContent = '或點擊選擇 .js 檔案';
    fileInput.accept = '.js';
    guideText.innerHTML = '檔名 <code>xxx.js</code> 會依你的命名存成 → <code>epi.isnowfriend.com/你的名稱</code>';
    updateNameHint('service');
  } else {
    uploadTitle.textContent = '部署專案';
    nameLabel.textContent = '子域名';
    nameSuffix.textContent = '.isnowfriend.com';
    serviceName.placeholder = 'blog';
    uploadHint.textContent = '或點擊選擇 .zip 檔案';
    fileInput.accept = '.zip';
    guideText.innerHTML = '上傳後可透過 <code>你的名稱.isnowfriend.com</code> 存取';
    updateNameHint('app');
  }
}

// 更新名稱提示（顯示已佔用）
function updateNameHint(type) {
  const existing = type === 'service' ? existingServices : existingApps;
  if (existing.length > 0) {
    nameHint.textContent = '已使用: ' + existing.join(', ');
  } else {
    nameHint.textContent = '';
  }
}

// 隱藏上傳區
function hideUpload() {
  uploadZone.classList.add('hidden');
  $$('.card').forEach(c => c.classList.remove('active'));
  currentType = null;
}

// 初始化上傳
function initUpload() {
  // 點擊上傳
  dropzone.addEventListener('click', () => fileInput.click());
  
  // 檔案選擇
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleUpload(e.target.files[0]);
    }
  });
  
  // 拖拽
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });
  
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files[0]);
    }
  });
}

// 處理上傳
async function handleUpload(file) {
  // 驗證檔案類型
  if (currentType === 'service' && !file.name.endsWith('.js')) {
    alert('請上傳 .js 檔案');
    return;
  }
  if (currentType === 'app' && !file.name.endsWith('.zip')) {
    alert('請上傳 .zip 檔案');
    return;
  }

  // 取得名稱
  const name = serviceName.value.trim();
  if (!name) {
    alert('請輸入名稱');
    return;
  }
  if (!/^[a-z0-9-]+$/.test(name)) {
    alert('名稱只能包含小寫字母、數字和連字符');
    return;
  }

  // 檢查衝突
  const existing = currentType === 'service' ? existingServices : existingApps;
  if (existing.includes(name)) {
    alert(`名稱 "${name}" 已被使用，請換一個`);
    return;
  }

  // 顯示上傳中
  dropzone.style.display = 'none';
  nameInput.style.display = 'none';
  uploadStatus.classList.remove('hidden', 'success', 'error');
  statusText.textContent = '上傳中...';

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);

    const endpoint = currentType === 'service'
      ? '/api/_admin/upload/service'
      : '/api/_admin/upload/app';

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'authorization': `Bearer ${authToken}` },
      body: formData
    });

    const data = await res.json();

    if (data.success) {
      uploadStatus.classList.add('success');
      statusText.innerHTML = `部署成功！<br><a href="${data.url}" target="_blank">${data.url}</a>`;
      loadDeployed();
    } else {
      throw new Error(data.error || '上傳失敗');
    }
  } catch (err) {
    uploadStatus.classList.add('error');
    statusText.textContent = err.message;
  }
}

// 載入已部署列表
async function loadDeployed() {
  try {
    const res = await fetch('/api/_admin/services', {
      headers: { 'authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();

    // 記錄已存在的名稱
    existingServices = data.services.map(s => s.name);
    existingApps = data.apps.map(a => a.name);

    if (data.services.length === 0 && data.apps.length === 0) {
      deployedList.innerHTML = '<div class="empty">尚無部署的服務</div>';
      return;
    }

    let html = '';
    
    // Services
    data.services.forEach(s => {
      html += `
        <div class="deployed-item" data-type="service" data-name="${s.name}">
          <div class="info">
            <span class="icon">📡</span>
            <div>
              <div class="name">${s.name}</div>
              <div class="url">${s.url}</div>
            </div>
          </div>
          <div class="status">運行中</div>
          <div class="actions">
            <button class="delete" onclick="deleteItem('service', '${s.name}')">刪除</button>
          </div>
        </div>
      `;
    });
    
    // Apps
    data.apps.forEach(a => {
      html += `
        <div class="deployed-item" data-type="app" data-name="${a.name}">
          <div class="info">
            <span class="icon">🌐</span>
            <div>
              <div class="name">${a.name}</div>
              <div class="url">${a.url}</div>
            </div>
          </div>
          <div class="status">運行中</div>
          <div class="actions">
            <button class="delete" onclick="deleteItem('app', '${a.name}')">刪除</button>
          </div>
        </div>
      `;
    });
    
    deployedList.innerHTML = html;
  } catch (err) {
    deployedList.innerHTML = '<div class="empty">無法載入服務列表</div>';
  }
}

// 刪除項目
async function deleteItem(type, name) {
  if (!confirm(`確定要刪除 ${name}？`)) return;
  
  try {
    const endpoint = type === 'service'
      ? `/api/_admin/service/${name}`
      : `/api/_admin/app/${name}`;
    
    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers: { 'authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    
    if (data.success) {
      loadDeployed();
    } else {
      alert(data.error || '刪除失敗');
    }
  } catch (err) {
    alert('刪除失敗: ' + err.message);
  }
}
