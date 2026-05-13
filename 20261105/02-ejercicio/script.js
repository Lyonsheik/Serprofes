// 1. BASE DE DATOS EXTENSA
const productos = [
    { id: 1, nombre: "Manzanas Galas 1kg", precio: 2.50, categoria: "frutas", img: "🍎" },
    { id: 2, nombre: "Plátano de Canarias", precio: 1.80, categoria: "frutas", img: "🍌" },
    { id: 3, nombre: "Leche Entera 1L", precio: 1.10, categoria: "lacteos", img: "🥛" },
    { id: 4, nombre: "Huevos Docena XL", precio: 3.20, categoria: "lacteos", img: "🥚" },
    { id: 5, nombre: "Filete de Ternera", precio: 12.50, categoria: "carnes", img: "🥩" },
    { id: 6, nombre: "Salmón Fresco", precio: 15.90, categoria: "carnes", img: "🐟" },
    { id: 7, nombre: "Arroz Grano Largo", precio: 1.45, categoria: "despensa", img: "🌾" },
    { id: 8, nombre: "Pasta Penne 500g", precio: 0.95, categoria: "despensa", img: "🍝" },
    { id: 9, nombre: "Coca-Cola 2L", precio: 2.10, categoria: "bebidas", img: "🥤" },
    { id: 10, nombre: "Vino Tinto Reserva", precio: 8.50, categoria: "bebidas", img: "🍷" },
    { id: 11, nombre: "Detergente Líquido", precio: 9.99, categoria: "limpieza", img: "🧴" },
    { id: 12, nombre: "Papel Higiénico (12)", precio: 4.50, categoria: "limpieza", img: "🧻" },
    { id: 13, nombre: "Aguacate Hass", precio: 4.20, categoria: "frutas", img: "🥑" },
    { id: 14, nombre: "Queso Manchego", precio: 7.30, categoria: "lacteos", img: "🧀" }
];

let carrito = [];

// Inicialización
document.addEventListener("DOMContentLoaded", () => {
    renderProducts(productos);
});

// 2. BUSCADOR EN TIEMPO REAL
function buscarProducto() {
    const query = document.getElementById("main-search").value.toLowerCase();
    const filtrados = productos.filter(p => 
        p.nombre.toLowerCase().includes(query) || 
        p.categoria.toLowerCase().includes(query)
    );
    
    if(filtrados.length > 0) {
        renderProducts(filtrados);
    } else {
        document.getElementById("products-grid").innerHTML = `
            <div style="grid-column: 1/-1; padding: 50px; color: #666;">
                <i class="fas fa-search" style="font-size: 3rem; margin-bottom: 10px;"></i>
                <p>No encontramos productos que coincidan con "${query}".</p>
            </div>
        `;
    }
}

function renderProducts(lista) {
    const grid = document.getElementById("products-grid");
    grid.innerHTML = "";
    lista.forEach(p => {
        grid.innerHTML += `
            <div class="product-card">
                <div style="font-size: 4rem">${p.img}</div>
                <h4>${p.nombre}</h4>
                <p class="price">$${p.precio.toFixed(2)}</p>
                <button class="add-btn" onclick="addToCart(${p.id})">Añadir al carrito</button>
            </div>
        `;
    });
}

function filterCategory(cat) {
    const title = document.getElementById("category-title");
    title.innerText = cat === 'todos' ? "Todos los productos" : cat.toUpperCase();
    
    // Cambiar clase activa en sidebar
    document.querySelectorAll(".sidebar li").forEach(li => li.classList.remove("active"));
    
    if(cat === 'todos') renderProducts(productos);
    else renderProducts(productos.filter(p => p.categoria === cat));
}

// 3. LÓGICA DE CARRITO Y CHECKOUT
function addToCart(id) {
    const item = productos.find(p => p.id === id);
    carrito.push(item);
    actualizarCarrito();
}

function eliminarDelCarrito(index) {
    carrito.splice(index, 1);
    actualizarCarrito();
}

function actualizarCarrito() {
    document.getElementById("cart-count").innerText = carrito.length;
    const list = document.getElementById("cart-items-list");
    let total = 0;
    list.innerHTML = "";

    carrito.forEach((item, index) => {
        total += item.precio;
        list.innerHTML += `
            <div class="cart-item">
                <span>${item.img} ${item.nombre}</span>
                <strong>$${item.precio.toFixed(2)}</strong>
                <i class="fas fa-trash" onclick="eliminarDelCarrito(${index})" style="color:red; cursor:pointer"></i>
            </div>
        `;
    });
    document.getElementById("total-price").innerText = total.toFixed(2);
    document.getElementById("checkout-total").innerText = "$" + total.toFixed(2);
}

function toggleCart() {
    const modal = document.getElementById("cart-modal");
    modal.style.display = (modal.style.display === "block") ? "none" : "block";
}

function toggleCheckout() {
    const tienda = document.getElementById("tienda-view");
    const checkout = document.getElementById("checkout-view");
    const modal = document.getElementById("cart-modal");

    if (carrito.length === 0) {
        alert("El carrito está vacío.");
        return;
    }

    modal.style.display = "none";
    if (tienda.style.display === "none") {
        tienda.style.display = "flex";
        checkout.style.display = "none";
    } else {
        tienda.style.display = "none";
        checkout.style.display = "flex";
        window.scrollTo(0,0);
    }
}

function procesarPago() {
    alert("¡Pago procesado con éxito! Recibirás tu pedido pronto.");
    carrito = [];
    actualizarCarrito();
    toggleCheckout();
}

// --- CHATBOT ---
function toggleChat() {
    const body = document.getElementById("chat-body");
    const footer = document.getElementById("chat-footer");
    const isVisible = body.style.display === "block";
    body.style.display = isVisible ? "none" : "block";
    footer.style.display = isVisible ? "none" : "flex";
}

function sendMessage() {
    const input = document.getElementById("chat-input");
    const body = document.getElementById("chat-body");
    if(!input.value) return;

    body.innerHTML += `<p style="margin: 5px 0;"><strong>Tú:</strong> ${input.value}</p>`;
    
    const botRes = responder(input.value.toLowerCase());
    setTimeout(() => {
        body.innerHTML += `<p class="bot-msg" style="color:#232f3e; background:#e7e9ec; padding:5px; border-radius:5px;"><strong>Bot:</strong> ${botRes}</p>`;
        body.scrollTop = body.scrollHeight;
    }, 600);
    input.value = "";
}

function responder(t) {
    if(t.includes("pago") || t.includes("tarjeta")) return "Aceptamos Visa, MasterCard y transferencias. El proceso es 100% seguro.";
    if(t.includes("envio") || t.includes("donde")) return "Enviamos a todo el país. El tiempo estimado es de 24 a 48 horas.";
    if(t.includes("precio") || t.includes("caro")) return "Manejamos los mejores precios del mercado con ofertas diarias en Lácteos.";
    if(t.includes("problema") || t.includes("ayuda")) return "Puedes llamarnos al 0800-SUPER-NOVA para atención inmediata.";
    return "Interesante pregunta. Para eso te recomiendo ver nuestra sección de 'Preguntas Frecuentes' o consultar por el stock de un producto.";
}