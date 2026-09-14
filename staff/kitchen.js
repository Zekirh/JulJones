import { supabase } from "../supabase-client.js";

/*
============================================================
DOM
============================================================
*/

const ordersContainer =
    document.getElementById(
        "ordersContainer"
    );

const roleDisplay =
    document.getElementById(
        "roleDisplay"
    );

const connectionStatus =
    document.getElementById(
        "connectionStatus"
    );

const errorContainer =
    document.getElementById(
        "errorContainer"
    );


/*
============================================================
STATE
============================================================
*/

const ACTIVE_STATUSES = [
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "out_for_delivery"
];

let realtimeChannel = null;

let currentProfile = null;

let currentBranchId = null;

let currentBranchName = null;


/*
============================================================
ERROR HANDLING
============================================================
*/

function showError(message) {

    errorContainer.textContent =
        message;

    errorContainer.className =
        "error-state";

    errorContainer.style.display =
        "block";
}


function clearError() {

    errorContainer.textContent = "";

    errorContainer.style.display =
        "none";
}


/*
============================================================
AUTHORIZATION + BRANCH IDENTITY
============================================================
*/

async function verifyStaffAccess() {

    const {
        data: {
            session
        }
    } =
        await supabase.auth.getSession();


    if (!session) {

        window.location.href =
            "login.html";

        return null;
    }


    const {
        data: profile,
        error
    } =
        await supabase
            .from("profiles")
            .select(`
                full_name,
                role,
                branch_id,
                branches (
                    id,
                    name,
                    code,
                    address
                )
            `)
            .eq(
                "id",
                session.user.id
            )
            .single();


    if (
        error ||
        !profile
    ) {

        console.error(
            "Failed to load staff profile:",
            error
        );

        await supabase.auth.signOut();

        window.location.href =
            "login.html";

        return null;
    }


    if (
        profile.role !== "staff" &&
        profile.role !== "manager"
    ) {

        await supabase.auth.signOut();

        window.location.href =
            "login.html";

        return null;
    }


    /*
    ----------------------------------------------------------
    Staff must belong to a branch.
    ----------------------------------------------------------
    */

    if (
        profile.role === "staff" &&
        !profile.branch_id
    ) {

        showError(
            "Your staff account has not been assigned to a JulJones branch. Please contact a manager."
        );

        return null;
    }


    currentProfile =
        profile;


    currentBranchId =
        profile.branch_id || null;


    currentBranchName =
        profile.branches?.name || null;


    /*
    ----------------------------------------------------------
    Display branch identity
    ----------------------------------------------------------
    */

    if (
        profile.role === "manager"
    ) {

        roleDisplay.textContent =
            "Role: Manager — All Branches";

    } else {

        const branchLabel =
            currentBranchName ||
            "Unassigned Branch";

        roleDisplay.textContent =
            `Role: Staff — ${branchLabel}`;
    }


    return profile;
}


/*
============================================================
FETCH ACTIVE ORDERS
============================================================
*/

async function loadOrders() {

    clearError();


    let query =
        supabase
            .from("orders")
            .select(`
                id,
                order_number,
                customer_name,
                phone,
                order_type,
                delivery_address,
                preferred_time,
                special_instructions,
                subtotal,
                delivery_fee,
                total_amount,
                payment_method,
                payment_status,
                status,
                branch_id,
                created_at,
                order_items (
                    id,
                    item_name,
                    unit_price,
                    quantity,
                    subtotal
                )
            `)
            .in(
                "status",
                ACTIVE_STATUSES
            )
            .order(
                "created_at",
                {
                    ascending: true
                }
            );


    /*
    ----------------------------------------------------------
    Branch isolation
    ----------------------------------------------------------

    Staff users are explicitly restricted to their branch.

    Managers remain global and can see all branches.
    RLS remains the authoritative security boundary.
    */

    if (
        currentProfile?.role === "staff"
    ) {

        query =
            query.eq(
                "branch_id",
                currentBranchId
            );
    }


    const {
        data: orders,
        error
    } =
        await query;


    if (error) {

        console.error(
            "Failed to load orders:",
            error
        );

        showError(
            `Failed to load orders: ${error.message}`
        );

        return;
    }


    renderOrders(
        orders || []
    );
}


/*
============================================================
RENDER ORDERS
============================================================
*/

function renderOrders(
    orders
) {

    if (!orders.length) {

        ordersContainer.innerHTML = `
            <div class="empty-state">

                <h3>No active orders</h3>

                <p>
                    New customer orders will appear here automatically.
                </p>

            </div>
        `;

        return;
    }


    ordersContainer.innerHTML =
        orders
            .map(
                order =>
                    createOrderCard(order)
            )
            .join("");


    attachOrderActions();
}


/*
============================================================
ORDER CARD
============================================================
*/

function createOrderCard(
    order
) {

    const createdAt =
        new Date(
            order.created_at
        ).toLocaleString();


    const nextAction =
        getNextAction(
            order.status,
            order.order_type
        );


    const items =
        order.order_items
            ?.map(
                item => `
                    <li>

                        <span>
                            ${escapeHtml(item.item_name)}
                            × ${item.quantity}
                        </span>

                        <strong>
                            ₵${Number(item.subtotal).toFixed(2)}
                        </strong>

                    </li>
                `
            )
            .join("") || "";


    const deliveryInfo =
        order.order_type === "delivery"

            ? `
                <p>
                    <strong>Delivery:</strong>
                    ${escapeHtml(
                        order.delivery_address || ""
                    )}
                </p>
            `

            : `
                <p>
                    <strong>Pickup order</strong>
                </p>
            `;


    const specialInstructions =
        order.special_instructions

            ? `
                <div class="special-instructions">

                    <strong>
                        Special instructions:
                    </strong>

                    <div>
                        ${escapeHtml(
                            order.special_instructions
                        )}
                    </div>

                </div>
            `

            : "";


    return `
        <article
            class="order-card ${order.status}"
            data-order-id="${order.id}"
        >

            <div class="order-header">

                <div>

                    <h3 class="order-number">
                        Order #${order.order_number}
                    </h3>

                    <div class="order-meta">
                        ${createdAt}
                    </div>

                </div>

                <span
                    class="
                        status-badge
                        status-${order.status}
                    "
                >
                    ${formatStatus(order.status)}
                </span>

            </div>


            <div class="order-meta">

                <p>
                    <strong>Customer:</strong>
                    ${escapeHtml(order.customer_name)}
                </p>

                <p>
                    <strong>Phone:</strong>
                    ${escapeHtml(order.phone)}
                </p>

                <p>
                    <strong>Payment:</strong>
                    ${formatStatus(order.payment_status)}
                    (${escapeHtml(order.payment_method)})
                </p>

                ${deliveryInfo}

            </div>


            <ul class="order-items">

                ${items}

            </ul>


            ${specialInstructions}


            <div class="order-meta">

                <p>
                    <strong>Subtotal:</strong>
                    ₵${Number(order.subtotal).toFixed(2)}
                </p>

                <p>
                    <strong>Delivery:</strong>
                    ₵${Number(order.delivery_fee).toFixed(2)}
                </p>

                <p>
                    <strong>Total:</strong>
                    ₵${Number(order.total_amount).toFixed(2)}
                </p>

            </div>


            <div class="order-actions">

                ${
                    nextAction
                        ? `
                            <button
                                class="order-action-btn"
                                data-order-id="${order.id}"
                                data-next-status="${nextAction.status}"
                            >
                                ${nextAction.label}
                            </button>
                        `
                        : ""
                }

            </div>

        </article>
    `;
}


/*
============================================================
NEXT WORKFLOW ACTION
============================================================
*/

function getNextAction(
    status,
    orderType
) {

    switch (status) {

        case "pending":

            return {
                status: "confirmed",
                label: "Confirm Order"
            };


        case "confirmed":

            return {
                status: "preparing",
                label: "Start Preparing"
            };


        case "preparing":

            return {
                status: "ready",
                label: "Mark Ready"
            };


        case "ready":

            if (
                orderType === "delivery"
            ) {

                return {
                    status: "out_for_delivery",
                    label: "Send for Delivery"
                };

            }


            return {
                status: "completed",
                label: "Complete Pickup"
            };


        case "out_for_delivery":

            return {
                status: "completed",
                label: "Mark Delivered"
            };


        default:

            return null;
    }
}


/*
============================================================
STATUS UPDATE
============================================================
*/

function attachOrderActions() {

    document
        .querySelectorAll(
            ".order-action-btn"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const orderId =
                            button.dataset.orderId;

                        const newStatus =
                            button.dataset.nextStatus;


                        button.disabled =
                            true;

                        button.textContent =
                            "Updating...";


                        const {
                            error
                        } =
                            await supabase.rpc(
                                "update_order_status",
                                {
                                    p_order_id:
                                        orderId,

                                    p_new_status:
                                        newStatus
                                }
                            );


                        if (error) {

                            console.error(
                                "Order status update failed:",
                                error
                            );

                            showError(
                                `Could not update order: ${error.message}`
                            );

                            button.disabled =
                                false;

                            button.textContent =
                                "Try Again";

                            return;
                        }


                        /*
                        ------------------------------------------------
                        Realtime will normally refresh the UI.
                        We also reload immediately.
                        ------------------------------------------------
                        */

                        await loadOrders();

                    }
                );

            }
        );
}


/*
============================================================
REALTIME
============================================================
*/

function subscribeToOrderChanges() {

    /*
    ----------------------------------------------------------
    Clean up an existing subscription first.
    ----------------------------------------------------------
    */

    if (realtimeChannel) {

        supabase
            .removeChannel(
                realtimeChannel
            );

        realtimeChannel =
            null;
    }


    const realtimeConfig = {
        event: "*",
        schema: "public",
        table: "orders"
    };


    /*
    ----------------------------------------------------------
    Explicit branch filter for staff.
    
    Managers receive all branch events.
    ----------------------------------------------------------
    */

    if (
        currentProfile?.role === "staff"
    ) {

        realtimeConfig.filter =
            `branch_id=eq.${currentBranchId}`;
    }


    realtimeChannel =
        supabase
            .channel(
                currentProfile?.role === "staff"
                    ? `juljones-kitchen-${currentBranchId}`
                    : "juljones-manager-orders"
            )
            .on(
                "postgres_changes",
                realtimeConfig,
                payload => {

                    console.log(
                        "Realtime order event:",
                        payload
                    );

                    loadOrders();

                }
            )
            .subscribe(
                status => {

                    if (
                        status === "SUBSCRIBED"
                    ) {

                        connectionStatus.textContent =
                            currentProfile?.role === "staff"
                                ? `Live updates connected ✅ — ${currentBranchName}`
                                : "Live updates connected ✅ — All Branches";

                    } else {

                        connectionStatus.textContent =
                            `Realtime: ${status}`;

                    }

                }
            );
}


/*
============================================================
UTILITY
============================================================
*/

function formatStatus(
    status
) {

    return String(status || "")
        .replaceAll("_", " ")
        .replace(
            /\b\w/g,
            letter =>
                letter.toUpperCase()
        );
}


function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/*
============================================================
NAVIGATION
============================================================
*/

document
    .getElementById(
        "logout"
    )
    .addEventListener(
        "click",
        async () => {

            if (realtimeChannel) {

                await supabase.removeChannel(
                    realtimeChannel
                );

                realtimeChannel =
                    null;
            }

            await supabase.auth.signOut();

            window.location.href =
                "login.html";

        }
    );


document
    .getElementById(
        "backToDashboard"
    )
    .addEventListener(
        "click",
        () => {

            window.location.href =
                "dashboard.html";

        }
    );


/*
============================================================
START
============================================================
*/

const profile =
    await verifyStaffAccess();


if (profile) {

    await loadOrders();

    subscribeToOrderChanges();

}