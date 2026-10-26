/**
 * www/js/admin.js
 * لوحة التحكم البسيطة لمتجر MD سجاد
 * محمية بـ PIN محلي بسيط، تتيح تعديل الأسعار، الخصومات، التوفر، وإضافة صور مضغوطة عبر IndexedDB
 * وتصدير/استيراد ملف التعديلات www/data/overrides.js
 */

const DB_NAME = 'MD_Carpets_Admin_DB';
const DB_VERSION = 1;
const STORE_NAME = 'admin_images';

class AdminDB {
  static open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  static async saveImage(id, dataUrl) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ id, dataUrl, updatedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  static async getImage(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result ? req.result.dataUrl : null);
      req.onerror = () => reject(req.error);
    });
  }
}

/**
 * دالة ضغط الصور في المتصفح باستخدام عنصر Canvas
 * الحد الأقصى للعرض: 1000px | جودة JPEG: 0.7
 */
function compressImageClientSide(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 1000;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(compressedDataUrl);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

class AdminManager {
  constructor() {
    this.isAuthenticated = false;
    this.overrides = this.loadLocalOverrides();
  }

  loadLocalOverrides() {
    try {
      const local = localStorage.getItem('MD_ADMIN_LOCAL_OVERRIDES');
      if (local) {
        return JSON.parse(local);
      }
    } catch (e) {
      console.warn('خطأ في تحميل التعديلات المحلية:', e);
    }
    return window.MD_OVERRIDES || {};
  }

  saveLocalOverrides() {
    try {
      localStorage.setItem('MD_ADMIN_LOCAL_OVERRIDES', JSON.stringify(this.overrides));
    } catch (e) {
      console.error('خطأ في حفظ التعديلات:', e);
    }
  }

  verifyPin(inputPin) {
    if (String(inputPin).trim() === String(window.MD_CONFIG.ADMIN_PIN).trim()) {
      this.isAuthenticated = true;
      return true;
    }
    return false;
  }

  logout() {
    this.isAuthenticated = false;
  }

  updateProductOverride(productId, data) {
    if (!this.overrides[productId]) {
      this.overrides[productId] = {};
    }
    Object.assign(this.overrides[productId], data);
    this.saveLocalOverrides();
  }

  exportOverridesFile() {
    const content = `/**
 * ملف التعديلات اليدوية المحدثة من لوحة الإدارة
 * تم التصدير بتاريخ: ${new Date().toLocaleString('ar-EG')}
 * انسخ محتوى هذا الملف وضعه داخل www/data/overrides.js ثم ارفعه إلى GitHub
 */

window.MD_OVERRIDES = ${JSON.stringify(this.overrides, null, 2)};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.MD_OVERRIDES;
}
`;
    const blob = new Blob([content], { type: 'application/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'overrides.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  importOverridesFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const match = text.match(/=\s*({[\s\S]*});?/);
          if (match && match[1]) {
            const parsed = new Function('return ' + match[1])();
            this.overrides = parsed;
            this.saveLocalOverrides();
            resolve(Object.keys(parsed).length);
          } else {
            // محاولة JSON عادية
            const parsed = JSON.parse(text);
            this.overrides = parsed;
            this.saveLocalOverrides();
            resolve(Object.keys(parsed).length);
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }
}

window.AdminDB = AdminDB;
window.compressImageClientSide = compressImageClientSide;
window.adminManager = new AdminManager();
