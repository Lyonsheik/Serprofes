// --- BASE DE DATOS AMPLIADA ---
const socialDB = {
    users: JSON.parse(localStorage.getItem('social_users')) || [],
    posts: JSON.parse(localStorage.getItem('social_posts')) || [],
    currentUser: null,
    tempMedia: null 
};

// --- UTILIDADES ---
function toggleModal(show, content = '') {
    const modal = document.getElementById('modalOverlay');
    const container = document.getElementById('modalFormContainer');
    if (show) {
        container.innerHTML = content;
        modal.style.display = 'flex';
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

    // Añadimos 'available: true' por defecto para los nuevos registros
    socialDB.users.push({ name, username: user, pass: pass, available: true });
    localStorage.setItem('social_users', JSON.stringify(socialDB.users));
    
    alert("¡Cuenta creada con éxito!");
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

// --- RENDERIZADO DEL MURO Y SIDEBAR ---
function renderFeed() {
    // 1. Sidebar de Usuarios
    const usersList = document.getElementById('usersList');
    if(usersList) {
        usersList.innerHTML = socialDB.users.map(u => `
            <div class="user-item">
                <div style="position:relative">
                    <div class="user-avatar" style="width:35px; height:35px; font-size:12px">${u.name[0]}</div>
                    <span class="status-dot ${u.available ? 'online' : 'offline'}" 
                          style="position:absolute; bottom:0; right:0"></span>
                </div>
                <div>
                    <div style="font-size:14px; font-weight:600">${u.name}</div>
                    <div style="font-size:11px; color:#888">${u.available ? 'Disponible' : 'Ocupado'}</div>
                </div>
            </div>
        `).join('');
    }

    // 2. Navbar con Selector de Estado
    const authBtns = document.getElementById('authBtns');
    if(authBtns) {
        authBtns.innerHTML = `
            <div style="display:flex; align-items:center; gap:15px">
                <select onchange="updateStatus(this.value)" style="border:none; background:none; font-weight:600; color:#c639b8; cursor:pointer">
                    <option value="true" ${socialDB.currentUser.available ? 'selected' : ''}>🟢 En línea</option>
                    <option value="false" ${!socialDB.currentUser.available ? 'selected' : ''}>🔘 Ocupado</option>
                </select>
                <button class="logn-btn" onclick="location.reload()" style="margin:0">Salir</button>
            </div>
        `;
    }

    // 3. Contenedor de Posts
    const appContent = document.getElementById('appContent');
    appContent.innerHTML = `
        <div class="feed-container anim show" style="margin-right: 300px;">
            <div class="create-post-card">
                <h3>Hola, ${socialDB.currentUser.name}</h3>
                <textarea id="newPostTxt" placeholder="Comparte algo especial..."></textarea>
                
                <div id="previewBox" class="media-preview-container" style="display: none;">
                    <img id="imgPrev" src="">
                    <button onclick="removeMedia()" class="remove-media-btn">×</button>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px">
                    <label class="btn-media" style="cursor:pointer">
                        <i class="fa-solid fa-image"></i> Multimedia
                        <input type="file" id="mediaInput" hidden accept="image/*" onchange="handleMedia(this)">
                    </label>
                    <button class="btn-join" onclick="publishPost()">Publicar</button>
                </div>
            </div>
            <div id="postsWrapper">
                ${socialDB.posts.map((post, index) => `
                    <div class="post-card anim show">
                        <div class="post-header" style="display:flex; justify-content: space-between; align-items:center;">
                            <div style="display: flex; gap: 12px; align-items: center;">
                                <div class="user-avatar">${post.author[0].toUpperCase()}</div>
                                <div><strong>${post.author}</strong><br><small>${post.date}</small></div>
                            </div>
                            ${post.author === socialDB.currentUser.name ? `
                                <div style="display: flex; gap: 10px; color: #888;">
                                    <i class="fa-solid fa-pen" onclick="editPost(${index})" style="cursor:pointer"></i>
                                    <i class="fa-solid fa-trash" onclick="deletePost(${index})" style="cursor:pointer"></i>
                                </div>
                            ` : ''}
                        </div>
                        <div class="post-content" style="margin-top:15px">${post.content}</div>
                        ${post.media ? `<img src="${post.media}" class="post-media-content">` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// --- LOGICA MULTIMEDIA ---
window.handleMedia = function(input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            socialDB.tempMedia = e.target.result;
            document.getElementById('imgPrev').src = e.target.result;
            document.getElementById('previewBox').style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
};

window.removeMedia = function() {
    socialDB.tempMedia = null;
    document.getElementById('previewBox').style.display = 'none';
    document.getElementById('mediaInput').value = "";
};

// --- ACTUALIZAR ESTADO ---
window.updateStatus = function(val) {
    const status = val === "true";
    socialDB.currentUser.available = status;
    const idx = socialDB.users.findIndex(u => u.username === socialDB.currentUser.username);
    socialDB.users[idx].available = status;
    localStorage.setItem('social_users', JSON.stringify(socialDB.users));
    renderFeed();
};

// --- PUBLICAR CON MEDIA ---
window.publishPost = function() {
    const txt = document.getElementById('newPostTxt').value;
    if(!txt.trim() && !socialDB.tempMedia) return alert("Escribe algo o sube una imagen");

    const now = new Date();
    socialDB.posts.unshift({
        author: socialDB.currentUser.name,
        content: txt,
        media: socialDB.tempMedia,
        date: now.toLocaleTimeString()
    });

    localStorage.setItem('social_posts', JSON.stringify(socialDB.posts));
    socialDB.tempMedia = null;
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