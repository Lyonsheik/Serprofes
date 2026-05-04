/* ============================================================
   SOCIALITY — SCRIPT.JS v2.0
   Red Social Completa | Instagram + Facebook Style
   ============================================================ */

// ============================================================
// 1. BASE DE DATOS Y ESTADO GLOBAL
// ============================================================
const socialDB = {
    users:         JSON.parse(localStorage.getItem('social_users'))       || [],
    posts:         JSON.parse(localStorage.getItem('social_posts'))       || [],
    stories:       JSON.parse(localStorage.getItem('social_stories'))     || [],
    notifications: JSON.parse(localStorage.getItem('social_notifs'))      || [],
    messages:      JSON.parse(localStorage.getItem('social_messages'))    || {},
    friendRequests:JSON.parse(localStorage.getItem('social_requests'))    || [],
    reelPrefs:     JSON.parse(localStorage.getItem('social_reel_prefs'))  || [],
    reelHistory:   JSON.parse(localStorage.getItem('social_reel_history'))|| {},
    currentUser:   null,
    currentSection:'inicio',
    activeChatUser:null,
    activeMessageUser:null,
    tempMedia:     null,
    storyTimer:    null,
    currentTheme:  localStorage.getItem('social_theme') || 'light',
    sharePostId:   null,
    reelPage:      0,
    reelLoading:   false
};

// ============================================================
// 2. UTILIDADES
// ============================================================
function saveDB() {
    localStorage.setItem('social_users',        JSON.stringify(socialDB.users));
    localStorage.setItem('social_posts',        JSON.stringify(socialDB.posts));
    localStorage.setItem('social_stories',      JSON.stringify(socialDB.stories));
    localStorage.setItem('social_notifs',       JSON.stringify(socialDB.notifications));
    localStorage.setItem('social_messages',     JSON.stringify(socialDB.messages));
    localStorage.setItem('social_requests',     JSON.stringify(socialDB.friendRequests));
    localStorage.setItem('social_reel_prefs',   JSON.stringify(socialDB.reelPrefs));
    localStorage.setItem('social_reel_history', JSON.stringify(socialDB.reelHistory));
}

function showToast(msg) {
    let t = document.getElementById('toastEl');
    if (!t) { t = document.createElement('div'); t.id = 'toastEl'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2800);
}

function timeAgo(dateStr) {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60)    return 'Ahora mismo';
    if (diff < 3600)  return 'Hace ' + Math.floor(diff/60) + ' min';
    if (diff < 86400) return 'Hace ' + Math.floor(diff/3600) + ' h';
    return 'Hace ' + Math.floor(diff/86400) + ' d';
}

function getUser(username) { return socialDB.users.find(u => u.username === username); }

function renderAvatar(user, size) {
    size = size || 44;
    var u = (typeof user === 'string') ? getUser(user) : user;
    if (!u) return '';
    var name = u.name || u.username || '?';
    if (u.profilePic) return '<img src="' + u.profilePic + '" alt="' + name + '" style="width:' + size + 'px;height:' + size + 'px;object-fit:cover;border-radius:50%;">';
    return '<span style="font-size:' + Math.floor(size*0.38) + 'px;">' + name[0].toUpperCase() + '</span>';
}

// ============================================================
// 3. TEMA
// ============================================================
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var icon = document.getElementById('themeIcon');
    if (icon) icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    localStorage.setItem('social_theme', theme);
    socialDB.currentTheme = theme;
}

window.toggleTheme = function() { applyTheme(socialDB.currentTheme === 'light' ? 'dark' : 'light'); };

// ============================================================
// 4. MODALES LANDING
// ============================================================
function toggleModal(show, content) {
    content = content || '';
    var modal = document.getElementById('modalOverlay');
    var container = document.getElementById('modalFormContainer');
    if (show) {
        container.innerHTML = content;
        modal.style.display = 'flex';
        setTimeout(function() { modal.classList.add('active'); }, 10);
    } else {
        modal.classList.remove('active');
        setTimeout(function() { modal.style.display = 'none'; }, 400);
    }
}

window.openRecovery = function() {
    toggleModal(false);
    var m = document.getElementById('recoveryModal');
    m.style.display = 'flex';
    setTimeout(function() { m.classList.add('active'); }, 10);
};

window.closeRecoveryModal = function() {
    var m = document.getElementById('recoveryModal');
    m.classList.remove('active');
    setTimeout(function() { m.style.display = 'none'; }, 400);
};

window.showFeatures = function() {
    toggleModal(true, '<h2>✨ Features</h2><ul style="text-align:left;margin-top:20px;line-height:2.2;list-style:none;padding:0;"><li>🚀 Chat en tiempo real con emoticones</li><li>📸 Publicaciones con reacciones y comentarios</li><li>🎭 Historias efímeras de 24h</li><li>👥 Amigos con solicitudes y perfiles</li><li>🔔 Notificaciones en tiempo real</li><li>🎬 Reels personalizados + YouTube</li><li>↗️ Compartir posts con amigos</li><li>🌙 Modo oscuro / claro</li></ul>');
};

window.showHowItWorks = function() {
    toggleModal(true, '<h2>Cómo funciona</h2><p style="margin-top:20px;line-height:1.8;color:#666;">Regístrate, personaliza tu perfil y empieza a conectar. Busca amigos, envía solicitudes, sube historias y publica momentos. El chat te conecta en tiempo real con todos tus contactos.</p>');
};

window.showPrivacy = function() {
    toggleModal(true, '<h2>Privacidad</h2><p style="margin-top:20px;line-height:1.8;color:#666;">Tus datos están almacenados localmente y tú decides qué compartir. En Sociality, la privacidad y el control son tuyos.</p>');
};

// ============================================================
// 5. REGISTRO Y LOGIN
// ============================================================
window.handleRegister = function() {
    var name = document.getElementById('regName').value.trim();
    var user = document.getElementById('regUser').value.trim();
    var pass = document.getElementById('regPass').value;
    if (!name || !user || !pass) return showToast('⚠️ Completa todos los campos');
    if (socialDB.users.find(function(u) { return u.username === user; })) return showToast('⚠️ El usuario ya existe');
    socialDB.users.push({ name:name, username:user, pass:pass, available:true, bio:'', profilePic:'', coverPic:'', friends:[], followers:[], following:[], createdAt:new Date().toISOString() });
    saveDB(); showToast('✅ ¡Cuenta creada! Ahora inicia sesión.'); toggleModal(false);
};

window.handleLogin = function() {
    var userIn = document.getElementById('logUser').value.trim();
    var passIn = document.getElementById('logPass').value;
    var found  = socialDB.users.find(function(u) { return u.username === userIn && u.pass === passIn; });
    if (found) { socialDB.currentUser = found; toggleModal(false); launchApp(); }
    else showToast('❌ Credenciales incorrectas');
};

var userToRecover = null;

window.verifyUserForRecovery = function() {
    var username = document.getElementById('recoveryUser').value.trim();
    userToRecover = socialDB.users.find(function(u) { return u.username === username; });
    if (userToRecover) {
        document.getElementById('recoveryStep2').style.display = 'block';
        document.getElementById('btnVerifyUser').style.display = 'none';
    } else showToast('❌ Usuario no encontrado');
};

window.handleResetPass = function() {
    var newPass = document.getElementById('newPass').value;
    if (!newPass) return showToast('⚠️ Introduce una contraseña');
    userToRecover.pass = newPass; saveDB(); showToast('✅ Contraseña actualizada'); closeRecoveryModal();
};

// ============================================================
// 6. LANZAR APP
// ============================================================
function launchApp() {
    document.getElementById('landingPage').style.display = 'none';
    document.getElementById('socialApp').style.display   = 'flex';
    updateSidebarProfile(); updateBadges(); cleanOldStories(); switchSection('inicio');
}

function updateSidebarProfile() {
    var u = socialDB.currentUser; if (!u) return;
    var av = document.getElementById('sidebarAvatar');
    av.innerHTML = renderAvatar(u, 38);
    if (!u.profilePic) { av.style.cssText = 'background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;'; }
    document.getElementById('sidebarName').textContent     = u.name;
    document.getElementById('sidebarUsername').textContent = '@' + u.username;
}

window.logoutUser = function() {
    socialDB.currentUser = null; socialDB.currentSection = 'inicio'; socialDB.reelPage = 0;
    document.getElementById('socialApp').style.display   = 'none';
    document.getElementById('landingPage').style.display = 'block';
    showToast('👋 Sesión cerrada');
};

// ============================================================
// 7. NAVEGACIÓN
// ============================================================
var SECTION_TITLES = { inicio:'Inicio', buscar:'Buscar personas', amigos:'Amigos', notificaciones:'Notificaciones', mensajes:'Mensajes', reels:'Reels' };

window.switchSection = function(section) {
    socialDB.currentSection = section;
    document.querySelectorAll('.sidebar-item').forEach(function(el) { el.classList.remove('active'); });
    var nav = document.getElementById('nav-' + section); if (nav) nav.classList.add('active');
    var titleEl = document.getElementById('sectionTitle'); if (titleEl) titleEl.textContent = SECTION_TITLES[section] || section;
    var area = document.getElementById('contentArea'); if (!area) return; area.innerHTML = '';
    if (section === 'inicio')         renderInicio(area);
    else if (section === 'buscar')    renderBuscar(area);
    else if (section === 'amigos')    renderAmigos(area);
    else if (section === 'notificaciones') renderNotificaciones(area);
    else if (section === 'mensajes')  renderMensajes(area);
    else if (section === 'reels')     renderReels(area);
    if (section === 'notificaciones') {
        socialDB.notifications.forEach(function(n) { if (n.to === socialDB.currentUser.username) n.read = true; });
        saveDB(); updateBadges();
    }
    if (section === 'mensajes') { if (socialDB.activeMessageUser) markMessagesRead(socialDB.activeMessageUser); updateBadges(); }
    renderRightSidebar();
};

// ============================================================
// 8. BADGES
// ============================================================
function updateBadges() {
    var u = socialDB.currentUser; if (!u) return;
    updateBadge('badge-notificaciones', socialDB.notifications.filter(function(n) { return n.to === u.username && !n.read; }).length);
    updateBadge('badge-amigos', socialDB.friendRequests.filter(function(r) { return r.to === u.username && r.status === 'pending'; }).length);
    var unread = 0;
    Object.values(socialDB.messages[u.username] || {}).forEach(function(msgs) { msgs.forEach(function(m) { if (m.from !== u.username && !m.read) unread++; }); });
    updateBadge('badge-mensajes', unread);
}

function updateBadge(id, count) {
    var el = document.getElementById(id); if (!el) return;
    if (count > 0) { el.style.display = 'flex'; el.textContent = count > 99 ? '99+' : count; } else el.style.display = 'none';
}

// ============================================================
// 9. INICIO — PERFIL + HISTORIAS + FEED
// ============================================================
function renderInicio(area) {
    var u = socialDB.currentUser;
    var myPosts = socialDB.posts.filter(function(p) { return p.authorUsername === u.username; });
    var friends = u.friends || [];

    area.innerHTML = '<div class="profile-info-card" id="profileCard">' +
        '<div style="position:relative;margin-bottom:55px;">' +
        '<div class="profile-cover" id="profileCoverEl" style="' + (u.coverPic ? 'background-image:url(' + u.coverPic + ');background-size:cover;background-position:center;' : '') + '">' +
        '<label style="position:absolute;bottom:10px;right:10px;cursor:pointer;background:rgba(0,0,0,0.5);color:#fff;padding:6px 12px;border-radius:15px;font-size:12px;display:flex;align-items:center;gap:5px;">' +
        '<i class="fa-solid fa-camera"></i> Portada<input type="file" hidden accept="image/*" onchange="changeCoverPic(this)"></label></div>' +
        '<div class="profile-pic-wrap"><div class="profile-pic">' + (u.profilePic ? '<img src="' + u.profilePic + '" alt="' + u.name + '">' : u.name[0].toUpperCase()) + '</div>' +
        '<label class="edit-pic-btn"><i class="fa-solid fa-camera"></i><input type="file" hidden accept="image/*" onchange="changeProfilePic(this)"></label></div></div>' +
        '<div style="padding-top:4px;">' +
        '<div class="profile-name">' + u.name + '</div>' +
        '<div class="profile-username">@' + u.username + '</div>' +
        '<div class="profile-bio-text">' + (u.bio || '<span style="color:var(--text-muted)">Sin bio aún.</span>') + '</div>' +
        '<div class="profile-stats">' +
        '<div class="stat-item"><div class="stat-count" id="statPosts">' + myPosts.length + '</div><div class="stat-label">Publicaciones</div></div>' +
        '<div class="stat-item"><div class="stat-count">' + (u.followers||[]).length + '</div><div class="stat-label">Seguidores</div></div>' +
        '<div class="stat-item"><div class="stat-count">' + (u.following||[]).length + '</div><div class="stat-label">Seguidos</div></div>' +
        '<div class="stat-item"><div class="stat-count">' + friends.length + '</div><div class="stat-label">Amigos</div></div>' +
        '</div>' +
        '<div class="profile-actions">' +
        '<button class="btn-outline" onclick="toggleEditProfile()"><i class="fa-solid fa-pen"></i> Editar perfil</button>' +
        '<button class="btn-outline" onclick="addStory()"><i class="fa-solid fa-plus"></i> Añadir historia</button>' +
        '</div>' +
        '<div id="editProfileForm" style="display:none;margin-top:14px;">' +
        '<input type="text" id="editNameInput" value="' + u.name + '" placeholder="Tu nombre" class="bio-edit-area" style="height:auto;padding:10px 14px;margin-bottom:8px;">' +
        '<textarea id="editBioInput" class="bio-edit-area" placeholder="Tu bio...">' + (u.bio || '') + '</textarea>' +
        '<button class="btn-join" onclick="saveProfileChanges()" style="margin-top:10px;width:100%;">Guardar cambios</button>' +
        '</div></div></div>' +
        '<div class="stories-row" id="storiesRow"></div>' +
        '<div class="create-post-card">' +
        '<div class="create-post-top"><div class="user-avatar">' + renderAvatar(u, 44) + '</div>' +
        '<textarea id="newPostTxt" placeholder="¿Qué quieres compartir hoy, ' + u.name.split(' ')[0] + '?"></textarea></div>' +
        '<div id="previewBox" class="media-preview-container"><img id="imgPrev" src="" alt="preview"><button onclick="removeMedia()" class="remove-media-btn">×</button></div>' +
        '<div class="create-post-bottom"><div class="post-media-actions">' +
        '<label class="btn-media"><i class="fa-solid fa-image" style="color:#4caf50;"></i> Foto<input type="file" id="mediaInput" hidden accept="image/*" onchange="handleMedia(this)"></label>' +
        '<label class="btn-media"><i class="fa-solid fa-face-smile" style="color:#f9c313;"></i> Sentimiento<input type="text" id="feelingInput" placeholder="¿Cómo te sientes?" style="width:120px;border:none;background:none;font-size:13px;outline:none;color:var(--text);font-family:inherit;"></label>' +
        '</div><button class="btn-join" onclick="publishPost()">Publicar</button></div></div>' +
        '<div id="feedPosts"></div>';

    renderStories(); renderPosts();
}

window.toggleEditProfile = function() {
    var form = document.getElementById('editProfileForm');
    if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
};

window.saveProfileChanges = function() {
    var newName = document.getElementById('editNameInput').value.trim();
    var newBio  = document.getElementById('editBioInput').value.trim();
    if (!newName) return showToast('⚠️ El nombre no puede estar vacío');
    socialDB.currentUser.name = newName; socialDB.currentUser.bio = newBio;
    var idx = socialDB.users.findIndex(function(u) { return u.username === socialDB.currentUser.username; });
    if (idx !== -1) { socialDB.users[idx].name = newName; socialDB.users[idx].bio = newBio; }
    saveDB(); updateSidebarProfile(); showToast('✅ Perfil actualizado');
    renderInicio(document.getElementById('contentArea'));
};

window.changeProfilePic = function(input) {
    if (!input.files[0]) return;
    var reader = new FileReader();
    reader.onload = function(e) {
        socialDB.currentUser.profilePic = e.target.result;
        var idx = socialDB.users.findIndex(function(u) { return u.username === socialDB.currentUser.username; });
        if (idx !== -1) socialDB.users[idx].profilePic = e.target.result;
        saveDB(); updateSidebarProfile(); renderInicio(document.getElementById('contentArea')); showToast('✅ Foto de perfil actualizada');
    };
    reader.readAsDataURL(input.files[0]);
};

window.changeCoverPic = function(input) {
    if (!input.files[0]) return;
    var reader = new FileReader();
    reader.onload = function(e) {
        socialDB.currentUser.coverPic = e.target.result;
        var idx = socialDB.users.findIndex(function(u) { return u.username === socialDB.currentUser.username; });
        if (idx !== -1) socialDB.users[idx].coverPic = e.target.result;
        saveDB(); renderInicio(document.getElementById('contentArea')); showToast('✅ Portada actualizada');
    };
    reader.readAsDataURL(input.files[0]);
};

// ============================================================
// 10. HISTORIAS
// ============================================================
function cleanOldStories() {
    var cutoff = Date.now() - 86400000;
    socialDB.stories = socialDB.stories.filter(function(s) { return new Date(s.createdAt).getTime() > cutoff; });
    saveDB();
}

function renderStories() {
    var row = document.getElementById('storiesRow'); if (!row) return;
    var u = socialDB.currentUser;
    var html = '<div class="story-item" onclick="addStory()">' +
        '<div class="story-ring add-story"><div class="story-ring-inner" style="display:flex;align-items:center;justify-content:center;background:var(--bg-input);">' +
        (u.profilePic ? '<img src="' + u.profilePic + '" alt="' + u.name + '">' : '<span style="font-size:20px;color:var(--primary);">' + u.name[0].toUpperCase() + '</span>') +
        '</div><div class="story-add-icon"><i class="fa-solid fa-plus"></i></div></div><span class="story-name">Tu historia</span></div>';
    var seen = {};
    socialDB.stories.filter(function(s) { return s.authorUsername !== u.username; }).forEach(function(story) {
        if (seen[story.authorUsername]) return; seen[story.authorUsername] = true;
        var author = getUser(story.authorUsername); if (!author) return;
        html += '<div class="story-item" onclick="viewStory(\'' + story.id + '\')">' +
            '<div class="story-ring"><div class="story-ring-inner">' +
            (author.profilePic ? '<img src="' + author.profilePic + '" alt="' + author.name + '">' : '<span style="font-size:20px;font-weight:700;color:var(--primary);">' + author.name[0].toUpperCase() + '</span>') +
            '</div></div><span class="story-name">' + author.name.split(' ')[0] + '</span></div>';
    });
    row.innerHTML = html;
}

window.addStory = function() {
    var input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
    input.onchange = function(e) {
        var file = e.target.files[0]; if (!file) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
            var u = socialDB.currentUser;
            socialDB.stories = socialDB.stories.filter(function(s) { return s.authorUsername !== u.username; });
            socialDB.stories.push({ id:'story_'+Date.now(), authorUsername:u.username, authorName:u.name, type:'image', content:ev.target.result, createdAt:new Date().toISOString() });
            saveDB(); showToast('✅ Historia publicada'); renderStories();
        };
        reader.readAsDataURL(file);
    };
    input.click();
};

window.viewStory = function(storyId) {
    var story = socialDB.stories.find(function(s) { return s.id === storyId; }); if (!story) return;
    var author = getUser(story.authorUsername); if (!author) return;
    var modal = document.getElementById('storyModal');
    var avatarEl = document.getElementById('storyModalAvatar');
    var fill = document.getElementById('storyProgressFill');
    fill.style.animation = 'none'; void fill.offsetWidth; fill.style.animation = 'progressStory 5s linear forwards';
    avatarEl.innerHTML = renderAvatar(author, 40);
    if (!author.profilePic) avatarEl.style.cssText = 'background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;';
    document.getElementById('storyModalAuthor').textContent = author.name;
    document.getElementById('storyModalTime').textContent   = timeAgo(story.createdAt);
    document.getElementById('storyModalBody').innerHTML = story.type === 'image' ? '<img src="' + story.content + '" style="width:100%;height:100%;object-fit:cover;">' : '<div class="story-text-content">' + story.content + '</div>';
    modal.style.display = 'flex';
    clearTimeout(socialDB.storyTimer);
    socialDB.storyTimer = setTimeout(function() { closeStoryModal(); }, 5000);
};

window.closeStoryModal = function() { document.getElementById('storyModal').style.display = 'none'; clearTimeout(socialDB.storyTimer); };

// ============================================================
// 11. POSTS — FEED COMPLETO CON AMIGOS
// ============================================================
function renderPosts() {
    var wrapper = document.getElementById('feedPosts'); if (!wrapper) return;
    var u = socialDB.currentUser;
    var friends = u.friends || [];
    var visible = socialDB.posts
        .filter(function(p) { return p.authorUsername === u.username || friends.indexOf(p.authorUsername) !== -1; })
        .sort(function(a,b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    if (visible.length === 0) {
        wrapper.innerHTML = '<div class="empty-state"><i class="fa-solid fa-newspaper"></i><p>Aún no hay publicaciones. ¡Sé el primero!</p></div>'; return;
    }
    wrapper.innerHTML = visible.map(function(p) { return buildPostHTML(p); }).join('');
}

function buildPostHTML(p) {
    var u = socialDB.currentUser;
    var likes = p.likes || []; var comments = p.comments || [];
    var reactions = p.reactions || {};
    var myReaction = null;
    var reactionEmojis = ['❤️','😂','😮','😢','👏','🔥'];
    reactionEmojis.forEach(function(e) { if (reactions[e] && reactions[e].indexOf(u.username) !== -1) myReaction = e; });
    var totalReactions = reactionEmojis.reduce(function(acc, e) { return acc + ((reactions[e]||[]).length); }, 0);
    var author = getUser(p.authorUsername) || { name:p.authorName, profilePic:'', username:p.authorUsername };
    var totalLikes = likes.length + totalReactions;
    var topReactionEmojis = reactionEmojis.filter(function(e) { return (reactions[e]||[]).length > 0; }).slice(0,3).join('');

    return '<div class="post-card" id="post-' + p.id + '">' +
        '<div class="post-header">' +
        '<div class="post-author-info">' +
        '<div class="post-author-avatar">' + renderAvatar(author, 44) + '</div>' +
        '<div><div class="post-author-name">' + p.authorName + '</div>' +
        '<div class="post-date">' + timeAgo(p.createdAt) + (p.feeling ? ' · 😊 Se siente <em>' + p.feeling + '</em>' : '') + (p.editedAt ? ' · <em style="color:var(--text-muted)">editado</em>' : '') + '</div></div></div>' +
        '<div class="post-menu">' + (p.authorUsername === u.username ? '<i class="fa-solid fa-pen" onclick="editPost(\'' + p.id + '\')" title="Editar"></i><i class="fa-solid fa-trash" onclick="deletePost(\'' + p.id + '\')" title="Eliminar"></i>' : '') + '</div></div>' +
        (p.content ? '<p class="post-content">' + p.content + '</p>' : '') +
        (p.media ? '<img src="' + p.media + '" class="post-media-content" onclick="openFullscreen(this.src)" alt="media">' : '') +
        (totalLikes > 0 ? '<div style="display:flex;align-items:center;gap:5px;margin-top:8px;font-size:13px;color:var(--text-muted);">' + (topReactionEmojis||'❤️') + ' <span>' + totalLikes + ' reacción' + (totalLikes>1?'es':'') + '</span></div>' : '') +
        '<div class="post-actions">' +
        '<div class="reaction-wrapper" style="position:relative;">' +
        '<button class="action-btn' + (myReaction ? ' liked' : '') + '" onmouseenter="showReactionBar(\'' + p.id + '\')" onmouseleave="scheduleHideReaction(\'' + p.id + '\')" onclick="toggleLike(\'' + p.id + '\')">' +
        '<span style="font-size:16px;">' + (myReaction || '🤍') + '</span><span>' + (totalLikes > 0 ? totalLikes : '') + ' Me gusta</span></button>' +
        '<div class="reaction-bar" id="reaction-bar-' + p.id + '" onmouseenter="clearReactionHide(\'' + p.id + '\')" onmouseleave="scheduleHideReaction(\'' + p.id + '\')">' +
        reactionEmojis.map(function(e) { return '<button class="reaction-emoji-btn' + (myReaction===e?' active':'') + '" onclick="reactToPost(\'' + p.id + '\',\'' + e + '\')" title="' + e + '">' + e + '</button>'; }).join('') +
        '</div></div>' +
        '<button class="action-btn" onclick="toggleComments(\'' + p.id + '\')"><i class="fa-regular fa-comment"></i><span>' + (comments.length > 0 ? comments.length : '') + ' Comentar</span></button>' +
        '<button class="action-btn" onclick="openShareModal(\'' + p.id + '\')"><i class="fa-solid fa-share-nodes"></i><span>Compartir</span></button>' +
        '</div>' +
        '<div id="comments-' + p.id + '" style="display:none;"><div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">' +
        comments.map(function(c) { return buildCommentHTML(c, p.id); }).join('') +
        '<div style="display:flex;gap:8px;margin-top:8px;align-items:center;">' +
        '<div style="width:30px;height:30px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;flex-shrink:0;overflow:hidden;">' + renderAvatar(u, 30) + '</div>' +
        '<input type="text" id="comment-input-' + p.id + '" placeholder="Escribe un comentario..." style="flex:1;border:1.5px solid var(--border);border-radius:20px;padding:8px 14px;font-size:13px;background:var(--bg-input);color:var(--text);outline:none;font-family:inherit;" onkeydown="if(event.key===\'Enter\') addComment(\'' + p.id + '\')">' +
        '<button onclick="addComment(\'' + p.id + '\')" style="background:var(--gradient);border:none;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fa-solid fa-paper-plane"></i></button>' +
        '</div></div></div></div>';
}

function buildCommentHTML(c, postId) {
    var u = socialDB.currentUser;
    var author = getUser(c.authorUsername) || { name:c.authorName, profilePic:'', username:c.authorUsername };
    var cLikes = c.likes || []; var cLiked = cLikes.indexOf(u.username) !== -1;
    var replies = c.replies || [];
    return '<div class="comment-thread" id="comment-' + c.id + '">' +
        '<div style="display:flex;gap:8px;margin-bottom:6px;align-items:flex-start;">' +
        '<div style="width:30px;height:30px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;flex-shrink:0;overflow:hidden;">' + renderAvatar(author, 30) + '</div>' +
        '<div style="flex:1;"><div style="background:var(--bg-input);padding:8px 12px;border-radius:12px;"><strong style="font-size:13px;">' + c.authorName + '</strong><div style="font-size:13px;margin-top:2px;color:var(--text);">' + c.content + '</div></div>' +
        '<div style="display:flex;gap:14px;margin-top:4px;padding-left:8px;">' +
        '<span style="font-size:11px;color:var(--text-muted);">' + timeAgo(c.createdAt) + '</span>' +
        '<span onclick="likeComment(\'' + postId + '\',\'' + c.id + '\')" style="font-size:12px;cursor:pointer;font-weight:600;color:' + (cLiked ? 'var(--primary)' : 'var(--text-muted)') + ';">' + (cLiked ? '❤️' : '🤍') + ' ' + (cLikes.length > 0 ? cLikes.length : '') + '</span>' +
        '<span onclick="toggleReplyInput(\'' + postId + '\',\'' + c.id + '\')" style="font-size:12px;cursor:pointer;font-weight:600;color:var(--text-muted);">↩ Responder</span>' +
        (c.authorUsername === u.username ? '<span onclick="deleteComment(\'' + postId + '\',\'' + c.id + '\')" style="font-size:12px;cursor:pointer;color:#ff4d4d;">Eliminar</span>' : '') +
        '</div></div></div>' +
        (replies.length > 0 ? '<div style="margin-left:38px;">' + replies.map(function(r) {
            var ra = getUser(r.authorUsername) || { name:r.authorName, profilePic:'' };
            return '<div style="display:flex;gap:8px;margin-bottom:6px;"><div style="width:26px;height:26px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700;flex-shrink:0;overflow:hidden;">' + renderAvatar(ra, 26) + '</div><div style="flex:1;background:var(--bg-input);padding:7px 11px;border-radius:10px;"><strong style="font-size:12px;">' + r.authorName + '</strong><div style="font-size:12px;margin-top:1px;color:var(--text);">' + r.content + '</div></div></div>';
        }).join('') + '</div>' : '') +
        '<div id="reply-input-' + postId + '-' + c.id + '" style="display:none;margin-left:38px;margin-bottom:8px;">' +
        '<div style="display:flex;gap:6px;align-items:center;">' +
        '<input type="text" id="reply-text-' + postId + '-' + c.id + '" placeholder="Responder a ' + c.authorName + '..." style="flex:1;border:1.5px solid var(--border);border-radius:20px;padding:7px 13px;font-size:12px;background:var(--bg-input);color:var(--text);outline:none;font-family:inherit;" onkeydown="if(event.key===\'Enter\') submitReply(\'' + postId + '\',\'' + c.id + '\')">' +
        '<button onclick="submitReply(\'' + postId + '\',\'' + c.id + '\')" style="background:var(--gradient);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fa-solid fa-paper-plane"></i></button>' +
        '</div></div></div>';
}

// ============================================================
// 12. ACCIONES DE POST (REACCIONES, COMENTARIOS, RESPUESTAS)
// ============================================================
var reactionHideTimers = {};

window.showReactionBar = function(postId) {
    clearTimeout(reactionHideTimers[postId]);
    var bar = document.getElementById('reaction-bar-' + postId); if (bar) bar.classList.add('visible');
};

window.scheduleHideReaction = function(postId) {
    reactionHideTimers[postId] = setTimeout(function() {
        var bar = document.getElementById('reaction-bar-' + postId); if (bar) bar.classList.remove('visible');
    }, 400);
};

window.clearReactionHide = function(postId) { clearTimeout(reactionHideTimers[postId]); };

window.reactToPost = function(postId, emoji) {
    var post = socialDB.posts.find(function(p) { return p.id === postId; }); if (!post) return;
    var u = socialDB.currentUser;
    if (!post.reactions) post.reactions = {};
    ['❤️','😂','😮','😢','👏','🔥'].forEach(function(e) { if (!post.reactions[e]) post.reactions[e] = []; post.reactions[e] = post.reactions[e].filter(function(x) { return x !== u.username; }); });
    if (!post.reactions[emoji]) post.reactions[emoji] = [];
    post.reactions[emoji].push(u.username);
    if (post.authorUsername !== u.username) addNotification(post.authorUsername, 'like', '<strong>' + u.name + '</strong> reaccionó ' + emoji + ' a tu publicación');
    saveDB(); renderPosts();
};

window.toggleLike = function(postId) {
    var post = socialDB.posts.find(function(p) { return p.id === postId; }); if (!post) return;
    var u = socialDB.currentUser; if (!post.likes) post.likes = [];
    var idx = post.likes.indexOf(u.username);
    if (idx === -1) { post.likes.push(u.username); if (post.authorUsername !== u.username) addNotification(post.authorUsername, 'like', '<strong>' + u.name + '</strong> le dio Me gusta a tu publicación'); }
    else post.likes.splice(idx, 1);
    saveDB(); renderPosts();
};

window.toggleComments = function(postId) {
    var el = document.getElementById('comments-' + postId); if (!el) return;
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

window.addComment = function(postId) {
    var input = document.getElementById('comment-input-' + postId); if (!input || !input.value.trim()) return;
    var post = socialDB.posts.find(function(p) { return p.id === postId; }); if (!post) return;
    var u = socialDB.currentUser; if (!post.comments) post.comments = [];
    post.comments.push({ id:'c_'+Date.now()+Math.random(), authorUsername:u.username, authorName:u.name, content:input.value.trim(), likes:[], replies:[], createdAt:new Date().toISOString() });
    if (post.authorUsername !== u.username) addNotification(post.authorUsername, 'comment', '<strong>' + u.name + '</strong> comentó en tu publicación');
    saveDB(); renderPosts();
    setTimeout(function() { var el = document.getElementById('comments-' + postId); if (el) el.style.display = 'block'; }, 50);
};

window.likeComment = function(postId, commentId) {
    var post = socialDB.posts.find(function(p) { return p.id === postId; }); if (!post) return;
    var c = (post.comments||[]).find(function(x) { return x.id === commentId; }); if (!c) return;
    var u = socialDB.currentUser; if (!c.likes) c.likes = [];
    var idx = c.likes.indexOf(u.username); if (idx === -1) c.likes.push(u.username); else c.likes.splice(idx, 1);
    saveDB(); renderPosts();
    setTimeout(function() { var el = document.getElementById('comments-' + postId); if (el) el.style.display = 'block'; }, 50);
};

window.toggleReplyInput = function(postId, commentId) {
    var el = document.getElementById('reply-input-' + postId + '-' + commentId); if (!el) return;
    el.style.display = el.style.display === 'none' ? 'flex' : 'none';
    if (el.style.display !== 'none') { var i = document.getElementById('reply-text-' + postId + '-' + commentId); if (i) i.focus(); }
};

window.submitReply = function(postId, commentId) {
    var input = document.getElementById('reply-text-' + postId + '-' + commentId); if (!input || !input.value.trim()) return;
    var post = socialDB.posts.find(function(p) { return p.id === postId; }); if (!post) return;
    var c = (post.comments||[]).find(function(x) { return x.id === commentId; }); if (!c) return;
    var u = socialDB.currentUser; if (!c.replies) c.replies = [];
    c.replies.push({ id:'r_'+Date.now(), authorUsername:u.username, authorName:u.name, content:input.value.trim(), createdAt:new Date().toISOString() });
    if (c.authorUsername !== u.username) addNotification(c.authorUsername, 'comment', '<strong>' + u.name + '</strong> respondió a tu comentario');
    saveDB(); renderPosts();
    setTimeout(function() { var el = document.getElementById('comments-' + postId); if (el) el.style.display = 'block'; }, 50);
};

window.deleteComment = function(postId, commentId) {
    var post = socialDB.posts.find(function(p) { return p.id === postId; }); if (!post) return;
    post.comments = (post.comments||[]).filter(function(c) { return c.id !== commentId; });
    saveDB(); renderPosts();
    setTimeout(function() { var el = document.getElementById('comments-' + postId); if (el) el.style.display = 'block'; }, 50);
};

window.deletePost = function(postId) {
    if (!confirm('¿Eliminar esta publicación?')) return;
    socialDB.posts = socialDB.posts.filter(function(p) { return p.id !== postId; });
    saveDB(); showToast('🗑️ Publicación eliminada'); renderPosts();
    var el = document.getElementById('statPosts'); if (el) el.textContent = socialDB.posts.filter(function(p) { return p.authorUsername === socialDB.currentUser.username; }).length;
};

window.editPost = function(postId) {
    var post = socialDB.posts.find(function(p) { return p.id === postId; }); if (!post) return;
    var newContent = prompt('Editar publicación:', post.content); if (newContent === null) return;
    post.content = newContent.trim(); post.editedAt = new Date().toISOString();
    saveDB(); showToast('✅ Publicación actualizada'); renderPosts();
};

window.handleMedia = function(input) {
    if (!input.files[0]) return;
    var reader = new FileReader();
    reader.onload = function(e) {
        socialDB.tempMedia = e.target.result;
        var prev = document.getElementById('imgPrev'); var box = document.getElementById('previewBox');
        if (prev && box) { prev.src = e.target.result; box.style.display = 'block'; }
    };
    reader.readAsDataURL(input.files[0]);
};

window.removeMedia = function() { socialDB.tempMedia = null; var box = document.getElementById('previewBox'); if (box) box.style.display = 'none'; };

window.publishPost = function() {
    var txt = document.getElementById('newPostTxt'); var feeling = document.getElementById('feelingInput'); if (!txt) return;
    var content = txt.value.trim(); var feelingVal = feeling ? feeling.value.trim() : '';
    if (!content && !socialDB.tempMedia) return showToast('⚠️ Escribe algo o añade una imagen');
    var u = socialDB.currentUser;
    socialDB.posts.unshift({ id:'post_'+Date.now(), authorUsername:u.username, authorName:u.name, content:content, feeling:feelingVal, media:socialDB.tempMedia, likes:[], reactions:{}, comments:[], createdAt:new Date().toISOString() });
    socialDB.tempMedia = null; saveDB();
    if (txt) txt.value = ''; if (feeling) feeling.value = '';
    removeMedia(); showToast('✅ Publicación creada'); renderPosts();
    var el = document.getElementById('statPosts'); if (el) el.textContent = socialDB.posts.filter(function(p) { return p.authorUsername === u.username; }).length;
};

// ============================================================
// 13. COMPARTIR POST CON AMIGOS
// ============================================================
window.openShareModal = function(postId) {
    socialDB.sharePostId = postId;
    var u = socialDB.currentUser;
    var friends = (u.friends || []).map(function(fn) { return getUser(fn); }).filter(Boolean);
    var overlay = document.getElementById('shareModalOverlay'); if (!overlay) return;
    var inner;
    if (friends.length === 0) {
        inner = '<div class="empty-state"><i class="fa-solid fa-user-group"></i><p>Agrega amigos para compartir publicaciones.</p></div>';
    } else {
        inner = '<div style="max-height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;">' +
            friends.map(function(f) {
                return '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:14px;background:var(--bg-input);cursor:pointer;transition:0.2s;" onmouseenter="this.style.background=\'var(--bg-hover)\'" onmouseleave="this.style.background=\'var(--bg-input)\'" onclick="sendSharedPost(\'' + f.username + '\')">' +
                    '<div style="width:40px;height:40px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;overflow:hidden;flex-shrink:0;">' + renderAvatar(f, 40) + '</div>' +
                    '<div style="flex:1;"><div style="font-weight:600;font-size:14px;">' + f.name + '</div><div style="font-size:12px;color:var(--text-muted);">@' + f.username + '</div></div>' +
                    '<i class="fa-solid fa-paper-plane" style="color:var(--primary);font-size:16px;"></i></div>';
            }).join('') + '</div>';
    }
    overlay.innerHTML = '<div class="modal-box" style="max-width:400px;"><h2 style="margin-bottom:18px;">↗️ Compartir con un amigo</h2>' + inner + '<p class="close-text" onclick="closeShareModal()">Cancelar</p></div>';
    overlay.style.display = 'flex';
    setTimeout(function() { overlay.classList.add('active'); }, 10);
};

window.closeShareModal = function() {
    var overlay = document.getElementById('shareModalOverlay'); if (!overlay) return;
    overlay.classList.remove('active');
    setTimeout(function() { overlay.style.display = 'none'; overlay.innerHTML = ''; }, 400);
};

window.sendSharedPost = function(toUsername) {
    var post = socialDB.posts.find(function(p) { return p.id === socialDB.sharePostId; }); if (!post) return;
    var u = socialDB.currentUser;
    var msg = '📤 ' + u.name + ' te compartió: "' + (post.content ? post.content.substring(0,60) + (post.content.length>60?'...':'') : '[Imagen]') + '"';
    sendMessageTo(toUsername, msg);
    addNotification(toUsername, 'message', '<strong>' + u.name + '</strong> te compartió una publicación');
    closeShareModal(); showToast('✅ Compartido con ' + (getUser(toUsername) ? getUser(toUsername).name : toUsername));
};

// ============================================================
// 14. BUSCAR
// ============================================================
function renderBuscar(area) {
    area.innerHTML = '<div class="search-page-box"><h3 style="margin:0 0 18px;font-size:18px;">Encuentra personas</h3><div class="search-input-wrap"><i class="fa-solid fa-magnifying-glass"></i><input class="search-big-input" type="text" id="userSearchInput" placeholder="Buscar por nombre o usuario..." oninput="filterSearchResults()" autofocus></div><div class="search-results" id="searchResults"></div></div>';
    filterSearchResults();
}

window.filterSearchResults = function() {
    var query = ((document.getElementById('userSearchInput') ? document.getElementById('userSearchInput').value : '') || '').toLowerCase().trim();
    var u = socialDB.currentUser; var results = document.getElementById('searchResults'); if (!results) return;
    var filtered = socialDB.users.filter(function(user) { return user.username !== u.username && (user.name.toLowerCase().indexOf(query) !== -1 || user.username.toLowerCase().indexOf(query) !== -1); });
    if (filtered.length === 0) { results.innerHTML = '<div class="empty-state"><i class="fa-solid fa-user-slash"></i><p>No se encontraron usuarios' + (query ? ' para "' + query + '"' : '') + '.</p></div>'; return; }
    results.innerHTML = filtered.map(function(user) {
        var isFriend = (u.friends || []).indexOf(user.username) !== -1;
        var pendingReq = socialDB.friendRequests.find(function(r) { return r.from === u.username && r.to === user.username && r.status === 'pending'; });
        var btnHTML;
        if (isFriend) btnHTML = '<button class="btn-add-friend friends" disabled><i class="fa-solid fa-user-check"></i> Amigos</button>';
        else if (pendingReq) btnHTML = '<button class="btn-add-friend sent" disabled><i class="fa-solid fa-clock"></i> Enviada</button>';
        else btnHTML = '<button class="btn-add-friend" onclick="sendFriendRequest(\'' + user.username + '\')"><i class="fa-solid fa-user-plus"></i> Agregar</button>';
        return '<div class="search-user-card"><div class="search-user-avatar">' + renderAvatar(user, 48) + '</div><div class="search-user-info"><div class="search-user-name">' + user.name + '</div><div class="search-user-handle">@' + user.username + '</div></div>' + btnHTML + '</div>';
    }).join('');
};

// ============================================================
// 15. SOLICITUDES DE AMISTAD
// ============================================================
window.sendFriendRequest = function(toUsername) {
    var u = socialDB.currentUser;
    if (socialDB.friendRequests.find(function(r) { return r.from === u.username && r.to === toUsername && r.status === 'pending'; })) return showToast('⚠️ Ya enviaste una solicitud');
    socialDB.friendRequests.push({ id:'req_'+Date.now(), from:u.username, to:toUsername, status:'pending', createdAt:new Date().toISOString() });
    addNotification(toUsername, 'friend_request', '<strong>' + u.name + '</strong> te envió una solicitud de amistad');
    saveDB(); showToast('✅ Solicitud enviada'); filterSearchResults(); updateBadges();
};

window.acceptFriendRequest = function(reqId) {
    var req = socialDB.friendRequests.find(function(r) { return r.id === reqId; }); if (!req) return;
    req.status = 'accepted';
    var u = socialDB.currentUser; var fromUser = getUser(req.from); if (!fromUser) return;
    if (!u.friends) u.friends = []; if (!fromUser.friends) fromUser.friends = [];
    if (u.friends.indexOf(req.from) === -1)          u.friends.push(req.from);
    if (fromUser.friends.indexOf(u.username) === -1) fromUser.friends.push(u.username);
    if (!u.followers) u.followers = []; if (!fromUser.following) fromUser.following = [];
    if (u.followers.indexOf(req.from) === -1)           u.followers.push(req.from);
    if (fromUser.following.indexOf(u.username) === -1)  fromUser.following.push(u.username);
    var uIdx = socialDB.users.findIndex(function(x) { return x.username === u.username; });
    var fromIdx = socialDB.users.findIndex(function(x) { return x.username === req.from; });
    if (uIdx !== -1)    socialDB.users[uIdx]    = u;
    if (fromIdx !== -1) socialDB.users[fromIdx] = fromUser;
    addNotification(req.from, 'friend_accepted', '<strong>' + u.name + '</strong> aceptó tu solicitud de amistad');
    saveDB(); showToast('✅ ¡Ahora son amigos!'); updateBadges();
    renderAmigos(document.getElementById('contentArea'));
};

window.rejectFriendRequest = function(reqId) {
    var req = socialDB.friendRequests.find(function(r) { return r.id === reqId; });
    if (req) req.status = 'rejected';
    saveDB(); showToast('❌ Solicitud rechazada'); updateBadges();
    renderAmigos(document.getElementById('contentArea'));
};

// ============================================================
// 16. AMIGOS + VER PERFIL
// ============================================================
function renderAmigos(area) {
    var u = socialDB.currentUser;
    var pendingReqs = socialDB.friendRequests.filter(function(r) { return r.to === u.username && r.status === 'pending'; });
    var friends = (u.friends || []).map(function(fn) { return getUser(fn); }).filter(Boolean);
    area.innerHTML = '<div class="friends-tabs">' +
        '<button class="friend-tab active" id="tab-friends" onclick="showFriendsTab(\'friends\')">Mis Amigos (' + friends.length + ')</button>' +
        '<button class="friend-tab" id="tab-requests" onclick="showFriendsTab(\'requests\')">Solicitudes' + (pendingReqs.length > 0 ? ' <span style="background:var(--secondary);color:#fff;padding:1px 6px;border-radius:10px;font-size:11px;margin-left:4px;">' + pendingReqs.length + '</span>' : '') + '</button>' +
        '</div><div id="friendsTabContent"></div>';
    showFriendsTab('friends');
}

window.showFriendsTab = function(tab) {
    document.querySelectorAll('.friend-tab').forEach(function(t) { t.classList.remove('active'); });
    var activeTab = document.getElementById('tab-' + tab); if (activeTab) activeTab.classList.add('active');
    var u = socialDB.currentUser; var content = document.getElementById('friendsTabContent'); if (!content) return;
    if (tab === 'friends') {
        var friends = (u.friends || []).map(function(fn) { return getUser(fn); }).filter(Boolean);
        if (friends.length === 0) { content.innerHTML = '<div class="empty-state"><i class="fa-solid fa-user-group"></i><p>Aún no tienes amigos.</p></div>'; return; }
        content.innerHTML = '<div class="friends-grid">' + friends.map(function(f) {
            return '<div class="friend-card">' +
                '<div class="friend-card-avatar" onclick="viewFriendProfile(\'' + f.username + '\')" style="cursor:pointer;">' + renderAvatar(f, 62) + '</div>' +
                '<div class="friend-card-name" onclick="viewFriendProfile(\'' + f.username + '\')" style="cursor:pointer;">' + f.name + '</div>' +
                '<div style="font-size:11px;color:var(--text-muted);margin-bottom:10px;">@' + f.username + '</div>' +
                '<div style="display:flex;gap:6px;justify-content:center;">' +
                '<button class="btn-message-friend" onclick="viewFriendProfile(\'' + f.username + '\')"><i class="fa-solid fa-user"></i> Perfil</button>' +
                '<button class="btn-message-friend" onclick="openChatWith(\'' + f.username + '\')"><i class="fa-solid fa-message"></i> Chat</button>' +
                '</div></div>';
        }).join('') + '</div>';
    } else {
        var pending = socialDB.friendRequests.filter(function(r) { return r.to === u.username && r.status === 'pending'; });
        if (pending.length === 0) { content.innerHTML = '<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>No tienes solicitudes pendientes.</p></div>'; return; }
        content.innerHTML = pending.map(function(req) {
            var fromUser = getUser(req.from); if (!fromUser) return '';
            return '<div class="friend-request-card">' +
                '<div style="width:44px;height:44px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;overflow:hidden;flex-shrink:0;">' + renderAvatar(fromUser, 44) + '</div>' +
                '<div style="flex:1;"><div style="font-weight:700;">' + fromUser.name + '</div><div style="font-size:12px;color:var(--text-muted);">@' + fromUser.username + ' · ' + timeAgo(req.createdAt) + '</div></div>' +
                '<div class="request-actions"><button class="btn-accept" onclick="acceptFriendRequest(\'' + req.id + '\')">Aceptar</button><button class="btn-reject" onclick="rejectFriendRequest(\'' + req.id + '\')">Rechazar</button></div>' +
                '</div>';
        }).join('');
    }
};

window.viewFriendProfile = function(username) {
    var friend = getUser(username); if (!friend) return;
    var u = socialDB.currentUser;
    var friendPosts = socialDB.posts.filter(function(p) { return p.authorUsername === username; });
    var overlay = document.getElementById('friendProfileOverlay'); if (!overlay) return;

    overlay.innerHTML = '<div class="modal-box" style="max-width:480px;padding:0;overflow:hidden;border-radius:24px;">' +
        '<div style="height:130px;background:' + (friend.coverPic ? 'url(' + friend.coverPic + ') center/cover' : 'var(--gradient)') + ';position:relative;">' +
        '<button onclick="closeFriendProfile()" style="position:absolute;top:12px;right:12px;background:rgba(0,0,0,0.5);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;">×</button></div>' +
        '<div style="padding:0 24px 24px;position:relative;">' +
        '<div style="width:76px;height:76px;border-radius:50%;border:4px solid var(--bg-card);position:absolute;top:-38px;left:24px;overflow:hidden;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:26px;">' + renderAvatar(friend, 76) + '</div>' +
        '<div style="padding-top:46px;">' +
        '<div style="font-size:20px;font-weight:800;">' + friend.name + '</div>' +
        '<div style="font-size:14px;color:var(--text-muted);margin-bottom:8px;">@' + friend.username + '</div>' +
        (friend.bio ? '<div style="font-size:14px;color:var(--text-secondary);margin-bottom:14px;">' + friend.bio + '</div>' : '') +
        '<div style="display:flex;gap:20px;padding:12px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);margin-bottom:14px;">' +
        '<div style="text-align:center;"><div style="font-size:18px;font-weight:800;color:var(--primary);">' + friendPosts.length + '</div><div style="font-size:12px;color:var(--text-muted);">Posts</div></div>' +
        '<div style="text-align:center;"><div style="font-size:18px;font-weight:800;color:var(--primary);">' + (friend.followers||[]).length + '</div><div style="font-size:12px;color:var(--text-muted);">Seguidores</div></div>' +
        '<div style="text-align:center;"><div style="font-size:18px;font-weight:800;color:var(--primary);">' + (friend.following||[]).length + '</div><div style="font-size:12px;color:var(--text-muted);">Seguidos</div></div>' +
        '<div style="text-align:center;"><div style="font-size:18px;font-weight:800;color:var(--primary);">' + (friend.friends||[]).length + '</div><div style="font-size:12px;color:var(--text-muted);">Amigos</div></div>' +
        '</div>' +
        '<div style="display:flex;gap:10px;margin-bottom:16px;"><button class="btn-join" onclick="openChatWith(\'' + friend.username + '\');closeFriendProfile();" style="flex:1;padding:10px;"><i class="fa-solid fa-message"></i> Enviar mensaje</button></div>' +
        (friendPosts.length > 0 ?
            '<div style="font-weight:700;font-size:14px;margin-bottom:10px;">Publicaciones recientes</div>' +
            '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;max-height:200px;overflow-y:auto;">' +
            friendPosts.map(function(p) {
                return p.media ? '<img src="' + p.media + '" onclick="openFullscreen(\'' + p.media + '\')" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;cursor:pointer;">' :
                    '<div style="background:var(--bg-input);border-radius:8px;aspect-ratio:1;display:flex;align-items:center;justify-content:center;padding:6px;font-size:11px;color:var(--text-secondary);text-align:center;overflow:hidden;">' + (p.content ? p.content.substring(0,50) : '...') + '</div>';
            }).join('') + '</div>' :
            '<div style="text-align:center;color:var(--text-muted);font-size:14px;">Sin publicaciones aún.</div>'
        ) + '</div></div></div>';

    overlay.style.display = 'flex';
    setTimeout(function() { overlay.classList.add('active'); }, 10);
};

window.closeFriendProfile = function() {
    var overlay = document.getElementById('friendProfileOverlay'); if (!overlay) return;
    overlay.classList.remove('active');
    setTimeout(function() { overlay.style.display = 'none'; overlay.innerHTML = ''; }, 400);
};

// ============================================================
// 17. NOTIFICACIONES
// ============================================================
function addNotification(toUsername, type, text) {
    socialDB.notifications.unshift({ id:'notif_'+Date.now()+Math.random(), to:toUsername, type:type, text:text, read:false, createdAt:new Date().toISOString() });
    saveDB(); updateBadges();
}

function renderNotificaciones(area) {
    var u = socialDB.currentUser;
    var notifs = socialDB.notifications.filter(function(n) { return n.to === u.username; });
    if (notifs.length === 0) { area.innerHTML = '<div class="empty-state"><i class="fa-solid fa-bell-slash"></i><p>No tienes notificaciones.</p></div>'; return; }
    var iconMap = { like:'fa-heart', comment:'fa-comment', friend_request:'fa-user-plus', friend_accepted:'fa-user-check', message:'fa-message' };
    area.innerHTML = notifs.map(function(n) {
        return '<div class="notif-item ' + (n.read?'':'unread') + '" onclick="markNotifRead(\'' + n.id + '\')">' +
            '<div class="notif-icon" style="' + (n.type==='like'?'background:linear-gradient(135deg,#e91e63,#f44336)':'') + '"><i class="fa-solid ' + (iconMap[n.type]||'fa-bell') + '"></i></div>' +
            '<div class="notif-text">' + n.text + '</div><div class="notif-time">' + timeAgo(n.createdAt) + '</div>' +
            (!n.read ? '<div class="notif-dot"></div>' : '') + '</div>';
    }).join('');
}

window.markNotifRead = function(notifId) {
    var n = socialDB.notifications.find(function(x) { return x.id === notifId; });
    if (n) { n.read = true; saveDB(); updateBadges(); }
};

// ============================================================
// 18. MENSAJES
// ============================================================
function renderMensajes(area) {
    var u = socialDB.currentUser;
    var friends = (u.friends || []).map(function(fn) { return getUser(fn); }).filter(Boolean);
    var listHTML;
    if (friends.length === 0) {
        listHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:14px;">Agrega amigos para chatear</div>';
    } else {
        listHTML = friends.map(function(f) {
            var conv = getConversation(u.username, f.username);
            var lastMsg = conv.length > 0 ? conv[conv.length-1] : null;
            var unread = conv.filter(function(m) { return m.from === f.username && !m.read; }).length;
            return '<div class="message-preview-item ' + (socialDB.activeMessageUser===f.username?'active':'') + '" onclick="openMessagePanel(\'' + f.username + '\')">' +
                '<div class="msg-preview-avatar">' + renderAvatar(f, 42) + '</div>' +
                '<div class="msg-preview-info"><div class="msg-preview-name">' + f.name + '</div>' +
                '<div class="msg-preview-last">' + (lastMsg ? (lastMsg.from===u.username?'Tú: ':'') + lastMsg.text.substring(0,30) + (lastMsg.text.length>30?'...':'') : 'Sin mensajes aún') + '</div></div>' +
                (unread > 0 ? '<div class="msg-unread-dot"></div>' : '') + '</div>';
        }).join('');
    }
    area.innerHTML = '<div class="messages-layout"><div class="messages-list-panel"><div class="messages-panel-header">💬 Mensajes</div><div class="messages-list" id="messagesList">' + listHTML + '</div></div><div class="messages-chat-panel" id="messagesChatPanel"><div class="no-chat-selected"><i class="fa-regular fa-comment-dots"></i><p>Selecciona una conversación</p></div></div></div>';
    if (socialDB.activeMessageUser) openMessagePanel(socialDB.activeMessageUser);
}

window.openMessagePanel = function(username) {
    socialDB.activeMessageUser = username; markMessagesRead(username); updateBadges();
    var panel = document.getElementById('messagesChatPanel'); if (!panel) return;
    var friend = getUser(username); if (!friend) return;
    var conv = getConversation(socialDB.currentUser.username, username);
    var msgsHTML = conv.length === 0
        ? '<div style="text-align:center;color:var(--text-muted);font-size:14px;margin-top:30px;">Inicia la conversación con ' + friend.name + ' 👋</div>'
        : conv.map(function(m) {
            var isMe = m.from === socialDB.currentUser.username;
            return '<div class="msg ' + (isMe?'msg-me':'msg-them') + '">' + m.text + '<div class="msg-time">' + timeAgo(m.createdAt) + '</div></div>';
        }).join('');
    var emojiHTML = EMOJIS.map(function(e) { return '<button onclick="insertPanelEmoji(\'' + e + '\')" style="background:none;border:none;font-size:22px;cursor:pointer;padding:3px;border-radius:6px;">' + e + '</button>'; }).join('');
    panel.innerHTML = '<div class="chat-panel-header">' +
        '<div style="width:36px;height:36px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;overflow:hidden;">' + renderAvatar(friend, 36) + '</div>' +
        '<span>' + friend.name + '</span><div style="width:10px;height:10px;border-radius:50%;background:#4caf50;"></div></div>' +
        '<div class="chat-panel-messages" id="panelMessages">' + msgsHTML + '</div>' +
        '<div class="chat-panel-input">' +
        '<button class="chat-panel-emoji" onclick="togglePanelEmoji()"><i class="fa-regular fa-face-smile"></i></button>' +
        '<input type="text" id="panelMsgInput" placeholder="Escribe un mensaje..." onkeydown="if(event.key===\'Enter\') sendPanelMessage(\'' + username + '\')">' +
        '<button class="chat-panel-send" onclick="sendPanelMessage(\'' + username + '\')"><i class="fa-solid fa-paper-plane"></i></button></div>' +
        '<div id="panelEmojiPicker" style="display:none;border-top:1px solid var(--border);background:var(--bg-card);padding:10px;max-height:160px;overflow-y:auto;"><div style="display:flex;flex-wrap:wrap;gap:4px;">' + emojiHTML + '</div></div>';
    var msgs = document.getElementById('panelMessages'); if (msgs) msgs.scrollTop = msgs.scrollHeight;
    renderMensajes(document.getElementById('contentArea'));
};

window.sendPanelMessage = function(toUsername) {
    var input = document.getElementById('panelMsgInput'); if (!input || !input.value.trim()) return;
    sendMessageTo(toUsername, input.value.trim()); input.value = ''; openMessagePanel(toUsername);
};

window.togglePanelEmoji = function() { var p = document.getElementById('panelEmojiPicker'); if (p) p.style.display = p.style.display==='none'?'block':'none'; };
window.insertPanelEmoji = function(emoji) { var i = document.getElementById('panelMsgInput'); if (i) { i.value += emoji; i.focus(); } };

function getConversation(user1, user2) {
    if (!socialDB.messages[user1]) socialDB.messages[user1] = {};
    if (!socialDB.messages[user1][user2]) socialDB.messages[user1][user2] = [];
    if (!socialDB.messages[user2]) socialDB.messages[user2] = {};
    if (!socialDB.messages[user2][user1]) socialDB.messages[user2][user1] = [];
    var msgs1 = socialDB.messages[user1][user2]; var msgs2 = socialDB.messages[user2][user1];
    var allIds = {}; msgs1.forEach(function(m) { allIds[m.id]=m; }); msgs2.forEach(function(m) { allIds[m.id]=m; });
    return Object.values(allIds).sort(function(a,b) { return new Date(a.createdAt)-new Date(b.createdAt); });
}

function sendMessageTo(toUsername, text) {
    var u = socialDB.currentUser;
    var msg = { id:'msg_'+Date.now()+Math.random(), from:u.username, to:toUsername, text:text, read:false, createdAt:new Date().toISOString() };
    [u.username, toUsername].forEach(function(owner, i) {
        var other = i===0 ? toUsername : u.username;
        if (!socialDB.messages[owner]) socialDB.messages[owner] = {};
        if (!socialDB.messages[owner][other]) socialDB.messages[owner][other] = [];
        socialDB.messages[owner][other].push(msg);
    });
    addNotification(toUsername, 'message', '<strong>' + u.name + '</strong> te envió un mensaje');
    saveDB(); updateBadges();
}

function markMessagesRead(fromUsername) {
    var u = socialDB.currentUser;
    [[u.username, fromUsername],[fromUsername, u.username]].forEach(function(pair) {
        var owner = pair[0]; var other = pair[1];
        if (socialDB.messages[owner] && socialDB.messages[owner][other])
            socialDB.messages[owner][other].forEach(function(m) { if (m.from === other) m.read = true; });
    });
    saveDB();
}

// ============================================================
// 19. CHAT FLOTANTE
// ============================================================
var EMOJIS = ['😀','😂','😍','🥰','😎','🤔','😢','😡','🥳','🤩','👋','👍','👏','🙌','❤️','🔥','✨','🎉','🙏','💪','😊','😏','🤣','😅','😇','😴','🤗','🤫','🫶','💯','🎶','🌟','🌙','☀️','🍕','🎂','🚀','💡','🏆','🎯','😘','🤝','🙃','😜','🤑','😤','😬','🥶','🥵','🧐','🤓'];

window.openChatWith = function(username) {
    socialDB.activeChatUser = username; var friend = getUser(username); if (!friend) return;
    var chatWindow = document.getElementById('chatWindow');
    document.getElementById('chatUserName').textContent = friend.name;
    var av = document.getElementById('chatAvatar'); av.innerHTML = renderAvatar(friend, 34);
    if (!friend.profilePic) av.style.background = 'rgba(255,255,255,0.3)';
    chatWindow.style.display = 'flex'; chatWindow.style.flexDirection = 'column';
    renderChatMessages();
    var grid = document.getElementById('emojiGrid');
    if (grid && grid.children.length === 0) grid.innerHTML = EMOJIS.map(function(e) { return '<button class="emoji-btn" onclick="insertEmoji(\'' + e + '\')">' + e + '</button>'; }).join('');
};

function renderChatMessages() {
    var container = document.getElementById('chatMessages'); if (!container || !socialDB.activeChatUser) return;
    var u = socialDB.currentUser; var conv = getConversation(u.username, socialDB.activeChatUser);
    container.innerHTML = conv.length === 0
        ? '<div style="text-align:center;color:var(--text-muted);font-size:13px;margin-top:20px;">Inicia la conversación 👋</div>'
        : conv.map(function(m) { var isMe = m.from === u.username; return '<div class="msg ' + (isMe?'msg-me':'msg-them') + '">' + m.text + '<div class="msg-time">' + timeAgo(m.createdAt) + '</div></div>'; }).join('');
    container.scrollTop = container.scrollHeight;
}

window.sendMessage = function() {
    var input = document.getElementById('chatInput');
    if (!input || !input.value.trim() || !socialDB.activeChatUser) return;
    sendMessageTo(socialDB.activeChatUser, input.value.trim()); input.value = '';
    renderChatMessages();
    if (socialDB.currentSection === 'mensajes') openMessagePanel(socialDB.activeChatUser);
};

window.closeChat        = function() { document.getElementById('chatWindow').style.display = 'none'; socialDB.activeChatUser = null; };
window.toggleEmojiPicker= function() { var p = document.getElementById('emojiPicker'); if (p) p.style.display = p.style.display==='none'?'block':'none'; };
window.insertEmoji      = function(e) { var i = document.getElementById('chatInput'); if (i) { i.value+=e; i.focus(); } };

// ============================================================
// 20. REELS — SISTEMA COMPLETO CON PREFERENCIAS + YOUTUBE
// ============================================================
var REEL_CATEGORIES = [
    { id:'cocina',      label:'🍳 Cocina',         query:'recetas cocina shorts' },
    { id:'influencers', label:'⭐ Influencers',     query:'influencer trending shorts' },
    { id:'carros',      label:'🚗 Carros',          query:'autos coches carros shorts' },
    { id:'deporte',     label:'⚽ Deporte',         query:'deporte highlights goles shorts' },
    { id:'musica',      label:'🎵 Música',          query:'musica shorts 2024',
      subs: [
        { id:'reggaeton', label:'🔥 Reggaeton',  query:'reggaeton shorts 2024' },
        { id:'pop',       label:'🎤 Pop',         query:'pop music shorts' },
        { id:'rock',      label:'🎸 Rock',        query:'rock music shorts' },
        { id:'clasica',   label:'🎻 Clásica',     query:'musica clasica shorts' },
        { id:'electronica',label:'🎧 Electrónica',query:'electronic dance music shorts' },
        { id:'jazz',      label:'🎷 Jazz',        query:'jazz music shorts' },
        { id:'hiphop',    label:'🎤 Hip-Hop',     query:'hip hop rap shorts' },
        { id:'salsa',     label:'💃 Salsa',       query:'salsa cumbia bachata shorts' },
        { id:'kpop',      label:'🇰🇷 K-Pop',     query:'kpop shorts 2024' },
      ]
    },
    { id:'tecnologia',  label:'💻 Tecnología',     query:'tecnologia gadgets tech shorts' },
    { id:'ciencia',     label:'🔬 Ciencia',        query:'ciencia experimentos curiosidades shorts' },
    { id:'fe',          label:'✝️ Fe Cristiana',   query:'fe cristiana reflexion cristiana shorts' },
    { id:'juegos',      label:'🎮 Videojuegos',    query:'videojuegos gaming shorts' },
    { id:'gamers',      label:'🕹️ Gamers',         query:'gamers gameplay funny shorts' },
    { id:'series',      label:'📺 Series',         query:'series trailer 2024 shorts' },
    { id:'fitness',     label:'💪 Fitness',        query:'fitness gym workout shorts' },
    { id:'viajes',      label:'✈️ Viajes',         query:'viajes travel vlog shorts' },
    { id:'arte',        label:'🎨 Arte',           query:'arte dibujo pintura shorts' },
    { id:'humor',       label:'😂 Humor',          query:'humor memes funny shorts' },
    { id:'naturaleza',  label:'🌿 Naturaleza',     query:'naturaleza animales wildlife shorts' },
    { id:'mascotas',    label:'🐶 Mascotas',       query:'mascotas perros gatos cute shorts' },
    { id:'moda',        label:'👗 Moda',           query:'moda fashion outfit shorts' },
];

// Pool de IDs de YouTube Shorts reales por categoría
var YOUTUBE_POOL = {
    cocina:['9bZkp7q19f0','LsoLEjrDogU','dQw4w9WgXcQ'],
    influencers:['JGwWNGJdvx8','kJQP7kiw5Fk','fJ9rUzIMcZQ'],
    carros:['YqeW9_5kURI','2Vv-BfVoq4g','pRpeEdMmmQ0'],
    deporte:['OPf0YbXqDm0','hT_nvWreIhg','CevxZvSJLk8'],
    musica:['RgKAFK5djSk','nfWlot6h_JM','60ItHLz5WEA'],
    tecnologia:['kffacxfA7G4','09839DpTctU','bxqLsrlakK8'],
    ciencia:['9bZkp7q19f0','2vjPBrBU-TM','ZbZSe6N_BXs'],
    fe:['r7ywq4WMpd4','uelHwf8o7_U','IcrbM1l_BoI'],
    juegos:['9HDEHj2yzew','xvFZjo5PgG0','j4VLqy8VbY4'],
    gamers:['xvFZjo5PgG0','j4VLqy8VbY4','5IcR92MKMo4'],
    series:['hT_nvWreIhg','NUsoVlDFqZg','OPf0YbXqDm0'],
    reggaeton:['nfWlot6h_JM','kJQP7kiw5Fk','fJ9rUzIMcZQ'],
    pop:['RgKAFK5djSk','60ItHLz5WEA','JGwWNGJdvx8'],
    rock:['CevxZvSJLk8','2Vv-BfVoq4g','YqeW9_5kURI'],
    clasica:['pRpeEdMmmQ0','r7ywq4WMpd4','ZbZSe6N_BXs'],
    electronica:['OPf0YbXqDm0','kffacxfA7G4','09839DpTctU'],
    jazz:['bxqLsrlakK8','09839DpTctU','5IcR92MKMo4'],
    hiphop:['kffacxfA7G4','CevxZvSJLk8','YqeW9_5kURI'],
    salsa:['9bZkp7q19f0','LsoLEjrDogU','OPf0YbXqDm0'],
    kpop:['fJ9rUzIMcZQ','JGwWNGJdvx8','kJQP7kiw5Fk'],
    fitness:['5IcR92MKMo4','j4VLqy8VbY4','2vjPBrBU-TM'],
    viajes:['NUsoVlDFqZg','bxqLsrlakK8','IcrbM1l_BoI'],
    arte:['uelHwf8o7_U','ZbZSe6N_BXs','r7ywq4WMpd4'],
    humor:['xvFZjo5PgG0','9HDEHj2yzew','dQw4w9WgXcQ'],
    naturaleza:['2vjPBrBU-TM','ZbZSe6N_BXs','pRpeEdMmmQ0'],
    mascotas:['IcrbM1l_BoI','uelHwf8o7_U','hT_nvWreIhg'],
    moda:['60ItHLz5WEA','nfWlot6h_JM','RgKAFK5djSk']
};

function getVideoIdsForPrefs(prefs) {
    var ids = [];
    prefs.forEach(function(pref) {
        var pool = YOUTUBE_POOL[pref] || YOUTUBE_POOL['musica'];
        pool.forEach(function(id) { if (ids.indexOf(id) === -1) ids.push(id); });
    });
    for (var i = ids.length-1; i > 0; i--) { var j = Math.floor(Math.random()*(i+1)); var tmp=ids[i]; ids[i]=ids[j]; ids[j]=tmp; }
    return ids;
}

function getQueryForPrefs(prefs) {
    var queries = [];
    prefs.forEach(function(pref) {
        REEL_CATEGORIES.forEach(function(cat) {
            if (cat.id === pref) queries.push(cat.query);
            if (cat.subs) cat.subs.forEach(function(s) { if (s.id === pref) queries.push(s.query); });
        });
    });
    return queries.length > 0 ? queries[Math.floor(Math.random()*queries.length)] : 'shorts trending';
}

function renderReels(area) {
    if (socialDB.reelPrefs.length === 0) {
        openReelPrefsModal();
        area.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:400px;gap:20px;text-align:center;padding:30px;"><div style="font-size:60px;">🎬</div><h3 style="margin:0;background:var(--gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Personaliza tus Reels</h3><p style="color:var(--text-muted);max-width:320px;">Selecciona tus preferencias para ver contenido que te interesa.</p><button class="btn-join" onclick="openReelPrefsModal()">Elegir preferencias</button></div>';
        return;
    }
    renderReelPlayer(area);
}

function renderReelPlayer(area) {
    area.innerHTML = '<div class="reels-player-container" id="reelsPlayer">' +
        '<div class="reels-header"><span style="font-weight:700;font-size:16px;">🎬 Reels para ti</span>' +
        '<button class="btn-outline" onclick="openReelPrefsModal()" style="padding:7px 14px;font-size:13px;"><i class="fa-solid fa-sliders"></i> Preferencias</button></div>' +
        '<div class="reels-scroll" id="reelsScroll"><div id="reelsContent">' +
        '<div class="reels-loading" id="reelsInitialLoading"><div class="reels-spinner"></div><p>Cargando contenido para ti...</p></div>' +
        '</div></div></div>';
    socialDB.reelPage = 0;
    loadMoreReels(true);
    var scroll = document.getElementById('reelsScroll');
    if (scroll) {
        scroll.addEventListener('scroll', function() {
            if (scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 300) loadMoreReels(false);
        });
    }
    setTimeout(function() { setupReelObserver(); }, 1200);
}

function loadMoreReels(initial) {
    if (socialDB.reelLoading) return; socialDB.reelLoading = true;
    var content = document.getElementById('reelsContent'); if (!content) { socialDB.reelLoading=false; return; }
    if (!initial) {
        var loader = document.createElement('div'); loader.id='reelsLoadMore'; loader.className='reels-loading'; loader.style.height='80px';
        loader.innerHTML = '<div class="reels-spinner"></div>'; content.appendChild(loader);
    }
    setTimeout(function() {
        var initLoader = document.getElementById('reelsInitialLoading'); if (initLoader) initLoader.remove();
        var moreLoader = document.getElementById('reelsLoadMore'); if (moreLoader) moreLoader.remove();
        var prefs   = getWeightedPrefs();
        var videoIds = getVideoIdsForPrefs(prefs);
        var query   = getQueryForPrefs(prefs);
        for (var i=0; i<5; i++) {
            var vid = videoIds[(socialDB.reelPage*5+i) % (videoIds.length||1)];
            var card = buildReelCard(vid, query, socialDB.reelPage*5+i);
            content.appendChild(card);
        }
        socialDB.reelPage++; socialDB.reelLoading = false;
        setTimeout(function() { setupReelObserver(); }, 400);
    }, 700);
}

function buildReelCard(videoId, query, index) {
    var div = document.createElement('div'); div.className = 'reel-card-full'; div.dataset.videoId = videoId;
    var prefs = socialDB.reelPrefs;
    var cat = null;
    REEL_CATEGORIES.forEach(function(c) { if (prefs.indexOf(c.id)!==-1 && !cat) cat = c; });
    cat = cat || REEL_CATEGORIES[0];
    var authors = ['@CreatorPro','@TrendingNow','@ViralShorts','@TopContent','@MustWatch','@Sociality','@ContentKing'];
    var author = authors[index % authors.length];
    var likes  = Math.floor(Math.random()*9000+500);
    var comms  = Math.floor(Math.random()*900+50);
    var tagStr = prefs.slice(0,3).map(function(p) { return '#'+p; }).join(' ');

    div.innerHTML =
        '<div class="reel-video-frame" id="reel-frame-' + videoId + '-' + index + '">' +
        '<div class="reel-thumb-placeholder" id="thumb-' + videoId + '-' + index + '">' +
        '<img src="https://img.youtube.com/vi/' + videoId + '/hqdefault.jpg" onerror="this.style.display=\'none\'" style="width:100%;height:100%;object-fit:cover;">' +
        '<div class="reel-play-overlay" onclick="loadReelVideo(\'' + videoId + '\',\'' + index + '\')">' +
        '<div class="reel-play-btn"><i class="fa-solid fa-play"></i></div>' +
        '</div></div></div>' +
        '<div class="reel-card-overlay">' +
        '<div class="reel-card-info">' +
        '<div class="reel-author-row">' +
        '<div style="width:36px;height:36px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;">▶</div>' +
        '<div><div style="font-weight:700;color:#fff;">' + author + '</div><div style="font-size:12px;color:rgba(255,255,255,0.7);">' + cat.label + '</div></div>' +
        '<button onclick="openYouTubeSearch(\'' + query + '\')" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.4);color:#fff;padding:5px 12px;border-radius:15px;cursor:pointer;font-size:12px;font-family:inherit;">Ver más</button>' +
        '</div>' +
        '<div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:6px;">' + tagStr + ' #shorts</div>' +
        '</div></div>' +
        '<div class="reel-side-actions">' +
        '<div class="reel-action-btn" onclick="this.querySelector(\'.rli\').classList.toggle(\'fa-regular\');this.querySelector(\'.rli\').classList.toggle(\'fa-solid\');this.querySelector(\'.rcnt\').textContent=parseInt(this.querySelector(\'.rcnt\').textContent)+(this.querySelector(\'.rli\').classList.contains(\'fa-solid\')?1:-1);">' +
        '<i class="fa-heart fa-regular rli" style="font-size:26px;color:#fff;"></i><span class="rcnt">' + likes + '</span></div>' +
        '<div class="reel-action-btn" onclick="showToast(\'💬 Comentarios próximamente\')">' +
        '<i class="fa-regular fa-comment" style="font-size:26px;color:#fff;"></i><span>' + comms + '</span></div>' +
        '<div class="reel-action-btn" onclick="openYouTubeSearch(\'' + query + '\')">' +
        '<i class="fa-brands fa-youtube" style="font-size:26px;color:#ff0000;"></i><span>YouTube</span></div>' +
        '<div class="reel-action-btn" onclick="shareReel(\'' + query + '\')">' +
        '<i class="fa-solid fa-share-nodes" style="font-size:24px;color:#fff;"></i><span>Compartir</span></div>' +
        '</div>';
    return div;
}

window.loadReelVideo = function(videoId, index) {
    var thumb = document.getElementById('thumb-' + videoId + '-' + index); if (!thumb) return;
    trackCategoryView(videoId);
    thumb.innerHTML = '<iframe src="https://www.youtube.com/embed/' + videoId + '?autoplay=1&mute=0&rel=0&modestbranding=1&playsinline=1" allow="autoplay;encrypted-media;fullscreen;picture-in-picture" allowfullscreen style="width:100%;height:100%;border:none;"></iframe>';
};

window.openYouTubeSearch = function(query) {
    window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(query) + '&sp=EgIQAQ%3D%3D', '_blank');
};

window.shareReel = function(query) {
    var url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query);
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(function() { showToast('🔗 Enlace copiado'); });
    else showToast('🔗 Compartido');
};

function setupReelObserver() {
    if (!window.IntersectionObserver) return;
    var cards = document.querySelectorAll('.reel-card-full:not([data-observed])');
    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) { if (entry.isIntersecting) trackCategoryView(entry.target.dataset.videoId); });
    }, { threshold: 0.6 });
    cards.forEach(function(card) { observer.observe(card); card.setAttribute('data-observed','1'); });
}

function trackCategoryView(videoId) {
    socialDB.reelPrefs.forEach(function(p) {
        if (YOUTUBE_POOL[p] && YOUTUBE_POOL[p].indexOf(videoId) !== -1) {
            if (!socialDB.reelHistory[p]) socialDB.reelHistory[p] = 0;
            socialDB.reelHistory[p]++;
        }
    });
    localStorage.setItem('social_reel_history', JSON.stringify(socialDB.reelHistory));
}

function getWeightedPrefs() {
    var prefs = socialDB.reelPrefs; if (!prefs.length) return ['musica'];
    var history = socialDB.reelHistory; var weighted = [];
    prefs.forEach(function(p) { var views = history[p] || 1; var count = Math.ceil(views/2); for (var i=0;i<count;i++) weighted.push(p); });
    for (var i=weighted.length-1;i>0;i--) { var j=Math.floor(Math.random()*(i+1)); var tmp=weighted[i]; weighted[i]=weighted[j]; weighted[j]=tmp; }
    var unique = []; weighted.forEach(function(x) { if (unique.indexOf(x)===-1) unique.push(x); });
    return unique.slice(0,3);
}

// Modal de preferencias
window.openReelPrefsModal = function() {
    var overlay = document.getElementById('reelPrefsOverlay'); if (!overlay) return;
    var selected = new Set(socialDB.reelPrefs);

    function buildHTML() {
        var html = '<div class="modal-box" style="max-width:540px;max-height:88vh;overflow-y:auto;">' +
            '<div style="text-align:center;margin-bottom:20px;"><div style="font-size:40px;margin-bottom:8px;">🎬</div>' +
            '<h2 style="margin:0 0 6px;">Tus preferencias</h2>' +
            '<p style="color:var(--text-muted);font-size:14px;margin:0;">Elige qué tipo de contenido quieres ver en tus Reels</p></div>' +
            '<div class="prefs-grid" id="prefsGrid">';
        REEL_CATEGORIES.forEach(function(cat) {
            var isSel = selected.has(cat.id);
            html += '<div class="pref-chip' + (isSel?' selected':'') + '" id="chip-' + cat.id + '" onclick="togglePref(\'' + cat.id + '\',this' + (cat.subs?',true':'') + ')">' + cat.label + (cat.subs ? ' <i class="fa-solid fa-chevron-down" style="font-size:10px;margin-left:4px;" id="chev-' + cat.id + '"></i>' : '') + '</div>';
            if (cat.subs) {
                html += '<div class="music-subs-container" id="subs-' + cat.id + '" style="display:none;">';
                cat.subs.forEach(function(s) {
                    html += '<div class="pref-chip sub-chip' + (selected.has(s.id)?' selected':'') + '" id="chip-' + s.id + '" onclick="togglePref(\'' + s.id + '\',this)">' + s.label + '</div>';
                });
                html += '</div>';
            }
        });
        html += '</div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:20px;padding-top:16px;border-top:1px solid var(--border);">' +
            '<span id="prefCount" style="font-size:14px;color:var(--text-muted);">' + selected.size + ' seleccionadas</span>' +
            '<div style="display:flex;gap:10px;"><button class="btn-outline" onclick="closeReelPrefsModal()" style="padding:10px 20px;">Cancelar</button>' +
            '<button class="btn-join" onclick="saveReelPrefs()" style="padding:10px 24px;">Guardar</button></div></div></div>';
        return html;
    }

    overlay.innerHTML = buildHTML();
    overlay._selected = selected;
    overlay.style.display = 'flex';
    setTimeout(function() { overlay.classList.add('active'); }, 10);
};

window.togglePref = function(prefId, el, hasChildren) {
    var overlay  = document.getElementById('reelPrefsOverlay');
    var selected = overlay._selected;
    if (selected.has(prefId)) { selected.delete(prefId); el.classList.remove('selected'); }
    else                      { selected.add(prefId);    el.classList.add('selected'); }
    var countEl = document.getElementById('prefCount'); if (countEl) countEl.textContent = selected.size + ' seleccionadas';
    if (hasChildren) {
        REEL_CATEGORIES.forEach(function(cat) {
            if (cat.id === prefId && cat.subs) {
                var subsEl = document.getElementById('subs-' + prefId);
                var chevEl = document.getElementById('chev-' + prefId);
                if (subsEl) { var showing = subsEl.style.display !== 'none'; subsEl.style.display = showing?'none':'flex'; if (chevEl) chevEl.style.transform = showing?'rotate(0)':'rotate(180deg)'; }
            }
        });
    }
};

window.saveReelPrefs = function() {
    var overlay  = document.getElementById('reelPrefsOverlay');
    var selected = overlay ? overlay._selected : null;
    if (!selected || selected.size === 0) return showToast('⚠️ Selecciona al menos una categoría');
    socialDB.reelPrefs = Array.from(selected); socialDB.reelPage = 0; saveDB();
    closeReelPrefsModal(); showToast('✅ Preferencias guardadas');
    setTimeout(function() { switchSection('reels'); }, 300);
};

window.closeReelPrefsModal = function() {
    var overlay = document.getElementById('reelPrefsOverlay'); if (!overlay) return;
    overlay.classList.remove('active');
    setTimeout(function() { overlay.style.display = 'none'; overlay.innerHTML = ''; }, 400);
};

// ============================================================
// 21. SIDEBAR DERECHO
// ============================================================
function renderRightSidebar() {
    var u = socialDB.currentUser; if (!u) return;
    var contactsEl = document.getElementById('contactsList');
    var suggestEl  = document.getElementById('suggestionsList');
    var friends    = (u.friends||[]).map(function(fn) { return getUser(fn); }).filter(Boolean);
    if (contactsEl) {
        contactsEl.innerHTML = friends.length === 0 ? '<div style="font-size:13px;color:var(--text-muted);padding:5px 10px;">Sin amigos aún</div>' :
            friends.map(function(f) { return '<div class="contact-item" onclick="openChatWith(\'' + f.username + '\')">' + '<div class="contact-avatar" style="position:relative;">' + renderAvatar(f, 38) + '<span class="status-dot online"></span></div><span class="contact-name">' + f.name + '</span></div>'; }).join('');
    }
    if (suggestEl) {
        var suggestions = socialDB.users.filter(function(usr) { return usr.username !== u.username && (u.friends||[]).indexOf(usr.username) === -1; }).slice(0,5);
        suggestEl.innerHTML = suggestions.length === 0 ? '<div style="font-size:13px;color:var(--text-muted);padding:5px 10px;">Sin sugerencias</div>' :
            suggestions.map(function(s) {
                var pending = socialDB.friendRequests.find(function(r) { return r.from===u.username && r.to===s.username && r.status==='pending'; });
                return '<div class="suggestion-item"><div class="suggestion-avatar">' + renderAvatar(s, 38) + '</div><div class="suggestion-info"><div class="suggestion-name">' + s.name + '</div><div class="suggestion-meta">@' + s.username + '</div></div>' +
                    (pending ? '<button class="btn-follow" disabled style="opacity:0.5;">Enviada</button>' : '<button class="btn-follow" onclick="sendFriendRequest(\'' + s.username + '\');this.textContent=\'Enviada\';this.disabled=true;this.style.opacity=\'0.5\';">Seguir</button>') + '</div>';
            }).join('');
    }
}

// ============================================================
// 22. FULLSCREEN
// ============================================================
window.openFullscreen = function(src) { var el=document.getElementById('imgFullscreen'); var img=document.getElementById('fullscreenImg'); if(el&&img){img.src=src;el.style.display='flex';} };
window.closeFullscreen = function() { var el=document.getElementById('imgFullscreen'); if(el) el.style.display='none'; };

// ============================================================
// 23. INICIALIZACIÓN
// ============================================================
window.onload = function() {
    applyTheme(socialDB.currentTheme);
    setTimeout(function() { document.querySelectorAll('.anim').forEach(function(el) { el.classList.add('show'); }); }, 100);
    document.addEventListener('mousemove', function(e) {
        var img = document.querySelector('.feature-img');
        if (img) img.style.transform = 'translateX(' + (window.innerWidth/2-e.pageX)/80 + 'px) translateY(' + (window.innerHeight/2-e.pageY)/80 + 'px)';
    });
    document.getElementById('openRegister').addEventListener('click', function() {
        toggleModal(true, '<h2>Crear cuenta</h2><input type="text" id="regName" placeholder="Tu nombre completo"><input type="text" id="regUser" placeholder="Nombre de usuario"><input type="password" id="regPass" placeholder="Contraseña" onkeydown="if(event.key===\'Enter\') handleRegister()"><button class="btn-join" onclick="handleRegister()" style="width:100%;margin-top:10px;">Unirse ahora</button>');
    });
    document.getElementById('openLogin').addEventListener('click', function() {
        toggleModal(true, '<h2>Iniciar sesión</h2><input type="text" id="logUser" placeholder="Nombre de usuario"><input type="password" id="logPass" placeholder="Contraseña" onkeydown="if(event.key===\'Enter\') handleLogin()"><button class="btn-join" onclick="handleLogin()" style="width:100%;margin-top:10px;">Entrar</button><p onclick="openRecovery()" style="cursor:pointer;color:var(--secondary);margin-top:10px;font-size:13px;">¿Olvidaste tu contraseña?</p>');
    });
    document.getElementById('closeModal').addEventListener('click', function() { toggleModal(false); });
    document.getElementById('heroStartBtn').addEventListener('click', function() { document.getElementById('openRegister').click(); });
    document.getElementById('modalOverlay').addEventListener('click', function(e) { if (e.target === this) toggleModal(false); });
};
