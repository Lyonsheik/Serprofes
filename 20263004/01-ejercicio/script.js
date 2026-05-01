// --- 1. BASE DE DATOS Y ESTADO GLOBAL --- (Se mantiene igual)
const socialDB = {
    users: JSON.parse(localStorage.getItem('social_users')) || [],
    posts: JSON.parse(localStorage.getItem('social_posts')) || [],
    currentUser: null,
    tempMedia: null,
    currentTab: 'feed',
    activeChatUser: null
};

// --- 2. UTILIDADES ---
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

// --- 3. LÓGICA DE USUARIOS ---
window.handleRegister = function() {
    const name = document.getElementById('regName').value;
    const user = document.getElementById('regUser').value;
    const pass = document.getElementById('regPass').value;

    if(!name || !user || !pass) return alert("Completa todos los campos");
    if(socialDB.users.find(u => u.username === user)) return alert("El usuario ya existe");

    const newUser = { name, username: user, pass, available: true, bio: '', profilePic: '' };
    socialDB.users.push(newUser);
    localStorage.setItem('social_users', JSON.stringify(socialDB.users));
    alert("¡Cuenta creada!");
    toggleModal(false);
};

// --- CORRECCIÓN CRÍTICA DE LOGIN ---
window.handleLogin = function() {
    const userIn = document.getElementById('logUser').value;
    const passIn = document.getElementById('logPass').value;
    const found = socialDB.users.find(u => u.username === userIn && u.pass === passIn);

    if (found) {
        socialDB.currentUser = found;
        toggleModal(false);
        
        // CORRECCIÓN: El selector debe ser '.hero' para coincidir con tu HTML
        const heroSection = document.querySelector('.hero');
        if(heroSection) {
            heroSection.style.display = 'none'; // Usamos display none para asegurar que desaparece
        }
        
        renderFeed();
    } else {
        alert("Credenciales incorrectas");
    }
};

// Abrir el modal de recuperación
window.openRecovery = () => {
    toggleModal(false); // Cerramos el modal de Login primero
    document.getElementById('recoveryModal').style.display = 'flex';
    document.getElementById('recoveryModal').classList.add('active');
};

// Cerrar el modal de recuperación
window.closeRecoveryModal = () => {
    document.getElementById('recoveryModal').style.display = 'none';
    document.getElementById('recoveryModal').classList.remove('active');
};

// Verificar usuario y mostrar el paso 2
window.verifyUserForRecovery = () => {
    const username = document.getElementById('recoveryUser').value;
    userToRecover = socialDB.users.find(u => u.username === username);
    
    if(userToRecover) {
        document.getElementById('recoveryStep2').style.display = 'block';
        document.getElementById('btnVerifyUser').style.display = 'none';
    } else { 
        alert("Usuario no encontrado en nuestra base de datos"); 
    }
};

window.showFeatures = () => {
    toggleModal(true, `
        <h2>Features</h2>
        <ul style="text-align:left; margin-top:20px; line-height:2">
            <li>✅ Chat en tiempo real</li>
            <li>✅ Publicaciones con imágenes</li>
            <li>✅ Perfil personalizable</li>
            <li>✅ Sistema de amigos</li>
        </ul>
    `);
};

window.showHowItWorks = () => {
    toggleModal(true, `
        <h2>Cómo funciona</h2>
        <p style="margin-top:20px">Sociality es simple: Regístrate, busca a tus amigos en la lista lateral y empieza a compartir tus momentos en el muro global.</p>
    `);
};

window.showPrivacy = () => {
    toggleModal(true, `
        <h2>Privacidad</h2>
        <p style="margin-top:20px">Tus datos están seguros. En Sociality, tú decides qué compartir y quién puede ver tu perfil.</p>
    `);
};

let userToRecover = null;
window.verifyUserForRecovery = () => {
    const username = document.getElementById('recoveryUser').value;
    userToRecover = socialDB.users.find(u => u.username === username);
    if(userToRecover) {
        document.getElementById('recoveryStep2').style.display = 'block';
        document.getElementById('btnVerifyUser').style.display = 'none';
    } else { alert("Usuario no encontrado"); }
};

window.handleResetPass = () => {
    const newPass = document.getElementById('newPass').value;
    userToRecover.pass = newPass;
    localStorage.setItem('social_users', JSON.stringify(socialDB.users));
    alert("Contraseña actualizada");
    closeRecoveryModal();
};

// --- 4. RENDERIZADO MAESTRO ---
window.switchTab = (tab) => {
    socialDB.currentTab = tab;
    renderFeed();
};

function renderFeed() {
    if(!socialDB.currentUser) return;
    
    const sidebar = document.getElementById('sidebarRight');
    const usersList = document.getElementById('usersList');
    sidebar.style.display = 'block';
    
    usersList.innerHTML = socialDB.users.map(u => `
        <div class="user-item" onclick="openChat('${u.username}')">
            <div style="position:relative">
                <div class="user-avatar" style="width:35px; height:35px; font-size:12px">${u.name[0]}</div>
                <span class="status-dot ${u.available ? 'online' : 'offline'}"></span>
            </div>
            <div>
                <div style="font-size:14px; font-weight:600">${u.name}</div>
                <div style="font-size:10px; color:gray">${u.available ? 'En línea' : 'Ocupado'}</div>
            </div>
        </div>
    `).join('');

    document.getElementById('authBtns').innerHTML = `
        <div style="display:flex; align-items:center; gap:15px">
            <span style="font-weight:600; color:#c639b8">Hola, ${socialDB.currentUser.name.split(' ')[0]}</span>
            <button class="logn-btn" onclick="location.reload()" style="margin:0; padding:5px 15px">Salir</button>
        </div>
    `;

    // Contenedor principal de pestañas
    let contentHTML = `
        <div class="feed-container with-sidebar anim show">
            <div class="feed-header-nav">
                <div class="tab-item ${socialDB.currentTab === 'feed' ? 'active' : ''}" onclick="switchTab('feed')">
                    <i class="fa-solid fa-house"></i><span>Muro</span>
                </div>
                <div class="tab-item ${socialDB.currentTab === 'friends' ? 'active' : ''}" onclick="switchTab('friends')">
                    <i class="fa-solid fa-users"></i><span>Amigos</span>
                </div>
                <div class="tab-item ${socialDB.currentTab === 'profile' ? 'active' : ''}" onclick="switchTab('profile')">
                    <i class="fa-solid fa-user"></i><span>Perfil</span>
                </div>
            </div>
    `;

    // Lógica de pestañas
    if(socialDB.currentTab === 'feed') {
        contentHTML += `
            <div class="create-post-card anim show">
                <textarea id="newPostTxt" placeholder="¿Qué quieres compartir hoy?"></textarea>
                <div id="previewBox" class="media-preview-container" style="display:none">
                    <img id="imgPrev" src="">
                    <button onclick="removeMedia()" class="remove-media-btn">×</button>
                </div>
                <div style="display:flex; justify-content:space-between; margin-top:10px">
                    <label class="btn-media"><i class="fa-solid fa-image"></i> Foto <input type="file" id="mediaInput" hidden onchange="handleMedia(this)"></label>
                    <button class="btn-join" onclick="publishPost()">Publicar</button>
                </div>
            </div>
            <div id="postsWrapper">
                ${socialDB.posts.map((p, i) => `
                    <div class="post-card anim show">
                        <div style="display:flex; justify-content:space-between">
                            <div style="display:flex; gap:10px">
                                <div class="user-avatar">${p.author[0]}</div>
                                <div><strong>${p.author}</strong><br><small>${p.date}</small></div>
                            </div>
                            ${p.author === socialDB.currentUser.name ? `<i class="fa-solid fa-trash" style="cursor:pointer; color:#ff4d4d" onclick="deletePost(${i})"></i>` : ''}
                        </div>
                        <p style="margin-top:15px; color:#444">${p.content}</p>
                        ${p.media ? `<img src="${p.media}" class="post-media-content">` : ''}
                    </div>
                `).join('')}
            </div>`;
    } else if(socialDB.currentTab === 'profile') {
        contentHTML += `
            <div class="profile-header anim show">
                <div class="profile-pic-container">
                    <img src="${socialDB.currentUser.profilePic || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}" class="profile-pic">
                    <label class="edit-pic-btn"><i class="fa-solid fa-camera"></i><input type="file" hidden onchange="changeProfilePic(this)"></label>
                </div>
                <h2>${socialDB.currentUser.name}</h2>
                <textarea id="editBio" placeholder="Tu bio...">${socialDB.currentUser.bio || ''}</textarea>
                <button class="btn-join" onclick="updateProfileData()">Guardar</button>
            </div>`;
    }

    contentHTML += `</div>`;
    document.getElementById('appContent').innerHTML = contentHTML;
}

// --- 5. FUNCIONES DE APOYO (Se mantienen igual) ---
window.handleMedia = (input) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        socialDB.tempMedia = e.target.result;
        document.getElementById('imgPrev').src = e.target.result;
        document.getElementById('previewBox').style.display = 'block';
    };
    reader.readAsDataURL(input.files[0]);
};

window.publishPost = () => {
    const txt = document.getElementById('newPostTxt').value;
    if(!txt && !socialDB.tempMedia) return;
    socialDB.posts.unshift({ 
        author: socialDB.currentUser.name, 
        content: txt, 
        media: socialDB.tempMedia, 
        date: new Date().toLocaleTimeString() 
    });
    localStorage.setItem('social_posts', JSON.stringify(socialDB.posts));
    socialDB.tempMedia = null;
    renderFeed();
};

// --- 6. INICIO Y ANIMACIONES ---
window.onload = () => {
    // Animación inicial de entrada
    setTimeout(() => {
        document.querySelectorAll('.anim').forEach(el => el.classList.add('show'));
    }, 100);

    // Movimiento sutil de la imagen Hero (Parallax)
    document.addEventListener('mousemove', (e) => {
        const img = document.querySelector('.feature-img');
        if(img) {
            const x = (window.innerWidth - e.pageX * 2) / 100;
            const y = (window.innerHeight - e.pageY * 2) / 100;
            img.style.transform = `translateX(${x}px) translateY(${y}px)`;
        }
    });

    document.getElementById('openRegister').onclick = () => {
        toggleModal(true, `<h2>Registro</h2><input type="text" id="regName" placeholder="Nombre"><input type="text" id="regUser" placeholder="Usuario"><input type="password" id="regPass" placeholder="Contraseña"><button class="btn-join" onclick="handleRegister()" style="width:100%">Unirse</button>`);
    };
    
    document.getElementById('openLogin').onclick = () => {
        toggleModal(true, `<h2>Login</h2><input type="text" id="logUser" placeholder="Usuario"><input type="password" id="logPass" placeholder="Contraseña"><button class="btn-join" onclick="handleLogin()" style="width:100%">Entrar</button><p onclick="openRecovery()" style="cursor:pointer; color:red; margin-top:10px; font-size:12px">¿Olvidaste tu contraseña?</p>`);
    };
    
    document.getElementById('closeModal').onclick = () => toggleModal(false);
    document.getElementById('heroStartBtn').onclick = () => document.getElementById('openRegister').click();
};

// ... (Resto de funciones: deletePost, openChat, etc.)