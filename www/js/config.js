/**
 * www/js/config.js
 * 
 * ملف الإعدادات الرئيسي لمتجر MD سجاد - محمد ضياء
 * يمكنك من هنا تغيير رقم الواتساب، أسعار المقاسات، نسب خصم الجملة، ورقم الـ PIN
 */

// ==========================================
// 1. بيانات المتجر والتواصل الأساسية
// ==========================================
const STORE_NAME = "MD";
const STORE_TITLE = "MD سجاد | محمد ضياء";
const OWNER = "محمد ضياء";
const CURRENCY = "جنيه";

// رقم الواتساب المصري المحلي (يمكنك تغييره هنا في أي وقت)
const WHATSAPP_LOCAL = "01280988369";

// الرقم الدولي يستخرج تلقائياً بحذف الصفر وإضافة 20 لمصر -> "201280988369"
const WHATSAPP_INTL = WHATSAPP_LOCAL.replace(/^0+/, "20");

// رقم الاتصال الهاتفي المباشر
const PHONE_CALL = WHATSAPP_LOCAL;

// رابط صفحة الفيسبوك
const FACEBOOK_URL = "https://facebook.com/md.carpets.eg";

// مواعيد العمل واستقبال الطلبات
const WORKING_HOURS = "يومياً من 10:00 صباحاً حتى 10:00 مساءً";

// رمز المرور للوحة الإدارة البسيطة (ملاحظة: هذا قفل محلي على المتصفح وليس أمان سيرفر)
const ADMIN_PIN = "2026";


// ==========================================
// 2. وضع عرض الصور (Bundle vs Remote)
// ==========================================
/**
 * IMAGES_MODE:
 * - "bundled": الصور مخزنة داخل التطبيق / الموقع (تعمل بدون إنترنت للصور المرفوعة مسبقاً)
 * - "remote": تحميل الصور من رابط خارجي (يقلل حجم الـ APK لـ 700+ منتج)
 */
const IMAGES_MODE = "bundled";

// الرابط الأساسي للصور عند اختيار وضع "remote" (على GitHub Pages أو سيرفرك)
const IMAGES_BASE_URL = "https://mdiaa5754.github.io/md-carpets/images/products/";


// ==========================================
// 3. أسعار المقاسات الافتراضية حسب الفئات
// ==========================================
const SIZE_PRICES = {
  modern: {
    "160x230": 1350,
    "200x290": 2100,
    "240x340": 2950,
    "مشاية 80x200": 600,
    "مشاية 80x300": 850
  },
  classic: {
    "160x230": 1450,
    "200x290": 2250,
    "240x340": 3150,
    "مشاية 80x200": 650,
    "مشاية 80x300": 900
  },
  kids: {
    "120x180": 850,
    "160x220": 1250
  },
  kitchen: {
    "80x150": 380,
    "80x200": 490,
    "80x300": 720,
    "120x180": 890
  },
  prayer: {
    "مفردة 70x120": 220,
    "صف 5 أفراد 120x300": 950
  },
  moquette: {
    "متر مربع": 190,
    "رول كامل 4x25": 16500
  }
};


// ==========================================
// 4. شرائح أسعار الجملة للتجار
// ==========================================
const MIN_WHOLESALE_ORDER = 20; // أقل كمية لطلب الجملة
const WHOLESALE_TIERS = [
  { min: 20, max: 49, discountPercent: 20, label: "من 20 إلى 49 قطعة (خصم 20%)" },
  { min: 50, max: 99, discountPercent: 28, label: "من 50 إلى 99 قطعة (خصم 28%)" },
  { min: 100, max: 9999, discountPercent: 35, label: "100 قطعة فأكثر (خصم 35%)" }
];


// ==========================================
// 5. معلومات الشحن وسياسة الاسترجاع
// ==========================================
const DELIVERY_INFO = {
  cairo_giza: "من 2 إلى 3 أيام عمل",
  delta_canal: "من 3 إلى 4 أيام عمل",
  upper_egypt: "من 4 إلى 5 أيام عمل",
  shippingNote: "معاينة السجاد قبل الاستلام حق أصيل لكل عميل، والدفع عند الاستلام فقط (Cash on Delivery).",
  returnPolicy: "استبدال واسترجاع فوري إذا وجد أي عيب صناعة أو اختلاف عن المواصفات المطلوبة."
};


// ==========================================
// 6. قائمة محافظات جمهورية مصر العربية الـ 27
// ==========================================
const EGYPT_GOVERNORATES = [
  "القاهرة",
  "الجيزة",
  "الإسكندرية",
  "القليوبية",
  "الدقهلية",
  "الشرقية",
  "المنوفية",
  "الغربية",
  "البحيرة",
  "دمياط",
  "كفر الشيخ",
  "بورسعيد",
  "الإسماعيلية",
  "السويس",
  "بني سويف",
  "الفيوم",
  "المنيا",
  "أسيوط",
  "سوهاج",
  "قنا",
  "الأقصر",
  "أسوان",
  "البحر الأحمر",
  "الوادي الجديد",
  "مطروح",
  "شمال سيناء",
  "جنوب سيناء"
];


// ==========================================
// 7. دوال مساعدة عامة (Helpers)
// ==========================================

/**
 * دالة توليد رابط واتساب مع نص عربي مشفر بأمان
 */
function createWhatsAppUrl(text) {
  const encodedText = encodeURIComponent(text);
  return `https://wa.me/${WHATSAPP_INTL}?text=${encodedText}`;
}

/**
 * دالة تنسيق السعر بالجنيه المصري
 */
function formatPrice(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) return '0 ' + CURRENCY;
  return new Intl.NumberFormat('ar-EG').format(Math.round(amount)) + ' ' + CURRENCY;
}

/**
 * دالة الحصول على مسار الصورة مع دعم وضعي Bundled و Remote
 */
function getProductImageUrl(imagePath) {
  if (!imagePath) return '';
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://') || imagePath.startsWith('data:')) {
    return imagePath;
  }
  if (IMAGES_MODE === 'remote') {
    const fileName = imagePath.split('/').pop();
    return `${IMAGES_BASE_URL.replace(/\/$/, '')}/${fileName}`;
  }
  return imagePath;
}

/**
 * فتح الرابط بأمان سواء في المتصفح أو داخل بيئة Capacitor / WebView
 */
function openExternalLink(url) {
  try {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      window.open(url, '_system');
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  } catch (e) {
    window.location.href = url;
  }
}

// تصدير الإعدادات في النطاق العام window.MD_CONFIG
window.MD_CONFIG = {
  STORE_NAME,
  STORE_TITLE,
  OWNER,
  CURRENCY,
  WHATSAPP_LOCAL,
  WHATSAPP_INTL,
  PHONE_CALL,
  FACEBOOK_URL,
  WORKING_HOURS,
  ADMIN_PIN,
  IMAGES_MODE,
  IMAGES_BASE_URL,
  SIZE_PRICES,
  MIN_WHOLESALE_ORDER,
  WHOLESALE_TIERS,
  DELIVERY_INFO,
  EGYPT_GOVERNORATES,
  createWhatsAppUrl,
  formatPrice,
  getProductImageUrl,
  openExternalLink
};
