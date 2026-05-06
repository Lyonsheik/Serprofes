/* ============================================================
   GLOBALINK — SCRIPT.JS v3.0
   ============================================================ */

// ── 1. BASE DE DATOS ──────────────────────────────────────
var socialDB = {
    users:         JSON.parse(localStorage.getItem('social_users'))       || [],
    posts:         JSON.parse(localStorage.getItem('social_posts'))       || [],
    stories:       JSON.parse(localStorage.getItem('social_stories'))     || [],
    notifications: JSON.parse(localStorage.getItem('social_notifs'))      || [],
    messages:      JSON.parse(localStorage.getItem('social_messages'))    || {},
    friendRequests:JSON.parse(localStorage.getItem('social_requests'))    || [],
    reelPrefs:     JSON.parse(localStorage.getItem('social_reel_prefs'))  || [],
    reelHistory:   JSON.parse(localStorage.getItem('social_reel_history'))|| {},
    reelComments:  JSON.parse(localStorage.getItem('social_reel_comments'))|| {},
    currentUser:   null,
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
    activeReelId:  null
};

// ── 2. UTILIDADES ─────────────────────────────────────────
function saveDB() {
    localStorage.setItem('social_users',        JSON.stringify(socialDB.users));
    localStorage.setItem('social_posts',        JSON.stringify(socialDB.posts));
    localStorage.setItem('social_stories',      JSON.stringify(socialDB.stories));
    localStorage.setItem('social_notifs',       JSON.stringify(socialDB.notifications));
    localStorage.setItem('social_messages',     JSON.stringify(socialDB.messages));
    localStorage.setItem('social_requests',     JSON.stringify(socialDB.friendRequests));
    localStorage.setItem('social_reel_prefs',   JSON.stringify(socialDB.reelPrefs));
    localStorage.setItem('social_reel_history', JSON.stringify(socialDB.reelHistory));
    localStorage.setItem('social_reel_comments',JSON.stringify(socialDB.reelComments));
    // Persistir sesión activa
    if (socialDB.currentUser) {
        localStorage.setItem('social_session', socialDB.currentUser.username);
    }
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

// ── URL del backend (cámbiala cuando despliegues en Render) ──
var BACKEND_URL = 'https://globalink-backend-ur6a.onrender.com';
// Para pruebas locales usa: var BACKEND_URL = 'http://localhost:3001';

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

        // Guardar usuario en localStorage
        var fullName = _regTemp.nombre + ' ' + _regTemp.apellidos;
        socialDB.users.push({
            name:        fullName,
            firstName:   _regTemp.nombre,
            lastName:    _regTemp.apellidos,
            username:    _regTemp.user,
            email:       _regTemp.email,
            gender:      _regTemp.genero,
            birthDate:   _regTemp.birth,
            pass:        _regTemp.pass,
            verified:    true,
            available:   true,
            rgpdConsent: _regTemp.consentDate || new Date().toISOString(),
            bio:'', profilePic:'', coverPic:'',
            friends:[], followers:[], following:[],
            createdAt:   new Date().toISOString()
        });
        _regTemp = {};
        _finalizeRunning = false;
        saveDB();

        toggleModal(true,
            '<div style="text-align:center;padding:20px 0;">' +
            '<div style="font-size:64px;margin-bottom:16px;">🎉</div>' +
            '<h2 style="margin-bottom:10px;">¡Cuenta creada!</h2>' +
            '<p style="color:var(--text-secondary);font-size:15px;margin-bottom:24px;">Tu correo ha sido verificado y tu cuenta está lista. Ya puedes iniciar sesión.</p>' +
            '<button class="btn-join" onclick="openLoginModal()" style="width:100%;font-size:16px;">Iniciar sesión <i class="fa-solid fa-arrow-right" style="margin-left:8px;"></i></button>' +
            '</div>'
        );
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
    // Login case-insensitive para username, exacto para email
    var foundIdx = socialDB.users.findIndex(function(u) {
        return (u.username.toLowerCase() === userIn.toLowerCase() || u.email === userIn.toLowerCase()) && u.pass === passIn;
    });
    if (foundIdx !== -1) {
        socialDB.currentUser = socialDB.users[foundIdx]; // referencia viva al array
        localStorage.setItem('social_session', socialDB.currentUser.username);
        toggleModal(false);
        launchApp();
    } else {
        showToast('❌ Usuario/correo o contraseña incorrectos');
    }
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
    updateSidebarProfile(); updateBadges(); cleanOldStories(); switchSection('inicio');
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
    socialDB.currentUser = null; socialDB.currentSection = 'inicio'; socialDB.reelPage = 0;
    localStorage.removeItem('social_session');
    document.getElementById('socialApp').style.display   = 'none';
    document.getElementById('landingPage').style.display = 'block';
    showToast('👋 Sesión cerrada');
};

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
    var unreadNotifs = socialDB.notifications.filter(function(n) { return n.to === u.username && !n.read; }).length;
    var pendingReqs  = socialDB.friendRequests.filter(function(r)  { return r.to === u.username && r.status === 'pending'; }).length;
    var unreadMsgs   = 0;
    Object.values(socialDB.messages[u.username] || {}).forEach(function(msgs) { msgs.forEach(function(m) { if (m.from !== u.username && !m.read) unreadMsgs++; }); });

    updateBadge('badge-notificaciones',  unreadNotifs);
    updateBadge('badge-amigos',          pendingReqs);
    updateBadge('badge-mensajes',        unreadMsgs);
    updateBadge('mbadge-notificaciones', unreadNotifs);
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
        '<div class="profile-cover" id="profileCoverEl" style="' + (u.coverPic ? 'background-image:url(' + u.coverPic + ');background-size:cover;background-position:center;' : '') + '">' +
        '<label style="position:absolute;bottom:10px;right:10px;cursor:pointer;background:rgba(0,0,0,.5);color:#fff;padding:6px 12px;border-radius:15px;font-size:12px;display:flex;align-items:center;gap:5px;"><i class="fa-solid fa-camera"></i> Portada<input type="file" hidden accept="image/*" onchange="changeCoverPic(this)"></label></div>' +
        '<div class="profile-pic-wrap"><div class="profile-pic">' + (u.profilePic ? '<img src="' + u.profilePic + '">' : u.name[0].toUpperCase()) + '</div>' +
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
        '<label class="btn-media"><i class="fa-solid fa-image" style="color:#4caf50;"></i> Foto<input type="file" id="mediaInput" hidden accept="image/*" onchange="handleMedia(this,\'image\')"></label>' +
        '<label class="btn-media"><i class="fa-solid fa-video" style="color:#e91e63;"></i> Video<input type="file" id="videoInput" hidden accept="video/*" onchange="handleMedia(this,\'video\')"></label>' +
        '<label class="btn-media"><i class="fa-solid fa-face-smile" style="color:#f9c313;"></i> Sentimiento<input type="text" id="feelingInput" placeholder="¿Cómo te sientes?" style="width:110px;border:none;background:none;font-size:13px;outline:none;color:var(--text);font-family:inherit;"></label>' +
        '</div><button class="btn-join" onclick="publishPost()">Publicar</button></div></div>';
}

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
        // 1. Actualizar el objeto en memoria (referencia viva)
        socialDB.currentUser.profilePic = imgData;
        var idx = socialDB.users.findIndex(function(u) { return u.username === socialDB.currentUser.username; });
        if (idx !== -1) socialDB.users[idx].profilePic = imgData;
        saveDB();

        // 2. Actualizar DOM instantáneamente SIN re-renderizar la sección entera
        // a) Avatar del perfil principal
        var profilePicEl = document.querySelector('.profile-pic');
        if (profilePicEl) profilePicEl.innerHTML = '<img src="' + imgData + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';

        // b) Mini avatar del sidebar
        updateSidebarProfile();

        // c) Avatar en el create-post
        var createAvatar = document.querySelector('.create-post-top .user-avatar');
        if (createAvatar) createAvatar.innerHTML = '<img src="' + imgData + '" style="width:44px;height:44px;object-fit:cover;border-radius:50%;">';

        // d) Burbuja de historia del usuario
        renderStories();

        showToast('✅ Foto de perfil actualizada');
    };
    reader.readAsDataURL(input.files[0]);
};
window.changeCoverPic = function(input) {
    if (!input.files[0]) return;
    var reader = new FileReader();
    reader.onload = function(e) {
        var imgData = e.target.result;
        // 1. Actualizar objeto en memoria
        socialDB.currentUser.coverPic = imgData;
        var idx = socialDB.users.findIndex(function(u) { return u.username === socialDB.currentUser.username; });
        if (idx !== -1) socialDB.users[idx].coverPic = imgData;
        saveDB();

        // 2. Actualizar solo la portada en el DOM sin destruir el resto
        var coverEl = document.getElementById('profileCoverEl');
        if (coverEl) {
            coverEl.style.backgroundImage   = 'url(' + imgData + ')';
            coverEl.style.backgroundSize    = 'cover';
            coverEl.style.backgroundPosition = 'center';
        }
        showToast('✅ Foto de portada actualizada');
    };
    reader.readAsDataURL(input.files[0]);
};

// ── 10. HISTORIAS ────────────────────────────────────────
function cleanOldStories() {
    socialDB.stories = socialDB.stories.filter(function(s) { return Date.now() - new Date(s.createdAt).getTime() < 86400000; });
    saveDB();
}

function renderStories() {
    var row = document.getElementById('storiesRow'); if (!row) return;
    var u = socialDB.currentUser;

    // Buscar historia del usuario actual
    var myStory = socialDB.stories.find(function(s) { return s.authorUsername === u.username; });

    // Siempre mostrar la burbuja del usuario actual primero
    var html = '<div class="story-item" onclick="' + (myStory ? 'viewStory(\'' + myStory.id + '\')' : 'addStory()') + '">' +
        '<div class="story-ring ' + (myStory ? '' : 'add-story') + '">' +
        '<div class="story-ring-inner" style="display:flex;align-items:center;justify-content:center;background:var(--bg-input);">' +
        (myStory ? (u.profilePic ? '<img src="' + u.profilePic + '" alt="' + u.name + '">' : '<span style="font-size:20px;color:var(--primary);">' + u.name[0].toUpperCase() + '</span>') :
         (u.profilePic ? '<img src="' + u.profilePic + '">' : '<span style="font-size:20px;color:var(--primary);">' + u.name[0].toUpperCase() + '</span>')) +
        '</div>' + (myStory ? '' : '<div class="story-add-icon"><i class="fa-solid fa-plus"></i></div>') + '</div>' +
        '<span class="story-name">' + (myStory ? 'Tu historia' : 'Añadir') + '</span></div>';

    // Historias de otros (no duplicar el usuario actual)
    var seen = {};
    socialDB.stories.filter(function(s) { return s.authorUsername !== u.username; }).forEach(function(story) {
        if (seen[story.authorUsername]) return; seen[story.authorUsername] = true;
        var author = getUser(story.authorUsername); if (!author) return;
        html += '<div class="story-item" onclick="viewStory(\'' + story.id + '\')">' +
            '<div class="story-ring"><div class="story-ring-inner">' +
            (author.profilePic ? '<img src="' + author.profilePic + '">' : '<span style="font-size:20px;font-weight:700;color:var(--primary);">' + author.name[0].toUpperCase() + '</span>') +
            '</div></div><span class="story-name">' + author.name.split(' ')[0] + '</span></div>';
    });
    row.innerHTML = html;
}

window.addStory = function() {
    // Eliminar input previo si existía
    var old = document.getElementById('_storyFileInput');
    if (old) old.remove();

    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.id = '_storyFileInput';
    input.style.cssText = 'position:fixed;top:-100px;left:-100px;opacity:0;pointer-events:none;';
    document.body.appendChild(input); // NECESARIO para iOS/Safari

    input.onchange = function(e) {
        var file = e.target.files[0];
        if (file) {
            var reader = new FileReader();
            reader.onload = function(ev) {
                var u = socialDB.currentUser;
                // Eliminar historia anterior del mismo usuario
                socialDB.stories = socialDB.stories.filter(function(s) { return s.authorUsername !== u.username; });
                socialDB.stories.push({
                    id: 'story_' + Date.now(),
                    authorUsername: u.username,
                    authorName: u.name,
                    type: 'image',
                    content: ev.target.result,
                    createdAt: new Date().toISOString()
                });
                saveDB();
                showToast('✅ Historia publicada');
                renderStories();
            };
            reader.readAsDataURL(file);
        }
        // Limpiar el input del DOM
        setTimeout(function() { input.remove(); }, 1000);
    };

    // Pequeño delay para garantizar que el input ya está en el DOM antes de hacer click
    setTimeout(function() { input.click(); }, 50);
};

window.viewStory = function(storyId) {
    var story = socialDB.stories.find(function(s) { return s.id === storyId; }); if (!story) return;
    var author = getUser(story.authorUsername); if (!author) return;
    var modal  = document.getElementById('storyModal');
    var av     = document.getElementById('storyModalAvatar');
    var fill   = document.getElementById('storyProgressFill');
    fill.style.animation = 'none'; void fill.offsetWidth; fill.style.animation = 'progressStory 5s linear forwards';
    av.innerHTML = renderAvatar(author, 40);
    if (!author.profilePic) av.style.cssText = 'background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;border-radius:50%;width:40px;height:40px;';
    document.getElementById('storyModalAuthor').textContent = author.name;
    document.getElementById('storyModalTime').textContent   = timeAgo(story.createdAt);
    document.getElementById('storyModalBody').innerHTML = story.type === 'image'
        ? '<img src="' + story.content + '" style="width:100%;height:100%;object-fit:cover;">'
        : '<div class="story-text-content">' + story.content + '</div>';
    modal.style.display = 'flex';
    clearTimeout(socialDB.storyTimer);
    socialDB.storyTimer = setTimeout(function() { closeStoryModal(); }, 5000);
};
window.closeStoryModal = function() { document.getElementById('storyModal').style.display = 'none'; clearTimeout(socialDB.storyTimer); };

// ── 11. POSTS ────────────────────────────────────────────
function renderPosts() {
    var wrapper = document.getElementById('feedPosts'); if (!wrapper) return;
    var u = socialDB.currentUser;
    var friends = u.friends || [];
    var visible = socialDB.posts
        .filter(function(p) { return p.authorUsername === u.username || friends.indexOf(p.authorUsername) !== -1; })
        .sort(function(a,b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    if (visible.length === 0) { wrapper.innerHTML = '<div class="empty-state"><i class="fa-solid fa-newspaper"></i><p>Aún no hay publicaciones. ¡Sé el primero!</p></div>'; return; }
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
    var topEmojis = reactionEmojis.filter(function(e) { return (reactions[e]||[]).length > 0; }).slice(0,3).join('');

    var mediaHTML = '';
    if (p.media) {
        if (p.mediaType === 'video') {
            // Video con posibles overlays de texto y música
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
            mediaHTML = '<img src="' + p.media + '" class="post-media-content" onclick="openFullscreen(this.src)" alt="media">';
        }
    }

    return '<div class="post-card" id="post-' + p.id + '">' +
        '<div class="post-header">' +
        '<div class="post-author-info">' +
        '<div class="post-author-avatar">' + renderAvatar(author, 44) + '</div>' +
        '<div><div class="post-author-name">' + p.authorName + '</div>' +
        '<div class="post-date">' + timeAgo(p.createdAt) + (p.feeling ? ' · 😊 Se siente <em>' + p.feeling + '</em>' : '') + (p.editedAt ? ' · <em style="color:var(--text-muted)">editado</em>' : '') + '</div></div></div>' +
        '<div class="post-menu">' + (p.authorUsername === u.username ? '<i class="fa-solid fa-pen" onclick="editPost(\'' + p.id + '\')" title="Editar"></i><i class="fa-solid fa-trash" onclick="deletePost(\'' + p.id + '\')" title="Eliminar"></i>' : '') + '</div></div>' +
        (p.content ? '<p class="post-content">' + p.content + '</p>' : '') +
        mediaHTML +
        (totalLikes > 0 ? '<div style="display:flex;align-items:center;gap:5px;margin-top:8px;font-size:13px;color:var(--text-muted);">' + (topEmojis||'❤️') + ' <span>' + totalLikes + ' reacción' + (totalLikes>1?'es':'') + '</span></div>' : '') +
        '<div class="post-actions">' +
        '<div class="reaction-wrapper">' +
        '<button class="action-btn' + (myReaction?' liked':'') + '" onmouseenter="showReactionBar(\'' + p.id + '\')" onmouseleave="scheduleHideReaction(\'' + p.id + '\')" onclick="toggleLike(\'' + p.id + '\')">' +
        '<span style="font-size:16px;">' + (myReaction||'🤍') + '</span><span>' + (totalLikes>0?totalLikes:'') + ' Me gusta</span></button>' +
        '<div class="reaction-bar" id="reaction-bar-' + p.id + '" onmouseenter="clearReactionHide(\'' + p.id + '\')" onmouseleave="scheduleHideReaction(\'' + p.id + '\')">' +
        reactionEmojis.map(function(e) { return '<button class="reaction-emoji-btn' + (myReaction===e?' active':'') + '" onclick="reactToPost(\'' + p.id + '\',\'' + e + '\')">' + e + '</button>'; }).join('') +
        '</div></div>' +
        '<button class="action-btn" onclick="toggleComments(\'' + p.id + '\')"><i class="fa-regular fa-comment"></i><span>' + (comments.length>0?comments.length:'') + ' Comentar</span></button>' +
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
    var post = socialDB.posts.find(function(p) { return p.id === postId; }); if (!post) return;
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
    saveDB(); showToast('✅ Actualizado'); renderPosts();
};

window.handleMedia = function(input, type) {
    if (!input.files[0]) return;
    var file = input.files[0];
    if (type === 'video') {
        // Para videos: abrir editor modal antes de publicar
        openPostVideoEditor(file);
    } else {
        // Para imágenes: previsualización directa inline
        var reader = new FileReader();
        reader.onload = function(e) {
            socialDB.tempMedia     = e.target.result;
            socialDB.tempMediaType = 'image';
            var box = document.getElementById('previewBox');
            var img = document.getElementById('imgPrev');
            var vid = document.getElementById('videoPrev');
            if (!box) return;
            box.style.display = 'block';
            if (vid) vid.style.display = 'none';
            if (img) { img.style.display = 'block'; img.src = e.target.result; }
        };
        reader.readAsDataURL(file);
    }
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
    var txt = document.getElementById('newPostTxt'); var feeling = document.getElementById('feelingInput'); if (!txt) return;
    var content = txt.value.trim(); var feelingVal = feeling ? feeling.value.trim() : '';
    if (!content && !socialDB.tempMedia) return showToast('⚠️ Escribe algo o añade una imagen/video');
    var u = socialDB.currentUser;
    socialDB.posts.unshift({
        id:'post_'+Date.now(),
        authorUsername:u.username, authorName:u.name,
        content:content, feeling:feelingVal,
        media:socialDB.tempMedia, mediaType:socialDB.tempMediaType,
        videoText:  socialDB.tempVideoText  || '',
        videoColor: socialDB.tempVideoColor || '#ffffff',
        videoSize:  socialDB.tempVideoSize  || 22,
        videoTextX: socialDB.tempVideoTextX !== undefined ? socialDB.tempVideoTextX : 50,
        videoTextY: socialDB.tempVideoTextY !== undefined ? socialDB.tempVideoTextY : 50,
        videoMusic: socialDB.tempVideoMusic || '',
        likes:[], reactions:{}, comments:[],
        createdAt:new Date().toISOString()
    });
    socialDB.tempMedia = null; socialDB.tempMediaType = null;
    socialDB.tempVideoText = null; socialDB.tempVideoColor = null;
    socialDB.tempVideoSize = null; socialDB.tempVideoTextX = null;
    socialDB.tempVideoTextY = null; socialDB.tempVideoMusic = null;
    socialDB.tempVideoMusicB64 = null;
    saveDB(); if (txt) txt.value = ''; if (feeling) feeling.value = '';
    removeMedia(); showToast('✅ Publicación creada'); renderPosts();
    var el = document.getElementById('statPosts'); if (el) el.textContent = socialDB.posts.filter(function(p) { return p.authorUsername === u.username; }).length;
};

// ── 13. COMPARTIR POST ───────────────────────────────────
window.openShareModal = function(postId) {
    socialDB.sharePostId = postId;
    var u = socialDB.currentUser;
    var friends = (u.friends||[]).map(function(fn) { return getUser(fn); }).filter(Boolean);
    var overlay = document.getElementById('shareModalOverlay'); if (!overlay) return;
    var inner = friends.length === 0
        ? '<div class="empty-state"><i class="fa-solid fa-user-group"></i><p>Agrega amigos para compartir.</p></div>'
        : '<div style="max-height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;">' + friends.map(function(f) {
            return '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:14px;background:var(--bg-input);cursor:pointer;" onclick="sendSharedPost(\'' + f.username + '\')">' +
                '<div style="width:40px;height:40px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;overflow:hidden;flex-shrink:0;">' + renderAvatar(f,40) + '</div>' +
                '<div style="flex:1;"><div style="font-weight:600;font-size:14px;">' + f.name + '</div><div style="font-size:12px;color:var(--text-muted);">@' + f.username + '</div></div>' +
                '<i class="fa-solid fa-paper-plane" style="color:var(--primary);font-size:16px;"></i></div>';
        }).join('') + '</div>';
    overlay.innerHTML = '<div class="modal-box" style="max-width:400px;"><h2 style="margin-bottom:18px;">↗️ Compartir</h2>' + inner + '<p class="close-text" onclick="closeShareModal()">Cancelar</p></div>';
    overlay.style.display = 'flex';
    setTimeout(function() { overlay.classList.add('active'); }, 10);
};
window.closeShareModal = function() {
    var ov = document.getElementById('shareModalOverlay'); if (!ov) return;
    ov.classList.remove('active');
    setTimeout(function() { ov.style.display = 'none'; ov.innerHTML = ''; }, 400);
};
window.sendSharedPost = function(toUsername) {
    var post = socialDB.posts.find(function(p) { return p.id === socialDB.sharePostId; }); if (!post) return;
    var u = socialDB.currentUser;
    var msg = '📤 ' + u.name + ' te compartió: "' + (post.content ? post.content.substring(0,60)+(post.content.length>60?'...':'') : '[Imagen]') + '"';
    sendMessageTo(toUsername, msg);
    addNotification(toUsername, 'message', '<strong>' + u.name + '</strong> te compartió una publicación');
    closeShareModal(); showToast('✅ Compartido con ' + (getUser(toUsername) ? getUser(toUsername).name : toUsername));
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
    var query = ((document.getElementById('userSearchInput') ? document.getElementById('userSearchInput').value : '')||'').toLowerCase().trim();
    var u = socialDB.currentUser; var results = document.getElementById('searchResults'); if (!results) return;
    var filtered = socialDB.users.filter(function(user) { return user.username !== u.username && (user.name.toLowerCase().indexOf(query) !== -1 || user.username.toLowerCase().indexOf(query) !== -1); });
    if (filtered.length === 0) { results.innerHTML = '<div class="empty-state"><i class="fa-solid fa-user-slash"></i><p>No se encontraron usuarios' + (query?' para "'+query+'"':'') + '.</p></div>'; return; }
    results.innerHTML = filtered.map(function(user) {
        var isFriend = (u.friends||[]).indexOf(user.username) !== -1;
        var pending  = socialDB.friendRequests.find(function(r) { return r.from===u.username && r.to===user.username && r.status==='pending'; });
        var btn = isFriend ? '<button class="btn-add-friend friends" disabled><i class="fa-solid fa-user-check"></i> Amigos</button>'
            : pending ? '<button class="btn-add-friend sent" disabled><i class="fa-solid fa-clock"></i> Enviada</button>'
            : '<button class="btn-add-friend" onclick="sendFriendRequest(\'' + user.username + '\')"><i class="fa-solid fa-user-plus"></i> Agregar</button>';
        return '<div class="search-user-card"><div class="search-user-avatar">' + renderAvatar(user,48) + '</div><div class="search-user-info"><div class="search-user-name">' + user.name + '</div><div class="search-user-handle">@' + user.username + '</div></div>' + btn + '</div>';
    }).join('');
};

// ── 15. SOLICITUDES DE AMISTAD ───────────────────────────
window.sendFriendRequest = function(toUsername) {
    var u = socialDB.currentUser;
    if (socialDB.friendRequests.find(function(r) { return r.from===u.username && r.to===toUsername && r.status==='pending'; })) return showToast('⚠️ Ya enviaste una solicitud');
    socialDB.friendRequests.push({ id:'req_'+Date.now(), from:u.username, to:toUsername, status:'pending', createdAt:new Date().toISOString() });
    addNotification(toUsername, 'friend_request', '<strong>' + u.name + '</strong> te envió una solicitud de amistad');
    saveDB(); showToast('✅ Solicitud enviada'); filterSearchResults(); updateBadges();
};

window.acceptFriendRequest = function(reqId) {
    var req = socialDB.friendRequests.find(function(r) { return r.id===reqId; }); if (!req) return;
    req.status = 'accepted';
    var u = socialDB.currentUser; var fromUser = getUser(req.from); if (!fromUser) return;
    if (!u.friends) u.friends = []; if (!fromUser.friends) fromUser.friends = [];
    if (u.friends.indexOf(req.from) === -1)          u.friends.push(req.from);
    if (fromUser.friends.indexOf(u.username) === -1) fromUser.friends.push(u.username);
    if (!u.followers) u.followers = []; if (!fromUser.following) fromUser.following = [];
    if (u.followers.indexOf(req.from) === -1)           u.followers.push(req.from);
    if (fromUser.following.indexOf(u.username) === -1)  fromUser.following.push(u.username);
    var uIdx = socialDB.users.findIndex(function(x) { return x.username===u.username; });
    var fIdx = socialDB.users.findIndex(function(x) { return x.username===req.from; });
    if (uIdx !== -1) socialDB.users[uIdx] = u;
    if (fIdx !== -1) socialDB.users[fIdx] = fromUser;
    addNotification(req.from, 'friend_accepted', '<strong>' + u.name + '</strong> aceptó tu solicitud de amistad');
    saveDB(); showToast('✅ ¡Ahora son amigos!'); updateBadges();
    renderAmigos(document.getElementById('contentArea'));
};
window.rejectFriendRequest = function(reqId) {
    var req = socialDB.friendRequests.find(function(r) { return r.id===reqId; });
    if (req) req.status = 'rejected';
    saveDB(); showToast('❌ Solicitud rechazada'); updateBadges();
    renderAmigos(document.getElementById('contentArea'));
};

// ── 16. AMIGOS ───────────────────────────────────────────
function renderAmigos(area) {
    var u = socialDB.currentUser;
    var pendingReqs = socialDB.friendRequests.filter(function(r) { return r.to===u.username && r.status==='pending'; });
    var friends = (u.friends||[]).map(function(fn) { return getUser(fn); }).filter(Boolean);
    area.innerHTML = '<div class="friends-tabs">' +
        '<button class="friend-tab active" id="tab-friends" onclick="showFriendsTab(\'friends\')">Mis Amigos (' + friends.length + ')</button>' +
        '<button class="friend-tab" id="tab-requests" onclick="showFriendsTab(\'requests\')">Solicitudes' +
        (pendingReqs.length>0 ? ' <span style="background:var(--secondary);color:#fff;padding:1px 6px;border-radius:10px;font-size:11px;margin-left:4px;">' + pendingReqs.length + '</span>' : '') +
        '</button></div><div id="friendsTabContent"></div>';
    showFriendsTab('friends');
}

window.showFriendsTab = function(tab) {
    document.querySelectorAll('.friend-tab').forEach(function(t) { t.classList.remove('active'); });
    var activeTab = document.getElementById('tab-' + tab); if (activeTab) activeTab.classList.add('active');
    var u = socialDB.currentUser; var content = document.getElementById('friendsTabContent'); if (!content) return;
    if (tab === 'friends') {
        var friends = (u.friends||[]).map(function(fn) { return getUser(fn); }).filter(Boolean);
        if (friends.length === 0) { content.innerHTML = '<div class="empty-state"><i class="fa-solid fa-user-group"></i><p>Aún no tienes amigos.</p></div>'; return; }
        content.innerHTML = '<div class="friends-grid">' + friends.map(function(f) {
            return '<div class="friend-card">' +
                '<div class="friend-card-avatar" onclick="viewFriendProfile(\'' + f.username + '\')" style="cursor:pointer;">' + renderAvatar(f,62) + '</div>' +
                '<div class="friend-card-name" onclick="viewFriendProfile(\'' + f.username + '\')" style="cursor:pointer;">' + f.name + '</div>' +
                '<div style="font-size:11px;color:var(--text-muted);margin-bottom:10px;">@' + f.username + '</div>' +
                '<div style="display:flex;gap:6px;justify-content:center;">' +
                '<button class="btn-message-friend" onclick="viewFriendProfile(\'' + f.username + '\')"><i class="fa-solid fa-user"></i> Perfil</button>' +
                '<button class="btn-message-friend" onclick="openChatWith(\'' + f.username + '\')"><i class="fa-solid fa-message"></i> Chat</button>' +
                '</div></div>';
        }).join('') + '</div>';
    } else {
        var pending = socialDB.friendRequests.filter(function(r) { return r.to===u.username && r.status==='pending'; });
        if (pending.length === 0) { content.innerHTML = '<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>No tienes solicitudes pendientes.</p></div>'; return; }
        content.innerHTML = pending.map(function(req) {
            var fromUser = getUser(req.from); if (!fromUser) return '';
            return '<div class="friend-request-card">' +
                '<div style="width:44px;height:44px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;overflow:hidden;flex-shrink:0;">' + renderAvatar(fromUser,44) + '</div>' +
                '<div style="flex:1;"><div style="font-weight:700;">' + fromUser.name + '</div><div style="font-size:12px;color:var(--text-muted);">@' + fromUser.username + ' · ' + timeAgo(req.createdAt) + '</div></div>' +
                '<div class="request-actions"><button class="btn-accept" onclick="acceptFriendRequest(\'' + req.id + '\')">Aceptar</button><button class="btn-reject" onclick="rejectFriendRequest(\'' + req.id + '\')">Rechazar</button></div></div>';
        }).join('');
    }
};

window.viewFriendProfile = function(username) {
    var friend = getUser(username); if (!friend) return;
    var friendPosts = socialDB.posts.filter(function(p) { return p.authorUsername === username; });
    var overlay = document.getElementById('friendProfileOverlay'); if (!overlay) return;
    overlay.innerHTML = '<div class="modal-box" style="max-width:480px;padding:0;overflow:hidden;border-radius:24px;">' +
        '<div style="height:130px;background:' + (friend.coverPic ? 'url('+friend.coverPic+') center/cover' : 'var(--gradient)') + ';position:relative;">' +
        '<button onclick="closeFriendProfile()" style="position:absolute;top:12px;right:12px;background:rgba(0,0,0,.5);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;">×</button></div>' +
        '<div style="padding:0 24px 24px;position:relative;">' +
        '<div style="width:76px;height:76px;border-radius:50%;border:4px solid var(--bg-card);position:absolute;top:-38px;left:24px;overflow:hidden;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:26px;">' + renderAvatar(friend,76) + '</div>' +
        '<div style="padding-top:46px;">' +
        '<div style="font-size:20px;font-weight:800;">' + friend.name + '</div>' +
        '<div style="font-size:14px;color:var(--text-muted);margin-bottom:8px;">@' + friend.username + '</div>' +
        (friend.bio ? '<div style="font-size:14px;color:var(--text-secondary);margin-bottom:14px;">' + friend.bio + '</div>' : '') +
        '<div style="display:flex;gap:20px;padding:12px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border);margin-bottom:14px;">' +
        ['Posts','Seguidores','Seguidos','Amigos'].map(function(label, i) {
            var vals = [friendPosts.length, (friend.followers||[]).length, (friend.following||[]).length, (friend.friends||[]).length];
            return '<div style="text-align:center;"><div style="font-size:18px;font-weight:800;color:var(--primary);">' + vals[i] + '</div><div style="font-size:12px;color:var(--text-muted);">' + label + '</div></div>';
        }).join('') + '</div>' +
        '<div style="display:flex;gap:10px;margin-bottom:16px;"><button class="btn-join" onclick="openChatWith(\'' + friend.username + '\');closeFriendProfile();" style="flex:1;padding:10px;"><i class="fa-solid fa-message"></i> Enviar mensaje</button></div>' +
        (friendPosts.length > 0 ?
            '<div style="font-weight:700;font-size:14px;margin-bottom:10px;">Publicaciones recientes</div>' +
            '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;max-height:200px;overflow-y:auto;">' +
            friendPosts.map(function(p) {
                return p.media ? '<img src="' + p.media + '" onclick="openFullscreen(\'' + p.media + '\')" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;cursor:pointer;">'
                    : '<div style="background:var(--bg-input);border-radius:8px;aspect-ratio:1;display:flex;align-items:center;justify-content:center;padding:6px;font-size:11px;color:var(--text-secondary);text-align:center;overflow:hidden;">' + (p.content?p.content.substring(0,50):'...') + '</div>';
            }).join('') + '</div>' : '<div style="text-align:center;color:var(--text-muted);font-size:14px;">Sin publicaciones aún.</div>'
        ) + '</div></div></div>';
    overlay.style.display = 'flex';
    setTimeout(function() { overlay.classList.add('active'); }, 10);
};
window.closeFriendProfile = function() {
    var ov = document.getElementById('friendProfileOverlay'); if (!ov) return;
    ov.classList.remove('active');
    setTimeout(function() { ov.style.display = 'none'; ov.innerHTML = ''; }, 400);
};

// ── 17. NOTIFICACIONES ───────────────────────────────────
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
            '<div class="notif-icon" style="' + (n.type==='like'?'background:linear-gradient(135deg,#e91e63,#f44336);':'') + '"><i class="fa-solid ' + (iconMap[n.type]||'fa-bell') + '"></i></div>' +
            '<div class="notif-text">' + n.text + '</div><div class="notif-time">' + timeAgo(n.createdAt) + '</div>' +
            (!n.read ? '<div class="notif-dot"></div>' : '') + '</div>';
    }).join('');
}
window.markNotifRead = function(notifId) {
    var n = socialDB.notifications.find(function(x) { return x.id===notifId; });
    if (n) { n.read = true; saveDB(); updateBadges(); }
};

// ── 18. MENSAJES ─────────────────────────────────────────
function renderMensajes(area) {
    var u = socialDB.currentUser;
    var friends = (u.friends||[]).map(function(fn) { return getUser(fn); }).filter(Boolean);
    var listHTML = friends.length === 0
        ? '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:14px;">Agrega amigos para chatear</div>'
        : friends.map(function(f) {
            var conv = getConversation(u.username, f.username);
            var lastMsg = conv.length > 0 ? conv[conv.length-1] : null;
            var unread  = conv.filter(function(m) { return m.from===f.username && !m.read; }).length;
            return '<div class="message-preview-item ' + (socialDB.activeMessageUser===f.username?'active':'') + '" onclick="openMessagePanel(\'' + f.username + '\')">' +
                '<div class="msg-preview-avatar">' + renderAvatar(f,42) + '</div>' +
                '<div class="msg-preview-info"><div class="msg-preview-name">' + f.name + '</div>' +
                '<div class="msg-preview-last">' + (lastMsg ? (lastMsg.from===u.username?'Tú: ':'')+lastMsg.text.substring(0,30)+(lastMsg.text.length>30?'...':'') : 'Sin mensajes aún') + '</div></div>' +
                (unread>0 ? '<div class="msg-unread-dot"></div>' : '') + '</div>';
        }).join('');
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
        : conv.map(function(m) { var isMe = m.from===socialDB.currentUser.username; return '<div class="msg ' + (isMe?'msg-me':'msg-them') + '">' + m.text + '<div class="msg-time">' + timeAgo(m.createdAt) + '</div></div>'; }).join('');
    var emojiHTML = EMOJIS.map(function(e) { return '<button onclick="insertPanelEmoji(\'' + e + '\')" style="background:none;border:none;font-size:22px;cursor:pointer;padding:3px;border-radius:6px;">' + e + '</button>'; }).join('');
    panel.innerHTML = '<div class="chat-panel-header"><div style="width:36px;height:36px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;overflow:hidden;">' + renderAvatar(friend,36) + '</div><span>' + friend.name + '</span><div style="width:10px;height:10px;border-radius:50%;background:#4caf50;"></div></div>' +
        '<div class="chat-panel-messages" id="panelMessages">' + msgsHTML + '</div>' +
        '<div class="chat-panel-input"><button class="chat-panel-emoji" onclick="togglePanelEmoji()"><i class="fa-regular fa-face-smile"></i></button><input type="text" id="panelMsgInput" placeholder="Escribe un mensaje..." onkeydown="if(event.key===\'Enter\') sendPanelMessage(\'' + username + '\')"><button class="chat-panel-send" onclick="sendPanelMessage(\'' + username + '\')"><i class="fa-solid fa-paper-plane"></i></button></div>' +
        '<div id="panelEmojiPicker" style="display:none;border-top:1px solid var(--border);background:var(--bg-card);padding:10px;max-height:160px;overflow-y:auto;"><div style="display:flex;flex-wrap:wrap;gap:4px;">' + emojiHTML + '</div></div>';
    var msgs = document.getElementById('panelMessages'); if (msgs) msgs.scrollTop = msgs.scrollHeight;
    renderMensajes(document.getElementById('contentArea'));
};
window.sendPanelMessage = function(to) {
    var input = document.getElementById('panelMsgInput'); if (!input || !input.value.trim()) return;
    sendMessageTo(to, input.value.trim()); input.value = ''; openMessagePanel(to);
};
window.togglePanelEmoji = function() { var p = document.getElementById('panelEmojiPicker'); if (p) p.style.display = p.style.display==='none'?'block':'none'; };
window.insertPanelEmoji = function(e) { var i = document.getElementById('panelMsgInput'); if (i) { i.value+=e; i.focus(); } };

function getConversation(u1, u2) {
    if (!socialDB.messages[u1]) socialDB.messages[u1] = {};
    if (!socialDB.messages[u1][u2]) socialDB.messages[u1][u2] = [];
    if (!socialDB.messages[u2]) socialDB.messages[u2] = {};
    if (!socialDB.messages[u2][u1]) socialDB.messages[u2][u1] = [];
    var all = {}; socialDB.messages[u1][u2].forEach(function(m) { all[m.id]=m; }); socialDB.messages[u2][u1].forEach(function(m) { all[m.id]=m; });
    return Object.values(all).sort(function(a,b) { return new Date(a.createdAt)-new Date(b.createdAt); });
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
    [[u.username,fromUsername],[fromUsername,u.username]].forEach(function(pair) {
        if (socialDB.messages[pair[0]] && socialDB.messages[pair[0]][pair[1]])
            socialDB.messages[pair[0]][pair[1]].forEach(function(m) { if (m.from===pair[1]) m.read = true; });
    });
    saveDB();
}

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

window.openChatWith = function(username) {
    socialDB.activeChatUser = username; var friend = getUser(username); if (!friend) return;
    document.getElementById('chatUserName').textContent = friend.name;
    var av = document.getElementById('chatAvatar'); av.innerHTML = renderAvatar(friend,34);
    if (!friend.profilePic) av.style.background = 'rgba(255,255,255,.3)';
    var cw = document.getElementById('chatWindow'); cw.style.display = 'flex'; cw.style.flexDirection = 'column';
    renderChatMessages();
    var grid = document.getElementById('emojiGrid');
    if (grid && grid.children.length === 0) grid.innerHTML = EMOJIS.map(function(e) { return '<button class="emoji-btn" onclick="insertEmoji(\'' + e + '\')">' + e + '</button>'; }).join('');
};
function renderChatMessages() {
    var container = document.getElementById('chatMessages'); if (!container || !socialDB.activeChatUser) return;
    var u = socialDB.currentUser; var conv = getConversation(u.username, socialDB.activeChatUser);
    container.innerHTML = conv.length === 0
        ? '<div style="text-align:center;color:var(--text-muted);font-size:13px;margin-top:20px;">Inicia la conversación 👋</div>'
        : conv.map(function(m) { var isMe = m.from===u.username; return '<div class="msg ' + (isMe?'msg-me':'msg-them') + '">' + m.text + '<div class="msg-time">' + timeAgo(m.createdAt) + '</div></div>'; }).join('');
    container.scrollTop = container.scrollHeight;
}
window.sendMessage = function() {
    var input = document.getElementById('chatInput'); if (!input||!input.value.trim()||!socialDB.activeChatUser) return;
    sendMessageTo(socialDB.activeChatUser, input.value.trim()); input.value = '';
    renderChatMessages(); if (socialDB.currentSection==='mensajes') openMessagePanel(socialDB.activeChatUser);
};
window.closeChat        = function() { document.getElementById('chatWindow').style.display = 'none'; socialDB.activeChatUser = null; };
window.toggleEmojiPicker= function() { var p = document.getElementById('emojiPicker'); if (p) p.style.display = p.style.display==='none'?'block':'none'; };
window.insertEmoji      = function(e) { var i = document.getElementById('chatInput'); if (i) { i.value+=e; i.focus(); } };

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
    var friends    = (u.friends||[]).map(function(fn) { return getUser(fn); }).filter(Boolean);
    if (contactsEl) {
        contactsEl.innerHTML = friends.length === 0 ? '<div style="font-size:13px;color:var(--text-muted);padding:5px 10px;">Sin amigos aún</div>'
            : friends.map(function(f) { return '<div class="contact-item" onclick="openChatWith(\'' + f.username + '\')"><div class="contact-avatar" style="position:relative;">' + renderAvatar(f,38) + '<span class="status-dot online"></span></div><span class="contact-name">' + f.name + '</span></div>'; }).join('');
    }
    if (suggestEl) {
        var suggestions = socialDB.users.filter(function(usr) { return usr.username!==u.username && (u.friends||[]).indexOf(usr.username)===-1; }).slice(0,5);
        suggestEl.innerHTML = suggestions.length === 0 ? '<div style="font-size:13px;color:var(--text-muted);padding:5px 10px;">Sin sugerencias</div>'
            : suggestions.map(function(s) {
                var pending = socialDB.friendRequests.find(function(r) { return r.from===u.username && r.to===s.username && r.status==='pending'; });
                return '<div class="suggestion-item"><div class="suggestion-avatar">' + renderAvatar(s,38) + '</div><div class="suggestion-info"><div class="suggestion-name">' + s.name + '</div><div class="suggestion-meta">@' + s.username + '</div></div>' +
                    (pending ? '<button class="btn-follow" disabled style="opacity:.5;">Enviada</button>' : '<button class="btn-follow" onclick="sendFriendRequest(\'' + s.username + '\');this.textContent=\'Enviada\';this.disabled=true;this.style.opacity=\'.5\';">Seguir</button>') + '</div>';
            }).join('');
    }
}

// ── 22. FULLSCREEN ───────────────────────────────────────
window.openFullscreen = function(src) { var el=document.getElementById('imgFullscreen'); var img=document.getElementById('fullscreenImg'); if(el&&img){img.src=src;el.style.display='flex';} };
window.closeFullscreen = function() { var el=document.getElementById('imgFullscreen'); if(el) el.style.display='none'; };

// ── 23. INICIALIZACIÓN ───────────────────────────────────
window.onload = function() {
    applyTheme(socialDB.currentTheme);

    // ── Restaurar sesión automáticamente al recargar ──
    var savedSession = localStorage.getItem('social_session');
    if (savedSession) {
        // Buscar SIEMPRE dentro del array vivo, no una copia
        var sessionIdx = socialDB.users.findIndex(function(u) { return u.username === savedSession; });
        if (sessionIdx !== -1) {
            socialDB.currentUser = socialDB.users[sessionIdx]; // referencia viva al array
            launchApp();
            return;
        } else {
            // usuario eliminado — limpiar sesión huérfana
            localStorage.removeItem('social_session');
        }
    }

    // Landing normal
    setTimeout(function() { document.querySelectorAll('.anim').forEach(function(el) { el.classList.add('show'); }); }, 100);

    // Parallax hero
    document.addEventListener('mousemove', function(e) {
        var img = document.querySelector('.feature-img');
        if (img) img.style.transform = 'translateX(' + (window.innerWidth/2-e.pageX)/80 + 'px) translateY(' + (window.innerHeight/2-e.pageY)/80 + 'px)';
    });

    document.getElementById('openRegister').addEventListener('click', function() {
        openRegisterModal();
    });
    document.getElementById('openLogin').addEventListener('click', function() {
        openLoginModal();
    });
    document.getElementById('closeModal').addEventListener('click', function() { toggleModal(false); });
    document.getElementById('heroStartBtn').addEventListener('click', function() { closeMobileMenu(); document.getElementById('openRegister').click(); });
    document.getElementById('modalOverlay').addEventListener('click', function(e) { if (e.target===this) toggleModal(false); });
    // Cerrar menú móvil al hacer click fuera
    document.addEventListener('click', function(e) {
        var menu = document.getElementById('mobileMenu');
        var btn  = document.getElementById('hamburgerBtn');
        if (menu && menu.classList.contains('open')) {
            if (!menu.contains(e.target) && !btn.contains(e.target)) {
                closeMobileMenu();
            }
        }
    });
    // Cerrar modal legal al hacer click fuera
    document.getElementById('legalModal').addEventListener('click', function(e) { if (e.target===this) closeLegal(); });
    // Inicializar banner de cookies
    initCookieBanner();
};
