/**
 * www/js/cart.js
 * إدارة سلة المشتريات وإتمام الطلب عبر واتساب
 * يخزن السلة في localStorage ويولد رسائل طلب مفصلة ومنسقة بالعربية
 */

const CART_STORAGE_KEY = 'MD_CARPETS_CART_V1';

class CartManager {
  constructor() {
    this.items = this.loadCart();
    this.listeners = [];
  }

  loadCart() {
    try {
      const data = localStorage.getItem(CART_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('فشل في قراءة السلة من التخزين المحلي:', e);
      return [];
    }
  }

  saveCart() {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(this.items));
      this.notifyListeners();
    } catch (e) {
      console.error('فشل في حفظ السلة:', e);
    }
  }

  subscribe(callback) {
    this.listeners.push(callback);
    callback(this.items);
  }

  notifyListeners() {
    this.listeners.forEach(cb => {
      try { cb(this.items); } catch(err) { console.error(err); }
    });
    this.updateBadge();
  }

  updateBadge() {
    const totalCount = this.getTotalCount();
    const badges = document.querySelectorAll('.cart-count-badge');
    badges.forEach(b => {
      b.textContent = totalCount;
      b.style.display = totalCount > 0 ? 'inline-flex' : 'none';
    });
  }

  /**
   * إضافة منتج للسلة
   */
  addItem({ productId, title, category, size, color, price, image, quantity = 1 }) {
    const existingIndex = this.items.findIndex(
      item => item.productId === productId && item.size === size && item.color === color
    );

    if (existingIndex > -1) {
      this.items[existingIndex].quantity += quantity;
    } else {
      this.items.push({
        id: `${productId}-${size}-${color}-${Date.now()}`,
        productId,
        title,
        category,
        size,
        color,
        price,
        image,
        quantity
      });
    }

    this.saveCart();
  }

  updateQuantity(itemId, newQty) {
    const item = this.items.find(i => i.id === itemId);
    if (!item) return;

    if (newQty <= 0) {
      this.removeItem(itemId);
    } else {
      item.quantity = newQty;
      this.saveCart();
    }
  }

  removeItem(itemId) {
    this.items = this.items.filter(i => i.id !== itemId);
    this.saveCart();
  }

  clearCart() {
    this.items = [];
    this.saveCart();
  }

  getTotalCount() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  getTotalPrice() {
    return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  /**
   * التحقق من صحة رقم الموبايل المصري
   * 11 رقم يبدأ بـ 010 أو 011 أو 012 أو 015
   */
  static validateEgyptianPhone(phone) {
    const cleaned = String(phone).trim().replace(/[\s\-\+]/g, '');
    const egRegex = /^(010|011|012|015)[0-9]{8}$/;
    return egRegex.test(cleaned);
  }

  /**
   * توليد رسالة طلب الواتساب المنسقة
   */
  generateWhatsAppOrderMessage({ name, phone, governorate, address, notes }) {
    const totalCount = this.getTotalCount();
    const totalPrice = this.getTotalPrice();

    let itemsListText = '';
    this.items.forEach((item, idx) => {
      const lineTotal = item.price * item.quantity;
      itemsListText += `\n${idx + 1}️⃣ *${item.title}*\n   المقاس: ${item.size}\n   اللون: ${item.color || 'حسب الصورة'}\n   الكمية: ${item.quantity}\n   السعر: ${window.MD_CONFIG.formatPrice(lineTotal)}\n`;
    });

    const message = 
`السلام عليكم ورحمة الله وبركاته،
أرغب في تأكيد طلب شراء سجاد من متجر *${window.MD_CONFIG.STORE_NAME}*:

👤 *بيانات العميل:*
• الاسم: ${name}
• الهاتف: ${phone}
• المحافظة: ${governorate}
• العنوان بالتفصيل: ${address}
${notes ? `• ملاحظات التوصيل: ${notes}\n` : ''}
📦 *تفاصيل المنتجات المطلوبة (${totalCount} قطع):*
${itemsListText}
💰 *الإجمالي المستحق:* ${window.MD_CONFIG.formatPrice(totalPrice)}
💵 *طريقة الدفع:* الدفع عند الاستلام بعد المعاينة

برجاء تأكيد الطلب وتحديد موعد الشحن. شكراً لكم!`;

    return message;
  }
}

// تصدير مدير السلة في النطاق العام
window.cartManager = new CartManager();
