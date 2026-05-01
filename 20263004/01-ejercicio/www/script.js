// 1. Datos para los Modales Informativos
const infoData = {
    features: {
        title: "Amazing Features",
        content: "Discover smart matching, real-time video chats, and community events tailored to your interests. Our AI helps you find people you'll actually click with."
    },
    works: {
        title: "How it Works",
        content: "1. Create your profile. <br> 2. Set your interests. <br> 3. Start connecting! Sociality uses proximity and compatibility to bring friends together."
    },
    privacy: {
        title: "Your Privacy Matters",
        content: "We use end-to-end encryption for all chats. Your location data is only shared with your explicit permission. We never sell your data to third parties."
    }
};

// 2. Selección de elementos globales
const modal = document.getElementById('modalOverlay');
const modalContent = document.getElementById('modalContent');
const closeModal = document.getElementById('closeModal');
const imageSide = document.querySelector('.image-side');
const buttons = document.querySelectorAll('.btn-download, .btn-join, .logn-btn');
const downloadBtn = document.querySelector('.btn-download');

// 3. Funciones de Control del Modal
const openModal = (html) => {
    modalContent.innerHTML = html;
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
};

const hideModal = () => {
    modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none';
        modalContent.innerHTML = '';
    }, 300);
};

// 4. Eventos para abrir Modales Informativos
document.getElementById('featLink').onclick = (e) => {
    e.preventDefault();
    openModal(`<h2>${infoData.features.title}</h2><p>${infoData.features.content}</p>`);
};

document.getElementById('workLink').onclick = (e) => {
    e.preventDefault();
    openModal(`<h2>${infoData.works.title}</h2><p>${infoData.works.content}</p>`);
};

document.getElementById('privLink').onclick = (e) => {
    e.preventDefault();
    openModal(`<h2>${infoData.privacy.title}</h2><p>${infoData.privacy.content}</p>`);
};

// 5. Modal de Log In
document.getElementById('loginBtn').onclick = (e) => {
    e.preventDefault();
    openModal(`
        <h2>Welcome Back!</h2>
        <p>Login to see what's new with your friends.</p>
        <form id="innerLoginForm">
            <input type="text" placeholder="Username" required style="margin-bottom:10px">
            <input type="password" placeholder="Password" required style="margin-bottom:15px">
            <button type="submit" class="btn-join" style="width:100%">Sign In</button>
        </form>
    `);
};

// 6. Modal de Join Now (Registro)
document.getElementById('joinBtn').onclick = (e) => {
    e.preventDefault();
    openModal(`
        <h2>Create Account</h2>
        <p>Join the community today!</p>
        <form id="innerJoinForm">
            <div class="form-group"><input type="text" placeholder="Full Name" required></div>
            <div class="form-group"><input type="email" placeholder="Email Address" required></div>
            <div class="form-group"><input type="text" placeholder="Home Address" required></div>
            <div class="form-group" style="display:flex; gap:10px;">
                <input type="number" placeholder="Age" style="flex:1">
                <select style="flex:2">
                    <option>Select Gender</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                </select>
            </div>
            <div class="form-group">
                <textarea placeholder="Tell us about your interests..." rows="3"></textarea>
            </div>
            <button type="submit" class="btn-join" style="width:100%">Register Now</button>
        </form>
    `);
};

// 7. Eventos de Cierre
closeModal.onclick = hideModal;
window.onclick = (e) => { if (e.target === modal) hideModal(); };

// 8. Lógica de Instalación de la Aplicación (PWA)
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

downloadBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
    } else {
        alert("Instalación: \n• Android/Windows: Usa Chrome/Edge y busca el icono de 'Instalar' en la barra. \n• iOS (iPhone): Pulsa 'Compartir' y luego 'Añadir a pantalla de inicio'.");
    }
});

// 9. Efecto Parallax (Escritorio)
document.addEventListener('mousemove', (e) => {
    if (window.innerWidth > 900 && imageSide) {
        let x = (window.innerWidth / 2 - e.pageX) / 60;
        let y = (window.innerHeight / 2 - e.pageY) / 60;
        imageSide.style.transform = `translate(${x}px, ${y}px)`;
    }
});

// 10. Feedback visual en botones
buttons.forEach(btn => {
    btn.addEventListener('mousedown', () => btn.style.transform = 'scale(0.95)');
    btn.addEventListener('mouseup', () => btn.style.transform = 'scale(1)');
    btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1)');
});

// 11. Manejo de Envío de Formularios
document.addEventListener('submit', (e) => {
    e.preventDefault();
    if(e.target.id === 'innerLoginForm' || e.target.id === 'innerJoinForm') {
        alert('Action successful! Welcome to Sociality.');
        hideModal();
    }
});