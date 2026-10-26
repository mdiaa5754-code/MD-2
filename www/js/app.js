/**
 * www/js/app.js
 * المحرك الرئيسي لتطبيق ومتجر MD سجاد - محمد ضياء
 * يدعم التوجيه عبر الهاش (#/home, #/catalog, #/product/:id, #/cart, #/wholesale, #/info, #/contact, #/admin)
 * وتحميل المنتجات بـ Pagination (24 منتج)، وفلاتر سريعة مع Debounce، ومعالجة الصور البديلة.
 */

(function () {
  'use strict';

  // حالة التطبيق العامة
  const state = {
    currentRoute: 'home',
    currentProductId: null,
    products: [],
    filteredProducts: [],
    catalogPage: 1,
    pageSize: 24,
    searchQuery: '',
    selectedCategory: 'all',
    selectedSort: 'newest',
    selectedPriceRange: 'all',
    searchDebounceTimer: null,
    productDetailSelectedSize: null,
    productDetailSelectedColor: null,
    productDetailQty: 1
  };

  /**
   * تهيئة بيانات المنتجات مع تطبيق التعديلات المخزنة محلياً
   */
  function initProductsData() {
    const rawProducts = window.MD_PRODUCTS || [];
    const localOverrides = (window.adminManager && window.adminManager.overrides) || window.MD_OVERRIDES || {};

    state.products = rawProducts.map(p => {
      const override = localOverrides[p.id] || {};
      return {
        ...p,
        ...override,
        sizes: override.sizes || p.sizes,
        price: typeof override.price === 'number' ? override.price : p.price,
        salePrice: typeof override.salePrice === 'number' ? override.salePrice : p.salePrice,
        limited: typeof override.limited === 'boolean' ? override.limited : p.limited,
        outOfStock: typeof override.outOfStock === 'boolean' ? override.outOfStock : p.outOfStock,
        featured: typeof override.featured === 'boolean' ? override.featured : p.featured
      };
    });

    state.filteredProducts = [...state.products];
  }

  /**
   * إشعار عائم Toast
   */
  function showToast(message, icon = '✔') {
    const existing = document.querySelector('.toast-notice');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-notice';
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translate(-50%, -20px)';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  /**
   * معالجة خطأ تحميل الصور وتقديم صورة بديلة أنيقة
   */
  window.handleImgError = function (imgEl, productName) {
    if (!imgEl || imgEl.dataset.fallbackDone) return;
    imgEl.dataset.fallbackDone = 'true';
    const parent = imgEl.parentElement;
    if (parent) {
      imgEl.style.display = 'none';
      const placeholder = document.createElement('div');
      placeholder.className = 'image-placeholder';
      placeholder.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="3" y1="9" x2="21" y2="9"></line>
          <line x1="3" y1="15" x2="21" y2="15"></line>
          <line x1="9" y1="3" x2="9" y2="21"></line>
          <line x1="15" y1="3" x2="15" y2="21"></line>
        </svg>
        <span>MD سجاد</span>
        <small style="font-size:0.68rem;opacity:0.8">${productName || 'سجادة فاخرة'}</small>
      `;
      parent.appendChild(placeholder);
    }
  };

  /**
   * إنشاء كارت المنتج في القوائم
   */
  function renderProductCard(product) {
    const mainImg = window.MD_CONFIG.getProductImageUrl(product.mainImage || (product.images && product.images[0]));
    const hasDiscount = typeof product.salePrice === 'number' && product.salePrice < product.price;
    const discountPercent = hasDiscount ? Math.round(((product.price - product.salePrice) / product.price) * 100) : 0;
    const displayPrice = hasDiscount ? product.salePrice : product.price;

    return `
      <article class="product-card" data-id="${product.id}">
        <div class="product-thumb-wrap" onclick="location.hash='#/product/${product.id}'" style="cursor:pointer;">
          <img 
            src="${mainImg}" 
            alt="${product.title}" 
            class="product-thumb" 
            loading="lazy" 
            onerror="window.handleImgError(this, '${product.title.replace(/'/g, "\\'")}')"
          />
          <div class="badge-stack">
            ${product.outOfStock ? '<span class="badge badge-out">غير متاح</span>' : ''}
            ${!product.outOfStock && hasDiscount ? `<span class="badge badge-discount">خصم ${discountPercent}%</span>` : ''}
            ${!product.outOfStock && product.limited ? '<span class="badge badge-limited">كمية محدودة</span>' : ''}
          </div>
        </div>

        <div class="product-details">
          <span class="product-category-tag">${product.categoryNameAr || 'سجاد مودرن'}</span>
          <h3 class="product-title" onclick="location.hash='#/product/${product.id}'" style="cursor:pointer;" title="${product.title}">
            ${product.title}
          </h3>

          <div class="product-price-row">
            <span class="current-price">${window.MD_CONFIG.formatPrice(displayPrice)}</span>
            ${hasDiscount ? `<span class="old-price">${window.MD_CONFIG.formatPrice(product.price)}</span>` : ''}
          </div>

          <div class="product-card-actions">
            <button 
              class="btn btn-primary btn-sm" 
              onclick="window.quickAddToCart('${product.id}')"
              ${product.outOfStock ? 'disabled style="opacity:0.6;cursor:not-allowed;"' : ''}
            >
              🛒 أضف
            </button>
            <button 
              class="btn btn-whatsapp btn-sm" 
              onclick="window.directWhatsAppProduct('${product.id}')"
              title="طلب مباشر عبر واتساب"
            >
              واتساب
            </button>
          </div>
        </div>
      </article>
    `;
  }

  /**
   * إضافة سريعة للسلة من الكارت
   */
  window.quickAddToCart = function (productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product || product.outOfStock) return;

    const defaultSize = (product.sizes && product.sizes[0] && product.sizes[0].size) || '160x230';
    const hasDiscount = typeof product.salePrice === 'number' && product.salePrice < product.price;
    const price = hasDiscount ? product.salePrice : ((product.sizes && product.sizes[0] && product.sizes[0].price) || product.price);
    const color = (product.colors && product.colors[0]) || 'حسب الصورة';

    window.cartManager.addItem({
      productId: product.id,
      title: product.title,
      category: product.category,
      size: defaultSize,
      color: color,
      price: price,
      image: window.MD_CONFIG.getProductImageUrl(product.mainImage || (product.images && product.images[0])),
      quantity: 1
    });

    showToast(`تمت إضافة "${product.title}" إلى السلة بنجاح!`);
  };

  /**
   * طلب منتج محدد مباشرة عبر واتساب
   */
  window.directWhatsAppProduct = function (productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    const hasDiscount = typeof product.salePrice === 'number' && product.salePrice < product.price;
    const price = hasDiscount ? product.salePrice : product.price;
    const defaultSize = (product.sizes && product.sizes[0] && product.sizes[0].size) || '160x230';

    const msg = 
`السلام عليكم، أنا مهتم بسجادة:
*${product.title}* (موديل: ${product.modelNumber || product.id})
المقاس المطلوب: ${defaultSize}
السعر: ${window.MD_CONFIG.formatPrice(price)}

هل هي متاحة حالياً للتوصيل والدفع عند الاستلام؟`;

    const url = window.MD_CONFIG.createWhatsAppUrl(msg);
    window.MD_CONFIG.openExternalLink(url);
  };

  /**
   * توجيه وملاحة الراوتر
   */
  function handleRoute() {
    const hash = window.location.hash || '#/home';
    const parts = hash.replace(/^#\/?/, '').split('/');
    const rootRoute = parts[0] || 'home';
    const param = parts[1] || null;

    state.currentRoute = rootRoute;
    state.currentProductId = param;

    // تحديث شريط التنقل السفلي
    document.querySelectorAll('.nav-item').forEach(el => {
      const routeAttr = el.getAttribute('data-route');
      if (routeAttr === rootRoute) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // التمرير لأعلى الصفحة
    window.scrollTo({ top: 0, behavior: 'instant' });

    // تحميل الشاشة المناسبة
    const mainView = document.getElementById('main-app-view');
    if (!mainView) return;

    switch (rootRoute) {
      case 'home':
        renderHomeScreen(mainView);
        updateSEO('MD سجاد | سجاد بأفضل سعر وتوصيل لحد باب بيتك', 'تصفح أحدث كولكشن سجاد مودرن وكلاسيك وأطفال وموكيت في مصر من متجر MD سجاد للمالك محمد ضياء.');
        break;
      case 'catalog':
        renderCatalogScreen(mainView);
        updateSEO('كتالوج وموديلات السجاد | MD سجاد', 'تشكيلة متكاملة من سجاد المودرن والكلاسيك بجميع المقاسات والأسعار التنافسية والدفع عند الاستلام.');
        break;
      case 'product':
        renderProductDetailScreen(mainView, param);
        break;
      case 'cart':
        renderCartScreen(mainView);
        updateSEO('سلة المشتريات | MD سجاد', 'راجع طلباتك وأتمم طلب الشراء بسهولة عبر واتساب بالدفع عند الاستلام.');
        break;
      case 'wholesale':
        renderWholesaleScreen(mainView);
        updateSEO('أسعار سجاد الجملة للتجار | MD سجاد', 'عروض وخصومات حصرية لأصحاب المعارض وتجار السجاد في جميع محافظات مصر.');
        break;
      case 'info':
        renderInfoScreen(mainView);
        updateSEO('معلومات الطلب والتوصيل والضمان | MD سجاد', 'تعرف على مدة الشحن لجميع المحافظات وسياسة المعاينة والاستبدال.');
        break;
      case 'contact':
        renderContactScreen(mainView);
        updateSEO('تواصل معنا | MD سجاد', 'تواصل مع محمد ضياء مباشرة عبر واتساب أو الهاتف لطلب السجاد والاستفسارات.');
        break;
      case 'admin':
        renderAdminScreen(mainView);
        updateSEO('لوحة الإدارة | MD سجاد', 'لوحة تحكم لإدارة المنتجات والأسعار وتصدير التعديلات.');
        break;
      default:
        renderHomeScreen(mainView);
        break;
    }
  }

  function updateSEO(title, description) {
    document.title = title;
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = description;
  }

  // ==========================================
  // شاشة الرئيسية HOME
  // ==========================================
  function renderHomeScreen(container) {
    const featuredList = state.products.filter(p => p.featured).slice(0, 8);
    const modernSample = state.products.filter(p => p.category === 'modern').slice(0, 4);

    container.innerHTML = `
      <section class="hero-banner">
        <div class="hero-content">
          <span class="hero-tag">✨ تشكيلة 2026 الحصرية</span>
          <h2 class="hero-title">سجاد بأفضل سعر..<br>وتوصيل لحد باب بيتك</h2>
          <p class="hero-subtitle">
            معاينة مجانية عند الاستلام، خامات فائقة الجودة تدوم لسنوات، وتوصيل فوري لجميع محافظات مصر.
          </p>
          <div class="hero-actions">
            <a href="#/catalog" class="btn btn-gold">
              🛍️ تصفح المتجر الآن
            </a>
            <button class="btn btn-whatsapp" onclick="window.MD_CONFIG.openExternalLink(window.MD_CONFIG.createWhatsAppUrl('السلام عليكم، محتاج أستفسر عن تشكيلة السجاد المتاحة لديكم'))">
              💬 دردش عبر واتساب
            </button>
          </div>
        </div>
      </section>

      <!-- ميزات وضمانات الثقة -->
      <section class="trust-badges-bar">
        <div class="trust-badge-item">
          <div class="trust-badge-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          </div>
          <span class="trust-badge-title">توصيل لكل المحافظات</span>
          <span class="trust-badge-desc">من 2 إلى 5 أيام عمل</span>
        </div>
        <div class="trust-badge-item">
          <div class="trust-badge-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 15h0M2 10h20"/></svg>
          </div>
          <span class="trust-badge-title">الدفع عند الاستلام</span>
          <span class="trust-badge-desc">عاّين وافحص براحتك</span>
        </div>
        <div class="trust-badge-item">
          <div class="trust-badge-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <span class="trust-badge-title">ضمان الجودة والمتانة</span>
          <span class="trust-badge-desc">ألوان ثابتة وخامات فاخرة</span>
        </div>
      </section>

      <!-- شريط تصنيفات السجاد السريع -->
      <div class="section-header">
        <h2 class="section-title">أقسام السجاد</h2>
        <a href="#/catalog" style="font-size:0.85rem;color:var(--color-primary);font-weight:700;">عرض الكل ←</a>
      </div>
      <div class="categories-carousel">
        <a href="#/catalog?cat=modern" class="category-chip">✨ سجاد مودرن</a>
        <a href="#/catalog?cat=classic" class="category-chip">🏛️ كلاسيك ملوكي</a>
        <a href="#/catalog?cat=kids" class="category-chip">🧸 سجاد أطفال</a>
        <a href="#/catalog?cat=kitchen" class="category-chip">🍳 مطبخ وممرات</a>
        <a href="#/catalog?cat=prayer" class="category-chip">🕌 سجاد صلاة ومساجد</a>
        <a href="#/catalog?cat=moquette" class="category-chip">📐 موكيت ورولات</a>
      </div>

      <!-- موديلات مميزة ومختارة -->
      <div class="section-header" style="margin-top:20px;">
        <h2 class="section-title">الموديلات الأكثر طلباً 🔥</h2>
        <a href="#/catalog" style="font-size:0.85rem;color:var(--color-primary);font-weight:700;">المزيد ←</a>
      </div>
      <div class="products-grid">
        ${featuredList.map(renderProductCard).join('')}
      </div>

      <!-- لافتة مخصصة للتجار -->
      <section class="wholesale-callout-card">
        <div>
          <span style="background-color:var(--color-gold);color:#2C1810;font-size:0.75rem;font-weight:800;padding:2px 8px;border-radius:4px;">فرصة تجارية</span>
          <h3 style="margin-top:6px;">لتجار الجملة وأصحاب معارض السجاد في مصر</h3>
          <p style="font-size:0.9rem;color:var(--color-text-muted);margin-top:4px;">
            نوفر لكم خصومات حصرية تبدأ من 20 قطعة مع أسعار تجارية خاصة وشحن مباشر للمحل أو المخزن في جميع المحافظات.
          </p>
        </div>
        <a href="#/wholesale" class="btn btn-outline" style="width:fit-content;">
          اطّلع على شرائح أسعار التجار ←
        </a>
      </section>

      <!-- قسم سجاد مودرن -->
      <div class="section-header" style="margin-top:10px;">
        <h2 class="section-title">سجاد مودرن حديث</h2>
        <a href="#/catalog?cat=modern" style="font-size:0.85rem;color:var(--color-primary);font-weight:700;">مشاهدة الكل ←</a>
      </div>
      <div class="products-grid">
        ${modernSample.map(renderProductCard).join('')}
      </div>
    `;
  }

  // ==========================================
  // شاشة المتجر والبحث والفلترة CATALOG
  // ==========================================
  function renderCatalogScreen(container) {
    // قراءة الفلتر من معلمات الرابط إن وجدت
    const hash = window.location.hash;
    const catMatch = hash.match(/[\?&]cat=([a-zA-Z]+)/);
    if (catMatch && catMatch[1]) {
      state.selectedCategory = catMatch[1];
    }

    container.innerHTML = `
      <div class="section-header" style="margin-top:10px;">
        <h2 class="section-title">متجر السجاد</h2>
        <span id="catalog-count-label" style="font-size:0.85rem;color:var(--color-text-muted);font-weight:700;"></span>
      </div>

      <!-- صندوق البحث والتحكم -->
      <div class="catalog-controls">
        <div class="search-box-wrap">
          <input 
            type="text" 
            id="catalog-search-input" 
            class="search-input" 
            placeholder="ابحث بالاسم، رقم الموديل، الفئة (مثال: موديل 001، مودرن، أطفال)..." 
            value="${state.searchQuery}"
          />
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>

        <div class="filter-bar">
          <select id="filter-category-select" class="filter-select">
            <option value="all" ${state.selectedCategory === 'all' ? 'selected' : ''}>جميع الأقسام</option>
            <option value="modern" ${state.selectedCategory === 'modern' ? 'selected' : ''}>مودرن</option>
            <option value="classic" ${state.selectedCategory === 'classic' ? 'selected' : ''}>كلاسيك</option>
            <option value="kids" ${state.selectedCategory === 'kids' ? 'selected' : ''}>أطفال</option>
            <option value="kitchen" ${state.selectedCategory === 'kitchen' ? 'selected' : ''}>مطبخ وممرات</option>
            <option value="prayer" ${state.selectedCategory === 'prayer' ? 'selected' : ''}>سجاد صلاة</option>
            <option value="moquette" ${state.selectedCategory === 'moquette' ? 'selected' : ''}>موكيت</option>
          </select>

          <select id="filter-sort-select" class="filter-select">
            <option value="newest" ${state.selectedSort === 'newest' ? 'selected' : ''}>الأحدث أولاً</option>
            <option value="price-asc" ${state.selectedSort === 'price-asc' ? 'selected' : ''}>السعر: الأقل للأعلى</option>
            <option value="price-desc" ${state.selectedSort === 'price-desc' ? 'selected' : ''}>السعر: الأعلى للأقل</option>
          </select>

          <select id="filter-price-select" class="filter-select">
            <option value="all" ${state.selectedPriceRange === 'all' ? 'selected' : ''}>كل الأسعار</option>
            <option value="under-1000" ${state.selectedPriceRange === 'under-1000' ? 'selected' : ''}>أقل من 1000 ج.م</option>
            <option value="1000-2000" ${state.selectedPriceRange === '1000-2000' ? 'selected' : ''}>1000 - 2000 ج.م</option>
            <option value="above-2000" ${state.selectedPriceRange === 'above-2000' ? 'selected' : ''}>أكثر من 2000 ج.م</option>
          </select>
        </div>
      </div>

      <!-- وسم الفلاتر النشطة -->
      <div id="active-filters-container" class="active-filters-tags"></div>

      <!-- شبكة المنتجات -->
      <div id="catalog-products-grid" class="products-grid"></div>

      <!-- زر تحميل المزيد -->
      <div id="catalog-load-more" class="load-more-wrap" style="display:none;">
        <button id="btn-load-more" class="btn btn-outline" style="min-width:180px;">
          عرض المزيد من المنتجات ↓
        </button>
      </div>
    `;

    // ربط الأحداث
    const searchInput = document.getElementById('catalog-search-input');
    searchInput.addEventListener('input', (e) => {
      clearTimeout(state.searchDebounceTimer);
      state.searchDebounceTimer = setTimeout(() => {
        state.searchQuery = e.target.value.trim();
        state.catalogPage = 1;
        applyFiltersAndRenderCatalog();
      }, 250);
    });

    document.getElementById('filter-category-select').addEventListener('change', (e) => {
      state.selectedCategory = e.target.value;
      state.catalogPage = 1;
      applyFiltersAndRenderCatalog();
    });

    document.getElementById('filter-sort-select').addEventListener('change', (e) => {
      state.selectedSort = e.target.value;
      state.catalogPage = 1;
      applyFiltersAndRenderCatalog();
    });

    document.getElementById('filter-price-select').addEventListener('change', (e) => {
      state.selectedPriceRange = e.target.value;
      state.catalogPage = 1;
      applyFiltersAndRenderCatalog();
    });

    document.getElementById('btn-load-more').addEventListener('click', () => {
      state.catalogPage++;
      renderCatalogGrid(true);
    });

    applyFiltersAndRenderCatalog();
  }

  function applyFiltersAndRenderCatalog() {
    let list = [...state.products];

    // فلترة البحث
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      list = list.filter(p => {
        return (
          p.title.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          (p.modelNumber && p.modelNumber.includes(q)) ||
          (p.categoryNameAr && p.categoryNameAr.includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q))
        );
      });
    }

    // فلترة الفئة
    if (state.selectedCategory !== 'all') {
      list = list.filter(p => p.category === state.selectedCategory);
    }

    // فلترة نطاق السعر
    if (state.selectedPriceRange !== 'all') {
      list = list.filter(p => {
        const price = (typeof p.salePrice === 'number' && p.salePrice < p.price) ? p.salePrice : p.price;
        if (state.selectedPriceRange === 'under-1000') return price < 1000;
        if (state.selectedPriceRange === '1000-2000') return price >= 1000 && price <= 2000;
        if (state.selectedPriceRange === 'above-2000') return price > 2000;
        return true;
      });
    }

    // الترتيب
    if (state.selectedSort === 'price-asc') {
      list.sort((a, b) => (a.salePrice || a.price) - (b.salePrice || b.price));
    } else if (state.selectedSort === 'price-desc') {
      list.sort((a, b) => (b.salePrice || b.price) - (a.salePrice || a.price));
    } else {
      // newest
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }

    state.filteredProducts = list;
    state.catalogPage = 1;

    renderActiveFilterBadges();
    renderCatalogGrid(false);
  }

  function renderActiveFilterBadges() {
    const badgeContainer = document.getElementById('active-filters-container');
    if (!badgeContainer) return;

    let html = '';
    if (state.selectedCategory !== 'all') {
      html += `<span class="active-filter-tag">القسم: ${state.selectedCategory} <button onclick="window.clearCatalogFilter('cat')">×</button></span>`;
    }
    if (state.searchQuery) {
      html += `<span class="active-filter-tag">بحث: "${state.searchQuery}" <button onclick="window.clearCatalogFilter('search')">×</button></span>`;
    }
    if (state.selectedPriceRange !== 'all') {
      html += `<span class="active-filter-tag">السعر: ${state.selectedPriceRange} <button onclick="window.clearCatalogFilter('price')">×</button></span>`;
    }

    if (html) {
      html += `<button class="btn btn-sm" style="font-size:0.75rem;padding:2px 8px;color:var(--color-danger);" onclick="window.clearCatalogFilter('all')">مسح الفلاتر</button>`;
    }

    badgeContainer.innerHTML = html;
  }

  window.clearCatalogFilter = function (type) {
    if (type === 'cat' || type === 'all') state.selectedCategory = 'all';
    if (type === 'search' || type === 'all') state.searchQuery = '';
    if (type === 'price' || type === 'all') state.selectedPriceRange = 'all';
    state.catalogPage = 1;

    const searchInput = document.getElementById('catalog-search-input');
    if (searchInput) searchInput.value = state.searchQuery;
    const catSelect = document.getElementById('filter-category-select');
    if (catSelect) catSelect.value = state.selectedCategory;
    const priceSelect = document.getElementById('filter-price-select');
    if (priceSelect) priceSelect.value = state.selectedPriceRange;

    applyFiltersAndRenderCatalog();
  };

  function renderCatalogGrid(append = false) {
    const grid = document.getElementById('catalog-products-grid');
    const countLabel = document.getElementById('catalog-count-label');
    const loadMoreBox = document.getElementById('catalog-load-more');
    if (!grid) return;

    const total = state.filteredProducts.length;
    if (countLabel) countLabel.textContent = `(${total} منتج)`;

    if (total === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
          <h3>لا توجد نتائج مطابقة لبحثك</h3>
          <p>جرب تغيير الكلمات المفتاحية أو إعادة ضبط الفلاتر لتصفح موديلات أخرى.</p>
          <button class="btn btn-primary btn-sm" onclick="window.clearCatalogFilter('all')">إعادة تعيين الفلاتر</button>
        </div>
      `;
      if (loadMoreBox) loadMoreBox.style.display = 'none';
      return;
    }

    const visibleItems = state.filteredProducts.slice(0, state.catalogPage * state.pageSize);
    const html = visibleItems.map(renderProductCard).join('');

    grid.innerHTML = html;

    if (loadMoreBox) {
      loadMoreBox.style.display = (visibleItems.length < total) ? 'block' : 'none';
    }
  }

  // ==========================================
  // شاشة تفاصيل المنتج PRODUCT DETAIL
  // ==========================================
  function renderProductDetailScreen(container, productId) {
    const product = state.products.find(p => p.id === productId);

    if (!product) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>عذراً، المنتج المطلوب غير موجود</h3>
          <p>ربما تم تغيير رقم الموديل أو حذفه من الكتالوج.</p>
          <a href="#/catalog" class="btn btn-primary">العودة للمتجر</a>
        </div>
      `;
      return;
    }

    updateSEO(`${product.title} | متجر MD سجاد`, product.description);

    const sizes = product.sizes && product.sizes.length > 0 ? product.sizes : [{ size: '160x230', price: product.price }];
    state.productDetailSelectedSize = state.productDetailSelectedSize || sizes[0].size;
    state.productDetailSelectedColor = state.productDetailSelectedColor || (product.colors && product.colors[0]) || 'حسب الصورة';
    state.productDetailQty = 1;

    // حساب السعر حسب المقاس المختار
    const currentSizeObj = sizes.find(s => s.size === state.productDetailSelectedSize) || sizes[0];
    const basePrice = currentSizeObj.price;
    const hasDiscount = typeof product.salePrice === 'number' && product.salePrice < product.price;
    const finalPrice = hasDiscount ? product.salePrice : basePrice;

    const galleryImages = (product.images && product.images.length > 0) ? product.images : [product.mainImage];

    container.innerHTML = `
      <div style="margin-bottom:12px;">
        <a href="#/catalog" style="font-size:0.85rem;color:var(--color-primary);font-weight:700;">
          ← رجوع لكتالوج السجاد
        </a>
      </div>

      <div class="product-page-layout">
        <!-- معرض الصور -->
        <div class="gallery-container">
          <div class="main-gallery-image-wrap" id="main-gallery-wrap" onclick="window.openImageZoomModal('${window.MD_CONFIG.getProductImageUrl(galleryImages[0])}')">
            <img 
              id="main-detail-img" 
              src="${window.MD_CONFIG.getProductImageUrl(galleryImages[0])}" 
              alt="${product.title}" 
              class="main-gallery-image"
              onerror="window.handleImgError(this, '${product.title.replace(/'/g, "\\'")}')"
            />
            <div class="badge-stack">
              ${product.outOfStock ? '<span class="badge badge-out">غير متاح</span>' : ''}
              ${!product.outOfStock && hasDiscount ? '<span class="badge badge-discount">خصم خاص</span>' : ''}
              ${!product.outOfStock && product.limited ? '<span class="badge badge-limited">كمية محدودة</span>' : ''}
            </div>
            <span style="position:absolute;bottom:10px;left:10px;background:rgba(0,0,0,0.6);color:#fff;font-size:0.75rem;padding:3px 8px;border-radius:4px;">🔍 اضغط للتكبير</span>
          </div>

          ${galleryImages.length > 1 ? `
            <div class="gallery-thumbs-row">
              ${galleryImages.map((img, idx) => `
                <button 
                  class="gallery-thumb-btn ${idx === 0 ? 'active' : ''}" 
                  onclick="window.switchDetailGalleryImage('${window.MD_CONFIG.getProductImageUrl(img)}', this)"
                >
                  <img src="${window.MD_CONFIG.getProductImageUrl(img)}" alt="زاوية ${idx + 1}" />
                </button>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <!-- معلومات وخيارات المنتج -->
        <div class="product-info-panel">
          <div>
            <span class="product-category-tag">${product.categoryNameAr || 'سجاد مودرن'}</span>
            <h1 class="product-detail-title">${product.title}</h1>
            <p style="font-size:0.8rem;color:var(--color-text-muted);margin-top:2px;">كود الموديل: ${product.id}</p>
          </div>

          <div class="product-detail-price">
            <span class="current" id="detail-current-price">${window.MD_CONFIG.formatPrice(finalPrice)}</span>
            ${hasDiscount ? `<span class="old-price">${window.MD_CONFIG.formatPrice(basePrice)}</span>` : ''}
            <span style="font-size:0.78rem;color:var(--color-success);font-weight:700;margin-right:auto;">الدفع عند الاستلام</span>
          </div>

          <!-- اختيار المقاس -->
          <div>
            <h4 class="option-group-title">اختر المقاس المطلوب:</h4>
            <div class="sizes-grid">
              ${sizes.map(s => `
                <button 
                  class="size-pill ${s.size === state.productDetailSelectedSize ? 'selected' : ''}" 
                  onclick="window.selectDetailSize('${s.size}', ${s.price})"
                >
                  ${s.size}
                  <span class="size-price">${window.MD_CONFIG.formatPrice(s.price)}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- اختيار اللون إن وجد -->
          ${product.colors && product.colors.length > 0 ? `
            <div>
              <h4 class="option-group-title">اللون:</h4>
              <div class="colors-grid">
                ${product.colors.map(c => `
                  <button 
                    class="color-chip ${c === state.productDetailSelectedColor ? 'selected' : ''}" 
                    onclick="window.selectDetailColor('${c}', this)"
                  >
                    ${c}
                  </button>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- التحكم بالكمية -->
          <div>
            <h4 class="option-group-title">الكمية:</h4>
            <div class="quantity-control">
              <button class="qty-btn" onclick="window.changeDetailQty(-1)">−</button>
              <span class="qty-value" id="detail-qty-value">${state.productDetailQty}</span>
              <button class="qty-btn" onclick="window.changeDetailQty(1)">+</button>
            </div>
          </div>

          <!-- أزرار الإجراءات الرئيسية -->
          <div style="display:flex;flex-direction:column;gap:10px;margin-top:8px;">
            <button 
              class="btn btn-whatsapp btn-block" 
              onclick="window.orderCurrentProductViaWhatsApp('${product.id}')"
              ${product.outOfStock ? 'disabled style="opacity:0.6;cursor:not-allowed;"' : ''}
            >
              💬 اطلب الآن على واتساب مباشرة
            </button>
            <div style="display:flex;gap:10px;">
              <button 
                class="btn btn-primary" 
                style="flex:2;" 
                onclick="window.addCurrentProductToCart('${product.id}')"
                ${product.outOfStock ? 'disabled style="opacity:0.6;cursor:not-allowed;"' : ''}
              >
                🛒 أضف إلى السلة
              </button>
              <button class="btn btn-outline" style="flex:1;" onclick="window.shareCurrentProduct('${product.id}')">
                🔗 مشاركة
              </button>
            </div>
          </div>

          <!-- تفاصيل ومواصفات السجاد -->
          <div style="background-color:var(--bg-surface);border:1px solid var(--color-gold-border);border-radius:var(--radius-md);padding:14px;margin-top:10px;">
            <h4 style="font-size:0.95rem;font-weight:800;color:var(--color-primary);margin-bottom:8px;">المواصفات والضمان:</h4>
            <p style="font-size:0.88rem;color:var(--color-text-main);line-height:1.6;margin-bottom:8px;">
              ${product.description}
            </p>
            <ul style="font-size:0.82rem;color:var(--color-text-muted);list-style:none;display:flex;flex-direction:column;gap:4px;">
              <li>✔ <strong>الخامة:</strong> ${product.material}</li>
              <li>✔ <strong>الصناعة:</strong> ${product.origin}</li>
              <li>✔ <strong>التنظيف:</strong> سهل الغسيل والتنظيف الجاف، ألوان ثابتة ضد البهتان</li>
              <li>✔ <strong>المعاينة:</strong> يحق لك فحص السجادة والتأكد من المقاس قبل دفع أي قرش</li>
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  window.switchDetailGalleryImage = function (url, btn) {
    const mainImg = document.getElementById('main-detail-img');
    if (mainImg) mainImg.src = url;
    document.querySelectorAll('.gallery-thumb-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
  };

  window.selectDetailSize = function (sizeName, sizePrice) {
    state.productDetailSelectedSize = sizeName;
    const product = state.products.find(p => p.id === state.currentProductId);
    const hasDiscount = product && typeof product.salePrice === 'number' && product.salePrice < product.price;
    const priceEl = document.getElementById('detail-current-price');
    if (priceEl) {
      priceEl.textContent = window.MD_CONFIG.formatPrice(hasDiscount ? product.salePrice : sizePrice);
    }
    document.querySelectorAll('.size-pill').forEach(el => {
      if (el.textContent.includes(sizeName)) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });
  };

  window.selectDetailColor = function (colorName, btn) {
    state.productDetailSelectedColor = colorName;
    document.querySelectorAll('.color-chip').forEach(c => c.classList.remove('selected'));
    if (btn) btn.classList.add('selected');
  };

  window.changeDetailQty = function (delta) {
    state.productDetailQty = Math.max(1, state.productDetailQty + delta);
    const qtyEl = document.getElementById('detail-qty-value');
    if (qtyEl) qtyEl.textContent = state.productDetailQty;
  };

  window.addCurrentProductToCart = function (productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product || product.outOfStock) return;

    const sizes = product.sizes && product.sizes.length > 0 ? product.sizes : [{ size: '160x230', price: product.price }];
    const sizeObj = sizes.find(s => s.size === state.productDetailSelectedSize) || sizes[0];
    const hasDiscount = typeof product.salePrice === 'number' && product.salePrice < product.price;
    const finalPrice = hasDiscount ? product.salePrice : sizeObj.price;

    window.cartManager.addItem({
      productId: product.id,
      title: product.title,
      category: product.category,
      size: state.productDetailSelectedSize,
      color: state.productDetailSelectedColor,
      price: finalPrice,
      image: window.MD_CONFIG.getProductImageUrl(product.mainImage || (product.images && product.images[0])),
      quantity: state.productDetailQty
    });

    showToast(`تمت إضافة ${state.productDetailQty} قطع إلى السلة بنجاح!`);
  };

  window.orderCurrentProductViaWhatsApp = function (productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    const sizes = product.sizes && product.sizes.length > 0 ? product.sizes : [{ size: '160x230', price: product.price }];
    const sizeObj = sizes.find(s => s.size === state.productDetailSelectedSize) || sizes[0];
    const hasDiscount = typeof product.salePrice === 'number' && product.salePrice < product.price;
    const unitPrice = hasDiscount ? product.salePrice : sizeObj.price;
    const totalLinePrice = unitPrice * state.productDetailQty;

    const message = 
`السلام عليكم ورحمة الله وبركاته،
أرغب في طلب هذه السجادة من متجر *${window.MD_CONFIG.STORE_NAME}*:

🛋️ *المنتج:* ${product.title}
🏷️ *كود الموديل:* ${product.id}
📐 *المقاس:* ${state.productDetailSelectedSize}
🎨 *اللون المطلوب:* ${state.productDetailSelectedColor || 'حسب الصورة'}
🔢 *الكمية:* ${state.productDetailQty}
💰 *الإجمالي:* ${window.MD_CONFIG.formatPrice(totalLinePrice)}

برجاء تأكيد التوفر وإرسال تفاصيل الشحن. شكراً لكم!`;

    const url = window.MD_CONFIG.createWhatsAppUrl(message);
    window.MD_CONFIG.openExternalLink(url);
  };

  window.shareCurrentProduct = function (productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    const shareData = {
      title: product.title,
      text: `${product.title} من متجر MD سجاد بسعر يبدأ من ${window.MD_CONFIG.formatPrice(product.price)}`,
      url: window.location.href
    };

    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href).then(() => {
        showToast('تم نسخ رابط السجادة بنجاح!');
      }).catch(() => {
        alert('رابط السجادة: ' + window.location.href);
      });
    }
  };

  window.openImageZoomModal = function (imgUrl) {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
    modal.innerHTML = `
      <div class="modal-card" style="padding:10px;text-align:center;">
        <button class="modal-close-btn" onclick="this.closest('.modal-backdrop').remove()">✕</button>
        <img src="${imgUrl}" style="max-height:80vh;width:auto;margin:0 auto;border-radius:var(--radius-md);" />
      </div>
    `;
    document.body.appendChild(modal);
  };

  // ==========================================
  // شاشة السلة وإتمام الطلب CART
  // ==========================================
  function renderCartScreen(container) {
    const items = window.cartManager.items;
    const totalCount = window.cartManager.getTotalCount();
    const totalPrice = window.cartManager.getTotalPrice();

    if (items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
          <h3>سلة المشتريات فارغة حالياً</h3>
          <p>تصفح كتالوج السجاد وأضف السجاد والمقاسات التي تعجبك للسلة.</p>
          <a href="#/catalog" class="btn btn-primary">تصفح المتجر الآن</a>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="section-header" style="margin-top:10px;">
        <h2 class="section-title">سلة المشتريات (${totalCount} قطع)</h2>
        <button class="btn btn-sm" style="color:var(--color-danger);" onclick="window.clearUserCart()">
          تفريغ السلة 🗑️
        </button>
      </div>

      <!-- قائمة عناصر السلة -->
      <div class="cart-items-list">
        ${items.map(item => `
          <div class="cart-item-card">
            <img 
              src="${item.image}" 
              alt="${item.title}" 
              class="cart-item-img"
              onerror="window.handleImgError(this, '${item.title.replace(/'/g, "\\'")}')"
            />
            <div class="cart-item-info">
              <h4 class="cart-item-title">${item.title}</h4>
              <div class="cart-item-meta">
                المقاس: <strong>${item.size}</strong> | اللون: <strong>${item.color || 'حسب الصورة'}</strong>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <span class="cart-item-price">${window.MD_CONFIG.formatPrice(item.price * item.quantity)}</span>
                <div class="quantity-control" style="transform:scale(0.85);transform-origin:left center;">
                  <button class="qty-btn" onclick="window.updateCartItemQty('${item.id}', ${item.quantity - 1})">−</button>
                  <span class="qty-value">${item.quantity}</span>
                  <button class="qty-btn" onclick="window.updateCartItemQty('${item.id}', ${item.quantity + 1})">+</button>
                </div>
              </div>
            </div>
            <button class="cart-item-remove-btn" onclick="window.removeCartItem('${item.id}')" title="حذف">
              ✕
            </button>
          </div>
        `).join('')}
      </div>

      <!-- نموذج إتمام الطلب عبر واتساب -->
      <div class="checkout-card">
        <h3 style="font-size:1.15rem;font-weight:800;color:var(--color-primary);margin-bottom:14px;">
          إتمام الطلب (الدفع عند الاستلام)
        </h3>

        <div style="background-color:var(--bg-surface-soft);padding:12px;border-radius:var(--radius-md);margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;font-weight:800;font-size:1.1rem;color:var(--color-primary);">
            <span>إجمالي السجاد:</span>
            <span>${window.MD_CONFIG.formatPrice(totalPrice)}</span>
          </div>
          <small style="color:var(--color-text-muted);display:block;margin-top:4px;">
            * مصاريف الشحن تحدد حسب المحافظة وتضاف عند التأكيد على واتساب (معاينة قبل الدفع).
          </small>
        </div>

        <form id="checkout-form" onsubmit="window.handleCheckoutSubmit(event)">
          <div class="form-group">
            <label class="form-label">الاسم بالكامل *</label>
            <input type="text" id="order-name" class="form-control" placeholder="اكتب اسمك الثلاثي" required />
          </div>

          <div class="form-group">
            <label class="form-label">رقم الموبايل (واتساب) *</label>
            <input 
              type="tel" 
              id="order-phone" 
              class="form-control" 
              placeholder="010 / 011 / 012 / 015xxxxxxxx" 
              maxlength="11" 
              required 
            />
            <small id="phone-error-hint" style="color:var(--color-danger);font-size:0.75rem;display:none;">
              برجاء إدخال رقم موبايل مصري صحيح مكون من 11 رقماً
            </small>
          </div>

          <div class="form-group">
            <label class="form-label">المحافظة *</label>
            <select id="order-governorate" class="form-control" required>
              <option value="" disabled selected>اختر محافظتك من القائمة (27 محافظة)</option>
              ${window.MD_CONFIG.EGYPT_GOVERNORATES.map(gov => `
                <option value="${gov}">${gov}</option>
              `).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">العنوان بالتفصيل *</label>
            <input type="text" id="order-address" class="form-control" placeholder="المدينة، اسم الشارع، رقم العمارة أو علامة مميزة" required />
          </div>

          <div class="form-group">
            <label class="form-label">ملاحظات التوصيل (اختياري)</label>
            <textarea id="order-notes" class="form-control" placeholder="أي تفاصيل إضافية عن موعد التواجد أو المقاسات..."></textarea>
          </div>

          <button type="submit" class="btn btn-whatsapp btn-block" style="font-size:1.05rem;padding:14px;">
            💬 إرسال الطلب والتأكيد عبر واتساب
          </button>
        </form>
      </div>
    `;
  }

  window.updateCartItemQty = function (itemId, qty) {
    window.cartManager.updateQuantity(itemId, qty);
    renderCartScreen(document.getElementById('main-app-view'));
  };

  window.removeCartItem = function (itemId) {
    window.cartManager.removeItem(itemId);
    renderCartScreen(document.getElementById('main-app-view'));
    showToast('تم حذف العنصر من السلة');
  };

  window.clearUserCart = function () {
    if (confirm('هل أنت متأكد من رغبتك في تفريغ السلة بالكامل؟')) {
      window.cartManager.clearCart();
      renderCartScreen(document.getElementById('main-app-view'));
      showToast('تم تفريغ السلة');
    }
  };

  window.handleCheckoutSubmit = function (e) {
    e.preventDefault();
    const name = document.getElementById('order-name').value.trim();
    const phone = document.getElementById('order-phone').value.trim();
    const gov = document.getElementById('order-governorate').value;
    const address = document.getElementById('order-address').value.trim();
    const notes = document.getElementById('order-notes').value.trim();

    if (!CartManager.validateEgyptianPhone(phone)) {
      const err = document.getElementById('phone-error-hint');
      if (err) err.style.display = 'block';
      document.getElementById('order-phone').focus();
      return;
    }

    const orderMsg = window.cartManager.generateWhatsAppOrderMessage({
      name,
      phone,
      governorate: gov,
      address,
      notes
    });

    const url = window.MD_CONFIG.createWhatsAppUrl(orderMsg);
    window.MD_CONFIG.openExternalLink(url);
  };

  // ==========================================
  // شاشة التجار الجملة WHOLESALE
  // ==========================================
  function renderWholesaleScreen(container) {
    container.innerHTML = `
      <div class="section-header" style="margin-top:10px;">
        <h2 class="section-title">عروض وطلبات تجار الجملة</h2>
      </div>

      <div style="background-color:var(--bg-surface);border:1px solid var(--color-gold-border);border-radius:var(--radius-lg);padding:20px;box-shadow:var(--shadow-sm);margin-bottom:20px;">
        <h3 style="font-size:1.15rem;color:var(--color-primary);font-weight:800;margin-bottom:8px;">
          شرائح أسعار وخصومات التجار (أقل طلب: ${window.MD_CONFIG.MIN_WHOLESALE_ORDER} قطعة)
        </h3>
        <p style="font-size:0.88rem;color:var(--color-text-muted);margin-bottom:14px;">
          نقدم لأصحاب محلات ومعارض السجاد في المحافظات أفضل سعر جملة مباشر مع مرونة في اختيار التشكيلات والمقاسات.
        </p>

        <table class="wholesale-tiers-table">
          <thead>
            <tr>
              <th>الشريحة</th>
              <th>الكمية</th>
              <th>نسبة الخصم التجاري</th>
            </tr>
          </thead>
          <tbody>
            ${window.MD_CONFIG.WHOLESALE_TIERS.map(tier => `
              <tr>
                <td><strong>${tier.label}</strong></td>
                <td>${tier.min} إلى ${tier.max > 1000 ? '+' : tier.max} قطعة</td>
                <td><span style="color:var(--color-success);font-weight:800;">خصم ${tier.discountPercent}%</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="display:grid;grid-template-columns:1fr;gap:10px;margin-top:14px;">
          <div style="display:flex;align-items:center;gap:8px;font-size:0.85rem;">
            <span>🚚</span> <span>شحن مباشر وسريع لباب المعرض أو المخزن في جميع المحافظات</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;font-size:0.85rem;">
            <span>📑</span> <span>إمكانية تشكيل المقاسات والألوان حسب طلب زبائنك</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;font-size:0.85rem;">
            <span>🤝</span> <span>تعامل مباشر مع المالك: <strong>${window.MD_CONFIG.OWNER}</strong></span>
          </div>
        </div>
      </div>

      <!-- نموذج طلب عرض سعر جملة -->
      <div class="checkout-card">
        <h3 style="font-size:1.1rem;font-weight:800;color:var(--color-primary);margin-bottom:12px;">
          طلب عرض أسعار جملة عبر واتساب
        </h3>
        <form onsubmit="window.handleWholesaleSubmit(event)">
          <div class="form-group">
            <label class="form-label">اسم التاجر / اسم المعرض *</label>
            <input type="text" id="ws-shop-name" class="form-control" placeholder="مثال: معرض النور للسجاد - أحمد محمود" required />
          </div>
          <div class="form-group">
            <label class="form-label">المحافظة والمدينة *</label>
            <select id="ws-gov" class="form-control" required>
              <option value="" disabled selected>اختر المحافظة</option>
              ${window.MD_CONFIG.EGYPT_GOVERNORATES.map(g => `<option value="${g}">${g}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">الكمية التقريبية المطلوبة *</label>
            <select id="ws-qty" class="form-control" required>
              <option value="20 إلى 49 قطعة">من 20 إلى 49 قطعة</option>
              <option value="50 إلى 99 قطعة">من 50 إلى 99 قطعة</option>
              <option value="100 قطعة فأكثر">100 قطعة فأكثر (أعلى خصم)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">الفئات المطلوبة وملاحظات</label>
            <textarea id="ws-notes" class="form-control" placeholder="مثال: محتاج مودرن وكلاسيك مقاسات 160x230 و 200x290..."></textarea>
          </div>
          <button type="submit" class="btn btn-whatsapp btn-block">
            💬 إرسال طلب عرض أسعار الجملة على واتساب
          </button>
        </form>
      </div>
    `;
  }

  window.handleWholesaleSubmit = function (e) {
    e.preventDefault();
    const shop = document.getElementById('ws-shop-name').value.trim();
    const gov = document.getElementById('ws-gov').value;
    const qty = document.getElementById('ws-qty').value;
    const notes = document.getElementById('ws-notes').value.trim();

    const msg = 
`السلام عليكم يا أستاذ ${window.MD_CONFIG.OWNER}،
أنا تاجر / صاحب معرض وأرغب في الاستفسار عن أسعار الجملة:

🏪 *المعرض / التاجر:* ${shop}
📍 *المحافظة:* ${gov}
📦 *الكمية التقريبية:* ${qty}
${notes ? `📝 *المطلوب:* ${notes}\n` : ''}
برجاء إرسال تفاصيل الأسعار المتاحة وكتالوج الجملة. شكراً!`;

    const url = window.MD_CONFIG.createWhatsAppUrl(msg);
    window.MD_CONFIG.openExternalLink(url);
  };

  // ==========================================
  // شاشة المعلومات والتوصيل INFO
  // ==========================================
  function renderInfoScreen(container) {
    container.innerHTML = `
      <div class="section-header" style="margin-top:10px;">
        <h2 class="section-title">معلومات الطلب والتوصيل والضمان</h2>
      </div>

      <div style="display:flex;flex-direction:column;gap:16px;">
        <div style="background-color:var(--bg-surface);border:1px solid var(--color-gold-border);border-radius:var(--radius-lg);padding:18px;box-shadow:var(--shadow-sm);">
          <h3 style="font-size:1.1rem;color:var(--color-primary);font-weight:800;margin-bottom:8px;">🚚 مواعيد الشحن لجميع المحافظات</h3>
          <ul style="font-size:0.9rem;color:var(--color-text-main);line-height:1.7;list-style:none;display:flex;flex-direction:column;gap:6px;">
            <li>🏙️ <strong>القاهرة والجيزة:</strong> ${window.MD_CONFIG.DELIVERY_INFO.cairo_giza}</li>
            <li>🌾 <strong>محافظات الدلتا والقناة والإسكندرية:</strong> ${window.MD_CONFIG.DELIVERY_INFO.delta_canal}</li>
            <li>⛰️ <strong>محافظات الصعيد والمناطق الحدودية:</strong> ${window.MD_CONFIG.DELIVERY_INFO.upper_egypt}</li>
          </ul>
        </div>

        <div style="background-color:var(--bg-surface);border:1px solid var(--color-gold-border);border-radius:var(--radius-lg);padding:18px;box-shadow:var(--shadow-sm);">
          <h3 style="font-size:1.1rem;color:var(--color-primary);font-weight:800;margin-bottom:8px;">🛡️ حق المعاينة وسياسة الاسترجاع</h3>
          <p style="font-size:0.9rem;color:var(--color-text-muted);line-height:1.6;margin-bottom:8px;">
            ${window.MD_CONFIG.DELIVERY_INFO.shippingNote}
          </p>
          <p style="font-size:0.9rem;color:var(--color-text-muted);line-height:1.6;">
            ${window.MD_CONFIG.DELIVERY_INFO.returnPolicy}
          </p>
        </div>

        <!-- أسئلة شائعة FAQ -->
        <div style="background-color:var(--bg-surface);border:1px solid var(--color-gold-border);border-radius:var(--radius-lg);padding:18px;box-shadow:var(--shadow-sm);">
          <h3 style="font-size:1.1rem;color:var(--color-primary);font-weight:800;margin-bottom:14px;">❓ الأسئلة الشائعة</h3>
          <div class="faq-accordion">
            <div class="faq-item" onclick="this.classList.toggle('open')">
              <div class="faq-header">
                <span>كيف تتم عملية الطلب؟</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
              </div>
              <div class="faq-body">
                تتصفح الموديلات في التطبيق، تختار المقاس واللون وتضغط "أضف للسلة" أو "اطلب على واتساب"، بعد ملء العنوان يتم توجيهك للمحادثة مع محمد ضياء لتأكيد طلبك مباشرة.
              </div>
            </div>

            <div class="faq-item" onclick="this.classList.toggle('open')">
              <div class="faq-header">
                <span>هل يلزم دفع أي مقدم أو تحويل بنكي؟</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
              </div>
              <div class="faq-body">
                لا نطلب أي دفع مسبق لطلبات القطاعي، الدفع نقداً عند الاستلام وبعد فتح الشحنة ومعاينتها والتأكد من مطابقتها للمواصفات.
              </div>
            </div>

            <div class="faq-item" onclick="this.classList.toggle('open')">
              <div class="faq-header">
                <span>ماذا لو لم يعجبني السجاد عند الاستلام؟</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
              </div>
              <div class="faq-body">
                يحق لك رفض الاستلام مع مندوب الشحن مباشرة إذا كان هناك أي اختلاف في المقاس أو اللون أو الخامة دون أي تعقيد.
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================
  // شاشة التواصل CONTACT
  // ==========================================
  function renderContactScreen(container) {
    container.innerHTML = `
      <div class="section-header" style="margin-top:10px;">
        <h2 class="section-title">تواصل معنا</h2>
      </div>

      <div style="background-color:var(--bg-surface);border:1px solid var(--color-gold-border);border-radius:var(--radius-lg);padding:24px 20px;text-align:center;box-shadow:var(--shadow-sm);margin-bottom:20px;">
        <img src="images/logo/logo.png" style="width:72px;height:72px;margin:0 auto 12px;border-radius:var(--radius-md);border:2px solid var(--color-gold);" />
        <h3 style="font-size:1.3rem;font-weight:900;color:var(--color-primary);margin-bottom:4px;">متجر ${window.MD_CONFIG.STORE_NAME} سجاد</h3>
        <p style="font-size:0.9rem;color:var(--color-text-muted);margin-bottom:16px;">
          إدارة: <strong>${window.MD_CONFIG.OWNER}</strong>
        </p>

        <div style="display:flex;flex-direction:column;gap:12px;max-width:400px;margin:0 auto;">
          <a href="https://wa.me/${window.MD_CONFIG.WHATSAPP_INTL}" class="btn btn-whatsapp" target="_blank">
            💬 محادثة واتساب (${window.MD_CONFIG.WHATSAPP_LOCAL})
          </a>
          <a href="tel:${window.MD_CONFIG.PHONE_CALL}" class="btn btn-primary">
            📞 اتصال هاتفي مباشر (${window.MD_CONFIG.PHONE_CALL})
          </a>
          <a href="${window.MD_CONFIG.FACEBOOK_URL}" class="btn btn-outline" target="_blank">
            🌐 صفحتنا على فيسبوك
          </a>
        </div>
      </div>

      <div style="background-color:var(--bg-surface);border:1px solid var(--color-gold-border);border-radius:var(--radius-md);padding:16px;">
        <h4 style="font-size:0.95rem;font-weight:800;color:var(--color-primary);margin-bottom:6px;">⏰ مواعيد العمل واستقبال الطلبات:</h4>
        <p style="font-size:0.88rem;color:var(--color-text-muted);">
          ${window.MD_CONFIG.WORKING_HOURS}
        </p>
      </div>
    `;
  }

  // ==========================================
  // شاشة الإدارة ADMIN
  // ==========================================
  function renderAdminScreen(container) {
    if (!window.adminManager.isAuthenticated) {
      container.innerHTML = `
        <div class="pin-screen-box">
          <div style="font-size:2.5rem;margin-bottom:10px;">🔐</div>
          <h3 style="font-size:1.2rem;font-weight:800;color:var(--color-primary);margin-bottom:6px;">دخول لوحة إدارة المتجر</h3>
          <p style="font-size:0.8rem;color:var(--color-text-muted);margin-bottom:16px;">
            أدخل رمز المرور PIN للمتابعة (ملاحظة: هذا قفل محلي على جهازك لتسهيل تعديل الأسعار وتصديرها).
          </p>

          <form onsubmit="window.handleAdminPinSubmit(event)">
            <input 
              type="password" 
              id="admin-pin-input" 
              class="form-control" 
              placeholder="رمز PIN" 
              style="text-align:center;font-size:1.3rem;letter-spacing:4px;margin-bottom:12px;" 
              required 
            />
            <button type="submit" class="btn btn-primary btn-block">دخول</button>
          </form>
          <small style="display:block;margin-top:12px;color:var(--color-text-light);font-size:0.75rem;">
            الرمز الافتراضي: 2026 (قابل للتغيير في config.js)
          </small>
        </div>
      `;
      return;
    }

    // الشاشة بعد تسجيل الدخول
    container.innerHTML = `
      <div class="section-header" style="margin-top:10px;">
        <h2 class="section-title">لوحة الإدارة والتعديلات</h2>
        <button class="btn btn-sm" style="color:var(--color-danger);" onclick="window.adminLogout()">خروج</button>
      </div>

      <div class="admin-card">
        <h3 style="font-size:1.1rem;font-weight:800;color:var(--color-primary);margin-bottom:8px;">
          إدارة التعديلات السريعة (${state.products.length} منتج)
        </h3>
        <p style="font-size:0.82rem;color:var(--color-text-muted);margin-bottom:14px;">
          التعديلات التي تجريها هنا تحفظ في جهازك. لتطبيقها على جميع الزبائن: اضغط "تصدير التعديلات" واستبدل ملف <code>www/data/overrides.js</code> على GitHub.
        </p>

        <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:18px;">
          <button class="btn btn-gold btn-sm" onclick="window.adminManager.exportOverridesFile()">
            📥 تصدير التعديلات (تحميل overrides.js)
          </button>
          <label class="btn btn-outline btn-sm" style="cursor:pointer;margin:0;">
            📤 استيراد ملف تعديلات
            <input type="file" accept=".js,.json" style="display:none;" onchange="window.handleImportOverrides(event)" />
          </label>
        </div>

        <input 
          type="text" 
          id="admin-search-input" 
          class="form-control" 
          placeholder="ابحث عن منتج لتعديله..." 
          style="margin-bottom:14px;"
          oninput="window.filterAdminProducts(this.value)"
        />

        <div id="admin-products-list" style="display:flex;flex-direction:column;gap:10px;max-height:550px;overflow-y:auto;">
          ${renderAdminProductListItems(state.products)}
        </div>
      </div>
    `;
  }

  function renderAdminProductListItems(list) {
    return list.map(p => `
      <div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg-primary);padding:10px;border-radius:var(--radius-sm);border:1px solid var(--color-gold-border);">
        <div style="display:flex;align-items:center;gap:10px;">
          <img src="${window.MD_CONFIG.getProductImageUrl(p.mainImage)}" style="width:48px;height:48px;object-fit:cover;border-radius:4px;" onerror="window.handleImgError(this, '${p.title}')" />
          <div>
            <strong style="font-size:0.88rem;color:var(--color-primary);">${p.title}</strong>
            <div style="font-size:0.75rem;color:var(--color-text-muted);">
              كود: ${p.id} | السعر: ${window.MD_CONFIG.formatPrice(p.salePrice || p.price)}
              ${p.outOfStock ? ' | <span style="color:var(--color-danger);">غير متاح</span>' : ''}
              ${p.limited ? ' | <span style="color:var(--color-warning);">كمية محدودة</span>' : ''}
            </div>
          </div>
        </div>
        <button class="btn btn-sm btn-outline" onclick="window.openEditProductModal('${p.id}')">تعديل ✏️</button>
      </div>
    `).join('');
  }

  window.handleAdminPinSubmit = function (e) {
    e.preventDefault();
    const pin = document.getElementById('admin-pin-input').value;
    if (window.adminManager.verifyPin(pin)) {
      renderAdminScreen(document.getElementById('main-app-view'));
      showToast('تم تسجيل الدخول بنجاح');
    } else {
      alert('رمز PIN غير صحيح، حاول مرة أخرى.');
    }
  };

  window.adminLogout = function () {
    window.adminManager.logout();
    renderAdminScreen(document.getElementById('main-app-view'));
  };

  window.filterAdminProducts = function (query) {
    const listEl = document.getElementById('admin-products-list');
    if (!listEl) return;
    const q = query.toLowerCase();
    const filtered = state.products.filter(p => p.title.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
    listEl.innerHTML = renderAdminProductListItems(filtered);
  };

  window.handleImportOverrides = function (e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    window.adminManager.importOverridesFile(file).then(count => {
      initProductsData();
      renderAdminScreen(document.getElementById('main-app-view'));
      showToast(`تم استيراد ${count} تعديل بنجاح!`);
    }).catch(err => {
      alert('خطأ في استيراد الملف: ' + err.message);
    });
  };

  window.openEditProductModal = function (productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-card">
        <button class="modal-close-btn" onclick="this.closest('.modal-backdrop').remove()">✕</button>
        <h3 style="font-size:1.15rem;font-weight:800;color:var(--color-primary);margin-bottom:12px;">تعديل: ${product.title}</h3>

        <form onsubmit="window.saveProductOverrideFromModal(event, '${product.id}')">
          <div class="form-group">
            <label class="form-label">عنوان المنتج</label>
            <input type="text" id="edit-title" class="form-control" value="${product.title}" required />
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div class="form-group">
              <label class="form-label">السعر الأساسي (ج.م)</label>
              <input type="number" id="edit-price" class="form-control" value="${product.price}" required />
            </div>
            <div class="form-group">
              <label class="form-label">سعر الخصم (اختياري)</label>
              <input type="number" id="edit-saleprice" class="form-control" value="${product.salePrice || ''}" placeholder="اتركه فارغاً إذا لا يوجد خصم" />
            </div>
          </div>

          <div style="display:flex;gap:18px;margin-bottom:14px;flex-wrap:wrap;">
            <label style="display:flex;align-items:center;gap:6px;font-size:0.88rem;cursor:pointer;">
              <input type="checkbox" id="edit-outofstock" ${product.outOfStock ? 'checked' : ''} />
              <span>غير متاح (نفد من المخزن)</span>
            </label>
            <label style="display:flex;align-items:center;gap:6px;font-size:0.88rem;cursor:pointer;">
              <input type="checkbox" id="edit-limited" ${product.limited ? 'checked' : ''} />
              <span>شارة: كمية محدودة</span>
            </label>
            <label style="display:flex;align-items:center;gap:6px;font-size:0.88rem;cursor:pointer;">
              <input type="checkbox" id="edit-featured" ${product.featured ? 'checked' : ''} />
              <span>عرض في المنتجات المميزة</span>
            </label>
          </div>

          <div class="form-group">
            <label class="form-label">الوصف والمواصفات</label>
            <textarea id="edit-desc" class="form-control">${product.description || ''}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">رفع صورة جديدة للموديل (تضغط تلقائياً وتخزن محلياً)</label>
            <input type="file" accept="image/*" id="edit-image-file" class="form-control" />
          </div>

          <button type="submit" class="btn btn-primary btn-block">حفظ التعديل لهذا المنتج</button>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  };

  window.saveProductOverrideFromModal = async function (e, productId) {
    e.preventDefault();
    const title = document.getElementById('edit-title').value.trim();
    const price = parseFloat(document.getElementById('edit-price').value) || 0;
    const salePriceVal = document.getElementById('edit-saleprice').value.trim();
    const salePrice = salePriceVal ? parseFloat(salePriceVal) : null;
    const outOfStock = document.getElementById('edit-outofstock').checked;
    const limited = document.getElementById('edit-limited').checked;
    const featured = document.getElementById('edit-featured').checked;
    const description = document.getElementById('edit-desc').value.trim();
    const fileInput = document.getElementById('edit-image-file');

    const updateData = {
      title,
      price,
      salePrice,
      outOfStock,
      limited,
      featured,
      description
    };

    if (fileInput && fileInput.files && fileInput.files[0]) {
      try {
        const compressedDataUrl = await window.compressImageClientSide(fileInput.files[0]);
        await window.AdminDB.saveImage(productId, compressedDataUrl);
        updateData.mainImage = compressedDataUrl;
        updateData.images = [compressedDataUrl];
      } catch (err) {
        console.error('فشل في ضغط الصورة:', err);
      }
    }

    window.adminManager.updateProductOverride(productId, updateData);
    initProductsData();

    // إغلاق النافذة المنبثقة
    document.querySelector('.modal-backdrop').remove();
    renderAdminScreen(document.getElementById('main-app-view'));
    showToast('تم حفظ التعديل بنجاح');
  };

  /**
   * تسجيل الـ Service Worker في بيئة الويب فقط
   */
  function registerServiceWorker() {
    // عدم تفعيل الـ SW داخل Capacitor لتفادي أي تعارض مع ملفات الـ Assets المحلية
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      return;
    }
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => {
          console.warn('Service Worker registration skipped:', err);
        });
      });
    }
  }

  // بدء تشغيل التطبيق
  window.addEventListener('DOMContentLoaded', () => {
    initProductsData();
    window.cartManager.notifyListeners();
    handleRoute();
    registerServiceWorker();
  });

  window.addEventListener('hashchange', handleRoute);

})();
