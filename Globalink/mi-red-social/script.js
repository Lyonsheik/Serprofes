/* ============================================================
   GLOBALINK — SCRIPT.JS v4.0 — MULTIUSUARIO CON BACKEND REAL
   ============================================================ */

// ── CONFIGURACIÓN BACKEND ─────────────────────────────────
var BACKEND_URL = 'https://globalink-backend-ur6a.onrender.com';

// ── 1. BASE DE DATOS (estado local + caché) ───────────────
var socialDB = {
    // Datos en memoria (caché del backend)
    users:         [],
    posts:         [],
    stories:       [],
    notifications: [],
    messages:      {},
    friendRequests:[],
    // Preferencias locales (siguen en localStorage)
    reelPrefs:     JSON.parse(localStorage.getItem('social_reel_prefs'))  || [],
    reelHistory:   JSON.parse(localStorage.getItem('social_reel_history'))|| {},
    reelComments:  JSON.parse(localStorage.getItem('social_reel_comments'))|| {},
    // Estado de sesión
    currentUser:   null,
    token:         localStorage.getItem('gl_token') || null,
    currentSection:'inicio',
    activeChatUser:null,
    activeMessageUser:null,
    tempMedia:     null,
    tempMediaType: null,
    storyTimer:    null,
    currentTheme:  localStorage.getItem('social_theme') || 'light',
    sharePostId:   null,
    reelPage:      0,
    reelLoading:   false,
    activeReelId:  null,
    socket:        null
};

// ── 2. API HELPER ─────────────────────────────────────────
function api(method, path, body) {
    var opts = {
        method: method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (socialDB.token) opts.headers['Authorization'] = 'Bearer ' + socialDB.token;
    if (body) opts.body = JSON.stringify(body);
    return fetch(BACKEND_URL + path, opts).then(function(r) { return r.json(); });
}

// Guardar preferencias locales
function saveLocalPrefs() {
    localStorage.setItem('social_reel_prefs',    JSON.stringify(socialDB.reelPrefs));
    localStorage.setItem('social_reel_history',  JSON.stringify(socialDB.reelHistory));
    localStorage.setItem('social_reel_comments', JSON.stringify(socialDB.reelComments));
}

// Compatibilidad — saveDB ahora solo guarda prefs locales
function saveDB() { saveLocalPrefs(); }

// ── 3. SOCKET.IO — CHAT EN TIEMPO REAL ───────────────────
function initSocket() {
    if (!socialDB.token || !window.io) return;
    if (socialDB.socket) socialDB.socket.disconnect();

    socialDB.socket = window.io(BACKEND_URL, {
        auth: { token: socialDB.token },
        transports: ['websocket', 'polling']
    });

    socialDB.socket.on('connect', function() {
        console.log('🟢 Socket conectado');
    });

    // Mensaje entrante en tiempo real
    socialDB.socket.on('new_message', function(msg) {
        // Guardar en caché
        addMsgToCache(msg.from, msg);

        // Si el panel de mensajes está abierto con ese usuario, añadir burbuja
        if (socialDB.activeMessageUser === msg.from) {
            appendMsgToPanel(msg);
        }
        // Si el chat flotante está abierto con ese usuario, re-renderizar
        if (socialDB.activeChatUser === msg.from) {
            renderChatMessages();
        }
        updateBadges();
        showToast('💬 Nuevo mensaje de ' + msg.from);
    });

    // Notificación en tiempo real
    socialDB.socket.on('notification', function(notif) {
        socialDB.notifications.unshift(notif);
        updateBadges();
    });

    // Publicación de un amigo
    socialDB.socket.on('friend_post', function(data) {
        var notif = {
            id: 'local_' + Date.now(),
            type: 'post',
            text: '<strong>' + data.authorName + '</strong> publicó algo nuevo: "' + data.preview + '"',
            read: false,
            createdAt: new Date().toISOString()
        };
        socialDB.notifications.unshift(notif);
        updateBadges();
        // Si estamos en inicio, recargar el feed
        if (socialDB.currentSection === 'inicio') renderPosts();
    });

    // Historia de un amigo
    socialDB.socket.on('friend_story', function(data) {
        var notif = {
            id: 'local_' + Date.now(),
            type: 'story',
            text: '<strong>' + data.authorName + '</strong> publicó una nueva historia',
            read: false,
            createdAt: new Date().toISOString()
        };
        socialDB.notifications.unshift(notif);
        updateBadges();
        // Si estamos en inicio, recargar historias
        if (socialDB.currentSection === 'inicio') renderStories();
    });

    // Solicitud de amistad en tiempo real
    socialDB.socket.on('friend_request', function(req) {
        socialDB.friendRequests.push(req);
        updateBadges();
    });

    // Amigo aceptó solicitud
    socialDB.socket.on('friend_accepted', function(data) {
        if (socialDB.currentUser && !socialDB.currentUser.friends.includes(data.username)) {
            socialDB.currentUser.friends.push(data.username);
        }
        updateBadges();
    });

    // Usuario en línea/offline
    socialDB.socket.on('user_online',  function(d) { updateOnlineStatus(d.username, true); });
    socialDB.socket.on('user_offline', function(d) { updateOnlineStatus(d.username, false); });

    // Typing indicator
    socialDB.socket.on('typing', function(d) {
        var el = document.getElementById('typingIndicator');
        if (el && socialDB.activeChatUser === d.from) el.style.display = 'block';
    });
    socialDB.socket.on('stop_typing', function(d) {
        var el = document.getElementById('typingIndicator');
        if (el) el.style.display = 'none';
    });

    socialDB.socket.on('disconnect', function() {
        console.log('🔴 Socket desconectado');
    });
}

function updateOnlineStatus(username, online) {
    var dots = document.querySelectorAll('[data-user="' + username + '"] .status-dot');
    dots.forEach(function(d) {
        d.className = 'status-dot ' + (online ? 'online' : 'offline');
    });
}

function showToast(msg) {
    var t = document.getElementById('toastEl');
    if (!t) { t = document.createElement('div'); t.id = 'toastEl'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(function() { t.classList.remove('show'); }, 2800);
}

function timeAgo(dateStr) {
    var diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60)    return 'Ahora mismo';
    if (diff < 3600)  return 'Hace ' + Math.floor(diff/60) + ' min';
    if (diff < 86400) return 'Hace ' + Math.floor(diff/3600) + ' h';
    return 'Hace ' + Math.floor(diff/86400) + ' d';
}

function getUser(username) { return socialDB.users.find(function(u) { return u.username === username; }); }

function renderAvatar(user, size) {
    size = size || 44;
    var u = (typeof user === 'string') ? getUser(user) : user;
    if (!u) return '';
    var name = u.name || u.username || '?';
    if (u.profilePic) return '<img src="' + u.profilePic + '" alt="' + name + '" style="width:' + size + 'px;height:' + size + 'px;object-fit:cover;border-radius:50%;">';
    return '<span style="font-size:' + Math.floor(size*0.38) + 'px;">' + name[0].toUpperCase() + '</span>';
}

// ── 3. TEMA ───────────────────────────────────────────────
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var icon = document.getElementById('themeIcon');
    if (icon) icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    localStorage.setItem('social_theme', theme);
    socialDB.currentTheme = theme;
}
window.toggleTheme = function() { applyTheme(socialDB.currentTheme === 'light' ? 'dark' : 'light'); };

// ── 4. MODALES LANDING ───────────────────────────────────
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
    closeMobileMenu();
    toggleModal(true, '<h2>✨ Características</h2><ul style="text-align:left;margin-top:20px;line-height:2.2;list-style:none;padding:0;"><li>🚀 Chat en tiempo real con emoticones</li><li>📸 Publicaciones con reacciones, comentarios y respuestas</li><li>🎭 Historias efímeras de 24h</li><li>👥 Sistema de amigos con solicitudes</li><li>🔔 Notificaciones en tiempo real</li><li>🎬 Reels personalizados con video propio + YouTube</li><li>↗️ Compartir posts con amigos</li><li>🌙 Modo oscuro / claro</li></ul>');
};
window.showHowItWorks = function() {
    closeMobileMenu();
    toggleModal(true, '<h2>¿Cómo funciona?</h2><p style="margin-top:20px;line-height:1.8;color:#666;">Regístrate, personaliza tu perfil y empieza a conectar. Busca amigos, envía solicitudes, sube historias y publica momentos. El chat te conecta en tiempo real con todos tus contactos.</p>');
};

// ── Menú hamburguesa móvil ────────────────────────────────
window.toggleMobileMenu = function() {
    var menu = document.getElementById('mobileMenu');
    var btn  = document.getElementById('hamburgerBtn');
    var icon = document.getElementById('hamburgerIcon');
    if (!menu || !btn) return;
    var isOpen = menu.classList.contains('open');
    if (isOpen) {
        menu.classList.remove('open');
        btn.classList.remove('open');
        if (icon) icon.className = 'fa-solid fa-bars';
    } else {
        menu.classList.add('open');
        btn.classList.add('open');
        if (icon) icon.className = 'fa-solid fa-xmark';
    }
};
window.closeMobileMenu = function() {
    var menu = document.getElementById('mobileMenu');
    var btn  = document.getElementById('hamburgerBtn');
    var icon = document.getElementById('hamburgerIcon');
    if (menu) menu.classList.remove('open');
    if (btn)  btn.classList.remove('open');
    if (icon) icon.className = 'fa-solid fa-bars';
};
window.showPrivacy = function() { showLegal('privacidad'); };
window.showPrivacyFullPage = function() { showLegal('privacidad'); };

// ══════════════════════════════════════════════════════════════
// MARCO LEGAL COMPLETO — RGPD · DSA · LSSI · Derecho Español
// ══════════════════════════════════════════════════════════════

// ── CONTENIDOS LEGALES ────────────────────────────────────────
var LEGAL_CONTENT = {

    aviso: function() { return '' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:8px;">' +
        '<h2 style="margin:0;">⚖️ Aviso Legal</h2>' +
        '<button onclick="closeLegal()" style="background:none;border:none;font-size:22px;color:var(--text-muted);cursor:pointer;">×</button></div>' +
        '<div style="margin-bottom:14px;"><span class="legal-badge">🇪🇺 Derecho Español y Europeo</span><span class="legal-badge">📅 Actualizado Mayo 2025</span></div>' +

        '<div class="legal-section">' +
        '<h3>🏢 Datos del Titular</h3>' +
        '<p><strong>Denominación:</strong> Globalink — Red Social</p>' +
        '<p><strong>Naturaleza:</strong> Plataforma digital de red social</p>' +
        '<p><strong>Ámbito de aplicación:</strong> Territorio de la Unión Europea, con sujeción a la legislación española</p>' +
        '<p><strong>Correo de contacto legal:</strong> legal@globalink.app</p>' +
        '<p><strong>Marco normativo:</strong> Ley 34/2002 de Servicios de la Sociedad de la Información (LSSI-CE), Reglamento (UE) 2016/679 (RGPD), Ley Orgánica 3/2018 de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD), y Reglamento (UE) 2022/2065 sobre Servicios Digitales (DSA).</p>' +
        '</div>' +

        '<div class="legal-section">' +
        '<h3>📋 Objeto y Condiciones de Acceso</h3>' +
        '<p>El presente Aviso Legal regula el uso del servicio Globalink. El acceso y uso de la plataforma atribuye la condición de Usuario e implica la aceptación plena y sin reservas de todas las disposiciones aquí incluidas.</p>' +
        '<p>Globalink se reserva el derecho a modificar unilateralmente las presentes condiciones, sin que ello afecte a los bienes o servicios adquiridos previamente. Los cambios serán comunicados con un mínimo de 30 días de antelación mediante notificación en la plataforma.</p>' +
        '</div>' +

        '<div class="legal-section">' +
        '<h3>🚫 Contenidos Prohibidos (Conformidad DSA)</h3>' +
        '<p>En cumplimiento del Reglamento (UE) 2022/2065 sobre Servicios Digitales (DSA), queda expresamente prohibida la publicación de:</p>' +
        '<ul>' +
        '<li><strong>Discurso de odio:</strong> contenido que incite a la discriminación, hostilidad o violencia por razón de raza, etnia, religión, género, orientación sexual, discapacidad o cualquier otra característica protegida.</li>' +
        '<li><strong>Violencia y terrorismo:</strong> material que glorifique, promueva o incite a actos terroristas, violencia extrema o crímenes de odio.</li>' +
        '<li><strong>Pornografía infantil (CSAM):</strong> cualquier contenido de explotación sexual de menores. Este tipo de contenido será reportado inmediatamente a las autoridades competentes (AEPD, Europol/INHOPE).</li>' +
        '<li><strong>Acoso y ciberacoso:</strong> mensajes, imágenes o cualquier contenido destinado a intimidar, hostigar, amenazar o dañar la reputación de personas reales.</li>' +
        '<li><strong>Desinformación dañina:</strong> información falsa que pueda causar daño real a terceros o a la salud pública.</li>' +
        '<li><strong>Fraude y estafas:</strong> contenido con fines de engaño económico, phishing, suplantación de identidad o cualquier otra actividad fraudulenta.</li>' +
        '<li><strong>Violación de derechos de autor:</strong> publicación de obras protegidas sin autorización del titular.</li>' +
        '<li><strong>Spam y publicidad no autorizada:</strong> mensajes masivos no solicitados o publicidad encubierta.</li>' +
        '</ul>' +
        '</div>' +

        '<div class="legal-section">' +
        '<h3>🔨 Causas de Suspensión y Baneo</h3>' +
        '<p>Globalink podrá suspender temporal o permanentemente el acceso de un Usuario, con o sin previo aviso según la gravedad, en los siguientes supuestos:</p>' +
        '<ul>' +
        '<li>Publicación de cualquiera de los contenidos prohibidos descritos anteriormente.</li>' +
        '<li>Reincidencia tras advertencia formal por incumplimiento de los Términos de Uso.</li>' +
        '<li>Suplantación de identidad de otra persona u organización.</li>' +
        '<li>Creación de múltiples cuentas con el fin de evadir una suspensión.</li>' +
        '<li>Uso automatizado de la plataforma (bots) sin autorización.</li>' +
        '<li>Cualquier actividad que ponga en riesgo la seguridad técnica de la plataforma o de otros usuarios.</li>' +
        '<li>Resolución judicial o requerimiento de autoridad competente.</li>' +
        '</ul>' +
        '<p>El Usuario podrá impugnar las decisiones de moderación mediante comunicación al correo legal@globalink.app. Globalink resolverá las impugnaciones en un plazo máximo de 15 días hábiles, conforme al artículo 20 del DSA.</p>' +
        '</div>' +

        '<div class="legal-section">' +
        '<h3>⚠️ Limitación de Responsabilidad</h3>' +
        '<p>Globalink actúa como <strong>prestador de servicios intermediario</strong> en el sentido de la Directiva 2000/31/CE y el Reglamento DSA. En consecuencia:</p>' +
        '<ul>' +
        '<li>Globalink <strong>no es responsable</strong> del contenido generado por los usuarios, siempre que no tenga conocimiento efectivo de su carácter ilícito o, teniéndolo, actúe con diligencia para retirarlo.</li>' +
        '<li>Globalink no garantiza la disponibilidad continua e ininterrumpida del servicio.</li>' +
        '<li>Globalink no responde de los daños derivados de virus informáticos o elementos tecnológicos dañinos que puedan afectar al equipo del usuario como consecuencia del uso del servicio.</li>' +
        '<li>Los enlaces a terceros (YouTube) se proporcionan a título informativo. Globalink no controla ni asume responsabilidad por el contenido de sitios externos.</li>' +
        '</ul>' +
        '</div>' +

        '<div class="legal-section">' +
        '<h3>🌍 Jurisdicción y Ley Aplicable</h3>' +
        '<p>Las presentes condiciones se rigen por la <strong>legislación española</strong> y el <strong>derecho de la Unión Europea</strong>. Para la resolución de conflictos derivados del uso de la plataforma, las partes se someten a los <strong>Juzgados y Tribunales de España</strong>, con renuncia a cualquier otro fuero que pudiera corresponderles, sin perjuicio de los derechos que asistan a los consumidores conforme a la normativa aplicable en su país de residencia dentro de la UE.</p>' +
        '<p>Resolución de litigios en línea (ODR): conforme al Reglamento (UE) 524/2013, se informa que la Comisión Europea pone a disposición la plataforma ODR: <strong>ec.europa.eu/consumers/odr</strong></p>' +
        '</div>';
    },

    privacidad: function() { return '' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:8px;">' +
        '<h2 style="margin:0;">🔒 Política de Privacidad</h2>' +
        '<button onclick="closeLegal()" style="background:none;border:none;font-size:22px;color:var(--text-muted);cursor:pointer;">×</button></div>' +
        '<div style="margin-bottom:14px;"><span class="legal-badge">🇪🇺 RGPD (UE) 2016/679</span><span class="legal-badge">🇪🇸 LOPDGDD 3/2018</span><span class="legal-badge">📅 Mayo 2025</span></div>' +

        '<div class="legal-toc"><span>Índice</span>' +
        '<span class="legal-nav-item" onclick="document.getElementById(\'lp1\').scrollIntoView({behavior:\'smooth\'})">1. Responsable del Tratamiento</span>' +
        '<span class="legal-nav-item" onclick="document.getElementById(\'lp2\').scrollIntoView({behavior:\'smooth\'})">2. Datos que recopilamos</span>' +
        '<span class="legal-nav-item" onclick="document.getElementById(\'lp3\').scrollIntoView({behavior:\'smooth\'})">3. Finalidad y base legal</span>' +
        '<span class="legal-nav-item" onclick="document.getElementById(\'lp4\').scrollIntoView({behavior:\'smooth\'})">4. Tus derechos (RGPD)</span>' +
        '<span class="legal-nav-item" onclick="document.getElementById(\'lp5\').scrollIntoView({behavior:\'smooth\'})">5. Cookies</span>' +
        '<span class="legal-nav-item" onclick="document.getElementById(\'lp6\').scrollIntoView({behavior:\'smooth\'})">6. Transferencias internacionales</span>' +
        '</div>' +

        '<div class="legal-section" id="lp1">' +
        '<h3>🏢 1. Responsable del Tratamiento</h3>' +
        '<p>El responsable del tratamiento de los datos personales recabados a través de Globalink es el titular de la plataforma, identificado en el Aviso Legal. Correo de contacto para asuntos de privacidad y ejercicio de derechos: <strong>privacidad@globalink.app</strong></p>' +
        '</div>' +

        '<div class="legal-section" id="lp2">' +
        '<h3>📊 2. Datos que Recopilamos</h3>' +
        '<p><strong>Datos facilitados en el registro:</strong> nombre, apellidos, nombre de usuario, correo electrónico, fecha de nacimiento, género.</p>' +
        '<p><strong>Contenido publicado voluntariamente:</strong> texto, imágenes y vídeos que el usuario decide subir a la plataforma.</p>' +
        '<p><strong>Datos de sesión técnica:</strong> identificador de sesión almacenado localmente en el dispositivo del usuario (localStorage). <strong>No se transmiten a servidores externos.</strong></p>' +
        '<p><strong>Lo que NO recopilamos:</strong> no usamos servicios de analítica de terceros, no instalamos cookies de rastreo publicitario, no vendemos datos a terceros.</p>' +
        '</div>' +

        '<div class="legal-section" id="lp3">' +
        '<h3>⚖️ 3. Finalidad y Base Legal del Tratamiento</h3>' +
        '<ul>' +
        '<li><strong>Gestión de la cuenta de usuario</strong> — Base legal: ejecución de contrato (art. 6.1.b RGPD).</li>' +
        '<li><strong>Verificación de la identidad del usuario</strong> — Base legal: ejecución de contrato (art. 6.1.b RGPD).</li>' +
        '<li><strong>Cumplimiento de obligaciones legales</strong> (DSA, LSSI) — Base legal: obligación legal (art. 6.1.c RGPD).</li>' +
        '<li><strong>Seguridad de la plataforma</strong> — Base legal: interés legítimo (art. 6.1.f RGPD).</li>' +
        '</ul>' +
        '<p><strong>Plazo de conservación:</strong> los datos se conservan mientras el usuario mantenga su cuenta activa. Una vez solicitada la eliminación, los datos son suprimidos del localStorage del dispositivo de forma inmediata e irreversible.</p>' +
        '</div>' +

        '<div class="legal-section" id="lp4">' +
        '<h3>✅ 4. Tus Derechos RGPD</h3>' +
        '<p>Conforme al Reglamento (UE) 2016/679, el usuario tiene los siguientes derechos sobre sus datos personales:</p>' +
        '<ul>' +
        '<li><strong>Acceso (art. 15 RGPD):</strong> solicitar confirmación de si tratamos sus datos y obtener una copia.</li>' +
        '<li><strong>Rectificación (art. 16 RGPD):</strong> corregir datos inexactos o incompletos.</li>' +
        '<li><strong>Supresión / Derecho al olvido (art. 17 RGPD):</strong> solicitar la eliminación de sus datos cuando ya no sean necesarios.</li>' +
        '<li><strong>Limitación del tratamiento (art. 18 RGPD):</strong> solicitar la restricción del tratamiento en determinadas circunstancias.</li>' +
        '<li><strong>Portabilidad (art. 20 RGPD):</strong> recibir sus datos en formato estructurado y de uso común.</li>' +
        '<li><strong>Oposición (art. 21 RGPD):</strong> oponerse al tratamiento basado en interés legítimo.</li>' +
        '</ul>' +
        '<p>Para ejercer cualquiera de estos derechos, contacta a: <strong>privacidad@globalink.app</strong></p>' +
        '<p>Tiene derecho a presentar una reclamación ante la <strong>Agencia Española de Protección de Datos (AEPD)</strong>: www.aepd.es</p>' +
        '</div>' +

        '<div class="legal-section" id="lp5">' +
        '<h3>🍪 5. Política de Cookies</h3>' +
        '<p>Globalink utiliza <strong>únicamente cookies técnicas esenciales</strong> para el funcionamiento de la plataforma:</p>' +
        '<ul>' +
        '<li><strong>Cookie de sesión (localStorage):</strong> almacena el identificador de sesión del usuario para mantener el inicio de sesión activo. Duración: sesión del navegador. No transmite datos a terceros.</li>' +
        '</ul>' +
        '<p><strong>No utilizamos</strong> cookies de análisis, cookies publicitarias, cookies de redes sociales externas ni ninguna cookie de rastreo de terceros.</p>' +
        '<p>Base legal: art. 22.2 LSSI-CE (exención para cookies técnicas estrictamente necesarias) y art. 6.1.b RGPD.</p>' +
        '</div>' +

        '<div class="legal-section" id="lp6">' +
        '<h3>🌍 6. Transferencias Internacionales</h3>' +
        '<p>Globalink <strong>no realiza transferencias internacionales de datos personales</strong>. Todos los datos se almacenan exclusivamente en el dispositivo del usuario (localStorage) y no son transmitidos a ningún servidor, ni dentro ni fuera del Espacio Económico Europeo.</p>' +
        '<p>Los vídeos incrustados de YouTube son servidos directamente por Google LLC desde sus infraestructuras. El uso de YouTube está sujeto a su propia política de privacidad (policies.google.com/privacy). Globalink no transmite datos de usuarios a YouTube.</p>' +
        '</div>';
    },

    terminos: function() { return '' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:8px;">' +
        '<h2 style="margin:0;">📄 Términos de Uso</h2>' +
        '<button onclick="closeLegal()" style="background:none;border:none;font-size:22px;color:var(--text-muted);cursor:pointer;">×</button></div>' +
        '<div style="margin-bottom:14px;"><span class="legal-badge">🇪🇺 DSA 2022/2065</span><span class="legal-badge">🇪🇸 LSSI-CE 34/2002</span><span class="legal-badge">📅 Mayo 2025</span></div>' +

        '<div class="legal-section">' +
        '<h3>📸 1. Propiedad Intelectual del Contenido del Usuario</h3>' +
        '<p>El usuario conserva íntegramente la <strong>titularidad de los derechos de propiedad intelectual</strong> sobre el contenido que publica (fotografías, vídeos, textos).</p>' +
        '<p>Al publicar contenido en Globalink, el usuario concede a la plataforma una <strong>licencia no exclusiva, gratuita, limitada al territorio de la UE y revocable</strong> para mostrar dicho contenido a los demás usuarios de la plataforma, exclusivamente con el fin de prestar el servicio.</p>' +
        '<p>Esta licencia <strong>no autoriza</strong> a Globalink a vender, sublicenciar, distribuir comercialmente ni modificar el contenido del usuario fuera del contexto estricto del servicio.</p>' +
        '<p>El usuario declara y garantiza que el contenido que publica es de su autoría o que dispone de todos los derechos necesarios para publicarlo.</p>' +
        '</div>' +

        '<div class="legal-section">' +
        '<h3>🚫 2. Contenido Prohibido</h3>' +
        '<p>Está terminantemente prohibida la publicación de:</p>' +
        '<ul>' +
        '<li>Contenido que incite al odio, la discriminación o la violencia por cualquier motivo (DSA art. 9, Decisión Marco 2008/913/JAI).</li>' +
        '<li>Pornografía infantil o cualquier contenido que explote sexualmente a menores (Directiva 2011/93/UE).</li>' +
        '<li>Contenido terrorista (Reglamento (UE) 2021/784).</li>' +
        '<li>Acoso, amenazas o ciberacoso dirigidos a personas reales.</li>' +
        '<li>Desinformación que pueda causar daño real a la salud pública o a terceros.</li>' +
        '<li>Violación de derechos de propiedad intelectual de terceros.</li>' +
        '<li>Spam, phishing o cualquier actividad fraudulenta.</li>' +
        '</ul>' +
        '</div>' +

        '<div class="legal-section">' +
        '<h3>⚠️ 3. Limitación de Responsabilidad del Prestador</h3>' +
        '<p>Globalink actúa como prestador de servicios de alojamiento de información en el sentido del art. 14 Directiva 2000/31/CE y art. 6 LSSI-CE. En consecuencia, Globalink:</p>' +
        '<ul>' +
        '<li>No es responsable del contenido publicado por los usuarios, siempre que no haya tenido conocimiento efectivo de su ilicitud o, teniéndolo, haya actuado diligentemente para retirarlo.</li>' +
        '<li>No garantiza la disponibilidad o continuidad del servicio y podrá interrumpirlo por razones técnicas o de mantenimiento.</li>' +
        '<li>No responde por los daños causados por el uso que los usuarios hagan de la plataforma o por el contenido que publiquen.</li>' +
        '</ul>' +
        '</div>' +

        '<div class="legal-section">' +
        '<h3>🔨 4. Moderación, Suspensión y Derecho de Recurso (DSA)</h3>' +
        '<p>En cumplimiento del art. 17 DSA, Globalink informará al usuario afectado sobre cualquier restricción impuesta a su cuenta o contenido, indicando los motivos, la duración y los medios de recurso disponibles.</p>' +
        '<p>El usuario podrá impugnar toda decisión de moderación escribiendo a <strong>legal@globalink.app</strong> en un plazo de 30 días desde la notificación. Globalink resolverá la impugnación en un plazo máximo de 15 días hábiles.</p>' +
        '<p>El usuario también podrá acudir a un organismo de resolución extrajudicial de litigios certificado por la autoridad competente conforme al art. 21 DSA.</p>' +
        '</div>' +

        '<div class="legal-section">' +
        '<h3>🔗 5. Contenido de Terceros (YouTube)</h3>' +
        '<p>La sección Reels muestra vídeos de YouTube a través del reproductor oficial embebido de YouTube, conforme a los Términos de Servicio de YouTube (youtube.com/t/terms). Globalink no aloja, descarga ni reproduce los vídeos de YouTube. El contenido de YouTube está sujeto a las políticas y derechos de sus respectivos autores y de YouTube/Google.</p>' +
        '</div>' +

        '<div class="legal-section">' +
        '<h3>📅 6. Vigencia y Modificaciones</h3>' +
        '<p>Los presentes Términos de Uso están en vigor desde mayo de 2025. Globalink podrá modificarlos notificando a los usuarios con al menos <strong>30 días de antelación</strong> mediante aviso en la plataforma. El uso continuado del servicio tras la entrada en vigor de las modificaciones implica la aceptación de los nuevos términos.</p>' +
        '<p><strong>Jurisdicción:</strong> legislación española y europea. Fuero: Juzgados y Tribunales de España.</p>' +
        '</div>';
    },

    cookies: function() { return '' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:8px;">' +
        '<h2 style="margin:0;">🍪 Política de Cookies</h2>' +
        '<button onclick="closeLegal()" style="background:none;border:none;font-size:22px;color:var(--text-muted);cursor:pointer;">×</button></div>' +
        '<div style="margin-bottom:14px;"><span class="legal-badge">🇪🇸 LSSI-CE art. 22</span><span class="legal-badge">🇪🇺 RGPD art. 6.1.b</span></div>' +

        '<div class="legal-section">' +
        '<h3>ℹ️ ¿Qué son las cookies?</h3>' +
        '<p>Las cookies son pequeños archivos de texto que se almacenan en el dispositivo del usuario cuando visita un sitio web. Se utilizan para recordar preferencias, mantener sesiones y analizar el uso del servicio.</p>' +
        '</div>' +

        '<div class="legal-section">' +
        '<h3>🔧 Cookies que usamos en Globalink</h3>' +
        '<div style="background:var(--bg-input);border-radius:12px;padding:14px;margin-bottom:12px;">' +
        '<p style="margin:0;"><strong>Nombre:</strong> social_session</p>' +
        '<p style="margin:4px 0;"><strong>Tipo:</strong> Técnica / Esencial</p>' +
        '<p style="margin:4px 0;"><strong>Finalidad:</strong> Mantener la sesión del usuario activa entre visitas</p>' +
        '<p style="margin:4px 0;"><strong>Duración:</strong> Hasta que el usuario cierra sesión o borra el almacenamiento local</p>' +
        '<p style="margin:4px 0;"><strong>Terceros:</strong> No. Almacenada exclusivamente en el dispositivo del usuario (localStorage)</p>' +
        '</div>' +
        '<p><strong>Nota técnica:</strong> Globalment utilizamos localStorage del navegador (no cookies HTTP tradicionales), que funciona de forma equivalente pero con mayor control por parte del usuario.</p>' +
        '</div>' +

        '<div class="legal-section">' +
        '<h3>🚫 Cookies que NO usamos</h3>' +
        '<ul>' +
        '<li>Cookies publicitarias o de retargeting</li>' +
        '<li>Cookies de análisis o estadística de terceros (Google Analytics, etc.)</li>' +
        '<li>Cookies de redes sociales externas</li>' +
        '<li>Cookies de seguimiento de comportamiento</li>' +
        '</ul>' +
        '</div>' +

        '<div class="legal-section">' +
        '<h3>⚙️ Cómo gestionar y eliminar las cookies</h3>' +
        '<p>Puedes eliminar los datos almacenados localmente en cualquier momento desde la configuración de tu navegador. También puedes cerrar sesión en Globalink, lo que eliminará automáticamente el identificador de sesión.</p>' +
        '<p>La desactivación del almacenamiento local impedirá el funcionamiento del servicio, ya que Globalink no puede funcionar sin el dato de sesión.</p>' +
        '</div>' +

        '<div class="legal-section">' +
        '<h3>⚖️ Base Legal</h3>' +
        '<p>El uso de la cookie técnica de sesión está amparado por el art. 22.2 de la LSSI-CE (exención de consentimiento para cookies técnicas estrictamente necesarias) y el art. 6.1.b del RGPD (ejecución de contrato). No se requiere consentimiento para este tipo de cookie.</p>' +
        '</div>';
    }
};

// ── ABRIR / CERRAR MODAL LEGAL ────────────────────────────────
window.showLegal = function(page) {
    var modal   = document.getElementById('legalModal');
    var box     = document.getElementById('legalModalBox');
    if (!modal || !box) return;
    var fn = LEGAL_CONTENT[page];
    if (!fn) return;
    box.innerHTML = fn();
    modal.style.display = 'flex';
    setTimeout(function() { modal.classList.add('active'); box.scrollTop = 0; }, 10);
};
window.closeLegal = function() {
    var modal = document.getElementById('legalModal'); if (!modal) return;
    modal.classList.remove('active');
    setTimeout(function() { modal.style.display = 'none'; }, 400);
};

// ── BANNER DE COOKIES ─────────────────────────────────────────
function initCookieBanner() {
    var consent = localStorage.getItem('gl_cookie_consent');
    if (!consent) {
        var banner = document.getElementById('cookieBanner');
        if (banner) banner.style.display = 'block';
    }
}
window.cookieChoice = function(choice) {
    localStorage.setItem('gl_cookie_consent', choice);
    localStorage.setItem('gl_cookie_date', new Date().toISOString());
    var banner = document.getElementById('cookieBanner');
    if (banner) {
        banner.style.animation = 'none';
        banner.style.transform = 'translateY(100%)';
        banner.style.transition = 'transform .4s ease';
        setTimeout(function() { banner.style.display = 'none'; }, 400);
    }
    showToast('✅ Preferencias de cookies guardadas');
};

// ── 5. REGISTRO Y LOGIN ──────────────────────────────────

// ════════════════════════════════════════════════════════
// CONFIGURACIÓN — LEE ESTO ANTES DE USAR
// ════════════════════════════════════════════════════════
// EMAILJS (envío real de correos):
//   1. Regístrate GRATIS en https://www.emailjs.com
//   2. Conecta tu Gmail/Outlook en "Email Services"
//   3. Crea plantilla en "Email Templates" con variables:
//      {{to_email}}, {{to_name}}, {{code}}, {{app_name}}
//   4. Copia tus claves aquí:
var EMAILJS_PUBLIC_KEY  = 'TU_PUBLIC_KEY_AQUI';
var EMAILJS_SERVICE_ID  = 'TU_SERVICE_ID_AQUI';
var EMAILJS_TEMPLATE_ID = 'TU_TEMPLATE_ID_AQUI';
//
// hCAPTCHA (verificación anti-bot):
//   CLAVE DE TEST (funciona en localhost Y en producción para pruebas):
//   '10000000-ffff-ffff-ffff-000000000001'
//
//   Para PRODUCCIÓN REAL con tu dominio de Netlify:
//   1. Ve a https://dashboard.hcaptcha.com
//   2. New Site → añade 'globalink-red-social.netlify.app'
//   3. Copia el Site Key aquí
var HCAPTCHA_SITE_KEY = '10000000-ffff-ffff-ffff-000000000001';
// ════════════════════════════════════════════════════════
var _captchaToken = null;

// Genera un código de 6 dígitos
function generateVerifyCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

// Callbacks globales de hCaptcha (deben estar en window)
window.onHCaptchaSuccess = function(token) {
    _captchaToken = token;
    var btn = document.getElementById('btnContinueAfterCaptcha');
    if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.innerHTML = '<i class="fa-solid fa-check" style="margin-right:8px;color:#4caf50;"></i>Verificado · Continuar';
    }
};
window.onHCaptchaExpired = function() {
    _captchaToken = null;
    var btn = document.getElementById('btnContinueAfterCaptcha');
    if (btn) { btn.disabled = true; btn.style.opacity = '.5'; btn.textContent = 'Captcha expirado — complétalo de nuevo'; }
};
window.onHCaptchaError = function() {
    _captchaToken = null;
    showToast('⚠️ Error en la verificación captcha. Inténtalo de nuevo.');
};

// ── PASO 1: Datos personales ──────────────────────────────
window.openRegisterModal = function() {
    _captchaToken = null;
    toggleModal(true,
        '<div style="text-align:left;">' +
        '<h2 style="text-align:center;margin-bottom:6px;">Crear cuenta</h2>' +
        '<p style="text-align:center;font-size:13px;color:var(--text-muted);margin-bottom:20px;">Paso 1 de 4 — Datos personales</p>' +

        '<div style="display:flex;gap:8px;">' +
        '<div style="flex:1;"><label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px;">NOMBRE *</label>' +
        '<input type="text" id="regNombre" placeholder="Tu nombre" style="margin:0;"></div>' +
        '<div style="flex:1;"><label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px;">APELLIDOS *</label>' +
        '<input type="text" id="regApellidos" placeholder="Tus apellidos" style="margin:0;"></div></div>' +

        '<label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin:12px 0 4px;">NOMBRE DE USUARIO *</label>' +
        '<input type="text" id="regUser" placeholder="@usuario" style="margin:0;">' +

        '<label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin:12px 0 4px;">CORREO ELECTRÓNICO *</label>' +
        '<input type="email" id="regEmail" placeholder="tu@correo.com" style="margin:0;">' +

        '<div style="display:flex;gap:8px;margin-top:12px;">' +
        '<div style="flex:1;"><label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px;">GÉNERO *</label>' +
        '<select id="regGenero" style="margin:0;"><option value="">Seleccionar...</option><option value="Masculino">Masculino</option><option value="Femenino">Femenino</option><option value="No binario">No binario</option><option value="Prefiero no decir">Prefiero no decir</option></select></div>' +
        '<div style="flex:1;"><label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:4px;">FECHA DE NACIMIENTO *</label>' +
        '<input type="date" id="regBirth" style="margin:0;" max="' + new Date(Date.now() - 13*365.25*24*3600*1000).toISOString().split('T')[0] + '"></div></div>' +

        '<label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin:12px 0 4px;">CONTRASEÑA *</label>' +
        '<input type="password" id="regPass" placeholder="Mínimo 6 caracteres" style="margin:0;">' +
        '<label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin:12px 0 4px;">CONFIRMAR CONTRASEÑA *</label>' +
        '<input type="password" id="regPass2" placeholder="Repite tu contraseña" style="margin:0;" onkeydown="if(event.key===\'Enter\') goRegisterCaptcha()">' +

        '<button class="btn-join" onclick="goRegisterCaptcha()" style="width:100%;margin-top:18px;">Continuar <i class="fa-solid fa-arrow-right" style="margin-left:6px;"></i></button>' +
        '<p style="text-align:center;margin-top:12px;font-size:13px;color:var(--text-muted);">¿Ya tienes cuenta? <span onclick="openLoginModal()" style="color:var(--primary);cursor:pointer;font-weight:600;">Inicia sesión</span></p>' +
        '</div>'
    );
};

// ── PASO 2: Captcha anti-bot ──────────────────────────────
window.goRegisterCaptcha = function() {
    var nombre    = (document.getElementById('regNombre')    || {}).value.trim();
    var apellidos = (document.getElementById('regApellidos') || {}).value.trim();
    var user      = (document.getElementById('regUser')      || {}).value.trim().replace(/\s+/g,'');
    var email     = (document.getElementById('regEmail')     || {}).value.trim().toLowerCase();
    var genero    = (document.getElementById('regGenero')    || {}).value;
    var birth     = (document.getElementById('regBirth')     || {}).value;
    var pass      = (document.getElementById('regPass')      || {}).value;
    var pass2     = (document.getElementById('regPass2')     || {}).value;

    if (!nombre || !apellidos || !user || !email || !genero || !birth || !pass)
        return showToast('⚠️ Completa todos los campos obligatorios');
    if (!/^[a-zA-Z0-9_\.]+$/.test(user))
        return showToast('⚠️ El usuario solo puede tener letras, números, _ y .');
    if (socialDB.users.find(function(u) { return u.username.toLowerCase() === user.toLowerCase(); }))
        return showToast('⚠️ Ese nombre de usuario ya existe');
    if (socialDB.users.find(function(u) { return u.email === email; }))
        return showToast('⚠️ Ese correo ya está registrado');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return showToast('⚠️ Introduce un correo electrónico válido');
    if (pass.length < 6)
        return showToast('⚠️ La contraseña debe tener al menos 6 caracteres');
    if (pass !== pass2)
        return showToast('⚠️ Las contraseñas no coinciden');

    _regTemp = { nombre:nombre, apellidos:apellidos, user:user, email:email, genero:genero, birth:birth, pass:pass };
    _captchaToken = null;

    toggleModal(true,
        '<div style="text-align:left;">' +
        '<h2 style="text-align:center;margin-bottom:6px;">Verificación de seguridad</h2>' +
        '<p style="text-align:center;font-size:13px;color:var(--text-muted);margin-bottom:20px;">Paso 2 de 4 — Confirma que eres humano</p>' +

        '<div style="background:var(--bg-input);border-radius:16px;padding:20px;margin-bottom:18px;text-align:center;">' +
        '<div style="font-size:44px;margin-bottom:10px;">🤖</div>' +
        '<p style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:6px;">Verificación anti-bot</p>' +
        '<p style="font-size:13px;color:var(--text-secondary);margin-bottom:18px;">Completa el captcha para confirmar que eres una persona real.</p>' +
        '<div id="hcaptchaMount" style="display:flex;justify-content:center;min-height:78px;margin-bottom:12px;">' +
        '<div class="h-captcha" ' +
        'data-sitekey="' + HCAPTCHA_SITE_KEY + '" ' +
        'data-callback="onHCaptchaSuccess" ' +
        'data-expired-callback="onHCaptchaExpired" ' +
        'data-error-callback="onHCaptchaError" ' +
        'data-theme="' + (socialDB.currentTheme==='dark'?'dark':'light') + '">' +
        '</div></div>' +
        '<p style="font-size:11px;color:var(--text-muted);">🔒 Protegido por hCaptcha · Compatible RGPD</p>' +
        '</div>' +

        '<button class="btn-join" id="btnContinueAfterCaptcha" onclick="goRegisterStep2()" style="width:100%;opacity:.5;" disabled>' +
        'Completa el captcha para continuar</button>' +
        '<button class="btn-outline" onclick="openRegisterModal()" style="width:100%;margin-top:10px;justify-content:center;">' +
        '<i class="fa-solid fa-arrow-left" style="margin-right:6px;"></i>Volver</button>' +
        '</div>'
    );

    // Renderizar hCaptcha después de que el DOM esté listo
    // Intentar varias veces por si el script aún no cargó
    var attempts = 0;
    function tryRenderCaptcha() {
        attempts++;
        var mountEl = document.getElementById('hcaptchaMount');
        if (!mountEl) return; // modal cerrado

        if (window.hcaptcha) {
            // Limpiar el contenido anterior y crear div fresco
            mountEl.innerHTML = '';
            var captchaDiv = document.createElement('div');
            mountEl.appendChild(captchaDiv);
            try {
                window.hcaptcha.render(captchaDiv, {
                    sitekey: HCAPTCHA_SITE_KEY,
                    callback: window.onHCaptchaSuccess,
                    'expired-callback': window.onHCaptchaExpired,
                    'error-callback': window.onHCaptchaError,
                    theme: socialDB.currentTheme === 'dark' ? 'dark' : 'light'
                });
                console.log('✅ hCaptcha renderizado correctamente');
            } catch(e) {
                console.warn('hCaptcha render error:', e);
                // Si falla el render, mostrar checkbox de respaldo
                showCaptchaFallback(mountEl);
            }
        } else if (attempts < 20) {
            // Reintentar cada 300ms hasta 6 segundos
            setTimeout(tryRenderCaptcha, 300);
        } else {
            // hCaptcha no cargó — mostrar checkbox de respaldo
            console.warn('hCaptcha no cargó, usando respaldo');
            showCaptchaFallback(mountEl);
        }
    }

    function showCaptchaFallback(mountEl) {
        // Checkbox simple como respaldo si hCaptcha no está disponible
        mountEl.innerHTML =
            '<div style="background:var(--bg-card);border:2px solid var(--border);border-radius:12px;padding:16px 20px;display:flex;align-items:center;gap:12px;cursor:pointer;" onclick="toggleFallbackCaptcha(this)">' +
            '<div id="fallbackCheckbox" style="width:24px;height:24px;border-radius:6px;border:2px solid var(--border);background:var(--bg-input);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:.2s;"></div>' +
            '<span style="font-size:14px;color:var(--text);">No soy un robot</span>' +
            '<img src="https://www.gstatic.com/recaptcha/api2/logo_48.png" style="width:32px;height:32px;margin-left:auto;opacity:.4;" onerror="this.style.display=\'none\'">' +
            '</div>';
        // Habilitar botón inmediatamente — el checkbox lo controlará
        window.toggleFallbackCaptcha = function(el) {
            var chk = document.getElementById('fallbackCheckbox');
            var isChecked = chk && chk.dataset.checked === '1';
            if (!isChecked) {
                if (chk) { chk.dataset.checked = '1'; chk.innerHTML = '<i class="fa-solid fa-check" style="color:var(--primary);font-size:14px;"></i>'; chk.style.borderColor = 'var(--primary)'; }
                _captchaToken = 'fallback_verified_' + Date.now();
                var btn = document.getElementById('btnContinueAfterCaptcha');
                if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.innerHTML = '<i class="fa-solid fa-check" style="margin-right:8px;color:#4caf50;"></i>Verificado · Continuar'; }
            }
        };
    }

    setTimeout(tryRenderCaptcha, 400);
};

// ── PASO 3: Términos + envío de código ───────────────────
window.goRegisterStep2 = function() {
    // Verificar captcha completado (token real de hCaptcha O token de respaldo)
    if (!_captchaToken) return showToast('⚠️ Completa la verificación captcha primero');

    // Mostrar términos y condiciones
    toggleModal(true,
        '<div style="text-align:left;">' +
        '<h2 style="text-align:center;margin-bottom:6px;">Términos y Privacidad</h2>' +
        '<p style="text-align:center;font-size:13px;color:var(--text-muted);margin-bottom:16px;">Paso 3 de 4 — Acepta para continuar</p>' +

        '<div style="background:var(--bg-input);border-radius:14px;padding:16px;max-height:200px;overflow-y:auto;font-size:13px;color:var(--text-secondary);line-height:1.7;margin-bottom:16px;">' +
        '<p style="font-weight:700;color:var(--text);margin-bottom:8px;">📋 Términos y Condiciones de Globalink</p>' +
        '<p><strong>1. Uso de la plataforma.</strong> Globalink es una red social de uso personal. Al registrarte, aceptas usarla de forma responsable, sin publicar contenido ofensivo, ilegal o que vulnere los derechos de terceros.</p>' +
        '<p style="margin-top:8px;"><strong>2. Edad mínima.</strong> Debes tener al menos 13 años para registrarte.</p>' +
        '<p style="margin-top:8px;"><strong>3. Cuenta personal.</strong> Tu cuenta es personal e intransferible.</p>' +
        '<p style="margin-top:8px;"><strong>4. Contenido y derechos de autor.</strong> Solo publica contenido del que seas titular o tengas los derechos necesarios.</p>' +
        '<p style="margin-top:8px;"><strong>5. DMCA.</strong> Globalink actúa como intermediario técnico. El contenido ilícito puede ser retirado previa notificación.</p>' +
        '<p style="margin-top:8px;"><strong>6. Suspensión.</strong> Nos reservamos el derecho de suspender cuentas que violen estos términos.</p>' +
        '<hr style="border:none;border-top:1px solid var(--border);margin:10px 0;">' +
        '<p style="font-weight:700;color:var(--text);margin-bottom:8px;">🔒 Política de Privacidad</p>' +
        '<p>Tus datos se almacenan localmente. No se venden ni comparten con terceros. Tienes derecho de acceso, rectificación y supresión conforme al RGPD.</p>' +
        '</div>' +

        '<label for="chkTerms" style="display:flex;align-items:flex-start;gap:12px;padding:14px;background:var(--bg-hover);border-radius:12px;margin-bottom:10px;cursor:pointer;border:2px solid transparent;transition:border-color .2s;" id="lblTerms">' +
        '<input type="checkbox" id="chkTerms" onchange="document.getElementById(\'lblTerms\').style.borderColor=this.checked?\'var(--primary)\':\' transparent\'">' +
        '<span style="font-size:13px;color:var(--text);line-height:1.5;">He leído y acepto los <span onclick="event.stopPropagation();showLegal(\'terminos\')" style="color:var(--primary);cursor:pointer;font-weight:600;text-decoration:underline;">Términos de Uso</span>, el <span onclick="event.stopPropagation();showLegal(\'aviso\')" style="color:var(--primary);cursor:pointer;font-weight:600;text-decoration:underline;">Aviso Legal</span> y la <span onclick="event.stopPropagation();showLegal(\'privacidad\')" style="color:var(--primary);cursor:pointer;font-weight:600;text-decoration:underline;">Política de Privacidad</span>.</span>' +
        '</label>' +

        '<label for="chkAge" style="display:flex;align-items:flex-start;gap:12px;padding:14px;background:var(--bg-hover);border-radius:12px;margin-bottom:10px;cursor:pointer;border:2px solid transparent;transition:border-color .2s;" id="lblAge">' +
        '<input type="checkbox" id="chkAge" onchange="document.getElementById(\'lblAge\').style.borderColor=this.checked?\'var(--primary)\':\' transparent\'">' +
        '<span style="font-size:13px;color:var(--text);">Confirmo que tengo al menos <strong>13 años</strong> (art. 8 RGPD / art. 7 LOPDGDD).</span>' +
        '</label>' +

        '<label for="chkDataConsent" style="display:flex;align-items:flex-start;gap:12px;padding:14px;background:var(--bg-hover);border-radius:12px;margin-bottom:18px;cursor:pointer;border:2px solid transparent;transition:border-color .2s;" id="lblDataConsent">' +
        '<input type="checkbox" id="chkDataConsent" onchange="document.getElementById(\'lblDataConsent\').style.borderColor=this.checked?\'var(--primary)\':\' transparent\'">' +
        '<span style="font-size:13px;color:var(--text);">Consiento el tratamiento de mis datos personales para gestión de cuenta (RGPD art. 7). Puedo retirar este consentimiento en cualquier momento.</span>' +
        '</label>' +

        '<button class="btn-join" onclick="goRegisterStep3()" style="width:100%;">Enviar código de verificación <i class="fa-solid fa-envelope" style="margin-left:6px;"></i></button>' +
        '<button class="btn-outline" onclick="goRegisterCaptcha()" style="width:100%;margin-top:10px;justify-content:center;"><i class="fa-solid fa-arrow-left" style="margin-right:6px;"></i>Volver</button>' +
        '</div>'
    );
};

// ── PASO 4: Verificación de email (backend real) ──────────────
window.goRegisterStep3 = function() {
    var chkTerms       = document.getElementById('chkTerms');
    var chkAge         = document.getElementById('chkAge');
    var chkDataConsent = document.getElementById('chkDataConsent');
    if (!chkTerms       || !chkTerms.checked)       return showToast('⚠️ Debes aceptar los Términos de Uso y Aviso Legal');
    if (!chkAge         || !chkAge.checked)         return showToast('⚠️ Debes confirmar que tienes 13 años o más');
    if (!chkDataConsent || !chkDataConsent.checked) return showToast('⚠️ Debes dar tu consentimiento al tratamiento de datos (RGPD)');
    _regTemp.consentDate = new Date().toISOString();

    var maskedEmail = _regTemp.email.replace(/(.{2})(.*)(@.*)/, function(m,a,b,c) {
        return a + b.replace(/./g,'*') + c;
    });

    // Mostrar pantalla de verificación
    function showVerifyScreen(state, errorMsg) {
        toggleModal(true,
            '<div style="text-align:left;">' +
            '<h2 style="text-align:center;margin-bottom:6px;">Verificar correo</h2>' +
            '<p style="text-align:center;font-size:13px;color:var(--text-muted);margin-bottom:20px;">Paso 4 de 4 — Código de verificación</p>' +

            '<div style="background:linear-gradient(135deg,rgba(198,57,184,.12),rgba(30,142,233,.1));border:1px solid rgba(198,57,184,.3);border-radius:16px;padding:20px;margin-bottom:18px;text-align:center;">' +
            (state === 'sending' ?
                '<div style="font-size:36px;margin-bottom:10px;">📤</div>' +
                '<p style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:8px;">Enviando código a tu correo...</p>' +
                '<p style="font-size:13px;color:var(--primary);font-weight:700;margin-bottom:12px;">' + maskedEmail + '</p>' +
                '<div style="display:flex;justify-content:center;align-items:center;gap:10px;"><div class="reels-spinner"></div><span style="font-size:13px;color:var(--text-muted);">Por favor espera...</span></div>'
            : state === 'sent' ?
                '<div style="font-size:36px;margin-bottom:10px;">📧</div>' +
                '<p style="font-size:14px;color:var(--text);margin-bottom:4px;">Código enviado a</p>' +
                '<p style="font-size:15px;font-weight:700;color:var(--primary);margin-bottom:12px;">' + maskedEmail + '</p>' +
                '<div style="background:var(--bg-card);border-radius:12px;padding:12px;display:inline-block;">' +
                '<p style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">Revisa tu bandeja de entrada y la carpeta de <strong>spam</strong></p>' +
                '<p style="font-size:11px;color:var(--text-muted);">⏱ Válido durante 10 minutos</p>' +
                '</div>'
            :   // error
                '<div style="font-size:36px;margin-bottom:10px;">⚠️</div>' +
                '<p style="font-size:14px;font-weight:600;color:#ff4d4d;margin-bottom:8px;">Error al enviar el código</p>' +
                '<p style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;">' + (errorMsg || 'No se pudo conectar con el servidor.') + '</p>' +
                '<p style="font-size:12px;color:var(--text-muted);">Revisa tu conexión e inténtalo de nuevo.</p>'
            ) +
            '</div>' +

            (state !== 'sending' ?
                '<label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:6px;">INTRODUCE EL CÓDIGO DE 6 DÍGITOS</label>' +
                '<input type="text" id="verifyCodeInput" maxlength="6" placeholder="______" inputmode="numeric" autocomplete="one-time-code" ' +
                'style="text-align:center;font-size:28px;font-weight:800;letter-spacing:10px;font-family:monospace;margin:0;" ' +
                'oninput="this.value=this.value.replace(/\\D/g,\'\').substring(0,6)" ' +
                'onpaste="setTimeout(function(){var el=document.getElementById(\'verifyCodeInput\');if(el)el.value=el.value.replace(/\\D/g,\'\').substring(0,6);},10)" ' +
                'onkeydown="if(event.key===\'Enter\') finalizeRegister()">' +
                '<button class="btn-join" onclick="this.disabled=true;this.style.opacity=\'0.7\';finalizeRegister();" style="width:100%;margin-top:18px;">' +
                '<i class="fa-solid fa-check-circle" style="margin-right:8px;"></i>Verificar y crear cuenta</button>' +
                '<div style="display:flex;justify-content:space-between;margin-top:12px;">' +
                '<button class="btn-outline" onclick="goRegisterStep2()" style="flex:1;margin-right:8px;justify-content:center;font-size:13px;padding:9px 14px;">' +
                '<i class="fa-solid fa-arrow-left" style="margin-right:5px;"></i>Volver</button>' +
                '<button class="btn-outline" onclick="resendVerifyCode()" style="flex:1;justify-content:center;font-size:13px;padding:9px 14px;" id="resendBtn">' +
                '<i class="fa-solid fa-rotate" style="margin-right:5px;"></i>Reenviar</button>' +
                '</div>'
            : '') +
            '</div>'
        );
    }

    // Mostrar spinner y llamar al backend
    showVerifyScreen('sending');

    fetch(BACKEND_URL + '/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: _regTemp.email, nombre: _regTemp.nombre })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (data.ok) {
            showVerifyScreen('sent');
            showToast('✅ Código enviado a ' + _regTemp.email);
        } else {
            showVerifyScreen('error', data.error);
            showToast('❌ ' + (data.error || 'Error al enviar el código'));
        }
    })
    .catch(function(err) {
        console.error('Error fetch /send-code:', err);
        showVerifyScreen('error', 'No se pudo conectar con el servidor. Revisa tu conexión.');
        showToast('❌ Error de conexión con el servidor');
    });
};

// Reenviar código — llama al backend de nuevo
window.resendVerifyCode = function() {
    var btn = document.getElementById('resendBtn');
    if (btn) { btn.disabled = true; btn.style.opacity = '.5'; }
    setTimeout(function() { if (btn) { btn.disabled = false; btn.style.opacity = '1'; } }, 30000);

    showToast('⏳ Enviando nuevo código...');
    fetch(BACKEND_URL + '/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: _regTemp.email, nombre: _regTemp.nombre })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (data.ok) {
            showToast('✅ Nuevo código enviado a tu correo');
        } else {
            showToast('❌ ' + (data.error || 'Error al reenviar'));
            if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
        }
    })
    .catch(function() {
        showToast('❌ Error de conexión al reenviar');
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    });
};

// ── FINALIZAR REGISTRO ──
var _finalizeRunning = false;

window.finalizeRegister = function() {
    if (_finalizeRunning) return;

    var codeInput = document.getElementById('verifyCodeInput');
    if (!codeInput || !codeInput.value) return showToast('⚠️ Introduce el código de verificación');

    var entered = codeInput.value.replace(/\D/g, '');
    if (!entered || entered.length < 6) return showToast('⚠️ El código debe tener 6 dígitos');

    // Verificar que _regTemp sigue vigente
    if (!_regTemp.email) {
        showToast('⚠️ Sesión expirada. Vuelve a empezar el registro.');
        openRegisterModal();
        return;
    }

    // Bloquear ejecución duplicada
    _finalizeRunning = true;

    // Feedback visual en el input mientras se verifica
    if (codeInput) { codeInput.disabled = true; codeInput.style.opacity = '.7'; }

    // Llamar al backend para verificar el código
    fetch(BACKEND_URL + '/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: _regTemp.email, code: entered })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (!data.ok) {
            // Código incorrecto o expirado
            _finalizeRunning = false;
            if (codeInput) {
                codeInput.disabled = false;
                codeInput.style.opacity = '1';
                codeInput.style.borderColor = '#ff4d4d';
                codeInput.style.background  = 'rgba(255,77,77,.08)';
                setTimeout(function() { codeInput.style.borderColor=''; codeInput.style.background=''; }, 1800);
            }
            showToast('❌ ' + (data.error || 'Código incorrecto'));
            return;
        }

        // ✅ Código correcto — crear la cuenta

        // Evitar duplicado si ya fue creado
        if (socialDB.users.find(function(u) { return u.username === _regTemp.user; })) {
            _regTemp = {}; _finalizeRunning = false;
            toggleModal(true,
                '<div style="text-align:center;padding:20px 0;">' +
                '<div style="font-size:64px;margin-bottom:16px;">✅</div>' +
                '<h2 style="margin-bottom:10px;">¡Ya estás registrado!</h2>' +
                '<p style="color:var(--text-secondary);font-size:15px;margin-bottom:24px;">Tu cuenta ya existe. Puedes iniciar sesión.</p>' +
                '<button class="btn-join" onclick="openLoginModal()" style="width:100%;font-size:16px;">Iniciar sesión <i class="fa-solid fa-arrow-right" style="margin-left:8px;"></i></button>' +
                '</div>'
            );
            return;
        }

        // ✅ Código correcto — crear la cuenta en el backend
        var fullName = _regTemp.nombre + ' ' + _regTemp.apellidos;
        api('POST', '/auth/register', {
            name:        fullName,
            firstName:   _regTemp.nombre,
            lastName:    _regTemp.apellidos,
            username:    _regTemp.user,
            email:       _regTemp.email,
            password:    _regTemp.pass,
            gender:      _regTemp.genero,
            birthDate:   _regTemp.birth,
            rgpdConsent: _regTemp.consentDate || new Date().toISOString()
        })
        .then(function(regData) {
            _regTemp = {};
            _finalizeRunning = false;
            if (!regData.ok) {
                if (codeInput) { codeInput.disabled = false; codeInput.style.opacity = '1'; }
                showToast('❌ ' + (regData.error || 'Error al crear la cuenta'));
                return;
            }
            // Guardar token y usuario
            socialDB.token = regData.token;
            socialDB.currentUser = regData.user;
            localStorage.setItem('gl_token', regData.token);
            localStorage.setItem('gl_username', regData.user.username);

            toggleModal(true,
                '<div style="text-align:center;padding:20px 0;">' +
                '<div style="font-size:64px;margin-bottom:16px;">🎉</div>' +
                '<h2 style="margin-bottom:10px;">¡Cuenta creada!</h2>' +
                '<p style="color:var(--text-secondary);font-size:15px;margin-bottom:24px;">Tu correo ha sido verificado. Ya puedes iniciar sesión.</p>' +
                '<button class="btn-join" onclick="openLoginModal()" style="width:100%;font-size:16px;">Iniciar sesión <i class="fa-solid fa-arrow-right" style="margin-left:8px;"></i></button>' +
                '</div>'
            );
        })
        .catch(function() {
            _regTemp = {};
            _finalizeRunning = false;
            if (codeInput) { codeInput.disabled = false; codeInput.style.opacity = '1'; }
            showToast('❌ Error de conexión al crear la cuenta');
        });
    })
    .catch(function(err) {
        _finalizeRunning = false;
        if (codeInput) { codeInput.disabled = false; codeInput.style.opacity = '1'; }
        console.error('Error /verify-code:', err);
        showToast('❌ Error de conexión. Inténtalo de nuevo.');
    });
};

// ── LOGIN ──
window.openLoginModal = function() {
    toggleModal(true,
        '<h2>Iniciar sesión</h2>' +
        '<input type="text" id="logUser" placeholder="Usuario o correo electrónico">' +
        '<input type="password" id="logPass" placeholder="Contraseña" onkeydown="if(event.key===\'Enter\') handleLogin()">' +
        '<button class="btn-join" onclick="handleLogin()" style="width:100%;margin-top:10px;">Entrar</button>' +
        '<p onclick="openRecovery()" style="cursor:pointer;color:var(--secondary);margin-top:12px;font-size:13px;text-align:center;">¿Olvidaste tu contraseña?</p>' +
        '<p style="text-align:center;margin-top:10px;font-size:13px;color:var(--text-muted);">¿No tienes cuenta? <span onclick="openRegisterModal()" style="color:var(--primary);cursor:pointer;font-weight:600;">Regístrate</span></p>'
    );
};

window.handleRegister = function() {
    // Redirige al nuevo flujo multi-paso
    openRegisterModal();
};

window.handleLogin = function() {
    var userIn = (document.getElementById('logUser') || {}).value.trim();
    var passIn = (document.getElementById('logPass') || {}).value;
    if (!userIn || !passIn) return showToast('⚠️ Completa usuario y contraseña');

    var btn = document.querySelector('#modalFormContainer .btn-join');
    if (btn) { btn.disabled = true; btn.textContent = 'Entrando...'; }

    api('POST', '/auth/login', { login: userIn, password: passIn })
    .then(function(data) {
        if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
        if (data.ok) {
            socialDB.token = data.token;
            socialDB.currentUser = data.user;
            localStorage.setItem('gl_token', data.token);
            localStorage.setItem('gl_username', data.user.username);
            toggleModal(false);
            launchApp();
        } else {
            showToast('❌ ' + (data.error || 'Credenciales incorrectas'));
        }
    })
    .catch(function() {
        if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
        showToast('❌ Error de conexión');
    });
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

// ── 6. LANZAR APP ────────────────────────────────────────
function launchApp() {
    document.getElementById('landingPage').style.display = 'none';
    document.getElementById('socialApp').style.display   = 'flex';
    // Iniciar Socket.IO
    initSocket();
    updateSidebarProfile();
    updateBadges();
    switchSection('inicio');
    // Cargar notificaciones y solicitudes en segundo plano
    loadNotifications();
    loadFriendRequests();
}

function updateSidebarProfile() {
    var u = socialDB.currentUser; if (!u) return;
    var av = document.getElementById('sidebarAvatar');
    av.innerHTML = renderAvatar(u, 38);
    if (!u.profilePic) av.style.cssText = 'background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;';
    document.getElementById('sidebarName').textContent     = u.name;
    document.getElementById('sidebarUsername').textContent = '@' + u.username;
}

window.logoutUser = function() {
    if (socialDB.socket) socialDB.socket.disconnect();
    socialDB.currentUser = null;
    socialDB.token = null;
    socialDB.currentSection = 'inicio';
    socialDB.reelPage = 0;
    socialDB.posts = [];
    socialDB.notifications = [];
    socialDB.friendRequests = [];
    socialDB.messages = {};
    socialDB.stories = [];
    localStorage.removeItem('gl_token');
    localStorage.removeItem('gl_username');
    document.getElementById('socialApp').style.display = 'none';
    document.getElementById('landingPage').style.display = 'block';
    initLanding();
    showToast('👋 Sesión cerrada');
};

function initLanding() {
    setTimeout(function() {
        document.querySelectorAll('.anim').forEach(function(el) { el.classList.add('show'); });
    }, 100);
    document.addEventListener('mousemove', function(e) {
        var img = document.querySelector('.feature-img');
        if (img) img.style.transform = 'translateX(' + (window.innerWidth/2-e.pageX)/80 + 'px) translateY(' + (window.innerHeight/2-e.pageY)/80 + 'px)';
    });
    var openReg = document.getElementById('openRegister');
    var openLog = document.getElementById('openLogin');
    var closeM  = document.getElementById('closeModal');
    var heroBtn = document.getElementById('heroStartBtn');
    if (openReg) openReg.onclick = function() { openRegisterModal(); };
    if (openLog) openLog.onclick = function() { openLoginModal(); };
    if (closeM)  closeM.onclick  = function() { toggleModal(false); };
    if (heroBtn) heroBtn.onclick  = function() { closeMobileMenu(); openRegisterModal(); };
    var overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.onclick = function(e) { if (e.target === this) toggleModal(false); };
    var legalModal = document.getElementById('legalModal');
    if (legalModal) legalModal.onclick = function(e) { if (e.target === this) closeLegal(); };
    document.onclick = function(e) {
        var menu = document.getElementById('mobileMenu');
        var btn  = document.getElementById('hamburgerBtn');
        if (menu && menu.classList.contains('open') && btn) {
            if (!menu.contains(e.target) && !btn.contains(e.target)) closeMobileMenu();
        }
    };
    initCookieBanner();
}

function sendMessageTo(toUsername, text) {
    var u = socialDB.currentUser;
    var msg = { id: 'msg_' + Date.now(), from: u.username, to: toUsername, text: text, read: false, createdAt: new Date().toISOString() };
    addMsgToCache(toUsername, msg);
    if (socialDB.socket && socialDB.socket.connected) {
        socialDB.socket.emit('send_message', { to: toUsername, text: text });
    } else {
        api('POST', '/messages/send', { to: toUsername, text: text }).catch(function(){});
    }
}

// ── 7. NAVEGACIÓN ────────────────────────────────────────
var SECTION_TITLES = { inicio:'Inicio', buscar:'Buscar personas', amigos:'Amigos', notificaciones:'Notificaciones', mensajes:'Mensajes', reels:'Reels' };

window.switchSection = function(section) {
    socialDB.currentSection = section;

    // Sidebar izq
    document.querySelectorAll('.sidebar-item').forEach(function(el) { el.classList.remove('active'); });
    var nav = document.getElementById('nav-' + section); if (nav) nav.classList.add('active');

    // Mobile nav
    document.querySelectorAll('.nav-tab').forEach(function(el) { el.classList.remove('active'); });
    var mnav = document.getElementById('mnav-' + section); if (mnav) mnav.classList.add('active');

    var titleEl = document.getElementById('sectionTitle'); if (titleEl) titleEl.textContent = SECTION_TITLES[section] || section;
    var area = document.getElementById('contentArea'); if (!area) return; area.innerHTML = '';

    if (section === 'inicio')              renderInicio(area);
    else if (section === 'buscar')         renderBuscar(area);
    else if (section === 'amigos')         renderAmigos(area);
    else if (section === 'notificaciones') renderNotificaciones(area);
    else if (section === 'mensajes')       renderMensajes(area);
    else if (section === 'reels')          renderReels(area);

    if (section === 'notificaciones') {
        socialDB.notifications.forEach(function(n) { if (n.to === socialDB.currentUser.username) n.read = true; });
        saveDB(); updateBadges();
    }
    if (section === 'mensajes') { if (socialDB.activeMessageUser) markMessagesRead(socialDB.activeMessageUser); updateBadges(); }
    renderRightSidebar();
};

// ── 8. BADGES ────────────────────────────────────────────
function updateBadges() {
    var u = socialDB.currentUser; if (!u) return;
    var unreadNotifs = socialDB.notifications.filter(function(n) { return !n.read; }).length;
    var pendingReqs  = socialDB.friendRequests.filter(function(r) { return r.to === u.username && r.status === 'pending'; }).length;
    // Mensajes no leídos — contar de todos los usuarios
    var unreadMsgs = 0;
    Object.values(socialDB.messages).forEach(function(msgs) {
        if (Array.isArray(msgs)) msgs.forEach(function(m) { if (m.to === u.username && !m.read) unreadMsgs++; });
    });
    updateBadge('badge-notificaciones',  unreadNotifs);
    updateBadge('badge-amigos',          pendingReqs);
    updateBadge('badge-mensajes',        unreadMsgs);
    updateBadge('mbadge-notificaciones', unreadNotifs);
    updateBadge('mbadge-amigos',         pendingReqs);
    updateBadge('mbadge-mensajes',       unreadMsgs);
}

function updateBadge(id, count) {
    var el = document.getElementById(id); if (!el) return;
    if (count > 0) { el.style.display = 'flex'; el.textContent = count > 99 ? '99+' : count; }
    else el.style.display = 'none';
}

// ── 9. INICIO ────────────────────────────────────────────
function renderInicio(area) {
    var u = socialDB.currentUser;
    var myPosts = socialDB.posts.filter(function(p) { return p.authorUsername === u.username; });
    var friends = u.friends || [];

    area.innerHTML =
        '<div class="profile-info-card" id="profileCard">' +
        '<div style="position:relative;margin-bottom:55px;">' +
        // Cover — onclick abre opciones de portada
        '<div class="profile-cover" id="profileCoverEl" style="' + (u.coverPic ? 'background-image:url(' + u.coverPic + ');background-size:cover;background-position:center;' : '') + 'cursor:pointer;" onclick="showCoverOptions()">' +
        '<div style="position:absolute;bottom:10px;right:10px;display:flex;gap:8px;" onclick="event.stopPropagation()">' +
        '<button onclick="showCoverOptions()" style="background:rgba(0,0,0,.55);color:#fff;padding:6px 12px;border-radius:15px;font-size:12px;display:flex;align-items:center;gap:5px;border:none;cursor:pointer;font-family:inherit;touch-action:manipulation;"><i class="fa-solid fa-camera"></i> Portada</button>' +
        '</div></div>' +
        // Profile pic — onclick expande o muestra opciones
        '<div class="profile-pic-wrap">' +
        '<div class="profile-pic" onclick="showProfilePicOptions()" style="cursor:pointer;">' + (u.profilePic ? '<img src="' + u.profilePic + '">' : u.name[0].toUpperCase()) + '</div>' +
        '<div class="edit-pic-btn" onclick="showProfilePicOptions()" style="cursor:pointer;"><i class="fa-solid fa-camera"></i></div>' +
        '</div></div>' +
        '<div style="padding-top:4px;">' +
        '<div class="profile-name">' + u.name + '</div>' +
        '<div class="profile-username">@' + u.username + '</div>' +
        '<div class="profile-bio-text">' + (u.bio || '<span style="color:var(--text-muted)">Sin bio aún.</span>') + '</div>' +
        '<div class="profile-stats">' +
        '<div class="stat-item" onclick="viewMyPosts()" style="cursor:pointer;" title="Ver publicaciones"><div class="stat-count" id="statPosts">' + myPosts.length + '</div><div class="stat-label">Publicaciones</div></div>' +
        '<div class="stat-item" onclick="viewFollowersList()" style="cursor:pointer;" title="Ver seguidores"><div class="stat-count">' + (u.followers||[]).length + '</div><div class="stat-label">Seguidores</div></div>' +
        '<div class="stat-item" onclick="viewFollowingList()" style="cursor:pointer;" title="Ver seguidos"><div class="stat-count">' + (u.following||[]).length + '</div><div class="stat-label">Seguidos</div></div>' +
        '<div class="stat-item" onclick="viewFriendsList()" style="cursor:pointer;" title="Ver amigos"><div class="stat-count">' + friends.length + '</div><div class="stat-label">Amigos</div></div>' +
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
        buildCreatePostHTML(u) +
        '<div id="feedPosts"></div>';

    renderStories(); renderPosts();
}

function buildCreatePostHTML(u) {
    return '<div class="create-post-card">' +
        '<div class="create-post-top"><div class="user-avatar">' + renderAvatar(u, 44) + '</div>' +
        '<textarea id="newPostTxt" placeholder="¿Qué quieres compartir hoy, ' + u.name.split(' ')[0] + '?"></textarea></div>' +
        '<div id="previewBox" class="media-preview-container"><img id="imgPrev" src="" alt="preview" style="display:none;"><video id="videoPrev" controls style="display:none;max-height:300px;width:100%;"></video><button onclick="removeMedia()" class="remove-media-btn">×</button></div>' +
        '<div class="create-post-bottom"><div class="post-media-actions">' +
        '<label class="btn-media" style="touch-action:manipulation;"><i class="fa-solid fa-image" style="color:#4caf50;"></i> Foto<input type="file" id="mediaInput" hidden accept="image/*" onchange="handleMedia(this,\'image\')"></label>' +
        '<label class="btn-media" style="touch-action:manipulation;"><i class="fa-solid fa-video" style="color:#e91e63;"></i> Video<input type="file" id="videoInput" hidden accept="video/*" onchange="handleMedia(this,\'video\')"></label>' +
        '<button class="btn-media" onclick="openCameraCapture(\'photo\')" style="touch-action:manipulation;"><i class="fa-solid fa-camera" style="color:#1e8ee9;"></i> Cámara</button>' +
        '<button class="btn-media" onclick="openLiveStream()" style="touch-action:manipulation;"><i class="fa-solid fa-circle-dot" style="color:#ff4d4d;"></i> En Directo</button>' +
        '<label class="btn-media" style="touch-action:manipulation;"><i class="fa-solid fa-face-smile" style="color:#f9c313;"></i> Sentimiento<input type="text" id="feelingInput" placeholder="¿Cómo te sientes?" style="width:110px;border:none;background:none;font-size:13px;outline:none;color:var(--text);font-family:inherit;"></label>' +
        '</div><button class="btn-join" onclick="publishPost()">Publicar</button></div></div>';
}

window.showProfilePicOptions = function() {
    var u = socialDB.currentUser;
    var overlay = document.getElementById('shareModalOverlay'); if (!overlay) return;

    overlay.innerHTML =
        '<div style="background:var(--bg-card);border-radius:24px;width:92%;max-width:380px;overflow:hidden;animation:none;">' +
        // Header con foto expandida
        (u.profilePic
            ? '<div style="position:relative;background:#000;cursor:pointer;" onclick="openFullscreen(\''+u.profilePic+'\')">' +
              '<img src="'+u.profilePic+'" style="width:100%;max-height:320px;object-fit:cover;display:block;opacity:.95;">' +
              '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.15);transition:.2s;" onmouseenter="this.style.background=\'rgba(0,0,0,.3)\'" onmouseleave="this.style.background=\'rgba(0,0,0,.15)\'">' +
              '<div style="background:rgba(0,0,0,.5);border-radius:50%;width:48px;height:48px;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-expand" style="color:#fff;font-size:18px;"></i></div></div></div>'
            : '<div style="height:140px;background:var(--gradient);display:flex;align-items:center;justify-content:center;"><div style="font-size:60px;font-weight:800;color:#fff;">'+u.name[0].toUpperCase()+'</div></div>') +
        // Options
        '<div style="padding:16px;">' +
        '<p style="font-size:13px;color:var(--text-muted);text-align:center;margin-bottom:14px;font-weight:600;">'+u.name+'</p>' +
        '<div style="display:flex;flex-direction:column;gap:8px;">' +
        (u.profilePic
            ? '<button onclick="closeShareModal();openFullscreen(\''+u.profilePic+'\')" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:14px;border:none;background:var(--bg-hover);color:var(--text);font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;touch-action:manipulation;"><div style="width:36px;height:36px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;"><i class="fa-solid fa-expand"></i></div> Ver foto de perfil</button>'
            : '') +
        '<label style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:14px;border:none;background:var(--bg-hover);color:var(--text);font-size:14px;font-weight:600;cursor:pointer;touch-action:manipulation;">' +
        '<div style="width:36px;height:36px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;"><i class="fa-solid fa-camera"></i></div>' +
        (u.profilePic ? 'Cambiar foto de perfil' : 'Subir foto de perfil') +
        '<input type="file" hidden accept="image/*" onchange="closeShareModal();changeProfilePic(this)"></label>' +
        (u.profilePic
            ? '<button onclick="closeShareModal();deleteProfilePic()" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:14px;border:none;background:rgba(255,77,77,.08);color:#ff4d4d;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;touch-action:manipulation;"><div style="width:36px;height:36px;border-radius:50%;background:rgba(255,77,77,.15);display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-trash" style="color:#ff4d4d;"></i></div> Eliminar foto</button>'
            : '') +
        '</div>' +
        '<p class="close-text" onclick="closeShareModal()" style="text-align:center;margin-top:12px;">Cancelar</p>' +
        '</div></div>';

    overlay.style.display = 'flex';
    setTimeout(function() { overlay.classList.add('active'); }, 10);
};

// Fix 6: Cover photo options menu
window.showCoverOptions = function() {
    var u = socialDB.currentUser;
    var overlay = document.getElementById('shareModalOverlay'); if (!overlay) return;

    overlay.innerHTML =
        '<div style="background:var(--bg-card);border-radius:24px;width:92%;max-width:380px;overflow:hidden;">' +
        // Cover preview
        '<div style="height:160px;background:' + (u.coverPic ? 'url('+u.coverPic+') center/cover' : 'var(--gradient)') + ';position:relative;cursor:pointer;" onclick="' + (u.coverPic ? "closeShareModal();openFullscreen('"+u.coverPic+"')" : '') + '">' +
        (u.coverPic
            ? '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.2);" onmouseenter="this.style.background=\'rgba(0,0,0,.35)\'" onmouseleave="this.style.background=\'rgba(0,0,0,.2)\'"><div style="background:rgba(0,0,0,.45);border-radius:50%;width:42px;height:42px;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-expand" style="color:#fff;font-size:16px;"></i></div></div>'
            : '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-image" style="color:rgba(255,255,255,.5);font-size:36px;"></i></div>') +
        '</div>' +
        '<div style="padding:16px;">' +
        '<p style="font-size:13px;color:var(--text-muted);text-align:center;margin-bottom:14px;font-weight:600;">Foto de portada</p>' +
        '<div style="display:flex;flex-direction:column;gap:8px;">' +
        (u.coverPic
            ? '<button onclick="closeShareModal();openFullscreen(\''+u.coverPic+'\')" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:14px;border:none;background:var(--bg-hover);color:var(--text);font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;touch-action:manipulation;"><div style="width:36px;height:36px;border-radius:50%;background:var(--gradient-soft);display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-eye" style="color:var(--primary);"></i></div> Ver foto de portada</button>'
            : '') +
        '<label style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:14px;border:none;background:var(--bg-hover);color:var(--text);font-size:14px;font-weight:600;cursor:pointer;touch-action:manipulation;">' +
        '<div style="width:36px;height:36px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;"><i class="fa-solid fa-upload"></i></div>' +
        'Subir foto de portada' +
        '<input type="file" hidden accept="image/*" onchange="closeShareModal();changeCoverPic(this)"></label>' +
        (u.coverPic
            ? '<button onclick="closeShareModal();showCoverPhotoGallery()" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:14px;border:none;background:var(--bg-hover);color:var(--text);font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;touch-action:manipulation;"><div style="width:36px;height:36px;border-radius:50%;background:var(--gradient-soft);display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-images" style="color:var(--primary);"></i></div> Elegir foto de portada</button>'
            : '<button onclick="closeShareModal();showCoverPhotoGallery()" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:14px;border:none;background:var(--bg-hover);color:var(--text);font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;touch-action:manipulation;"><div style="width:36px;height:36px;border-radius:50%;background:var(--gradient-soft);display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-images" style="color:var(--primary);"></i></div> Elegir foto de portada</button>') +
        (u.coverPic
            ? '<button onclick="closeShareModal();deleteCoverPic()" style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:14px;border:none;background:rgba(255,77,77,.08);color:#ff4d4d;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;touch-action:manipulation;"><div style="width:36px;height:36px;border-radius:50%;background:rgba(255,77,77,.15);display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-trash" style="color:#ff4d4d;"></i></div> Eliminar portada</button>'
            : '') +
        '</div>' +
        '<p class="close-text" onclick="closeShareModal()" style="text-align:center;margin-top:12px;">Cancelar</p>' +
        '</div></div>';

    overlay.style.display = 'flex';
    setTimeout(function() { overlay.classList.add('active'); }, 10);
};

// Galería de fotos del usuario para elegir portada
window.showCoverPhotoGallery = function() {
    var u = socialDB.currentUser;
    var myPosts = socialDB.posts.filter(function(p) { return p.authorUsername === u.username && p.media && p.mediaType === 'image'; });
    var overlay = document.getElementById('shareModalOverlay'); if (!overlay) return;

    var gridHTML = myPosts.length === 0
        ? '<div style="text-align:center;color:var(--text-muted);padding:30px;font-size:14px;"><i class="fa-solid fa-images" style="font-size:36px;display:block;margin-bottom:10px;opacity:.3;"></i>No tienes fotos publicadas aún.</div>'
        : '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;">' +
          myPosts.map(function(p) {
              return '<img src="'+p.media+'" onclick="setCoverFromGallery(\''+p.media+'\')" style="width:100%;aspect-ratio:1;object-fit:cover;cursor:pointer;transition:opacity .2s;" onmouseenter="this.style.opacity=\'.7\'" onmouseleave="this.style.opacity=\'1\'">';
          }).join('') + '</div>';

    overlay.innerHTML =
        '<div style="background:var(--bg-card);border-radius:24px;width:92%;max-width:420px;max-height:85vh;overflow-y:auto;">' +
        '<div style="padding:16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;">' +
        '<button onclick="showCoverOptions()" style="background:none;border:none;font-size:18px;color:var(--text-muted);cursor:pointer;padding:4px;"><i class="fa-solid fa-arrow-left"></i></button>' +
        '<h3 style="margin:0;font-size:16px;font-weight:700;">Elegir foto de portada</h3></div>' +
        '<div style="padding:12px;">' + gridHTML + '</div>' +
        '<p class="close-text" onclick="closeShareModal()" style="text-align:center;padding-bottom:16px;">Cancelar</p>' +
        '</div>';
    overlay.style.display = 'flex';
    setTimeout(function() { overlay.classList.add('active'); }, 10);
};

window.setCoverFromGallery = function(imgData) {
    closeShareModal();
    var u = socialDB.currentUser;
    u.coverPic = imgData;
    api('PUT', '/users/profile', { name: u.name, bio: u.bio, profilePic: u.profilePic, coverPic: imgData })
    .then(function(data) {
        if (data.ok) showToast('✅ Portada actualizada');
    });
    var coverEl = document.getElementById('profileCoverEl');
    if (coverEl) { coverEl.style.backgroundImage='url('+imgData+')'; coverEl.style.backgroundSize='cover'; coverEl.style.backgroundPosition='center'; }
};
window.deleteProfilePic = function() {
    var u = socialDB.currentUser;
    u.profilePic = '';
    api('PUT', '/users/profile', { name: u.name, bio: u.bio, profilePic: '', coverPic: u.coverPic })
    .then(function() {
        var profilePicEl = document.querySelector('.profile-pic');
        if (profilePicEl) profilePicEl.innerHTML = u.name[0].toUpperCase();
        updateSidebarProfile();
        renderStories();
        showToast('✅ Foto de perfil eliminada');
    });
};

window.deleteCoverPic = function() {
    var u = socialDB.currentUser;
    u.coverPic = '';
    api('PUT', '/users/profile', { name: u.name, bio: u.bio, profilePic: u.profilePic, coverPic: '' })
    .then(function() {
        var coverEl = document.getElementById('profileCoverEl');
        if (coverEl) { coverEl.style.backgroundImage = ''; coverEl.style.background = ''; }
        showToast('✅ Portada eliminada');
        renderInicio(document.getElementById('contentArea'));
    });
};

window.toggleEditProfile = function() {
    var f = document.getElementById('editProfileForm'); if (f) f.style.display = f.style.display === 'none' ? 'block' : 'none';
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
        var imgData = e.target.result;
        socialDB.currentUser.profilePic = imgData;
        api('PUT', '/users/profile', { name: socialDB.currentUser.name, bio: socialDB.currentUser.bio, profilePic: imgData, coverPic: socialDB.currentUser.coverPic });
        var profilePicEl = document.querySelector('.profile-pic');
        if (profilePicEl) profilePicEl.innerHTML = '<img src="' + imgData + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
        updateSidebarProfile();
        var createAvatar = document.querySelector('.create-post-top .user-avatar');
        if (createAvatar) createAvatar.innerHTML = '<img src="' + imgData + '" style="width:44px;height:44px;object-fit:cover;border-radius:50%;">';
        renderStories();
        showToast('✅ Foto de perfil actualizada');
    };
    reader.readAsDataURL(input.files[0]);
};
window.changeCoverPic = function(input) {
    // Si se llama con un input (desde label), úsarlo directamente
    if (input && input.files && input.files[0]) {
        var reader = new FileReader();
        reader.onload = function(e) {
            var imgData = e.target.result;
            socialDB.currentUser.coverPic = imgData;
            api('PUT', '/users/profile', { name: socialDB.currentUser.name, bio: socialDB.currentUser.bio, profilePic: socialDB.currentUser.profilePic, coverPic: imgData })
            .then(function(data) {
                if (data.ok) showToast('✅ Portada actualizada');
            });
            var coverEl = document.getElementById('profileCoverEl');
            if (coverEl) {
                coverEl.style.backgroundImage   = 'url(' + imgData + ')';
                coverEl.style.backgroundSize    = 'cover';
                coverEl.style.backgroundPosition = 'center';
            }
            // Re-renderizar los botones de portada para mostrar "Eliminar"
            var btnContainer = coverEl ? coverEl.querySelector('div[style*="bottom:10px"]') : null;
            if (btnContainer && !btnContainer.querySelector('[onclick*="deleteCoverPic"]')) {
                btnContainer.innerHTML +=
                    '<button onclick="deleteCoverPic()" style="background:rgba(255,77,77,.75);color:#fff;border:none;padding:6px 12px;border-radius:15px;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:5px;font-family:inherit;"><i class="fa-solid fa-trash"></i> Eliminar</button>';
            }
        };
        reader.readAsDataURL(input.files[0]);
        return;
    }

    // Fallback iOS-safe: crear input dinámico
    var old = document.getElementById('_coverFileInput');
    if (old) old.remove();
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.id = '_coverFileInput';
    fileInput.style.cssText = 'position:fixed;top:-200px;left:-200px;opacity:0;pointer-events:none;';
    document.body.appendChild(fileInput);
    fileInput.onchange = function() { changeCoverPic(fileInput); setTimeout(function(){ fileInput.remove(); }, 1000); };
    setTimeout(function() { fileInput.click(); }, 50);
};

// ── 10. HISTORIAS ────────────────────────────────────────
function cleanOldStories() {
    // MongoDB TTL lo hace automáticamente — no necesario en frontend
}

function renderStories() {
    var row = document.getElementById('storiesRow'); if (!row) return;
    var u = socialDB.currentUser;

    // Cargar historias del backend
    api('GET', '/stories').then(function(data) {
        if (data.ok) socialDB.stories = data.stories || [];

        var myStories = socialDB.stories.filter(function(s) { return s.authorUsername === u.username; });
        var myStory   = myStories[0] || null;
        // Thumbnail: última historia si existe, sino foto de perfil
        var myThumbHTML = '';
        if (myStory) {
            myThumbHTML = myStory.type === 'video'
                ? '<video src="' + myStory.content + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"></video>'
                : '<img src="' + myStory.content + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
        } else if (u.profilePic) {
            myThumbHTML = '<img src="' + u.profilePic + '" alt="' + u.name + '">';
        } else {
            myThumbHTML = '<span style="font-size:20px;color:var(--primary);">' + u.name[0].toUpperCase() + '</span>';
        }
        // Burbuja del usuario actual
        var myActions = myStory
            ? 'onclick="showStoryOptions(\'' + (myStory._id || myStory.id) + '\')"'
            : 'onclick="addStory()"';

        var myCount = myStories.length;
        var html = '<div class="story-item" ' + myActions + '>' +
            '<div class="story-ring ' + (myStory ? '' : 'add-story') + '" style="position:relative;">' +
            '<div class="story-ring-inner" style="display:flex;align-items:center;justify-content:center;background:var(--bg-input);">' +
            myThumbHTML +
            '</div>' +
            (myStory
                ? '<div style="position:absolute;bottom:0;right:0;width:22px;height:22px;background:var(--gradient);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;border:2px solid var(--bg-card);">' + (myCount > 1 ? myCount : '<i class="fa-solid fa-pen"></i>') + '</div>'
                : '<div class="story-add-icon"><i class="fa-solid fa-plus"></i></div>'
            ) +
            '</div>' +
            '<span class="story-name">' + (myStory ? 'Tu historia' : 'Añadir') + '</span></div>';

        // Historias de amigos — una burbuja por usuario (muestra count si >1)
        var seen = {};
        socialDB.stories.filter(function(s) { return s.authorUsername !== u.username; }).forEach(function(story) {
            if (seen[story.authorUsername]) return; seen[story.authorUsername] = true;
            var author = socialDB.users.find(function(x) { return x.username === story.authorUsername; });
            if (!author) author = { name: story.authorName || story.authorUsername, profilePic: '', username: story.authorUsername };
            var firstId = story._id || story.id;
            var userCount = socialDB.stories.filter(function(s) { return s.authorUsername === story.authorUsername; }).length;
            html += '<div class="story-item" onclick="viewStory(\'' + firstId + '\')">' +
                '<div class="story-ring" style="position:relative;"><div class="story-ring-inner">' +
                (author.profilePic ? '<img src="' + author.profilePic + '">' : '<span style="font-size:20px;font-weight:700;color:var(--primary);">' + (author.name||'?')[0].toUpperCase() + '</span>') +
                '</div>' +
                (userCount > 1 ? '<div style="position:absolute;bottom:0;right:0;width:20px;height:20px;background:var(--gradient);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700;border:2px solid var(--bg-card);">' + userCount + '</div>' : '') +
                '</div><span class="story-name">' + (author.name||'').split(' ')[0] + '</span></div>';
        });
        row.innerHTML = html;
    }).catch(function() {
        // Si falla, mostrar solo la burbuja del usuario
        var html = '<div class="story-item" onclick="addStory()">' +
            '<div class="story-ring add-story"><div class="story-ring-inner" style="display:flex;align-items:center;justify-content:center;">' +
            (u.profilePic ? '<img src="' + u.profilePic + '">' : '<span style="font-size:20px;color:var(--primary);">' + u.name[0].toUpperCase() + '</span>') +
            '</div><div class="story-add-icon"><i class="fa-solid fa-plus"></i></div></div>' +
            '<span class="story-name">Añadir</span></div>';
        row.innerHTML = html;
    });
}

// Opciones de historia propia: ver, cambiar o eliminar
window.showStoryOptions = function(storyId) {
    var u = socialDB.currentUser;
    var myStories = socialDB.stories.filter(function(s) { return s.authorUsername === u.username; });
    var firstStoryId = myStories.length > 0 ? (myStories[0]._id || myStories[0].id) : storyId;

    // Construir grid de mis historias
    var storiesGrid = myStories.length > 0
        ? '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:16px;max-height:200px;overflow-y:auto;">' +
          myStories.map(function(s, i) {
              var sid = s._id || s.id;
              return '<div style="position:relative;cursor:pointer;" onclick="toggleModal(false);viewStory(\'' + sid + '\')">' +
                  (s.type === 'video'
                      ? '<video src="' + s.content + '" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;"></video><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.2);border-radius:8px;"><i class="fa-solid fa-play" style="color:#fff;font-size:16px;"></i></div>'
                      : '<img src="' + s.content + '" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;">'
                  ) +
                  '<div style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.5);border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;" onclick="event.stopPropagation();deleteStory(\'' + sid + '\')">' +
                  '<i class="fa-solid fa-times" style="color:#fff;font-size:10px;"></i></div></div>';
          }).join('') +
          '</div>'
        : '';

    toggleModal(true,
        '<div style="text-align:left;">' +
        '<h2 style="text-align:center;margin-bottom:16px;">Mis historias <span style="font-size:14px;color:var(--text-muted);font-weight:500;">(' + myStories.length + '/20)</span></h2>' +
        storiesGrid +
        '<button class="btn-join" onclick="toggleModal(false);viewStory(\'' + firstStoryId + '\')" style="width:100%;margin-bottom:10px;"><i class="fa-solid fa-eye" style="margin-right:8px;"></i>Ver historias</button>' +
        '<button class="btn-outline" onclick="toggleModal(false);addStory()" style="width:100%;margin-bottom:10px;justify-content:center;"><i class="fa-solid fa-plus" style="margin-right:8px;"></i>Añadir historia' + (myStories.length >= 20 ? ' (límite alcanzado)' : '') + '</button>' +
        '<p class="close-text" onclick="toggleModal(false)">Cancelar</p>' +
        '</div>'
    );
};

window.deleteStory = function(storyId) {
    toggleModal(false);
    api('DELETE', '/stories/' + storyId).then(function() {
        socialDB.stories = socialDB.stories.filter(function(s) { return (s._id||s.id) !== storyId; });
        showToast('🗑️ Historia eliminada');
        renderStories();
    }).catch(function() { showToast('❌ Error al eliminar'); });
};

// ══════════════════════════════════════════════════════════════
//  GLOBALINK STORY STUDIO — Editor de Historias v2.0
//  Selección múltiple + Editor completo + Diseño único
// ══════════════════════════════════════════════════════════════

// Estado global del editor
var _storyStudio = {
    files: [],          // { id, data, type, name } archivos cargados
    current: 0,         // índice activo en el carrusel
    edits: [],          // { text, textColor, fontSize, textX, textY, filter, overlayColor, overlayOpacity, stickerEmoji, stickerX, stickerY, drawPaths }
    draggingText: false,
    draggingSticker: false,
    drawMode: false,
    drawColor: '#ff4d4d',
    drawSize: 4,
    drawing: false,
    drawCtx: null
};

// Filtros únicos de Globalink
var STORY_FILTERS = [
    { id:'none',      label:'Original',  css:'' },
    { id:'vivid',     label:'Vivid',     css:'saturate(1.8) contrast(1.1)' },
    { id:'chrome',    label:'Chrome',    css:'contrast(1.2) brightness(1.1) saturate(0.8)' },
    { id:'fade',      label:'Fade',      css:'brightness(1.15) saturate(0.7) contrast(0.9)' },
    { id:'noir',      label:'Noir',      css:'grayscale(1) contrast(1.2)' },
    { id:'golden',    label:'Golden',    css:'sepia(0.5) saturate(1.4) brightness(1.1)' },
    { id:'cool',      label:'Cool',      css:'hue-rotate(30deg) saturate(1.2)' },
    { id:'warm',      label:'Warm',      css:'sepia(0.3) saturate(1.5) hue-rotate(-15deg)' },
    { id:'glitch',    label:'Glitch',    css:'contrast(1.3) saturate(2) hue-rotate(90deg)' },
    { id:'dream',     label:'Dream',     css:'brightness(1.2) blur(0.5px) saturate(1.4)' }
];

// Stickers del editor de historias (diferentes a los del chat)
var STORY_STICKERS = ['✨','🔥','💫','🌟','💕','😍','🥰','😎','🎉','🎊','🌈','🦋',
    '🌸','🍀','⭐','💯','🙌','👑','🫶','💜','🖤','🤍','❤️','🧡','💛','💚','💙'];

window.addStory = function() {
    var myCount = socialDB.stories.filter(function(s) { return s.authorUsername === socialDB.currentUser.username; }).length;
    if (myCount >= 20) return showToast('⚠️ Límite de 20 historias alcanzado');

    var old = document.getElementById('_storyFileInput');
    if (old) old.remove();

    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.multiple = true;   // ← Selección múltiple
    input.id = '_storyFileInput';
    input.style.cssText = 'position:fixed;top:-200px;left:-200px;opacity:0;pointer-events:none;';
    document.body.appendChild(input);

    input.onchange = function(e) {
        var files = Array.from(e.target.files || []);
        if (!files.length) return;

        // Límite: máx 20 - las que ya tiene
        var available = 20 - myCount;
        if (files.length > available) {
            showToast('⚠️ Solo puedes subir ' + available + ' historia' + (available!==1?'s':'') + ' más');
            files = files.slice(0, available);
        }

        showToast('⏳ Cargando ' + files.length + ' archivo' + (files.length!==1?'s':'') + '...');
        _storyStudio.files  = [];
        _storyStudio.edits  = [];
        _storyStudio.current = 0;

        var pending = files.length;
        var results = new Array(files.length);

        files.forEach(function(file, idx) {
            var isVideo = file.type.startsWith('video/');
            var reader = new FileReader();
            reader.onload = function(ev) {
                results[idx] = { id: 'sf_'+Date.now()+'_'+idx, data: ev.target.result, type: isVideo?'video':'image', name: file.name };
                pending--;
                if (pending === 0) {
                    // Verificar duración de videos
                    var videoResults = results.filter(function(r) { return r.type === 'video'; });
                    var checkCount = videoResults.length;
                    if (checkCount === 0) {
                        _storyStudio.files = results;
                        _storyStudio.edits = results.map(function() { return defaultStoryEdit(); });
                        openStoryStudio();
                        return;
                    }
                    videoResults.forEach(function(vr) {
                        var v = document.createElement('video');
                        v.preload = 'metadata';
                        v.onloadedmetadata = function() {
                            URL.revokeObjectURL(v.src);
                            if (v.duration > 30) {
                                vr._tooLong = true;
                                showToast('⚠️ "' + vr.name.substring(0,20) + '" supera 30s — se omitirá');
                            }
                            checkCount--;
                            if (checkCount === 0) {
                                _storyStudio.files = results.filter(function(r) { return !r._tooLong; });
                                if (_storyStudio.files.length === 0) return showToast('❌ Ningún archivo válido');
                                _storyStudio.edits = _storyStudio.files.map(function() { return defaultStoryEdit(); });
                                openStoryStudio();
                            }
                        };
                        v.onerror = function() { checkCount--; if (checkCount===0) { _storyStudio.files=results.filter(function(r){return !r._tooLong;}); _storyStudio.edits=_storyStudio.files.map(function(){return defaultStoryEdit();}); openStoryStudio(); } };
                        v.src = URL.createObjectURL(new Blob([vr.data], {type:'video/mp4'}));
                    });
                }
            };
            reader.readAsDataURL(file);
        });

        setTimeout(function() { input.remove(); }, 1000);
    };
    setTimeout(function() { input.click(); }, 50);
};

function defaultStoryEdit() {
    return {
        text: '', textColor: '#ffffff', fontSize: 26, textX: 50, textY: 50,
        filter: 'none', overlayColor: 'transparent', overlayOpacity: 0,
        stickerEmoji: '', stickerX: 50, stickerY: 30,
        drawPaths: []
    };
}

// ── STORY STUDIO: UI principal ───────────────────────────────
window.openStoryStudio = function() {
    var overlay = document.getElementById('reelEditorOverlay'); if (!overlay) return;
    var files = _storyStudio.files;
    if (!files.length) return;

    overlay.innerHTML = buildStudioHTML();
    overlay._isStudio = true;
    overlay.style.display = 'flex';
    setTimeout(function() { overlay.classList.add('active'); studioRenderCurrent(); studioBindDrag(); }, 30);
};

function buildStudioHTML() {
    var files = _storyStudio.files;
    var thumbs = files.map(function(f, i) {
        return '<div id="sthumb-'+i+'" onclick="studioGoTo('+i+')" style="width:48px;height:72px;border-radius:8px;overflow:hidden;cursor:pointer;flex-shrink:0;border:3px solid '+(i===0?'#fff':'rgba(255,255,255,.3)')+';position:relative;transition:border .2s;">' +
            (f.type==='video'
                ? '<video src="'+f.data+'" style="width:100%;height:100%;object-fit:cover;"></video><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-play" style="color:#fff;font-size:12px;text-shadow:0 1px 4px rgba(0,0,0,.8);"></i></div>'
                : '<img src="'+f.data+'" style="width:100%;height:100%;object-fit:cover;">') +
            '<div style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,.6);border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;cursor:pointer;" onclick="event.stopPropagation();studioRemove('+i+')">' +
            '<i class="fa-solid fa-times" style="color:#fff;font-size:8px;"></i></div>' +
            '<div style="position:absolute;bottom:2px;left:0;right:0;text-align:center;font-size:9px;font-weight:700;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.8);">'+(i+1)+'</div></div>';
    }).join('');

    return '<div id="storyStudio" style="background:#0a0a0a;width:100%;max-width:500px;height:100%;max-height:96vh;border-radius:20px;overflow:hidden;display:flex;flex-direction:column;position:relative;">' +

    // ── TOP BAR ──
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(0,0,0,.5);backdrop-filter:blur(10px);flex-shrink:0;z-index:30;">' +
    '<button onclick="closeStoryEditor()" style="background:rgba(255,255,255,.15);border:none;color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;touch-action:manipulation;"><i class="fa-solid fa-times"></i></button>' +
    '<div style="display:flex;align-items:center;gap:8px;">' +
    '<span style="font-size:13px;font-weight:700;color:#fff;letter-spacing:.5px;">STORY STUDIO</span>' +
    '<span id="studioCount" style="background:rgba(255,255,255,.15);color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:10px;">1/'+files.length+'</span>' +
    '</div>' +
    '<button onclick="studioPublishAll()" style="background:linear-gradient(135deg,#c639b8,#1e8ee9);border:none;color:#fff;padding:8px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;touch-action:manipulation;">Publicar</button>' +
    '</div>' +

    // ── CANVAS PREVIEW ──
    '<div style="flex:1;position:relative;overflow:hidden;background:#111;" id="studioCanvasWrap">' +
    '<div id="studioMediaWrap" style="width:100%;height:100%;position:relative;overflow:hidden;">' +
    '<div id="studioFilterLayer" style="position:absolute;inset:0;z-index:1;pointer-events:none;"></div>' +
    '<div id="studioMedia" style="position:absolute;inset:0;z-index:0;display:flex;align-items:center;justify-content:center;"></div>' +
    '<canvas id="studioDrawCanvas" style="position:absolute;inset:0;z-index:3;pointer-events:none;"></canvas>' +
    '<div id="studioTextEl" style="position:absolute;z-index:4;color:#fff;font-weight:800;text-align:center;text-shadow:0 2px 10px rgba(0,0,0,.7);cursor:grab;user-select:none;touch-action:none;display:none;left:50%;top:50%;transform:translate(-50%,-50%);max-width:90%;word-break:break-word;padding:6px 12px;border-radius:10px;line-height:1.2;"></div>' +
    '<div id="studioStickerEl" style="position:absolute;z-index:5;font-size:48px;cursor:grab;user-select:none;touch-action:none;display:none;left:50%;top:30%;transform:translate(-50%,-50%);line-height:1;"></div>' +
    '</div>' +
    '</div>' +

    // ── TOOL TABS ──
    '<div style="background:#111;flex-shrink:0;">' +
    '<div style="display:flex;border-bottom:1px solid rgba(255,255,255,.1);" id="studioTabs">' +
    ['✏️ Texto','🎨 Filtro','🌈 Fondo','😎 Sticker','🖌️ Dibujar'].map(function(t,i) {
        return '<button id="stab'+i+'" onclick="studioTab('+i+')" style="flex:1;padding:10px 4px;background:none;border:none;color:'+(i===0?'#fff':'rgba(255,255,255,.45)')+';font-size:11px;font-weight:700;cursor:pointer;border-bottom:2px solid '+(i===0?'var(--primary)':'transparent')+';transition:.2s;touch-action:manipulation;">'+t+'</button>';
    }).join('') +
    '</div>' +

    // Texto
    '<div id="spanel0" style="padding:12px 14px;">' +
    '<input type="text" id="studioTextInput" placeholder="Escribe en tu historia..." oninput="studioUpdateText()" style="width:100%;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:10px 14px;color:#fff;font-size:15px;outline:none;font-family:inherit;margin-bottom:10px;">' +
    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
    '<span style="color:rgba(255,255,255,.6);font-size:11px;font-weight:600;">TAMAÑO</span>' +
    '<input type="range" min="14" max="60" value="26" id="studioFontSize" oninput="studioUpdateText()" style="flex:1;height:4px;accent-color:var(--primary);">' +
    '<span style="color:rgba(255,255,255,.6);font-size:11px;" id="studioFontSizeLabel">26px</span>' +
    '</div>' +
    '<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">' +
    ['#ffffff','#000000','#ff4d4d','#ffd700','#4caf50','#1e8ee9','#c639b8','#ff9800','#ff69b4','#00ffff','#7fff00','#ff6600'].map(function(c) {
        return '<div onclick="studioSetTextColor(\''+c+'\')" style="width:26px;height:26px;border-radius:50%;background:'+c+';cursor:pointer;border:2px solid rgba(255,255,255,.3);touch-action:manipulation;" id="stcol-'+c.replace('#','')+'"></div>';
    }).join('') +
    '<input type="color" value="#ffffff" oninput="studioSetTextColor(this.value)" style="width:26px;height:26px;border-radius:50%;border:none;cursor:pointer;padding:0;background:none;touch-action:manipulation;" title="Personalizado">' +
    '</div>' +
    '<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">' +
    ['Sin fondo','Fondo oscuro','Fondo claro','Bordes','Neón'].map(function(s,i) {
        return '<button onclick="studioSetTextStyle('+i+')" style="padding:5px 10px;border-radius:15px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);color:#fff;font-size:11px;cursor:pointer;touch-action:manipulation;">'+s+'</button>';
    }).join('') +
    '</div>' +
    '</div>' +

    // Filtros
    '<div id="spanel1" style="display:none;padding:10px 14px;">' +
    '<div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none;">' +
    STORY_FILTERS.map(function(f) {
        return '<div onclick="studioSetFilter(\''+f.id+'\')" id="sfil-'+f.id+'" style="flex-shrink:0;cursor:pointer;text-align:center;touch-action:manipulation;">' +
            '<div style="width:54px;height:80px;border-radius:10px;overflow:hidden;border:2px solid '+(f.id==='none'?'var(--primary)':'rgba(255,255,255,.2)')+';margin-bottom:4px;" id="sfil-preview-'+f.id+'"><div style="width:100%;height:100%;background:linear-gradient(135deg,#c639b8,#1e8ee9);filter:'+f.css+';"></div></div>' +
            '<span style="font-size:10px;color:'+(f.id==='none'?'#fff':'rgba(255,255,255,.6)')+';font-weight:600;">'+f.label+'</span></div>';
    }).join('') +
    '</div>' +
    '</div>' +

    // Fondo / overlay
    '<div id="spanel2" style="display:none;padding:12px 14px;">' +
    '<div style="margin-bottom:10px;"><span style="color:rgba(255,255,255,.7);font-size:11px;font-weight:600;">COLOR DE FONDO</span>' +
    '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">' +
    ['transparent','#000000','#1a1a2e','#16213e','#c639b8','#1e8ee9','#ff4d4d','#ffd700','#4caf50','#ff69b4','#ffffff'].map(function(c) {
        var display = c === 'transparent' ? 'linear-gradient(135deg, rgba(255,255,255,.3) 25%, transparent 25%, transparent 75%, rgba(255,255,255,.3) 75%), linear-gradient(135deg, rgba(255,255,255,.3) 25%, transparent 25%)' : c;
        return '<div onclick="studioSetOverlay(\''+c+'\')" style="width:32px;height:32px;border-radius:8px;background:'+display+';cursor:pointer;border:2px solid rgba(255,255,255,.3);touch-action:manipulation;background-size:'+(c==='transparent'?'8px 8px':'auto')+';" id="sovl-'+c.replace('#','').replace('transparent','trans')+'"></div>';
    }).join('') +
    '</div></div>' +
    '<div><span style="color:rgba(255,255,255,.7);font-size:11px;font-weight:600;">OPACIDAD OVERLAY</span>' +
    '<input type="range" min="0" max="0.85" step="0.05" value="0" id="studioOverlayOpacity" oninput="studioUpdateOverlay()" style="width:100%;margin-top:8px;accent-color:var(--primary);"></div>' +
    '</div>' +

    // Stickers
    '<div id="spanel3" style="display:none;padding:10px 14px;">' +
    '<div style="display:flex;flex-wrap:wrap;gap:8px;max-height:100px;overflow-y:auto;">' +
    STORY_STICKERS.map(function(s) {
        return '<div onclick="studioAddSticker(\''+s+'\')" style="font-size:28px;cursor:pointer;padding:4px;border-radius:8px;touch-action:manipulation;transition:transform .15s;" onmouseenter="this.style.transform=\'scale(1.3)\'" onmouseleave="this.style.transform=\'\'">'+s+'</div>';
    }).join('') +
    '</div>' +
    '</div>' +

    // Dibujar
    '<div id="spanel4" style="display:none;padding:12px 14px;">' +
    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
    '<span style="color:rgba(255,255,255,.7);font-size:11px;font-weight:600;">COLOR</span>' +
    ['#ff4d4d','#ff9800','#ffd700','#4caf50','#1e8ee9','#c639b8','#fff','#000'].map(function(c) {
        return '<div onclick="studioSetDrawColor(\''+c+'\')" style="width:24px;height:24px;border-radius:50%;background:'+c+';cursor:pointer;border:2px solid rgba(255,255,255,.3);touch-action:manipulation;" id="sdcol-'+c.replace('#','')+'"></div>';
    }).join('') +
    '<input type="color" value="#ff4d4d" oninput="studioSetDrawColor(this.value)" style="width:24px;height:24px;border-radius:50%;border:none;cursor:pointer;padding:0;background:none;">' +
    '</div>' +
    '<div style="display:flex;gap:8px;align-items:center;margin-top:8px;">' +
    '<span style="color:rgba(255,255,255,.7);font-size:11px;font-weight:600;">GROSOR</span>' +
    '<input type="range" min="2" max="20" value="4" id="studioDrawSize" oninput="_storyStudio.drawSize=parseInt(this.value)" style="flex:1;accent-color:var(--primary);">' +
    '<button onclick="studioToggleDraw()" id="studioDrawBtn" style="padding:7px 14px;border-radius:15px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);color:#fff;font-size:12px;cursor:pointer;touch-action:manipulation;">🖌️ Activar</button>' +
    '<button onclick="studioUndoDraw()" style="padding:7px 12px;border-radius:15px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);color:#fff;font-size:12px;cursor:pointer;touch-action:manipulation;">↩ Deshacer</button>' +
    '</div>' +
    '</div>' +
    '</div>' +

    // ── FILMSTRIP ──
    '<div style="background:rgba(0,0,0,.6);padding:10px 14px;flex-shrink:0;border-top:1px solid rgba(255,255,255,.1);">' +
    '<div style="display:flex;gap:8px;overflow-x:auto;align-items:center;scrollbar-width:none;padding-bottom:4px;" id="studioFilmstrip">' +
    thumbs +
    '<div onclick="addMoreStories()" style="width:48px;height:72px;border-radius:8px;border:2px dashed rgba(255,255,255,.4);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;touch-action:manipulation;" title="Añadir más">' +
    '<i class="fa-solid fa-plus" style="color:rgba(255,255,255,.6);font-size:18px;"></i></div>' +
    '</div>' +
    '</div>' +
    '</div>';
}

// ── STUDIO: Ir a historia i ──────────────────────────────────
window.studioGoTo = function(idx) {
    // Guardar estado actual antes de cambiar
    studioSaveCurrentEdit();
    _storyStudio.current = idx;
    studioRenderCurrent();
    // Actualizar thumbs
    document.querySelectorAll('[id^="sthumb-"]').forEach(function(t, i) {
        t.style.border = i === idx ? '3px solid #fff' : '3px solid rgba(255,255,255,.3)';
    });
    var countEl = document.getElementById('studioCount');
    if (countEl) countEl.textContent = (idx+1) + '/' + _storyStudio.files.length;
};

window.studioRemove = function(idx) {
    _storyStudio.files.splice(idx, 1);
    _storyStudio.edits.splice(idx, 1);
    if (_storyStudio.files.length === 0) return closeStoryEditor();
    _storyStudio.current = Math.min(_storyStudio.current, _storyStudio.files.length - 1);
    var overlay = document.getElementById('reelEditorOverlay');
    if (overlay) { overlay.innerHTML = buildStudioHTML(); setTimeout(function() { studioRenderCurrent(); studioBindDrag(); }, 30); }
};

window.addMoreStories = function() {
    var myCount = socialDB.stories.filter(function(s) { return s.authorUsername === socialDB.currentUser.username; }).length;
    var remaining = 20 - myCount - _storyStudio.files.length;
    if (remaining <= 0) return showToast('⚠️ Límite de 20 historias alcanzado');

    var input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*,video/*'; input.multiple = true;
    input.style.cssText = 'position:fixed;top:-200px;left:-200px;opacity:0;pointer-events:none;';
    document.body.appendChild(input);
    input.onchange = function(e) {
        var files = Array.from(e.target.files||[]).slice(0, remaining);
        var pending = files.length;
        files.forEach(function(file, idx) {
            var reader = new FileReader();
            reader.onload = function(ev) {
                _storyStudio.files.push({ id:'sf_'+Date.now()+'_'+idx, data:ev.target.result, type:file.type.startsWith('video/')?'video':'image', name:file.name });
                _storyStudio.edits.push(defaultStoryEdit());
                pending--;
                if (pending === 0) {
                    var overlay = document.getElementById('reelEditorOverlay');
                    if (overlay) { overlay.innerHTML = buildStudioHTML(); setTimeout(function() { studioGoTo(_storyStudio.current); studioBindDrag(); }, 30); }
                }
            };
            reader.readAsDataURL(file);
        });
        setTimeout(function() { input.remove(); }, 1000);
    };
    setTimeout(function() { input.click(); }, 50);
};

// ── STUDIO: Renderizar historia actual ───────────────────────
function studioRenderCurrent() {
    var idx = _storyStudio.current;
    var file = _storyStudio.files[idx];
    var edit = _storyStudio.edits[idx];
    if (!file || !edit) return;

    var mediaEl = document.getElementById('studioMedia');
    var filterEl = document.getElementById('studioFilterLayer');
    var textEl   = document.getElementById('studioTextEl');
    var stickerEl= document.getElementById('studioStickerEl');
    if (!mediaEl) return;

    // Media
    mediaEl.innerHTML = file.type === 'video'
        ? '<video src="'+file.data+'" autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;display:block;"></video>'
        : '<img src="'+file.data+'" style="width:100%;height:100%;object-fit:cover;display:block;">';

    // Filtro
    var filterDef = STORY_FILTERS.find(function(f){ return f.id === edit.filter; }) || STORY_FILTERS[0];
    mediaEl.style.filter = filterDef.css;

    // Overlay de color
    filterEl.style.background = edit.overlayColor !== 'transparent' ? edit.overlayColor : 'transparent';
    filterEl.style.opacity = edit.overlayOpacity || 0;

    // Texto
    if (textEl) {
        textEl.textContent = edit.text || '';
        textEl.style.display = edit.text ? 'block' : 'none';
        textEl.style.color = edit.textColor || '#fff';
        textEl.style.fontSize = (edit.fontSize||26) + 'px';
        textEl.style.left = (edit.textX||50) + '%';
        textEl.style.top  = (edit.textY||50) + '%';
        textEl.style.transform = 'translate(-50%,-50%)';
        studioApplyTextStyle(textEl, edit.textStyle||0);
    }

    // Sticker
    if (stickerEl) {
        stickerEl.textContent = edit.stickerEmoji || '';
        stickerEl.style.display = edit.stickerEmoji ? 'block' : 'none';
        stickerEl.style.left = (edit.stickerX||50) + '%';
        stickerEl.style.top  = (edit.stickerY||30) + '%';
    }

    // Canvas dibujo
    studioInitCanvas();
    studioRedrawPaths(edit.drawPaths || []);

    // Sincronizar controles UI
    var textInput = document.getElementById('studioTextInput');
    if (textInput) textInput.value = edit.text || '';
    var sizeInput = document.getElementById('studioFontSize');
    if (sizeInput) { sizeInput.value = edit.fontSize||26; }
    var sizeLabel = document.getElementById('studioFontSizeLabel');
    if (sizeLabel) sizeLabel.textContent = (edit.fontSize||26)+'px';
    var opacInput = document.getElementById('studioOverlayOpacity');
    if (opacInput) opacInput.value = edit.overlayOpacity||0;

    // Resaltar filtro activo
    document.querySelectorAll('[id^="sfil-"]').forEach(function(el) {
        if (el.id.startsWith('sfil-preview-')) return;
        el.querySelector('div').style.border = el.id === 'sfil-'+edit.filter ? '2px solid var(--primary)' : '2px solid rgba(255,255,255,.2)';
        el.querySelector('span').style.color = el.id === 'sfil-'+edit.filter ? '#fff' : 'rgba(255,255,255,.6)';
    });
}

function studioApplyTextStyle(textEl, styleIdx) {
    var styles = [
        {},  // Sin fondo
        { background:'rgba(0,0,0,.65)', padding:'6px 12px', borderRadius:'8px' },   // Fondo oscuro
        { background:'rgba(255,255,255,.85)', color:'#000', padding:'6px 12px', borderRadius:'8px' },  // Fondo claro
        { WebkitTextStroke:'2px rgba(0,0,0,.6)', paint:'stroke', padding:'0' },    // Bordes
        { textShadow:'0 0 12px currentColor, 0 0 30px currentColor', padding:'4px 10px' }  // Neón
    ];
    var s = styles[styleIdx] || styles[0];
    Object.assign(textEl.style, { background:'', WebkitTextStroke:'', textShadow:'0 2px 10px rgba(0,0,0,.7)', padding:'6px 12px', borderRadius:'10px', color: textEl.style.color });
    Object.keys(s).forEach(function(k) { textEl.style[k] = s[k]; });
}

// ── STUDIO: Canvas dibujo ────────────────────────────────────
function studioInitCanvas() {
    var canvas = document.getElementById('studioDrawCanvas'); if (!canvas) return;
    var wrap   = document.getElementById('studioCanvasWrap'); if (!wrap) return;
    canvas.width  = wrap.clientWidth  || 400;
    canvas.height = wrap.clientHeight || 600;
    _storyStudio.drawCtx = canvas.getContext('2d');
}

function studioRedrawPaths(paths) {
    var ctx = _storyStudio.drawCtx; if (!ctx) return;
    var canvas = document.getElementById('studioDrawCanvas'); if (!canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    paths.forEach(function(path) {
        if (!path.points || path.points.length < 2) return;
        ctx.beginPath();
        ctx.strokeStyle = path.color || '#ff4d4d';
        ctx.lineWidth = path.size || 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveTo(path.points[0].x, path.points[0].y);
        for (var i=1; i<path.points.length; i++) ctx.lineTo(path.points[i].x, path.points[i].y);
        ctx.stroke();
    });
}

window.studioToggleDraw = function() {
    var canvas = document.getElementById('studioDrawCanvas'); if (!canvas) return;
    var btn = document.getElementById('studioDrawBtn');
    _storyStudio.drawMode = !_storyStudio.drawMode;
    canvas.style.pointerEvents = _storyStudio.drawMode ? 'auto' : 'none';
    canvas.style.cursor = _storyStudio.drawMode ? 'crosshair' : 'default';
    if (btn) { btn.style.background = _storyStudio.drawMode ? 'var(--primary)' : 'rgba(255,255,255,.1)'; btn.textContent = _storyStudio.drawMode ? '🛑 Parar' : '🖌️ Activar'; }
    if (_storyStudio.drawMode) studioBindCanvasDraw();
};

window.studioUndoDraw = function() {
    var edit = _storyStudio.edits[_storyStudio.current];
    if (!edit || !edit.drawPaths || !edit.drawPaths.length) return;
    edit.drawPaths.pop();
    studioRedrawPaths(edit.drawPaths);
};

window.studioSetDrawColor = function(color) {
    _storyStudio.drawColor = color;
};

function studioBindCanvasDraw() {
    var canvas = document.getElementById('studioDrawCanvas'); if (!canvas) return;
    var currentPath = null;

    function getPos(e) {
        var rect = canvas.getBoundingClientRect();
        var src = e.touches ? e.touches[0] : e;
        return { x: src.clientX - rect.left, y: src.clientY - rect.top };
    }
    function start(e) {
        if (!_storyStudio.drawMode) return;
        e.preventDefault();
        _storyStudio.drawing = true;
        var pos = getPos(e);
        currentPath = { color: _storyStudio.drawColor, size: _storyStudio.drawSize, points: [pos] };
        var ctx = _storyStudio.drawCtx;
        if (ctx) { ctx.beginPath(); ctx.moveTo(pos.x, pos.y); }
    }
    function move(e) {
        if (!_storyStudio.drawing || !currentPath) return;
        e.preventDefault();
        var pos = getPos(e);
        currentPath.points.push(pos);
        var ctx = _storyStudio.drawCtx;
        if (ctx) { ctx.strokeStyle = currentPath.color; ctx.lineWidth = currentPath.size; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.lineTo(pos.x, pos.y); ctx.stroke(); }
    }
    function end(e) {
        if (!_storyStudio.drawing) return;
        _storyStudio.drawing = false;
        if (currentPath && currentPath.points.length > 1) {
            var edit = _storyStudio.edits[_storyStudio.current];
            if (edit) { if (!edit.drawPaths) edit.drawPaths = []; edit.drawPaths.push(currentPath); }
        }
        currentPath = null;
    }

    canvas.removeEventListener('mousedown', canvas._drawStart);
    canvas.removeEventListener('mousemove', canvas._drawMove);
    canvas.removeEventListener('mouseup',   canvas._drawEnd);
    canvas.removeEventListener('touchstart', canvas._drawTStart);
    canvas.removeEventListener('touchmove',  canvas._drawTMove);
    canvas.removeEventListener('touchend',   canvas._drawTEnd);

    canvas._drawStart = start; canvas._drawMove = move; canvas._drawEnd = end;
    canvas._drawTStart = start; canvas._drawTMove = move; canvas._drawTEnd = end;

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup',   end);
    canvas.addEventListener('touchstart', start, { passive:false });
    canvas.addEventListener('touchmove',  move,  { passive:false });
    canvas.addEventListener('touchend',   end);
}

// ── STUDIO: Drag texto y sticker ────────────────────────────
function studioBindDrag() {
    // Texto
    var textEl = document.getElementById('studioTextEl');
    var wrap   = document.getElementById('studioCanvasWrap');
    if (textEl && wrap) bindDragElement(textEl, wrap, function(px, py) {
        var edit = _storyStudio.edits[_storyStudio.current]; if (!edit) return;
        edit.textX = px; edit.textY = py;
    });
    // Sticker
    var stickerEl = document.getElementById('studioStickerEl');
    if (stickerEl && wrap) bindDragElement(stickerEl, wrap, function(px, py) {
        var edit = _storyStudio.edits[_storyStudio.current]; if (!edit) return;
        edit.stickerX = px; edit.stickerY = py;
    });
}

function bindDragElement(el, container, onMove) {
    var dragging = false, ox = 0, oy = 0;
    function getXY(e) { var s = e.touches ? e.touches[0] : e; return { x:s.clientX, y:s.clientY }; }
    function start(e) { if (e.target !== el) return; e.preventDefault(); dragging=true; var p=getXY(e); var rect=el.getBoundingClientRect(); ox=p.x-rect.left-(rect.width/2); oy=p.y-rect.top-(rect.height/2); el.style.cursor='grabbing'; }
    function move(e) {
        if (!dragging) return; e.preventDefault();
        var p=getXY(e); var cr=container.getBoundingClientRect();
        var px = Math.max(5,Math.min(95, (p.x-cr.left)/cr.width*100));
        var py = Math.max(5,Math.min(95, (p.y-cr.top)/cr.height*100));
        el.style.left=px+'%'; el.style.top=py+'%';
        onMove(px,py);
    }
    function end() { dragging=false; el.style.cursor='grab'; }
    el.addEventListener('mousedown', start); document.addEventListener('mousemove', move); document.addEventListener('mouseup', end);
    el.addEventListener('touchstart', start, {passive:false}); document.addEventListener('touchmove', move, {passive:false}); document.addEventListener('touchend', end);
}

// ── STUDIO: Guardar edits actuales ───────────────────────────
function studioSaveCurrentEdit() {
    var idx = _storyStudio.current;
    var edit = _storyStudio.edits[idx]; if (!edit) return;
    var textInput = document.getElementById('studioTextInput');
    var sizeInput = document.getElementById('studioFontSize');
    var opacInput = document.getElementById('studioOverlayOpacity');
    if (textInput) edit.text = textInput.value;
    if (sizeInput) edit.fontSize = parseInt(sizeInput.value);
    if (opacInput) edit.overlayOpacity = parseFloat(opacInput.value);
}

// ── STUDIO: Controles de edición ────────────────────────────
window.studioTab = function(idx) {
    for (var i=0; i<5; i++) {
        var p = document.getElementById('spanel'+i); if (p) p.style.display = i===idx?'block':'none';
        var t = document.getElementById('stab'+i);
        if (t) { t.style.color = i===idx?'#fff':'rgba(255,255,255,.45)'; t.style.borderBottom = i===idx?'2px solid var(--primary)':'2px solid transparent'; }
    }
};

window.studioUpdateText = function() {
    var edit = _storyStudio.edits[_storyStudio.current]; if (!edit) return;
    var inp = document.getElementById('studioTextInput');
    var sizeSlider = document.getElementById('studioFontSize');
    var sizeLabel  = document.getElementById('studioFontSizeLabel');
    if (inp) edit.text = inp.value;
    if (sizeSlider) { edit.fontSize = parseInt(sizeSlider.value); if (sizeLabel) sizeLabel.textContent = edit.fontSize+'px'; }
    var textEl = document.getElementById('studioTextEl'); if (!textEl) return;
    textEl.textContent = edit.text || '';
    textEl.style.display = edit.text ? 'block' : 'none';
    textEl.style.fontSize = (edit.fontSize||26) + 'px';
    studioApplyTextStyle(textEl, edit.textStyle||0);
};

window.studioSetTextColor = function(color) {
    var edit = _storyStudio.edits[_storyStudio.current]; if (!edit) return;
    edit.textColor = color;
    var textEl = document.getElementById('studioTextEl'); if (textEl) textEl.style.color = color;
};

window.studioSetTextStyle = function(styleIdx) {
    var edit = _storyStudio.edits[_storyStudio.current]; if (!edit) return;
    edit.textStyle = styleIdx;
    var textEl = document.getElementById('studioTextEl'); if (!textEl) return;
    studioApplyTextStyle(textEl, styleIdx);
};

window.studioSetFilter = function(filterId) {
    var edit = _storyStudio.edits[_storyStudio.current]; if (!edit) return;
    edit.filter = filterId;
    var filterDef = STORY_FILTERS.find(function(f){ return f.id===filterId; }) || STORY_FILTERS[0];
    var mediaEl = document.getElementById('studioMedia'); if (mediaEl) mediaEl.style.filter = filterDef.css;
    // Resaltar selección
    document.querySelectorAll('[id^="sfil-"]').forEach(function(el) {
        if (!el.id.startsWith('sfil-preview-') && el.querySelector) {
            var div = el.querySelector('div'); var span = el.querySelector('span');
            if (div) div.style.border = el.id==='sfil-'+filterId ? '2px solid var(--primary)' : '2px solid rgba(255,255,255,.2)';
            if (span) span.style.color = el.id==='sfil-'+filterId ? '#fff' : 'rgba(255,255,255,.6)';
        }
    });
};

window.studioSetOverlay = function(color) {
    var edit = _storyStudio.edits[_storyStudio.current]; if (!edit) return;
    edit.overlayColor = color;
    studioUpdateOverlay();
};

window.studioUpdateOverlay = function() {
    var edit = _storyStudio.edits[_storyStudio.current]; if (!edit) return;
    var opacInput = document.getElementById('studioOverlayOpacity');
    if (opacInput) edit.overlayOpacity = parseFloat(opacInput.value);
    var filterEl = document.getElementById('studioFilterLayer'); if (!filterEl) return;
    if (edit.overlayColor && edit.overlayColor !== 'transparent') {
        filterEl.style.background = edit.overlayColor;
        filterEl.style.opacity = edit.overlayOpacity;
    } else {
        filterEl.style.background = 'transparent';
        filterEl.style.opacity = 0;
    }
};

window.studioAddSticker = function(emoji) {
    var edit = _storyStudio.edits[_storyStudio.current]; if (!edit) return;
    edit.stickerEmoji = emoji;
    edit.stickerX = 50; edit.stickerY = 30;
    var stickerEl = document.getElementById('studioStickerEl'); if (!stickerEl) return;
    stickerEl.textContent = emoji;
    stickerEl.style.display = 'block';
    stickerEl.style.left = '50%'; stickerEl.style.top = '30%';
};

// ── STUDIO: Publicar todas ───────────────────────────────────
window.studioPublishAll = function() {
    studioSaveCurrentEdit();
    var files = _storyStudio.files;
    var edits = _storyStudio.edits;
    if (!files.length) return;

    var btn = document.querySelector('#storyStudio button[onclick="studioPublishAll()"]');
    if (btn) { btn.textContent = 'Publicando...'; btn.disabled = true; }

    var u = socialDB.currentUser;
    var total = files.length;
    var done  = 0;
    var errors = 0;

    closeStoryEditor();
    showToast('⏳ Publicando ' + total + ' historia' + (total!==1?'s':'') + '...');

    function publishOne(idx) {
        if (idx >= files.length) {
            if (errors === 0) showToast('✅ ' + done + ' historia' + (done!==1?'s':'') + ' publicada' + (done!==1?'s':''));
            else showToast('⚠️ ' + done + ' publicadas, ' + errors + ' con error');
            renderStories();
            if (socialDB.socket && socialDB.socket.connected) {
                (u.friends||[]).forEach(function(fn) {
                    socialDB.socket.emit('friend_story', { to:fn, authorName:u.name });
                });
            }
            return;
        }

        var file = files[idx];
        var edit = edits[idx] || defaultStoryEdit();

        // Compositar la imagen con filtro y texto mediante canvas si es imagen
        composeStoryFrame(file, edit, function(composedData) {
            api('POST', '/stories', {
                type:       file.type,
                content:    composedData || file.data,
                storyText:  edit.text    || '',
                storyColor: edit.textColor || '#fff'
            })
            .then(function(data) {
                if (data.ok) {
                    done++;
                    var alreadyExists = socialDB.stories.find(function(s) { return (s._id||s.id) === (data.story._id||data.story.id); });
                    if (!alreadyExists) socialDB.stories.unshift(data.story);
                } else {
                    errors++;
                }
                setTimeout(function() { publishOne(idx+1); }, 200);
            })
            .catch(function() { errors++; setTimeout(function() { publishOne(idx+1); }, 200); });
        });
    }

    publishOne(0);
};

// Compositar imagen con filtro CSS → data URL
function composeStoryFrame(file, edit, callback) {
    // Solo imágenes se compositan; videos se envían tal cual
    if (file.type === 'video') { callback(file.data); return; }
    if (!edit.filter && !edit.text && !edit.stickerEmoji && !edit.overlayOpacity && !edit.drawPaths.length) {
        callback(file.data); return;
    }
    var img = new Image();
    img.onload = function() {
        var canvas = document.createElement('canvas');
        canvas.width  = img.width  || 800;
        canvas.height = img.height || 1200;
        var ctx = canvas.getContext('2d');
        // Filtro
        var filterDef = STORY_FILTERS.find(function(f){ return f.id===edit.filter; }) || STORY_FILTERS[0];
        ctx.filter = filterDef.css || 'none';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.filter = 'none';
        // Overlay
        if (edit.overlayColor && edit.overlayColor !== 'transparent' && edit.overlayOpacity > 0) {
            ctx.globalAlpha = edit.overlayOpacity;
            ctx.fillStyle = edit.overlayColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.globalAlpha = 1;
        }
        // Trazos dibujados (escalados)
        var scaleX = canvas.width  / (document.getElementById('studioCanvasWrap') || {clientWidth:400}).clientWidth;
        var scaleY = canvas.height / (document.getElementById('studioCanvasWrap') || {clientHeight:600}).clientHeight;
        (edit.drawPaths||[]).forEach(function(path) {
            if (!path.points||path.points.length<2) return;
            ctx.beginPath(); ctx.strokeStyle=path.color; ctx.lineWidth=path.size*scaleX; ctx.lineCap='round'; ctx.lineJoin='round';
            ctx.moveTo(path.points[0].x*scaleX, path.points[0].y*scaleY);
            for (var i=1;i<path.points.length;i++) ctx.lineTo(path.points[i].x*scaleX, path.points[i].y*scaleY);
            ctx.stroke();
        });
        // Texto
        if (edit.text) {
            var fontSize = (edit.fontSize||26) * (canvas.height/600);
            ctx.font = 'bold ' + fontSize + 'px Outfit, sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            var tx = (edit.textX/100) * canvas.width;
            var ty = (edit.textY/100) * canvas.height;
            ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 8;
            ctx.fillStyle = edit.textColor || '#fff';
            ctx.fillText(edit.text, tx, ty);
            ctx.shadowBlur = 0;
        }
        // Sticker
        if (edit.stickerEmoji) {
            var stickerSize = Math.floor(canvas.height * 0.1);
            ctx.font = stickerSize + 'px serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(edit.stickerEmoji, (edit.stickerX/100)*canvas.width, (edit.stickerY/100)*canvas.height);
        }
        try { callback(canvas.toDataURL('image/jpeg', 0.88)); }
        catch(e) { callback(file.data); } // fallback CORS
    };
    img.onerror = function() { callback(file.data); };
    img.src = file.data;
}

// Backwards compat: openStoryEditor sigue funcionando para uso directo
window.openStoryEditor = function(mediaData, mediaType) {
    _storyStudio.files = [{ id:'sf_single', data:mediaData, type:mediaType, name:'' }];
    _storyStudio.edits = [defaultStoryEdit()];
    _storyStudio.current = 0;
    openStoryStudio();
};

window.updateStoryText = function() { studioUpdateText(); };
window.setStoryTextColor = function(color) { studioSetTextColor(color); };

window.confirmPublishStory = function() { studioPublishAll(); };

window.closeStoryEditor = function() {
    var ov = document.getElementById('reelEditorOverlay'); if (!ov) return;
    _storyStudio.drawMode = false;
    _storyStudio.drawing  = false;
    ov.classList.remove('active');
    setTimeout(function() { ov.style.display='none'; ov.innerHTML=''; ov._isStudio=false; }, 400);
};

// ── VISOR DE HISTORIAS ESTILO INSTAGRAM ─────────────────
// Abre el visor posicionado en el usuario seleccionado
window.viewStory = function(storyId) {
    // Agrupar historias por usuario (igual que en renderStories)
    var u = socialDB.currentUser;
    var groups = [];
    var seenUsers = {};

    // Primero el usuario actual si tiene historias
    var myStories = socialDB.stories.filter(function(s) { return s.authorUsername === u.username; });
    if (myStories.length > 0) {
        var author = u;
        groups.push({ username: u.username, author: author, stories: myStories });
        seenUsers[u.username] = true;
    }

    // Luego los amigos
    socialDB.stories.filter(function(s) { return s.authorUsername !== u.username; }).forEach(function(story) {
        if (!seenUsers[story.authorUsername]) {
            seenUsers[story.authorUsername] = true;
            var author2 = socialDB.users.find(function(x) { return x.username === story.authorUsername; });
            if (!author2) author2 = { name: story.authorName || story.authorUsername, profilePic: '', username: story.authorUsername };
            var userStories = socialDB.stories.filter(function(s) { return s.authorUsername === story.authorUsername; });
            groups.push({ username: story.authorUsername, author: author2, stories: userStories });
        }
    });

    if (groups.length === 0) return;

    // Encontrar en qué grupo está la historia seleccionada
    var startGroup = 0;
    var startStory = 0;
    for (var g = 0; g < groups.length; g++) {
        for (var s = 0; s < groups[g].stories.length; s++) {
            if ((groups[g].stories[s]._id || groups[g].stories[s].id) === storyId) {
                startGroup = g;
                startStory = s;
                break;
            }
        }
    }

    openStoryViewer(groups, startGroup, startStory);
};

// Viewer completo estilo Instagram
window.openStoryViewer = function(groups, groupIdx, storyIdx) {
    clearTimeout(socialDB.storyTimer);
    // Parar videos anteriores
    var modal = document.getElementById('storyModal');
    if (modal) {
        modal.querySelectorAll('video').forEach(function(v) { v.pause(); v.src = ''; });
    }

    socialDB._storyGroups  = groups;
    socialDB._storyGroupIdx = groupIdx;
    socialDB._storyIdx     = storyIdx;

    var group  = groups[groupIdx];
    var story  = group.stories[storyIdx];
    var author = group.author;
    var total  = group.stories.length;

    // Construir barra de progreso múltiple
    var barsHTML = group.stories.map(function(s, i) {
        return '<div style="flex:1;height:3px;background:rgba(255,255,255,.35);border-radius:2px;overflow:hidden;">' +
            '<div id="sbar-' + i + '" style="height:100%;background:#fff;width:' + (i < storyIdx ? '100' : '0') + '%;transition:none;"></div>' +
            '</div>';
    }).join('');

    var bodyHTML = '';
    if (story.type === 'video') {
        bodyHTML = '<video id="storyVid" src="' + story.content + '" autoplay loop playsinline style="width:100%;height:100%;object-fit:cover;display:block;"></video>';
    } else {
        bodyHTML = '<img src="' + story.content + '" style="width:100%;height:100%;object-fit:cover;">';
    }
    if (story.storyText) {
        bodyHTML += '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:22px;font-weight:800;color:' + (story.storyColor||'#fff') + ';text-shadow:0 2px 8px rgba(0,0,0,.7);text-align:center;max-width:90%;word-break:break-word;padding:4px 10px;">' + story.storyText + '</div>';
    }

    // Navegación entre grupos (flechas)
    var prevGroupBtn = groupIdx > 0
        ? '<button onclick="event.stopPropagation();storyPrevGroup()" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.4);border:none;color:#fff;width:32px;height:32px;border-radius:50%;font-size:16px;cursor:pointer;z-index:20;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-chevron-left"></i></button>' : '';
    var nextGroupBtn = groupIdx < groups.length - 1
        ? '<button onclick="event.stopPropagation();storyNextGroup()" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.4);border:none;color:#fff;width:32px;height:32px;border-radius:50%;font-size:16px;cursor:pointer;z-index:20;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-chevron-right"></i></button>' : '';

    modal.querySelector('.story-modal-content').innerHTML =
        // Barras de progreso
        '<div style="position:absolute;top:10px;left:10px;right:10px;z-index:15;display:flex;gap:3px;">' + barsHTML + '</div>' +
        // Header
        '<div class="story-modal-header" style="z-index:16;">' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
        '<div class="story-modal-avatar" id="storyModalAvatar">' + renderAvatar(author,40) + '</div>' +
        '<div>' +
        '<div style="font-weight:700;color:#fff;font-size:14px;">' + author.name + '</div>' +
        '<div style="font-size:11px;color:rgba(255,255,255,.7);">' + timeAgo(story.createdAt) + (total > 1 ? ' · ' + (storyIdx+1) + '/' + total : '') + '</div>' +
        '</div></div>' +
        '<button onclick="closeStoryModal()" style="background:none;border:none;color:#fff;font-size:26px;cursor:pointer;line-height:1;">×</button>' +
        '</div>' +
        // Cuerpo
        '<div class="story-modal-body" id="storyModalBody" style="position:relative;">' + bodyHTML + '</div>' +
        // Áreas táctiles de navegación
        '<div onclick="event.stopPropagation();storyPrev()" style="position:absolute;left:0;top:80px;bottom:0;width:35%;z-index:12;cursor:pointer;"></div>' +
        '<div onclick="event.stopPropagation();storyNext()" style="position:absolute;right:0;top:80px;bottom:0;width:35%;z-index:12;cursor:pointer;"></div>' +
        prevGroupBtn + nextGroupBtn;

    modal.style.display = 'flex';

    // Iniciar progreso
    var duration = story.type === 'video' ? 0 : 5000;
    startStoryBar(storyIdx, total, duration);
};

function startStoryBar(idx, total, duration) {
    clearTimeout(socialDB.storyTimer);
    // Si es video, esperar a que cargue para saber duración
    if (duration === 0) {
        var vid = document.getElementById('storyVid');
        if (vid) {
            vid.onloadedmetadata = function() {
                var dur = Math.min(vid.duration * 1000, 30000);
                animateStoryBar(idx, total, dur);
            };
            // Fallback si ya cargó
            if (vid.readyState >= 1) {
                var dur = Math.min(vid.duration * 1000, 30000);
                animateStoryBar(idx, total, dur);
            }
        }
        return;
    }
    animateStoryBar(idx, total, duration);
}

function animateStoryBar(idx, total, duration) {
    var bar = document.getElementById('sbar-' + idx); if (!bar) return;
    bar.style.transition = 'width ' + duration + 'ms linear';
    bar.style.width = '100%';
    socialDB.storyTimer = setTimeout(function() { storyNext(); }, duration);
}

window.storyNext = function() {
    var groups = socialDB._storyGroups;
    var gIdx   = socialDB._storyGroupIdx;
    var sIdx   = socialDB._storyIdx;
    var group  = groups[gIdx];

    if (sIdx < group.stories.length - 1) {
        openStoryViewer(groups, gIdx, sIdx + 1);
    } else if (gIdx < groups.length - 1) {
        openStoryViewer(groups, gIdx + 1, 0);
    } else {
        closeStoryModal();
    }
};

window.storyPrev = function() {
    var groups = socialDB._storyGroups;
    var gIdx   = socialDB._storyGroupIdx;
    var sIdx   = socialDB._storyIdx;

    if (sIdx > 0) {
        openStoryViewer(groups, gIdx, sIdx - 1);
    } else if (gIdx > 0) {
        var prevGroup = groups[gIdx - 1];
        openStoryViewer(groups, gIdx - 1, prevGroup.stories.length - 1);
    }
};

window.storyNextGroup = function() {
    var groups = socialDB._storyGroups;
    var gIdx   = socialDB._storyGroupIdx;
    if (gIdx < groups.length - 1) openStoryViewer(groups, gIdx + 1, 0);
};

window.storyPrevGroup = function() {
    var groups = socialDB._storyGroups;
    var gIdx   = socialDB._storyGroupIdx;
    if (gIdx > 0) openStoryViewer(groups, gIdx - 1, 0);
};
window.closeStoryModal = function() {
    clearTimeout(socialDB.storyTimer);
    // Detener TODOS los videos dentro del modal para cortar el audio
    var modal = document.getElementById('storyModal');
    if (modal) {
        modal.querySelectorAll('video').forEach(function(v) {
            v.pause(); v.currentTime = 0; v.src = '';
        });
        var bodyEl = document.getElementById('storyModalBody');
        if (bodyEl) bodyEl.innerHTML = '';
    }
    document.getElementById('storyModal').style.display = 'none';
};

// ── 11. POSTS ────────────────────────────────────────────
function renderPosts() {
    var wrapper = document.getElementById('feedPosts'); if (!wrapper) return;
    wrapper.innerHTML = '<div class="reels-loading"><div class="reels-spinner"></div><p>Cargando...</p></div>';

    api('GET', '/posts/feed')
    .then(function(data) {
        if (!data.ok) { wrapper.innerHTML = '<div class="empty-state"><i class="fa-solid fa-newspaper"></i><p>Error al cargar posts.</p></div>'; return; }
        socialDB.posts = data.posts || [];
        if (socialDB.posts.length === 0) {
            wrapper.innerHTML = '<div class="empty-state"><i class="fa-solid fa-newspaper"></i><p>Aún no hay publicaciones. ¡Sé el primero!</p></div>';
            return;
        }
        wrapper.innerHTML = socialDB.posts.map(function(p) { return buildPostHTML(p); }).join('');
    })
    .catch(function() {
        wrapper.innerHTML = '<div class="empty-state"><i class="fa-solid fa-newspaper"></i><p>Error de conexión.</p></div>';
    });
}

function buildPostHTML(p) {
    var u = socialDB.currentUser;
    var pid = p._id || p.id; // MongoDB uses _id, local uses id
    var likes = p.likes || []; var comments = p.comments || [];
    var reactions = p.reactions || {};
    var myReaction = null;
    var reactionEmojis = ['❤️','😂','😮','😢','👏','🔥'];
    reactionEmojis.forEach(function(e) { if (reactions[e] && reactions[e].indexOf(u.username) !== -1) myReaction = e; });
    var totalReactions = reactionEmojis.reduce(function(acc, e) { return acc + ((reactions[e]||[]).length); }, 0);
    var author = getUser(p.authorUsername) || { name:p.authorName, profilePic:'', username:p.authorUsername };
    var totalLikes = likes.length + totalReactions;
    var topEmojis = reactionEmojis.filter(function(e) { return (reactions[e]||[]).length > 0; }).slice(0,3).join('');

    if (p.media) {
        if (p.mediaType === 'video') {
            var hasText  = p.videoText  && p.videoText.trim();
            var hasMusic = p.videoMusic && p.videoMusic.trim();
            var txColor  = p.videoColor || '#ffffff';
            var txSize   = p.videoSize  || 22;
            var txX      = p.videoTextX !== undefined ? p.videoTextX : 50;
            var txY      = p.videoTextY !== undefined ? p.videoTextY : 50;
            mediaHTML =
                '<div style="position:relative;margin-top:10px;border-radius:12px;overflow:hidden;background:#000;">' +
                '<video src="' + p.media + '" class="post-media-content" controls style="max-height:400px;margin-top:0;border-radius:0;" preload="metadata"></video>' +
                (hasText ? '<div style="position:absolute;left:' + txX + '%;top:' + txY + '%;transform:translate(-50%,-50%);font-size:' + txSize + 'px;font-weight:800;color:' + txColor + ';text-shadow:0 2px 8px rgba(0,0,0,.7);text-align:center;pointer-events:none;max-width:90%;word-break:break-word;white-space:pre-wrap;padding:4px 8px;border-radius:6px;">' + p.videoText + '</div>' : '') +
                (hasMusic ? '<div style="position:absolute;bottom:48px;left:12px;display:flex;align-items:center;gap:6px;pointer-events:none;"><div style="width:24px;height:24px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;animation:spinSlow 4s linear infinite;"><i class="fa-solid fa-music"></i></div><span style="font-size:11px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.8);max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + p.videoMusic + '</span></div>' : '') +
                '</div>';
        } else {
            // Fix 1 + 6 + 7: imagen completa (object-contain), zoom al click, filtro guardado
            var filterCSS = p.mediaFilter ? STORY_FILTERS.find(function(f){return f.id===p.mediaFilter;}) : null;
            var fStyle = filterCSS ? 'filter:'+filterCSS.css+';' : '';
            mediaHTML = '<div style="margin-top:10px;border-radius:12px;overflow:hidden;background:#000;cursor:zoom-in;" onclick="openFullscreen(this.querySelector(\'img\').src)">' +
                '<img src="' + p.media + '" class="post-media-img" style="width:100%;max-height:500px;object-fit:contain;display:block;' + fStyle + '" alt="media"></div>';
        }
    }

    return '<div class="post-card" id="post-' + pid + '">' +
        '<div class="post-header">' +
        '<div class="post-author-info">' +
        '<div class="post-author-avatar">' + renderAvatar(author, 44) + '</div>' +
        '<div><div class="post-author-name">' + p.authorName + '</div>' +
        '<div class="post-date">' + timeAgo(p.createdAt) + (p.feeling ? ' · 😊 Se siente <em>' + p.feeling + '</em>' : '') + (p.editedAt ? ' · <em style="color:var(--text-muted)">editado</em>' : '') + '</div></div></div>' +
        '<div class="post-menu">' + (p.authorUsername === u.username ? '<i class="fa-solid fa-pen" onclick="editPost(\'' + pid + '\')" title="Editar"></i><i class="fa-solid fa-trash" onclick="deletePost(\'' + pid + '\')" title="Eliminar"></i>' : '') + '</div></div>' +
        (p.content ? '<p class="post-content">' + p.content + '</p>' : '') +
        mediaHTML +
        (totalLikes > 0 ? '<div style="display:flex;align-items:center;gap:5px;margin-top:8px;font-size:13px;color:var(--text-muted);">' + (topEmojis||'❤️') + ' <span>' + totalLikes + ' reacción' + (totalLikes>1?'es':'') + '</span></div>' : '') +
        '<div class="post-actions">' +
        '<div class="reaction-wrapper">' +
        // Desktop: hover shows bar. Mobile: click toggles bar
        '<button class="action-btn' + (myReaction?' liked':'') + '" onmouseenter="showReactionBar(\'' + pid + '\')" onmouseleave="scheduleHideReaction(\'' + pid + '\')" onclick="toggleLike(\'' + pid + '\')" ontouchstart="event.preventDefault();toggleReactionBar(\'' + pid + '\')">' +
        '<span style="font-size:16px;">' + (myReaction||'🤍') + '</span><span>' + (totalLikes>0?totalLikes:'') + ' Me gusta</span></button>' +
        '<div class="reaction-bar" id="reaction-bar-' + pid + '" style="pointer-events:none;" onmouseenter="clearReactionHide(\'' + pid + '\')" onmouseleave="scheduleHideReaction(\'' + pid + '\')">' +
        reactionEmojis.map(function(e) { return '<button class="reaction-emoji-btn' + (myReaction===e?' active':'') + '" onclick="reactToPost(\'' + pid + '\',\'' + e + '\')">' + e + '</button>'; }).join('') +
        '</div></div>' +
        '<button class="action-btn" onclick="toggleComments(\'' + pid + '\')"><i class="fa-regular fa-comment"></i><span>' + (comments.length>0?comments.length:'') + ' Comentar</span></button>' +
        '<button class="action-btn" onclick="openShareModal(\'' + pid + '\')"><i class="fa-solid fa-share-nodes"></i><span>Compartir</span></button>' +
        '</div>' +
        '<div id="comments-' + pid + '" style="display:none;"><div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">' +
        comments.map(function(c) { return buildCommentHTML(c, pid); }).join('') +
        '<div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">' +
        // Emoji picker strip
        '<div id="emoji-picker-' + pid + '" style="display:none;flex-wrap:wrap;gap:4px;padding:8px;background:var(--bg-input);border-radius:12px;border:1px solid var(--border);">' +
        COMMENT_EMOJIS.map(function(e){ return '<span onclick="insertCommentEmoji(\''+pid+'\',\''+e+'\')" style="font-size:20px;cursor:pointer;padding:2px;border-radius:6px;touch-action:manipulation;" onmouseenter="this.style.background=\'var(--bg-hover)\'" onmouseleave="this.style.background=\'\'">'+e+'</span>'; }).join('') +
        '</div>' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
        '<div style="width:30px;height:30px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;flex-shrink:0;overflow:hidden;">' + renderAvatar(u, 30) + '</div>' +
        '<div style="flex:1;display:flex;gap:6px;align-items:center;border:1.5px solid var(--border);border-radius:20px;padding:4px 4px 4px 14px;background:var(--bg-input);">' +
        '<input type="text" id="comment-input-' + pid + '" placeholder="Escribe un comentario..." style="flex:1;border:none;background:none;font-size:13px;color:var(--text);outline:none;font-family:inherit;" onkeydown="if(event.key===\'Enter\') addComment(\'' + pid + '\')">' +
        '<button onclick="toggleCommentEmoji(\'' + pid + '\')" style="background:none;border:none;font-size:18px;cursor:pointer;padding:2px 6px;touch-action:manipulation;">😊</button>' +
        '<button onclick="addComment(\'' + pid + '\')" style="background:var(--gradient);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;touch-action:manipulation;"><i class="fa-solid fa-paper-plane"></i></button>' +
        '</div></div></div></div></div></div>';
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
        '<span onclick="likeComment(\'' + postId + '\',\'' + c.id + '\')" style="font-size:12px;cursor:pointer;font-weight:600;color:' + (cLiked?'var(--primary)':'var(--text-muted)') + ';">' + (cLiked?'❤️':'🤍') + ' ' + (cLikes.length>0?cLikes.length:'') + '</span>' +
        '<span onclick="toggleReplyInput(\'' + postId + '\',\'' + c.id + '\')" style="font-size:12px;cursor:pointer;font-weight:600;color:var(--text-muted);">↩ Responder</span>' +
        (c.authorUsername===u.username ? '<span onclick="deleteComment(\'' + postId + '\',\'' + c.id + '\')" style="font-size:12px;cursor:pointer;color:#ff4d4d;">Eliminar</span>' : '') +
        '</div></div></div>' +
        (replies.length>0 ? '<div style="margin-left:38px;">' + replies.map(function(r) {
            var ra = getUser(r.authorUsername) || { name:r.authorName, profilePic:'' };
            return '<div style="display:flex;gap:8px;margin-bottom:6px;"><div style="width:26px;height:26px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700;flex-shrink:0;overflow:hidden;">' + renderAvatar(ra, 26) + '</div><div style="flex:1;background:var(--bg-input);padding:7px 11px;border-radius:10px;"><strong style="font-size:12px;">' + r.authorName + '</strong><div style="font-size:12px;margin-top:1px;color:var(--text);">' + r.content + '</div></div></div>';
        }).join('') + '</div>' : '') +
        '<div id="reply-input-' + postId + '-' + c.id + '" style="display:none;margin-left:38px;margin-bottom:8px;">' +
        '<div style="display:flex;gap:6px;align-items:center;">' +
        '<input type="text" id="reply-text-' + postId + '-' + c.id + '" placeholder="Responder a ' + c.authorName + '..." style="flex:1;border:1.5px solid var(--border);border-radius:20px;padding:7px 13px;font-size:12px;background:var(--bg-input);color:var(--text);outline:none;font-family:inherit;" onkeydown="if(event.key===\'Enter\') submitReply(\'' + postId + '\',\'' + c.id + '\')">' +
        '<button onclick="submitReply(\'' + postId + '\',\'' + c.id + '\')" style="background:var(--gradient);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fa-solid fa-paper-plane"></i></button>' +
        '</div></div></div>';
}

// ── 12. ACCIONES DE POST ──────────────────────────────────
var reactionHideTimers = {};
window.showReactionBar = function(id) {
    clearTimeout(reactionHideTimers[id]);
    var bar = document.getElementById('reaction-bar-' + id); if (bar) bar.classList.add('visible');
};
window.scheduleHideReaction = function(id) {
    reactionHideTimers[id] = setTimeout(function() {
        var bar = document.getElementById('reaction-bar-' + id); if (bar) bar.classList.remove('visible');
    }, 400);
};
window.clearReactionHide = function(id) { clearTimeout(reactionHideTimers[id]); };

window.reactToPost = function(postId, emoji) {
    var post = socialDB.posts.find(function(p) { return (p._id||p.id) === postId; }); if (!post) return;
    var u = socialDB.currentUser;
    if (!post.reactions) post.reactions = {};
    ['❤️','😂','😮','😢','👏','🔥'].forEach(function(e) {
        if (!post.reactions[e]) post.reactions[e] = [];
        post.reactions[e] = post.reactions[e].filter(function(x) { return x !== u.username; });
    });
    if (!post.reactions[emoji]) post.reactions[emoji] = [];
    post.reactions[emoji].push(u.username);
    if (post.authorUsername !== u.username) addNotification(post.authorUsername, 'like', '<strong>' + u.name + '</strong> reaccionó ' + emoji + ' a tu publicación');
    saveDB(); renderPosts();
};

window.toggleLike = function(postId) {
    var post = socialDB.posts.find(function(p) { return (p._id||p.id) === postId; }); if (!post) return;
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
    var post = socialDB.posts.find(function(p) { return (p._id||p.id) === postId; }); if (!post) return;
    var u = socialDB.currentUser; if (!post.comments) post.comments = [];
    post.comments.push({ id:'c_'+Date.now()+Math.random(), authorUsername:u.username, authorName:u.name, content:input.value.trim(), likes:[], replies:[], createdAt:new Date().toISOString() });
    if (post.authorUsername !== u.username) addNotification(post.authorUsername, 'comment', '<strong>' + u.name + '</strong> comentó en tu publicación');
    saveDB(); renderPosts();
    setTimeout(function() { var el = document.getElementById('comments-' + postId); if (el) el.style.display = 'block'; }, 50);
};

window.likeComment = function(postId, commentId) {
    var post = socialDB.posts.find(function(p) { return (p._id||p.id) === postId; }); if (!post) return;
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
    var post = socialDB.posts.find(function(p) { return (p._id||p.id) === postId; }); if (!post) return;
    var c = (post.comments||[]).find(function(x) { return x.id === commentId; }); if (!c) return;
    var u = socialDB.currentUser; if (!c.replies) c.replies = [];
    c.replies.push({ id:'r_'+Date.now(), authorUsername:u.username, authorName:u.name, content:input.value.trim(), createdAt:new Date().toISOString() });
    if (c.authorUsername !== u.username) addNotification(c.authorUsername, 'comment', '<strong>' + u.name + '</strong> respondió a tu comentario');
    saveDB(); renderPosts();
    setTimeout(function() { var el = document.getElementById('comments-' + postId); if (el) el.style.display = 'block'; }, 50);
};

// ── FIX 2: Reaction & Comment bug fixes ─────────────────────
// The reaction bar needs to also handle touch (mobile)
window.showReactionBar = function(id) {
    clearTimeout(reactionHideTimers[id]);
    var bar = document.getElementById('reaction-bar-' + id);
    if (bar) { bar.classList.add('visible'); bar.style.pointerEvents = 'all'; }
};
window.scheduleHideReaction = function(id) {
    reactionHideTimers[id] = setTimeout(function() {
        var bar = document.getElementById('reaction-bar-' + id);
        if (bar) { bar.classList.remove('visible'); bar.style.pointerEvents = 'none'; }
    }, 400);
};
window.clearReactionHide = function(id) { clearTimeout(reactionHideTimers[id]); };

// Touch-friendly reaction bar toggle
window.toggleReactionBar = function(id) {
    var bar = document.getElementById('reaction-bar-' + id); if (!bar) return;
    if (bar.classList.contains('visible')) {
        bar.classList.remove('visible'); bar.style.pointerEvents='none';
    } else {
        clearTimeout(reactionHideTimers[id]);
        bar.classList.add('visible'); bar.style.pointerEvents='all';
        // Auto-hide on mobile after 3s
        reactionHideTimers[id] = setTimeout(function() { bar.classList.remove('visible'); bar.style.pointerEvents='none'; }, 3000);
    }
};

// ── FIX 3: Comment emoji picker ──────────────────────────────
var COMMENT_EMOJIS = ['😀','😂','😍','🥰','😎','🤔','😮','😢','😡','👍','👎','❤️','🔥','💯','🎉','👏','🙌','💪','🤣','😭','🥺','😊','🤩','😴','🤯','💀','🫶','✨','🌟','💫'];

window.toggleCommentEmoji = function(pid) {
    var picker = document.getElementById('emoji-picker-' + pid); if (!picker) return;
    picker.style.display = picker.style.display === 'none' ? 'flex' : 'none';
};
window.insertCommentEmoji = function(pid, emoji) {
    var inp = document.getElementById('comment-input-' + pid); if (!inp) return;
    var pos = inp.selectionStart || inp.value.length;
    inp.value = inp.value.slice(0, pos) + emoji + inp.value.slice(pos);
    inp.focus();
    var picker = document.getElementById('emoji-picker-' + pid);
    if (picker) picker.style.display = 'none';
};

// ── FIX 8: Stats panel views ─────────────────────────────────
window.viewMyPosts = function() {
    var u = socialDB.currentUser;
    var myPosts = socialDB.posts.filter(function(p) { return p.authorUsername === u.username; });
    var overlay = document.getElementById('shareModalOverlay'); if (!overlay) return;
    overlay.innerHTML =
        '<div style="background:var(--bg-card);border-radius:24px;width:94%;max-width:480px;max-height:88vh;overflow-y:auto;">' +
        '<div style="padding:16px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;position:sticky;top:0;background:var(--bg-card);z-index:10;border-radius:24px 24px 0 0;">' +
        '<button onclick="closeShareModal()" style="background:none;border:none;font-size:18px;color:var(--text-muted);cursor:pointer;padding:4px;"><i class="fa-solid fa-times"></i></button>' +
        '<h3 style="margin:0;font-size:16px;font-weight:700;background:var(--gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">Mis publicaciones</h3>' +
        '<span style="margin-left:auto;background:var(--gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:700;">' + myPosts.length + '</span></div>' +
        (myPosts.length === 0
            ? '<div style="padding:40px;text-align:center;color:var(--text-muted);">Aún no tienes publicaciones</div>'
            : '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px;padding:2px;">' +
              myPosts.map(function(p) {
                  return p.media
                      ? (p.mediaType==='video'
                          ? '<div style="aspect-ratio:1;background:#000;position:relative;cursor:pointer;" onclick="closeShareModal();openFullscreenPost(\''+( p._id||p.id)+'\')"><video src="'+p.media+'" style="width:100%;height:100%;object-fit:cover;display:block;"></video><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-play" style="color:#fff;font-size:20px;text-shadow:0 1px 4px rgba(0,0,0,.8);"></i></div></div>'
                          : '<img src="'+p.media+'" onclick="closeShareModal();openFullscreen(\''+p.media+'\')" style="width:100%;aspect-ratio:1;object-fit:cover;display:block;cursor:pointer;">')
                      : '<div style="aspect-ratio:1;background:var(--gradient);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:10px;" onclick="closeShareModal();openFullscreenPost(\''+(p._id||p.id)+'\')"><p style="color:#fff;font-size:11px;text-align:center;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;">'+p.content+'</p></div>';
              }).join('') + '</div>') +
        '</div>';
    overlay.style.display = 'flex';
    setTimeout(function() { overlay.classList.add('active'); }, 10);
};

window.viewFollowersList = function() {
    var u = socialDB.currentUser;
    _showUserList('Seguidores', u.followers || [], 'No tienes seguidores aún');
};
window.viewFollowingList = function() {
    var u = socialDB.currentUser;
    _showUserList('Seguidos', u.following || [], 'No sigues a nadie aún');
};
window.viewFriendsList = function() {
    var u = socialDB.currentUser;
    _showUserList('Amigos', u.friends || [], 'No tienes amigos aún');
};

function _showUserList(title, usernames, emptyMsg) {
    var overlay = document.getElementById('shareModalOverlay'); if (!overlay) return;
    var items = usernames.map(function(uname) {
        var person = getUser(uname) || { name: uname, username: uname, profilePic: '' };
        return '<div style="display:flex;align-items:center;gap:12px;padding:12px 18px;cursor:pointer;transition:background .2s;" onclick="closeShareModal();viewFriendProfile(\''+uname+'\')" onmouseenter="this.style.background=\'var(--bg-hover)\'" onmouseleave="this.style.background=\'\'">' +
            '<div style="width:44px;height:44px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">' + renderAvatar(person, 44) + '</div>' +
            '<div style="flex:1;"><div style="font-weight:600;font-size:14px;">'+person.name+'</div><div style="font-size:12px;color:var(--text-muted);">@'+uname+'</div></div>' +
            '<i class="fa-solid fa-chevron-right" style="color:var(--text-muted);font-size:12px;"></i></div>';
    });

    overlay.innerHTML =
        '<div style="background:var(--bg-card);border-radius:24px;width:92%;max-width:420px;max-height:85vh;overflow-y:auto;">' +
        '<div style="padding:16px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;position:sticky;top:0;background:var(--bg-card);z-index:10;border-radius:24px 24px 0 0;">' +
        '<button onclick="closeShareModal()" style="background:none;border:none;font-size:18px;color:var(--text-muted);cursor:pointer;padding:4px;"><i class="fa-solid fa-times"></i></button>' +
        '<h3 style="margin:0;font-size:16px;font-weight:700;background:var(--gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">'+title+'</h3>' +
        '<span style="margin-left:auto;background:var(--gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:700;">'+usernames.length+'</span></div>' +
        (items.length === 0 ? '<div style="padding:40px;text-align:center;color:var(--text-muted);">'+emptyMsg+'</div>' : items.join('')) +
        '<p class="close-text" onclick="closeShareModal()" style="text-align:center;padding:12px 0;">Cerrar</p></div>';
    overlay.style.display = 'flex';
    setTimeout(function() { overlay.classList.add('active'); }, 10);
}

window.deleteComment = function(postId, commentId) {
    var post = socialDB.posts.find(function(p) { return (p._id||p.id) === postId; }); if (!post) return;
    post.comments = (post.comments||[]).filter(function(c) { return c.id !== commentId; });
    saveDB(); renderPosts();
    setTimeout(function() { var el = document.getElementById('comments-' + postId); if (el) el.style.display = 'block'; }, 50);
};

window.deletePost = function(postId) {
    if (!confirm('¿Eliminar esta publicación?')) return;
    socialDB.posts = socialDB.posts.filter(function(p) { return (p._id||p.id) !== postId; });
    saveDB(); showToast('🗑️ Publicación eliminada'); renderPosts();
    var el = document.getElementById('statPosts'); if (el) el.textContent = socialDB.posts.filter(function(p) { return p.authorUsername === socialDB.currentUser.username; }).length;
};

window.editPost = function(postId) {
    var post = socialDB.posts.find(function(p) { return (p._id||p.id) === postId; }); if (!post) return;
    var newContent = prompt('Editar publicación:', post.content); if (newContent === null) return;
    post.content = newContent.trim(); post.editedAt = new Date().toISOString();
    saveDB(); showToast('✅ Actualizado'); renderPosts();
};

window.handleMedia = function(input, type) {
    if (!input.files || !input.files[0]) return;
    var file = input.files[0];
    var reader = new FileReader();
    reader.onload = function(e) {
        if (type === 'video') openPostVideoEditor(file);
        else openPostImageEditor(e.target.result);
    };
    reader.readAsDataURL(file);
};

window.openCameraCapture = function(mode) {
    var overlay = document.getElementById('reelEditorOverlay'); if (!overlay) return;
    overlay.innerHTML =
        '<div style="background:#000;width:100%;max-width:480px;max-height:94vh;border-radius:20px;overflow:hidden;display:flex;flex-direction:column;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:rgba(0,0,0,.6);backdrop-filter:blur(10px);flex-shrink:0;">' +
        '<button onclick="closeCameraCapture()" style="background:rgba(255,255,255,.15);border:none;color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;"><i class=\"fa-solid fa-times\"></i></button>' +
        '<span style="font-size:13px;font-weight:700;color:#fff;">' + (mode==="photo" ? "📸 TOMAR FOTO" : "🎥 GRABAR VIDEO") + '</span>' +
        '<button onclick="flipCamera()" style="background:rgba(255,255,255,.15);border:none;color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;"><i class=\"fa-solid fa-camera-rotate\"></i></button>' +
        '</div>' +
        '<div style="flex:1;background:#111;position:relative;min-height:280px;" id="camWrap">' +
        '<video id="camPreview" autoplay muted playsinline style="width:100%;height:100%;object-fit:cover;display:none;position:absolute;inset:0;"></video>' +
        '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;" id="camPlaceholder"><i class=\"fa-solid fa-video\" style=\"font-size:48px;color:rgba(255,255,255,.3);\"></i></div>' +
        (mode==="video" ? '<div id="recIndicator" style="display:none;position:absolute;top:12px;left:12px;background:#ff4d4d;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:10px;animation:recBlink 1s infinite;">⏺ REC</div>' : "") +
        '</div>' +
        '<div style="padding:16px 18px;background:#111;display:flex;gap:10px;justify-content:center;flex-shrink:0;">' +
        (mode==="photo"
            ? '<button onclick="capturePhoto()" style="width:64px;height:64px;border-radius:50%;border:4px solid #fff;background:rgba(255,255,255,.15);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:24px;touch-action:manipulation;">📸</button>'
            : '<button id="recBtn" onclick="startRecording()" style="width:64px;height:64px;border-radius:50%;border:4px solid #ff4d4d;background:rgba(255,77,77,.2);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:24px;touch-action:manipulation;">⏺</button>') +
        '</div></div>';
    overlay._camMode = mode;
    overlay._camFacing = "user";
    overlay.style.display = "flex";
    setTimeout(function() { overlay.classList.add("active"); _startCamera(overlay); }, 50);
};

function _startCamera(overlay) {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: overlay._camFacing || "user" }, audio: overlay._camMode === "video" })
    .then(function(stream) {
        overlay._camStream = stream;
        var vid = document.getElementById("camPreview");
        var ph  = document.getElementById("camPlaceholder");
        if (vid) { vid.srcObject = stream; vid.style.display = "block"; }
        if (ph)  ph.style.display = "none";
    })
    .catch(function() { showToast("⚠️ No se pudo acceder a la cámara"); });
}

window.flipCamera = function() {
    var overlay = document.getElementById("reelEditorOverlay"); if (!overlay) return;
    if (overlay._camStream) overlay._camStream.getTracks().forEach(function(t) { t.stop(); });
    overlay._camFacing = overlay._camFacing === "user" ? "environment" : "user";
    _startCamera(overlay);
};

window.capturePhoto = function() {
    var overlay = document.getElementById("reelEditorOverlay"); if (!overlay) return;
    var vid = document.getElementById("camPreview"); if (!vid) return;
    var canvas = document.createElement("canvas");
    canvas.width = vid.videoWidth || 640; canvas.height = vid.videoHeight || 480;
    canvas.getContext("2d").drawImage(vid, 0, 0, canvas.width, canvas.height);
    var imgData = canvas.toDataURL("image/jpeg", 0.92);
    if (overlay._camStream) overlay._camStream.getTracks().forEach(function(t) { t.stop(); });
    overlay.classList.remove("active");
    setTimeout(function() { overlay.style.display="none"; overlay.innerHTML=""; openPostImageEditor(imgData); }, 300);
};

var _mediaRecorder = null, _recChunks = [];
window.startRecording = function() {
    var overlay = document.getElementById("reelEditorOverlay"); if (!overlay || !overlay._camStream) return;
    _recChunks = [];
    _mediaRecorder = new MediaRecorder(overlay._camStream);
    _mediaRecorder.ondataavailable = function(e) { if (e.data.size > 0) _recChunks.push(e.data); };
    _mediaRecorder.onstop = function() {
        var blob = new Blob(_recChunks, { type: "video/webm" });
        var reader = new FileReader();
        reader.onload = function(ev) {
            socialDB.tempMedia = ev.target.result;
            socialDB.tempMediaType = "video";
            var box=document.getElementById("previewBox"); var img=document.getElementById("imgPrev"); var vid2=document.getElementById("videoPrev");
            if(box) box.style.display="block";
            if(img) img.style.display="none";
            if(vid2){ vid2.style.display="block"; vid2.src=ev.target.result; }
            showToast("🎥 Video grabado · Pulsa Publicar");
        };
        reader.readAsDataURL(blob);
    };
    _mediaRecorder.start();
    var btn=document.getElementById("recBtn"); var rec=document.getElementById("recIndicator");
    if(btn){btn.innerHTML="⏹";btn.style.background="rgba(255,77,77,.5)";btn.onclick=window.stopRecording;}
    if(rec) rec.style.display="block";
};
window.stopRecording = function() {
    if (_mediaRecorder && _mediaRecorder.state !== "inactive") _mediaRecorder.stop();
    var overlay = document.getElementById("reelEditorOverlay"); if (!overlay) return;
    if (overlay._camStream) overlay._camStream.getTracks().forEach(function(t) { t.stop(); });
    overlay.classList.remove("active");
    setTimeout(function() { overlay.style.display="none"; overlay.innerHTML=""; }, 300);
};
window.closeCameraCapture = function() {
    var overlay = document.getElementById("reelEditorOverlay"); if (!overlay) return;
    if (overlay._camStream) overlay._camStream.getTracks().forEach(function(t) { t.stop(); });
    overlay.classList.remove("active");
    setTimeout(function() { overlay.style.display="none"; overlay.innerHTML=""; }, 300);
};

window.openPostImageEditor = function(imgData) {
    var overlay = document.getElementById("reelEditorOverlay"); if (!overlay) return;
    var edit = { text:"", textColor:"#fff", fontSize:26, textX:50, textY:50, textStyle:0, filter:"none", overlayColor:"transparent", overlayOpacity:0, drawPaths:[], drawColor:"#ff4d4d", drawSize:4 };
    window._postImgEdit = edit;

    overlay.innerHTML =
        "<div style=\"background:#0a0a0a;width:100%;max-width:480px;max-height:94vh;border-radius:20px;overflow:hidden;display:flex;flex-direction:column;\">" +
        "<div style=\"display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(0,0,0,.5);backdrop-filter:blur(10px);flex-shrink:0;z-index:10;\">" +
        "<button onclick=\"closePostImageEditor()\" style=\"background:rgba(255,255,255,.15);border:none;color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;touch-action:manipulation;\"><i class=\"fa-solid fa-times\"></i></button>" +
        "<span style=\"font-size:13px;font-weight:700;color:#fff;letter-spacing:.5px;\">EDITAR FOTO</span>" +
        "<button onclick=\"confirmPostImageEdit()\" style=\"background:linear-gradient(135deg,#c639b8,#1e8ee9);border:none;color:#fff;padding:8px 18px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;touch-action:manipulation;\">Listo ✓</button>" +
        "</div>" +
        "<div style=\"flex:1;position:relative;overflow:hidden;background:#111;min-height:240px;\" id=\"postImgCanvasWrap\">" +
        "<img src=\"" + imgData + "\" id=\"postImgPreview\" style=\"position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block;\">" +
        "<div id=\"postImgFilterLayer\" style=\"position:absolute;inset:0;z-index:1;pointer-events:none;\"></div>" +
        "<canvas id=\"postImgCanvas\" style=\"position:absolute;inset:0;z-index:3;pointer-events:none;touch-action:none;\"></canvas>" +
        "<div id=\"postImgTextEl\" style=\"position:absolute;z-index:4;color:#fff;font-weight:800;text-align:center;text-shadow:0 2px 10px rgba(0,0,0,.7);cursor:grab;user-select:none;-webkit-user-select:none;touch-action:none;display:none;left:50%;top:50%;transform:translate(-50%,-50%);max-width:90%;word-break:break-word;padding:6px 12px;border-radius:10px;line-height:1.3;font-size:26px;\"></div>" +
        "</div>" +
        "<div style=\"background:#111;flex-shrink:0;\">" +
        "<div style=\"display:flex;border-bottom:1px solid rgba(255,255,255,.1);\">" +
        ["✏️ Texto","🎨 Filtro","🌈 Fondo","🖌️ Dibujar"].map(function(t,i) {
            return "<button id=\"pitab"+i+"\" onclick=\"piTab("+i+")\" style=\"flex:1;padding:10px 4px;background:none;border:none;color:"+(i===0?"#fff":"rgba(255,255,255,.45)")+";font-size:10px;font-weight:700;cursor:pointer;border-bottom:2px solid "+(i===0?"var(--primary)":"transparent")+";touch-action:manipulation;\">"+t+"</button>";
        }).join("") + "</div>" +
        "<div id=\"pipanel0\" style=\"padding:12px 14px;\">" +
        "<input type=\"text\" id=\"piTextInput\" placeholder=\"Texto en la foto...\" oninput=\"piUpdateText()\" style=\"width:100%;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:10px 14px;color:#fff;font-size:14px;outline:none;font-family:inherit;margin-bottom:8px;box-sizing:border-box;\">" +
        "<div style=\"display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;\">" +
        ["#ffffff","#000000","#ff4d4d","#ffd700","#4caf50","#1e8ee9","#c639b8","#ff9800","#ff69b4","#00ffff"].map(function(c) {
            return "<div onclick=\"piSetTextColor('"+c+"')\" style=\"width:24px;height:24px;border-radius:50%;background:"+c+";cursor:pointer;border:2px solid rgba(255,255,255,.3);touch-action:manipulation;\"></div>";
        }).join("") +
        "<input type=\"color\" value=\"#ffffff\" oninput=\"piSetTextColor(this.value)\" style=\"width:24px;height:24px;border-radius:50%;border:none;cursor:pointer;padding:0;\">" +
        "</div>" +
        "<div style=\"display:flex;gap:6px;flex-wrap:wrap;\">" +
        ["Sin fondo","Fondo oscuro","Fondo claro","Bordes","Neón"].map(function(s,i) {
            return "<button onclick=\"piSetTextStyle("+i+")\" style=\"padding:5px 10px;border-radius:15px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);color:#fff;font-size:11px;cursor:pointer;touch-action:manipulation;\">"+s+"</button>";
        }).join("") + "</div></div>" +
        "<div id=\"pipanel1\" style=\"display:none;padding:8px 14px;\"><div style=\"display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none;\">" +
        STORY_FILTERS.map(function(f) {
            return "<div onclick=\"piSetFilter('"+f.id+"','"+f.css+"')\" style=\"flex-shrink:0;text-align:center;cursor:pointer;touch-action:manipulation;\">" +
                "<div style=\"width:52px;height:78px;border-radius:8px;overflow:hidden;border:2px solid rgba(255,255,255,.2);margin-bottom:3px;\"><div style=\"width:100%;height:100%;background:linear-gradient(135deg,#c639b8,#1e8ee9);filter:"+f.css+";\"></div></div>" +
                "<span style=\"font-size:9px;color:rgba(255,255,255,.7);font-weight:600;\">"+f.label+"</span></div>";
        }).join("") + "</div></div>" +
        "<div id=\"pipanel2\" style=\"display:none;padding:10px 14px;\"><div style=\"display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;\">" +
        ["transparent","#000","#1a1a2e","#16213e","#c639b8","#1e8ee9","#ff4d4d","#ffd700","#4caf50","#fff"].map(function(c) {
            var bg = c==="transparent" ? "repeating-conic-gradient(#ccc 0% 25%, transparent 0% 50%) 0 0/10px 10px" : c;
            return "<div onclick=\"piSetOverlay('"+c+"')\" style=\"width:30px;height:30px;border-radius:8px;background:"+bg+";cursor:pointer;border:2px solid rgba(255,255,255,.3);touch-action:manipulation;\"></div>";
        }).join("") + "</div>" +
        "<span style=\"color:rgba(255,255,255,.7);font-size:11px;font-weight:600;\">OPACIDAD</span>" +
        "<input type=\"range\" min=\"0\" max=\"0.85\" step=\"0.05\" value=\"0\" id=\"piOverlayOpacity\" oninput=\"piUpdateOverlay()\" style=\"width:100%;margin-top:6px;accent-color:var(--primary);\"></div>" +
        "<div id=\"pipanel3\" style=\"display:none;padding:10px 14px;\">" +
        "<div style=\"display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;\">" +
        ["#ff4d4d","#fff","#ffd700","#4caf50","#1e8ee9","#c639b8","#000","#ff9800"].map(function(c) {
            return "<div onclick=\"piSetDrawColor('"+c+"')\" style=\"width:26px;height:26px;border-radius:50%;background:"+c+";cursor:pointer;border:2px solid rgba(255,255,255,.3);touch-action:manipulation;\"></div>";
        }).join("") + "</div>" +
        "<div style=\"display:flex;gap:8px;align-items:center;\">" +
        "<span style=\"color:rgba(255,255,255,.6);font-size:11px;\">GROSOR</span>" +
        "<input type=\"range\" min=\"2\" max=\"20\" value=\"4\" id=\"piDrawSize\" oninput=\"window._postImgEdit.drawSize=parseInt(this.value)\" style=\"flex:1;accent-color:var(--primary);\"></input>" +
        "<button onclick=\"piToggleDraw()\" id=\"piDrawBtn\" style=\"padding:7px 14px;border-radius:15px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);color:#fff;font-size:12px;cursor:pointer;touch-action:manipulation;\">🖌️ Activar</button>" +
        "<button onclick=\"piUndoDraw()\" style=\"padding:7px 12px;border-radius:15px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);color:#fff;font-size:12px;cursor:pointer;touch-action:manipulation;\">↩</button>" +
        "</div></div></div></div>";

    overlay._postImgData = imgData;
    overlay.style.display = "flex";
    setTimeout(function() {
        overlay.classList.add("active");
        var canvas = document.getElementById("postImgCanvas");
        var wrap   = document.getElementById("postImgCanvasWrap");
        if (canvas && wrap) { canvas.width=wrap.clientWidth||400; canvas.height=wrap.clientHeight||300; window._piCtx=canvas.getContext("2d"); }
        var textEl = document.getElementById("postImgTextEl");
        if (textEl && wrap) bindDragElement(textEl, wrap, function(px,py){ edit.textX=px; edit.textY=py; });
    }, 80);
};

window.piTab = function(idx) {
    for(var i=0;i<4;i++){ var p=document.getElementById("pipanel"+i); var t=document.getElementById("pitab"+i); if(p) p.style.display=i===idx?"block":"none"; if(t){t.style.color=i===idx?"#fff":"rgba(255,255,255,.45)"; t.style.borderBottom=i===idx?"2px solid var(--primary)":"2px solid transparent";} }
};
window.piUpdateText = function() {
    var inp=document.getElementById("piTextInput"); var el=document.getElementById("postImgTextEl"); var edit=window._postImgEdit; if(!inp||!el||!edit) return;
    edit.text=inp.value; el.textContent=inp.value; el.style.display=inp.value?"block":"none"; el.style.color=edit.textColor||"#fff"; el.style.fontSize=(edit.fontSize||26)+"px";
    studioApplyTextStyle(el, edit.textStyle||0);
};
window.piSetTextColor = function(c) { var el=document.getElementById("postImgTextEl"); if(el) el.style.color=c; var e=window._postImgEdit; if(e) e.textColor=c; };
window.piSetTextStyle = function(s) { var e=window._postImgEdit; if(e) e.textStyle=s; var el=document.getElementById("postImgTextEl"); if(el) studioApplyTextStyle(el,s); };
window.piSetFilter = function(id,css) { var img=document.getElementById("postImgPreview"); if(img) img.style.filter=css||"none"; var e=window._postImgEdit; if(e) e.filter=id; };
window.piSetOverlay = function(c) { var e=window._postImgEdit; if(e) e.overlayColor=c; piUpdateOverlay(); };
window.piUpdateOverlay = function() {
    var layer=document.getElementById("postImgFilterLayer"); var e=window._postImgEdit; if(!layer||!e) return;
    var sl=document.getElementById("piOverlayOpacity"); var opac=sl?parseFloat(sl.value):0; e.overlayOpacity=opac;
    if(e.overlayColor&&e.overlayColor!=="transparent"){layer.style.background=e.overlayColor;layer.style.opacity=opac;}else{layer.style.background="transparent";layer.style.opacity=0;}
};
window.piSetDrawColor = function(c) { var e=window._postImgEdit; if(e) e.drawColor=c; };
var _piDrawMode=false, _piDrawing=false, _piCurrentPath=null;
window.piToggleDraw = function() {
    var canvas=document.getElementById("postImgCanvas"); var btn=document.getElementById("piDrawBtn");
    _piDrawMode=!_piDrawMode; canvas.style.pointerEvents=_piDrawMode?"auto":"none"; canvas.style.cursor=_piDrawMode?"crosshair":"default";
    if(btn){btn.style.background=_piDrawMode?"var(--primary)":"rgba(255,255,255,.1)"; btn.textContent=_piDrawMode?"🛑 Parar":"🖌️ Activar";}
    if(_piDrawMode) _bindPiCanvasDraw();
};
function _bindPiCanvasDraw() {
    var canvas=document.getElementById("postImgCanvas"); if(!canvas) return;
    function getPos(e){ var r=canvas.getBoundingClientRect(); var s=e.touches?e.touches[0]:e; return{x:s.clientX-r.left,y:s.clientY-r.top}; }
    canvas.onmousedown=canvas.ontouchstart=function(e){ e.preventDefault(); _piDrawing=true; var p=getPos(e); var edit=window._postImgEdit||{}; _piCurrentPath={color:edit.drawColor||"#ff4d4d",size:edit.drawSize||4,points:[p]}; };
    canvas.onmousemove=canvas.ontouchmove=function(e){ if(!_piDrawing||!_piCurrentPath) return; e.preventDefault(); var p=getPos(e); _piCurrentPath.points.push(p); var ctx=window._piCtx; if(ctx){ctx.beginPath();ctx.strokeStyle=_piCurrentPath.color;ctx.lineWidth=_piCurrentPath.size;ctx.lineCap="round";ctx.lineJoin="round";var pts=_piCurrentPath.points;ctx.moveTo(pts[pts.length-2].x,pts[pts.length-2].y);ctx.lineTo(p.x,p.y);ctx.stroke();} };
    canvas.onmouseup=canvas.ontouchend=function(){ _piDrawing=false; if(_piCurrentPath&&_piCurrentPath.points.length>1){var e2=window._postImgEdit;if(e2){if(!e2.drawPaths)e2.drawPaths=[];e2.drawPaths.push(_piCurrentPath);}} _piCurrentPath=null; };
}
window.piUndoDraw = function() {
    var e=window._postImgEdit; if(!e||!e.drawPaths||!e.drawPaths.length) return; e.drawPaths.pop();
    var ctx=window._piCtx; var canvas=document.getElementById("postImgCanvas");
    if(ctx&&canvas){ctx.clearRect(0,0,canvas.width,canvas.height); studioRedrawPaths(e.drawPaths);}
};
window.confirmPostImageEdit = function() {
    var overlay=document.getElementById("reelEditorOverlay"); if(!overlay) return;
    var edit=window._postImgEdit||{}; var imgData=overlay._postImgData; if(!imgData) return;
    closePostImageEditor();
    composeStoryFrame({type:"image",data:imgData}, edit, function(composed){
        socialDB.tempMedia=composed; socialDB.tempMediaType="image"; socialDB.tempMediaFilter=edit.filter;
        var box=document.getElementById("previewBox"); var img=document.getElementById("imgPrev"); var vid=document.getElementById("videoPrev");
        if(box) box.style.display="block"; if(vid) vid.style.display="none";
        if(img){img.style.display="block"; img.src=composed;}
        showToast("✅ Imagen lista · Pulsa Publicar");
    });
};
window.closePostImageEditor = function() { var ov=document.getElementById("reelEditorOverlay"); if(!ov) return; ov.classList.remove("active"); setTimeout(function(){ov.style.display="none";ov.innerHTML="";},400); };

// ── En Directo: video only, multi-user, audience selector ────
window._liveAudience = "public";
window.openLiveStream = function() {
    var overlay = document.getElementById("reelEditorOverlay"); if (!overlay) return;
    overlay.innerHTML = _buildLiveSetupHTML();
    overlay._liveState = "setup";
    overlay._liveViewers = [];
    overlay._liveComments = [];
    overlay._liveFacing = "user";
    overlay.style.display = "flex";
    setTimeout(function() { overlay.classList.add("active"); }, 10);
};

function _buildLiveSetupHTML() {
    var u = socialDB.currentUser;
    return '<div style="background:#0a0a0a;width:100%;max-width:500px;max-height:96vh;border-radius:20px;overflow:hidden;display:flex;flex-direction:column;" id="liveBox">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:rgba(0,0,0,.5);backdrop-filter:blur(10px);flex-shrink:0;">' +
    '<button onclick="closeLiveStream()" style="background:rgba(255,255,255,.15);border:none;color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-times"></i></button>' +
    '<span style="font-size:14px;font-weight:800;background:linear-gradient(135deg,#ff4d4d,#c639b8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">EN DIRECTO</span>' +
    '<div style="width:36px;"></div></div>' +
    '<div style="padding:20px 20px 12px;display:flex;align-items:center;gap:12px;background:#111;">' +
    '<div style="width:52px;height:52px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">' + (u.profilePic ? '<img src="' + u.profilePic + '" style="width:100%;height:100%;object-fit:cover;">' : '<span style="color:#fff;font-weight:700;font-size:20px;">' + u.name[0] + '</span>') + '</div>' +
    '<div><div style="color:#fff;font-weight:700;font-size:15px;">' + u.name + '</div><div style="color:rgba(255,255,255,.5);font-size:12px;">@' + u.username + '</div></div>' +
    '<div style="margin-left:auto;background:#ff4d4d;color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:10px;">🔴 LIVE</div></div>' +
    '<div style="padding:0 20px 12px;background:#111;">' +
    '<input type="text" id="liveTitle" placeholder="Describe tu En Directo..." style="width:100%;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:10px 14px;color:#fff;font-size:14px;outline:none;font-family:inherit;box-sizing:border-box;"></div>' +
    '<div style="padding:0 20px 16px;background:#111;">' +
    '<p style="color:rgba(255,255,255,.6);font-size:12px;font-weight:600;margin:0 0 10px;">AUDIENCIA</p>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
    [['Público','🌍','public'],['Amigos','👥','friends'],['Solo yo','🔒','only_me']].map(function(a,i) {
        var isFirst = i===0;
        return '<button onclick="selectLiveAudience(\'' + a[2] + '\')" id="aud-' + a[2] + '" style="display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:20px;border:2px solid ' + (isFirst?'#c639b8':'rgba(255,255,255,.2)') + ';background:' + (isFirst?'rgba(198,57,184,.15)':'transparent') + ';color:#fff;font-size:13px;font-weight:600;cursor:pointer;touch-action:manipulation;font-family:inherit;">' + a[0] + ' ' + a[1] + '</button>';
    }).join('') + '</div></div>' +
    '<div style="flex:1;background:#000;position:relative;min-height:180px;" id="livePreviewWrap">' +
    '<video id="liveSetupVideo" autoplay muted playsinline style="width:100%;height:100%;object-fit:cover;display:none;position:absolute;inset:0;"></video>' +
    '<div id="liveSetupPh" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;"><i class="fa-solid fa-video" style="font-size:40px;color:rgba(255,255,255,.3);"></i><p style="color:rgba(255,255,255,.4);font-size:13px;margin:0;">Vista previa de cámara</p></div>' +
    '</div>' +
    '<div style="padding:16px 20px;background:#0a0a0a;display:flex;gap:10px;">' +
    '<button onclick="previewLiveCamera()" style="flex:1;padding:13px;border-radius:16px;border:1.5px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#fff;font-size:14px;font-weight:600;cursor:pointer;touch-action:manipulation;font-family:inherit;">📷 Vista previa</button>' +
    '<button onclick="goLive()" style="flex:2;padding:13px;border-radius:16px;border:none;background:linear-gradient(135deg,#ff4d4d,#c639b8);color:#fff;font-size:14px;font-weight:700;cursor:pointer;touch-action:manipulation;font-family:inherit;">🔴 Iniciar En Directo</button>' +
    '</div></div>';
}

window.selectLiveAudience = function(val) {
    window._liveAudience = val;
    ["public","friends","only_me"].forEach(function(a) {
        var btn=document.getElementById("aud-"+a); if(!btn) return;
        btn.style.border=a===val?"2px solid #c639b8":"2px solid rgba(255,255,255,.2)";
        btn.style.background=a===val?"rgba(198,57,184,.15)":"transparent";
    });
};

window.previewLiveCamera = function() {
    var overlay = document.getElementById("reelEditorOverlay"); if (!overlay) return;
    navigator.mediaDevices.getUserMedia({ video:{ facingMode: overlay._liveFacing||"user" }, audio:true })
    .then(function(stream) {
        overlay._liveStream=stream;
        var vid=document.getElementById("liveSetupVideo"); var ph=document.getElementById("liveSetupPh");
        if(vid){vid.srcObject=stream; vid.style.display="block";} if(ph) ph.style.display="none";
        showToast("✅ Cámara lista");
    }).catch(function(){showToast("⚠️ No se pudo acceder a la cámara");});
};

window.goLive = function() {
    var overlay = document.getElementById("reelEditorOverlay"); if (!overlay) return;
    var title = (document.getElementById("liveTitle")||{}).value || "En Directo";
    overlay._liveTitle=title; overlay._liveState="live"; overlay._liveStartTime=Date.now();
    var startFn = function(stream) {
        overlay._liveStream=stream;
        _renderLiveScreen(overlay, title, stream);
        var friends=socialDB.currentUser.friends||[];
        var delay=2000;
        friends.slice(0,5).forEach(function(fn){
            setTimeout(function(){
                var p=getUser(fn)||{name:fn,username:fn};
                _addLiveComment(p.name,"__joined__","👋 "+p.name+" se unió");
                overlay._liveViewers.push(fn);
                var vc=document.getElementById("liveViewerCount"); if(vc) vc.textContent=overlay._liveViewers.length+" viendo";
            }, delay);
            delay += Math.random()*3000+1000;
        });
    };
    if(overlay._liveStream) startFn(overlay._liveStream);
    else navigator.mediaDevices.getUserMedia({video:{facingMode:overlay._liveFacing||"user"},audio:true}).then(startFn).catch(function(){showToast("⚠️ No se pudo acceder a la cámara");});
};

function _renderLiveScreen(overlay, title, stream) {
    var box=document.getElementById("liveBox"); if(!box) return;
    box.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:rgba(0,0,0,.7);backdrop-filter:blur(10px);flex-shrink:0;z-index:20;">' +
    '<div style="display:flex;align-items:center;gap:8px;">' +
    '<span style="background:#ff4d4d;color:#fff;font-size:11px;font-weight:700;padding:3px 9px;border-radius:8px;animation:recBlink 1.2s infinite;">🔴 DIRECTO</span>' +
    '<span id="liveViewerCount" style="color:rgba(255,255,255,.8);font-size:12px;">0 viendo</span>' +
    '<span id="liveDuration" style="color:rgba(255,255,255,.6);font-size:12px;margin-left:4px;"></span></div>' +
    '<div style="display:flex;gap:8px;">' +
    '<button onclick="flipLiveCam()" style="background:rgba(255,255,255,.15);border:none;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;touch-action:manipulation;"><i class="fa-solid fa-camera-rotate"></i></button>' +
    '<button onclick="endLive()" style="background:#ff4d4d;border:none;color:#fff;padding:6px 14px;border-radius:12px;font-size:12px;font-weight:700;cursor:pointer;touch-action:manipulation;">Terminar</button>' +
    '</div></div>' +
    '<div style="flex:1;position:relative;background:#000;overflow:hidden;" id="liveVideoContainer">' +
    '<video id="liveVideo" autoplay muted playsinline style="width:100%;height:100%;object-fit:cover;display:block;"></video>' +
    '<div id="liveFloatReactions" style="position:absolute;right:12px;bottom:130px;display:flex;flex-direction:column;align-items:flex-end;gap:4px;pointer-events:none;z-index:10;max-height:180px;overflow:hidden;"></div>' +
    '<div id="liveCommentsOverlay" style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top, rgba(0,0,0,.8) 0%, transparent 100%);padding:10px 12px;max-height:150px;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;gap:3px;pointer-events:none;z-index:9;"></div>' +
    '<div style="position:absolute;top:10px;left:12px;right:60px;pointer-events:none;z-index:8;"><p style="color:#fff;font-weight:700;font-size:13px;text-shadow:0 1px 4px rgba(0,0,0,.8);margin:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">' + title + '</p></div>' +
    '</div>' +
    '<div style="padding:10px 12px;background:#0d0d0d;flex-shrink:0;">' +
    '<div style="display:flex;gap:8px;margin-bottom:10px;">' +
    ["❤️","😂","😮","👏","🔥","🥰"].map(function(e){ return '<button onclick="sendLiveReaction(\\\''+ e +'\\\')" style="font-size:22px;background:rgba(255,255,255,.1);border:none;border-radius:50%;width:40px;height:40px;cursor:pointer;touch-action:manipulation;display:flex;align-items:center;justify-content:center;">' + e + '</button>'; }).join("") + '</div>' +
    '<div style="display:flex;gap:8px;align-items:center;">' +
    '<input id="liveCommentInput" type="text" placeholder="Comenta en el directo..." style="flex:1;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:20px;padding:9px 14px;color:#fff;font-size:13px;outline:none;font-family:inherit;" onkeydown="if(event.key===\'Enter\')sendLiveComment()">' +
    '<button onclick="sendLiveComment()" style="background:linear-gradient(135deg,#c639b8,#1e8ee9);border:none;color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;touch-action:manipulation;"><i class="fa-solid fa-paper-plane"></i></button>' +
    '</div></div>';
    var vid=document.getElementById("liveVideo"); if(vid) vid.srcObject=stream;
    overlay._liveTimer=setInterval(function(){
        var el=document.getElementById("liveDuration"); if(!el) return;
        var s2=Math.floor((Date.now()-overlay._liveStartTime)/1000);
        var m=Math.floor(s2/60),s=s2%60; el.textContent=(m<10?"0":"")+m+":"+(s<10?"0":"")+s;
    },1000);
}

window.sendLiveReaction = function(emoji) {
    var overlay=document.getElementById("reelEditorOverlay"); if(!overlay) return;
    _addLiveComment(socialDB.currentUser.name,"reaction",emoji);
    var c=document.getElementById("liveFloatReactions"); if(!c) return;
    var el=document.createElement("div"); el.textContent=emoji;
    el.style.cssText="font-size:28px;animation:floatUp 2.5s ease-out forwards;opacity:1;";
    c.appendChild(el); setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el);},2600);
};
window.sendLiveComment = function() {
    var inp=document.getElementById("liveCommentInput"); if(!inp||!inp.value.trim()) return;
    _addLiveComment(socialDB.currentUser.name,"comment",inp.value.trim()); inp.value="";
};
function _addLiveComment(name,type,text) {
    var c=document.getElementById("liveCommentsOverlay"); if(!c) return;
    var el=document.createElement("div"); el.style.cssText="display:flex;align-items:flex-start;gap:6px;animation:fadeInUp .3s ease;";
    el.innerHTML=type!=="__joined__"
        ? '<span style="font-size:12px;font-weight:700;color:#c639b8;white-space:nowrap;">'+name+'</span><span style="font-size:12px;color:#fff;">'+text+'</span>'
        : '<span style="font-size:11px;color:rgba(255,255,255,.5);font-style:italic;">'+text+'</span>';
    c.appendChild(el);
    while(c.children.length>6) c.removeChild(c.firstChild);
}
window.flipLiveCam = function() {
    var overlay=document.getElementById("reelEditorOverlay"); if(!overlay) return;
    if(overlay._liveStream) overlay._liveStream.getTracks().forEach(function(t){t.stop();});
    overlay._liveFacing=overlay._liveFacing==="user"?"environment":"user";
    navigator.mediaDevices.getUserMedia({video:{facingMode:overlay._liveFacing},audio:true})
    .then(function(s){overlay._liveStream=s; var v=document.getElementById("liveVideo"); if(v) v.srcObject=s;});
};
window.endLive = function() {
    var overlay=document.getElementById("reelEditorOverlay"); if(!overlay) return;
    clearInterval(overlay._liveTimer);
    if(overlay._liveStream) overlay._liveStream.getTracks().forEach(function(t){t.stop();});
    var dur=overlay._liveStartTime?Math.floor((Date.now()-overlay._liveStartTime)/1000):0;
    var m=Math.floor(dur/60),s=dur%60;
    showToast("📺 Directo terminado · "+(m<10?"0":"")+m+":"+(s<10?"0":"")+s);
    overlay.classList.remove("active"); setTimeout(function(){overlay.style.display="none";overlay.innerHTML="";},400);
};
window.closeLiveStream = function() {
    var overlay=document.getElementById("reelEditorOverlay"); if(!overlay) return;
    clearInterval(overlay._liveTimer);
    if(overlay._liveStream) overlay._liveStream.getTracks().forEach(function(t){t.stop();});
    overlay.classList.remove("active"); setTimeout(function(){overlay.style.display="none";overlay.innerHTML="";},400);
};


// Editor de video antes de publicar un post
window.openPostVideoEditor = function(file) {
    var overlay = document.getElementById('reelEditorOverlay'); if (!overlay) return;
    var objUrl = URL.createObjectURL(file);

    // Estado interno del editor
    var editorState = {
        textVal: '', textColor: '#ffffff', textSize: 22,
        textX: 50, textY: 50,          // % posición
        dragging: false, dragOX: 0, dragOY: 0,
        musicMode: 'preset',           // 'preset' | 'file'
        musicFileB64: null, musicFileName: '',
        musicAudio: null,              // Audio() para preview
        musicVol: 0.5
    };

    overlay.innerHTML =
        '<div class="reel-editor-box" style="max-width:500px;">' +
        // Cabecera
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">' +
        '<button onclick="closePostVideoEditor()" style="background:none;border:none;font-size:20px;color:var(--text-muted);cursor:pointer;padding:4px;"><i class="fa-solid fa-arrow-left"></i></button>' +
        '<h2 style="margin:0;font-size:18px;background:var(--gradient);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">Editar video</h2></div>' +

        // Preview del video con texto arrastrable
        '<div class="reel-editor-preview" id="postEditorPreview" style="max-height:260px;position:relative;overflow:hidden;border-radius:14px;background:#000;aspect-ratio:auto;">' +
        '<video id="postVidPreview" src="' + objUrl + '" controls style="width:100%;max-height:260px;object-fit:contain;display:block;"></video>' +
        '<div id="postVidTextOverlay" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:22px;font-weight:800;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.7);text-align:center;cursor:grab;user-select:none;max-width:90%;word-break:break-word;white-space:pre-wrap;padding:4px 8px;border-radius:6px;touch-action:none;display:none;"></div>' +
        '</div>' +

        // Controles en tabs
        '<div style="display:flex;border-bottom:1px solid var(--border);margin:16px 0 14px;gap:4px;">' +
        '<button id="edTab-text" onclick="editorTab(\'text\')" style="flex:1;padding:8px 0;border:none;border-bottom:2px solid var(--primary);background:none;color:var(--primary);font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;"><i class="fa-solid fa-font" style="margin-right:5px;"></i>Texto</button>' +
        '<button id="edTab-music" onclick="editorTab(\'music\')" style="flex:1;padding:8px 0;border:none;border-bottom:2px solid transparent;background:none;color:var(--text-muted);font-weight:600;font-size:13px;cursor:pointer;font-family:inherit;"><i class="fa-solid fa-music" style="margin-right:5px;"></i>Música</button>' +
        '</div>' +

        // Panel TEXTO
        '<div id="edPanel-text">' +
        '<div class="editor-label" style="margin-bottom:8px;">Escribe y arrastra el texto sobre el video</div>' +
        '<input type="text" class="editor-input" id="postVidText" placeholder="Tu texto aquí..." oninput="updateEditorText()" style="margin-bottom:12px;">' +
        '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">' +
        // Color
        '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;">' +
        '<span style="font-size:11px;color:var(--text-muted);font-weight:600;">COLOR</span>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;max-width:200px;">' +
        ['#ffffff','#000000','#ff4d4d','#ffd700','#4caf50','#1e8ee9','#c639b8','#ff9800','#00bcd4','#e91e63'].map(function(c) {
            return '<div onclick="setEditorTextColor(\'' + c + '\')" style="width:26px;height:26px;border-radius:50%;background:' + c + ';cursor:pointer;border:2px solid ' + (c==='#ffffff'?'#ccc':'transparent') + ';transition:transform .15s;" id="ecol-' + c.replace('#','') + '"></div>';
        }).join('') +
        '<input type="color" id="postVidColorPicker" value="#ffffff" oninput="setEditorTextColor(this.value)" style="width:26px;height:26px;border-radius:50%;border:none;cursor:pointer;padding:0;overflow:hidden;" title="Color personalizado">' +
        '</div></div>' +
        // Tamaño
        '<div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:120px;">' +
        '<span style="font-size:11px;color:var(--text-muted);font-weight:600;">TAMAÑO</span>' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
        '<span style="font-size:12px;color:var(--text-muted);">A</span>' +
        '<input type="range" min="12" max="48" value="22" id="postVidFontSize" oninput="updateEditorText()" style="flex:1;">' +
        '<span style="font-size:18px;font-weight:700;color:var(--text-muted);">A</span>' +
        '</div></div>' +
        '</div>' +
        '<div style="font-size:12px;color:var(--text-muted);margin-top:10px;display:flex;align-items:center;gap:6px;"><i class="fa-solid fa-hand-pointer"></i> Arrastra el texto en el video para reposicionarlo</div>' +
        '</div>' +

        // Panel MÚSICA
        '<div id="edPanel-music" style="display:none;">' +
        // Switch preset / archivo
        '<div style="display:flex;gap:8px;margin-bottom:14px;">' +
        '<button id="modeBtn-preset" onclick="setMusicMode(\'preset\')" style="flex:1;padding:8px;border-radius:20px;border:none;background:var(--gradient);color:#fff;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;">🎵 Predefinida</button>' +
        '<button id="modeBtn-file"   onclick="setMusicMode(\'file\')"   style="flex:1;padding:8px;border-radius:20px;border:1.5px solid var(--border);background:none;color:var(--text-secondary);font-weight:600;font-size:13px;cursor:pointer;font-family:inherit;">📁 Mi música</button>' +
        '</div>' +
        // Panel preset
        '<div id="musicPresetPanel">' +
        '<select class="editor-input" id="postVidMusic" onchange="previewMusicChange()" style="margin-bottom:10px;">' +
        '<option value="">Sin música</option>' +
        MUSIC_TRACKS.map(function(t,i) { return '<option value="' + t.title + '" data-idx="' + i + '">' + t.title + '</option>'; }).join('') +
        '</select>' +
        '<div style="font-size:12px;color:var(--text-muted);background:var(--bg-input);border-radius:10px;padding:10px 12px;"><i class="fa-solid fa-circle-info" style="margin-right:6px;color:var(--primary);"></i>La música de fondo se mostrará como título en el reel. Se reproduce junto a tu video.</div>' +
        '</div>' +
        // Panel archivo
        '<div id="musicFilePanel" style="display:none;">' +
        '<label class="btn-outline" style="width:100%;justify-content:center;cursor:pointer;margin-bottom:12px;" id="musicFileLabel">' +
        '<i class="fa-solid fa-folder-open" style="color:var(--primary);margin-right:8px;"></i>Seleccionar canción' +
        '<input type="file" hidden accept="audio/*" onchange="loadMusicFile(this)">' +
        '</label>' +
        '<div id="musicFileInfo" style="display:none;background:var(--bg-input);border-radius:12px;padding:12px;">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
        '<div style="width:36px;height:36px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;flex-shrink:0;"><i class="fa-solid fa-music"></i></div>' +
        '<div style="flex:1;overflow:hidden;"><div id="musicFileName" style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div><div id="musicFileDuration" style="font-size:11px;color:var(--text-muted);"></div></div>' +
        '</div>' +
        // Controles audio
        '<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;">' +
        '<button id="musicPlayBtn" onclick="toggleMusicPreview()" style="width:36px;height:36px;border-radius:50%;background:var(--gradient);border:none;color:#fff;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fa-solid fa-play" id="musicPlayIcon"></i></button>' +
        '<input type="range" id="musicSeekBar" min="0" max="100" value="0" oninput="seekMusic(this.value)" style="flex:1;">' +
        '<span id="musicTimeLabel" style="font-size:11px;color:var(--text-muted);min-width:36px;text-align:right;">0:00</span>' +
        '</div>' +
        // Recorte (start / end)
        '<div style="margin-bottom:8px;">' +
        '<div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:6px;">RECORTAR (inicio – fin)</div>' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
        '<span style="font-size:12px;color:var(--text-muted);width:28px;">▶</span>' +
        '<input type="range" id="musicStartBar" min="0" max="100" value="0" oninput="updateMusicTrim()" style="flex:1;">' +
        '<span id="musicStartLabel" style="font-size:11px;color:var(--text-muted);min-width:36px;">0:00</span>' +
        '</div>' +
        '<div style="display:flex;gap:8px;align-items:center;margin-top:6px;">' +
        '<span style="font-size:12px;color:var(--text-muted);width:28px;">⏹</span>' +
        '<input type="range" id="musicEndBar" min="0" max="100" value="100" oninput="updateMusicTrim()" style="flex:1;">' +
        '<span id="musicEndLabel" style="font-size:11px;color:var(--text-muted);min-width:36px;">-</span>' +
        '</div></div></div></div>' +
        // Volumen (compartido)
        '<div style="margin-top:12px;">' +
        '<div class="editor-label" style="margin-bottom:6px;"><i class="fa-solid fa-volume-high" style="color:var(--primary);margin-right:6px;"></i>Volumen música</div>' +
        '<div class="volume-control"><i class="fa-solid fa-volume-low"></i><input type="range" min="0" max="1" step="0.05" value="0.5" id="postVidVol" oninput="updateMusicVol(this)"><i class="fa-solid fa-volume-high"></i>' +
        '<span id="postVidVolLabel" style="font-size:12px;color:var(--text-muted);margin-left:6px;">50%</span></div>' +
        '</div></div>' +

        // Botones finales
        '<div style="display:flex;gap:10px;margin-top:20px;">' +
        '<button class="btn-outline" onclick="closePostVideoEditor()" style="flex:1;">Cancelar</button>' +
        '<button class="btn-join" onclick="confirmPostVideo()" style="flex:1;"><i class="fa-solid fa-check"></i> Listo</button>' +
        '</div></div>';

    overlay._postVidFile  = file;
    overlay._postVidObjUrl = objUrl;
    overlay._editorState  = editorState;

    // Inicializar lógica tras render
    setTimeout(function() {
        var vid = document.getElementById('postVidPreview');
        if (!vid) return;
        vid.onloadedmetadata = function() {
            if (vid.duration > 60) { showToast('⚠️ El video no puede superar 1 minuto'); closePostVideoEditor(); }
        };

        // Drag del texto superpuesto
        var textEl  = document.getElementById('postVidTextOverlay');
        var preview = document.getElementById('postEditorPreview');
        if (textEl && preview) {
            function startDrag(cx, cy) {
                editorState.dragging = true;
                var rect = preview.getBoundingClientRect();
                editorState.dragOX = cx - rect.left - (editorState.textX / 100 * rect.width);
                editorState.dragOY = cy - rect.top  - (editorState.textY / 100 * rect.height);
                textEl.style.cursor = 'grabbing';
            }
            function moveDrag(cx, cy) {
                if (!editorState.dragging) return;
                var rect = preview.getBoundingClientRect();
                var nx = (cx - rect.left - editorState.dragOX) / rect.width  * 100;
                var ny = (cy - rect.top  - editorState.dragOY) / rect.height * 100;
                editorState.textX = Math.max(5, Math.min(95, nx));
                editorState.textY = Math.max(5, Math.min(95, ny));
                textEl.style.left = editorState.textX + '%';
                textEl.style.top  = editorState.textY + '%';
            }
            function endDrag() { editorState.dragging = false; textEl.style.cursor = 'grab'; }
            textEl.addEventListener('mousedown',  function(e) { e.preventDefault(); startDrag(e.clientX, e.clientY); });
            document.addEventListener('mousemove', function(e) { moveDrag(e.clientX, e.clientY); });
            document.addEventListener('mouseup',   endDrag);
            textEl.addEventListener('touchstart',  function(e) { e.preventDefault(); startDrag(e.touches[0].clientX, e.touches[0].clientY); }, { passive:false });
            document.addEventListener('touchmove',  function(e) { if(editorState.dragging){ e.preventDefault(); moveDrag(e.touches[0].clientX, e.touches[0].clientY); } }, { passive:false });
            document.addEventListener('touchend',   endDrag);
        }
    }, 80);

    overlay.style.display = 'flex';
    setTimeout(function() { overlay.classList.add('active'); }, 10);
};

// Funciones del editor de video ─────────────────────────
window.editorTab = function(tab) {
    ['text','music'].forEach(function(t) {
        var panel = document.getElementById('edPanel-'+t);
        var btn   = document.getElementById('edTab-'+t);
        if (!panel||!btn) return;
        var active = t === tab;
        panel.style.display = active ? 'block' : 'none';
        btn.style.borderBottom = active ? '2px solid var(--primary)' : '2px solid transparent';
        btn.style.color = active ? 'var(--primary)' : 'var(--text-muted)';
        btn.style.fontWeight = active ? '700' : '600';
    });
};

window.updateEditorText = function() {
    var ov = document.getElementById('reelEditorOverlay'); if (!ov) return;
    var st  = ov._editorState; if (!st) return;
    var inp = document.getElementById('postVidText');
    var sizeSlider = document.getElementById('postVidFontSize');
    var el  = document.getElementById('postVidTextOverlay'); if (!el) return;
    st.textVal  = inp ? inp.value : st.textVal;
    st.textSize = sizeSlider ? parseInt(sizeSlider.value) : st.textSize;
    el.textContent = st.textVal;
    el.style.fontSize  = st.textSize + 'px';
    el.style.color     = st.textColor;
    el.style.display   = st.textVal ? 'block' : 'none';
    el.style.left = st.textX + '%';
    el.style.top  = st.textY + '%';
};

window.setEditorTextColor = function(color) {
    var ov = document.getElementById('reelEditorOverlay'); if (!ov) return;
    var st = ov._editorState; if (!st) return;
    st.textColor = color;
    var el = document.getElementById('postVidTextOverlay'); if (el) el.style.color = color;
    // Visual feedback en los chips de color
    document.querySelectorAll('[id^="ecol-"]').forEach(function(d) { d.style.border = '2px solid transparent'; });
    var chip = document.getElementById('ecol-' + color.replace('#',''));
    if (chip) chip.style.border = '2px solid var(--primary)';
    var picker = document.getElementById('postVidColorPicker'); if (picker) picker.value = color;
};

window.setMusicMode = function(mode) {
    var ov = document.getElementById('reelEditorOverlay'); if (!ov) return;
    ov._editorState.musicMode = mode;
    document.getElementById('musicPresetPanel').style.display = mode==='preset' ? 'block' : 'none';
    document.getElementById('musicFilePanel').style.display   = mode==='file'   ? 'block' : 'none';
    var preBtn = document.getElementById('modeBtn-preset');
    var filBtn = document.getElementById('modeBtn-file');
    if (preBtn) { preBtn.style.background = mode==='preset' ? 'var(--gradient)' : 'none'; preBtn.style.color = mode==='preset'?'#fff':'var(--text-secondary)'; preBtn.style.border = mode==='preset'?'none':'1.5px solid var(--border)'; }
    if (filBtn) { filBtn.style.background = mode==='file'   ? 'var(--gradient)' : 'none'; filBtn.style.color = mode==='file'  ?'#fff':'var(--text-secondary)'; filBtn.style.border = mode==='file'  ?'none':'1.5px solid var(--border)'; }
};

window.loadMusicFile = function(input) {
    if (!input.files[0]) return;
    var file = input.files[0];
    var ov   = document.getElementById('reelEditorOverlay'); if (!ov) return;
    var st   = ov._editorState;

    // Parar audio previo
    if (st.musicAudio) { st.musicAudio.pause(); st.musicAudio = null; }

    var reader = new FileReader();
    reader.onload = function(e) {
        st.musicFileB64  = e.target.result;
        st.musicFileName = file.name.replace(/\.[^.]+$/, '');

        var audio = new Audio(e.target.result);
        st.musicAudio = audio;
        audio.volume  = st.musicVol;

        audio.addEventListener('loadedmetadata', function() {
            var dur = audio.duration;
            var end = document.getElementById('musicEndBar');
            var endLbl = document.getElementById('musicEndLabel');
            if (end) { end.max = dur; end.value = dur; }
            if (endLbl) endLbl.textContent = formatTime(dur);
            var startBar = document.getElementById('musicStartBar');
            if (startBar) { startBar.max = dur; startBar.value = 0; }
            var durEl = document.getElementById('musicFileDuration');
            if (durEl) durEl.textContent = formatTime(dur);
        });

        audio.addEventListener('timeupdate', function() {
            var seek = document.getElementById('musicSeekBar');
            var lbl  = document.getElementById('musicTimeLabel');
            if (seek) { seek.max = audio.duration||100; seek.value = audio.currentTime; }
            if (lbl)  lbl.textContent = formatTime(audio.currentTime);
            // Parar en el punto de corte
            var endBar = document.getElementById('musicEndBar');
            if (endBar && audio.currentTime >= parseFloat(endBar.value)) audio.pause();
        });

        audio.addEventListener('ended', function() {
            var icon = document.getElementById('musicPlayIcon');
            if (icon) icon.className = 'fa-solid fa-play';
        });
        audio.addEventListener('pause', function() {
            var icon = document.getElementById('musicPlayIcon');
            if (icon) icon.className = 'fa-solid fa-play';
        });
        audio.addEventListener('play', function() {
            var icon = document.getElementById('musicPlayIcon');
            if (icon) icon.className = 'fa-solid fa-pause';
        });

        // Mostrar info
        var nameEl = document.getElementById('musicFileName');
        if (nameEl) nameEl.textContent = st.musicFileName;
        document.getElementById('musicFileInfo').style.display = 'block';
        document.getElementById('musicFileLabel').style.display = 'none';
    };
    reader.readAsDataURL(file);
};

window.toggleMusicPreview = function() {
    var ov = document.getElementById('reelEditorOverlay'); if (!ov) return;
    var audio = ov._editorState.musicAudio; if (!audio) return;
    if (audio.paused) {
        var startBar = document.getElementById('musicStartBar');
        if (startBar && audio.currentTime < parseFloat(startBar.value)) audio.currentTime = parseFloat(startBar.value);
        audio.play();
    } else {
        audio.pause();
    }
};

window.seekMusic = function(val) {
    var ov = document.getElementById('reelEditorOverlay'); if (!ov) return;
    var audio = ov._editorState.musicAudio; if (!audio) return;
    audio.currentTime = parseFloat(val);
};

window.updateMusicTrim = function() {
    var startBar  = document.getElementById('musicStartBar');
    var endBar    = document.getElementById('musicEndBar');
    var startLbl  = document.getElementById('musicStartLabel');
    var endLbl    = document.getElementById('musicEndLabel');
    if (startBar && startLbl) startLbl.textContent = formatTime(parseFloat(startBar.value));
    if (endBar   && endLbl)   endLbl.textContent   = formatTime(parseFloat(endBar.value));
    // Asegurar start < end
    if (startBar && endBar && parseFloat(startBar.value) >= parseFloat(endBar.value)) {
        endBar.value = Math.min(parseFloat(endBar.max), parseFloat(startBar.value) + 1);
        if (endLbl) endLbl.textContent = formatTime(parseFloat(endBar.value));
    }
};

window.updateMusicVol = function(slider) {
    var ov  = document.getElementById('reelEditorOverlay'); if (!ov) return;
    var st  = ov._editorState;
    var val = parseFloat(slider.value);
    st.musicVol = val;
    if (st.musicAudio) st.musicAudio.volume = val;
    var lbl = document.getElementById('postVidVolLabel');
    if (lbl) lbl.textContent = Math.round(val*100) + '%';
};

window.previewMusicChange = function() {
    // No hay preview para tracks predefinidos (solo título)
};

function formatTime(s) {
    if (!s || isNaN(s)) return '0:00';
    var m = Math.floor(s/60), sec = Math.floor(s%60);
    return m + ':' + (sec<10?'0':'') + sec;
}

window.confirmPostVideo = function() {
    var overlay = document.getElementById('reelEditorOverlay'); if (!overlay) return;
    var file = overlay._postVidFile; if (!file) return;
    var st   = overlay._editorState || {};

    // Parar audio si estaba reproduciendo
    if (st.musicAudio) { st.musicAudio.pause(); }

    // Sincronizar todos los valores desde el DOM al estado antes de leer
    var textInput     = document.getElementById('postVidText');
    var sizeSlider    = document.getElementById('postVidFontSize');
    if (textInput)  st.textVal  = textInput.value || '';
    if (sizeSlider) st.textSize = parseInt(sizeSlider.value) || 22;

    // Leer valores finales del estado (ya sincronizados)
    var text      = st.textVal   || '';
    var textColor = st.textColor || '#ffffff';
    var textSize  = st.textSize  || 22;
    var textX     = (st.textX !== undefined && st.textX !== null) ? st.textX : 50;
    var textY     = (st.textY !== undefined && st.textY !== null) ? st.textY : 50;

    // Música: preset o archivo
    var musicMode  = st.musicMode || 'preset';
    var musicTitle = '';
    var musicB64   = null;
    var musicStart = 0;
    var musicEnd   = null;
    var musicVol   = (st.musicVol !== undefined) ? st.musicVol : 0.5;

    if (musicMode === 'preset') {
        var sel = document.getElementById('postVidMusic');
        musicTitle = sel ? sel.value : '';
    } else {
        musicTitle = st.musicFileName || '';
        musicB64   = st.musicFileB64  || null;
        var startBar = document.getElementById('musicStartBar');
        var endBar   = document.getElementById('musicEndBar');
        musicStart = startBar ? (parseFloat(startBar.value)||0) : 0;
        musicEnd   = endBar   ? (parseFloat(endBar.value)||null) : null;
    }

    showToast('⏳ Procesando video...');
    var reader = new FileReader();
    reader.onload = function(e) {
        socialDB.tempMedia           = e.target.result;
        socialDB.tempMediaType       = 'video';
        socialDB.tempVideoText       = text;
        socialDB.tempVideoColor      = textColor;
        socialDB.tempVideoSize       = textSize;
        socialDB.tempVideoTextX      = textX;
        socialDB.tempVideoTextY      = textY;
        socialDB.tempVideoMusic      = musicTitle;
        socialDB.tempVideoMusicB64   = musicB64;
        socialDB.tempVideoMusicStart = musicStart;
        socialDB.tempVideoMusicEnd   = musicEnd;
        socialDB.tempVideoMusicVol   = musicVol;

        // Preview en la tarjeta de post
        var box = document.getElementById('previewBox');
        var img = document.getElementById('imgPrev');
        var vid = document.getElementById('videoPrev');
        if (box) box.style.display = 'block';
        if (img) img.style.display = 'none';
        if (vid) { vid.style.display = 'block'; vid.src = e.target.result; }

        closePostVideoEditor();
        showToast('✅ Video listo · Pulsa Publicar');
    };
    reader.readAsDataURL(file);
};

window.closePostVideoEditor = function() {
    var ov = document.getElementById('reelEditorOverlay'); if (!ov) return;
    if (ov._editorState && ov._editorState.musicAudio) {
        ov._editorState.musicAudio.pause();
        ov._editorState.musicAudio = null;
    }
    if (ov._postVidObjUrl) { URL.revokeObjectURL(ov._postVidObjUrl); ov._postVidObjUrl = null; }
    ov._postVidFile  = null;
    ov._editorState  = null;
    ov.classList.remove('active');
    setTimeout(function() { ov.style.display = 'none'; ov.innerHTML = ''; }, 400);
};

window.removeMedia = function() {
    socialDB.tempMedia = null; socialDB.tempMediaType = null;
    socialDB.tempVideoText = null; socialDB.tempVideoMusic = null;
    var box = document.getElementById('previewBox'); if (box) box.style.display = 'none';
    var img = document.getElementById('imgPrev'); if (img) { img.style.display = 'none'; img.src = ''; }
    var vid = document.getElementById('videoPrev'); if (vid) { vid.style.display = 'none'; vid.src = ''; }
};

window.publishPost = function() {
    var txt = document.getElementById('newPostTxt');
    var feeling = document.getElementById('feelingInput');
    if (!txt) return;
    var content = txt.value.trim();
    var feelingVal = feeling ? feeling.value.trim() : '';
    if (!content && !socialDB.tempMedia) return showToast('⚠️ Escribe algo o añade una imagen/video');

    var btn = document.querySelector('.create-post-bottom .btn-join');
    if (btn) { btn.disabled = true; btn.textContent = 'Publicando...'; }

    api('POST', '/posts', {
        content:    content,
        feeling:    feelingVal,
        media:      socialDB.tempMedia      || '',
        mediaType:  socialDB.tempMediaType  || '',
        videoText:  socialDB.tempVideoText  || '',
        videoColor: socialDB.tempVideoColor || '#ffffff',
        videoSize:  socialDB.tempVideoSize  || 22,
        videoTextX: socialDB.tempVideoTextX !== undefined ? socialDB.tempVideoTextX : 50,
        videoTextY: socialDB.tempVideoTextY !== undefined ? socialDB.tempVideoTextY : 50,
        videoMusic: socialDB.tempVideoMusic || ''
    })
    .then(function(data) {
        if (btn) { btn.disabled = false; btn.textContent = 'Publicar'; }
        if (!data.ok) return showToast('❌ ' + (data.error || 'Error al publicar'));
        // Notificar a amigos por socket en tiempo real
        var u = socialDB.currentUser;
        if (socialDB.socket && socialDB.socket.connected) {
            (u.friends||[]).forEach(function(friendUsername) {
                socialDB.socket.emit('friend_post', {
                    to: friendUsername,
                    authorName: u.name,
                    preview: (data.post && data.post.content) ? data.post.content.substring(0,50) : '📸 Imagen'
                });
            });
        }
        // Limpiar
        socialDB.tempMedia = null; socialDB.tempMediaType = null;
        socialDB.tempVideoText = null; socialDB.tempVideoColor = null;
        socialDB.tempVideoSize = null; socialDB.tempVideoTextX = null;
        socialDB.tempVideoTextY = null; socialDB.tempVideoMusic = null;
        if (txt) txt.value = '';
        if (feeling) feeling.value = '';
        removeMedia();
        showToast('✅ Publicación creada');
        renderPosts();
        var el = document.getElementById('statPosts');
        if (el) el.textContent = parseInt(el.textContent || 0) + 1;
    })
    .catch(function() {
        if (btn) { btn.disabled = false; btn.textContent = 'Publicar'; }
        showToast('❌ Error de conexión');
    });
};

// ── 13. COMPARTIR POST ───────────────────────────────────
window.openShareModal = function(postId) {
    socialDB.sharePostId = postId;
    var u = socialDB.currentUser;
    var overlay = document.getElementById('shareModalOverlay'); if (!overlay) return;

    // Mostrar spinner mientras carga amigos
    overlay.innerHTML = '<div class="modal-box" style="max-width:400px;"><h2 style="margin-bottom:18px;">↗️ Compartir</h2><div style="text-align:center;padding:20px;"><div class="reels-spinner" style="margin:0 auto;"></div></div><p class="close-text" onclick="closeShareModal()">Cancelar</p></div>';
    overlay.style.display = 'flex';
    setTimeout(function() { overlay.classList.add('active'); }, 10);

    var friendUsernames = u.friends || [];
    if (friendUsernames.length === 0) {
        overlay.querySelector('.modal-box').innerHTML = '<h2 style="margin-bottom:18px;">↗️ Compartir</h2><div class="empty-state"><i class="fa-solid fa-user-group"></i><p>Agrega amigos para compartir.</p></div><p class="close-text" onclick="closeShareModal()">Cancelar</p>';
        return;
    }

    // Cargar datos de amigos desde caché o backend
    Promise.all(friendUsernames.map(function(fn) {
        var cached = socialDB.users.find(function(x) { return x.username === fn; });
        if (cached) return Promise.resolve(cached);
        return api('GET', '/users/' + fn).then(function(d) {
            if (d.ok) { socialDB.users.push(d.user); return d.user; }
            return null;
        }).catch(function() { return null; });
    })).then(function(friends) {
        friends = friends.filter(Boolean);
        var inner = '<div style="max-height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;">' +
            friends.map(function(f) {
                return '<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;background:var(--bg-input);cursor:pointer;touch-action:manipulation;" onclick="sendSharedPost(\'' + f.username + '\')">' +
                    '<div style="width:40px;height:40px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;overflow:hidden;flex-shrink:0;">' + renderAvatar(f,40) + '</div>' +
                    '<div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:14px;">' + f.name + '</div><div style="font-size:12px;color:var(--text-muted);">@' + (f.displayName||f.username) + '</div></div>' +
                    '<i class="fa-solid fa-paper-plane" style="color:var(--primary);font-size:16px;flex-shrink:0;"></i></div>';
            }).join('') + '</div>';
        var box = overlay.querySelector('.modal-box');
        if (box) box.innerHTML = '<h2 style="margin-bottom:18px;">↗️ Compartir</h2>' + inner + '<p class="close-text" onclick="closeShareModal()">Cancelar</p>';
    });
};

window.sendSharedPost = function(toUsername) {
    var post = socialDB.posts.find(function(p) { return (p._id||p.id) === socialDB.sharePostId; });
    if (!post) return;
    var u = socialDB.currentUser;
    var msg = '📤 ' + u.name + ' te compartió: "' + (post.content ? post.content.substring(0,60)+(post.content.length>60?'...':'') : '[Imagen]') + '"';
    var friendName = (socialDB.users.find(function(x) { return x.username === toUsername; }) || {}).name || toUsername;
    sendMessageTo(toUsername, msg);
    closeShareModal();
    showToast('✅ Compartido con ' + friendName);
};
window.closeShareModal = function() {
    var ov = document.getElementById('shareModalOverlay'); if (!ov) return;
    ov.classList.remove('active');
    setTimeout(function() { ov.style.display = 'none'; ov.innerHTML = ''; }, 400);
};

// ── 14. BUSCAR ───────────────────────────────────────────
function renderBuscar(area) {
    area.innerHTML = '<div class="search-page-box"><h3 style="margin:0 0 18px;font-size:18px;">Encuentra personas</h3>' +
        '<div class="search-input-wrap"><i class="fa-solid fa-magnifying-glass"></i>' +
        '<input class="search-big-input" type="text" id="userSearchInput" placeholder="Buscar por nombre o usuario..." oninput="filterSearchResults()" autofocus></div>' +
        '<div class="search-results" id="searchResults"></div></div>';
    filterSearchResults();
}
window.filterSearchResults = function() {
    var query = ((document.getElementById('userSearchInput') ? document.getElementById('userSearchInput').value : '')||'').trim();
    var results = document.getElementById('searchResults'); if (!results) return;
    results.innerHTML = '<div class="reels-loading" style="min-height:80px;"><div class="reels-spinner"></div></div>';

    api('GET', '/users/search?q=' + encodeURIComponent(query))
    .then(function(data) {
        var users = data.users || [];
        if (users.length === 0) {
            results.innerHTML = '<div class="empty-state"><i class="fa-solid fa-user-slash"></i><p>No se encontraron usuarios' + (query?' para "'+query+'"':'') + '.</p></div>';
            return;
        }
        var u = socialDB.currentUser;
        results.innerHTML = users.map(function(user) {
            var isFriend = (u.friends||[]).includes(user.username);
            var pending = socialDB.friendRequests.find(function(r) { return r.from===u.username && r.to===user.username && r.status==='pending'; });
            var btn = isFriend
                ? '<button class="btn-add-friend friends" disabled><i class="fa-solid fa-user-check"></i> Amigos</button>'
                : pending
                    ? '<button class="btn-add-friend sent" disabled><i class="fa-solid fa-clock"></i> Enviada</button>'
                    : '<button class="btn-add-friend" onclick="sendFriendRequest(\'' + user.username + '\');this.outerHTML=\'<button class=btn-add-friend sent disabled><i class=fa-solid fa-clock></i> Enviada</button>\';"><i class="fa-solid fa-user-plus"></i> Agregar</button>';
            return '<div class="search-user-card"><div class="search-user-avatar">' + renderAvatar(user,48) + '</div><div class="search-user-info"><div class="search-user-name">' + user.name + '</div><div class="search-user-handle">@' + user.displayName + '</div></div>' + btn + '</div>';
        }).join('');
    })
    .catch(function() {
        results.innerHTML = '<div class="empty-state"><i class="fa-solid fa-wifi"></i><p>Error de conexión.</p></div>';
    });
};

// ── 15. SOLICITUDES DE AMISTAD ───────────────────────────
function loadFriendRequests() {
    api('GET', '/friends/requests').then(function(data) {
        if (data.ok) { socialDB.friendRequests = data.requests || []; updateBadges(); }
    });
}

window.sendFriendRequest = function(toUsername) {
    api('POST', '/friends/request/' + toUsername)
    .then(function(data) {
        if (data.ok) { showToast('✅ Solicitud enviada'); filterSearchResults(); updateBadges(); }
        else showToast('❌ ' + (data.error || 'Error'));
    });
};

window.acceptFriendRequest = function(reqId) {
    api('POST', '/friends/accept/' + reqId)
    .then(function(data) {
        if (data.ok) {
            showToast('✅ ¡Ahora son amigos!');
            loadFriendRequests();
            // Recargar el usuario actual para actualizar la lista de amigos
            api('GET', '/users/' + socialDB.currentUser.username).then(function(d) {
                if (d.ok) socialDB.currentUser = d.user;
                renderAmigos(document.getElementById('contentArea'));
                updateBadges();
            });
        }
    });
};

window.rejectFriendRequest = function(reqId) {
    api('POST', '/friends/reject/' + reqId)
    .then(function(data) {
        if (data.ok) { showToast('❌ Solicitud rechazada'); loadFriendRequests(); renderAmigos(document.getElementById('contentArea')); }
    });
};

// ── 16. AMIGOS ───────────────────────────────────────────
function renderAmigos(area) {
    area.innerHTML = '<div class="reels-loading"><div class="reels-spinner"></div><p>Cargando...</p></div>';

    // Cargar solicitudes frescas del backend
    api('GET', '/friends/requests').then(function(data) {
        socialDB.friendRequests = data.requests || [];
        var u = socialDB.currentUser;
        var pendingReqs = socialDB.friendRequests.filter(function(r) { return r.to === u.username && r.status === 'pending'; });
        var friends = (u.friends || []);

        area.innerHTML =
            '<div class="friends-tabs">' +
            '<button class="friend-tab active" id="tab-friends" onclick="showFriendsTab(\'friends\')">Mis Amigos (' + friends.length + ')</button>' +
            '<button class="friend-tab" id="tab-requests" onclick="showFriendsTab(\'requests\')">Solicitudes' +
            (pendingReqs.length > 0 ? ' <span style="background:var(--secondary);color:#fff;padding:1px 6px;border-radius:10px;font-size:11px;margin-left:4px;">' + pendingReqs.length + '</span>' : '') +
            '</button></div><div id="friendsTabContent"></div>';

        // Si hay solicitudes pendientes, mostrarlas directamente
        if (pendingReqs.length > 0) {
            showFriendsTab('requests');
        } else {
            showFriendsTab('friends');
        }
        updateBadges();
    });
}

window.showFriendsTab = function(tab) {
    document.querySelectorAll('.friend-tab').forEach(function(t) { t.classList.remove('active'); });
    var activeTab = document.getElementById('tab-' + tab); if (activeTab) activeTab.classList.add('active');
    var u = socialDB.currentUser;
    var content = document.getElementById('friendsTabContent'); if (!content) return;

    if (tab === 'friends') {
        var friends = u.friends || [];
        if (friends.length === 0) {
            content.innerHTML = '<div class="empty-state"><i class="fa-solid fa-user-group"></i><p>Aún no tienes amigos. ¡Busca personas en la sección Buscar!</p></div>';
            return;
        }
        // Cargar datos de amigos desde caché o backend
        Promise.all(friends.map(function(fn) {
            var cached = socialDB.users.find(function(x) { return x.username === fn; });
            if (cached) return Promise.resolve(cached);
            return api('GET', '/users/' + fn).then(function(d) {
                if (d.ok) { socialDB.users.push(d.user); return d.user; }
                return null;
            });
        })).then(function(friendList) {
            friendList = friendList.filter(Boolean);
            content.innerHTML = '<div class="friends-grid">' + friendList.map(function(f) {
                return '<div class="friend-card">' +
                    '<div class="friend-card-avatar" onclick="viewFriendProfile(\'' + f.username + '\')" style="cursor:pointer;">' + renderAvatar(f,62) + '</div>' +
                    '<div class="friend-card-name" onclick="viewFriendProfile(\'' + f.username + '\')" style="cursor:pointer;">' + f.name + '</div>' +
                    '<div style="font-size:11px;color:var(--text-muted);margin-bottom:10px;">@' + (f.displayName||f.username) + '</div>' +
                    '<div style="display:flex;gap:6px;justify-content:center;">' +
                    '<button class="btn-message-friend" onclick="viewFriendProfile(\'' + f.username + '\')"><i class="fa-solid fa-user"></i> Perfil</button>' +
                    '<button class="btn-message-friend" onclick="openChatWith(\'' + f.username + '\')"><i class="fa-solid fa-message"></i> Chat</button>' +
                    '</div></div>';
            }).join('') + '</div>';
        });
    } else {
        var pending = socialDB.friendRequests.filter(function(r) { return r.to === u.username && r.status === 'pending'; });
        if (pending.length === 0) {
            content.innerHTML = '<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>No tienes solicitudes pendientes.</p></div>';
            return;
        }
        // Cargar datos de quien envió la solicitud
        Promise.all(pending.map(function(req) {
            var cached = socialDB.users.find(function(x) { return x.username === req.from; });
            if (cached) return Promise.resolve({ req: req, user: cached });
            return api('GET', '/users/' + req.from).then(function(d) {
                if (d.ok) return { req: req, user: d.user };
                return { req: req, user: { name: req.from, username: req.from, profilePic: '' } };
            });
        })).then(function(items) {
            content.innerHTML = items.map(function(item) {
                var req = item.req; var fromUser = item.user;
                return '<div class="friend-request-card" id="req-card-' + (req._id||req.id) + '">' +
                    '<div style="width:44px;height:44px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;overflow:hidden;flex-shrink:0;">' + renderAvatar(fromUser,44) + '</div>' +
                    '<div style="flex:1;min-width:0;"><div style="font-weight:700;">' + fromUser.name + '</div><div style="font-size:12px;color:var(--text-muted);">@' + (fromUser.displayName||fromUser.username) + ' · ' + timeAgo(req.createdAt) + '</div></div>' +
                    '<div class="request-actions">' +
                    '<button class="btn-accept" onclick="acceptFriendRequest(\'' + (req._id||req.id) + '\')">Aceptar</button>' +
                    '<button class="btn-reject" onclick="rejectFriendRequest(\'' + (req._id||req.id) + '\')">Rechazar</button>' +
                    '</div></div>';
            }).join('');
        });
    }
};

window.viewFriendProfile = function(username) {
    var overlay = document.getElementById('friendProfileOverlay'); if (!overlay) return;

    // Mostrar skeleton mientras carga
    overlay.innerHTML = '<div class="modal-box" style="max-width:480px;padding:40px;text-align:center;"><div class="reels-spinner" style="margin:0 auto;"></div></div>';
    overlay.style.display = 'flex';
    setTimeout(function() { overlay.classList.add('active'); }, 10);

    // Cargar datos en paralelo
    Promise.all([
        api('GET', '/users/' + username),
        api('GET', '/posts/user/' + username),
        api('GET', '/friends/list/' + username)
    ]).then(function(results) {
        var friendData = results[0].ok ? results[0].user : null;
        if (!friendData) { overlay.innerHTML = '<div class="modal-box"><p>Usuario no encontrado</p><p class="close-text" onclick="closeFriendProfile()">Cerrar</p></div>'; return; }

        var friendPosts  = results[1].ok ? (results[1].posts || []) : [];
        var friendsList  = results[2].ok ? (results[2].friends || []) : [];
        var u = socialDB.currentUser;

        // Cachear usuario
        if (!socialDB.users.find(function(x) { return x.username === username; })) socialDB.users.push(friendData);

        function renderTab(tab) {
            if (tab === 'posts') {
                if (friendPosts.length === 0) return '<div style="text-align:center;color:var(--text-muted);font-size:14px;padding:20px;">Sin publicaciones aún.</div>';
                return '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;max-height:260px;overflow-y:auto;">' +
                    friendPosts.map(function(p) {
                        if (p.media) {
                            return p.mediaType === 'video'
                                ? '<div style="position:relative;cursor:pointer;" onclick="openFullscreen(\'' + p.media + '\')">' +
                                  '<video src="' + p.media + '" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;"></video>' +
                                  '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.2);border-radius:8px;"><i class="fa-solid fa-play" style="color:#fff;font-size:20px;"></i></div></div>'
                                : '<img src="' + p.media + '" onclick="openFullscreen(\'' + p.media + '\')" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;cursor:pointer;">';
                        }
                        return '<div onclick="openFullPostModal(\'' + p._id + '\')" style="background:var(--bg-input);border-radius:8px;aspect-ratio:1;display:flex;align-items:center;justify-content:center;padding:8px;font-size:11px;color:var(--text-secondary);text-align:center;overflow:hidden;cursor:pointer;">' + (p.content?p.content.substring(0,60):'...') + '</div>';
                    }).join('') + '</div>';
            } else {
                // Amigos del perfil
                if (friendsList.length === 0) return '<div style="text-align:center;color:var(--text-muted);font-size:14px;padding:20px;">No tiene amigos aún.</div>';
                return '<div style="display:flex;flex-direction:column;gap:8px;max-height:240px;overflow-y:auto;">' +
                    friendsList.map(function(f) {
                        return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:var(--bg-input);cursor:pointer;" onclick="closeFriendProfile();setTimeout(function(){viewFriendProfile(\'' + f.username + '\')},300)">' +
                            '<div style="width:40px;height:40px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;overflow:hidden;flex-shrink:0;">' + renderAvatar(f,40) + '</div>' +
                            '<div><div style="font-weight:600;font-size:14px;">' + f.name + '</div><div style="font-size:12px;color:var(--text-muted);">@' + (f.displayName||f.username) + '</div></div></div>';
                    }).join('') + '</div>';
            }
        }

        var isFriend = (u.friends||[]).includes(username);
        var isMe = username === u.username;
        var pendingReq = socialDB.friendRequests.find(function(r) { return r.from===u.username && r.to===username && r.status==='pending'; });

        var actionBtn = isMe ? '' :
            isFriend
                ? '<button class="btn-join" onclick="openChatWith(\'' + username + '\');closeFriendProfile();" style="flex:1;padding:10px;font-size:14px;"><i class="fa-solid fa-message"></i> Mensaje</button>'
                : pendingReq
                    ? '<button class="btn-outline" disabled style="flex:1;padding:10px;opacity:.6;font-size:14px;"><i class="fa-solid fa-clock"></i> Enviada</button>'
                    : '<button class="btn-join" id="fpFollowBtn" onclick="sendFriendRequest(\'' + username + '\');document.getElementById(\'fpFollowBtn\').outerHTML=\'<button class=btn-outline disabled style=flex:1;padding:10px;opacity:.6;font-size:14px;><i class=fa-solid fa-clock></i> Enviada</button>\';" style="flex:1;padding:10px;font-size:14px;"><i class="fa-solid fa-user-plus"></i> Agregar</button>';

        overlay.innerHTML =
            '<div class="modal-box" style="max-width:480px;padding:0;overflow:hidden;border-radius:24px;">' +
            // Cover
            '<div style="height:130px;background:' + (friendData.coverPic ? 'url('+friendData.coverPic+') center/cover' : 'var(--gradient)') + ';position:relative;">' +
            '<button onclick="closeFriendProfile()" style="position:absolute;top:12px;right:12px;background:rgba(0,0,0,.5);border:none;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;">×</button>' +
            '</div>' +
            // Perfil info
            '<div style="padding:0 20px 20px;position:relative;">' +
            '<div style="width:76px;height:76px;border-radius:50%;border:4px solid var(--bg-card);position:absolute;top:-38px;left:20px;overflow:hidden;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:26px;">' + renderAvatar(friendData,76) + '</div>' +
            '<div style="padding-top:46px;">' +
            '<div style="font-size:20px;font-weight:800;">' + friendData.name + '</div>' +
            '<div style="font-size:13px;color:var(--text-muted);margin-bottom:6px;">@' + (friendData.displayName||friendData.username) + '</div>' +
            (friendData.bio ? '<div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">' + friendData.bio + '</div>' : '') +
            // Stats
            '<div style="display:flex;gap:16px;padding:12px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);margin-bottom:12px;flex-wrap:wrap;">' +
            [['Posts', friendPosts.length], ['Amigos', (friendData.friends||[]).length], ['Seguidores', (friendData.followers||[]).length]].map(function(s) {
                return '<div style="text-align:center;"><div style="font-size:18px;font-weight:800;color:var(--primary);">' + s[1] + '</div><div style="font-size:12px;color:var(--text-muted);">' + s[0] + '</div></div>';
            }).join('') +
            '</div>' +
            // Botón acción
            (actionBtn ? '<div style="display:flex;gap:10px;margin-bottom:14px;">' + actionBtn + '</div>' : '') +
            // Tabs publicaciones / amigos
            '<div style="display:flex;gap:8px;margin-bottom:14px;">' +
            '<button id="fpTab-posts" onclick="fpSwitchTab(\'posts\')" style="flex:1;padding:8px;border-radius:20px;border:none;background:var(--gradient);color:#fff;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;">📸 Publicaciones (' + friendPosts.length + ')</button>' +
            '<button id="fpTab-friends" onclick="fpSwitchTab(\'friends\')" style="flex:1;padding:8px;border-radius:20px;border:1.5px solid var(--border);background:none;color:var(--text-secondary);font-weight:600;font-size:13px;cursor:pointer;font-family:inherit;">👥 Amigos (' + friendsList.length + ')</button>' +
            '</div>' +
            '<div id="fpTabContent">' + renderTab('posts') + '</div>' +
            '</div></div></div>';

        // Guardar renderTab para los tabs
        overlay._renderTab = renderTab;
    }).catch(function(err) {
        console.error('viewFriendProfile error:', err);
        overlay.innerHTML = '<div class="modal-box"><p style="color:var(--text-muted);">Error al cargar el perfil.</p><p class="close-text" onclick="closeFriendProfile()">Cerrar</p></div>';
    });
};

// BUG FIX: closeFriendProfile era llamada pero no estaba definida
window.closeFriendProfile = function() {
    var ov = document.getElementById('friendProfileOverlay'); if (!ov) return;
    ov.classList.remove('active');
    setTimeout(function() { ov.style.display = 'none'; ov.innerHTML = ''; ov._renderTab = null; }, 400);
};

window.fpSwitchTab = function(tab) {
    var overlay = document.getElementById('friendProfileOverlay');
    var content = document.getElementById('fpTabContent');
    if (!overlay || !content || !overlay._renderTab) return;
    content.innerHTML = overlay._renderTab(tab);
    var postsBtn   = document.getElementById('fpTab-posts');
    var friendsBtn = document.getElementById('fpTab-friends');
    if (tab === 'posts') {
        if (postsBtn)   { postsBtn.style.background = 'var(--gradient)'; postsBtn.style.color = '#fff'; postsBtn.style.border = 'none'; }
        if (friendsBtn) { friendsBtn.style.background = 'none'; friendsBtn.style.color = 'var(--text-secondary)'; friendsBtn.style.border = '1.5px solid var(--border)'; }
    } else {
        if (friendsBtn) { friendsBtn.style.background = 'var(--gradient)'; friendsBtn.style.color = '#fff'; friendsBtn.style.border = 'none'; }
        if (postsBtn)   { postsBtn.style.background = 'none'; postsBtn.style.color = 'var(--text-secondary)'; postsBtn.style.border = '1.5px solid var(--border)'; }
    }
};

window.openFullPostModal = function(postId) {
    var post = socialDB.posts.find(function(p) { return (p._id||p.id) === postId; });
    if (!post) return;
    toggleModal(true,
        '<div>' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">' +
        '<div style="width:42px;height:42px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;overflow:hidden;">' + renderAvatar({name:post.authorName,profilePic:''},42) + '</div>' +
        '<div><div style="font-weight:700;">' + post.authorName + '</div><div style="font-size:12px;color:var(--text-muted);">' + timeAgo(post.createdAt) + '</div></div></div>' +
        (post.content ? '<p style="font-size:15px;margin-bottom:12px;">' + post.content + '</p>' : '') +
        (post.media ? (post.mediaType==='video' ? '<video src="' + post.media + '" controls style="width:100%;border-radius:12px;max-height:300px;"></video>' : '<img src="' + post.media + '" style="width:100%;border-radius:12px;" onclick="openFullscreen(this.src)">') : '') +
        '</div>'
    );
};

// ── 17. NOTIFICACIONES ───────────────────────────────────
function loadNotifications() {
    api('GET', '/notifications').then(function(data) {
        if (data.ok) { socialDB.notifications = data.notifications || []; updateBadges(); }
    });
}

function addNotification(toUsername, type, text) {
    // Las notificaciones ahora se crean en el backend automáticamente
    // Esta función solo actualiza el estado local
    socialDB.notifications.unshift({ to:toUsername, type:type, text:text, read:false, createdAt:new Date().toISOString() });
    updateBadges();
}

function renderNotificaciones(area) {
    area.innerHTML = '<div class="reels-loading"><div class="reels-spinner"></div><p>Cargando...</p></div>';
    api('GET', '/notifications').then(function(data) {
        socialDB.notifications = data.notifications || [];
        if (socialDB.notifications.length === 0) {
            area.innerHTML = '<div class="empty-state"><i class="fa-solid fa-bell-slash"></i><p>No tienes notificaciones.</p></div>';
            return;
        }
        var iconMap = { like:'fa-heart', comment:'fa-comment', friend_request:'fa-user-plus', friend_accepted:'fa-user-check', message:'fa-message', post:'fa-newspaper', story:'fa-circle-play' };
        area.innerHTML = socialDB.notifications.map(function(n) {
            return '<div class="notif-item ' + (n.read?'':'unread') + '">' +
                '<div class="notif-icon"><i class="fa-solid ' + (iconMap[n.type]||'fa-bell') + '"></i></div>' +
                '<div class="notif-text">' + n.text + '</div>' +
                '<div class="notif-time">' + timeAgo(n.createdAt) + '</div>' +
                (!n.read ? '<div class="notif-dot"></div>' : '') + '</div>';
        }).join('');
        // Marcar como leídas
        api('PUT', '/notifications/read');
        socialDB.notifications.forEach(function(n) { n.read = true; });
        updateBadges();
    });
}

// ── 18. MENSAJES ─────────────────────────────────────────
function renderMensajes(area) {
    var u = socialDB.currentUser;
    area.innerHTML =
        '<div class="messages-layout">' +
        '<div class="messages-list-panel">' +
        '<div class="messages-panel-header">💬 Mensajes</div>' +
        '<div class="messages-list" id="messagesList"><div style="padding:20px;text-align:center;"><div class="reels-spinner" style="margin:0 auto;"></div></div></div>' +
        '</div>' +
        '<div class="messages-chat-panel" id="messagesChatPanel">' +
        '<div class="no-chat-selected"><i class="fa-regular fa-comment-dots"></i><p>Selecciona una conversación</p></div>' +
        '</div></div>';

    // Cargar lista de amigos desde backend
    var friendUsernames = u.friends || [];
    if (friendUsernames.length === 0) {
        document.getElementById('messagesList').innerHTML =
            '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:14px;">Agrega amigos para chatear</div>';
        if (socialDB.activeMessageUser) openMessagePanel(socialDB.activeMessageUser);
        return;
    }

    // Cargar datos de amigos (desde caché o backend)
    Promise.all(friendUsernames.map(function(fn) {
        var cached = socialDB.users.find(function(x) { return x.username === fn; });
        if (cached) return Promise.resolve(cached);
        return api('GET', '/users/' + fn).then(function(d) {
            if (d.ok) { socialDB.users.push(d.user); return d.user; }
            return null;
        }).catch(function() { return null; });
    })).then(function(friends) {
        friends = friends.filter(Boolean);
        renderMensajesList(document.getElementById('messagesList'), friends);
        if (socialDB.activeMessageUser) openMessagePanel(socialDB.activeMessageUser);
    });
}

function renderMensajesList(listEl, friends) {
    if (!listEl) return;
    var u = socialDB.currentUser;
    // Si no se pasan amigos, usar los cacheados
    if (!friends) {
        friends = (u.friends||[]).map(function(fn) {
            return socialDB.users.find(function(x) { return x.username === fn; });
        }).filter(Boolean);
    }
    if (friends.length === 0) {
        listEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:14px;">Agrega amigos para chatear</div>';
        return;
    }
    listEl.innerHTML = friends.map(function(f) {
        var msgs  = getCachedConversation(f.username);
        var lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
        var unread  = msgs.filter(function(m) { return m.from === f.username && !m.read; }).length;
        var isActive = socialDB.activeMessageUser === f.username;
        return '<div class="message-preview-item' + (isActive?' active':'') + '" onclick="openMessagePanel(\'' + f.username + '\')">' +
            '<div class="msg-preview-avatar">' + renderAvatar(f, 42) + '</div>' +
            '<div class="msg-preview-info">' +
            '<div class="msg-preview-name">' + f.name + '</div>' +
            '<div class="msg-preview-last">' + (lastMsg ? (lastMsg.from===u.username?'Tú: ':f.name.split(' ')[0]+': ') + lastMsg.text.substring(0,28)+(lastMsg.text.length>28?'…':'') : 'Sin mensajes aún') + '</div>' +
            '</div>' +
            (unread > 0 ? '<div class="msg-unread-dot"></div>' : '') +
            '</div>';
    }).join('');
}

// ── MENSAJES — SISTEMA COMPLETO ─────────────────────────

// Caché: { username: [msg, ...] } — array plano por conversación
function getCachedConversation(username) {
    return Array.isArray(socialDB.messages[username]) ? socialDB.messages[username] : [];
}

function addMsgToCache(toUsername, msg) {
    if (!Array.isArray(socialDB.messages[toUsername])) socialDB.messages[toUsername] = [];
    var exists = socialDB.messages[toUsername].find(function(m) {
        return m.id === msg.id || (m._id && m._id === msg._id);
    });
    if (!exists) socialDB.messages[toUsername].push(msg);
}

function markMessagesRead(fromUsername) {
    var msgs = getCachedConversation(fromUsername);
    msgs.forEach(function(m) { if (m.to === socialDB.currentUser.username) m.read = true; });
}

// Renderiza el panel de chat sin reinicializar el input
// ── STICKERS ──────────────────────────────────────────────
var STICKERS = [
    {cat:'Caras', items:['😀🎉','😎✌️','🥺👉👈','😂💀','🤩⭐','😍❤️','🙄💅','😤👊','🤔💭','😴💤','🥳🎊','😭🌊','🤡🎪','👻💀','🔥💪']},
    {cat:'Animales', items:['🐶❤️','🐱😸','🐸👑','🦊🌟','🐼💕','🦁💪','🐯🔥','🐧🎩','🦋✨','🐙💙','🦄🌈','🐻🍯','🦊🌿','🐸🎸','🦜🎨']},
    {cat:'Comida', items:['🍕❤️','🍔💪','🍦😍','☕💙','🍺🎉','🌮🔥','🍜✨','🧁🎂','🍩🌟','🥑💚','🍓❤️','🍟😎','🥤🧊','🍫💕','🫶🍕']},
    {cat:'Reacciones', items:['👍✅','❤️🔥','💔😢','🙏✨','👏🎉','💯✔️','🚀⭐','😱🤯','🤣😂','👀🔍','💪🏆','🎯✅','🤝💼','⚡🔥','🌟💫']},
    {cat:'Mood', items:['✌️😎','💀💀','👑😤','🫶💕','🥵🔥','❄️🥶','🌙✨','☀️😊','⚡😤','🌸💮','🖤🖤','💜💙','🎭🎪','🌊🏄','🏔️❄️']}
];

// ── PANEL DE MENSAJES COMPLETO ────────────────────────────
function renderMessagePanel(panel, friend, msgs, username) {
    var u = socialDB.currentUser;
    var msgsHTML = msgs.length === 0
        ? '<div style="text-align:center;color:var(--text-muted);font-size:14px;padding:40px 20px;"><div style="font-size:40px;margin-bottom:10px;">👋</div>Inicia la conversación con <strong>' + friend.name + '</strong></div>'
        : msgs.map(function(m, idx) { return buildMsgBubble(m, idx, u, username); }).join('');

    var emojiHTML = EMOJIS.map(function(e) {
        return '<button onclick="insertPanelEmoji(\''+e+'\')" style="background:none;border:none;font-size:22px;cursor:pointer;padding:3px;border-radius:6px;touch-action:manipulation;">'+e+'</button>';
    }).join('');

    // Stickers HTML
    var stickerTabsHTML = STICKERS.map(function(cat, i) {
        return '<button onclick="showStickerCat('+i+')" id="stab-'+i+'" style="padding:5px 10px;border:none;border-radius:15px;font-size:12px;font-weight:600;cursor:pointer;background:' + (i===0?'var(--gradient)':'var(--bg-input)') + ';color:' + (i===0?'#fff':'var(--text-secondary)') + ';font-family:inherit;touch-action:manipulation;">' + cat.cat + '</button>';
    }).join('');

    var stickerGridHTML = STICKERS[0].items.map(function(s) {
        return '<div onclick="sendSticker(\''+s+'\',\''+username+'\')" style="font-size:22px;cursor:pointer;padding:6px;border-radius:8px;text-align:center;transition:background .15s;touch-action:manipulation;" onmouseenter="this.style.background=\'var(--bg-hover)\'" onmouseleave="this.style.background=\'\'">'+s+'</div>';
    }).join('');

    panel.innerHTML =
        '<div class="chat-panel-header">' +
        '<div style="width:36px;height:36px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;overflow:hidden;flex-shrink:0;">' + renderAvatar(friend,36) + '</div>' +
        '<span style="font-weight:700;">' + friend.name + '</span>' +
        '<div style="width:10px;height:10px;border-radius:50%;background:#4caf50;margin-left:auto;flex-shrink:0;" id="friendOnlineDot-'+username+'"></div>' +
        '</div>' +

        // Mensajes
        '<div class="chat-panel-messages" id="panelMessages">' + msgsHTML + '</div>' +
        '<div id="typingIndicator" style="display:none;padding:4px 16px;font-size:12px;color:var(--text-muted);font-style:italic;">' + friend.name + ' está escribiendo...</div>' +

        // Barra de input
        '<div class="chat-panel-input" id="panelInputBar">' +
        // Emoji
        '<button class="chat-panel-emoji" onclick="togglePanelEmoji()" title="Emoji" style="touch-action:manipulation;"><i class="fa-regular fa-face-smile"></i></button>' +
        // Sticker
        '<button class="chat-panel-emoji" onclick="togglePanelStickers()" title="Stickers" style="touch-action:manipulation;font-size:18px;">🎭</button>' +
        // Multimedia
        '<label style="cursor:pointer;padding:6px;color:var(--text-muted);font-size:17px;display:flex;align-items:center;touch-action:manipulation;" title="Imagen/Video">' +
        '<i class="fa-solid fa-image"></i>' +
        '<input type="file" hidden accept="image/*,video/*" onchange="sendMediaMessage(this,\''+username+'\')">' +
        '</label>' +
        // Input de texto
        '<input type="text" id="panelMsgInput" placeholder="Escribe un mensaje..." ' +
        'onkeydown="if(event.key===\'Enter\') window.sendPanelMessage(\''+username+'\')" style="flex:1;">' +
        // Nota de voz (solo cuando no hay texto)
        '<button id="voiceNoteBtn" class="chat-panel-emoji" title="Nota de voz" style="font-size:18px;touch-action:manipulation;user-select:none;" ' +
        'onmousedown="startVoiceNote(event)" onmouseup="stopVoiceNote(event,\''+username+'\')" ontouchstart="startVoiceNote(event)" ontouchend="stopVoiceNote(event,\''+username+'\')">' +
        '<i class="fa-solid fa-microphone" id="voiceMicIcon"></i></button>' +
        // Enviar
        '<button class="chat-panel-send" onclick="window.sendPanelMessage(\''+username+'\')" style="flex-shrink:0;"><i class="fa-solid fa-paper-plane"></i></button>' +
        '</div>' +

        // Preview de nota de voz antes de enviar
        '<div id="voicePreviewBar" style="display:none;padding:10px 14px;border-top:1px solid var(--border);background:var(--bg-card);align-items:center;gap:8px;flex-wrap:wrap;">' +
        '<div style="display:flex;align-items:center;gap:6px;color:var(--primary);font-size:13px;font-weight:600;flex-shrink:0;"><i class="fa-solid fa-microphone"></i> Nota de voz</div>' +
        '<audio id="voicePreviewAudio" controls style="flex:1;height:36px;min-width:0;max-width:100%;"></audio>' +
        '<div style="display:flex;gap:6px;flex-shrink:0;">' +
        '<button onclick="sendVoiceNote(\''+username+'\')" style="background:var(--gradient);color:#fff;border:none;padding:8px 14px;border-radius:15px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;touch-action:manipulation;display:flex;align-items:center;gap:5px;"><i class="fa-solid fa-paper-plane"></i> Enviar</button>' +
        '<button onclick="discardVoiceNote()" style="background:rgba(255,77,77,.1);color:#ff4d4d;border:1.5px solid rgba(255,77,77,.3);padding:8px 14px;border-radius:15px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;touch-action:manipulation;display:flex;align-items:center;gap:5px;"><i class="fa-solid fa-trash"></i> Cancelar</button>' +
        '</div>' +
        '</div>' +

        // Picker de emojis
        '<div id="panelEmojiPicker" style="display:none;border-top:1px solid var(--border);background:var(--bg-card);padding:10px;max-height:160px;overflow-y:auto;">' +
        '<div style="display:flex;flex-wrap:wrap;gap:4px;">' + emojiHTML + '</div></div>' +

        // Picker de stickers
        '<div id="panelStickerPicker" style="display:none;border-top:1px solid var(--border);background:var(--bg-card);padding:10px;max-height:200px;overflow-y:auto;">' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">' + stickerTabsHTML + '</div>' +
        '<div id="stickerGrid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;">' + stickerGridHTML + '</div>' +
        '</div>';

    var panelMsgs = document.getElementById('panelMessages');
    if (panelMsgs) setTimeout(function(){ panelMsgs.scrollTop = panelMsgs.scrollHeight; }, 50);
}

// Construir burbuja de mensaje con soporte multimedia y opciones al pulsar largo
function buildMsgBubble(m, idx, u, toUsername) {
    var isMe = m.from === u.username;
    var msgId = m._id || m.id || ('m_'+idx);
    var pinned = m.pinned ? '<span style="font-size:10px;opacity:.7;margin-right:4px;">📌</span>' : '';
    var repliedTo = m.replyTo
        ? '<div style="border-left:3px solid rgba(255,255,255,.5);padding:4px 8px;margin-bottom:4px;font-size:11px;opacity:.8;border-radius:4px;background:rgba(0,0,0,.1);">↩ ' + (m.replyTo.text || m.replyTo).substring(0,40) + '</div>'
        : '';

    var content = '';
    if (m.type === 'image') {
        content = '<img src="' + m.media + '" style="max-width:200px;border-radius:10px;display:block;cursor:pointer;" onclick="openFullscreen(this.src)">';
    } else if (m.type === 'video') {
        content = '<video src="' + m.media + '" controls style="max-width:200px;border-radius:10px;display:block;"></video>';
    } else if (m.type === 'voice') {
        content = '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;"><i class="fa-solid fa-microphone" style="font-size:18px;opacity:.8;"></i><audio src="' + m.media + '" controls style="height:32px;max-width:180px;"></audio></div>';
    } else if (m.type === 'sticker') {
        content = '<div style="font-size:36px;line-height:1.2;">' + m.text + '</div>';
    } else {
        content = m.text || '';
    }

    return '<div class="msg ' + (isMe?'msg-me':'msg-them') + '" id="msg-' + msgId + '" data-msgid="' + msgId + '" data-idx="' + idx + '" ' +
        'oncontextmenu="event.preventDefault();showMsgOptions(\''+msgId+'\',\''+toUsername+'\','+isMe+')" ' +
        'ontouchstart="msgTouchStart(this)" ontouchend="msgTouchEnd(this,\''+msgId+'\',\''+toUsername+'\','+isMe+')" ' +
        'style="position:relative;' + (m.pinned?'border:1.5px solid rgba(255,255,255,.4);':'') + '">' +
        pinned + repliedTo + content +
        '<div class="msg-time">' + timeAgo(m.createdAt) + '</div></div>';
}

// ── OPCIONES DE MENSAJE ───────────────────────────────────
var _msgLongPressTimer = null;
window.msgTouchStart = function(el) {
    _msgLongPressTimer = setTimeout(function() {
        var msgId = el.dataset.msgid;
        var toUser = socialDB.activeMessageUser;
        var isMe = el.classList.contains('msg-me');
        showMsgOptions(msgId, toUser, isMe);
    }, 550);
};
window.msgTouchEnd = function(el, msgId, toUser, isMe) {
    clearTimeout(_msgLongPressTimer);
};

window.showMsgOptions = function(msgId, toUsername, isMe) {
    // Buscar el mensaje en caché
    var allMsgs = socialDB.messages[toUsername] || [];
    var msg = allMsgs.find(function(m) { return (m._id||m.id) === msgId; });
    if (!msg) return;

    var overlay = document.getElementById('shareModalOverlay'); if (!overlay) return;
    overlay.innerHTML = '<div class="modal-box" style="max-width:320px;padding:8px;">' +
        '<div style="padding:10px 14px;background:var(--bg-input);border-radius:12px;margin-bottom:8px;font-size:13px;color:var(--text-secondary);max-height:60px;overflow:hidden;text-overflow:ellipsis;">' +
        (msg.text || '[Multimedia]').substring(0,80) + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:2px;">' +
        buildMsgOption('↩ Responder', 'fa-reply', 'replyToMsg(\'' + msgId + '\',\'' + toUsername + '\')') +
        buildMsgOption('📋 Copiar', 'fa-copy', 'copyMsg(\'' + msgId + '\',\'' + toUsername + '\')') +
        buildMsgOption('↪ Reenviar', 'fa-share', 'forwardMsg(\'' + msgId + '\',\'' + toUsername + '\')') +
        buildMsgOption('📌 Fijar mensaje', 'fa-thumbtack', 'pinMsg(\'' + msgId + '\',\'' + toUsername + '\')') +
        buildMsgOption('🌐 Traducir', 'fa-language', 'translateMsg(\'' + msgId + '\',\'' + toUsername + '\')') +
        (isMe ? buildMsgOption('🗑️ Eliminar mensaje', 'fa-trash', 'deleteMsg(\'' + msgId + '\',\'' + toUsername + '\')', true) : '') +
        buildMsgOption('🚩 Denunciar', 'fa-flag', 'reportMsg(\'' + msgId + '\',\'' + toUsername + '\')', false, true) +
        buildMsgOption('🗑️ Eliminar conversación', 'fa-trash-can', 'deleteConversation(\'' + toUsername + '\')', true) +
        '</div><p class="close-text" onclick="closeShareModal()" style="margin-top:8px;">Cancelar</p></div>';
    overlay.style.display = 'flex';
    setTimeout(function() { overlay.classList.add('active'); }, 10);
};

function buildMsgOption(label, icon, action, danger, warn) {
    var color = danger ? '#ff4d4d' : (warn ? '#ff9800' : 'var(--text)');
    return '<div onclick="closeShareModal();' + action + '" style="display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:10px;cursor:pointer;color:'+color+';font-size:14px;font-weight:500;transition:background .15s;touch-action:manipulation;" onmouseenter="this.style.background=\'var(--bg-hover)\'" onmouseleave="this.style.background=\'\'">' +
        '<i class="fa-solid ' + icon + '" style="width:18px;text-align:center;font-size:15px;"></i>' + label + '</div>';
}

window.replyToMsg = function(msgId, toUsername) {
    var allMsgs = socialDB.messages[toUsername] || [];
    var msg = allMsgs.find(function(m) { return (m._id||m.id) === msgId; }); if (!msg) return;
    var input = document.getElementById('panelMsgInput'); if (!input) return;
    // Mostrar banner de respuesta
    var bar = document.getElementById('panelInputBar');
    var existing = document.getElementById('replyBanner'); if (existing) existing.remove();
    var banner = document.createElement('div');
    banner.id = 'replyBanner';
    banner.style.cssText = 'padding:6px 14px;border-top:1px solid var(--border);background:var(--bg-hover);display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-secondary);';
    banner.innerHTML = '<i class="fa-solid fa-reply" style="color:var(--primary);"></i><span style="flex:1;">Respondiendo a: <em>' + (msg.text||'[multimedia]').substring(0,40) + '</em></span><button onclick="cancelReply()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;">×</button>';
    if (bar) bar.parentNode.insertBefore(banner, bar);
    input._replyTo = { id: msgId, text: msg.text };
    input.focus();
};

window.cancelReply = function() {
    var b = document.getElementById('replyBanner'); if (b) b.remove();
    var i = document.getElementById('panelMsgInput'); if (i) i._replyTo = null;
};

window.copyMsg = function(msgId, toUsername) {
    var allMsgs = socialDB.messages[toUsername] || [];
    var msg = allMsgs.find(function(m) { return (m._id||m.id) === msgId; }); if (!msg || !msg.text) return;
    if (navigator.clipboard) navigator.clipboard.writeText(msg.text).then(function() { showToast('📋 Copiado'); });
    else showToast('📋 ' + msg.text.substring(0,30));
};

window.forwardMsg = function(msgId, toUsername) {
    var allMsgs = socialDB.messages[toUsername] || [];
    var msg = allMsgs.find(function(m) { return (m._id||m.id) === msgId; }); if (!msg) return;
    // Mostrar lista de amigos para reenviar
    var u = socialDB.currentUser;
    var overlay = document.getElementById('shareModalOverlay');
    overlay.innerHTML = '<div class="modal-box" style="max-width:360px;"><h2 style="margin-bottom:14px;">↪ Reenviar a...</h2>' +
        '<div style="max-height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;">' +
        (u.friends||[]).map(function(fn) {
            var f = socialDB.users.find(function(x) { return x.username === fn; });
            if (!f) return '';
            return '<div onclick="closeShareModal();sendForwardedMsg(\''+fn+'\',\''+msgId+'\',\''+toUsername+'\')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:var(--bg-input);cursor:pointer;touch-action:manipulation;">' +
                '<div style="width:38px;height:38px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;overflow:hidden;flex-shrink:0;">' + renderAvatar(f,38) + '</div>' +
                '<span style="font-weight:600;">' + f.name + '</span></div>';
        }).join('') +
        '</div><p class="close-text" onclick="closeShareModal()">Cancelar</p></div>';
    overlay.style.display = 'flex'; setTimeout(function() { overlay.classList.add('active'); },10);
};

window.sendForwardedMsg = function(toFriend, msgId, fromUser) {
    var allMsgs = socialDB.messages[fromUser] || [];
    var msg = allMsgs.find(function(m) { return (m._id||m.id) === msgId; }); if (!msg) return;
    var u = socialDB.currentUser;
    var text = '↪ ' + (msg.text || '[multimedia]');
    var newMsg = { id:'msg_'+Date.now(), from:u.username, to:toFriend, text:text, read:false, createdAt:new Date().toISOString() };
    addMsgToCache(toFriend, newMsg);
    if (socialDB.socket && socialDB.socket.connected) {
        socialDB.socket.emit('send_message', { to: toFriend, text: text });
    }
    showToast('✅ Reenviado');
};

window.pinMsg = function(msgId, toUsername) {
    var allMsgs = socialDB.messages[toUsername] || [];
    var msg = allMsgs.find(function(m) { return (m._id||m.id) === msgId; }); if (!msg) return;
    msg.pinned = !msg.pinned;
    openMessagePanel(toUsername);
    showToast(msg.pinned ? '📌 Mensaje fijado' : '📌 Mensaje desfijado');
};

window.translateMsg = function(msgId, toUsername) {
    var allMsgs = socialDB.messages[toUsername] || [];
    var msg = allMsgs.find(function(m) { return (m._id||m.id) === msgId; }); if (!msg || !msg.text) return showToast('⚠️ Sin texto para traducir');
    // Abrir Google Translate
    window.open('https://translate.google.com/?text=' + encodeURIComponent(msg.text), '_blank');
};

window.deleteMsg = function(msgId, toUsername) {
    if (!confirm('¿Eliminar este mensaje?')) return;
    var msgs = socialDB.messages[toUsername] || [];
    socialDB.messages[toUsername] = msgs.filter(function(m) { return (m._id||m.id) !== msgId; });
    openMessagePanel(toUsername);
    showToast('🗑️ Mensaje eliminado');
};

window.deleteConversation = function(toUsername) {
    if (!confirm('¿Eliminar toda la conversación con ' + toUsername + '?')) return;
    socialDB.messages[toUsername] = [];
    openMessagePanel(toUsername);
    renderMensajesList(document.getElementById('messagesList'), null);
    showToast('🗑️ Conversación eliminada');
};

window.reportMsg = function(msgId, toUsername) {
    showToast('🚩 Mensaje reportado. Gracias.');
};

// ── STICKERS EN CHAT ──────────────────────────────────────
window.togglePanelStickers = function() {
    var sp = document.getElementById('panelStickerPicker');
    var ep = document.getElementById('panelEmojiPicker');
    if (!sp) return;
    var showing = sp.style.display !== 'none';
    if (ep) ep.style.display = 'none';
    sp.style.display = showing ? 'none' : 'block';
};

window.showStickerCat = function(catIdx) {
    var grid = document.getElementById('stickerGrid'); if (!grid) return;
    var toUser = socialDB.activeMessageUser;
    grid.innerHTML = STICKERS[catIdx].items.map(function(s) {
        return '<div onclick="sendSticker(\''+s+'\',\''+toUser+'\')" style="font-size:22px;cursor:pointer;padding:6px;border-radius:8px;text-align:center;touch-action:manipulation;" onmouseenter="this.style.background=\'var(--bg-hover)\'" onmouseleave="this.style.background=\'\'">' + s + '</div>';
    }).join('');
    // Update tab styles
    STICKERS.forEach(function(_, i) {
        var btn = document.getElementById('stab-'+i);
        if (btn) { btn.style.background = i===catIdx?'var(--gradient)':'var(--bg-input)'; btn.style.color = i===catIdx?'#fff':'var(--text-secondary)'; }
    });
};

window.sendSticker = function(sticker, toUsername) {
    var u = socialDB.currentUser;
    var msg = { id:'msg_'+Date.now(), from:u.username, to:toUsername, text:sticker, type:'sticker', read:false, createdAt:new Date().toISOString() };
    appendMsgToPanel(msg);
    addMsgToCache(toUsername, msg);
    var sp = document.getElementById('panelStickerPicker'); if (sp) sp.style.display = 'none';
    if (socialDB.socket && socialDB.socket.connected) {
        socialDB.socket.emit('send_message', { to: toUsername, text: sticker });
    } else {
        api('POST', '/messages/send', { to: toUsername, text: sticker }).catch(function(){});
    }
};

// ── MULTIMEDIA EN CHAT ────────────────────────────────────
window.sendMediaMessage = function(input, toUsername) {
    if (!input.files[0]) return;
    var file = input.files[0];
    var isVideo = file.type.startsWith('video/');
    var reader = new FileReader();
    reader.onload = function(e) {
        var u = socialDB.currentUser;
        var msg = {
            id: 'msg_'+Date.now(), from: u.username, to: toUsername,
            text: isVideo ? '[Video]' : '[Imagen]',
            type: isVideo ? 'video' : 'image',
            media: e.target.result,
            read: false, createdAt: new Date().toISOString()
        };
        appendMsgToPanel(msg);
        addMsgToCache(toUsername, msg);
        showToast('📎 Enviando archivo...');
        api('POST', '/messages/send', { to: toUsername, text: msg.text, type: msg.type, media: msg.media })
        .then(function() { showToast('✅ Enviado'); })
        .catch(function() { showToast('⚠️ Error al enviar'); });
    };
    reader.readAsDataURL(file);
    input.value = '';
};

// ── NOTAS DE VOZ ──────────────────────────────────────────
var _voiceRecorder = null;
var _voiceChunks   = [];
var _voiceBlob     = null;

window.startVoiceNote = function(e) {
    e.preventDefault();
    if (_voiceRecorder && _voiceRecorder.state === 'recording') return;
    _voiceChunks = [];
    _voiceBlob   = null;

    var btn = document.getElementById('voiceNoteBtn');
    var icon = document.getElementById('voiceMicIcon');

    navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
        _voiceRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        _voiceRecorder.ondataavailable = function(ev) { if (ev.data.size > 0) _voiceChunks.push(ev.data); };
        _voiceRecorder.onstop = function() {
            _voiceBlob = new Blob(_voiceChunks, { type: 'audio/webm' });
            var url = URL.createObjectURL(_voiceBlob);
            var audio = document.getElementById('voicePreviewAudio');
            var previewBar = document.getElementById('voicePreviewBar');
            if (audio) audio.src = url;
            if (previewBar) previewBar.style.display = 'flex';
            // Detener tracks del micrófono
            stream.getTracks().forEach(function(t) { t.stop(); });
        };
        _voiceRecorder.start();
        if (btn)  btn.style.background  = 'rgba(255,77,77,.15)';
        if (icon) icon.style.color = '#ff4d4d';
        showToast('🎙️ Grabando... suelta para detener');
    }).catch(function() {
        showToast('⚠️ No se pudo acceder al micrófono');
    });
};

window.stopVoiceNote = function(e, toUsername) {
    e.preventDefault();
    if (_voiceRecorder && _voiceRecorder.state === 'recording') {
        _voiceRecorder.stop();
    }
    var btn = document.getElementById('voiceNoteBtn');
    var icon = document.getElementById('voiceMicIcon');
    if (btn)  btn.style.background = '';
    if (icon) icon.style.color = '';
};

window.sendVoiceNote = function(toUsername) {
    if (!_voiceBlob) return;
    var reader = new FileReader();
    reader.onload = function(e) {
        var u = socialDB.currentUser;
        var msg = {
            id: 'msg_'+Date.now(), from: u.username, to: toUsername,
            text: '[Nota de voz]', type: 'voice',
            media: e.target.result,
            read: false, createdAt: new Date().toISOString()
        };
        appendMsgToPanel(msg);
        addMsgToCache(toUsername, msg);
        discardVoiceNote();
        showToast('🎙️ Nota enviada');
        api('POST', '/messages/send', { to: toUsername, text: '[Nota de voz]', type: 'voice', media: msg.media })
        .catch(function() {});
    };
    reader.readAsDataURL(_voiceBlob);
};

window.discardVoiceNote = function() {
    _voiceBlob = null; _voiceChunks = [];
    var previewBar = document.getElementById('voicePreviewBar');
    var audio = document.getElementById('voicePreviewAudio');
    if (previewBar) previewBar.style.display = 'none';
    if (audio) { audio.pause(); audio.src = ''; }
    if (_voiceRecorder) { try { _voiceRecorder.stop(); } catch(e){} _voiceRecorder = null; }
};

// ── OVERRIDE: appendMsgToPanel con soporte multimedia ─────
function appendMsgToPanel(msg) {
    var panelMsgs = document.getElementById('panelMessages'); if (!panelMsgs) return;
    var empty = panelMsgs.querySelector('div[style*="text-align:center"]');
    if (empty) empty.remove();
    var u = socialDB.currentUser;
    var div = document.createElement('div');
    var isMe = msg.from === u.username;
    var idx = (socialDB.messages[socialDB.activeMessageUser]||[]).length;
    div.outerHTML; // no-op to trigger reparse below
    panelMsgs.insertAdjacentHTML('beforeend', buildMsgBubble(msg, idx, u, socialDB.activeMessageUser || ''));
    panelMsgs.scrollTop = panelMsgs.scrollHeight;
}

// ── OVERRIDE: sendPanelMessage con soporte de respuesta ───
window.sendPanelMessage = function(to) {
    var input = document.getElementById('panelMsgInput');
    if (!input) return;
    var text = (input.value || '').trim();
    if (!text) return;
    input.value = '';
    input.focus();

    var u = socialDB.currentUser;
    var replyTo = input._replyTo || null;
    input._replyTo = null;
    cancelReply();

    var msg = { id:'msg_'+Date.now(), from:u.username, to:to, text:text, type:'text', replyTo:replyTo, read:false, createdAt:new Date().toISOString() };
    appendMsgToPanel(msg);
    addMsgToCache(to, msg);

    if (socialDB.socket && socialDB.socket.connected) {
        socialDB.socket.emit('send_message', { to:to, text:text, replyTo:replyTo });
    } else {
        api('POST', '/messages/send', { to:to, text:text }).catch(function() { showToast('⚠️ Error al enviar'); });
    }
};

// Abre el panel de mensajes con un usuario
window.openMessagePanel = function(username) {
    socialDB.activeMessageUser = username;
    markMessagesRead(username);
    updateBadges();

    var panel = document.getElementById('messagesChatPanel'); if (!panel) return;
    var friend = socialDB.users.find(function(u) { return u.username === username; });
    var cached = getCachedConversation(username);

    // 1. Mostrar inmediatamente con lo que tenemos en caché
    if (friend) {
        renderMessagePanel(panel, friend, cached, username);
    } else {
        panel.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:200px;"><div class="reels-spinner"></div></div>';
    }

    // 2. Cargar mensajes frescos del backend en background
    api('GET', '/messages/' + username)
    .then(function(data) {
        var serverMsgs = data.messages || [];
        // Fusionar: conservar mensajes locales pendientes no confirmados aún
        var serverIds = serverMsgs.map(function(m) { return m._id || m.id; });
        var localPending = cached.filter(function(m) {
            return (m.id||'').indexOf('msg_') === 0 && serverIds.indexOf(m.id) === -1;
        });
        var merged = serverMsgs.concat(localPending).sort(function(a,b) {
            return new Date(a.createdAt) - new Date(b.createdAt);
        });
        socialDB.messages[username] = merged;

        if (!friend) {
            api('GET', '/users/' + username).then(function(d) {
                if (d.ok) {
                    friend = d.user;
                    if (!socialDB.users.find(function(u) { return u.username === username; })) {
                        socialDB.users.push(friend);
                    }
                    renderMessagePanel(panel, friend, merged, username);
                }
            });
        } else {
            renderMessagePanel(panel, friend, merged, username);
        }
    })
    .catch(function() {
        if (friend) renderMessagePanel(panel, friend, cached, username);
    });
};

// ── 19. CHAT FLOTANTE ────────────────────────────────────
var EMOJIS = [
    '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩',
    '😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐',
    '🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒',
    '🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐',
    '😕','😟','🙁','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱',
    '😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','💀','💩','🤡','👹',
    '👺','👻','👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾',
    '👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌','🤞','🤟','🤘','🤙','👈','👉','👆',
    '🖕','👇','☝','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏',
    '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖',
    '💘','💝','💟','☮️','✝️','☯️','🕊️','🌟','⭐','💫','✨','🔥','🎉','🎊','🎈','🎁',
    '🚀','💡','🏆','🎯','🎮','🎬','🎵','🎶','🍕','🍔','🍦','☕','🍺','🥂'
];

window.togglePanelEmoji = function() {
    var ep = document.getElementById('panelEmojiPicker');
    var sp = document.getElementById('panelStickerPicker');
    if (!ep) return;
    var showing = ep.style.display !== 'none';
    if (sp) sp.style.display = 'none';
    ep.style.display = showing ? 'none' : 'block';
};
window.insertPanelEmoji = function(e) {
    var i = document.getElementById('panelMsgInput');
    if (i) { i.value += e; i.focus(); }
    var ep = document.getElementById('panelEmojiPicker'); if (ep) ep.style.display='none';
};

window.openChatWith = function(username) {
    socialDB.activeChatUser = username;
    var friend = socialDB.users.find(function(u) { return u.username === username; });
    if (!friend) {
        api('GET', '/users/' + username).then(function(d) {
            if (d.ok) {
                friend = d.user;
                if (!socialDB.users.find(function(u) { return u.username === username; })) socialDB.users.push(friend);
                openChatWith(username);
            }
        });
        return;
    }
    document.getElementById('chatUserName').textContent = friend.name;
    var av = document.getElementById('chatAvatar');
    av.innerHTML = renderAvatar(friend, 34);
    if (!friend.profilePic) av.style.background = 'rgba(255,255,255,.3)';
    var cw = document.getElementById('chatWindow');
    cw.style.display = 'flex';
    cw.style.flexDirection = 'column';
    cw.classList.remove('minimized'); // abrir siempre expandido

    // Cargar mensajes del backend
    api('GET', '/messages/' + username).then(function(data) {
        var msgs = data.messages || [];
        socialDB.messages[username] = msgs;
        renderChatMessages();
    }).catch(function() {
        renderChatMessages();
    });

    var grid = document.getElementById('emojiGrid');
    if (grid && grid.children.length === 0) {
        grid.innerHTML = EMOJIS.map(function(e) {
            return '<button class="emoji-btn" onclick="insertEmoji(\'' + e + '\')">' + e + '</button>';
        }).join('');
    }
};

window.toggleMinimizeChat = function() {
    var cw  = document.getElementById('chatWindow');
    var btn = document.getElementById('chatMinimizeBtn');
    if (!cw) return;
    var isMin = cw.classList.contains('minimized');
    cw.classList.toggle('minimized');
    if (btn) btn.textContent = isMin ? '⌄' : '⌃';
    if (btn) btn.title = isMin ? 'Minimizar' : 'Expandir';
};
function renderChatMessages() {
    var container = document.getElementById('chatMessages');
    if (!container || !socialDB.activeChatUser) return;
    var u = socialDB.currentUser;
    var msgs = getCachedConversation(socialDB.activeChatUser);
    container.innerHTML = msgs.length === 0
        ? '<div style="text-align:center;color:var(--text-muted);font-size:13px;margin-top:20px;">Inicia la conversación 👋</div>'
        : msgs.map(function(m) {
            var isMe = m.from === u.username;
            return '<div class="msg ' + (isMe?'msg-me':'msg-them') + '">' + m.text + '<div class="msg-time">' + timeAgo(m.createdAt) + '</div></div>';
          }).join('');
    container.scrollTop = container.scrollHeight;
}
window.sendMessage = function() {
    var input = document.getElementById('chatInput');
    if (!input || !input.value.trim() || !socialDB.activeChatUser) return;
    var text = input.value.trim();
    input.value = '';

    var u = socialDB.currentUser;
    var msg = {
        id: 'msg_' + Date.now(),
        from: u.username,
        to: socialDB.activeChatUser,
        text: text,
        read: false,
        createdAt: new Date().toISOString()
    };

    addMsgToCache(socialDB.activeChatUser, msg);
    renderChatMessages();

    if (socialDB.socket && socialDB.socket.connected) {
        socialDB.socket.emit('send_message', { to: socialDB.activeChatUser, text: text });
    } else {
        api('POST', '/messages/send', { to: socialDB.activeChatUser, text: text }).catch(function(){});
    }
};
window.closeChat = function() { document.getElementById('chatWindow').style.display = 'none'; socialDB.activeChatUser = null; };
window.toggleEmojiPicker = function() { var p = document.getElementById('emojiPicker'); if (p) p.style.display = p.style.display==='none'?'block':'none'; };
window.insertEmoji = function(e) { var i = document.getElementById('chatInput'); if (i) { i.value+=e; i.focus(); } };

// ── 20. REELS ────────────────────────────────────────────
var REEL_CATEGORIES = [
    { id:'cocina',      label:'🍳 Cocina',        query:'recetas cocina shorts' },
    { id:'influencers', label:'⭐ Influencers',    query:'influencer trending shorts' },
    { id:'carros',      label:'🚗 Carros',         query:'autos coches carros shorts' },
    { id:'deporte',     label:'⚽ Deporte',        query:'deporte highlights goles shorts' },
    { id:'musica',      label:'🎵 Música',         query:'musica shorts 2024',
      subs:[
        { id:'reggaeton',  label:'🔥 Reggaeton',   query:'reggaeton shorts 2024' },
        { id:'pop',        label:'🎤 Pop',          query:'pop music shorts' },
        { id:'rock',       label:'🎸 Rock',         query:'rock music shorts' },
        { id:'clasica',    label:'🎻 Clásica',      query:'musica clasica shorts' },
        { id:'electronica',label:'🎧 Electrónica',  query:'electronic dance music shorts' },
        { id:'jazz',       label:'🎷 Jazz',         query:'jazz music shorts' },
        { id:'hiphop',     label:'🎤 Hip-Hop',      query:'hip hop rap shorts' },
        { id:'salsa',      label:'💃 Salsa',        query:'salsa cumbia bachata shorts' },
        { id:'kpop',       label:'🇰🇷 K-Pop',      query:'kpop shorts 2024' },
      ]},
    { id:'tecnologia',  label:'💻 Tecnología',    query:'tecnologia gadgets tech shorts' },
    { id:'ciencia',     label:'🔬 Ciencia',       query:'ciencia experimentos curiosidades shorts' },
    { id:'fe',          label:'✝️ Fe Cristiana',  query:'fe cristiana reflexion cristiana shorts' },
    { id:'juegos',      label:'🎮 Videojuegos',   query:'videojuegos gaming shorts' },
    { id:'gamers',      label:'🕹️ Gamers',        query:'gamers gameplay funny shorts' },
    { id:'series',      label:'📺 Series',        query:'series trailer 2024 shorts' },
    { id:'fitness',     label:'💪 Fitness',       query:'fitness gym workout shorts' },
    { id:'viajes',      label:'✈️ Viajes',        query:'viajes travel vlog shorts' },
    { id:'arte',        label:'🎨 Arte',          query:'arte dibujo pintura shorts' },
    { id:'humor',       label:'😂 Humor',         query:'humor memes funny shorts' },
    { id:'naturaleza',  label:'🌿 Naturaleza',    query:'naturaleza animales wildlife shorts' },
    { id:'mascotas',    label:'🐶 Mascotas',      query:'mascotas perros gatos cute shorts' },
    { id:'moda',        label:'👗 Moda',          query:'moda fashion outfit shorts' },
];

var YOUTUBE_POOL = {
    cocina:['LsoLEjrDogU','9bZkp7q19f0','J---aiyznGQ'], influencers:['JGwWNGJdvx8','kJQP7kiw5Fk','fJ9rUzIMcZQ'],
    carros:['YqeW9_5kURI','2Vv-BfVoq4g','pRpeEdMmmQ0'], deporte:['OPf0YbXqDm0','hT_nvWreIhg','CevxZvSJLk8'],
    musica:['RgKAFK5djSk','nfWlot6h_JM','60ItHLz5WEA'], tecnologia:['kffacxfA7G4','09839DpTctU','bxqLsrlakK8'],
    ciencia:['9bZkp7q19f0','2vjPBrBU-TM','ZbZSe6N_BXs'], fe:['r7ywq4WMpd4','uelHwf8o7_U','IcrbM1l_BoI'],
    juegos:['9HDEHj2yzew','xvFZjo5PgG0','j4VLqy8VbY4'], gamers:['xvFZjo5PgG0','j4VLqy8VbY4','5IcR92MKMo4'],
    series:['hT_nvWreIhg','NUsoVlDFqZg','OPf0YbXqDm0'], reggaeton:['nfWlot6h_JM','kJQP7kiw5Fk','fJ9rUzIMcZQ'],
    pop:['RgKAFK5djSk','60ItHLz5WEA','JGwWNGJdvx8'], rock:['CevxZvSJLk8','2Vv-BfVoq4g','YqeW9_5kURI'],
    clasica:['pRpeEdMmmQ0','r7ywq4WMpd4','ZbZSe6N_BXs'], electronica:['OPf0YbXqDm0','kffacxfA7G4','09839DpTctU'],
    jazz:['bxqLsrlakK8','09839DpTctU','5IcR92MKMo4'], hiphop:['kffacxfA7G4','CevxZvSJLk8','YqeW9_5kURI'],
    salsa:['9bZkp7q19f0','LsoLEjrDogU','OPf0YbXqDm0'], kpop:['fJ9rUzIMcZQ','JGwWNGJdvx8','kJQP7kiw5Fk'],
    fitness:['5IcR92MKMo4','j4VLqy8VbY4','2vjPBrBU-TM'], viajes:['NUsoVlDFqZg','bxqLsrlakK8','IcrbM1l_BoI'],
    arte:['uelHwf8o7_U','ZbZSe6N_BXs','r7ywq4WMpd4'], humor:['xvFZjo5PgG0','9HDEHj2yzew','J---aiyznGQ'],
    naturaleza:['2vjPBrBU-TM','ZbZSe6N_BXs','pRpeEdMmmQ0'], mascotas:['IcrbM1l_BoI','uelHwf8o7_U','hT_nvWreIhg'],
    moda:['60ItHLz5WEA','nfWlot6h_JM','RgKAFK5djSk']
};

// Videos locales subidos por usuarios
var userReels = JSON.parse(localStorage.getItem('social_user_reels') || '[]');

var MUSIC_TRACKS = [
    { title:'Summer Vibes — Globalink Originals',    id:'music1' },
    { title:'Electric Dream — Free Beats Studio',    id:'music2' },
    { title:'Sunset Drive — Royalty Free Music',     id:'music3' },
    { title:'Urban Pulse — Free Music Archive',      id:'music4' },
    { title:'Chill Wave — Creative Commons',         id:'music5' },
    { title:'Latin Fire — Open Music Library',       id:'music6' },
    { title:'Acoustic Morning — Free Sounds',        id:'music7' },
    { title:'Night City — CC0 Music',                id:'music8' },
];

function shuffle(arr) {
    var a = arr.slice();
    for (var i=a.length-1; i>0; i--) { var j=Math.floor(Math.random()*(i+1)); var tmp=a[i]; a[i]=a[j]; a[j]=tmp; }
    return a;
}
function getVideoIds(prefs) {
    var ids = [];
    prefs.forEach(function(p) { (YOUTUBE_POOL[p]||YOUTUBE_POOL['musica']).forEach(function(id) { if (ids.indexOf(id)===-1) ids.push(id); }); });
    return shuffle(ids);
}
function getQueryForPrefs(prefs) {
    var queries = [];
    prefs.forEach(function(p) { REEL_CATEGORIES.forEach(function(c) { if (c.id===p) queries.push(c.query); if (c.subs) c.subs.forEach(function(s) { if (s.id===p) queries.push(s.query); }); }); });
    return queries.length > 0 ? queries[Math.floor(Math.random()*queries.length)] : 'shorts trending';
}
function getWeightedPrefs() {
    var prefs = socialDB.reelPrefs; if (!prefs.length) return ['musica'];
    var history = socialDB.reelHistory; var weighted = [];
    prefs.forEach(function(p) { var c = Math.ceil((history[p]||1)/2); for (var i=0;i<c;i++) weighted.push(p); });
    weighted = shuffle(weighted);
    var unique = []; weighted.forEach(function(x) { if (unique.indexOf(x)===-1) unique.push(x); });
    return unique.slice(0,3);
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
    area.innerHTML =
        '<div class="reels-player-container" id="reelsPlayer">' +
        '<div class="reels-header">' +
        '<span style="font-weight:700;font-size:16px;">🎬 Reels para ti</span>' +
        '<div style="display:flex;gap:8px;">' +
        '<button class="btn-outline" onclick="openReelEditorModal()" style="padding:7px 14px;font-size:13px;"><i class="fa-solid fa-circle-plus"></i> Subir</button>' +
        '<button class="btn-outline" onclick="openReelPrefsModal()" style="padding:7px 14px;font-size:13px;"><i class="fa-solid fa-sliders"></i> Prefs</button>' +
        '</div></div>' +
        '<div class="reels-scroll" id="reelsScroll"><div id="reelsContent">' +
        '<div class="reels-loading" id="reelsInitialLoading"><div class="reels-spinner"></div><p>Cargando contenido para ti...</p></div>' +
        '</div></div></div>';

    socialDB.reelPage = 0;
    loadMoreReels(true);

    var scroll = document.getElementById('reelsScroll');
    if (scroll) {
        scroll.addEventListener('scroll', function() {
            if (scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 400) loadMoreReels(false);
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
        var il = document.getElementById('reelsInitialLoading'); if (il) il.remove();
        var ml = document.getElementById('reelsLoadMore'); if (ml) ml.remove();

        var prefs   = getWeightedPrefs();
        var videoIds = getVideoIds(prefs);
        var query   = getQueryForPrefs(prefs);

        // Insertar reels de usuarios locales primero (si página 0)
        if (initial && userReels.length > 0) {
            userReels.slice().reverse().forEach(function(reel) {
                content.appendChild(buildUserReelCard(reel));
            });
        }

        for (var i=0; i<5; i++) {
            var vid = videoIds[(socialDB.reelPage*5+i) % (videoIds.length||1)];
            content.appendChild(buildYTReelCard(vid, query, socialDB.reelPage*5+i));
        }
        socialDB.reelPage++; socialDB.reelLoading = false;
        setTimeout(function() { setupReelObserver(); }, 400);
    }, 700);
}

function buildUserReelCard(reel) {
    var div = document.createElement('div'); div.className = 'reel-card-full'; div.dataset.videoId = 'user_' + reel.id;
    var u = socialDB.currentUser;
    var author = getUser(reel.authorUsername) || { name:reel.authorName, profilePic:'', username:reel.authorUsername, friends:[] };
    var reelId = reel.id;
    var likes = reel.likes || [];
    var liked  = likes.indexOf(u.username) !== -1;
    var comments = (socialDB.reelComments[reelId] || []).length;
    var music = reel.music || '';
    var isMe = reel.authorUsername === u.username;
    var isFriend = (u.friends||[]).indexOf(reel.authorUsername) !== -1;
    var pendingReq = socialDB.friendRequests.find(function(r) { return r.from===u.username && r.to===reel.authorUsername && r.status==='pending'; });

    // Botón de acción del autor
    var authorActionBtn = '';
    if (!isMe) {
        if (isFriend) {
            authorActionBtn = '<button onclick="openChatWith(\'' + reel.authorUsername + '\')" style="background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.6);color:#fff;padding:5px 12px;border-radius:15px;font-size:12px;font-family:inherit;cursor:pointer;"><i class="fa-solid fa-message" style="margin-right:4px;"></i>Mensaje</button>';
        } else if (pendingReq) {
            authorActionBtn = '<button disabled style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.3);color:rgba(255,255,255,.6);padding:5px 12px;border-radius:15px;font-size:12px;font-family:inherit;">Enviada</button>';
        } else {
            authorActionBtn = '<button onclick="sendFriendRequest(\'' + reel.authorUsername + '\');this.textContent=\'Enviada\';this.disabled=true;this.style.opacity=\'0.6\';" style="background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.6);color:#fff;padding:5px 12px;border-radius:15px;font-size:12px;font-family:inherit;cursor:pointer;"><i class="fa-solid fa-user-plus" style="margin-right:4px;"></i>Seguir</button>';
        }
    }

    div.innerHTML =
        '<div class="reel-video-frame">' +
        '<video class="reel-video-element" id="rvid-' + reelId + '" src="' + reel.src + '" loop playsinline onclick="toggleReelPlay(\'' + reelId + '\')" style="cursor:pointer;z-index:2;position:relative;"></video>' +
        '<div class="reel-play-overlay" id="rov-' + reelId + '" onclick="toggleReelPlay(\'' + reelId + '\')" style="z-index:3;">' +
        '<div class="reel-play-btn" id="rpbtn-' + reelId + '"><i class="fa-solid fa-play"></i></div></div>' +
        '<div class="reel-progress-bar" id="rpbar-' + reelId + '" onclick="seekReel(event,\'' + reelId + '\')">' +
        '<div class="reel-progress-fill" id="rpfill-' + reelId + '"></div></div>' +
        '<button class="reel-volume-btn" onclick="toggleVolumeSlider(\'' + reelId + '\')" title="Volumen"><i class="fa-solid fa-volume-high"></i></button>' +
        '<div class="reel-volume-slider-wrap" id="rvslide-' + reelId + '"><input type="range" class="reel-volume-slider" id="rvol-' + reelId + '" min="0" max="1" step="0.05" value="' + (reel.musicVolume||1) + '" oninput="setReelVolume(this,\'' + reelId + '\')" onclick="event.stopPropagation()"></div>' +
        '<div class="reel-seek-left" onclick="seekReelBack(\'' + reelId + '\')" title="-10s"></div>' +
        '<div class="reel-seek-right" onclick="seekReelFwd(\'' + reelId + '\')" title="+10s"></div>' +
        '</div>' +
        '<div class="reel-card-overlay"></div>' +
        '<div class="reel-card-info">' +
        '<div class="reel-author-row">' +
        '<div onclick="openReelAuthorProfile(\'' + reel.authorUsername + '\')" style="width:42px;height:42px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:15px;overflow:hidden;cursor:pointer;border:2px solid rgba(255,255,255,.6);flex-shrink:0;">' + renderAvatar(author,42) + '</div>' +
        '<div style="cursor:pointer;" onclick="openReelAuthorProfile(\'' + reel.authorUsername + '\')">' +
        '<div style="font-weight:700;color:#fff;font-size:14px;">' + author.name + '</div>' +
        '<div style="font-size:11px;color:rgba(255,255,255,.7);">@' + (author.username||reel.authorUsername) + '</div>' +
        '</div>' +
        authorActionBtn +
        '</div>' +
        (reel.text ? '<div style="font-size:14px;color:#fff;margin-top:6px;text-shadow:0 1px 4px rgba(0,0,0,.7);">' + reel.text + '</div>' : '') +
        (music ? '<div class="reel-music-bar"><div class="reel-music-icon"><i class="fa-solid fa-music"></i></div><div class="reel-music-title">' + music + '</div></div>' : '') +
        '</div>' +
        '<div class="reel-side-actions">' +
        '<div class="reel-action-btn" id="rlike-' + reelId + '" onclick="toggleReelLike(\'' + reelId + '\')">' +
        '<i class="fa-heart ' + (liked?'fa-solid rli':'fa-regular rli') + '" style="font-size:26px;color:' + (liked?'#ff4d4d':'#fff') + ';"></i><span class="rcnt">' + likes.length + '</span></div>' +
        '<div class="reel-action-btn" onclick="openReelComments(\'' + reelId + '\')"><i class="fa-regular fa-comment" style="font-size:26px;color:#fff;"></i><span>' + comments + '</span></div>' +
        '<div class="reel-action-btn" onclick="openYouTubeSearch(\'shorts\')"><i class="fa-solid fa-share-nodes" style="font-size:24px;color:#fff;"></i><span>Compartir</span></div>' +
        '</div>';
    // Progreso de video
    setTimeout(function() {
        var v = document.getElementById('rvid-' + reelId);
        if (!v) return;
        v.volume = reel.musicVolume || 1;
        v.addEventListener('timeupdate', function() {
            var fill = document.getElementById('rpfill-' + reelId);
            if (fill && v.duration) fill.style.width = (v.currentTime/v.duration*100) + '%';
        });
        v.addEventListener('play', function() {
            var btn = document.getElementById('rpbtn-' + reelId);
            var ov  = document.getElementById('rov-' + reelId);
            if (btn) btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            if (ov) ov.classList.add('hidden-overlay');
        });
        v.addEventListener('pause', function() {
            var btn = document.getElementById('rpbtn-' + reelId);
            var ov  = document.getElementById('rov-' + reelId);
            if (btn) btn.innerHTML = '<i class="fa-solid fa-play"></i>';
            if (ov) ov.classList.remove('hidden-overlay');
        });
    }, 100);
    return div;
}

window.toggleReelPlay = function(reelId) {
    var v = document.getElementById('rvid-' + reelId); if (!v) return;
    if (v.paused) v.play(); else v.pause();
};
window.seekReelBack = function(reelId) {
    var v = document.getElementById('rvid-' + reelId); if (v) v.currentTime = Math.max(0, v.currentTime - 10);
};
window.seekReelFwd = function(reelId) {
    var v = document.getElementById('rvid-' + reelId); if (v) v.currentTime = Math.min(v.duration, v.currentTime + 10);
};
window.seekReel = function(event, reelId) {
    var bar = document.getElementById('rpbar-' + reelId); var v = document.getElementById('rvid-' + reelId);
    if (!bar || !v || !v.duration) return;
    var rect = bar.getBoundingClientRect();
    var pct = (event.clientX - rect.left) / rect.width;
    v.currentTime = pct * v.duration;
};
window.toggleVolumeSlider = function(reelId) {
    var wrap = document.getElementById('rvslide-' + reelId); if (!wrap) return;
    wrap.classList.toggle('show');
};
window.setReelVolume = function(slider, reelId) {
    var v = document.getElementById('rvid-' + reelId); if (v) v.volume = parseFloat(slider.value);
};

window.toggleReelLike = function(reelId) {
    var u = socialDB.currentUser;
    var reel = userReels.find(function(r) { return r.id === reelId; }); if (!reel) return;
    if (!reel.likes) reel.likes = [];
    var idx = reel.likes.indexOf(u.username);
    if (idx === -1) reel.likes.push(u.username); else reel.likes.splice(idx, 1);
    localStorage.setItem('social_user_reels', JSON.stringify(userReels));
    var likeBtn = document.getElementById('rlike-' + reelId);
    if (likeBtn) {
        var icon = likeBtn.querySelector('.rli'); var cnt = likeBtn.querySelector('.rcnt');
        if (icon) { var liked = reel.likes.indexOf(u.username) !== -1; icon.className = 'fa-heart ' + (liked?'fa-solid rli':'fa-regular rli'); icon.style.color = liked?'#ff4d4d':'#fff'; }
        if (cnt) cnt.textContent = reel.likes.length;
    }
};

window.openReelComments = function(reelId) {
    socialDB.activeReelId = reelId;
    var u = socialDB.currentUser;
    var comments = socialDB.reelComments[reelId] || [];
    var overlay = document.getElementById('reelCommentsOverlay'); if (!overlay) return;
    function renderCommentsHTML() {
        return '<div class="reel-comments-panel">' +
            '<h3>💬 Comentarios (' + comments.length + ')</h3>' +
            (comments.length === 0 ? '<p style="color:var(--text-muted);font-size:14px;text-align:center;margin:20px 0;">Sin comentarios aún. ¡Sé el primero!</p>' :
                comments.map(function(c) {
                    return '<div class="reel-comment-item"><div style="width:32px;height:32px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;overflow:hidden;flex-shrink:0;">' + renderAvatar(getUser(c.authorUsername)||{name:c.authorName,profilePic:''},32) + '</div>' +
                        '<div class="reel-comment-body"><strong>' + c.authorName + '</strong>' + c.content + '<div style="font-size:11px;color:var(--text-muted);margin-top:3px;">' + timeAgo(c.createdAt) + '</div></div></div>';
                }).join('')) +
            '<div class="reel-comment-input-row">' +
            '<input type="text" id="reelCommentInput" placeholder="Escribe un comentario..." onkeydown="if(event.key===\'Enter\') submitReelComment()">' +
            '<button class="btn-join" onclick="submitReelComment()" style="padding:8px 16px;flex-shrink:0;">Enviar</button></div>' +
            '<p class="close-text" onclick="closeReelComments()" style="margin-top:12px;text-align:center;">Cerrar</p></div>';
    }
    overlay.innerHTML = renderCommentsHTML();
    overlay.style.display = 'flex';
    setTimeout(function() { overlay.classList.add('active'); }, 10);
};
window.submitReelComment = function() {
    var input = document.getElementById('reelCommentInput'); if (!input||!input.value.trim()) return;
    var reelId = socialDB.activeReelId; var u = socialDB.currentUser;
    if (!socialDB.reelComments[reelId]) socialDB.reelComments[reelId] = [];
    socialDB.reelComments[reelId].push({ authorUsername:u.username, authorName:u.name, content:input.value.trim(), createdAt:new Date().toISOString() });
    saveDB(); openReelComments(reelId);
};
window.closeReelComments = function() {
    var ov = document.getElementById('reelCommentsOverlay'); if (!ov) return;
    ov.classList.remove('active'); setTimeout(function() { ov.style.display='none'; ov.innerHTML=''; }, 400);
};

// Panel de perfil del autor en vista de reel
window.openReelAuthorProfile = function(username) {
    var person = getUser(username); if (!person) return;
    var u = socialDB.currentUser;
    var personPosts = socialDB.posts.filter(function(p) { return p.authorUsername === username; });
    var isFriend    = (u.friends||[]).indexOf(username) !== -1;
    var isMe        = username === u.username;
    var pending     = socialDB.friendRequests.find(function(r) { return r.from===u.username && r.to===username && r.status==='pending'; });
    var personReels = userReels.filter(function(r) { return r.authorUsername === username; });

    var overlay = document.getElementById('reelCommentsOverlay'); if (!overlay) return;

    var actionHTML = '';
    if (!isMe) {
        if (isFriend) {
            actionHTML = '<button class="btn-join" onclick="openChatWith(\'' + username + '\');closeReelAuthorProfile();" style="flex:1;padding:10px;font-size:14px;"><i class="fa-solid fa-message"></i> Mensaje</button>';
        } else if (pending) {
            actionHTML = '<button class="btn-outline" disabled style="flex:1;padding:10px;opacity:.6;font-size:14px;"><i class="fa-solid fa-clock"></i> Enviada</button>';
        } else {
            actionHTML = '<button class="btn-join" id="reelFollowBtn" onclick="sendFriendRequest(\'' + username + '\');document.getElementById(\'reelFollowBtn\').outerHTML=\'<button class=btn-outline disabled style=flex:1;padding:10px;opacity:.6;font-size:14px;><i class=fa-solid fa-clock></i> Enviada</button>\';" style="flex:1;padding:10px;font-size:14px;"><i class="fa-solid fa-user-plus"></i> Seguir</button>';
        }
    }

    overlay.innerHTML = '<div class="reel-comments-panel" style="max-width:420px;">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">' +
        '<button onclick="closeReelAuthorProfile()" style="background:none;border:none;font-size:18px;color:var(--text-muted);cursor:pointer;"><i class="fa-solid fa-arrow-left"></i></button>' +
        '<span style="font-weight:700;font-size:16px;">Perfil</span></div>' +
        // Cover mini
        '<div style="height:80px;background:' + (person.coverPic ? 'url('+person.coverPic+') center/cover' : 'var(--gradient)') + ';border-radius:14px;position:relative;margin-bottom:44px;">' +
        '<div style="position:absolute;bottom:-36px;left:16px;width:72px;height:72px;border-radius:50%;border:3px solid var(--bg-card);overflow:hidden;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:24px;">' + renderAvatar(person,72) + '</div>' +
        '</div>' +
        '<div style="padding:0 4px;">' +
        '<div style="font-size:19px;font-weight:800;margin-bottom:2px;">' + person.name + '</div>' +
        '<div style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">@' + person.username + '</div>' +
        (person.bio ? '<div style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;line-height:1.5;">' + person.bio + '</div>' : '') +
        '<div style="display:flex;gap:20px;padding:12px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);margin-bottom:14px;">' +
        [['Posts', personPosts.length], ['Seguidores', (person.followers||[]).length], ['Amigos', (person.friends||[]).length], ['Reels', personReels.length]].map(function(item) {
            return '<div style="text-align:center;"><div style="font-size:17px;font-weight:800;color:var(--primary);">' + item[1] + '</div><div style="font-size:11px;color:var(--text-muted);">' + item[0] + '</div></div>';
        }).join('') +
        '</div>' +
        (actionHTML ? '<div style="display:flex;gap:10px;margin-bottom:16px;">' + actionHTML + '</div>' : '') +
        // Grid de posts/reels recientes
        (personPosts.length > 0 || personReels.length > 0 ?
            '<div style="font-weight:700;font-size:13px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Publicaciones recientes</div>' +
            '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;max-height:180px;overflow-y:auto;">' +
            personPosts.slice(0,6).map(function(p) {
                return p.media
                    ? '<img src="' + p.media + '" onclick="closeReelAuthorProfile();openFullscreen(\'' + p.media + '\')" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;cursor:pointer;">'
                    : '<div style="background:var(--bg-input);border-radius:6px;aspect-ratio:1;display:flex;align-items:center;justify-content:center;padding:5px;font-size:10px;color:var(--text-secondary);text-align:center;overflow:hidden;">' + (p.content?p.content.substring(0,40):'...') + '</div>';
            }).join('') + '</div>' : '<div style="text-align:center;color:var(--text-muted);font-size:13px;padding:20px 0;">Sin publicaciones aún.</div>'
        ) +
        '</div>' +
        '<p class="close-text" onclick="closeReelAuthorProfile()" style="text-align:center;margin-top:14px;">Cerrar</p>' +
        '</div>';

    overlay.style.display = 'flex';
    setTimeout(function() { overlay.classList.add('active'); }, 10);
};
window.closeReelAuthorProfile = function() {
    var ov = document.getElementById('reelCommentsOverlay'); if (!ov) return;
    ov.classList.remove('active'); setTimeout(function() { ov.style.display='none'; ov.innerHTML=''; }, 400);
};

function buildYTReelCard(videoId, query, index) {
    var div = document.createElement('div'); div.className = 'reel-card-full'; div.dataset.videoId = videoId;
    var prefs = socialDB.reelPrefs;
    var cat = null; REEL_CATEGORIES.forEach(function(c) { if (prefs.indexOf(c.id)!==-1 && !cat) cat=c; }); cat = cat||REEL_CATEGORIES[0];
    var authors = ['@CreatorPro','@TrendingNow','@ViralShorts','@TopContent','@MustWatch','@Globalink','@ContentKing'];
    var author = authors[index%authors.length];
    var likes  = Math.floor(Math.random()*9000+500);
    var comms  = Math.floor(Math.random()*900+50);
    var tagStr = prefs.slice(0,3).map(function(p) { return '#'+p; }).join(' ');
    div.innerHTML =
        '<div class="reel-video-frame" id="reel-frame-' + videoId + '-' + index + '">' +
        '<div class="reel-thumb-placeholder" id="thumb-' + videoId + '-' + index + '">' +
        '<img src="https://img.youtube.com/vi/' + videoId + '/hqdefault.jpg" onerror="this.style.display=\'none\'" style="width:100%;height:100%;object-fit:cover;">' +
        '<div class="reel-play-overlay" onclick="loadYTVideo(\'' + videoId + '\',\'' + index + '\')">' +
        '<div class="reel-play-btn"><i class="fa-solid fa-play"></i></div></div></div></div>' +
        '<div class="reel-card-overlay"></div>' +
        '<div class="reel-card-info">' +
        '<div class="reel-author-row">' +
        '<div style="width:36px;height:36px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;">▶</div>' +
        '<div><div style="font-weight:700;color:#fff;">' + author + '</div><div style="font-size:12px;color:rgba(255,255,255,.7);">' + cat.label + '</div></div>' +
        '<button onclick="openYouTubeSearch(\'' + query + '\')" style="background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.4);color:#fff;padding:5px 12px;border-radius:15px;font-size:12px;font-family:inherit;">Ver más</button>' +
        '</div><div style="font-size:13px;color:rgba(255,255,255,.85);margin-top:6px;">' + tagStr + ' #shorts</div></div>' +
        '<div class="reel-side-actions">' +
        '<div class="reel-action-btn" onclick="this.querySelector(\'.rli\').classList.toggle(\'fa-regular\');this.querySelector(\'.rli\').classList.toggle(\'fa-solid\');this.querySelector(\'.rcnt\').textContent=parseInt(this.querySelector(\'.rcnt\').textContent)+(this.querySelector(\'.rli\').classList.contains(\'fa-solid\')?1:-1);">' +
        '<i class="fa-heart fa-regular rli" style="font-size:26px;color:#fff;"></i><span class="rcnt">' + likes + '</span></div>' +
        '<div class="reel-action-btn" onclick="showToast(\'💬 Sólo disponible en reels propios\')"><i class="fa-regular fa-comment" style="font-size:26px;color:#fff;"></i><span>' + comms + '</span></div>' +
        '<div class="reel-action-btn" onclick="openYouTubeSearch(\'' + query + '\')"><i class="fa-brands fa-youtube" style="font-size:26px;color:#ff0000;"></i><span>YouTube</span></div>' +
        '<div class="reel-action-btn" onclick="shareReel(\'' + query + '\')"><i class="fa-solid fa-share-nodes" style="font-size:24px;color:#fff;"></i><span>Compartir</span></div>' +
        '</div>';
    return div;
}

window.loadYTVideo = function(videoId, index) {
    var thumb = document.getElementById('thumb-' + videoId + '-' + index); if (!thumb) return;
    trackCategoryView(videoId);
    thumb.innerHTML = '<iframe src="https://www.youtube.com/embed/' + videoId + '?autoplay=1&mute=0&rel=0&modestbranding=1&playsinline=1" allow="autoplay;encrypted-media;fullscreen;picture-in-picture" allowfullscreen style="width:100%;height:100%;border:none;pointer-events:auto;"></iframe>';
    thumb.style.cursor = 'default';
};
window.openYouTubeSearch = function(q) { window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(q) + '&sp=EgIQAQ%3D%3D','_blank'); };
window.shareReel = function(q) {
    var url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(function() { showToast('🔗 Enlace copiado'); });
    else showToast('🔗 Compartido');
};

function setupReelObserver() {
    if (!window.IntersectionObserver) return;
    var cards = document.querySelectorAll('.reel-card-full:not([data-observed])');
    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                var vid = entry.target.dataset.videoId;
                if (vid && vid.indexOf('user_') === 0) {
                    // Auto-play user video
                    var reelId = vid.replace('user_','');
                    var v = document.getElementById('rvid-' + reelId);
                    if (v && v.paused) v.play().catch(function() {});
                } else {
                    trackCategoryView(vid);
                }
            } else {
                // Pause when out of view
                var vid = entry.target.dataset.videoId;
                if (vid && vid.indexOf('user_') === 0) {
                    var reelId = vid.replace('user_','');
                    var v = document.getElementById('rvid-' + reelId);
                    if (v && !v.paused) v.pause();
                }
            }
        });
    }, { threshold: 0.55 });
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

// ── REEL EDITOR ──────────────────────────────────────────
window.openReelEditorModal = function() {
    var overlay = document.getElementById('reelEditorOverlay'); if (!overlay) return;
    overlay.innerHTML = '<div class="reel-editor-box">' +
        '<h2>🎬 Subir Reel</h2>' +
        '<div class="reel-editor-controls">' +
        '<label class="editor-label">Video (máx. 1 minuto)</label>' +
        '<label class="btn-outline" style="width:100%;justify-content:center;cursor:pointer;">' +
        '<i class="fa-solid fa-video"></i> Seleccionar video' +
        '<input type="file" hidden accept="video/*" onchange="reelEditorLoadVideo(this)">' +
        '</label>' +
        '<div class="reel-editor-preview" id="reelEditorPreview" style="display:none;">' +
        '<video id="reelEditorVideo" style="width:100%;height:100%;object-fit:contain;" controls></video>' +
        '<div class="reel-text-overlay" id="reelTextOverlay"></div>' +
        '</div>' +
        '<label class="editor-label" style="margin-top:8px;">Añadir texto</label>' +
        '<input type="text" class="editor-input" id="reelTextInput" placeholder="Tu texto en el video..." oninput="document.getElementById(\'reelTextOverlay\').textContent=this.value">' +
        '<label class="editor-label" style="margin-top:8px;">Música de fondo</label>' +
        '<select class="editor-input" id="reelMusicSelect">' +
        '<option value="">Sin música</option>' +
        MUSIC_TRACKS.map(function(t) { return '<option value="' + t.title + '">' + t.title + '</option>'; }).join('') +
        '</select>' +
        '<label class="editor-label" style="margin-top:8px;">Volumen música</label>' +
        '<div class="volume-control"><i class="fa-solid fa-volume-low"></i><input type="range" min="0" max="1" step="0.05" value="0.5" id="reelMusicVol"><i class="fa-solid fa-volume-high"></i><span id="reelMusicVolLabel" style="font-size:12px;color:var(--text-muted);margin-left:6px;">50%</span></div>' +
        '</div>' +
        '<div style="display:flex;gap:10px;margin-top:20px;">' +
        '<button class="btn-outline" onclick="closeReelEditor()" style="flex:1;">Cancelar</button>' +
        '<button class="btn-join" onclick="publishReel()" style="flex:1;">Publicar</button>' +
        '</div></div>';

    // Live vol label
    setTimeout(function() {
        var slider = document.getElementById('reelMusicVol');
        var label  = document.getElementById('reelMusicVolLabel');
        if (slider) slider.addEventListener('input', function() { if (label) label.textContent = Math.round(slider.value*100) + '%'; });
    }, 50);

    overlay.style.display = 'flex';
    setTimeout(function() { overlay.classList.add('active'); }, 10);
};

window.reelEditorLoadVideo = function(input) {
    if (!input.files[0]) return;
    var file = input.files[0];
    var url  = URL.createObjectURL(file);
    var preview = document.getElementById('reelEditorPreview');
    var vid     = document.getElementById('reelEditorVideo');
    if (!preview || !vid) return;
    vid.src = url;
    vid.onloadedmetadata = function() {
        if (vid.duration > 60) { showToast('⚠️ El video no puede superar 1 minuto'); vid.src=''; preview.style.display='none'; return; }
        preview.style.display = 'block';
        // Store file as base64 for persistence
        var reader = new FileReader();
        reader.onload = function(e) { window._reelB64 = e.target.result; };
        reader.readAsDataURL(file);
    };
};

window.publishReel = function() {
    if (!window._reelB64) return showToast('⚠️ Selecciona un video primero');
    var u = socialDB.currentUser;
    var text  = (document.getElementById('reelTextInput')  || {}).value || '';
    var music = (document.getElementById('reelMusicSelect') || {}).value || '';
    var vol   = parseFloat((document.getElementById('reelMusicVol') || {}).value || 0.5);
    var reel  = { id:'reel_'+Date.now(), authorUsername:u.username, authorName:u.name, src:window._reelB64, text:text, music:music, musicVolume:vol, likes:[], createdAt:new Date().toISOString() };
    userReels.unshift(reel);
    localStorage.setItem('social_user_reels', JSON.stringify(userReels));
    window._reelB64 = null;
    closeReelEditor(); showToast('✅ Reel publicado');
    setTimeout(function() { switchSection('reels'); }, 300);
};

window.closeReelEditor = function() {
    var ov = document.getElementById('reelEditorOverlay'); if (!ov) return;
    ov.classList.remove('active'); setTimeout(function() { ov.style.display='none'; ov.innerHTML=''; }, 400);
};

// ── REEL PREFS MODAL ─────────────────────────────────────
window.openReelPrefsModal = function() {
    var overlay = document.getElementById('reelPrefsOverlay'); if (!overlay) return;
    var selected = new Set(socialDB.reelPrefs);

    function buildHTML() {
        var html = '<div class="modal-box" style="max-width:540px;max-height:88vh;overflow-y:auto;">' +
            '<div style="text-align:center;margin-bottom:20px;"><div style="font-size:40px;margin-bottom:8px;">🎬</div>' +
            '<h2 style="margin:0 0 6px;">Tus preferencias</h2>' +
            '<p style="color:var(--text-muted);font-size:14px;margin:0;">Elige qué contenido quieres ver en tus Reels</p></div>' +
            '<div class="prefs-grid" id="prefsGrid">';
        REEL_CATEGORIES.forEach(function(cat) {
            html += '<div class="pref-chip' + (selected.has(cat.id)?' selected':'') + '" id="chip-' + cat.id + '" onclick="togglePref(\'' + cat.id + '\',this' + (cat.subs?',true':'') + ')">' +
                cat.label + (cat.subs ? ' <i class="fa-solid fa-chevron-down" style="font-size:10px;margin-left:4px;" id="chev-' + cat.id + '"></i>' : '') + '</div>';
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
    overlay.innerHTML = buildHTML(); overlay._selected = selected;
    overlay.style.display = 'flex'; setTimeout(function() { overlay.classList.add('active'); }, 10);
};
window.togglePref = function(prefId, el, hasChildren) {
    var ov = document.getElementById('reelPrefsOverlay'); var sel = ov._selected;
    if (sel.has(prefId)) { sel.delete(prefId); el.classList.remove('selected'); } else { sel.add(prefId); el.classList.add('selected'); }
    var cnt = document.getElementById('prefCount'); if (cnt) cnt.textContent = sel.size + ' seleccionadas';
    if (hasChildren) {
        REEL_CATEGORIES.forEach(function(cat) {
            if (cat.id===prefId && cat.subs) {
                var subsEl = document.getElementById('subs-' + prefId); var chevEl = document.getElementById('chev-' + prefId);
                if (subsEl) { var showing = subsEl.style.display !== 'none'; subsEl.style.display = showing?'none':'flex'; if (chevEl) chevEl.style.transform = showing?'rotate(0)':'rotate(180deg)'; }
            }
        });
    }
};
window.saveReelPrefs = function() {
    var ov = document.getElementById('reelPrefsOverlay'); var sel = ov ? ov._selected : null;
    if (!sel||sel.size===0) return showToast('⚠️ Selecciona al menos una categoría');
    socialDB.reelPrefs = Array.from(sel); socialDB.reelPage = 0; saveDB();
    closeReelPrefsModal(); showToast('✅ Preferencias guardadas');
    setTimeout(function() { switchSection('reels'); }, 300);
};
window.closeReelPrefsModal = function() {
    var ov = document.getElementById('reelPrefsOverlay'); if (!ov) return;
    ov.classList.remove('active'); setTimeout(function() { ov.style.display='none'; ov.innerHTML=''; }, 400);
};

// ── 21. SIDEBAR DERECHO ──────────────────────────────────
function renderRightSidebar() {
    var u = socialDB.currentUser; if (!u) return;
    var contactsEl = document.getElementById('contactsList');
    var suggestEl  = document.getElementById('suggestionsList');

    // Amigos desde caché de usuarios
    var friends = (u.friends||[]).map(function(fn) {
        return socialDB.users.find(function(x) { return x.username === fn; });
    }).filter(Boolean);

    if (contactsEl) {
        contactsEl.innerHTML = friends.length === 0
            ? '<div style="font-size:13px;color:var(--text-muted);padding:5px 10px;">Sin amigos aún</div>'
            : friends.map(function(f) {
                return '<div class="contact-item" onclick="openChatWith(\'' + f.username + '\')" data-user="' + f.username + '">' +
                    '<div class="contact-avatar" style="position:relative;">' + renderAvatar(f,38) +
                    '<span class="status-dot offline"></span></div>' +
                    '<span class="contact-name">' + f.name + '</span></div>';
              }).join('');

        // Si hay pocos amigos en caché, cargarlos en background
        if (friends.length < (u.friends||[]).length) {
            var missing = (u.friends||[]).filter(function(fn) {
                return !socialDB.users.find(function(x) { return x.username === fn; });
            });
            missing.forEach(function(fn) {
                api('GET', '/users/' + fn).then(function(d) {
                    if (d.ok) {
                        socialDB.users.push(d.user);
                        renderRightSidebar(); // Re-render con datos completos
                    }
                }).catch(function(){});
            });
        }
    }

    if (suggestEl) {
        var suggestions = socialDB.users.filter(function(usr) {
            return usr.username !== u.username && !(u.friends||[]).includes(usr.username);
        }).slice(0, 5);
        suggestEl.innerHTML = suggestions.length === 0
            ? '<div style="font-size:13px;color:var(--text-muted);padding:5px 10px;">Sin sugerencias</div>'
            : suggestions.map(function(s) {
                var pending = socialDB.friendRequests.find(function(r) { return r.from===u.username && r.to===s.username && r.status==='pending'; });
                return '<div class="suggestion-item">' +
                    '<div class="suggestion-avatar">' + renderAvatar(s,38) + '</div>' +
                    '<div class="suggestion-info"><div class="suggestion-name">' + s.name + '</div>' +
                    '<div class="suggestion-meta">@' + (s.displayName||s.username) + '</div></div>' +
                    (pending
                        ? '<button class="btn-follow" disabled style="opacity:.5;">Enviada</button>'
                        : '<button class="btn-follow" onclick="sendFriendRequest(\'' + s.username + '\');this.textContent=\'Enviada\';this.disabled=true;this.style.opacity=\'.5\';">Seguir</button>'
                    ) + '</div>';
              }).join('');
    }
}

// ── 22. FULLSCREEN ───────────────────────────────────────
window.openFullscreen = function(src) {
    var el  = document.getElementById('imgFullscreen');
    var img = document.getElementById('fullscreenImg');
    if (!el || !img) return;
    img.src = src;
    img.style.transform = 'scale(1)';
    img.style.cursor = 'zoom-in';
    el.style.display = 'flex';
    // Mouse wheel zoom
    var scale = 1;
    var minS = 1, maxS = 5;
    img._zscale = 1;
    el.onwheel = function(e) {
        e.preventDefault();
        scale = Math.min(maxS, Math.max(minS, scale * (e.deltaY < 0 ? 1.12 : 0.88)));
        img.style.transform = 'scale(' + scale + ')';
        img.style.cursor = scale > 1 ? 'zoom-out' : 'zoom-in';
    };
    // Double tap / double click to toggle zoom
    var lastTap = 0;
    el.ondblclick = function(e) {
        if (e.target === img) {
            scale = scale > 1 ? 1 : 2.5;
            img.style.transform = 'scale(' + scale + ')';
            img.style.transition = 'transform .3s ease';
            setTimeout(function() { img.style.transition = ''; }, 300);
        }
    };
    // Pinch zoom
    var initDist = 0, initScale = 1;
    el.ontouchstart = function(e) {
        if (e.touches.length === 2) {
            initDist  = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
            initScale = scale;
        }
    };
    el.ontouchmove = function(e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            var dist = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
            scale = Math.min(maxS, Math.max(minS, initScale * (dist / initDist)));
            img.style.transform = 'scale(' + scale + ')';
        }
    };
};
window.closeFullscreen = function() {
    var el = document.getElementById('imgFullscreen'); if (el) { el.style.display='none'; el.onwheel=null; el.ondblclick=null; el.ontouchstart=null; el.ontouchmove=null; }
};
window.closeFullscreen = function() { var el=document.getElementById('imgFullscreen'); if(el) el.style.display='none'; };

// ── 23. INICIALIZACIÓN ───────────────────────────────────
window.onload = function() {
    applyTheme(socialDB.currentTheme);

    // ── Restaurar sesión con JWT ──
    var savedToken    = localStorage.getItem('gl_token');
    var savedUsername = localStorage.getItem('gl_username');

    if (savedToken && savedUsername) {
        socialDB.token = savedToken;

        // Pantalla de carga mientras verificamos
        document.getElementById('landingPage').style.display = 'none';
        var loadingDiv = document.createElement('div');
        loadingDiv.id = 'sessionLoader';
        loadingDiv.style.cssText = 'position:fixed;inset:0;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;gap:20px;';
        loadingDiv.innerHTML =
            '<img src="Logo.png" style="width:120px;height:auto;">' +
            '<div class="reels-spinner"></div>' +
            '<p style="color:var(--text-muted);font-size:14px;">Cargando tu cuenta...</p>';
        document.body.appendChild(loadingDiv);

        function removeLoader() {
            var l = document.getElementById('sessionLoader');
            if (l) l.remove();
        }

        // Timeout de 20s — Render puede tardar en despertar
        var sessionTimeout = setTimeout(function() {
            removeLoader();
            // NO borrar el token — puede ser un problema de red temporal
            // Mostrar landing con opción de reintentar
            document.getElementById('landingPage').style.display = 'block';
            initLanding();
            showToast('⚠️ Servidor tardando. Pulsa "Entrar" para intentar de nuevo.');
        }, 20000);

        api('GET', '/users/' + savedUsername)
        .then(function(data) {
            clearTimeout(sessionTimeout);
            removeLoader();
            if (data.ok && data.user) {
                socialDB.currentUser = data.user;
                launchApp();
            } else {
                // Token realmente inválido — borrar y mostrar landing
                localStorage.removeItem('gl_token');
                localStorage.removeItem('gl_username');
                socialDB.token = null;
                document.getElementById('landingPage').style.display = 'block';
                initLanding();
            }
        })
        .catch(function() {
            clearTimeout(sessionTimeout);
            removeLoader();
            // Error de red — NO borrar token, mostrar landing con aviso
            document.getElementById('landingPage').style.display = 'block';
            initLanding();
            showToast('⚠️ Sin conexión. Tus datos están guardados.');
        });
        return;
    }

    // Sin sesión guardada — landing normal
    initLanding();
};
