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


function syncMenuIntoPage(menuItems) {

    MenuState.setItems(menuItems);

    document
        .querySelectorAll(
            ".menu-item[data-dish-id]"
        )
        .forEach((menuElement) => {

            const slug =
                menuElement.dataset.dishId;

            const item =
                MenuState.getItem(slug);

            if (!item) {
                return;
            }

            menuElement.dataset.dishId =
                item.slug;

            menuElement.dataset.dishName =
                item.name;

            menuElement.dataset.dishPrice =
                item.price;

            const nameElement =
                menuElement.querySelector(
                    ".menu-item-header h3"
                );

            const priceElement =
                menuElement.querySelector(
                    ".price"
                );

            const descriptionElement =
                menuElement.querySelector(
                    ".menu-item-content > p"
                );

            if (nameElement) {
                nameElement.textContent =
                    item.name;
            }

            if (priceElement) {
                priceElement.textContent =
                    formatPrice(
                        item.price
                    );
            }

            if (descriptionElement) {
                descriptionElement.textContent =
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
                JSON.parse(raw || "[]");

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

                alert(
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

        return this.getItems()
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

        const navWrapper =
            document.querySelector(
                ".nav-wrapper"
            );

        if (
            navWrapper &&
            !document.getElementById(
                "cartToggle"
            )
        ) {

            const button =
                document.createElement(
                    "button"
                );

            button.type = "button";
            button.id = "cartToggle";
            button.className =
                "cart-toggle";

            button.setAttribute(
                "aria-label",
                "Open cart"
            );

            button.innerHTML = `
                <span
                    class="cart-icon"
                    aria-hidden="true"
                >
                    🛒
                </span>

                <span
                    class="cart-count"
                    id="cartCount"
                >
                    0
                </span>
            `;

            navWrapper.insertBefore(
                button,
                navWrapper.querySelector(
                    ".hamburger"
                )
            );
        }


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


        if (!items.length) {

            summary.hidden = true;
            summary.innerHTML = "";

            if (dishGroup) {
                dishGroup.hidden = false;
            }

            if (quantityGroup) {
                quantityGroup.hidden = false;
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


        summary.hidden = false;


        if (dishGroup) {
            dishGroup.hidden = true;
        }

        if (quantityGroup) {
            quantityGroup.hidden = true;
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

        panel?.classList.add("open");

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

        document
            .getElementById(
                "cartToggle"
            )
            ?.addEventListener(
                "click",
                () => this.openPanel()
            );


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

                    if (
                        confirm(
                            "Remove all items from your cart?"
                        )
                    ) {
                        this.clear();
                    }
                }
            );


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
                                menuElement?.dataset
                                    .dishId;

                            if (!slug) {
                                return;
                            }

                            this.addItem(
                                slug
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

    select.disabled = true;

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


    select.disabled = false;
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


    form.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            if (
                !MenuState.hasItems()
            ) {

                alert(
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

                alert(
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
                )?.value || null;


            const specialInstructions =
                document.getElementById(
                    "special"
                )?.value.trim() || null;


            if (!name || !phone) {

                alert(
                    "Please provide your name and phone number."
                );

                return;
            }


            if (
                orderType !== "pickup" &&
                orderType !== "delivery"
            ) {

                alert(
                    "Please select pickup or delivery."
                );

                return;
            }


            if (
                orderType === "delivery" &&
                !address
            ) {

                alert(
                    "Please provide your delivery address."
                );

                return;
            }


            /*
             * Cash is the only currently supported
             * payment method.
             *
             * This is enforced again in the RPC
             * and by the database constraint.
             */

            const paymentMethod =
                "cash";


            /*
             * Build authoritative item IDs.
             */

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

                    alert(
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

                    alert(
                        "Please enter a valid quantity."
                    );

                    return;
                }


                if (
                    quantity >
                    MAX_ITEM_QUANTITY
                ) {

                    alert(
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

                alert(
                    "Your order contains no valid items."
                );

                return;
            }


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
                                email || null,

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

                    alert(
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


                let message =
                    "Order placed successfully!";


                if (
                    order?.order_number
                ) {

                    message +=
                        `\n\nOrder Number: #${order.order_number}`;
                }


                message +=
                    `\nKitchen: ${branchName}`;


                message +=
                    "\nPayment: Cash";


                if (
                    order?.total_amount !==
                    undefined
                ) {

                    message +=
                        `\nTotal: ${formatPrice(
                            order.total_amount
                        )}`;
                }


                if (hasCartItems) {
                    Cart.clear();
                }


                alert(message);

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

                alert(
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

        try {

            setupNavigation();
            setupMenuFilters();
            setupGalleryFilters();
            setupBackToTop();
            setupAnimations();


            /*
             * Menu is loaded once and becomes the
             * authoritative client-side reference
             * for display and cart rendering.
             */

            const {
                items: menuItems
            } =
                await loadMenuFromSupabase();


            if (
                !menuItems.length
            ) {

                console.warn(
                    "No available menu items were loaded."
                );

            } else {

                syncMenuIntoPage(
                    menuItems
                );

                populateDishSelect(
                    menuItems
                );
            }


            /*
             * Cart UI works on every customer page.
             */

            Cart.init();


            /*
             * Checkout-specific setup.
             */

            await loadBranches();

            setupOrderForm();

        } catch (error) {

            console.error(
                "JulJones frontend initialization error:",
                error
            );

            /*
             * Never leave the customer staring at
             * a blank page because one initialization
             * feature failed.
             */

            const form =
                document.getElementById(
                    "orderForm"
                );

            if (form) {

                const message =
                    document.createElement(
                        "p"
                    );

                message.className =
                    "checkout-error";

                message.textContent =
                    "Some ordering features are temporarily unavailable. Please refresh and try again.";

                form.prepend(
                    message
                );
            }
        }

        /*
         * Always reveal the page.
         */

        document.body.classList.add(
            "loaded"
        );
    }
);


/*
 * Fallback page reveal even if a future
 * initialization error happens before the
 * normal path completes.
 */

window.addEventListener(
    "load",
    () => {

        document.body.classList.add(
            "loaded"
        );
    }
);