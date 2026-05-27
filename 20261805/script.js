// VARIABLES DEL PANEL DE METRICAS (CARRERAS)
const btnContar = document.querySelector('#countBtn');
const spanCount = document.querySelector('#count');
const pantallaMeta = document.querySelector('#pantallaMeta');
const btnCerrarMeta = document.querySelector('#closeMetaBtn');
const cocheJuego = document.querySelector('#cocheJuego');

let contador = 0;
const coloresBtn = ['#ff1801', '#ffec00', '#ffffff', '#00a2ff', '#ff6a00'];

const sonidoMotor = new Audio('formula 1.mp3');

function reproducirSonido() {
    sonidoMotor.currentTime = 0; 
    sonidoMotor.play().catch(error => {
        console.log("Audio en espera de interacción inicial.");
    });
}

// LÓGICA DEL ACELERADOR
btnContar.addEventListener('click', () => {
    if (contador >= 50) return; 

    contador++;
    spanCount.textContent = contador;

    if (contador % 10 === 0 && contador < 50) {
        reproducirSonido();
    }

    const indiceColor = Math.floor(contador / 10) % coloresBtn.length;
    btnContar.style.backgroundColor = coloresBtn[indiceColor];
    
    if (indiceColor === 2 || indiceColor === 1) { 
        btnContar.style.color = '#111'; 
    } else {
        btnContar.style.color = '#fff'; 
    }

    if (contador === 50) {
        btnContar.classList.add('btn-deshabilitado');
        btnContar.textContent = "MOTOR AL LÍMITE (MÁX)";
        reproducirSonido();
        pantallaMeta.classList.remove('oculto-meta');
        cocheJuego.classList.add('animar-carrera'); 
    }
});

btnCerrarMeta.addEventListener('click', () => {
    pantallaMeta.classList.add('oculto-meta');
    cocheJuego.classList.remove('animar-carrera');
});

// LÓGICA DEL MENÚ DESPLEGABLE CENTRAL
const btnToggle = document.querySelector('#toggleMenu');
const nav = document.querySelector('#mainNav');

btnToggle.addEventListener('click', () => {
    nav.classList.toggle('oculto');
    const estaOculto = nav.classList.contains('oculto');
    btnToggle.textContent = estaOculto ? 'Abrir Panel de Telemetría' : 'Cerrar Panel de Telemetría';
});

// INTERRUPTORES DE PANELES DE TELEMETRÍA INTERACTIVOS
const btnMenuEcu = document.querySelector('#btnMenuEcu');
const btnMenuTyres = document.querySelector('#btnMenuTyres');
const welcomeTelemetry = document.querySelector('#welcomeTelemetry');
const paneEcu = document.querySelector('#paneEcu');
const paneTyres = document.querySelector('#paneTyres');

function limpiarPanelesTelemetria() {
    welcomeTelemetry.classList.add('oculto');
    paneEcu.classList.add('oculto');
    paneTyres.classList.add('oculto');
}

// 1. GESTIÓN INTERACTIVA DEL MAPA DE MOTOR (CANVAS)
const carModelSelect = document.querySelector('#carModel');
const txtEcuPower = document.querySelector('#txtEcuPower');
const ecuCanvas = document.querySelector('#ecuCanvas');

btnMenuEcu.addEventListener('click', () => {
    limpiarPanelesTelemetria();
    paneEcu.classList.remove('oculto');
    dibujarMapaMotor();
});

carModelSelect.addEventListener('change', () => {
    dibujarMapaMotor();
});

function dibujarMapaMotor() {
    if (!ecuCanvas) return;
    const ctx = ecuCanvas.getContext('2d');
    ctx.clearRect(0, 0, ecuCanvas.width, ecuCanvas.height);
    
    const modelo = carModelSelect.value;
    let colorCurva = '#ff1801'; // Ferrari
    let maxPower = "985 HP";
    let seed = 1;

    if (modelo === 'redbull') {
        colorCurva = '#001a30';
        colorCurva = '#00a2ff';
        maxPower = "1010 HP";
        seed = 1.3;
    } else if (modelo === 'mercedes') {
        colorCurva = '#00a398';
        maxPower = "998 HP";
        seed = 0.8;
    }

    txtEcuPower.textContent = maxPower;

    // Dibujar rejilla de fondo de telemetría
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for(let i = 0; i < ecuCanvas.width; i += 20) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, ecuCanvas.height); ctx.stroke();
    }
    for(let j = 0; j < ecuCanvas.height; j += 20) {
        ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(ecuCanvas.width, j); ctx.stroke();
    }

    // Dibujar curva matemática real de Torque/Potencia simulada
    ctx.beginPath();
    ctx.strokeStyle = colorCurva;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 8;
    ctx.shadowColor = colorCurva;

    ctx.moveTo(10, ecuCanvas.height - 10);
    for (let x = 10; x < ecuCanvas.width - 10; x++) {
        // Ecuación matemática dependiente del modelo para dar formas de curvas distintas
        let calcY = (ecuCanvas.height - 20) - (Math.sin((x / 100) * seed) * 100 + (x * 0.2));
        ctx.lineTo(x, calcY);
    }
    ctx.stroke();
    ctx.shadowBlur = 0; // reset
}

// 2. GESTIÓN INTERACTIVA DE PRESIÓN DE NEUMÁTICOS (ANIMACIÓN HIPERREALISTA)
const btnScanTyres = document.querySelector('#btnScanTyres');
const scanProgress = document.querySelector('#scanProgress');
const scanStatus = document.querySelector('#scanStatus');

const tyreIds = ['#tyreFL', '#tyreFR', '#tyreRL', '#tyreRR'];
const pressIds = ['#pressFL', '#pressFR', '#pressRL', '#pressRR'];

btnMenuTyres.addEventListener('click', () => {
    limpiarPanelesTelemetria();
    paneTyres.classList.remove('oculto');
});

btnScanTyres.addEventListener('click', () => {
    btnScanTyres.disabled = true;
    scanStatus.textContent = "ESCANEANDO...";
    scanStatus.style.color = "#ffec00";
    
    // Reset visual
    tyreIds.forEach(id => {
        let el = document.querySelector(id);
        el.style.backgroundColor = 'rgba(0,0,0,0.4)';
        el.style.boxShadow = 'none';
    });
    pressIds.forEach(id => document.querySelector(id).textContent = "--.-");

    let progreso = 0;
    let step = 0;

    const interval = setInterval(() => {
        progreso += 2.5;
        scanProgress.style.width = `${progreso}%`;

        // Activar neumáticos de forma secuencial imitando un barrido láser térmico
        if (progreso >= 25 && step === 0) {
            actualizarNeumatico('#tyreFL', '#pressFL', 22.4, '#00ff66'); // Presión óptima (Verde)
            step = 1;
        }
        if (progreso >= 50 && step === 1) {
            actualizarNeumatico('#tyreFR', '#pressFR', 22.6, '#00ff66');
            step = 2;
        }
        if (progreso >= 75 && step === 2) {
            actualizarNeumatico('#tyreRL', '#pressRL', 19.1, '#ff1801'); // Baja presión (Alerta roja)
            step = 3;
        }
        if (progreso >= 100) {
            clearInterval(interval);
            actualizarNeumatico('#tyreRR', '#pressRR', 21.2, '#ffec00'); // Advertencia fría (Amarillo)
            scanStatus.textContent = "CONCLUIDO - REVISAR TRASERO IZQ.";
            scanStatus.style.color = "#ff1801";
            btnScanTyres.disabled = false;
        }
    }, 50);
});

function actualizarNeumatico(tyreId, pressId, value, colorHex) {
    const elTyre = document.querySelector(tyreId);
    const elPress = document.querySelector(pressId);
    
    elPress.textContent = value.toFixed(1);
    elPress.style.color = colorHex;
    elTyre.style.backgroundColor = colorHex;
    elTyre.style.boxShadow = `0 0 15px ${colorHex}`;
}

// MODALES & PAYPAL
const modalInscripcion = document.querySelector('#modalInscripcion');
const btnAbrirInscripcion = document.querySelector('#btnAbrirInscripcion');
const btnCerrarInscripcion = document.querySelector('#btnCerrarInscripcion');
const btnPagarPaypal = document.querySelector('#btnPagarPaypal');

btnAbrirInscripcion.addEventListener('click', () => {
    modalInscripcion.classList.remove('oculto-f1');
    nav.classList.add('oculto');
    btnToggle.textContent = 'Abrir Panel de Telemetría';
});

btnCerrarInscripcion.addEventListener('click', () => {
    modalInscripcion.classList.add('oculto-f1');
});

window.addEventListener('click', (e) => {
    if (e.target === modalInscripcion) {
        modalInscripcion.classList.add('oculto-f1');
    }
});

btnPagarPaypal.addEventListener('click', () => {
    const paypalUrl = "https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=tu-correo@escuderia.com&item_name=Super_Licencia_F1_Hub&amount=150.00&currency_code=EUR";
    alert('Redirigiendo de forma segura a la pasarela oficial de PayPal...');
    window.open(paypalUrl, '_blank');
});

// CONTROL DE CAMBIO DE TEMA
const toggleOscuro = document.querySelector('#themeToggle');
const textoSwitch = document.querySelector('.switch-text');
const cuerpoWeb = document.body;

const temaGuardado = localStorage.getItem('temaPreferido');

if (temaGuardado === 'claro') {
    cuerpoWeb.classList.add('light-theme');
    cuerpoWeb.classList.remove('dark-theme');
    toggleOscuro.checked = false;
    textoSwitch.textContent = 'Modo Paddock Tradicional';
} else {
    cuerpoWeb.classList.add('dark-theme');
    cuerpoWeb.classList.remove('light-theme');
    toggleOscuro.checked = true;
    textoSwitch.textContent = 'Modo Paddock Nocturno';
}

toggleOscuro.addEventListener('change', () => {
    if (toggleOscuro.checked) {
        cuerpoWeb.classList.add('dark-theme');
        cuerpoWeb.classList.remove('light-theme');
        localStorage.setItem('temaPreferido', 'oscuro');
        textoSwitch.textContent = 'Modo Paddock Nocturno';
    } else {
        cuerpoWeb.classList.add('light-theme');
        cuerpoWeb.classList.remove('dark-theme');
        localStorage.setItem('temaPreferido', 'claro');
        textoSwitch.textContent = 'Modo Paddock Tradicional';
    }
});