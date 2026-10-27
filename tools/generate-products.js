/**
 * tools/generate-products.js
 * يولّد www/data/products.js تلقائياً من الصور في www/images/products/
 * بدون أي مكتبات خارجية.
 *
 * أسماء الصور المدعومة:
 *   MD001.jpg           -> منتج بكود MD001 (الصورة الرئيسية)
 *   MD001-2.jpg         -> صورة إضافية لنفس المنتج (أو MD001_2.jpg)
 *   modern-001.jpg      -> الشكل القديم (فئة-رقم) لسه شغال
 * الأسعار والمقاسات: عدّلها في SIZE_PRICES تحت (مكان واحد لكل المنتجات)
 * التعديلات اليدوية لمنتج معين (اسم، تصنيف، لون، خصم...): www/data/overrides.js
 */

const fs = require('fs');
const path = require('path');

const PRODUCTS_DIR = path.join(__dirname, '..', 'www', 'images', 'products');
const OUTPUT_FILE = path.join(__dirname, '..', 'www', 'data', 'products.js');
const OVERRIDES_FILE = path.join(__dirname, '..', 'www', 'data', 'overrides.js');

const CATEGORY_MAP = {
  modern:   { nameAr: 'مودرن' },
  classic:  { nameAr: 'كلاسيك' },
  kids:     { nameAr: 'أطفال' },
  kitchen:  { nameAr: 'مطبخ وممرات' },
  prayer:   { nameAr: 'سجاد صلاة' },
  moquette: { nameAr: 'موكيت' }
};

// ===== أسعار المقاسات (جنيه) - بتنطبق على كل المنتجات =====
// عدّل أي سعر هنا وشغّل السكريبت (أو ارفع التعديل) وهيتغير في الكل
const SIZE_PRICES = [
  { size: '0.50×0.80', price: 62.5 },
  { size: '0.90×1.80', price: 300 },
  { size: '0.90×2.80', price: 425 },
  { size: '0.90×3.80', price: 562.5 },
  { size: '1.00×1.00', price: 212.5 },
  { size: '1.00×2.00', price: 375 },
  { size: '1.00×3.00', price: 500 },
  { size: '1.00×4.00', price: 625 },
  { size: '1.20×1.20', price: 312.5 },
  { size: '1.20×2.00', price: 400 },
  { size: '1.40×2.00', price: 475 },
  { size: '1.60×1.60', price: 562.5 },
  { size: '1.60×2.30', price: 625 },
  { size: '1.80×1.80', price: 687.5 },
  { size: '1.80×2.80', price: 750 },
  { size: '2.00×2.80', price: 875 },
  { size: '2.00×3.80', price: 1187.5 },
  { size: '2.40×3.20', price: 1500 },
  { size: '2.60×3.60', price: 1812.5 }
];
// المقاس اللي بيتعرض سعره كسعر أساسي على كارت المنتج
const MAIN_SIZE = '1.60×2.30';

// ----- قراءة التعديلات اليدوية -----
let manualOverrides = {};
if (fs.existsSync(OVERRIDES_FILE)) {
  try {
    const txt = fs.readFileSync(OVERRIDES_FILE, 'utf8');
    const m = txt.match(/=\s*({[\s\S]*});?/);
    if (m && m[1]) manualOverrides = new Function('return ' + m[1])() || {};
    console.log(`تم تحميل ${Object.keys(manualOverrides).length} تعديل يدوي`);
  } catch (e) {
    console.warn('تعذر قراءة overrides.js:', e.message);
  }
}

if (!fs.existsSync(PRODUCTS_DIR)) fs.mkdirSync(PRODUCTS_DIR, { recursive: true });

const EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
const map = new Map();

fs.readdirSync(PRODUCTS_DIR).forEach(file => {
  const ext = path.extname(file).toLowerCase();
  if (!EXTS.includes(ext)) return;
  const base = path.basename(file, ext);

  let category = 'modern', number = '', gallery = 1, code = '';
  let m;

  if ((m = base.match(/^([a-zA-Z]+)-(\d+)(?:-(\d+))?$/)) && CATEGORY_MAP[m[1].toLowerCase()]) {
    // الشكل القديم: modern-001 أو modern-001-2
    category = m[1].toLowerCase();
    number = m[2];
    gallery = m[3] ? parseInt(m[3], 10) : 1;
    code = 'MD' + number;
  } else if ((m = base.match(/^([a-zA-Z]+)[-_]?(\d+)(?:[-_](\d+))?$/))) {
    // أكواد: MD001 أو MD001-2 أو MD-001
    number = m[2];
    gallery = m[3] ? parseInt(m[3], 10) : 1;
    code = (m[1] + number).toUpperCase();
  } else if ((m = base.match(/^(\d+)(?:[-_](\d+))?$/))) {
    number = m[1];
    gallery = m[2] ? parseInt(m[2], 10) : 1;
    code = 'MD' + number;
  } else {
    // أي اسم تاني
    code = base.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'MD';
    number = code;
  }

  const id = code.toLowerCase();
  if (!map.has(id)) map.set(id, { id, code, category, number, images: [] });
  const item = map.get(id);
  if (CATEGORY_MAP[category] && category !== 'modern') item.category = category;
  item.images.push({ file, index: gallery });
});

// ترتيب المنتجات بالكود
const items = Array.from(map.values()).sort((a, b) =>
  a.code.localeCompare(b.code, 'en', { numeric: true })
);

const mainPrice = (SIZE_PRICES.find(s => s.size === MAIN_SIZE) || SIZE_PRICES[0]).price;
const productList = [];

items.forEach((item, i) => {
  item.images.sort((a, b) => a.index - b.index);
  const files = item.images.map(x => `images/products/${x.file}`);
  const o = manualOverrides[item.id] || manualOverrides[item.code] || {};
  const cat = o.category || item.category;
  const catMeta = CATEGORY_MAP[cat] || CATEGORY_MAP.modern;

  productList.push({
    id: item.id,
    code: item.code,
    title: o.title || `سجادة ${catMeta.nameAr} - كود ${item.code}`,
    category: cat,
    categoryNameAr: catMeta.nameAr,
    modelNumber: item.number,
    mainImage: files[0] || '',
    images: o.images && o.images.length ? o.images : files,
    price: typeof o.price === 'number' ? o.price : mainPrice,
    salePrice: typeof o.salePrice === 'number' ? o.salePrice : null,
    sizes: o.sizes || SIZE_PRICES,
    colors: o.colors || ['بيج وذهبي', 'رمادي مودرن', 'كحلي ملكي'],
    material: o.material || 'بولي بروبلين ناعم الملمس، مقاوم للبقع',
    origin: o.origin || 'صناعة مصرية',
    description: o.description || 'سجادة بخامة ممتازة، سهلة التنظيف وثابتة على الأرضيات، وتصميم أنيق يناسب مختلف الديكورات.',
    featured: typeof o.featured === 'boolean' ? o.featured : i < 12,
    outOfStock: Boolean(o.outOfStock),
    limited: Boolean(o.limited),
    createdAt: o.createdAt || new Date().toISOString().split('T')[0]
  });
});

// لو مفيش صور خالص: منتجات تجريبية (الصور هتظهر placeholder)
if (productList.length === 0) {
  console.log('مفيش صور، هيتعمل 12 منتج تجريبي.');
  const cats = Object.keys(CATEGORY_MAP);
  for (let i = 1; i <= 12; i++) {
    const num = String(i).padStart(3, '0');
    const cat = cats[(i - 1) % cats.length];
    productList.push({
      id: 'md' + num, code: 'MD' + num,
      title: `سجادة ${CATEGORY_MAP[cat].nameAr} - كود MD${num}`,
      category: cat, categoryNameAr: CATEGORY_MAP[cat].nameAr, modelNumber: num,
      mainImage: `images/products/MD${num}.jpg`, images: [`images/products/MD${num}.jpg`],
      price: mainPrice, salePrice: null, sizes: SIZE_PRICES,
      colors: ['بيج وذهبي', 'رمادي', 'كحلي'],
      material: 'بولي بروبلين ناعم', origin: 'صناعة مصرية',
      description: 'سجادة بخامة ممتازة وتصميم أنيق.',
      featured: true, outOfStock: false, limited: false, createdAt: '2026-10-27'
    });
  }
}

const out = `/**
 * ملف مولّد تلقائياً بواسطة tools/generate-products.js - لا تعدله يدوياً.
 * للتعديل الدائم على منتج: www/data/overrides.js
 * إجمالي المنتجات: ${productList.length}
 */

window.MD_PRODUCTS = ${JSON.stringify(productList, null, 2)};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.MD_PRODUCTS;
}
`;

fs.writeFileSync(OUTPUT_FILE, out, 'utf8');
console.log(`تم إنشاء ${productList.length} منتج في ${OUTPUT_FILE}`);
