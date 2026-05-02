/* ============================================================
   SOCIALITY — SCRIPT.JS
   Red Social Completa | Instagram + Facebook Style
   ============================================================ */

// ============================================================
// 1. BASE DE DATOS Y ESTADO GLOBAL
// ============================================================
const socialDB = {
    users: JSON.parse(localStorage.getItem('social_users')) || [],
    posts: JSON.parse(localStorage.getItem('social_posts')) || [],
    stories: JSON.parse(localStorage.getItem('social_stories')) || [],
    notifications: JSON.parse(localStorage.getItem('social_notifs')) || [],
    messages: JSON.parse(localStorage.getItem('social_messages')) || {},
    friendRequests: JSON.parse(localStorage.getItem('social_requests')) || [],
    currentUser: null,
    currentSection: 'inicio',
    activeChatUser: null,
    activeMessageUser: null,
    tempMedia: null,
    storyTimer: null,
    currentTheme: localStorage.getItem('social_theme') || 'light'
};

// ============================================================
// 2. UTILIDADES
// ============================================================
function saveDB() {
    localStorage.setItem('social_users', JSON.stringify(socialDB.users));
    localStorage.setItem('social_posts', JSON.stringify(socialDB.posts));
    localStorage.setItem('social_stories', JSON.stringify(socialDB.stories));
    localStorage.setItem('social_notifs', JSON.stringify(socialDB.notifications));
    localStorage.setItem('social_messages', JSON.stringify(socialDB.messages));
    localStorage.setItem('social_requests', JSON.stringify(socialDB.friendRequests));
}

function showToast(msg) {
    let t = document.getElementById('toastEl');
    if (!t) {
        t = document.createElement('div');
        t.id = 'toastEl';
        t.className = 'toast';
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2800);
}

function timeAgo(dateStr) {
    const now = new Date();
    const past = new Date(dateStr);
    const diff = Math.floor((now - past) / 1000);
    if (diff < 60) return 'Ahora mismo';
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
    return `Hace ${Math.floor(diff / 86400)} d`;
}

function getUser(username) {
    return socialDB.users.find(u => u.username === username);
}

function getCurrentUser() {
    return socialDB.currentUser;
}

function renderAvatar(user, size = 44) {
    const u = typeof user === 'string' ? getUser(user) : user;
    if (!u) return '';
    const name = u.name || u.username || '?';
    if (u.profilePic) {
        return `<img src="${u.profilePic}" alt="${name}" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:50%;">`;
    }
    return `<span style="font-size:${Math.floor(size * 0.4)}px;">${name[0].toUpperCase()}</span>`;
}

// ============================================================
// 3. TEMA CLARO / OSCURO
// ============================================================
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.getElementById('themeIcon');
    if (icon) {
        icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
    localStorage.setItem('social_theme', theme);
    socialDB.currentTheme = theme;
}

window.toggleTheme = function () {
    const next = socialDB.currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(next);
};

// ============================================================
// 4. MODALES (LANDING)
// ============================================================
function toggleModal(show, content = '') {
    const modal = document.getElementById('modalOverlay');
    const container = document.getElementById('modalFormContainer');
    if (show) {
        container.innerHTML = content;
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    } else {
        modal.classList.remove('active');
        setTimeout(() => { modal.style.display = 'none'; }, 400);
    }
}

window.openRecovery = () => {
    toggleModal(false);
    const m = document.getElementById('recoveryModal');
    m.style.display = 'flex';
    setTimeout(() => m.classList.add('active'), 10);
};

window.closeRecoveryModal = () => {
    const m = document.getElementById('recoveryModal');
    m.classList.remove('active');
    setTimeout(() => { m.style.display = 'none'; }, 400);
};

window.showFeatures = () => {
    toggleModal(true, `
        <h2>✨ Features</h2>
        <ul style="text-align:left; margin-top:20px; line-height:2.2; list-style:none; padding:0;">
            <li>🚀 Chat en tiempo real con emoticones</li>
            <li>📸 Publicaciones con imágenes</li>
            <li>🎭 Historias efímeras de 24h</li>
            <li>👥 Sistema de amigos con solicitudes</li>
            <li>🔔 Notificaciones en tiempo real</li>
            <li>🎬 Sección de Reels</li>
            <li>🌙 Modo oscuro / claro</li>
        </ul>
    `);
};

window.showHowItWorks = () => {
    toggleModal(true, `
        <h2>Cómo funciona</h2>
        <p style="margin-top:20px; line-height:1.8; color:#666;">
            Regístrate, personaliza tu perfil y empieza a conectar. Busca amigos, envía solicitudes, 
            sube historias y publica momentos. El chat te conecta en tiempo real con todos tus contactos.
        </p>
    `);
};

window.showPrivacy = () => {
    toggleModal(true, `
        <h2>Privacidad</h2>
        <p style="margin-top:20px; line-height:1.8; color:#666;">
            Tus datos están almacenados localmente y tú decides qué compartir. 
            En Sociality, la privacidad y el control son tuyos.
        </p>
    `);
};

// ============================================================
// 5. REGISTRO Y LOGIN
// ============================================================
window.handleRegister = function () {
    const name = document.getElementById('regName').value.trim();
    const user = document.getElementById('regUser').value.trim();
    const pass = document.getElementById('regPass').value;
    if (!name || !user || !pass) return showToast('⚠️ Completa todos los campos');
    if (socialDB.users.find(u => u.username === user)) return showToast('⚠️ El usuario ya existe');

    const newUser = {
        name, username: user, pass,
        available: true, bio: '', profilePic: '',
        friends: [], followers: [], following: [],
        createdAt: new Date().toISOString()
    };
    socialDB.users.push(newUser);
    saveDB();
    showToast('✅ ¡Cuenta creada! Ahora inicia sesión.');
    toggleModal(false);
};

window.handleLogin = function () {
    const userIn = document.getElementById('logUser').value.trim();
    const passIn = document.getElementById('logPass').value;
    const found = socialDB.users.find(u => u.username === userIn && u.pass === passIn);
    if (found) {
        // Refresh user data
        socialDB.currentUser = found;
        toggleModal(false);
        launchApp();
    } else {
        showToast('❌ Credenciales incorrectas');
    }
};

let userToRecover = null;

window.verifyUserForRecovery = () => {
    const username = document.getElementById('recoveryUser').value.trim();
    userToRecover = socialDB.users.find(u => u.username === username);
    if (userToRecover) {
        document.getElementById('recoveryStep2').style.display = 'block';
        document.getElementById('btnVerifyUser').style.display = 'none';
    } else {
        showToast('❌ Usuario no encontrado');
    }
};

window.handleResetPass = () => {
    const newPass = document.getElementById('newPass').value;
    if (!newPass) return showToast('⚠️ Introduce una contraseña');
    userToRecover.pass = newPass;
    saveDB();
    showToast('✅ Contraseña actualizada');
    closeRecoveryModal();
};

// ============================================================
// 6. LANZAR APP (POST-LOGIN)
// ============================================================
function launchApp() {
    document.getElementById('landingPage').style.display = 'none';
    document.getElementById('socialApp').style.display = 'flex';

    // Sidebar: nombre de usuario
    updateSidebarProfile();
    updateBadges();

    // Limpiar stories viejas (> 24h)
    cleanOldStories();

    switchSection('inicio');
}

function updateSidebarProfile() {
    const u = socialDB.currentUser;
    if (!u) return;
    const avatarEl = document.getElementById('sidebarAvatar');
    const nameEl = document.getElementById('sidebarName');
    const usernameEl = document.getElementById('sidebarUsername');

    avatarEl.innerHTML = renderAvatar(u, 38);
    if (!u.profilePic) {
        avatarEl.style.background = 'var(--gradient)';
        avatarEl.style.display = 'flex';
        avatarEl.style.alignItems = 'center';
        avatarEl.style.justifyContent = 'center';
        avatarEl.style.color = '#fff';
        avatarEl.style.fontWeight = '700';
    }
    nameEl.textContent = u.name;
    usernameEl.textContent = `@${u.username}`;
}

window.logoutUser = function () {
    socialDB.currentUser = null;
    socialDB.currentSection = 'inicio';
    document.getElementById('socialApp').style.display = 'none';
    document.getElementById('landingPage').style.display = 'block';
    showToast('👋 Sesión cerrada');
};

// ============================================================
// 7. NAVEGACIÓN DE SECCIONES
// ============================================================
const SECTION_TITLES = {
    inicio: 'Inicio',
    buscar: 'Buscar personas',
    amigos: 'Amigos',
    notificaciones: 'Notificaciones',
    mensajes: 'Mensajes',
    reels: 'Reels'
};

window.switchSection = function (section) {
    socialDB.currentSection = section;

    // Actualizar nav activo
    document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
    const navEl = document.getElementById(`nav-${section}`);
    if (navEl) navEl.classList.add('active');

    // Título
    const titleEl = document.getElementById('sectionTitle');
    if (titleEl) titleEl.textContent = SECTION_TITLES[section] || section;

    // Renderizar sección
    const area = document.getElementById('contentArea');
    if (!area) return;
    area.innerHTML = '';

    switch (section) {
        case 'inicio': renderInicio(area); break;
        case 'buscar': renderBuscar(area); break;
        case 'amigos': renderAmigos(area); break;
        case 'notificaciones': renderNotificaciones(area); break;
        case 'mensajes': renderMensajes(area); break;
        case 'reels': renderReels(area); break;
    }

    // Marcar notificaciones como vistas si se entra a esa sección
    if (section === 'notificaciones') {
        socialDB.notifications.forEach(n => {
            if (n.to === socialDB.currentUser.username) n.read = true;
        });
        saveDB();
        updateBadges();
    }
    if (section === 'mensajes') {
        // Marcar mensajes como leídos
        const key = socialDB.activeMessageUser;
        if (key) markMessagesRead(key);
        updateBadges();
    }

    // Renderizar sidebar derecho
    renderRightSidebar();
};

// ============================================================
// 8. BADGES (NOTIFICACIONES/MENSAJES/AMIGOS)
// ============================================================
function updateBadges() {
    const u = socialDB.currentUser;
    if (!u) return;

    // Notificaciones no leídas
    const unreadNotifs = socialDB.notifications.filter(n => n.to === u.username && !n.read).length;
    updateBadge('badge-notificaciones', unreadNotifs);

    // Solicitudes de amistad pendientes
    const pendingReqs = socialDB.friendRequests.filter(r => r.to === u.username && r.status === 'pending').length;
    updateBadge('badge-amigos', pendingReqs);

    // Mensajes no leídos
    let unreadMsgs = 0;
    const convs = socialDB.messages[u.username] || {};
    Object.values(convs).forEach(msgs => {
        msgs.forEach(m => { if (m.from !== u.username && !m.read) unreadMsgs++; });
    });
    updateBadge('badge-mensajes', unreadMsgs);
}

function updateBadge(id, count) {
    const el = document.getElementById(id);
    if (!el) return;
    if (count > 0) {
        el.style.display = 'flex';
        el.textContent = count > 99 ? '99+' : count;
    } else {
        el.style.display = 'none';
    }
}

// ============================================================
// 9. SECCIÓN INICIO (PERFIL + FEED)
// ============================================================
function renderInicio(area) {
    const u = socialDB.currentUser;
    const myPosts = socialDB.posts.filter(p => p.authorUsername === u.username);
    const friends = u.friends || [];

    area.innerHTML = `
        <!-- Perfil del usuario -->
        <div class="profile-info-card" id="profileCard">
            <div style="position:relative; margin-bottom:15px;">
                <div class="profile-cover" id="profileCoverEl" style="${u.coverPic ? `background-image:url(${u.coverPic}); background-size:cover; background-position:center;` : ''}">
                    <label style="position:absolute; bottom:10px; right:10px; cursor:pointer; background:rgba(0,0,0,0.5); color:#fff; padding:6px 12px; border-radius:15px; font-size:12px; display:flex; align-items:center; gap:5px;">
                        <i class="fa-solid fa-camera"></i> Portada
                        <input type="file" hidden accept="image/*" onchange="changeCoverPic(this)">
                    </label>
                </div>
                <div class="profile-pic-wrap">
                    <div class="profile-pic" id="profilePicEl">
                        ${u.profilePic ? `<img src="${u.profilePic}" alt="${u.name}">` : u.name[0].toUpperCase()}
                    </div>
                    <label class="edit-pic-btn">
                        <i class="fa-solid fa-camera"></i>
                        <input type="file" hidden accept="image/*" onchange="changeProfilePic(this)">
                    </label>
                </div>
            </div>
            <div style="padding-top:10px;">
                <div class="profile-name" id="profileNameDisplay">${u.name}</div>
                <div class="profile-username">@${u.username}</div>
                <div class="profile-bio-text" id="profileBioDisplay">${u.bio || '<span style="color:var(--text-muted)">Sin bio. Haz clic en Editar para añadir una.</span>'}</div>
                <div class="profile-stats">
                    <div class="stat-item">
                        <div class="stat-count" id="statPosts">${myPosts.length}</div>
                        <div class="stat-label">Publicaciones</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-count" id="statFollowers">${(u.followers || []).length}</div>
                        <div class="stat-label">Seguidores</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-count" id="statFollowing">${(u.following || []).length}</div>
                        <div class="stat-label">Seguidos</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-count">${friends.length}</div>
                        <div class="stat-label">Amigos</div>
                    </div>
                </div>
                <div class="profile-actions">
                    <button class="btn-outline" onclick="toggleEditProfile()">
                        <i class="fa-solid fa-pen"></i> Editar perfil
                    </button>
                    <button class="btn-outline" onclick="addStory()">
                        <i class="fa-solid fa-plus"></i> Añadir historia
                    </button>
                </div>
                <div id="editProfileForm" style="display:none; margin-top:14px;">
                    <input type="text" id="editNameInput" value="${u.name}" placeholder="Tu nombre" class="bio-edit-area" style="height:auto; padding:10px 14px; margin-bottom:8px;">
                    <textarea id="editBioInput" class="bio-edit-area" placeholder="Tu bio...">${u.bio || ''}</textarea>
                    <button class="btn-join" onclick="saveProfileChanges()" style="margin-top:10px; width:100%;">Guardar cambios</button>
                </div>
            </div>
        </div>

        <!-- Historias -->
        <div class="stories-row" id="storiesRow"></div>

        <!-- Crear publicación -->
        <div class="create-post-card">
            <div class="create-post-top">
                <div class="user-avatar">${renderAvatar(u, 44)}</div>
                <textarea id="newPostTxt" placeholder="¿Qué quieres compartir hoy, ${u.name.split(' ')[0]}?"></textarea>
            </div>
            <div id="previewBox" class="media-preview-container">
                <img id="imgPrev" src="" alt="preview">
                <button onclick="removeMedia()" class="remove-media-btn">×</button>
            </div>
            <div class="create-post-bottom">
                <div class="post-media-actions">
                    <label class="btn-media">
                        <i class="fa-solid fa-image" style="color:#4caf50;"></i> Foto
                        <input type="file" id="mediaInput" hidden accept="image/*" onchange="handleMedia(this)">
                    </label>
                    <label class="btn-media">
                        <i class="fa-solid fa-face-smile" style="color:#f9c313;"></i> Sentimiento
                        <input type="text" id="feelingInput" placeholder="¿Cómo te sientes?" style="width:130px; border:none; background:none; font-size:13px; outline:none; color:var(--text); font-family:inherit;">
                    </label>
                </div>
                <button class="btn-join" onclick="publishPost()">Publicar</button>
            </div>
        </div>

        <!-- Feed -->
        <div id="feedPosts"></div>
    `;

    renderStories();
    renderPosts();
}

// Editar perfil
window.toggleEditProfile = function () {
    const form = document.getElementById('editProfileForm');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
};

window.saveProfileChanges = function () {
    const newName = document.getElementById('editNameInput').value.trim();
    const newBio = document.getElementById('editBioInput').value.trim();
    if (!newName) return showToast('⚠️ El nombre no puede estar vacío');

    socialDB.currentUser.name = newName;
    socialDB.currentUser.bio = newBio;

    // Sync in users array
    const idx = socialDB.users.findIndex(u => u.username === socialDB.currentUser.username);
    if (idx !== -1) {
        socialDB.users[idx].name = newName;
        socialDB.users[idx].bio = newBio;
    }
    saveDB();
    updateSidebarProfile();
    showToast('✅ Perfil actualizado');
    renderInicio(document.getElementById('contentArea'));
};

window.changeProfilePic = function (input) {
    const reader = new FileReader();
    reader.onload = (e) => {
        socialDB.currentUser.profilePic = e.target.result;
        const idx = socialDB.users.findIndex(u => u.username === socialDB.currentUser.username);
        if (idx !== -1) socialDB.users[idx].profilePic = e.target.result;
        saveDB();
        updateSidebarProfile();
        renderInicio(document.getElementById('contentArea'));
        showToast('✅ Foto de perfil actualizada');
    };
    if (input.files[0]) reader.readAsDataURL(input.files[0]);
};

window.changeCoverPic = function (input) {
    const reader = new FileReader();
    reader.onload = (e) => {
        socialDB.currentUser.coverPic = e.target.result;
        const idx = socialDB.users.findIndex(u => u.username === socialDB.currentUser.username);
        if (idx !== -1) socialDB.users[idx].coverPic = e.target.result;
        saveDB();
        renderInicio(document.getElementById('contentArea'));
        showToast('✅ Foto de portada actualizada');
    };
    if (input.files[0]) reader.readAsDataURL(input.files[0]);
};

// ============================================================
// 10. HISTORIAS
// ============================================================
function cleanOldStories() {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    socialDB.stories = socialDB.stories.filter(s => new Date(s.createdAt).getTime() > cutoff);
    saveDB();
}

function renderStories() {
    const row = document.getElementById('storiesRow');
    if (!row) return;
    const u = socialDB.currentUser;
    const myStory = socialDB.stories.find(s => s.authorUsername === u.username);

    let html = `
        <div class="story-item" onclick="addStory()">
            <div class="story-ring add-story">
                <div class="story-ring-inner" style="display:flex; align-items:center; justify-content:center; background:var(--bg-input);">
                    ${u.profilePic
                        ? `<img src="${u.profilePic}" alt="${u.name}">`
                        : `<span style="font-size:20px; color:var(--primary);">${u.name[0].toUpperCase()}</span>`
                    }
                </div>
                <div class="story-add-icon"><i class="fa-solid fa-plus"></i></div>
            </div>
            <span class="story-name">Tu historia</span>
        </div>
    `;

    // Historias de otros usuarios
    const otherStories = socialDB.stories.filter(s => s.authorUsername !== u.username);
    // Agrupar por usuario (solo mostrar la más reciente de cada uno)
    const seen = new Set();
    otherStories.forEach(story => {
        if (seen.has(story.authorUsername)) return;
        seen.add(story.authorUsername);
        const author = getUser(story.authorUsername);
        if (!author) return;
        html += `
            <div class="story-item" onclick="viewStory('${story.id}')">
                <div class="story-ring">
                    <div class="story-ring-inner">
                        ${author.profilePic
                            ? `<img src="${author.profilePic}" alt="${author.name}">`
                            : `<span style="font-size:20px; font-weight:700; color:var(--primary);">${author.name[0].toUpperCase()}</span>`
                        }
                    </div>
                </div>
                <span class="story-name">${author.name.split(' ')[0]}</span>
            </div>
        `;
    });

    row.innerHTML = html;
}

window.addStory = function () {
    // Crear un input file para subir historia
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            // También dar opción de texto
            const u = socialDB.currentUser;
            const story = {
                id: 'story_' + Date.now(),
                authorUsername: u.username,
                authorName: u.name,
                type: 'image',
                content: ev.target.result,
                createdAt: new Date().toISOString()
            };
            // Reemplazar historia existente del usuario
            socialDB.stories = socialDB.stories.filter(s => s.authorUsername !== u.username);
            socialDB.stories.push(story);
            saveDB();
            showToast('✅ Historia publicada');
            renderStories();
        };
        reader.readAsDataURL(file);
    };
    input.click();
};

window.viewStory = function (storyId) {
    const story = socialDB.stories.find(s => s.id === storyId);
    if (!story) return;
    const author = getUser(story.authorUsername);
    if (!author) return;

    const modal = document.getElementById('storyModal');
    const avatarEl = document.getElementById('storyModalAvatar');
    const authorEl = document.getElementById('storyModalAuthor');
    const timeEl = document.getElementById('storyModalTime');
    const bodyEl = document.getElementById('storyModalBody');
    const progressFill = document.getElementById('storyProgressFill');

    // Reiniciar animación
    progressFill.style.animation = 'none';
    void progressFill.offsetWidth; // reflow
    progressFill.style.animation = 'progressStory 5s linear forwards';

    avatarEl.innerHTML = renderAvatar(author, 40);
    if (!author.profilePic) {
        avatarEl.style.background = 'var(--gradient)';
        avatarEl.style.display = 'flex';
        avatarEl.style.alignItems = 'center';
        avatarEl.style.justifyContent = 'center';
        avatarEl.style.color = '#fff';
        avatarEl.style.fontWeight = '700';
    }
    authorEl.textContent = author.name;
    timeEl.textContent = timeAgo(story.createdAt);

    if (story.type === 'image') {
        bodyEl.innerHTML = `<img src="${story.content}" alt="story" style="width:100%;height:100%;object-fit:cover;">`;
    } else {
        bodyEl.innerHTML = `<div class="story-text-content">${story.content}</div>`;
    }

    modal.style.display = 'flex';

    // Auto-cerrar en 5 segundos
    clearTimeout(socialDB.storyTimer);
    socialDB.storyTimer = setTimeout(() => closeStoryModal(), 5000);
};

window.closeStoryModal = function () {
    document.getElementById('storyModal').style.display = 'none';
    clearTimeout(socialDB.storyTimer);
};

// ============================================================
// 11. PUBLICACIONES (POSTS)
// ============================================================
function renderPosts() {
    const wrapper = document.getElementById('feedPosts');
    if (!wrapper) return;
    const u = socialDB.currentUser;
    const friends = u.friends || [];

    // Mostrar posts del usuario y sus amigos
    const visible = socialDB.posts.filter(p =>
        p.authorUsername === u.username || friends.includes(p.authorUsername)
    );

    if (visible.length === 0) {
        wrapper.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-newspaper"></i>
                <p>Aún no hay publicaciones. ¡Sé el primero en compartir algo!</p>
            </div>
        `;
        return;
    }

    wrapper.innerHTML = visible.map((p, i) => {
        const idx = socialDB.posts.findIndex(x => x.id === p.id);
        const likes = p.likes || [];
        const liked = likes.includes(u.username);
        const comments = p.comments || [];
        const author = getUser(p.authorUsername);

        return `
            <div class="post-card" id="post-${p.id}">
                <div class="post-header">
                    <div class="post-author-info">
                        <div class="post-author-avatar">${renderAvatar(author || { name: p.authorName, profilePic: '' }, 44)}</div>
                        <div>
                            <div class="post-author-name">${p.authorName}</div>
                            <div class="post-date">${timeAgo(p.createdAt)}${p.feeling ? ` · 😊 Se siente ${p.feeling}` : ''}</div>
                        </div>
                    </div>
                    <div class="post-menu">
                        ${p.authorUsername === u.username ? `
                            <i class="fa-solid fa-pen" onclick="editPost('${p.id}')" title="Editar"></i>
                            <i class="fa-solid fa-trash" onclick="deletePost('${p.id}')" title="Eliminar"></i>
                        ` : ''}
                    </div>
                </div>
                ${p.content ? `<p class="post-content">${p.content}</p>` : ''}
                ${p.media ? `<img src="${p.media}" class="post-media-content" onclick="openFullscreen(this.src)" alt="post media">` : ''}
                <div class="post-actions">
                    <button class="action-btn ${liked ? 'liked' : ''}" onclick="toggleLike('${p.id}')">
                        <i class="fa-${liked ? 'solid' : 'regular'} fa-heart"></i>
                        <span>${likes.length > 0 ? likes.length : ''} Me gusta</span>
                    </button>
                    <button class="action-btn" onclick="toggleComments('${p.id}')">
                        <i class="fa-regular fa-comment"></i>
                        <span>${comments.length > 0 ? comments.length : ''} Comentar</span>
                    </button>
                    <button class="action-btn" onclick="sharePost('${p.id}')">
                        <i class="fa-solid fa-share-nodes"></i>
                        <span>Compartir</span>
                    </button>
                </div>
                <div id="comments-${p.id}" style="display:none;">
                    <div style="margin-top:10px; padding-top:10px; border-top:1px solid var(--border);">
                        ${comments.map(c => `
                            <div style="display:flex; gap:8px; margin-bottom:8px; align-items:flex-start;">
                                <div style="width:30px; height:30px; border-radius:50%; background:var(--gradient); display:flex; align-items:center; justify-content:center; color:#fff; font-size:11px; font-weight:700; flex-shrink:0; overflow:hidden;">
                                    ${renderAvatar(getUser(c.authorUsername) || {name: c.authorName, profilePic: ''}, 30)}
                                </div>
                                <div style="background:var(--bg-input); padding:8px 12px; border-radius:12px; flex:1;">
                                    <strong style="font-size:13px;">${c.authorName}</strong>
                                    <div style="font-size:13px; margin-top:2px; color:var(--text);">${c.content}</div>
                                </div>
                            </div>
                        `).join('')}
                        <div style="display:flex; gap:8px; margin-top:8px;">
                            <input type="text" id="comment-input-${p.id}" placeholder="Escribe un comentario..." style="flex:1; border:1.5px solid var(--border); border-radius:20px; padding:8px 14px; font-size:13px; background:var(--bg-input); color:var(--text); outline:none; font-family:inherit;" onkeydown="if(event.key==='Enter') addComment('${p.id}')">
                            <button onclick="addComment('${p.id}')" style="background:var(--gradient); border:none; color:#fff; width:34px; height:34px; border-radius:50%; cursor:pointer; font-size:13px; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-paper-plane"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.toggleLike = function (postId) {
    const post = socialDB.posts.find(p => p.id === postId);
    if (!post) return;
    const u = socialDB.currentUser;
    if (!post.likes) post.likes = [];
    const idx = post.likes.indexOf(u.username);
    if (idx === -1) {
        post.likes.push(u.username);
        // Notificar al autor
        if (post.authorUsername !== u.username) {
            addNotification(post.authorUsername, 'like', `<strong>${u.name}</strong> le dio Me gusta a tu publicación`);
        }
    } else {
        post.likes.splice(idx, 1);
    }
    saveDB();
    renderPosts();
};

window.toggleComments = function (postId) {
    const el = document.getElementById(`comments-${postId}`);
    if (!el) return;
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

window.addComment = function (postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    if (!input || !input.value.trim()) return;
    const post = socialDB.posts.find(p => p.id === postId);
    if (!post) return;
    const u = socialDB.currentUser;
    if (!post.comments) post.comments = [];
    post.comments.push({
        authorUsername: u.username,
        authorName: u.name,
        content: input.value.trim(),
        createdAt: new Date().toISOString()
    });
    if (post.authorUsername !== u.username) {
        addNotification(post.authorUsername, 'comment', `<strong>${u.name}</strong> comentó en tu publicación`);
    }
    saveDB();
    renderPosts();
    // Re-abrir sección de comentarios
    setTimeout(() => {
        const el = document.getElementById(`comments-${postId}`);
        if (el) el.style.display = 'block';
    }, 50);
};

window.deletePost = function (postId) {
    if (!confirm('¿Eliminar esta publicación?')) return;
    socialDB.posts = socialDB.posts.filter(p => p.id !== postId);
    saveDB();
    showToast('🗑️ Publicación eliminada');
    renderPosts();
    // Actualizar contador de posts en perfil
    const statEl = document.getElementById('statPosts');
    if (statEl) {
        const myPosts = socialDB.posts.filter(p => p.authorUsername === socialDB.currentUser.username);
        statEl.textContent = myPosts.length;
    }
};

window.editPost = function (postId) {
    const post = socialDB.posts.find(p => p.id === postId);
    if (!post) return;
    const newContent = prompt('Editar publicación:', post.content);
    if (newContent === null) return;
    post.content = newContent.trim();
    post.editedAt = new Date().toISOString();
    saveDB();
    showToast('✅ Publicación actualizada');
    renderPosts();
};

window.sharePost = function (postId) {
    showToast('🔗 Enlace copiado al portapapeles');
};

window.handleMedia = function (input) {
    if (!input.files[0]) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        socialDB.tempMedia = e.target.result;
        const prev = document.getElementById('imgPrev');
        const box = document.getElementById('previewBox');
        if (prev && box) {
            prev.src = e.target.result;
            box.style.display = 'block';
        }
    };
    reader.readAsDataURL(input.files[0]);
};

window.removeMedia = function () {
    socialDB.tempMedia = null;
    const box = document.getElementById('previewBox');
    if (box) box.style.display = 'none';
};

window.publishPost = function () {
    const txt = document.getElementById('newPostTxt');
    const feeling = document.getElementById('feelingInput');
    if (!txt) return;
    const content = txt.value.trim();
    const feelingVal = feeling ? feeling.value.trim() : '';
    if (!content && !socialDB.tempMedia) return showToast('⚠️ Escribe algo o añade una imagen');

    const u = socialDB.currentUser;
    const post = {
        id: 'post_' + Date.now(),
        authorUsername: u.username,
        authorName: u.name,
        content,
        feeling: feelingVal,
        media: socialDB.tempMedia,
        likes: [],
        comments: [],
        createdAt: new Date().toISOString()
    };
    socialDB.posts.unshift(post);
    socialDB.tempMedia = null;
    saveDB();
    txt.value = '';
    if (feeling) feeling.value = '';
    removeMedia();
    showToast('✅ Publicación creada');
    renderPosts();
    // Actualizar contador
    const statEl = document.getElementById('statPosts');
    if (statEl) {
        const myPosts = socialDB.posts.filter(p => p.authorUsername === u.username);
        statEl.textContent = myPosts.length;
    }
};

// ============================================================
// 12. SECCIÓN BUSCAR
// ============================================================
function renderBuscar(area) {
    area.innerHTML = `
        <div class="search-page-box">
            <h3 style="margin:0 0 18px; font-size:18px;">Encuentra personas</h3>
            <div class="search-input-wrap">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input class="search-big-input" type="text" id="userSearchInput" placeholder="Buscar por nombre o usuario..." oninput="filterSearchResults()" autofocus>
            </div>
            <div class="search-results" id="searchResults"></div>
        </div>
    `;
    filterSearchResults();
}

window.filterSearchResults = function () {
    const query = (document.getElementById('userSearchInput')?.value || '').toLowerCase().trim();
    const u = socialDB.currentUser;
    const results = document.getElementById('searchResults');
    if (!results) return;

    const filtered = socialDB.users.filter(user =>
        user.username !== u.username &&
        (user.name.toLowerCase().includes(query) || user.username.toLowerCase().includes(query))
    );

    if (filtered.length === 0) {
        results.innerHTML = `<div class="empty-state"><i class="fa-solid fa-user-slash"></i><p>No se encontraron usuarios${query ? ` para "${query}"` : ''}.</p></div>`;
        return;
    }

    results.innerHTML = filtered.map(user => {
        const isFriend = (u.friends || []).includes(user.username);
        const pendingReq = socialDB.friendRequests.find(r =>
            r.from === u.username && r.to === user.username && r.status === 'pending'
        );
        let btnHTML;
        if (isFriend) {
            btnHTML = `<button class="btn-add-friend friends" disabled><i class="fa-solid fa-user-check"></i> Amigos</button>`;
        } else if (pendingReq) {
            btnHTML = `<button class="btn-add-friend sent" disabled><i class="fa-solid fa-clock"></i> Enviada</button>`;
        } else {
            btnHTML = `<button class="btn-add-friend" onclick="sendFriendRequest('${user.username}')"><i class="fa-solid fa-user-plus"></i> Agregar</button>`;
        }

        return `
            <div class="search-user-card">
                <div class="search-user-avatar">${renderAvatar(user, 48)}</div>
                <div class="search-user-info">
                    <div class="search-user-name">${user.name}</div>
                    <div class="search-user-handle">@${user.username}</div>
                </div>
                ${btnHTML}
            </div>
        `;
    }).join('');
};

// ============================================================
// 13. SOLICITUDES DE AMISTAD
// ============================================================
window.sendFriendRequest = function (toUsername) {
    const u = socialDB.currentUser;
    // Evitar duplicados
    const exists = socialDB.friendRequests.find(r =>
        r.from === u.username && r.to === toUsername && r.status === 'pending'
    );
    if (exists) return showToast('⚠️ Ya enviaste una solicitud');

    socialDB.friendRequests.push({
        id: 'req_' + Date.now(),
        from: u.username,
        to: toUsername,
        status: 'pending',
        createdAt: new Date().toISOString()
    });

    // Notificación al destinatario
    addNotification(toUsername, 'friend_request', `<strong>${u.name}</strong> te envió una solicitud de amistad`);
    saveDB();
    showToast('✅ Solicitud enviada');
    filterSearchResults();
    updateBadges();
};

window.acceptFriendRequest = function (reqId) {
    const req = socialDB.friendRequests.find(r => r.id === reqId);
    if (!req) return;
    req.status = 'accepted';

    const u = socialDB.currentUser;
    const fromUser = getUser(req.from);
    if (!fromUser) return;

    // Actualizar amigos
    if (!u.friends) u.friends = [];
    if (!fromUser.friends) fromUser.friends = [];
    if (!u.friends.includes(req.from)) u.friends.push(req.from);
    if (!fromUser.friends.includes(u.username)) fromUser.friends.push(u.username);

    // Actualizar seguidores/seguidos
    if (!u.followers) u.followers = [];
    if (!fromUser.following) fromUser.following = [];
    if (!u.followers.includes(req.from)) u.followers.push(req.from);
    if (!fromUser.following.includes(u.username)) fromUser.following.push(u.username);

    // Sync en users array
    const uIdx = socialDB.users.findIndex(x => x.username === u.username);
    const fromIdx = socialDB.users.findIndex(x => x.username === req.from);
    if (uIdx !== -1) socialDB.users[uIdx] = u;
    if (fromIdx !== -1) socialDB.users[fromIdx] = fromUser;

    // Notificar al que envió la solicitud
    addNotification(req.from, 'friend_accepted', `<strong>${u.name}</strong> aceptó tu solicitud de amistad`);
    saveDB();
    showToast('✅ ¡Ahora son amigos!');
    updateBadges();
    renderAmigos(document.getElementById('contentArea'));
};

window.rejectFriendRequest = function (reqId) {
    const req = socialDB.friendRequests.find(r => r.id === reqId);
    if (req) req.status = 'rejected';
    saveDB();
    showToast('❌ Solicitud rechazada');
    updateBadges();
    renderAmigos(document.getElementById('contentArea'));
};

// ============================================================
// 14. SECCIÓN AMIGOS
// ============================================================
function renderAmigos(area) {
    const u = socialDB.currentUser;
    const pendingReqs = socialDB.friendRequests.filter(r => r.to === u.username && r.status === 'pending');
    const friends = (u.friends || []).map(fn => getUser(fn)).filter(Boolean);

    area.innerHTML = `
        <div class="friends-tabs">
            <button class="friend-tab active" id="tab-friends" onclick="showFriendsTab('friends')">Mis Amigos (${friends.length})</button>
            <button class="friend-tab" id="tab-requests" onclick="showFriendsTab('requests')">
                Solicitudes ${pendingReqs.length > 0 ? `<span style="background:var(--secondary);color:#fff;padding:1px 6px;border-radius:10px;font-size:11px;margin-left:4px;">${pendingReqs.length}</span>` : ''}
            </button>
        </div>
        <div id="friendsTabContent"></div>
    `;
    showFriendsTab('friends');
}

window.showFriendsTab = function (tab) {
    document.querySelectorAll('.friend-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${tab}`)?.classList.add('active');

    const u = socialDB.currentUser;
    const content = document.getElementById('friendsTabContent');
    if (!content) return;

    if (tab === 'friends') {
        const friends = (u.friends || []).map(fn => getUser(fn)).filter(Boolean);
        if (friends.length === 0) {
            content.innerHTML = `<div class="empty-state"><i class="fa-solid fa-user-group"></i><p>Aún no tienes amigos. ¡Ve a Buscar para conectar!</p></div>`;
            return;
        }
        content.innerHTML = `<div class="friends-grid">${friends.map(f => `
            <div class="friend-card">
                <div class="friend-card-avatar">${renderAvatar(f, 62)}</div>
                <div class="friend-card-name">${f.name}</div>
                <div style="font-size:11px; color:var(--text-muted); margin-bottom:8px;">@${f.username}</div>
                <button class="btn-message-friend" onclick="openChatWith('${f.username}')">
                    <i class="fa-solid fa-message"></i> Mensaje
                </button>
            </div>
        `).join('')}</div>`;
    } else {
        const pending = socialDB.friendRequests.filter(r => r.to === u.username && r.status === 'pending');
        if (pending.length === 0) {
            content.innerHTML = `<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>No tienes solicitudes pendientes.</p></div>`;
            return;
        }
        content.innerHTML = pending.map(req => {
            const fromUser = getUser(req.from);
            if (!fromUser) return '';
            return `
                <div class="friend-request-card">
                    <div style="width:44px; height:44px; border-radius:50%; background:var(--gradient); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; overflow:hidden; flex-shrink:0;">${renderAvatar(fromUser, 44)}</div>
                    <div style="flex:1;">
                        <div style="font-weight:700;">${fromUser.name}</div>
                        <div style="font-size:12px; color:var(--text-muted);">@${fromUser.username} · ${timeAgo(req.createdAt)}</div>
                    </div>
                    <div class="request-actions">
                        <button class="btn-accept" onclick="acceptFriendRequest('${req.id}')">Aceptar</button>
                        <button class="btn-reject" onclick="rejectFriendRequest('${req.id}')">Rechazar</button>
                    </div>
                </div>
            `;
        }).join('');
    }
};

// ============================================================
// 15. NOTIFICACIONES
// ============================================================
function addNotification(toUsername, type, text) {
    socialDB.notifications.unshift({
        id: 'notif_' + Date.now() + Math.random(),
        to: toUsername,
        type,
        text,
        read: false,
        createdAt: new Date().toISOString()
    });
    saveDB();
    updateBadges();
}

function renderNotificaciones(area) {
    const u = socialDB.currentUser;
    const notifs = socialDB.notifications.filter(n => n.to === u.username);

    if (notifs.length === 0) {
        area.innerHTML = `<div class="empty-state"><i class="fa-solid fa-bell-slash"></i><p>No tienes notificaciones.</p></div>`;
        return;
    }

    const iconMap = {
        like: 'fa-heart',
        comment: 'fa-comment',
        friend_request: 'fa-user-plus',
        friend_accepted: 'fa-user-check',
        message: 'fa-message'
    };

    area.innerHTML = notifs.map(n => `
        <div class="notif-item ${n.read ? '' : 'unread'}" onclick="markNotifRead('${n.id}')">
            <div class="notif-icon" style="${n.type === 'like' ? 'background:linear-gradient(135deg,#e91e63,#f44336)' : ''}">
                <i class="fa-solid ${iconMap[n.type] || 'fa-bell'}"></i>
            </div>
            <div class="notif-text">${n.text}</div>
            <div class="notif-time">${timeAgo(n.createdAt)}</div>
            ${!n.read ? '<div class="notif-dot"></div>' : ''}
        </div>
    `).join('');
}

window.markNotifRead = function (notifId) {
    const n = socialDB.notifications.find(x => x.id === notifId);
    if (n) { n.read = true; saveDB(); updateBadges(); }
};

// ============================================================
// 16. MENSAJES (PANEL COMPLETO)
// ============================================================
function renderMensajes(area) {
    const u = socialDB.currentUser;
    const friends = (u.friends || []).map(fn => getUser(fn)).filter(Boolean);

    area.innerHTML = `
        <div class="messages-layout">
            <div class="messages-list-panel">
                <div class="messages-panel-header">💬 Mensajes</div>
                <div class="messages-list" id="messagesList">
                    ${friends.length === 0
                        ? `<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:14px;">Agrega amigos para chatear</div>`
                        : friends.map(f => {
                            const conv = getConversation(u.username, f.username);
                            const lastMsg = conv.length > 0 ? conv[conv.length - 1] : null;
                            const unread = conv.filter(m => m.from === f.username && !m.read).length;
                            return `
                                <div class="message-preview-item ${socialDB.activeMessageUser === f.username ? 'active' : ''}" onclick="openMessagePanel('${f.username}')">
                                    <div class="msg-preview-avatar">${renderAvatar(f, 42)}</div>
                                    <div class="msg-preview-info">
                                        <div class="msg-preview-name">${f.name}</div>
                                        <div class="msg-preview-last">${lastMsg ? (lastMsg.from === u.username ? 'Tú: ' : '') + lastMsg.text.substring(0, 30) + (lastMsg.text.length > 30 ? '...' : '') : 'Sin mensajes aún'}</div>
                                    </div>
                                    ${unread > 0 ? `<div class="msg-unread-dot"></div>` : ''}
                                </div>
                            `;
                        }).join('')
                    }
                </div>
            </div>
            <div class="messages-chat-panel" id="messagesChatPanel">
                <div class="no-chat-selected">
                    <i class="fa-regular fa-comment-dots"></i>
                    <p>Selecciona una conversación</p>
                </div>
            </div>
        </div>
    `;

    if (socialDB.activeMessageUser) {
        openMessagePanel(socialDB.activeMessageUser);
    }
}

window.openMessagePanel = function (username) {
    socialDB.activeMessageUser = username;
    markMessagesRead(username);
    updateBadges();

    const panel = document.getElementById('messagesChatPanel');
    if (!panel) return;
    const friend = getUser(username);
    if (!friend) return;

    const conv = getConversation(socialDB.currentUser.username, username);

    panel.innerHTML = `
        <div class="chat-panel-header">
            <div style="width:36px; height:36px; border-radius:50%; background:var(--gradient); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; overflow:hidden;">${renderAvatar(friend, 36)}</div>
            <span>${friend.name}</span>
            <div style="width:10px; height:10px; border-radius:50%; background:#4caf50;"></div>
        </div>
        <div class="chat-panel-messages" id="panelMessages">
            ${conv.length === 0
                ? `<div style="text-align:center; color:var(--text-muted); font-size:14px; margin-top:30px;">Inicia la conversación con ${friend.name} 👋</div>`
                : conv.map(m => {
                    const isMe = m.from === socialDB.currentUser.username;
                    return `
                        <div class="msg ${isMe ? 'msg-me' : 'msg-them'}" style="max-width:75%; padding:9px 13px;">
                            ${m.text}
                            <div class="msg-time">${timeAgo(m.createdAt)}</div>
                        </div>
                    `;
                }).join('')
            }
        </div>
        <div class="chat-panel-input">
            <button class="chat-panel-emoji" onclick="togglePanelEmoji('${username}')">
                <i class="fa-regular fa-face-smile"></i>
            </button>
            <input type="text" id="panelMsgInput" placeholder="Escribe un mensaje..." onkeydown="if(event.key==='Enter') sendPanelMessage('${username}')">
            <button class="chat-panel-send" onclick="sendPanelMessage('${username}')">
                <i class="fa-solid fa-paper-plane"></i>
            </button>
        </div>
        <div id="panelEmojiPicker" style="display:none; border-top:1px solid var(--border); background:var(--bg-card); padding:10px; max-height:160px; overflow-y:auto;">
            <div style="display:flex; flex-wrap:wrap; gap:4px;">${EMOJIS.map(e => `<button onclick="insertPanelEmoji('${e}')" style="background:none; border:none; font-size:22px; cursor:pointer; padding:3px; border-radius:6px; transition:background 0.15s;" onmouseenter="this.style.background='var(--bg-hover)'" onmouseleave="this.style.background='none'">${e}</button>`).join('')}</div>
        </div>
    `;

    // Scroll al fondo
    const msgs = document.getElementById('panelMessages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;

    // Actualizar lista
    renderMensajes(document.getElementById('contentArea'));
};

window.sendPanelMessage = function (toUsername) {
    const input = document.getElementById('panelMsgInput');
    if (!input || !input.value.trim()) return;
    sendMessageTo(toUsername, input.value.trim());
    input.value = '';
    openMessagePanel(toUsername);
};

window.togglePanelEmoji = function () {
    const picker = document.getElementById('panelEmojiPicker');
    if (picker) picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
};

window.insertPanelEmoji = function (emoji) {
    const input = document.getElementById('panelMsgInput');
    if (input) input.value += emoji;
    input?.focus();
};

function getConversation(user1, user2) {
    if (!socialDB.messages[user1]) socialDB.messages[user1] = {};
    if (!socialDB.messages[user1][user2]) socialDB.messages[user1][user2] = [];
    if (!socialDB.messages[user2]) socialDB.messages[user2] = {};
    if (!socialDB.messages[user2][user1]) socialDB.messages[user2][user1] = [];

    // Merge ambas listas (por si acaso) y ordenar
    const msgs1 = socialDB.messages[user1][user2];
    const msgs2 = socialDB.messages[user2][user1];
    const allIds = new Set([...msgs1.map(m => m.id), ...msgs2.map(m => m.id)]);
    const combined = [];
    allIds.forEach(id => {
        const m = msgs1.find(x => x.id === id) || msgs2.find(x => x.id === id);
        if (m) combined.push(m);
    });
    return combined.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function sendMessageTo(toUsername, text) {
    const u = socialDB.currentUser;
    const msg = {
        id: 'msg_' + Date.now() + Math.random(),
        from: u.username,
        to: toUsername,
        text,
        read: false,
        createdAt: new Date().toISOString()
    };
    if (!socialDB.messages[u.username]) socialDB.messages[u.username] = {};
    if (!socialDB.messages[u.username][toUsername]) socialDB.messages[u.username][toUsername] = [];
    socialDB.messages[u.username][toUsername].push(msg);

    if (!socialDB.messages[toUsername]) socialDB.messages[toUsername] = {};
    if (!socialDB.messages[toUsername][u.username]) socialDB.messages[toUsername][u.username] = [];
    socialDB.messages[toUsername][u.username].push(msg);

    addNotification(toUsername, 'message', `<strong>${u.name}</strong> te envió un mensaje`);
    saveDB();
    updateBadges();
}

function markMessagesRead(fromUsername) {
    const u = socialDB.currentUser;
    if (socialDB.messages[u.username] && socialDB.messages[u.username][fromUsername]) {
        socialDB.messages[u.username][fromUsername].forEach(m => {
            if (m.from === fromUsername) m.read = true;
        });
    }
    if (socialDB.messages[fromUsername] && socialDB.messages[fromUsername][u.username]) {
        socialDB.messages[fromUsername][u.username].forEach(m => {
            if (m.from === fromUsername) m.read = true;
        });
    }
    saveDB();
}

// ============================================================
// 17. CHAT FLOTANTE
// ============================================================
const EMOJIS = ['😀','😂','😍','🥰','😎','🤔','😢','😡','🥳','🤩','👋','👍','👏','🙌','❤️','🔥','✨','🎉','🙏','💪','😊','😏','🤣','😅','😇','😴','🤗','🤫','🫶','💯','🎶','🌟','🌙','☀️','🍕','🎂','🚀','💡','🏆','🎯'];

window.openChatWith = function (username) {
    socialDB.activeChatUser = username;
    const friend = getUser(username);
    if (!friend) return;

    const chatWindow = document.getElementById('chatWindow');
    const chatUserName = document.getElementById('chatUserName');
    const chatAvatar = document.getElementById('chatAvatar');
    const chatMessages = document.getElementById('chatMessages');

    chatUserName.textContent = friend.name;
    chatAvatar.innerHTML = renderAvatar(friend, 34);
    if (!friend.profilePic) {
        chatAvatar.style.background = 'rgba(255,255,255,0.3)';
    }

    chatWindow.style.display = 'flex';
    chatWindow.style.flexDirection = 'column';

    renderChatMessages();

    // Inicializar emojis
    const grid = document.getElementById('emojiGrid');
    if (grid && grid.children.length === 0) {
        grid.innerHTML = EMOJIS.map(e =>
            `<button class="emoji-btn" onclick="insertEmoji('${e}')">${e}</button>`
        ).join('');
    }
};

function renderChatMessages() {
    const container = document.getElementById('chatMessages');
    if (!container || !socialDB.activeChatUser) return;
    const u = socialDB.currentUser;
    const conv = getConversation(u.username, socialDB.activeChatUser);

    if (conv.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size:13px; margin-top:20px;">Inicia la conversación 👋</div>`;
    } else {
        container.innerHTML = conv.map(m => {
            const isMe = m.from === u.username;
            return `<div class="msg ${isMe ? 'msg-me' : 'msg-them'}">${m.text}<div class="msg-time">${timeAgo(m.createdAt)}</div></div>`;
        }).join('');
    }
    container.scrollTop = container.scrollHeight;
}

window.sendMessage = function () {
    const input = document.getElementById('chatInput');
    if (!input || !input.value.trim() || !socialDB.activeChatUser) return;
    sendMessageTo(socialDB.activeChatUser, input.value.trim());
    input.value = '';
    renderChatMessages();
    // Si el panel de mensajes está abierto, actualizarlo
    if (socialDB.currentSection === 'mensajes') {
        openMessagePanel(socialDB.activeChatUser);
    }
};

window.closeChat = function () {
    document.getElementById('chatWindow').style.display = 'none';
    socialDB.activeChatUser = null;
};

window.toggleEmojiPicker = function () {
    const picker = document.getElementById('emojiPicker');
    if (picker) picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
};

window.insertEmoji = function (emoji) {
    const input = document.getElementById('chatInput');
    if (input) {
        input.value += emoji;
        input.focus();
    }
};

// ============================================================
// 18. REELS
// ============================================================
function renderReels(area) {
    const reels = [
        { emoji: '🏄', author: 'Surfista Pro', desc: '¡El mejor día en el mar! 🌊', likes: 1234, comments: 89 },
        { emoji: '🎨', author: 'Arte&Vida', desc: 'Mi último cuadro digital ✨', likes: 856, comments: 42 },
        { emoji: '🍕', author: 'Chef Miguel', desc: 'Pizza casera en 30 min 🔥', likes: 2100, comments: 134 },
        { emoji: '🎸', author: 'RockVibes', desc: 'Nuevo riff, ¿qué os parece? 🎵', likes: 567, comments: 31 },
        { emoji: '🏋️', author: 'FitLife', desc: 'Rutina de fuerza completa 💪', likes: 1890, comments: 97 },
    ];

    area.innerHTML = `
        <div class="reels-wrapper">
            ${reels.map((r, i) => `
                <div class="reel-card">
                    <div class="reel-bg">${r.emoji}</div>
                    <div class="reel-overlay">
                        <div class="reel-author">@${r.author}</div>
                        <div class="reel-desc">${r.desc}</div>
                    </div>
                    <div class="reel-actions-side">
                        <div class="reel-action-btn" onclick="this.querySelector('i').classList.toggle('fa-regular'); this.querySelector('i').classList.toggle('fa-solid'); this.querySelector('span').textContent = parseInt(this.querySelector('span').textContent) + (this.querySelector('i').classList.contains('fa-solid') ? 1 : -1);">
                            <i class="fa-regular fa-heart"></i>
                            <span>${r.likes}</span>
                        </div>
                        <div class="reel-action-btn">
                            <i class="fa-regular fa-comment"></i>
                            <span>${r.comments}</span>
                        </div>
                        <div class="reel-action-btn" onclick="showToast('🔗 Compartido!')">
                            <i class="fa-solid fa-share-nodes"></i>
                            <span>Compartir</span>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// ============================================================
// 19. SIDEBAR DERECHO (CONTACTOS + SUGERENCIAS)
// ============================================================
function renderRightSidebar() {
    const u = socialDB.currentUser;
    if (!u) return;

    // Contactos (amigos)
    const contactsEl = document.getElementById('contactsList');
    const friends = (u.friends || []).map(fn => getUser(fn)).filter(Boolean);
    if (contactsEl) {
        if (friends.length === 0) {
            contactsEl.innerHTML = `<div style="font-size:13px; color:var(--text-muted); padding:5px 10px;">Sin amigos aún</div>`;
        } else {
            contactsEl.innerHTML = friends.map(f => `
                <div class="contact-item" onclick="openChatWith('${f.username}')">
                    <div class="contact-avatar" style="position:relative;">
                        ${renderAvatar(f, 38)}
                        <span class="status-dot online"></span>
                    </div>
                    <span class="contact-name">${f.name}</span>
                </div>
            `).join('');
        }
    }

    // Sugerencias (no amigos, no yo)
    const suggestEl = document.getElementById('suggestionsList');
    if (suggestEl) {
        const suggestions = socialDB.users.filter(usr =>
            usr.username !== u.username && !(u.friends || []).includes(usr.username)
        ).slice(0, 5);

        if (suggestions.length === 0) {
            suggestEl.innerHTML = `<div style="font-size:13px; color:var(--text-muted); padding:5px 10px;">Sin sugerencias</div>`;
        } else {
            suggestEl.innerHTML = suggestions.map(s => {
                const pending = socialDB.friendRequests.find(r =>
                    r.from === u.username && r.to === s.username && r.status === 'pending'
                );
                return `
                    <div class="suggestion-item">
                        <div class="suggestion-avatar">${renderAvatar(s, 38)}</div>
                        <div class="suggestion-info">
                            <div class="suggestion-name">${s.name}</div>
                            <div class="suggestion-meta">@${s.username}</div>
                        </div>
                        ${pending
                            ? `<button class="btn-follow" disabled style="opacity:0.5;">Enviada</button>`
                            : `<button class="btn-follow" onclick="sendFriendRequest('${s.username}'); this.textContent='Enviada'; this.disabled=true; this.style.opacity='0.5';">Seguir</button>`
                        }
                    </div>
                `;
            }).join('');
        }
    }
}

// ============================================================
// 20. IMAGEN FULLSCREEN
// ============================================================
window.openFullscreen = function (src) {
    const el = document.getElementById('imgFullscreen');
    const img = document.getElementById('fullscreenImg');
    if (el && img) {
        img.src = src;
        el.style.display = 'flex';
    }
};

window.closeFullscreen = function () {
    document.getElementById('imgFullscreen').style.display = 'none';
};

// ============================================================
// 21. INICIALIZACIÓN
// ============================================================
window.onload = () => {
    // Aplicar tema guardado
    applyTheme(socialDB.currentTheme);

    // Animación landing
    setTimeout(() => {
        document.querySelectorAll('.anim').forEach(el => el.classList.add('show'));
    }, 100);

    // Parallax hero image
    document.addEventListener('mousemove', (e) => {
        const img = document.querySelector('.feature-img');
        if (img) {
            const x = (window.innerWidth / 2 - e.pageX) / 80;
            const y = (window.innerHeight / 2 - e.pageY) / 80;
            img.style.transform = `translateX(${x}px) translateY(${y}px)`;
        }
    });

    // Botón de registro
    const openRegisterBtn = document.getElementById('openRegister');
    if (openRegisterBtn) {
        openRegisterBtn.onclick = () => {
            toggleModal(true, `
                <h2>Crear cuenta</h2>
                <input type="text" id="regName" placeholder="Tu nombre completo">
                <input type="text" id="regUser" placeholder="Nombre de usuario">
                <input type="password" id="regPass" placeholder="Contraseña">
                <button class="btn-join" onclick="handleRegister()" style="width:100%; margin-top:10px;">Unirse ahora</button>
            `);
        };
    }

    // Botón de login
    const openLoginBtn = document.getElementById('openLogin');
    if (openLoginBtn) {
        openLoginBtn.onclick = () => {
            toggleModal(true, `
                <h2>Iniciar sesión</h2>
                <input type="text" id="logUser" placeholder="Nombre de usuario">
                <input type="password" id="logPass" placeholder="Contraseña" onkeydown="if(event.key==='Enter') handleLogin()">
                <button class="btn-join" onclick="handleLogin()" style="width:100%; margin-top:10px;">Entrar</button>
                <p onclick="openRecovery()" style="cursor:pointer; color:var(--secondary); margin-top:10px; font-size:13px;">¿Olvidaste tu contraseña?</p>
            `);
        };
    }

    // Cerrar modal
    const closeModalBtn = document.getElementById('closeModal');
    if (closeModalBtn) closeModalBtn.onclick = () => toggleModal(false);

    // Botón empezar hero
    const heroBtn = document.getElementById('heroStartBtn');
    if (heroBtn) heroBtn.onclick = () => openRegisterBtn?.click();
};
