// --- DATOS INICIALES (Simulando una base de datos) ---
let usuarios = [
    { nombre: "Jorge Daniel", email: "jorge@agencia.com", rol: "Admin" },
    { nombre: "Laura Paz", email: "laura@agencia.com", rol: "Editor" },
    { nombre: "Jose Manuel", email: "jose@agencia.com", rol: "Usuario" },
    { nombre: "Rafal Wysocki", email: "rafal@agencia.com", rol: "Editor" },
    { nombre: "Lewis Sanchez", email: "lewis@agencia.com", rol: "Usuario" }
];

// --- REFERENCIAS AL DOM ---
const tablaCuerpo = document.getElementById('tablaCuerpo');
const formulario = document.getElementById('suscripcionForm');
const editIndex = document.getElementById('editIndex');
const buscador = document.getElementById('buscadorUsuarios');
const btnCancel = document.getElementById('btn-cancel');
const formTitle = document.getElementById('form-title');

// --- 1. RENDERIZAR TABLA (Read) ---
function renderizarTabla(filtro = '') {
    tablaCuerpo.innerHTML = '';
    const termino = filtro.toLowerCase();

    usuarios.forEach((user, index) => {
        // Lógica del buscador
        if (user.nombre.toLowerCase().includes(termino) || 
            user.email.toLowerCase().includes(termino) || 
            user.rol.toLowerCase().includes(termino)) {
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.nombre}</td>
                <td>${user.email}</td>
                <td><span class="rol-badge">${user.rol}</span></td>
                <td>
                    <button class="btn-action btn-edit" onclick="editarUsuario(${index})"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-action btn-delete" onclick="eliminarUsuario(${index})"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tablaCuerpo.appendChild(tr);
        }
    });
}

// --- 2. AÑADIR / MODIFICAR USUARIO (Create / Update) ---
formulario.addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = document.getElementById('nombreInput').value;
    const email = document.getElementById('emailInput').value;
    const rol = document.getElementById('rolInput').value;
    const index = parseInt(editIndex.value);

    if (index === -1) {
        // Crear nuevo
        usuarios.push({ nombre, email, rol });
        mostrarAlerta('mensajeExito', 'Usuario añadido correctamente.');
    } else {
        // Actualizar existente
        usuarios[index] = { nombre, email, rol };
        mostrarAlerta('mensajeExito', 'Usuario actualizado correctamente.');
        resetFormulario();
    }

    renderizarTabla(buscador.value);
    formulario.reset();
});

// --- 3. ELIMINAR USUARIO (Delete) ---
function eliminarUsuario(index) {
    if (confirm(`¿Estás seguro de que deseas eliminar a ${usuarios[index].nombre}?`)) {
        usuarios.splice(index, 1);
        renderizarTabla(buscador.value);
    }
}

// --- 4. EDITAR USUARIO (Cargar datos en el form) ---
function editarUsuario(index) {
    const user = usuarios[index];
    document.getElementById('nombreInput').value = user.nombre;
    document.getElementById('emailInput').value = user.email;
    document.getElementById('rolInput').value = user.rol;
    
    editIndex.value = index;
    formTitle.textContent = "Editar Suscriptor";
    btnCancel.classList.remove('oculto');
    document.getElementById('btn-submit').textContent = "Actualizar Usuario";
}

// Botón cancelar edición
btnCancel.addEventListener('click', resetFormulario);

function resetFormulario() {
    formulario.reset();
    editIndex.value = -1;
    formTitle.textContent = "Añadir Suscriptor";
    btnCancel.classList.add('oculto');
    document.getElementById('btn-submit').textContent = "Guardar Usuario";
}

// --- 5. BUSCADOR EN TIEMPO REAL ---
buscador.addEventListener('keyup', (e) => {
    renderizarTabla(e.target.value);
});

// --- 6. SISTEMA DE PESTAÑAS (Navegación) ---
const navButtons = document.querySelectorAll('.nav-btn');
const panels = document.querySelectorAll('.panel-section');
const headerTitle = document.getElementById('header-title');
const headerDesc = document.getElementById('header-desc');

const titles = {
    'panel-usuarios': { title: 'Gestión de Usuarios', desc: 'Administra suscripciones, roles y accesos.' },
    'panel-correo': { title: 'Bandeja de Correo', desc: 'Envía y gestiona comunicados a los usuarios.' },
    'panel-chat': { title: 'Chat en Tiempo Real', desc: 'Comunicación instantánea con el equipo.' }
};

navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        // Quitar activos
        navButtons.forEach(b => b.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        
        // Poner activo el clickeado
        btn.classList.add('active');
        const target = btn.getAttribute('data-target');
        document.getElementById(target).classList.add('active');

        // Actualizar Header
        headerTitle.textContent = titles[target].title;
        headerDesc.textContent = titles[target].desc;
    });
});

// --- 7. PANEL DE CORREO (Simulación) ---
document.getElementById('mailForm').addEventListener('submit', (e) => {
    e.preventDefault();
    mostrarAlerta('mailAlerta', 'El correo ha sido enviado correctamente por el servidor SMTP.');
    e.target.reset();
});

// --- 8. CHAT EN TIEMPO REAL (Simulación UI) ---
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatWindow = document.getElementById('chatWindow');

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const texto = chatInput.value.trim();
    if (!texto) return;

    const div = document.createElement('div');
    div.classList.add('mensaje', 'enviado');
    
    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    div.innerHTML = `
        <span class="user">Tú</span>
        <p>${texto}</p>
        <span class="time">${hora}</span>
    `;
    
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight; // Auto-scroll
    chatInput.value = '';
});

// --- UTILIDAD: Mostrar Alertas Temporales ---
function mostrarAlerta(idElemento, mensaje) {
    const alerta = document.getElementById(idElemento);
    alerta.textContent = mensaje;
    alerta.classList.remove('oculto');
    setTimeout(() => {
        alerta.classList.add('oculto');
    }, 3000);
}

// Inicializar tabla al cargar
renderizarTabla();

