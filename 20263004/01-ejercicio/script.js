// --- BASE DE DATOS LOCAL ---
const socialDB = {
    users: JSON.parse(localStorage.getItem('social_users')) || [],
    posts: JSON.parse(localStorage.getItem('social_posts')) || [
        { author: "Admin", content: "¡Bienvenido a Sociality! Prueba a publicar algo.", date: "10/05/2026" }
    ],
    currentUser: null
};

// --- SELECTORES ---
const appContent = document.getElementById('appContent');
const modal = document.getElementById('modalOverlay');
const formContainer = document.getElementById('modalFormContainer');

// --- FUNCIONES DE NAVEGACIÓN ---
function toggleModal(show, content = '') {
    if (show) {
        formContainer.innerHTML = content;
        modal.style.display = 'flex';
        modal.offsetHeight; 
        modal.classList.add('active');
    } else {
        modal.classList.remove('active');
        setTimeout(() => { modal.style.display = 'none'; }, 400);
    }
}

// --- LOGICA DE REGISTRO ---
window.handleRegister = function() {
    const name = document.getElementById('regName').value;
    const user = document.getElementById('regUser').value;
    const pass = document.getElementById('regPass').value;

    if(!name || !user || !pass) return alert("Por favor, completa todos los campos");
    if(socialDB.users.find(u => u.username === user)) return alert("El usuario ya existe");

    socialDB.users.push({ name, username: user, pass: pass });
    localStorage.setItem('social_users', JSON.stringify(socialDB.users));
    
    alert("¡Cuenta creada con éxito! Ahora inicia sesión.");
    toggleModal(false);
};

// --- LOGICA DE LOGIN ---
window.handleLogin = function() {
    const userIn = document.getElementById('logUser').value;
    const passIn = document.getElementById('logPass').value;
    const found = socialDB.users.find(u => u.username === userIn && u.pass === passIn);

    if (found) {
        socialDB.currentUser = found;
        toggleModal(false);
        renderFeed();
    } else {
        alert("Usuario o contraseña incorrectos");
    }
};

// --- RENDERIZADO DEL MURO ---
function renderFeed() {
    const authBtns = document.getElementById('authBtns');
    if(authBtns) {
        authBtns.innerHTML = `
            <div style="display:flex; align-items:center; gap:15px">
                <span style="font-weight:600; color:#c639b8">@${socialDB.currentUser.username}</span>
                <button class="logn-btn" onclick="location.reload()" style="margin:0">Salir</button>
            </div>
        `;
    }

    appContent.innerHTML = `
        <div class="feed-container anim show">
            <div class="create-post-card">
                <h3>¿Qué piensas, ${socialDB.currentUser.name}?</h3>
                <textarea id="newPostTxt" placeholder="Escribe algo..."></textarea>
                <button class="btn-join" onclick="publishPost()">Publicar</button>
            </div>
            <div id="postsWrapper">
                ${socialDB.posts.map((post, index) => `
                    <div class="post-card anim show">
                        <div class="post-header" style="justify-content: space-between;">
                            <div style="display: flex; gap: 12px; align-items: center;">
                                <div class="user-avatar">${post.author[0].toUpperCase()}</div>
                                <div><strong>${post.author}</strong><br><small>${post.date}</small></div>
                            </div>
                            ${post.author === socialDB.currentUser.name ? `
                                <div style="display: flex; gap: 10px; color: #888;">
                                    <i class="fa-solid fa-pen" style="cursor:pointer" onclick="editPost(${index})" title="Editar"></i>
                                    <i class="fa-solid fa-trash" style="cursor:pointer" onclick="deletePost(${index})" title="Eliminar"></i>
                                </div>
                            ` : ''}
                        </div>
                        <div class="post-content">${post.content}</div>
                        <div class="post-actions">
                            <span><i class="fa-regular fa-heart"></i> Me gusta</span>
                            <span><i class="fa-regular fa-comment"></i> Comentar</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// --- PUBLICAR POST ---
window.publishPost = function() {
    const txt = document.getElementById('newPostTxt').value;
    if(!txt.trim()) return alert("¡No puedes publicar un mensaje vacío!");

    const now = new Date();
    const dateStr = `${now.getDate()}/${now.getMonth()+1} ${now.getHours()}:${now.getMinutes()}`;

    socialDB.posts.unshift({
        author: socialDB.currentUser.name,
        content: txt,
        date: dateStr
    });

    localStorage.setItem('social_posts', JSON.stringify(socialDB.posts));
    renderFeed(); 
};

// --- GESTIÓN DE POSTS (BORRAR Y EDITAR) ---
window.deletePost = function(index) {
    if (confirm("¿Estás seguro de que quieres eliminar esta publicación?")) {
        socialDB.posts.splice(index, 1);
        localStorage.setItem('social_posts', JSON.stringify(socialDB.posts));
        renderFeed();
    }
};

window.editPost = function(index) {
    const post = socialDB.posts[index];
    const newText = prompt("Edita tu publicación:", post.content);
    if (newText !== null && newText.trim() !== "") {
        socialDB.posts[index].content = newText;
        socialDB.posts[index].date += " (editado)";
        localStorage.setItem('social_posts', JSON.stringify(socialDB.posts));
        renderFeed();
    }
};

// --- MODALES INFORMATIVOS ---
window.showFeatures = () => {
    toggleModal(true, `
        <i class="fa-solid fa-rocket" style="font-size: 3.5rem; color: #c639b8; margin-bottom: 20px;"></i>
        <h2>Features</h2>
        <div style="text-align: left; line-height: 1.8; color: #555; padding: 10px;">
            <p><i class="fa-solid fa-check" style="color: #e91e63;"></i> Feed en Tiempo Real</p>
            <p><i class="fa-solid fa-check" style="color: #e91e63;"></i> Diseño Adaptativo</p>
            <p><i class="fa-solid fa-check" style="color: #e91e63;"></i> Perfiles Personalizados</p>
        </div>
    `);
};

window.showHowItWorks = () => {
    toggleModal(true, `
        <i class="fa-solid fa-wand-magic-sparkles" style="font-size: 3.5rem; color: #e91e63; margin-bottom: 20px;"></i>
        <h2>¿Cómo funciona?</h2>
        <p>1. Regístrate en segundos.</p>
        <p>2. Conecta con amigos.</p>
        <p>3. Comparte tu mundo.</p>
    `);
};

window.showPrivacy = () => {
    toggleModal(true, `
        <i class="fa-solid fa-user-shield" style="font-size: 3.5rem; color: #333; margin-bottom: 20px;"></i>
        <h2>Privacidad</h2>
        <p>Tus datos están protegidos con tecnología de punta y encriptación total.</p>
    `);
};

// --- EVENTOS DE BOTONES ---
document.getElementById('openRegister').onclick = () => {
    toggleModal(true, `
        <h2>Únete a la comunidad</h2>
        <input type="text" id="regName" placeholder="Tu nombre real">
        <input type="text" id="regUser" placeholder="Nombre de usuario">
        <input type="password" id="regPass" placeholder="Contraseña segura">
        <button class="btn-join" onclick="handleRegister()" style="width:100%">Crear mi cuenta</button>
    `);
};

document.getElementById('openLogin').onclick = () => {
    toggleModal(true, `
        <h2>Bienvenido de nuevo</h2>
        <input type="text" id="logUser" placeholder="Usuario">
        <input type="password" id="logPass" placeholder="Contraseña">
        <button class="btn-join" onclick="handleLogin()" style="width:100%">Entrar ahora</button>
    `);
};

document.getElementById('closeModal').onclick = () => toggleModal(false);

// --- INICIO ---
window.onload = () => {
    setTimeout(() => {
        document.querySelectorAll('.anim').forEach(el => el.classList.add('show'));
    }, 100);

    const heroBtn = document.getElementById('heroStartBtn');
    if(heroBtn) heroBtn.onclick = () => document.getElementById('openRegister').click();
};