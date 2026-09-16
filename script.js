import { supabase } from "./supabase-client.js";

const CART_STORAGE_KEY = "juljones_cart";
const MAX_ITEM_QUANTITY = 50;

/* =========================================================
   STATE
   ========================================================= */

const MenuState = {
    items: new Map(),

    setItems(items) {
        this.items = new Map(
            items.map((item) => [item.slug, item])
        );
    },

    getItem(slug) {
        return this.items.get(slug);
    },

    hasItems() {
        return this.items.size > 0;
    }
};


/* =========================================================
   UTILITIES
   ========================================================= */

function formatPrice(amount) {
    return `₵${Number(amount).toFixed(2)}`;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* =========================================================
   MENU
   ========================================================= */

async function loadMenuFromSupabase() {

    const { data, error } =
        await supabase
            .from("menu_items")
            .select(`
                id,
                name,
                slug,
                description,
                price,
                image_url,
                is_available,
                display_order,
                category_id,
                categories (
                    slug,
                    name
                )
            `)
            .eq("is_available", true)
            .order("display_order", {
                ascending: true
            });

    if (error) {
        console.error(
            "Failed to load menu:",
            error
        );

        return {
            items: [],
            error
        };
    }

    return {
        items: data || [],
        error: null
    };
}


function syncMenuIntoPage() {

    const menuElements =
        document.querySelectorAll(
            ".menu-item[data-dish-id], .dish-card[data-dish-id]"
        );

    menuElements.forEach((element) => {

        const slug =
            element.dataset.dishId;

        if (!slug) {
            return;
        }

        const item =
            MenuState.getItem(slug);

        if (!item) {
            return;
        }

        // Keep DOM data synchronized with Supabase.
        element.dataset.dishName =
            item.name;

        element.dataset.dishPrice =
            item.price;

        /* -------------------------
           Menu page
           ------------------------- */

        const menuName =
            element.querySelector(
                ".menu-item-header h3"
            );

        const menuPrice =
            element.querySelector(
                ".menu-item-header .price"
            );

        const menuDescription =
            element.querySelector(
                ".menu-item-content > p"
            );

        if (menuName) {
            menuName.textContent =
                item.name;
        }

        if (menuPrice) {
            menuPrice.textContent =
                formatPrice(item.price);
        }

        if (menuDescription) {
            menuDescription.textContent =
                item.description || "";
        }


        /* -------------------------
           Homepage featured cards
           ------------------------- */

        const dishName =
            element.querySelector(
                ".dish-card-heading"
            );

        const dishPrice =
            element.querySelector(
                ".dish-price"
            );

        const dishDescription =
            element.querySelector(
                ".dish-info > p"
            );

        if (dishName) {
            dishName.textContent =
                item.name;
        }

        if (dishPrice) {
            dishPrice.textContent =
                formatPrice(item.price);
        }

        if (dishDescription) {
            dishDescription.textContent =
                item.description || "";
        }
    });
}


/* =========================================================
   CART
   ========================================================= */

const Cart = {

    getItems() {

        try {

            const raw =
                localStorage.getItem(
                    CART_STORAGE_KEY
                );

            const items =
                JSON.parse(
                    raw || "[]"
                );

            if (!Array.isArray(items)) {
                return [];
            }

            return items
                .filter(
                    (item) =>
                        item &&
                        typeof item.id === "string" &&
                        Number.isInteger(
                            Number(item.quantity)
                        ) &&
                        Number(item.quantity) > 0
                )
                .map((item) => ({
                    id: item.id,
                    quantity: Math.min(
                        Number(item.quantity),
                        MAX_ITEM_QUANTITY
                    )
                }));

        } catch (error) {

            console.error(
                "Failed to load cart:",
                error
            );

            return [];
        }
    },


    saveItems(items) {

        localStorage.setItem(
            CART_STORAGE_KEY,
            JSON.stringify(items)
        );
    },


    addItem(slug) {

        const menuItem =
            MenuState.getItem(slug);

        if (!menuItem) {

            console.error(
                "Cannot add unknown menu item:",
                slug
            );

            return;
        }

        const items =
            this.getItems();

        const existing =
            items.find(
                (item) =>
                    item.id === slug
            );

        if (existing) {

            if (
                existing.quantity >=
                MAX_ITEM_QUANTITY
            ) {

                showToast(
                    `Maximum quantity per item is ${MAX_ITEM_QUANTITY}.`
                );

                return;
            }

            existing.quantity += 1;

        } else {

            items.push({
                id: slug,
                quantity: 1
            });
        }

        this.saveItems(items);
        this.updateUI();
    },


    updateQuantity(slug, quantity) {

        const items =
            this.getItems();

        const item =
            items.find(
                (entry) =>
                    entry.id === slug
            );

        if (!item) {
            return;
        }

        if (quantity <= 0) {

            this.removeItem(slug);

            return;
        }

        item.quantity =
            Math.min(
                quantity,
                MAX_ITEM_QUANTITY
            );

        this.saveItems(items);
        this.updateUI();
    },


    removeItem(slug) {

        const items =
            this.getItems()
                .filter(
                    (item) =>
                        item.id !== slug
                );

        this.saveItems(items);
        this.updateUI();
    },


    clear() {

        localStorage.removeItem(
            CART_STORAGE_KEY
        );

        this.updateUI();
    },


    getDetailedItems() {

        return this
            .getItems()
            .map((cartItem) => {

                const menuItem =
                    MenuState.getItem(
                        cartItem.id
                    );

                if (!menuItem) {
                    return null;
                }

                return {
                    id: menuItem.id,
                    slug: menuItem.slug,
                    name: menuItem.name,
                    price: Number(
                        menuItem.price
                    ),
                    quantity:
                        cartItem.quantity,
                    subtotal:
                        Number(
                            menuItem.price
                        ) *
                        cartItem.quantity
                };
            })
            .filter(Boolean);
    },


    getTotal() {

        return this
            .getDetailedItems()
            .reduce(
                (sum, item) =>
                    sum + item.subtotal,
                0
            );
    },


    getItemCount() {

        return this
            .getItems()
            .reduce(
                (sum, item) =>
                    sum + item.quantity,
                0
            );
    },


    getCheckoutItems() {

        return this
            .getDetailedItems()
            .map((item) => ({
                menu_item_id:
                    item.id,

                quantity:
                    item.quantity
            }));
    },


    injectUI() {

        const cartToggle =
            document.getElementById(
                "cartToggle"
            );

        if (!cartToggle) {

            console.warn(
                "Cart toggle element not found."
            );

            return;
        }

        /*
         * The cart button now exists directly
         * in the HTML so the navbar does not shift
         * while JavaScript is loading.
         */

        if (
            !document.getElementById(
                "cartPanel"
            )
        ) {

            const wrapper =
                document.createElement(
                    "div"
                );

            wrapper.innerHTML = `

                <div
                    class="cart-overlay"
                    id="cartOverlay"
                ></div>

                <aside
                    class="cart-panel"
                    id="cartPanel"
                    aria-hidden="true"
                >

                    <div class="cart-header">

                        <h2>Your Order</h2>

                        <button
                            type="button"
                            class="cart-close"
                            id="cartClose"
                            aria-label="Close cart"
                        >
                            &times;
                        </button>

                    </div>


                    <div
                        class="cart-items"
                        id="cartItems"
                    ></div>


                    <div class="cart-footer">

                        <div class="cart-total-row">

                            <span>Total</span>

                            <span
                                id="cartTotal"
                            >
                                ₵0.00
                            </span>

                        </div>


                        <a
                            href="contact.html"
                            class="btn btn-primary btn-large cart-checkout-btn"
                            id="cartCheckout"
                        >
                            Checkout
                        </a>


                        <button
                            type="button"
                            class="btn btn-secondary cart-clear-btn"
                            id="cartClear"
                        >
                            Clear Cart
                        </button>

                    </div>

                </aside>
            `;

            document.body.appendChild(
                wrapper.firstElementChild
            );

            document.body.appendChild(
                wrapper.lastElementChild
            );
        }
    },


    renderCartPanel() {

        const container =
            document.getElementById(
                "cartItems"
            );

        const totalElement =
            document.getElementById(
                "cartTotal"
            );

        const countElement =
            document.getElementById(
                "cartCount"
            );

        if (!container) {
            return;
        }

        const detailedItems =
            this.getDetailedItems();


        /* -------------------------
           Cart badge
           ------------------------- */

        if (countElement) {

            const count =
                this.getItemCount();

            countElement.textContent =
                count;

            countElement.style.display =
                count > 0
                    ? "flex"
                    : "none";
        }


        /* -------------------------
           Empty cart
           ------------------------- */

        if (
            detailedItems.length === 0
        ) {

            container.innerHTML = `
                <p class="cart-empty">
                    Your cart is empty.
                    Add dishes from the menu!
                </p>
            `;

            if (totalElement) {
                totalElement.textContent =
                    formatPrice(0);
            }

            return;
        }


        /* -------------------------
           Render items
           ------------------------- */

        container.innerHTML =
            detailedItems
                .map(
                    (item) => `

                    <div
                        class="cart-item"
                        data-id="${escapeHtml(
                            item.slug
                        )}"
                    >

                        <div class="cart-item-info">

                            <h4>
                                ${escapeHtml(
                                    item.name
                                )}
                            </h4>

                            <p>
                                ${formatPrice(
                                    item.price
                                )}
                                each
                            </p>

                        </div>


                        <div class="cart-item-controls">

                            <button
                                type="button"
                                class="qty-btn qty-decrease"
                                data-id="${escapeHtml(
                                    item.slug
                                )}"
                                aria-label="Decrease quantity"
                            >
                                −
                            </button>

                            <span class="qty-value">
                                ${item.quantity}
                            </span>

                            <button
                                type="button"
                                class="qty-btn qty-increase"
                                data-id="${escapeHtml(
                                    item.slug
                                )}"
                                aria-label="Increase quantity"
                            >
                                +
                            </button>

                        </div>


                        <div
                            class="cart-item-subtotal"
                        >
                            ${formatPrice(
                                item.subtotal
                            )}
                        </div>


                        <button
                            type="button"
                            class="cart-item-remove"
                            data-id="${escapeHtml(
                                item.slug
                            )}"
                            aria-label="Remove item"
                        >
                            &times;
                        </button>

                    </div>
                `
                )
                .join("");


        if (totalElement) {

            totalElement.textContent =
                formatPrice(
                    this.getTotal()
                );
        }
    },


    renderCheckoutSummary() {

        const summary =
            document.getElementById(
                "cartSummary"
            );

        const dishGroup =
            document.getElementById(
                "dishGroup"
            );

        const quantityGroup =
            document.getElementById(
                "quantityGroup"
            );

        const dishSelect =
            document.getElementById(
                "dish"
            );

        const quantityInput =
            document.getElementById(
                "quantity"
            );

        if (!summary) {
            return;
        }

        const items =
            this.getDetailedItems();


        /* -------------------------
           No cart items
           ------------------------- */

        if (!items.length) {

            summary.hidden =
                true;

            summary.innerHTML =
                "";

            if (dishGroup) {
                dishGroup.hidden =
                    false;
            }

            if (quantityGroup) {
                quantityGroup.hidden =
                    false;
            }

            dishSelect?.setAttribute(
                "required",
                "required"
            );

            quantityInput?.setAttribute(
                "required",
                "required"
            );

            return;
        }


        /* -------------------------
           Cart has items
           ------------------------- */

        summary.hidden =
            false;


        if (dishGroup) {
            dishGroup.hidden =
                true;
        }

        if (quantityGroup) {
            quantityGroup.hidden =
                true;
        }

        dishSelect?.removeAttribute(
            "required"
        );

        quantityInput?.removeAttribute(
            "required"
        );


        summary.innerHTML = `
            <h3>Order Summary</h3>

            <ul class="cart-summary-list">

                ${items
                    .map(
                        (item) => `
                            <li>

                                <span>
                                    ${escapeHtml(
                                        item.name
                                    )}
                                    × ${item.quantity}
                                </span>

                                <span>
                                    ${formatPrice(
                                        item.subtotal
                                    )}
                                </span>

                            </li>
                        `
                    )
                    .join("")}

            </ul>

            <div class="cart-summary-total">

                <span>
                    Subtotal
                </span>

                <span>
                    ${formatPrice(
                        this.getTotal()
                    )}
                </span>

            </div>

            <p class="cart-summary-note">
                Final delivery fees and totals are
                calculated securely when your order
                is submitted.
            </p>
        `;
    },


    openPanel() {

        const panel =
            document.getElementById(
                "cartPanel"
            );

        const overlay =
            document.getElementById(
                "cartOverlay"
            );

        panel?.classList.add(
            "open"
        );

        panel?.setAttribute(
            "aria-hidden",
            "false"
        );

        overlay?.classList.add(
            "open"
        );

        document.body.style.overflow =
            "hidden";
    },


    closePanel() {

        const panel =
            document.getElementById(
                "cartPanel"
            );

        const overlay =
            document.getElementById(
                "cartOverlay"
            );

        panel?.classList.remove(
            "open"
        );

        panel?.setAttribute(
            "aria-hidden",
            "true"
        );

        overlay?.classList.remove(
            "open"
        );

        document.body.style.overflow =
            "";
    },


    bindEvents() {

        /* -------------------------
           Open cart
           ------------------------- */

        document
            .getElementById(
                "cartToggle"
            )
            ?.addEventListener(
                "click",
                () => this.openPanel()
            );


        /* -------------------------
           Close cart
           ------------------------- */

        document
            .getElementById(
                "cartClose"
            )
            ?.addEventListener(
                "click",
                () => this.closePanel()
            );


        document
            .getElementById(
                "cartOverlay"
            )
            ?.addEventListener(
                "click",
                () => this.closePanel()
            );


        /* -------------------------
           Clear cart
           ------------------------- */

        document
            .getElementById(
                "cartClear"
            )
            ?.addEventListener(
                "click",
                () => {

                    if (
                        this.getItems().length ===
                        0
                    ) {
                        return;
                    }

                       showConfirmation(
                       "Remove all items from your cart?",
                       () => {
                        this.clear();
                        },
                       "Clear your cart?"
                       );
                }
            );


        /* -------------------------
           Cart quantity controls
           ------------------------- */

        document
            .getElementById(
                "cartItems"
            )
            ?.addEventListener(
                "click",
                (event) => {

                    const button =
                        event.target.closest(
                            "button"
                        );

                    if (!button) {
                        return;
                    }

                    const slug =
                        button.dataset.id;

                    if (!slug) {
                        return;
                    }

                    const current =
                        this.getItems().find(
                            (item) =>
                                item.id === slug
                        );

                    if (!current) {
                        return;
                    }

                    if (
                        button.classList.contains(
                            "qty-increase"
                        )
                    ) {

                        this.updateQuantity(
                            slug,
                            current.quantity + 1
                        );
                    }

                    if (
                        button.classList.contains(
                            "qty-decrease"
                        )
                    ) {

                        this.updateQuantity(
                            slug,
                            current.quantity - 1
                        );
                    }

                    if (
                        button.classList.contains(
                            "cart-item-remove"
                        )
                    ) {

                        this.removeItem(
                            slug
                        );
                    }
                }
            );


        /* -------------------------
           Add to Cart
           ------------------------- */

        document
            .querySelectorAll(
                ".add-to-cart-btn"
            )
            .forEach(
                (button) => {

                    button.addEventListener(
                        "click",
                        () => {

                            const menuElement =
                                button.closest(
                                    ".menu-item"
                                );

                            const slug =
                                menuElement
                                    ?.dataset
                                    .dishId;

                            if (!slug) {
                                return;
                            }

                            const menuItem =
                                MenuState.getItem(
                                    slug
                                );

                            if (!menuItem) {

                                console.error(
                                    "Menu item unavailable:",
                                    slug
                                );

                                showToast(
                                    "This dish is currently unavailable."
                                );

                                return;
                            }

                            this.addItem(
                                slug
                            );

                            showToast(
                                `${menuItem.name} added to your cart`
                            );

                            const originalText =
                                button.textContent;

                            button.textContent =
                                "Added!";

                            button.disabled =
                                true;

                            setTimeout(
                                () => {

                                    button.textContent =
                                        originalText;

                                    button.disabled =
                                        false;

                                },
                                1200
                            );
                        }
                    );
                }
            );
    },


    updateUI() {

        this.renderCartPanel();

        this.renderCheckoutSummary();
    },


    init() {

        this.injectUI();

        this.bindEvents();

        this.updateUI();
    }
};


/* =========================================================
   CHECKOUT DATA
   ========================================================= */

async function loadBranches() {

    const select =
        document.getElementById(
            "branch"
        );

    if (!select) {
        return;
    }

    select.disabled =
        true;

    select.innerHTML = `
        <option value="">
            Loading kitchens...
        </option>
    `;


    const {
        data: branches,
        error
    } =
        await supabase
            .from("branches")
            .select(
                "id, name, code, address"
            )
            .eq(
                "is_active",
                true
            )
            .order(
                "name",
                {
                    ascending: true
                }
            );


    if (error) {

        console.error(
            "Failed to load branches:",
            error
        );

        select.innerHTML = `
            <option value="">
                Unable to load kitchens
            </option>
        `;

        return;
    }


    select.innerHTML = `
        <option value="">
            Choose your nearest JulJones Kitchen...
        </option>
    `;


    (branches || []).forEach(
        (branch) => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                branch.id;

            option.textContent =
                branch.address
                    ? `${branch.name} — ${branch.address}`
                    : branch.name;

            select.appendChild(
                option
            );
        }
    );


    select.disabled =
        false;
}


/* =========================================================
   CHECKOUT MENU SELECT
   ========================================================= */

function populateDishSelect(menuItems) {

    const select =
        document.getElementById(
            "dish"
        );

    if (!select) {
        return;
    }

    select.innerHTML = `
        <option value="">
            Choose a dish...
        </option>
    `;


    const groups =
        new Map();


    menuItems.forEach(
        (item) => {

            const category =
                item.categories?.name ||
                "Menu";


            if (
                !groups.has(
                    category
                )
            ) {

                groups.set(
                    category,
                    []
                );
            }


            groups
                .get(category)
                .push(item);
        }
    );


    groups.forEach(
        (items, categoryName) => {

            const group =
                document.createElement(
                    "optgroup"
                );

            group.label =
                categoryName;


            items.forEach(
                (item) => {

                    const option =
                        document.createElement(
                            "option"
                        );

                    option.value =
                        item.slug;

                    option.textContent =
                        `${item.name} — ${formatPrice(
                            item.price
                        )}`;

                    group.appendChild(
                        option
                    );
                }
            );


            select.appendChild(
                group
            );
        }
    );
}


function showConfirmation(
    message,
    onConfirm,
    title = "Are you sure?"
) {
    const modal =
        document.getElementById(
            "confirmModal"
        );

    const messageElement =
        document.getElementById(
            "confirmModalMessage"
        );

    const titleElement =
        document.getElementById(
            "confirmModalTitle"
        );

    const confirmButton =
        document.getElementById(
            "confirmAction"
        );

    const cancelButton =
        document.getElementById(
            "confirmCancel"
        );

    if (
        !modal ||
        !messageElement ||
        !titleElement ||
        !confirmButton ||
        !cancelButton
    ) {
        return;
    }

    titleElement.textContent =
        title;

    messageElement.textContent =
        message;

    modal.hidden =
        false;

    document.body.style.overflow =
        "hidden";

    const close = () => {

        modal.hidden =
            true;

        document.body.style.overflow =
            "";
    };

    const handleConfirm = () => {

        close();

        onConfirm();
    };

    confirmButton.onclick =
        handleConfirm;

    cancelButton.onclick =
        close;

    modal
        .querySelectorAll(
            "[data-close-confirm]"
        )
        .forEach(
            (element) => {
                element.onclick =
                    close;
            }
        );
}


/* =========================================================
   APP NOTIFICATIONS
   ========================================================= */

function showToast(message) {

    const container =
        document.getElementById(
            "toastContainer"
        );

    if (!container) {
        return;
    }

    const toast =
        document.createElement(
            "div"
        );

    toast.className =
        "toast";

    toast.innerHTML = `
        <span
            class="toast-icon"
            aria-hidden="true"
        >
            ✓
        </span>

        <span class="toast-message">
            ${escapeHtml(message)}
        </span>

        <button
            type="button"
            class="toast-close"
            aria-label="Dismiss notification"
        >
            &times;
        </button>
    `;

    let timeoutId;

    const closeToast = () => {

        clearTimeout(
            timeoutId
        );

        if (!toast.isConnected) {
            return;
        }

        toast.classList.add(
            "is-leaving"
        );

        setTimeout(
            () => {
                toast.remove();
            },
            200
        );
    };

    toast
        .querySelector(
            ".toast-close"
        )
        ?.addEventListener(
            "click",
            closeToast
        );

    container.appendChild(
        toast
    );

    timeoutId =
        setTimeout(
            closeToast,
            3000
        );
}


function showOrderConfirmation(order) {

    const modal =
        document.getElementById(
            "orderModal"
        );

    if (!modal) {
        return;
    }

    const orderNumber =
        document.getElementById(
            "orderModalNumber"
        );

    const total =
        document.getElementById(
            "orderModalTotal"
        );

    const payment =
        document.getElementById(
            "orderModalPayment"
        );

    const message =
        document.getElementById(
            "orderModalMessage"
        );


    if (orderNumber) {

        orderNumber.textContent =
            order?.order_number
                ? `#${order.order_number}`
                : "Confirmed";
    }


    if (total) {

        total.textContent =
            order?.total_amount !== undefined
                ? formatPrice(
                      order.total_amount
                  )
                : "—";
    }


    if (payment) {

        payment.textContent =
            "Cash";
    }


    if (message) {

        message.textContent =
            "Your order has been successfully received and sent to our kitchen.";
    }


    modal.hidden =
        false;

    document.body.style.overflow =
        "hidden";
}


function closeOrderConfirmation() {

    const modal =
        document.getElementById(
            "orderModal"
        );

    if (!modal) {
        return;
    }

    modal.hidden =
        true;

    document.body.style.overflow =
        "";
}


function setupNotifications() {

    document
        .querySelectorAll(
            "[data-close-order-modal]"
        )
        .forEach(
            (element) => {

                element.addEventListener(
                    "click",
                    closeOrderConfirmation
                );
            }
        );


    document.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key ===
                "Escape"
            ) {

                closeOrderConfirmation();
            }
        }
    );
}


/* =========================================================
   ORDER SUBMISSION
   ========================================================= */

function setupOrderForm() {

    const form =
        document.getElementById(
            "orderForm"
        );

    if (!form) {
        return;
    }


    const deliverySelect =
        document.getElementById(
            "delivery"
        );

    const addressGroup =
        document.getElementById(
            "addressGroup"
        );

    const addressInput =
        document.getElementById(
            "address"
        );

    const submitButton =
        form.querySelector(
            'button[type="submit"]'
        );


    /* -------------------------
       Delivery address toggle
       ------------------------- */

    deliverySelect?.addEventListener(
        "change",
        () => {

            const isDelivery =
                deliverySelect.value ===
                "delivery";


            if (addressGroup) {

                addressGroup.hidden =
                    !isDelivery;
            }


            if (addressInput) {

                if (isDelivery) {

                    addressInput.setAttribute(
                        "required",
                        "required"
                    );

                } else {

                    addressInput.removeAttribute(
                        "required"
                    );
                }
            }
        }
    );


    /* -------------------------
       Submit
       ------------------------- */

    form.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            if (
                !MenuState.hasItems()
            ) {

                showToast(
                    "The menu is currently unavailable. Please try again shortly."
                );

                return;
            }


            const cartItems =
                Cart.getItems();

            const hasCartItems =
                cartItems.length > 0;


            const branchId =
                document.getElementById(
                    "branch"
                )?.value;


            if (!branchId) {

                showToast(
                    "Please select a JulJones Kitchen."
                );

                return;
            }


            const name =
                document.getElementById(
                    "name"
                )?.value.trim();


            const phone =
                document.getElementById(
                    "phone"
                )?.value.trim();


            const email =
                document.getElementById(
                    "email"
                )?.value.trim();


            const orderType =
                deliverySelect?.value;


            const address =
                addressInput?.value.trim();


            const preferredTime =
                document.getElementById(
                    "preferred-time"
                )?.value ||
                null;


            const specialInstructions =
                document.getElementById(
                    "special"
                )?.value.trim() ||
                null;


            if (!name || !phone) {

                showToast(
                    "Please provide your name and phone number."
                );

                return;
            }


            if (
                orderType !== "pickup" &&
                orderType !== "delivery"
            ) {

                showToast(
                    "Please select pickup or delivery."
                );

                return;
            }


            if (
                orderType === "delivery" &&
                !address
            ) {

                showToast(
                    "Please provide your delivery address."
                );

                return;
            }


            /*
             * Cash is currently the only
             * supported payment method.
             *
             * The RPC and database enforce
             * this independently.
             */

            const paymentMethod =
                "cash";


            /* -------------------------
               Build authoritative items
               ------------------------- */

            let rpcItems = [];


            if (hasCartItems) {

                rpcItems =
                    Cart.getCheckoutItems();

            } else {

                const slug =
                    document.getElementById(
                        "dish"
                    )?.value;


                const quantity =
                    Number(
                        document.getElementById(
                            "quantity"
                        )?.value
                    );


                const menuItem =
                    MenuState.getItem(
                        slug
                    );


                if (!menuItem) {

                    showToast(
                        "Please select a valid menu item."
                    );

                    return;
                }


                if (
                    !Number.isInteger(
                        quantity
                    ) ||
                    quantity <= 0
                ) {

                    showToast(
                        "Please enter a valid quantity."
                    );

                    return;
                }


                if (
                    quantity >
                    MAX_ITEM_QUANTITY
                ) {

                    showToast(
                        `Maximum quantity per item is ${MAX_ITEM_QUANTITY}.`
                    );

                    return;
                }


                rpcItems = [
                    {
                        menu_item_id:
                            menuItem.id,

                        quantity
                    }
                ];
            }


            if (
                !rpcItems.length
            ) {

                showToast(
                    "Your order contains no valid items."
                );

                return;
            }


            /* -------------------------
               Processing state
               ------------------------- */

            submitButton.disabled =
                true;

            const originalText =
                submitButton.textContent;

            submitButton.textContent =
                "Processing...";


            try {

                const {
                    data,
                    error
                } =
                    await supabase.rpc(
                        "create_customer_order",
                        {
                            p_customer_name:
                                name,

                            p_phone:
                                phone,

                            p_email:
                                email ||
                                null,

                            p_branch_id:
                                branchId,

                            p_order_type:
                                orderType,

                            p_delivery_address:
                                orderType ===
                                "delivery"
                                    ? address
                                    : null,

                            p_preferred_time:
                                preferredTime,

                            p_special_instructions:
                                specialInstructions,

                            p_payment_method:
                                paymentMethod,

                            p_items:
                                rpcItems
                        }
                    );


                if (error) {

                    console.error(
                        "Order creation failed:",
                        error
                    );

                    showToast(
                        error.message ||
                        "We could not place your order. Please try again."
                    );

                    return;
                }


                const order =
                    Array.isArray(data)
                        ? data[0]
                        : data;


                const branchSelect =
                    document.getElementById(
                        "branch"
                    );


                const branchName =
                    branchSelect
                        ?.selectedOptions[0]
                        ?.textContent ||
                    "your selected kitchen";


                /*
                 * Clear the cart only after the
                 * order has successfully been created.
                 */

                if (hasCartItems) {

                    Cart.clear();
                }


                /*
                 * Show the JulJones confirmation
                 * modal instead of a browser alert.
                 */

                showOrderConfirmation({
                    ...order,
                    branch_name:
                        branchName
                });


                form.reset();


                if (addressGroup) {

                    addressGroup.hidden =
                        true;
                }


                if (addressInput) {

                    addressInput.removeAttribute(
                        "required"
                    );
                }


                /*
                 * Re-establish default UI state
                 * after form.reset().
                 */

                Cart.updateUI();

            } catch (error) {

                console.error(
                    "Unexpected order error:",
                    error
                );

                showToast(
                    "Something went wrong while placing your order. Please try again."
                );

            } finally {

                submitButton.disabled =
                    false;

                submitButton.textContent =
                    originalText;
            }
        }
    );
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function setupNavigation() {

    const hamburger =
        document.querySelector(
            ".hamburger"
        );

    const navMenu =
        document.querySelector(
            ".nav-menu"
        );


    if (
        hamburger &&
        navMenu
    ) {

        hamburger.addEventListener(
            "click",
            () => {

                navMenu.classList.toggle(
                    "active"
                );

                hamburger.classList.toggle(
                    "active"
                );
            }
        );


        navMenu
            .querySelectorAll("a")
            .forEach(
                (link) => {

                    link.addEventListener(
                        "click",
                        () => {

                            navMenu.classList.remove(
                                "active"
                            );

                            hamburger.classList.remove(
                                "active"
                            );
                        }
                    );
                }
            );
    }
}


/* =========================================================
   MENU FILTER
   ========================================================= */

function setupMenuFilters() {

    const buttons =
        document.querySelectorAll(
            ".category-btn"
        );

    const items =
        document.querySelectorAll(
            ".menu-item"
        );


    buttons.forEach(
        (button) => {

            button.addEventListener(
                "click",
                () => {

                    const category =
                        button.dataset.category;


                    buttons.forEach(
                        (item) =>
                            item.classList.remove(
                                "active"
                            )
                    );


                    button.classList.add(
                        "active"
                    );


                    items.forEach(
                        (item) => {

                            const itemCategory =
                                item.dataset.category;


                            if (
                                category ===
                                "all" ||
                                itemCategory ===
                                category
                            ) {

                                item.style.display =
                                    "flex";

                                setTimeout(
                                    () => {

                                        item.style.opacity =
                                            "1";

                                        item.style.transform =
                                            "scale(1)";

                                    },
                                    10
                                );

                            } else {

                                item.style.opacity =
                                    "0";

                                item.style.transform =
                                    "scale(0.8)";

                                setTimeout(
                                    () => {

                                        item.style.display =
                                            "none";

                                    },
                                    300
                                );
                            }
                        }
                    );
                }
            );
        }
    );
}


/* =========================================================
   BACK TO TOP
   ========================================================= */

function setupBackToTop() {

    const button =
        document.getElementById(
            "backToTop"
        );

    if (!button) {
        return;
    }


    window.addEventListener(
        "scroll",
        () => {

            button.classList.toggle(
                "visible",
                window.scrollY > 300
            );
        }
    );


    button.addEventListener(
        "click",
        () => {

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });
        }
    );
}


/* =========================================================
   GALLERY FILTER
   ========================================================= */

function setupGalleryFilters() {

    const buttons =
        document.querySelectorAll(
            ".filter-btn"
        );

    const items =
        document.querySelectorAll(
            ".gallery-item"
        );


    buttons.forEach(
        (button) => {

            button.addEventListener(
                "click",
                () => {

                    const filter =
                        button.dataset.filter;


                    buttons.forEach(
                        (item) =>
                            item.classList.remove(
                                "active"
                            )
                    );


                    button.classList.add(
                        "active"
                    );


                    items.forEach(
                        (item) => {

                            const category =
                                item.dataset.category;


                            if (
                                filter ===
                                "all" ||
                                category ===
                                filter
                            ) {

                                item.style.display =
                                    "block";

                            } else {

                                item.style.display =
                                    "none";
                            }
                        }
                    );
                }
            );
        }
    );
}


/* =========================================================
   SCROLL ANIMATIONS
   ========================================================= */

function setupAnimations() {

    if (
        !("IntersectionObserver" in window)
    ) {
        return;
    }


    const observer =
        new IntersectionObserver(
            (entries) => {

                entries.forEach(
                    (entry) => {

                        if (
                            entry.isIntersecting
                        ) {

                            entry.target.style.opacity =
                                "1";

                            entry.target.style.transform =
                                "translateY(0)";
                        }
                    }
                );
            },
            {
                threshold: 0.1,
                rootMargin:
                    "0px 0px -50px 0px"
            }
        );


    document
        .querySelectorAll(
            ".dish-card, .menu-item, .gallery-item, .feature-item, .value-card, .feature-box"
        )
        .forEach(
            (element) => {

                element.style.opacity =
                    "0";

                element.style.transform =
                    "translateY(30px)";

                element.style.transition =
                    "opacity 0.6s ease, transform 0.6s ease";

                observer.observe(
                    element
                );
            }
        );
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        // Global UI
        Cart.init();
        setupNotifications();

        try {

            /*
             * Load authoritative menu data
             * from Supabase.
             */

            const {
                items,
                error
            } =
                await loadMenuFromSupabase();


            if (error) {

                console.error(
                    "Menu initialization failed:",
                    error
                );

            } else {

                /*
                 * Store menu data in frontend state.
                 */

                MenuState.setItems(
                    items
                );


                /*
                 * Synchronize menu information
                 * into the current page.
                 */

                syncMenuIntoPage();


                /*
                 * Populate checkout selector.
                 */

                populateDishSelect(
                    items
                );


                /*
                 * IMPORTANT:
                 * Cart.init() executes before Supabase
                 * finishes loading. Re-render after
                 * MenuState is populated so stored
                 * cart items can resolve correctly.
                 */

                Cart.updateUI();
            }

        } catch (error) {

            console.error(
                "Menu initialization failed:",
                error
            );
        }


        /*
         * Checkout / page-specific functionality.
         */

        loadBranches();
        setupOrderForm();


        /*
         * Reveal page.
         */

        document.body.classList.add(
            "loaded"
        );
    }
); 