

const CART_STORAGE_KEY = 'juljones_cart';

const Cart = {
    getItems() {
        try {
            return JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
        } catch {
            return [];
        }
    },

    saveItems(items) {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    },

    addItem(dish) {
        const items = this.getItems();
        const existing = items.find(item => item.id === dish.id);

        if (existing) {
            existing.quantity += 1;
        } else {
            items.push({
                id: dish.id,
                name: dish.name,
                price: dish.price,
                quantity: 1
            });
        }

        this.saveItems(items);
        this.updateUI();
    },

    removeItem(id) {
        this.saveItems(this.getItems().filter(item => item.id !== id));
        this.updateUI();
    },

    updateQuantity(id, quantity) {
        const items = this.getItems();
        const item = items.find(entry => entry.id === id);

        if (!item) return;

        if (quantity <= 0) {
            this.removeItem(id);
            return;
        }

        item.quantity = quantity;
        this.saveItems(items);
        this.updateUI();
    },

    clear() {
        localStorage.removeItem(CART_STORAGE_KEY);
        this.updateUI();
    },

    getTotal() {
        return this.getItems().reduce((sum, item) => sum + item.price * item.quantity, 0);
    },

    getItemCount() {
        return this.getItems().reduce((sum, item) => sum + item.quantity, 0);
    },

    formatPrice(amount) {
        return `₵${amount.toFixed(2)}`;
    },

    injectUI() {
        const navWrapper = document.querySelector('.nav-wrapper');
        if (navWrapper && !document.getElementById('cartToggle')) {
            const cartToggle = document.createElement('button');
            cartToggle.type = 'button';
            cartToggle.className = 'cart-toggle';
            cartToggle.id = 'cartToggle';
            cartToggle.setAttribute('aria-label', 'Open cart');
            cartToggle.innerHTML = `
                <span class="cart-icon" aria-hidden="true">🛒</span>
                <span class="cart-count" id="cartCount">0</span>
            `;
            navWrapper.insertBefore(cartToggle, navWrapper.querySelector('.hamburger'));
        }

        if (!document.getElementById('cartPanel')) {
            const cartMarkup = document.createElement('div');
            cartMarkup.innerHTML = `
                <div class="cart-overlay" id="cartOverlay"></div>
                <aside class="cart-panel" id="cartPanel" aria-hidden="true">
                    <div class="cart-header">
                        <h2>Your Order</h2>
                        <button type="button" class="cart-close" id="cartClose" aria-label="Close cart">&times;</button>
                    </div>
                    <div class="cart-items" id="cartItems"></div>
                    <div class="cart-footer">
                        <div class="cart-total-row">
                            <span>Total</span>
                            <span id="cartTotal">₵0.00</span>
                        </div>
                        <a href="contact.html" class="btn btn-primary btn-large cart-checkout-btn" id="cartCheckout">Checkout</a>
                        <button type="button" class="btn btn-secondary cart-clear-btn" id="cartClear">Clear Cart</button>
                    </div>
                </aside>
            `;
            document.body.appendChild(cartMarkup.firstElementChild);
            document.body.appendChild(cartMarkup.lastElementChild);
        }
    },

    renderCartPanel() {
        const cartItemsEl = document.getElementById('cartItems');
        const cartTotalEl = document.getElementById('cartTotal');
        const cartCountEl = document.getElementById('cartCount');
        const items = this.getItems();

        if (cartCountEl) {
            const count = this.getItemCount();
            cartCountEl.textContent = count;
            cartCountEl.style.display = count > 0 ? 'flex' : 'none';
        }

        if (!cartItemsEl || !cartTotalEl) return;

        if (items.length === 0) {
            cartItemsEl.innerHTML = '<p class="cart-empty">Your cart is empty. Add dishes from the menu!</p>';
            cartTotalEl.textContent = this.formatPrice(0);
            return;
        }

        cartItemsEl.innerHTML = items.map(item => `
            <div class="cart-item" data-id="${item.id}">
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <p>${this.formatPrice(item.price)} each</p>
                </div>
                <div class="cart-item-controls">
                    <button type="button" class="qty-btn qty-decrease" data-id="${item.id}" aria-label="Decrease quantity">−</button>
                    <span class="qty-value">${item.quantity}</span>
                    <button type="button" class="qty-btn qty-increase" data-id="${item.id}" aria-label="Increase quantity">+</button>
                </div>
                <div class="cart-item-subtotal">${this.formatPrice(item.price * item.quantity)}</div>
                <button type="button" class="cart-item-remove" data-id="${item.id}" aria-label="Remove item">&times;</button>
            </div>
        `).join('');

        cartTotalEl.textContent = this.formatPrice(this.getTotal());
    },

    renderOrderSummary() {
        const orderForm = document.getElementById('orderForm');
        if (!orderForm) return;

        let summary = document.getElementById('cartOrderSummary');
        if (!summary) {
            summary = document.createElement('div');
            summary.id = 'cartOrderSummary';
            summary.className = 'cart-order-summary';
            orderForm.parentElement.insertBefore(summary, orderForm);
        }

        const dishGroup = orderForm.querySelector('[for="dish"]')?.parentElement;
        const quantityGroup = orderForm.querySelector('[for="quantity"]')?.parentElement;
        const dishSelect = document.getElementById('dish');
        const quantityInput = document.getElementById('quantity');
        const items = this.getItems();

        if (items.length === 0) {
            summary.innerHTML = '';
            summary.style.display = 'none';
            if (dishGroup) dishGroup.style.display = '';
            if (quantityGroup) quantityGroup.style.display = '';
            dishSelect?.setAttribute('required', 'required');
            quantityInput?.setAttribute('required', 'required');
            return;
        }

        summary.style.display = 'block';
        if (dishGroup) dishGroup.style.display = 'none';
        if (quantityGroup) quantityGroup.style.display = 'none';
        dishSelect?.removeAttribute('required');
        quantityInput?.removeAttribute('required');

        summary.innerHTML = `
            <h3>Your Cart</h3>
            <ul class="cart-summary-list">
                ${items.map(item => `
                    <li>
                        <span>${item.name} × ${item.quantity}</span>
                        <span>${this.formatPrice(item.price * item.quantity)}</span>
                    </li>
                `).join('')}
            </ul>
            <div class="cart-summary-total">
                <span>Order Total</span>
                <span>${this.formatPrice(this.getTotal())}</span>
            </div>
            <p class="cart-summary-note">Your cart items will be included with this order.</p>
        `;
    },

    openPanel() {
        const panel = document.getElementById('cartPanel');
        const overlay = document.getElementById('cartOverlay');
        if (panel) {
            panel.classList.add('open');
            panel.setAttribute('aria-hidden', 'false');
        }
        if (overlay) overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    },

    closePanel() {
        const panel = document.getElementById('cartPanel');
        const overlay = document.getElementById('cartOverlay');
        if (panel) {
            panel.classList.remove('open');
            panel.setAttribute('aria-hidden', 'true');
        }
        if (overlay) overlay.classList.remove('open');
        document.body.style.overflow = '';
    },

    bindEvents() {
        const cartToggle = document.getElementById('cartToggle');
        const cartClose = document.getElementById('cartClose');
        const cartOverlay = document.getElementById('cartOverlay');
        const cartClear = document.getElementById('cartClear');
        const cartItems = document.getElementById('cartItems');

        cartToggle?.addEventListener('click', () => this.openPanel());
        cartClose?.addEventListener('click', () => this.closePanel());
        cartOverlay?.addEventListener('click', () => this.closePanel());

        cartClear?.addEventListener('click', () => {
            if (this.getItems().length === 0) return;
            if (confirm('Remove all items from your cart?')) {
                this.clear();
            }
        });

        cartItems?.addEventListener('click', (event) => {
            const target = event.target;
            const id = target.dataset.id;
            if (!id) return;

            if (target.classList.contains('qty-increase')) {
                const item = this.getItems().find(entry => entry.id === id);
                if (item) this.updateQuantity(id, item.quantity + 1);
            }

            if (target.classList.contains('qty-decrease')) {
                const item = this.getItems().find(entry => entry.id === id);
                if (item) this.updateQuantity(id, item.quantity - 1);
            }

            if (target.classList.contains('cart-item-remove')) {
                this.removeItem(id);
            }
        });

        document.querySelectorAll('.add-to-cart-btn').forEach(button => {
            button.addEventListener('click', function () {
                const menuItem = this.closest('.menu-item');
                if (!menuItem) return;

                Cart.addItem({
                    id: menuItem.dataset.dishId,
                    name: menuItem.dataset.dishName,
                    price: parseFloat(menuItem.dataset.dishPrice)
                });

                const originalText = this.textContent;
                this.textContent = 'Added!';
                this.disabled = true;
                setTimeout(() => {
                    this.textContent = originalText;
                    this.disabled = false;
                }, 1200);
            });
        });
    },

    updateUI() {
        this.renderCartPanel();
        this.renderOrderSummary();
    },

    init() {
        this.injectUI();
        this.bindEvents();
        this.updateUI();
    }
};

// Mobile Navigation Toggle
document.addEventListener('DOMContentLoaded', function () {
    Cart.init();
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function () {
            navMenu.classList.toggle('active');
            hamburger.classList.toggle('active');
        });

        // Close menu when clicking on a link
        const navLinks = document.querySelectorAll('.nav-menu a');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
                hamburger.classList.remove('active');
            });
        });
    }

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href !== '#' && href.startsWith('#')) {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });

    // Back to top button
    const backToTopBtn = document.getElementById('backToTop');
    if (backToTopBtn) {
        window.addEventListener('scroll', function () {
            if (window.scrollY > 300) {
                backToTopBtn.classList.add('visible');
            } else {
                backToTopBtn.classList.remove('visible');
            }
        });
        backToTopBtn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Menu Category Filter
    const categoryButtons = document.querySelectorAll('.category-btn');
    const menuItems = document.querySelectorAll('.menu-item');

    categoryButtons.forEach(button => {
        button.addEventListener('click', function () {
            const category = this.getAttribute('data-category');

            // Update active button
            categoryButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');

            // Filter menu items
            menuItems.forEach(item => {
                const itemCategory = item.getAttribute('data-category');
                if (category === 'all' || itemCategory === category) {
                    item.style.display = 'flex';
                    setTimeout(() => {
                        item.style.opacity = '1';
                        item.style.transform = 'scale(1)';
                    }, 10);
                } else {
                    item.style.opacity = '0';
                    item.style.transform = 'scale(0.8)';
                    setTimeout(() => {
                        item.style.display = 'none';
                    }, 300);
                }
            });
        });
    });

    // Gallery Filter
    const filterButtons = document.querySelectorAll('.filter-btn');
    const galleryItems = document.querySelectorAll('.gallery-item');

    filterButtons.forEach(button => {
        button.addEventListener('click', function () {
            const filter = this.getAttribute('data-filter');

            // Update active button
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');

            // Filter gallery items
            galleryItems.forEach(item => {
                const itemCategory = item.getAttribute('data-category');
                if (filter === 'all' || itemCategory === filter) {
                    item.style.display = 'block';
                    setTimeout(() => {
                        item.style.opacity = '1';
                        item.style.transform = 'scale(1)';
                    }, 10);
                } else {
                    item.style.opacity = '0';
                    item.style.transform = 'scale(0.8)';
                    setTimeout(() => {
                        item.style.display = 'none';
                    }, 300);
                }
            });
        });
    });

    // Order Form Handling
    const orderForm = document.getElementById('orderForm');
    const deliverySelect = document.getElementById('delivery');
    const addressGroup = document.getElementById('addressGroup');
    const addressInput = document.getElementById('address');

    if (deliverySelect && addressGroup) {
        deliverySelect.addEventListener('change', function () {
            if (this.value === 'delivery') {
                addressGroup.style.display = 'block';
                addressInput.setAttribute('required', 'required');
            } else {
                addressGroup.style.display = 'none';
                addressInput.removeAttribute('required');
            }
        });
    }

    if (orderForm) {
        orderForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const cartItems = Cart.getItems();
            const hasCartItems = cartItems.length > 0;

            if (!hasCartItems && !this.dish.value) {
                alert('Please add items to your cart or select a dish.');
                return;
            }

            const formData = new FormData(this);
            const orderData = {};
            formData.forEach((value, key) => {
                orderData[key] = value;
            });

            if (hasCartItems) {
                orderData.items = cartItems;
                orderData.total = Cart.getTotal();
            }

            const submitButton = this.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;

            submitButton.textContent = 'Processing...';
            submitButton.disabled = true;

            try {
                const response = await fetch('http://localhost:3001/api/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(orderData)
                });

                if (response.ok) {
                    let message = 'Order placed successfully! We will contact you shortly to confirm your order.';
                    if (hasCartItems) {
                        const itemLines = cartItems.map(item =>
                            `${item.name} x${item.quantity} - ${Cart.formatPrice(item.price * item.quantity)}`
                        ).join('\n');
                        message += `\n\nOrder Total: ${Cart.formatPrice(orderData.total)}\n${itemLines}`;
                        Cart.clear();
                    }
                    alert(message);
                } else {
                    alert('Failed to place order. Please try again.');
                }
            } catch (error) {
                alert('Connection error. Please ensure the admin system is running.');
            }

            submitButton.textContent = originalText;
            submitButton.disabled = false;
            orderForm.reset();
            if (addressGroup) {
                addressGroup.style.display = 'none';
            }
        });
    }

    // Navbar scroll effect
    let lastScroll = 0;
    const navbar = document.querySelector('.navbar');

    window.addEventListener('scroll', function () {
        const currentScroll = window.scrollY;

        if (currentScroll > 100) {
            navbar.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1)';
        } else {
            navbar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.05)';
        }

        lastScroll = currentScroll;
    });

    // Animate on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function (entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe elements for animation
    const animateElements = document.querySelectorAll('.dish-card, .menu-item, .gallery-item, .feature-item, .value-card, .feature-box');
    animateElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    // Add loading animation to images
    const images = document.querySelectorAll('.dish-placeholder');
    images.forEach(img => {
        img.style.transition = 'transform 0.3s ease';
    });
});

// Add smooth page transitions
window.addEventListener('load', function () {
    document.body.classList.add('loaded');
});

