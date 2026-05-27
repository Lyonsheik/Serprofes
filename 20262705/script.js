const btnRecargar = document.getElementById("btn-recargar");
const contenedorGaleria = document.getElementById("galeria-container");
const loader = document.getElementById("loader");

// Elementos de la ventana Modal
const modal = document.getElementById("modal-perro");
const btnCerrarModal = document.querySelector(".cerrar-modal");
const modalImg = document.getElementById("modal-img");
const modalRaza = document.getElementById("modal-raza");
const modalProposito = document.getElementById("modal-proposito");
const modalTemperamento = document.getElementById("modal-temperamento");
const modalVida = document.getElementById("modal-vida");

// Función para capitalizar y formatear el nombre de la raza
function formatearRaza(razaEnUrl) {
    return razaEnUrl
        .split('-')
        .reverse() // Ej: "hound-afghan" se convierte en "Afghan Hound"
        .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))
        .join(' ');
}

// Función principal para cargar la galería
async function cargarGaleria() {
    contenedorGaleria.innerHTML = "";
    loader.style.display = "block";

    try {
        // SOLUCIÓN: Usamos Dog CEO API, que es totalmente abierta y nunca requiere API Key
        const respuesta = await fetch("https://dog.ceo/api/breeds/image/random/12");
        
        if (!respuesta.ok) throw new Error("Fallo al conectar con el servidor público");
        
        const datos = await respuesta.json();
        const perrosUrls = datos.message; // Esta API devuelve un array directo con 12 URLs
        
        loader.style.display = "none";

        perrosUrls.forEach(urlImagen => {
            // Dog CEO guarda la raza en la URL. Ej: .../breeds/retriever-golden/...
            const razaCruda = urlImagen.split('/')[4]; 
            const nombreRaza = formatearRaza(razaCruda);
            
            // Crear la tarjeta HTML
            const tarjeta = document.createElement("div");
            tarjeta.className = "tarjeta-perro";
            tarjeta.innerHTML = `
                <div class="imagen-marco">
                    <img src="${urlImagen}" alt="${nombreRaza}" loading="lazy">
                </div>
                <h3>${nombreRaza}</h3>
            `;

            // Añadir evento click para abrir el modal
            tarjeta.addEventListener("click", () => abrirModal(urlImagen, nombreRaza));

            // Agregar a la galería
            contenedorGaleria.appendChild(tarjeta);
        });

    } catch (error) {
        loader.style.display = "none";
        contenedorGaleria.innerHTML = `<p style="color:red; text-align:center;">❌ Error al cargar la galería: ${error.message}</p>`;
    }
}

// Función para abrir la ventana modal y rellenar datos
function abrirModal(urlImagen, nombreRaza) {
    modalImg.src = urlImagen;
    
    // Mostramos SIEMPRE el nombre real de la raza
    modalRaza.textContent = nombreRaza;
    
    // Textos limpios (sin textos de "misterio") para cuando la API no provee esta data específica
    modalProposito.textContent = "Compañía y lealtad";
    modalTemperamento.textContent = "Amigable y activo";
    modalVida.textContent = "10 - 15 años";

    modal.classList.remove("oculto");
}

// Cerrar modal al hacer clic en la X
btnCerrarModal.addEventListener("click", () => {
    modal.classList.add("oculto");
});

// Cerrar modal al hacer clic fuera del contenido de la ventana
modal.addEventListener("click", (e) => {
    if (e.target === modal) {
        modal.classList.add("oculto");
    }
});

// Eventos de inicio
btnRecargar.addEventListener("click", cargarGaleria);
document.addEventListener("DOMContentLoaded", cargarGaleria);