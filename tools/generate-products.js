/**
 * tools/generate-products.js
 * 
 * سكريبت توليد كتالوج السجاد تلقائياً من الصور داخل مجلد www/images/products/
 * يعمل بواسطة Node.js وبدون أي مكتبات خارجية (Zero Dependencies).
 * 
 * تسمية الصور المدعومة:
 *  - الصورة الرئيسية: <category>-<number>.jpg (مثال: modern-001.jpg, classic-002.jpg)
 *  - صور المعرض الإضافية لنفس الموديل: modern-001-2.jpg, modern-001-3.jpg
 *  - إذا لم تبدأ الصورة باسم فئة معروفة (مثل 001.jpg) يتم تصنيفها كـ "مودرن" تلقائياً.
 * 
 * الميزات:
 *  1. يحافظ بالكامل على التعديلات اليدوية من ملف www/data/overrides.js
 *  2. يربط المقاسات والأسعار التلقائية بالفئة
 *  3. يجعل أول 12 منتج مميزين تلقائياً (featured)
 */

const fs = require('fs');
const path = require('path');

const PRODUCTS_DIR = path.join(__dirname, '..', 'www', 'images', 'products');
const OUTPUT_FILE = path.join(__dirname, '..', 'www', 'data', 'products.js');
const OVERRIDES_FILE = path.join(__dirname, '..', 'www', 'data', 'overrides.js');

// قاموس الفئات وترجمتها للعربية
const CATEGORY_MAP = {
  modern: { id: 'modern', nameAr: 'مودرن', tag: 'مودرن' },
  classic: { id: 'classic', nameAr: 'كلاسيك', tag: 'كلاسيك' },
  kids: { id: 'kids', nameAr: 'أطفال', tag: 'أطفال' },
  kitchen: { id: 'kitchen', nameAr: 'مطبخ وممرات', tag: 'مطبخ' },
  prayer: { id: 'prayer', nameAr: 'سجاد صلاة', tag: 'صلاة' },
  moquette: { id: 'moquette', nameAr: 'موكيت', tag: 'موكيت' }
};

// مقاسات وأسعار افتراضية لكل فئة (يمكن تعديلها من config.js أو overrides.js)
const DEFAULT_SIZE_PRICES = {
  modern: [
    { size: '160x230', price: 1350 },
    { size: '200x290', price: 2100 },
    { size: '240x340', price: 2950 },
    { size: 'مشاية 80x200', price: 600 },
    { size: 'مشاية 80x300', price: 850 }
  ],
  classic: [
    { size: '160x230', price: 1450 },
    { size: '200x290', price: 2250 },
    { size: '240x340', price: 3150 },
    { size: 'مشاية 80x200', price: 650 },
    { size: 'مشاية 80x300', price: 900 }
  ],
  kids: [
    { size: '120x180', price: 850 },
    { size: '160x220', price: 1250 }
  ],
  kitchen: [
    { size: '80x150', price: 380 },
    { size: '80x200', price: 490 },
    { size: '80x300', price: 720 },
    { size: '120x180', price: 890 }
  ],
  prayer: [
    { size: 'مفردة 70x120', price: 220 },
    { size: 'صف 5 أفراد 120x300', price: 950 }
  ],
  moquette: [
    { size: 'متر مربع (قص حسب الطلب)', price: 190 },
    { size: 'رول كامل 4x25 متر', price: 16500 }
  ]
};

// قراءة ملف التعديلات اليدوية إن وجد
let manualOverrides = {};
if (fs.existsSync(OVERRIDES_FILE)) {
  try {
    const fileContent = fs.readFileSync(OVERRIDES_FILE, 'utf8');
    // يدعم ملف window.MD_OVERRIDES = { ... } أو module.exports = { ... }
    const jsonMatch = fileContent.match(/=\s*({[\s\S]*});?/);
    if (jsonMatch && jsonMatch[1]) {
      const evalFn = new Function('return ' + jsonMatch[1]);
      manualOverrides = evalFn() || {};
      console.log(` تم تحميل ${Object.keys(manualOverrides).length} تعديل يدوي من overrides.js`);
    }
  } catch (err) {
    console.warn(' تحذير: تعذر قراءة overrides.js، سيتم المتابعة بدون تعديلات يدوية:', err.message);
  }
}

// التأكد من وجود مجلد الصور
if (!fs.existsSync(PRODUCTS_DIR)) {
  fs.mkdirSync(PRODUCTS_DIR, { recursive: true });
}

// قراءة ملفات الصور
const files = fs.readdirSync(PRODUCTS_DIR);
const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

// تجميع الصور حسب معرف المنتج
const productsMap = new Map();

files.forEach(file => {
  const ext = path.extname(file).toLowerCase();
  if (!imageExtensions.includes(ext)) return;

  const baseName = path.basename(file, ext);
  // صيغة الفحص:
  // 1) category-number (مثل modern-001)
  // 2) category-number-galleryIndex (مثل modern-001-2)
  // 3) number (مثل 001) -> تذهب لـ modern
  // 4) number-galleryIndex (مثل 001-2)
  let categoryKey = 'modern';
  let modelNumber = '';
  let galleryIndex = 1;

  const matchWithCat = baseName.match(/^([a-zA-Z]+)-(\d+)(?:-(\d+))?$/);
  const matchOnlyNum = baseName.match(/^(\d+)(?:-(\d+))?$/);

  if (matchWithCat) {
    const rawCat = matchWithCat[1].toLowerCase();
    categoryKey = CATEGORY_MAP[rawCat] ? rawCat : 'modern';
    modelNumber = matchWithCat[2];
    galleryIndex = matchWithCat[3] ? parseInt(matchWithCat[3], 10) : 1;
  } else if (matchOnlyNum) {
    categoryKey = 'modern';
    modelNumber = matchOnlyNum[1];
    galleryIndex = matchOnlyNum[2] ? parseInt(matchOnlyNum[2], 10) : 1;
  } else {
    // ملف غير متوافق تماماً مع النمط ولكن صورة صالحة
    const cleaned = baseName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    modelNumber = cleaned;
    categoryKey = 'modern';
  }

  const productId = `${categoryKey}-${modelNumber}`;

  if (!productsMap.has(productId)) {
    productsMap.set(productId, {
      id: productId,
      categoryKey,
      modelNumber,
      images: []
    });
  }

  productsMap.get(productId).images.push({
    file,
    index: galleryIndex
  });
});

// ترتيب الصور داخل كل منتج (الصورة الرئيسية index=1 أولاً)
const productList = [];
let indexCount = 0;

productsMap.forEach(item => {
  indexCount++;
  item.images.sort((a, b) => a.index - b.index);
  const imageFiles = item.images.map(img => `images/products/${img.file}`);
  const mainImage = imageFiles[0] || '';

  const catMeta = CATEGORY_MAP[item.categoryKey] || CATEGORY_MAP.modern;
  const defaultSizes = DEFAULT_SIZE_PRICES[item.categoryKey] || DEFAULT_SIZE_PRICES.modern;
  const defaultPrice = defaultSizes[0] ? defaultSizes[0].price : 1200;

  // العنوان الافتراضي بالعربية
  const defaultTitle = `سجادة ${catMeta.nameAr} موديل ${item.modelNumber}`;
  const defaultDesc = `سجادة فاخرة خامة ممتازة سهلة التنظيف وثابتة على الأرضيات، تصميم عصري راقي يضفي دفئاً وفخامة على منزلك.`;

  // دمج التعديلات اليدوية
  const override = manualOverrides[item.id] || {};

  const product = {
    id: item.id,
    title: override.title || defaultTitle,
    category: override.category || item.categoryKey,
    categoryNameAr: catMeta.nameAr,
    modelNumber: item.modelNumber,
    mainImage: mainImage,
    images: override.images && override.images.length > 0 ? override.images : imageFiles,
    price: typeof override.price === 'number' ? override.price : defaultPrice,
    salePrice: typeof override.salePrice === 'number' ? override.salePrice : null,
    sizes: override.sizes || defaultSizes,
    colors: override.colors || ['بيج وذهبي', 'رمادي مودرن', 'كحلي ملكي'],
    material: override.material || 'بولي بروبلين معالج ناعم الملمس، مقاوم للبقع',
    origin: override.origin || 'صناعة مصرية بجودة عالمية',
    description: override.description || defaultDesc,
    featured: typeof override.featured === 'boolean' ? override.featured : (indexCount <= 12),
    outOfStock: Boolean(override.outOfStock),
    limited: Boolean(override.limited),
    createdAt: override.createdAt || new Date().toISOString().split('T')[0]
  };

  productList.push(product);
});

// إذا لم توجد أي صور في المجلد، توليد أمثلة أولية حتى لا يكون المتجر فارغاً
if (productList.length === 0) {
  console.log('ℹ لم يتم العثور على صور في www/images/products/، سيتم وضع 12 منتجاً تجريبياً.');
  for (let i = 1; i <= 12; i++) {
    const num = String(i).padStart(3, '0');
    const catKeys = ['modern', 'classic', 'kids', 'kitchen', 'prayer', 'moquette'];
    const catKey = catKeys[(i - 1) % catKeys.length];
    const catMeta = CATEGORY_MAP[catKey];
    const defaultSizes = DEFAULT_SIZE_PRICES[catKey];
    productList.push({
      id: `${catKey}-${num}`,
      title: `سجادة ${catMeta.nameAr} موديل ${num}`,
      category: catKey,
      categoryNameAr: catMeta.nameAr,
      modelNumber: num,
      mainImage: `images/products/${catKey}-${num}.jpg`,
      images: [`images/products/${catKey}-${num}.jpg`],
      price: defaultSizes[0].price,
      salePrice: i % 3 === 0 ? Math.round(defaultSizes[0].price * 0.85) : null,
      sizes: defaultSizes,
      colors: ['بيج وذهبي', 'رمادي وكافيه', 'كحلي فخم'],
      material: 'بولي بروبلين حريري فائق النعومة، مقاوم للاتساخ وسهل الغسيل',
      origin: 'صناعة مصرية ممتازة',
      description: `تصميم فخم وألوان ثابتة تناسب جميع الديكورات، نسج تركي فاخر بأيدي ماهرة.`,
      featured: i <= 8,
      outOfStock: false,
      limited: i === 2 || i === 7,
      createdAt: '2026-10-26'
    });
  }
}

// كتابة ملف products.js
const fileContent = `/**
 * ملف المنتجات المولد تلقائياً بواسطة tools/generate-products.js
 * لا تقم بتعديل هذا الملف يدوياً مباشرة، لأن السكريبت سيعيد بناءه عند إضافة صور جديدة.
 * لإجراء تعديلات يدوية دائمة (مثل تغيير اسم أو سعر أو وصف منتج بعينه)، أضف التعديل في:
 * www/data/overrides.js
 * 
 * تم التوليد بتاريخ: ${new Date().toLocaleString('ar-EG')}
 * إجمالي المنتجات: ${productList.length}
 */

window.MD_PRODUCTS = ${JSON.stringify(productList, null, 2)};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.MD_PRODUCTS;
}
`;

fs.writeFileSync(OUTPUT_FILE, fileContent, 'utf8');
console.log(` تم بنجاح إنشاء كتيّب المنتجات (${productList.length} منتج) في ${OUTPUT_FILE}`);
