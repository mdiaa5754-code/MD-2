/**
 * tools/compress-images.js
 * 
 * سكريبت ضغط وتحجيم الصور بالجملة لمتجر MD سجاد
 * يستخدم مكتبة sharp لتقليص حجم الصور إلى أقصى عرض 1000 بكسل وجودة JPEG ~70%
 * بهدف أن يكون حجم كل صورة أقل من 200 كيلوبايت لتوفير سرعة فائقة في التصفح
 * وتجنب زيادة حجم ملف الـ APK.
 * 
 * طريقة التشغيل:
 * 1. ضع الصور الأصلية داخل مجلد: www/images/products/
 * 2. تأكد من تثبيت المكتبات: npm install
 * 3. شغّل الأمر: node tools/compress-images.js
 * 
 * ملاحظة: إذا لم ترغب في تثبيت sharp على حاسوبك، يمكنك استخدام بدائل مجانية وسهلة:
 * - موقع Squoosh.app أو iloveimg.com لضغط الصور مجاناً دفعة واحدة.
 * - تطبيقات ضغط الصور على الموبايل مثل Photo Compress & Resize.
 */

const fs = require('fs');
const path = require('path');

let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('\n❌ لم يتم العثور على مكتبة sharp.');
  console.error('👉 لتثبيتها وتشغيل السكريبت، نفّذ الأمر التالي:');
  console.error('   npm install sharp --save-dev');
  console.error('   ثم أعد تشغيل: node tools/compress-images.js\n');
  process.exit(1);
}

const PRODUCTS_DIR = path.join(__dirname, '..', 'www', 'images', 'products');
const MAX_WIDTH = 1000;
const JPEG_QUALITY = 70;

async function compressAll() {
  if (!fs.existsSync(PRODUCTS_DIR)) {
    console.error('❌ مجلد الصور غير موجود:', PRODUCTS_DIR);
    return;
  }

  const files = fs.readdirSync(PRODUCTS_DIR);
  const imageFiles = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));

  console.log(`\n🚀 بدء ضغط ${imageFiles.length} صورة في ${PRODUCTS_DIR} ...`);
  console.log(`📐 الحد الأقصى للعرض: ${MAX_WIDTH}px | جودة JPEG: ${JPEG_QUALITY}% | الحجم المستهدف: <200KB\n`);

  let processedCount = 0;
  let totalSavedBytes = 0;

  for (const file of imageFiles) {
    const filePath = path.join(PRODUCTS_DIR, file);
    const statsBefore = fs.statSync(filePath);
    const sizeBeforeKB = (statsBefore.size / 1024).toFixed(1);

    const tempPath = path.join(PRODUCTS_DIR, `temp-${file}.jpg`);

    try {
      await sharp(filePath)
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toFile(tempPath);

      const statsAfter = fs.statSync(tempPath);
      const sizeAfterKB = (statsAfter.size / 1024).toFixed(1);

      // استبدال الملف الأصلي بالملف المضغوط
      fs.unlinkSync(filePath);
      // إذا كان الامتداد غير .jpg نحوله إلى .jpg أو نحافظ على الاسم
      const targetPath = filePath.replace(/\.(png|webp|jpeg)$/i, '.jpg');
      fs.renameSync(tempPath, targetPath);

      const savedKB = (statsBefore.size - statsAfter.size) / 1024;
      totalSavedBytes += (statsBefore.size - statsAfter.size);

      console.log(`✔ [${++processedCount}/${imageFiles.length}] ${file}: ${sizeBeforeKB}KB ➔ ${sizeAfterKB}KB (وفر ${savedKB.toFixed(1)}KB)`);
    } catch (err) {
      console.error(`❌ خطأ في معالجة ${file}:`, err.message);
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }

  const totalSavedMB = (totalSavedBytes / (1024 * 1024)).toFixed(2);
  console.log(`\n🎉 اكتمل الضغط بنجاح! تم توفير ${totalSavedMB} ميجابايت من الحجم الإجمالي.`);
}

compressAll().catch(err => {
  console.error('حدث خطأ عام:', err);
});
