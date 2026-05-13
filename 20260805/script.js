// Configuración inicial
let numeroSecreto = Math.floor(Math.random() * 10) + 1;
let vidas = 3;
let juegoTerminado = false;

// Referencias a elementos del DOM
const inputNumero = document.getElementById('input-numero');
const mensajeSalida = document.getElementById('mensaje-salida');
const textoVidas = document.getElementById('texto-vidas');
const btnJugar = document.getElementById('btn-jugar');

function comprobarNumero() {
    if (juegoTerminado) {
        reiniciarJuego();
        return;
    }

    const intento = parseInt(inputNumero.value);

    // Validación de entrada
    if (isNaN(intento) || intento < 1 || intento > 10) {
        mensajeSalida.textContent = "❌ Por favor, elige un número entre 1 y 10.";
        mensajeSalida.style.color = "#e67e22";
        return;
    }

    if (intento === numeroSecreto) {
        // El usuario gana
        mensajeSalida.textContent = "🎉 ¡FELICIDADES! Has adivinado el número.";
        mensajeSalida.style.color = "#27ae60";
        finalizarJuego("¡JUGAR DE NUEVO!");
    } else {
        // El usuario falla
        vidas--;
        actualizarVidas();

        if (vidas > 0) {
            mensajeSalida.textContent = intento > numeroSecreto ? "📉 Muy alto. ¡Prueba otra vez!" : "📈 Muy bajo. ¡Prueba otra vez!";
            mensajeSalida.style.color = "#c0392b";
        } else {
            // El usuario pierde
            mensajeSalida.textContent = `💀 GAME OVER. El número era el ${numeroSecreto}.`;
            mensajeSalida.style.color = "#333";
            finalizarJuego("REINTENTAR");
        }
    }

    inputNumero.value = "";
    inputNumero.focus();
}

function actualizarVidas() {
    let corazones = "";
    for (let i = 0; i < vidas; i++) {
        corazones += "❤️";
    }
    textoVidas.textContent = `Vidas: ${vidas} ${corazones}`;
}

function finalizarJuego(textoBoton) {
    juegoTerminado = true;
    btnJugar.textContent = textoBoton;
    btnJugar.style.backgroundColor = "#2c3e50";
    inputNumero.disabled = true;
}

function reiniciarJuego() {
    numeroSecreto = Math.floor(Math.random() * 10) + 1;
    vidas = 3;
    juegoTerminado = false;
    
    actualizarVidas();
    mensajeSalida.textContent = "¡Haz tu primer intento!";
    mensajeSalida.style.color = "#333";
    btnJugar.textContent = "Probar suerte";
    btnJugar.style.backgroundColor = "#b82309f1";
    inputNumero.disabled = false;
    inputNumero.value = "";
    inputNumero.focus();
}

// Permitir presionar "Enter" para jugar
inputNumero.addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        comprobarNumero();
    }
});