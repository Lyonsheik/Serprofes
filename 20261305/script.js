const carrito = [
    { nombre: "🍞 Pan de molde", precio: 1.20 },
    { nombre: "🥛 Leche entera", precio: 0.90 },
    { nombre: "🥚 Huevos Camperos", precio: 2.50 },
    { nombre: "🥑 Aguacate", precio: 1.00 }
];

// Dibujar productos al cargar
let listaHTML = document.getElementById('lista-producto');
for (let i = 0; i < carrito.length; i++) {
    listaHTML.innerHTML += `
    <li>
        <span>${carrito[i].nombre}</span>
        <span>${carrito[i].precio.toFixed(2)}€</span>
    </li>`;
}

// Función base para obtener la suma de los productos
function obtenerSubtotal() {
    let suma = 0;
    for (let i = 0; i < carrito.length; i++) {
        suma += carrito[i].precio;
    }
    return suma;
}

// Función para mostrar el total normal
function cobrar() {
    const subtotal = obtenerSubtotal();
    const iva = subtotal * 0.21;
    const total = subtotal + iva;

    imprimirResultado(subtotal, iva, total);
}

// Función para aplicar un descuento (ej: 20)
function aplicarDescuento(porcentaje) {
    const subtotal = obtenerSubtotal();
    const iva = subtotal * 0.21;
    const totalConIva = subtotal + iva;

    // Cálculo del descuento
    const cantidadDescontada = totalConIva * (porcentaje / 100);
    const totalFinal = totalConIva - cantidadDescontada;

    imprimirResultado(subtotal, iva, totalFinal, porcentaje);
}

// Función para actualizar el texto en el HTML
function imprimirResultado(sub, tax, final, dto = 0) {
    let htmlContent = `
        Subtotal: ${sub.toFixed(2)}€ <br>
        IVA (21%): ${tax.toFixed(2)}€ <br>
    `;

    if (dto > 0) {
        htmlContent += `<span style="color: green;">Descuento aplicado: ${dto}%</span><br>`;
    }

    htmlContent += `<strong>Total: ${final.toFixed(2)}€</strong>`;
    
    document.getElementById('resultado-total').innerHTML = htmlContent;
}

function imprimirPDF() {
    // Primero nos aseguramos de que el total esté calculado antes de imprimir
    // Si quieres que imprima lo que hay actualmente, solo deja window.print()
    window.print();
}