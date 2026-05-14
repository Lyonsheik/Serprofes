const carrito = [
    { nombre: "🍞 Pan de molde", precio: 1.20 },
    { nombre: "🥛 Leche entera", precio: 0.90 },
    { nombre: "🥚 Huevos Camperos", precio: 2.50 },
    { nombre: "🥑 Aguacate", precio: 1.00 },
    { nombre: "🥩 Filete de Ternera", precio: 5.75 },
    { nombre: "🍝 Pasta Italiana", precio: 1.45 },
    { nombre: "🍎 Manzanas (1kg)", precio: 2.10 },
    { nombre: "🧀 Queso Curado", precio: 3.80 },
    { nombre: "☕ Café Molido", precio: 2.95 },
    { nombre: "🧼 Detergente", precio: 4.20 }
];

// Dibujar productos en el ticket al cargar
const listaHTML = document.getElementById('lista-producto');
if (listaHTML) {
    carrito.forEach(p => {
        listaHTML.innerHTML += `<li><span>${p.nombre}</span><span>${p.precio.toFixed(2)}€</span></li>`;
    });
}

function obtenerSubtotal() {
    return carrito.reduce((total, p) => total + p.precio, 0);
}

function cobrar() {
    const subtotal = obtenerSubtotal();
    const iva = subtotal * 0.21;
    const totalFinal = subtotal + iva;
    
    actualizarUI(subtotal, iva, totalFinal);
    generarQR(totalFinal);
}

function aplicarDescuento(porcentaje) {
    const subtotal = obtenerSubtotal();
    const iva = subtotal * 0.21;
    const totalBase = subtotal + iva;
    const ahorro = totalBase * (porcentaje / 100);
    const totalFinal = totalBase - ahorro;

    actualizarUI(subtotal, iva, totalFinal, porcentaje);
    generarQR(totalFinal, porcentaje);
}

function actualizarUI(sub, tax, final, dto = 0) {
    let html = `Subtotal: ${sub.toFixed(2)}€ <br> IVA (21%): ${tax.toFixed(2)}€ <br>`;
    if (dto > 0) html += `<span style="color: #27ae60;">Descuento ${dto}% aplicado</span><br>`;
    html += `<strong>TOTAL: ${final.toFixed(2)}€</strong>`;
    
    const resultadoHTML = document.getElementById('resultado-total');
    if (resultadoHTML) {
        resultadoHTML.innerHTML = html;
    }
}

function generarQR(total, dto = 0) {
    const contenedor = document.getElementById('contenedor-qr');
    const imgQR = document.getElementById('codigo-qr');
    
    if (contenedor && imgQR) {
        const fecha = new Date().toLocaleString();
        let datos = `TICKET COMPRA\nFecha: ${fecha}\nTotal: ${total.toFixed(2)}€`;
        if(dto > 0) datos += `\nDesc: ${dto}%`;

        const url = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(datos)}`;
        
        imgQR.src = url;
        contenedor.style.display = "block";
    }
}

function imprimirTicket() {
    window.print();
}