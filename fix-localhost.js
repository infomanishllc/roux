(function() {
    var TARGET_ORIGIN = 'http://localhost:3000';
    var UNKNOWN_ERROR_TEXT = 'An unknown error occurred.';
    var CARD_ID = 'custom-preferences-card';
    var STYLE_ID = 'custom-preferences-style';
    var IDENTITY_KEY = 'rbx_identity_v1';

    // Rewrite selected Roblox API calls through local endpoints/proxies/stubs
    function rewriteApiUrl(url) {
        if (!url) return url;
        var s = String(url);
        return s
            .replace(/^https?:\/\/users\.roblox\.com\//i, TARGET_ORIGIN + '/proxy/users/')
            .replace(/^https?:\/\/thumbnails\.roblox\.com\//i, TARGET_ORIGIN + '/proxy/thumbnails/')
            .replace(/^https?:\/\/friends\.roblox\.com\//i, TARGET_ORIGIN + '/proxy/friends/')
            .replace(/^https?:\/\/economy\.roblox\.com\//i, TARGET_ORIGIN + '/proxy/economy/')
            .replace(/^https?:\/\/apis\.roblox\.com\/payments-metrics\/v1\/metrics\/publish/i,
                TARGET_ORIGIN + '/payments-metrics/v1/metrics/publish')
            // Profile API needs a real shape so the navbar can render the user
            .replace(/^https?:\/\/apis\.roblox\.com\/user-profile-api\/.*$/i,
                TARGET_ORIGIN + '/stub/user-profiles')
            // Locales list used by the footer
            .replace(/^https?:\/\/locale\.roblox\.com\/v1\/locales.*$/i,
                TARGET_ORIGIN + '/stub/locales')
            // Everything else → empty JSON stub (prevents CORS/401 noise)
            .replace(/^https?:\/\/metrics\.roblox\.com\/.*$/i,
                TARGET_ORIGIN + '/stub/empty-json')
            .replace(/^https?:\/\/apis\.roblox\.com\/guac-v2\/.*$/i,
                TARGET_ORIGIN + '/stub/empty-json')
            .replace(/^https?:\/\/apis\.roblox\.com\/rotating-client-service\/.*$/i,
                TARGET_ORIGIN + '/stub/empty-json')
            .replace(/^https?:\/\/apis\.roblox\.com\/product-experimentation-platform\/.*$/i,
                TARGET_ORIGIN + '/stub/empty-json')
            .replace(/^https?:\/\/apis\.roblox\.com\/beacon-api\/.*$/i,
                TARGET_ORIGIN + '/stub/empty-json')
            .replace(/^https?:\/\/apis\.roblox\.com\/account-security-service\/.*$/i,
                TARGET_ORIGIN + '/stub/empty-json')
            .replace(/^https?:\/\/apis\.roblox\.com\/credit-balance\/.*$/i,
                TARGET_ORIGIN + '/stub/empty-json')
            .replace(/^https?:\/\/apis\.roblox\.com\/robuxbadge\/.*$/i,
                TARGET_ORIGIN + '/stub/empty-json')
            .replace(/^https?:\/\/apis\.roblox\.com\/payments-gateway\/.*$/i,
                TARGET_ORIGIN + '/stub/empty-json')
            .replace(/^https?:\/\/apis\.roblox\.com\/user-agreements\/.*$/i,
                TARGET_ORIGIN + '/stub/empty-json')
            .replace(/^https?:\/\/apis\.roblox\.com\/share-links-api\/.*$/i,
                TARGET_ORIGIN + '/stub/empty-json')
            .replace(/^https?:\/\/apis\.roblox\.com\/notifications-api\/.*$/i,
                TARGET_ORIGIN + '/stub/empty-json')
            .replace(/^https?:\/\/apis\.roblox\.com\/voice\/.*$/i,
                TARGET_ORIGIN + '/stub/empty-json')
            .replace(/^https?:\/\/apis\.roblox\.com\/universal-app-configuration\/.*$/i,
                TARGET_ORIGIN + '/stub/empty-json')
            .replace(/^https?:\/\/trades\.roblox\.com\/.*$/i,
                TARGET_ORIGIN + '/stub/empty-json')
            .replace(/^https?:\/\/privatemessages\.roblox\.com\/.*$/i,
                TARGET_ORIGIN + '/stub/empty-json')
            .replace(/^https?:\/\/presence\.roblox\.com\/.*$/i,
                TARGET_ORIGIN + '/stub/empty-json')
            .replace(/^https?:\/\/accountsettings\.roblox\.com\/.*$/i,
                TARGET_ORIGIN + '/stub/empty-json')
            .replace(/^https?:\/\/notifications\.roblox\.com\/.*$/i,
                TARGET_ORIGIN + '/stub/empty-json')
            .replace(/^https?:\/\/badges\.roblox\.com\/.*$/i,
                TARGET_ORIGIN + '/stub/empty-json')
            .replace(/^https?:\/\/groups\.roblox\.com\/.*$/i,
                TARGET_ORIGIN + '/stub/empty-json')
            .replace(/^https?:\/\/inventory\.roblox\.com\/.*$/i,
                TARGET_ORIGIN + '/stub/empty-json')
            .replace(/^https?:\/\/ecsv2\.roblox\.com\/.*$/i,
                TARGET_ORIGIN + '/stub/empty-json')
            .replace(/^https?:\/\/(www\.)?google-analytics\.com\/.*$/i,
                TARGET_ORIGIN + '/stub/empty-json')
            // Any *.metrics.* host (e.g. metrics.localhost) → local stub
            .replace(/^https?:\/\/[^/]*metrics[^/]*\/.*$/i,
                TARGET_ORIGIN + '/stub/empty-json')
            // Roblox omni-search → use our local users proxy instead (avoid CORS)
            .replace(/^https?:\/\/apis\.roblox\.com\/search-api\/.*$/i,
                TARGET_ORIGIN + '/stub/empty-json')
            // Catch-all: any remaining apis.roblox.com endpoint → empty stub
            .replace(/^https?:\/\/apis\.roblox\.com\/.*$/i,
                TARGET_ORIGIN + '/stub/empty-json');
    }

    // ── Fetch patch: redirect Roblox API calls through our local proxy ──────────
    (function patchFetch() {
        if (!window.fetch || window._rbxFetchPatched) return;
        window._rbxFetchPatched = true;
        var _orig = window.fetch;
        window.fetch = function(input, init) {
            var url = typeof input === 'string' ? input :
                (input instanceof Request ? input.url : String(input));
            var patched = rewriteApiUrl(url);
            if (patched !== url) {
                input = typeof input === 'string' ? patched : new Request(patched, input);
            }
            return _orig.call(this, input, init);
        };
    })();

    // ── XHR patch: rewrite metrics POST to local endpoint (no blocking) ─────────
    (function patchXHR() {
        if (window._rbxXhrPatched || !window.XMLHttpRequest) return;
        window._rbxXhrPatched = true;
        var _origOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url) {
            var args = Array.prototype.slice.call(arguments);
            args[1] = rewriteApiUrl(url);
            return _origOpen.apply(this, args);
        };
    })();

    // ── Worker patch: replace cross-origin workers with a no-op blob worker ────
    (function patchWorker() {
        if (!window.Worker || window._rbxWorkerPatched) return;
        window._rbxWorkerPatched = true;
        var _OrigWorker = window.Worker;
        var noopBlob = URL.createObjectURL(new Blob(['/* no-op */'], {
            type: 'application/javascript'
        }));
        window.Worker = function(url, opts) {
            try {
                var u = new URL(url, window.location.href);
                if (u.origin !== window.location.origin) {
                    return new _OrigWorker(noopBlob, opts);
                }
            } catch (e) {}
            return new _OrigWorker(url, opts);
        };
        window.Worker.prototype = _OrigWorker.prototype;
    })();

    // ── WebSocket patch: silently swallow Roblox realtime endpoints ───────────
    (function patchWebSocket() {
        if (!window.WebSocket || window._rbxWsPatched) return;
        window._rbxWsPatched = true;
        var _OrigWS = window.WebSocket;

        function DeadSocket(url) {
            this.url = url;
            this.readyState = 3; // CLOSED
            this.send = function() {};
            this.close = function() {};
            this.addEventListener = function() {};
            this.removeEventListener = function() {};
        }
        var WSWrapper = function(url, protocols) {
            try {
                if (/realtime-signalr\.roblox\.com|realtime\.roblox\.com/i.test(String(url))) {
                    return new DeadSocket(url);
                }
            } catch (e) {}
            return protocols ? new _OrigWS(url, protocols) : new _OrigWS(url);
        };
        WSWrapper.prototype = _OrigWS.prototype;
        WSWrapper.CONNECTING = 0;
        WSWrapper.OPEN = 1;
        WSWrapper.CLOSING = 2;
        WSWrapper.CLOSED = 3;
        window.WebSocket = WSWrapper;
    })();

    // ── AngularJS shim: register missing notificationStreamIcon module ────────
    (function shimAngularModules() {
        var tries = 0;
        var t = setInterval(function() {
            tries++;
            if (window.angular && typeof window.angular.module === 'function') {
                try {
                    window.angular.module('notificationStreamIcon', []);
                } catch (e) {}
                clearInterval(t);
            } else if (tries > 40) {
                clearInterval(t);
            }
        }, 250);
    })();

    // ── Identity storage ─────────────────────────────────────────────
    function getIdentity() {
        try {
            var raw = localStorage.getItem(IDENTITY_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        var meta = document.querySelector('meta[name="user-data"]');
        var username = 'dolvolo1';
        var userId = '10958100307';
        var displayName = username;
        if (meta && meta.dataset) {
            username = meta.dataset.name || username;
            userId = meta.dataset.userid || userId;
            displayName = meta.dataset.displayname || username;
        }
        return {
            username: username,
            userId: userId,
            displayName: displayName,
            avatarUrl: ''
        };
    }

    function setIdentity(id) {
        try {
            localStorage.setItem(IDENTITY_KEY, JSON.stringify(id));
        } catch (e) {}
        window._rbxIdentity = id;
        applyIdentityToPage();
    }
    window._rbxIdentity = getIdentity();

    // ── Custom locale / language switcher ───────────────────────────
    var LOCALE_KEY = 'rbx_locale_v1';
    var LOCALE_OPTIONS = [{
            v: '',
            label: '(Auto)'
        },
        {
            v: 'en_us',
            label: 'English (US)'
        },
        {
            v: 'en_gb',
            label: 'English (UK)'
        },
        {
            v: 'es_es',
            label: 'Español (España)'
        },
        {
            v: 'es_mx',
            label: 'Español (México)'
        },
        {
            v: 'fr_fr',
            label: 'Français'
        },
        {
            v: 'de_de',
            label: 'Deutsch'
        },
        {
            v: 'it_it',
            label: 'Italiano'
        },
        {
            v: 'pt_br',
            label: 'Português (BR)'
        },
        {
            v: 'id_id',
            label: 'Bahasa Indonesia'
        },
        {
            v: 'ms_my',
            label: 'Bahasa Melayu'
        },
        {
            v: 'vi_vn',
            label: 'Tiếng Việt'
        },
        {
            v: 'th_th',
            label: 'ภาษาไทย'
        },
        {
            v: 'tr_tr',
            label: 'Türkçe'
        },
        {
            v: 'ru_ru',
            label: 'Русский'
        },
        {
            v: 'ja_jp',
            label: '日本語'
        },
        {
            v: 'ko_kr',
            label: '한국어'
        },
        {
            v: 'zh_cn',
            label: '中文 (简体)'
        },
        {
            v: 'zh_tw',
            label: '中文 (繁體)'
        },
        {
            v: 'ar_001',
            label: 'العربية'
        }
    ];

    function getLocale() {
        return localStorage.getItem(LOCALE_KEY) || '';
    }

    function setLocale(v) {
        if (v) localStorage.setItem(LOCALE_KEY, v);
        else localStorage.removeItem(LOCALE_KEY);
        applyLocale();
        applyTranslations();
    }

    function applyLocale() {
        var v = getLocale();
        if (!v) return;
        var sel = document.getElementById('language-switcher');
        if (sel && sel.value !== v) {
            var found = false;
            for (var i = 0; i < sel.options.length; i++) {
                if (sel.options[i].value === v) {
                    found = true;
                    break;
                }
            }
            if (found) {
                sel.value = v;
                sel.dispatchEvent(new Event('change', {
                    bubbles: true
                }));
            }
        }
        // Reflect in our footer/cards selects.
        document.querySelectorAll('select[data-rbx-locale]').forEach(function(s) {
            if (s.value !== v) s.value = v;
        });
    }

    // ── Translations (UI labels) ────────────────────────────────────
    // Only frequent, exact-match strings. Walks text nodes and replaces
    // when the trimmed value matches a key (case-insensitive).
    var TRANSLATIONS = {
        es_es: {
            'Home': 'Inicio',
            'Discover': 'Descubrir',
            'Marketplace': 'Mercado',
            'Create': 'Crear',
            'Robux': 'Robux',
            'Charts': 'Listas',
            'Settings': 'Ajustes',
            'Account Info': 'Información de la cuenta',
            'Username': 'Usuario',
            'Display Name': 'Nombre para mostrar',
            'Email Address': 'Correo electrónico',
            'Phone Number': 'Número de teléfono',
            'Password': 'Contraseña',
            'Birthday': 'Fecha de nacimiento',
            'Gender': 'Género',
            'Save': 'Guardar',
            'Edit': 'Editar',
            'Account': 'Cuenta',
            'Security': 'Seguridad',
            'Privacy': 'Privacidad',
            'Notifications': 'Notificaciones',
            'Trade': 'Intercambio',
            'Payment Methods': 'Métodos de pago',
            'Subscriptions': 'Suscripciones',
            'Billing': 'Facturación',
            'Promocodes': 'Códigos promocionales',
            'Friends': 'Amigos',
            'Messages': 'Mensajes',
            'Search': 'Buscar',
            'Sign Out': 'Cerrar sesión',
            'Log Out': 'Cerrar sesión',
            'Buy Robux': 'Comprar Robux',
            'Get Robux': 'Obtener Robux',
            'My Feed': 'Mi muro',
            'Inventory': 'Inventario',
            'Avatar': 'Avatar',
            'Language': 'Idioma'
        },
        es_mx: null, // alias filled below
        fr_fr: {
            'Home': 'Accueil',
            'Discover': 'Découvrir',
            'Marketplace': 'Marché',
            'Create': 'Créer',
            'Robux': 'Robux',
            'Charts': 'Classements',
            'Settings': 'Paramètres',
            'Account Info': 'Infos du compte',
            'Username': 'Nom d\u2019utilisateur',
            'Display Name': 'Nom affiché',
            'Email Address': 'Adresse e-mail',
            'Phone Number': 'Numéro de téléphone',
            'Password': 'Mot de passe',
            'Birthday': 'Anniversaire',
            'Gender': 'Genre',
            'Save': 'Enregistrer',
            'Edit': 'Modifier',
            'Account': 'Compte',
            'Security': 'Sécurité',
            'Privacy': 'Confidentialité',
            'Notifications': 'Notifications',
            'Trade': 'Échange',
            'Payment Methods': 'Moyens de paiement',
            'Subscriptions': 'Abonnements',
            'Billing': 'Facturation',
            'Promocodes': 'Codes promo',
            'Friends': 'Amis',
            'Messages': 'Messages',
            'Search': 'Rechercher',
            'Sign Out': 'Déconnexion',
            'Log Out': 'Déconnexion',
            'Buy Robux': 'Acheter des Robux',
            'Get Robux': 'Obtenir des Robux',
            'My Feed': 'Mon fil',
            'Inventory': 'Inventaire',
            'Avatar': 'Avatar',
            'Language': 'Langue'
        },
        de_de: {
            'Home': 'Startseite',
            'Discover': 'Entdecken',
            'Marketplace': 'Marktplatz',
            'Create': 'Erstellen',
            'Robux': 'Robux',
            'Charts': 'Charts',
            'Settings': 'Einstellungen',
            'Account Info': 'Kontoinformationen',
            'Username': 'Benutzername',
            'Display Name': 'Anzeigename',
            'Email Address': 'E-Mail-Adresse',
            'Phone Number': 'Telefonnummer',
            'Password': 'Passwort',
            'Birthday': 'Geburtstag',
            'Gender': 'Geschlecht',
            'Save': 'Speichern',
            'Edit': 'Bearbeiten',
            'Account': 'Konto',
            'Security': 'Sicherheit',
            'Privacy': 'Datenschutz',
            'Notifications': 'Benachrichtigungen',
            'Trade': 'Tausch',
            'Payment Methods': 'Zahlungsmethoden',
            'Subscriptions': 'Abos',
            'Billing': 'Abrechnung',
            'Promocodes': 'Promo-Codes',
            'Friends': 'Freunde',
            'Messages': 'Nachrichten',
            'Search': 'Suchen',
            'Sign Out': 'Abmelden',
            'Log Out': 'Abmelden',
            'Buy Robux': 'Robux kaufen',
            'Get Robux': 'Robux holen',
            'My Feed': 'Mein Feed',
            'Inventory': 'Inventar',
            'Avatar': 'Avatar',
            'Language': 'Sprache'
        },
        pt_br: {
            'Home': 'Início',
            'Discover': 'Descobrir',
            'Marketplace': 'Mercado',
            'Create': 'Criar',
            'Robux': 'Robux',
            'Charts': 'Ranking',
            'Settings': 'Configurações',
            'Account Info': 'Informações da conta',
            'Username': 'Usuário',
            'Display Name': 'Nome de exibição',
            'Email Address': 'E-mail',
            'Phone Number': 'Número de telefone',
            'Password': 'Senha',
            'Birthday': 'Data de nascimento',
            'Gender': 'Gênero',
            'Save': 'Salvar',
            'Edit': 'Editar',
            'Account': 'Conta',
            'Security': 'Segurança',
            'Privacy': 'Privacidade',
            'Notifications': 'Notificações',
            'Trade': 'Troca',
            'Payment Methods': 'Métodos de pagamento',
            'Subscriptions': 'Assinaturas',
            'Billing': 'Cobrança',
            'Promocodes': 'Códigos promocionais',
            'Friends': 'Amigos',
            'Messages': 'Mensagens',
            'Search': 'Buscar',
            'Sign Out': 'Sair',
            'Log Out': 'Sair',
            'Buy Robux': 'Comprar Robux',
            'Get Robux': 'Obter Robux',
            'My Feed': 'Meu Feed',
            'Inventory': 'Inventário',
            'Avatar': 'Avatar',
            'Language': 'Idioma'
        },
        id_id: {
            'Home': 'Beranda',
            'Discover': 'Jelajahi',
            'Marketplace': 'Pasar',
            'Create': 'Buat',
            'Robux': 'Robux',
            'Charts': 'Tangga Lagu',
            'Settings': 'Pengaturan',
            'Account Info': 'Info Akun',
            'Username': 'Nama pengguna',
            'Display Name': 'Nama tampilan',
            'Email Address': 'Alamat email',
            'Phone Number': 'Nomor telepon',
            'Password': 'Kata sandi',
            'Birthday': 'Tanggal lahir',
            'Gender': 'Jenis kelamin',
            'Save': 'Simpan',
            'Edit': 'Ubah',
            'Account': 'Akun',
            'Security': 'Keamanan',
            'Privacy': 'Privasi',
            'Notifications': 'Notifikasi',
            'Trade': 'Perdagangan',
            'Payment Methods': 'Metode pembayaran',
            'Subscriptions': 'Langganan',
            'Billing': 'Penagihan',
            'Promocodes': 'Kode promo',
            'Friends': 'Teman',
            'Messages': 'Pesan',
            'Search': 'Cari',
            'Sign Out': 'Keluar',
            'Log Out': 'Keluar',
            'Buy Robux': 'Beli Robux',
            'Get Robux': 'Dapatkan Robux',
            'My Feed': 'Feed Saya',
            'Inventory': 'Inventaris',
            'Avatar': 'Avatar',
            'Language': 'Bahasa'
        },
        th_th: {
            'Home': 'หน้าแรก',
            'Discover': 'ค้นพบ',
            'Marketplace': 'ตลาด',
            'Create': 'สร้าง',
            'Robux': 'Robux',
            'Charts': 'อันดับ',
            'Settings': 'การตั้งค่า',
            'Account Info': 'ข้อมูลบัญชี',
            'Username': 'ชื่อผู้ใช้',
            'Display Name': 'ชื่อที่แสดง',
            'Email Address': 'อีเมล',
            'Phone Number': 'หมายเลขโทรศัพท์',
            'Password': 'รหัสผ่าน',
            'Birthday': 'วันเกิด',
            'Gender': 'เพศ',
            'Save': 'บันทึก',
            'Edit': 'แก้ไข',
            'Account': 'บัญชี',
            'Security': 'ความปลอดภัย',
            'Privacy': 'ความเป็นส่วนตัว',
            'Notifications': 'การแจ้งเตือน',
            'Trade': 'แลกเปลี่ยน',
            'Payment Methods': 'วิธีชำระเงิน',
            'Subscriptions': 'การสมัครสมาชิก',
            'Billing': 'การเรียกเก็บเงิน',
            'Promocodes': 'รหัสโปรโมชั่น',
            'Friends': 'เพื่อน',
            'Messages': 'ข้อความ',
            'Search': 'ค้นหา',
            'Sign Out': 'ออกจากระบบ',
            'Log Out': 'ออกจากระบบ',
            'Buy Robux': 'ซื้อ Robux',
            'Get Robux': 'รับ Robux',
            'My Feed': 'ฟีดของฉัน',
            'Inventory': 'คลังของฉัน',
            'Avatar': 'อวตาร',
            'Language': 'ภาษา'
        },
        ja_jp: {
            'Home': 'ホーム',
            'Discover': '見つける',
            'Marketplace': 'マーケット',
            'Create': '作成',
            'Robux': 'Robux',
            'Charts': 'ランキング',
            'Settings': '設定',
            'Account Info': 'アカウント情報',
            'Username': 'ユーザー名',
            'Display Name': '表示名',
            'Email Address': 'メールアドレス',
            'Phone Number': '電話番号',
            'Password': 'パスワード',
            'Birthday': '誕生日',
            'Gender': '性別',
            'Save': '保存',
            'Edit': '編集',
            'Account': 'アカウント',
            'Security': 'セキュリティ',
            'Privacy': 'プライバシー',
            'Notifications': '通知',
            'Trade': 'トレード',
            'Payment Methods': '支払い方法',
            'Subscriptions': 'サブスクリプション',
            'Billing': '請求',
            'Promocodes': 'プロモコード',
            'Friends': 'フレンド',
            'Messages': 'メッセージ',
            'Search': '検索',
            'Sign Out': 'サインアウト',
            'Log Out': 'ログアウト',
            'Buy Robux': 'Robuxを買う',
            'Get Robux': 'Robuxを入手',
            'My Feed': 'マイフィード',
            'Inventory': 'インベントリ',
            'Avatar': 'アバター',
            'Language': '言語'
        },
        ko_kr: {
            'Home': '홈',
            'Discover': '둘러보기',
            'Marketplace': '마켓플레이스',
            'Create': '만들기',
            'Robux': 'Robux',
            'Charts': '차트',
            'Settings': '설정',
            'Account Info': '계정 정보',
            'Username': '사용자 이름',
            'Display Name': '표시 이름',
            'Email Address': '이메일 주소',
            'Phone Number': '전화번호',
            'Password': '비밀번호',
            'Birthday': '생일',
            'Gender': '성별',
            'Save': '저장',
            'Edit': '편집',
            'Account': '계정',
            'Security': '보안',
            'Privacy': '개인 정보',
            'Notifications': '알림',
            'Trade': '거래',
            'Payment Methods': '결제 수단',
            'Subscriptions': '구독',
            'Billing': '청구',
            'Promocodes': '프로모션 코드',
            'Friends': '친구',
            'Messages': '메시지',
            'Search': '검색',
            'Sign Out': '로그아웃',
            'Log Out': '로그아웃',
            'Buy Robux': 'Robux 구매',
            'Get Robux': 'Robux 받기',
            'My Feed': '내 피드',
            'Inventory': '인벤토리',
            'Avatar': '아바타',
            'Language': '언어'
        },
        zh_cn: {
            'Home': '首页',
            'Discover': '发现',
            'Marketplace': '市场',
            'Create': '创建',
            'Robux': 'Robux',
            'Charts': '排行榜',
            'Settings': '设置',
            'Account Info': '账户信息',
            'Username': '用户名',
            'Display Name': '显示名称',
            'Email Address': '电子邮件',
            'Phone Number': '电话号码',
            'Password': '密码',
            'Birthday': '生日',
            'Gender': '性别',
            'Save': '保存',
            'Edit': '编辑',
            'Account': '账户',
            'Security': '安全',
            'Privacy': '隐私',
            'Notifications': '通知',
            'Trade': '交易',
            'Payment Methods': '支付方式',
            'Subscriptions': '订阅',
            'Billing': '账单',
            'Promocodes': '促销代码',
            'Friends': '好友',
            'Messages': '消息',
            'Search': '搜索',
            'Sign Out': '退出',
            'Log Out': '登出',
            'Buy Robux': '购买Robux',
            'Get Robux': '获取Robux',
            'My Feed': '我的动态',
            'Inventory': '库存',
            'Avatar': '头像',
            'Language': '语言'
        }
    };
    TRANSLATIONS.es_mx = TRANSLATIONS.es_es;
    TRANSLATIONS.en_gb = null; // English passthrough
    TRANSLATIONS.en_us = null;

    // Extra strings frequently seen on Buy Robux / FAQ / footer pages.
    // Mixed-in for each non-English locale.
    var EXTRA_STRINGS = {
        th_th: {
            'Popular pick': 'ตัวเลือกยอดนิยม',
            'Robux packages': 'แพ็กเกจ Robux',
            'New on Roblox': 'ใหม่บน Roblox',
            'Learn more': 'เรียนรู้เพิ่มเติม',
            'Roblox Plus': 'Roblox Plus',
            'Free private servers': 'เซิร์ฟเวอร์ส่วนตัวฟรี',
            'Send Robux for free': 'ส่ง Robux ฟรี',
            'All exclusive perks and discounts in Plus': 'สิทธิพิเศษและส่วนลดทั้งหมดใน Plus',
            'Enjoy up to 25% more Robux': 'รับ Robux เพิ่มสูงสุด 25%',
            'more Robux': 'Robux เพิ่ม',
            'more': 'เพิ่ม',
            'every month': 'ทุกเดือน',
            'value': 'มูลค่า',
            'off in-game items, avatars and more': 'ส่วนลดสำหรับไอเทมในเกม อวตาร และอื่น ๆ',
            'FAQ': 'คำถามที่พบบ่อย',
            'What are Robux?': 'Robux คืออะไร?',
            'Where are my Robux?': 'Robux ของฉันอยู่ที่ไหน?',
            'Do Robux expire?': 'Robux หมดอายุไหม?',
            'How to redeem your gift card?': 'จะแลกบัตรของขวัญได้อย่างไร?',
            'About Us': 'เกี่ยวกับเรา',
            'Jobs': 'งาน',
            'Blog': 'บล็อก',
            'Parents': 'ผู้ปกครอง',
            'Buy Gift Cards': 'ซื้อบัตรของขวัญ',
            'Help': 'ช่วยเหลือ',
            'Terms': 'ข้อกำหนด',
            'Accessibility': 'การเข้าถึง',
            'Your Privacy Choices': 'ตัวเลือกความเป็นส่วนตัวของคุณ',
            'Sitemap': 'แผนผังเว็บไซต์',
            'Continue': 'ดำเนินการต่อ',
            'Cancel': 'ยกเลิก',
            'Back': 'ย้อนกลับ',
            'Next': 'ถัดไป',
            'Loading': 'กำลังโหลด',
            'Total': 'รวม',
            'Subtotal': 'ยอดรวมย่อย',
            'Tax': 'ภาษี',
            'Discount': 'ส่วนลด',
            'Premium': 'พรีเมียม',
            'Subscribe': 'สมัครสมาชิก',
            'Cancel subscription': 'ยกเลิกการสมัครสมาชิก'
        },
        ja_jp: {
            'Popular pick': '人気のピック',
            'Robux packages': 'Robuxパッケージ',
            'New on Roblox': 'Robloxの新着',
            'Learn more': '詳細を見る',
            'Roblox Plus': 'Roblox Plus',
            'Free private servers': '無料のプライベートサーバー',
            'Send Robux for free': 'Robuxを無料で送信',
            'All exclusive perks and discounts in Plus': 'Plusのすべての特典と割引',
            'Enjoy up to 25% more Robux': '最大25%多くのRobuxを獲得',
            'more Robux': '追加のRobux',
            'every month': '毎月',
            'value': '相当',
            'FAQ': 'よくある質問',
            'What are Robux?': 'Robuxとは？',
            'Where are my Robux?': '私のRobuxはどこ？',
            'Do Robux expire?': 'Robuxの有効期限は？',
            'How to redeem your gift card?': 'ギフトカードの引き換え方法',
            'About Us': '会社概要',
            'Jobs': '採用情報',
            'Blog': 'ブログ',
            'Parents': '保護者向け',
            'Buy Gift Cards': 'ギフトカードを購入',
            'Help': 'ヘルプ',
            'Terms': '利用規約',
            'Accessibility': 'アクセシビリティ',
            'Your Privacy Choices': 'プライバシー設定',
            'Sitemap': 'サイトマップ',
            'Continue': '続行',
            'Cancel': 'キャンセル',
            'Total': '合計'
        },
        ko_kr: {
            'Popular pick': '인기 선택',
            'Robux packages': 'Robux 패키지',
            'New on Roblox': 'Roblox 신상품',
            'Learn more': '자세히 보기',
            'Free private servers': '무료 프라이빗 서버',
            'Send Robux for free': 'Robux 무료 전송',
            'Enjoy up to 25% more Robux': '최대 25% 더 많은 Robux',
            'every month': '매월',
            'value': '가치',
            'FAQ': '자주 묻는 질문',
            'About Us': '회사 소개',
            'Jobs': '채용',
            'Blog': '블로그',
            'Parents': '학부모',
            'Help': '도움말',
            'Terms': '약관',
            'Accessibility': '접근성',
            'Sitemap': '사이트맵',
            'Continue': '계속',
            'Cancel': '취소',
            'Total': '합계'
        },
        zh_cn: {
            'Popular pick': '热门选择',
            'Robux packages': 'Robux套餐',
            'New on Roblox': 'Roblox新品',
            'Learn more': '了解更多',
            'Free private servers': '免费私人服务器',
            'Send Robux for free': '免费发送Robux',
            'Enjoy up to 25% more Robux': '享受最多25%更多Robux',
            'every month': '每月',
            'value': '价值',
            'FAQ': '常见问题',
            'About Us': '关于我们',
            'Jobs': '招聘',
            'Blog': '博客',
            'Parents': '家长',
            'Help': '帮助',
            'Terms': '条款',
            'Accessibility': '无障碍',
            'Sitemap': '网站地图',
            'Continue': '继续',
            'Cancel': '取消',
            'Total': '总计'
        },
        es_es: {
            'Popular pick': 'Opción popular',
            'Robux packages': 'Paquetes de Robux',
            'New on Roblox': 'Nuevo en Roblox',
            'Learn more': 'Más información',
            'Free private servers': 'Servidores privados gratuitos',
            'Send Robux for free': 'Enviar Robux gratis',
            'Enjoy up to 25% more Robux': 'Disfruta hasta 25% más de Robux',
            'every month': 'cada mes',
            'value': 'valor',
            'FAQ': 'Preguntas frecuentes',
            'About Us': 'Sobre nosotros',
            'Jobs': 'Empleo',
            'Blog': 'Blog',
            'Parents': 'Padres',
            'Help': 'Ayuda',
            'Terms': 'Términos',
            'Accessibility': 'Accesibilidad',
            'Sitemap': 'Mapa del sitio',
            'Continue': 'Continuar',
            'Cancel': 'Cancelar',
            'Total': 'Total'
        },
        fr_fr: {
            'Popular pick': 'Choix populaire',
            'Robux packages': 'Packs Robux',
            'New on Roblox': 'Nouveau sur Roblox',
            'Learn more': 'En savoir plus',
            'Free private servers': 'Serveurs privés gratuits',
            'Send Robux for free': 'Envoyer des Robux gratuitement',
            'Enjoy up to 25% more Robux': 'Profitez de jusqu\u2019à 25 % de Robux en plus',
            'every month': 'chaque mois',
            'value': 'valeur',
            'FAQ': 'FAQ',
            'About Us': 'À propos',
            'Jobs': 'Emplois',
            'Blog': 'Blog',
            'Parents': 'Parents',
            'Help': 'Aide',
            'Terms': 'Conditions',
            'Accessibility': 'Accessibilité',
            'Sitemap': 'Plan du site',
            'Continue': 'Continuer',
            'Cancel': 'Annuler',
            'Total': 'Total'
        },
        de_de: {
            'Popular pick': 'Beliebte Wahl',
            'Robux packages': 'Robux-Pakete',
            'New on Roblox': 'Neu auf Roblox',
            'Learn more': 'Mehr erfahren',
            'Free private servers': 'Kostenlose private Server',
            'Send Robux for free': 'Robux kostenlos senden',
            'Enjoy up to 25% more Robux': 'Bis zu 25 % mehr Robux',
            'every month': 'jeden Monat',
            'value': 'Wert',
            'FAQ': 'FAQ',
            'About Us': 'Über uns',
            'Jobs': 'Karriere',
            'Blog': 'Blog',
            'Parents': 'Eltern',
            'Help': 'Hilfe',
            'Terms': 'AGB',
            'Accessibility': 'Barrierefreiheit',
            'Sitemap': 'Sitemap',
            'Continue': 'Weiter',
            'Cancel': 'Abbrechen',
            'Total': 'Gesamt'
        },
        pt_br: {
            'Popular pick': 'Escolha popular',
            'Robux packages': 'Pacotes de Robux',
            'New on Roblox': 'Novo no Roblox',
            'Learn more': 'Saiba mais',
            'Free private servers': 'Servidores privados grátis',
            'Send Robux for free': 'Enviar Robux grátis',
            'Enjoy up to 25% more Robux': 'Aproveite até 25% mais Robux',
            'every month': 'todo mês',
            'value': 'valor',
            'FAQ': 'Perguntas frequentes',
            'About Us': 'Sobre',
            'Jobs': 'Vagas',
            'Blog': 'Blog',
            'Parents': 'Pais',
            'Help': 'Ajuda',
            'Terms': 'Termos',
            'Accessibility': 'Acessibilidade',
            'Sitemap': 'Mapa do site',
            'Continue': 'Continuar',
            'Cancel': 'Cancelar',
            'Total': 'Total'
        },
        id_id: {
            'Popular pick': 'Pilihan populer',
            'Robux packages': 'Paket Robux',
            'New on Roblox': 'Baru di Roblox',
            'Learn more': 'Pelajari lebih lanjut',
            'Free private servers': 'Server pribadi gratis',
            'Send Robux for free': 'Kirim Robux gratis',
            'Enjoy up to 25% more Robux': 'Nikmati hingga 25% lebih banyak Robux',
            'every month': 'setiap bulan',
            'value': 'nilai',
            'FAQ': 'FAQ',
            'About Us': 'Tentang kami',
            'Jobs': 'Pekerjaan',
            'Blog': 'Blog',
            'Parents': 'Orang tua',
            'Help': 'Bantuan',
            'Terms': 'Ketentuan',
            'Accessibility': 'Aksesibilitas',
            'Sitemap': 'Peta situs',
            'Continue': 'Lanjut',
            'Cancel': 'Batal',
            'Total': 'Total'
        }
    };
    Object.keys(EXTRA_STRINGS).forEach(function(loc) {
        if (!TRANSLATIONS[loc]) TRANSLATIONS[loc] = {};
        var src = EXTRA_STRINGS[loc];
        Object.keys(src).forEach(function(k) {
            if (!TRANSLATIONS[loc][k]) TRANSLATIONS[loc][k] = src[k];
        });
    });

    function applyTranslations() {
        var loc = getLocale();
        var dict = loc && TRANSLATIONS[loc];
        if (!dict) return;
        var keys = Object.keys(dict);
        if (!keys.length) return;
        // Sort keys longest-first so multi-word phrases match before their substrings.
        keys.sort(function(a, b) {
            return b.length - a.length;
        });
        // Pre-compile word-boundary regex for each key.
        var compiled = keys.map(function(k) {
            var esc = k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            return {
                re: new RegExp('(^|[^A-Za-z0-9])' + esc + '(?![A-Za-z0-9])', 'gi'),
                val: dict[k]
            };
        });
        var SKIP_TAGS = {
            SCRIPT: 1,
            STYLE: 1,
            NOSCRIPT: 1,
            TEXTAREA: 1,
            INPUT: 1,
            CODE: 1,
            PRE: 1
        };
        var SKIP_SEL = '#custom-preferences-card, #navbar-robux-amount, #navbar-robux, .navbar-icon-item, [class*="AvatarHeadshot"], [class*="avatar-headshot"], [class*="user-status"], [data-testid*="avatar"], [role="combobox"], #user-search-listbox, img';
        var walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, {
            acceptNode: function(node) {
                var p = node.parentNode;
                if (!p || SKIP_TAGS[p.tagName]) return NodeFilter.FILTER_REJECT;
                if (p.closest && p.closest(SKIP_SEL)) return NodeFilter.FILTER_REJECT;
                var t = (node.nodeValue || '');
                if (!t.trim()) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        var n;
        while ((n = walker.nextNode())) {
            // Capture the original English once so we can re-translate after a
            // locale switch without compounding.
            if (n._rbxOrigText == null) n._rbxOrigText = n.nodeValue;
            var src = n._rbxOrigText;
            var out = src;
            for (var i = 0; i < compiled.length; i++) {
                var c = compiled[i];
                out = out.replace(c.re, function(_m, pre) {
                    return (pre || '') + c.val;
                });
            }
            if (out !== n.nodeValue) n.nodeValue = out;
        }
    }

    // ── Currency ────────────────────────────────────────────────────
    var CURRENCY_KEY = 'rbx_currency_v1';
    // rate = how many units of this currency per 1 USD.
    // packages = real Roblox package prices for that currency (keyed by the
    // robux amount shown on the Buy Robux page). When absent we fall back to
    // USD × rate.
    var CURRENCIES = [{
            code: 'USD',
            symbol: '$',
            rate: 1,
            decimals: 2,
            label: 'US Dollar',
            packages: {
                '500': '4.99',
                '1000': '9.99',
                '2000': '19.99',
                '5250': '49.99',
                '11000': '99.99',
                '24000': '199.99'
            }
        },
        {
            code: 'EUR',
            symbol: '€',
            rate: 0.92,
            decimals: 2,
            label: 'Euro',
            packages: {
                '500': '4.99',
                '1000': '9.99',
                '2000': '19.99',
                '5250': '49.99',
                '11000': '99.99',
                '24000': '199.99'
            }
        },
        {
            code: 'GBP',
            symbol: '£',
            rate: 0.79,
            decimals: 2,
            label: 'British Pound',
            packages: {
                '500': '4.59',
                '1000': '8.99',
                '2000': '17.99',
                '5250': '44.99',
                '11000': '89.99',
                '24000': '179.99'
            }
        },
        {
            code: 'JPY',
            symbol: '¥',
            rate: 155,
            decimals: 0,
            label: 'Japanese Yen',
            packages: {
                '500': '610',
                '1000': '1220',
                '2000': '2440',
                '5250': '6100',
                '11000': '12200',
                '24000': '24400'
            }
        },
        {
            code: 'CNY',
            symbol: '¥',
            rate: 7.2,
            decimals: 2,
            label: 'Chinese Yuan'
        },
        {
            code: 'THB',
            symbol: '฿',
            rate: 36,
            decimals: 0,
            label: 'Thai Baht',
            packages: {
                '500': '175',
                '1000': '349',
                '2000': '699',
                '5250': '1750',
                '11000': '3500',
                '24000': '6900'
            }
        },
        {
            code: 'IDR',
            symbol: 'Rp',
            rate: 16000,
            decimals: 0,
            label: 'Indonesian Rupiah',
            packages: {
                '500': '75000',
                '1000': '149000',
                '2000': '299000',
                '5250': '749000',
                '11000': '1499000',
                '24000': '2999000'
            }
        },
        {
            code: 'MYR',
            symbol: 'RM',
            rate: 4.7,
            decimals: 2,
            label: 'Malaysian Ringgit',
            packages: {
                '500': '21.90',
                '1000': '42.90',
                '2000': '85.90',
                '5250': '214.90',
                '11000': '429.90',
                '24000': '859.90'
            }
        },
        {
            code: 'PHP',
            symbol: '₱',
            rate: 58,
            decimals: 0,
            label: 'Philippine Peso',
            packages: {
                '500': '279',
                '1000': '559',
                '2000': '1119',
                '5250': '2799',
                '11000': '5599',
                '24000': '11199'
            }
        },
        {
            code: 'VND',
            symbol: '₫',
            rate: 25000,
            decimals: 0,
            label: 'Vietnamese Dong',
            packages: {
                '500': '119000',
                '1000': '239000',
                '2000': '479000',
                '5250': '1199000',
                '11000': '2399000',
                '24000': '4799000'
            }
        },
        {
            code: 'INR',
            symbol: '₹',
            rate: 84,
            decimals: 0,
            label: 'Indian Rupee',
            packages: {
                '500': '419',
                '1000': '839',
                '2000': '1679',
                '5250': '4199',
                '11000': '8399',
                '24000': '16799'
            }
        },
        {
            code: 'KRW',
            symbol: '₩',
            rate: 1380,
            decimals: 0,
            label: 'Korean Won',
            packages: {
                '500': '6500',
                '1000': '13000',
                '2000': '26000',
                '5250': '65000',
                '11000': '130000',
                '24000': '260000'
            }
        },
        {
            code: 'AUD',
            symbol: 'A$',
            rate: 1.55,
            decimals: 2,
            label: 'Australian Dollar',
            packages: {
                '500': '7.99',
                '1000': '15.99',
                '2000': '30.99',
                '5250': '74.99',
                '11000': '149.99',
                '24000': '299.99'
            }
        },
        {
            code: 'CAD',
            symbol: 'C$',
            rate: 1.38,
            decimals: 2,
            label: 'Canadian Dollar',
            packages: {
                '500': '6.59',
                '1000': '12.99',
                '2000': '25.99',
                '5250': '64.99',
                '11000': '129.99',
                '24000': '259.99'
            }
        },
        {
            code: 'BRL',
            symbol: 'R$',
            rate: 5.6,
            decimals: 2,
            label: 'Brazilian Real',
            packages: {
                '500': '24.90',
                '1000': '49.90',
                '2000': '99.90',
                '5250': '249.90',
                '11000': '499.90',
                '24000': '999.90'
            }
        },
        {
            code: 'MXN',
            symbol: 'MX$',
            rate: 18,
            decimals: 2,
            label: 'Mexican Peso',
            packages: {
                '500': '89',
                '1000': '179',
                '2000': '359',
                '5250': '899',
                '11000': '1799',
                '24000': '3599'
            }
        },
        {
            code: 'TRY',
            symbol: '₺',
            rate: 33,
            decimals: 2,
            label: 'Turkish Lira'
        },
        {
            code: 'RUB',
            symbol: '₽',
            rate: 92,
            decimals: 0,
            label: 'Russian Ruble'
        },
        {
            code: 'SGD',
            symbol: 'S$',
            rate: 1.35,
            decimals: 2,
            label: 'Singapore Dollar',
            packages: {
                '500': '6.98',
                '1000': '13.98',
                '2000': '27.98',
                '5250': '69.98',
                '11000': '139.98',
                '24000': '279.98'
            }
        },
        {
            code: 'AED',
            symbol: 'د.إ',
            rate: 3.67,
            decimals: 2,
            label: 'UAE Dirham'
        }
    ];

    function findCurrency(code) {
        for (var i = 0; i < CURRENCIES.length; i++)
            if (CURRENCIES[i].code === code) return CURRENCIES[i];
        return CURRENCIES[0];
    }

    function getCurrency() {
        return findCurrency(localStorage.getItem(CURRENCY_KEY) || 'USD');
    }

    function setCurrency(code) {
        localStorage.setItem(CURRENCY_KEY, code);
        applyPricesAndCurrency();
    }

    function formatCurrency(usdAmount, robuxAmount) {
        var c = getCurrency();
        // Real Roblox per-package price for this currency if known.
        if (robuxAmount && c.packages && c.packages[robuxAmount] != null) {
            return c.symbol + c.packages[robuxAmount];
        }
        var n = usdAmount * c.rate;
        var s = n.toFixed(c.decimals);
        var parts = s.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        s = parts.join('.');
        return c.symbol + s;
    }
    // Match any reasonable currency-prefixed price token.
    var PRICE_RE = /(?:US\$|USD\s*|A\$|C\$|S\$|MX\$|RM|Rp|R\$|د\.إ|[$£€¥฿₱₫₹₩₽₺])\s*\d[\d.,]*/;

    // ── Custom robux package prices ─────────────────────────────────
    var PRICES_KEY = 'rbx_prices_v1';
    // Keyed by the robux amount shown on the page (digits only).
    var PRICE_PACKAGES = [{
            amount: '500',
            defaultPrice: '4.99'
        },
        {
            amount: '1000',
            defaultPrice: '9.99'
        },
        {
            amount: '2000',
            defaultPrice: '19.99'
        },
        {
            amount: '5250',
            defaultPrice: '49.99'
        },
        {
            amount: '11000',
            defaultPrice: '99.99'
        },
        {
            amount: '24000',
            defaultPrice: '199.99'
        }
    ];

    function getCustomPrices() {
        try {
            return JSON.parse(localStorage.getItem(PRICES_KEY) || '{}');
        } catch (e) {
            return {};
        }
    }

    function setCustomPrices(obj) {
        localStorage.setItem(PRICES_KEY, JSON.stringify(obj || {}));
        applyPricesAndCurrency();
    }
    // Find the robux amount associated with a price-bearing text node.
    // Walks up to a few ancestors looking for the largest digits-string that
    // could plausibly be a robux quantity (e.g. "24,000", "11,000", "500").
    function detectRobuxAmount(node) {
        var el = node.parentElement;
        for (var hops = 0; el && hops < 6; hops++, el = el.parentElement) {
            var amtEl = el.querySelector && el.querySelector('.font-builder-extended, .icon-filled-robux + *, [data-testid*="robux-amount"]');
            if (amtEl) {
                var d = (amtEl.textContent || '').replace(/[^\d]/g, '');
                if (d && d.length <= 6) return d;
            }
        }
        return null;
    }

    function applyPricesAndCurrency() {
        var prices = getCustomPrices();
        var SKIP_TAGS = {
            SCRIPT: 1,
            STYLE: 1,
            NOSCRIPT: 1,
            TEXTAREA: 1,
            INPUT: 1
        };
        var SKIP_SEL = '#custom-preferences-card, #navbar-robux-amount, #navbar-robux, .navbar-icon-item, [data-testid*="avatar"]';
        var root = document.body || document.documentElement;
        if (!root) return;
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: function(n) {
                var p = n.parentNode;
                if (!p || SKIP_TAGS[p.tagName]) return NodeFilter.FILTER_REJECT;
                if (p.closest && p.closest(SKIP_SEL)) return NodeFilter.FILTER_REJECT;
                return PRICE_RE.test(n.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
        });
        var nodes = [];
        var n;
        while ((n = walker.nextNode())) nodes.push(n);
        nodes.forEach(function(node) {
            // Cache the original English/USD value once so locale/currency
            // switches always start from a known baseline (no compounding).
            if (node._rbxOrigPriceText == null) node._rbxOrigPriceText = node.nodeValue;
            var src = node._rbxOrigPriceText;
            var amount = detectRobuxAmount(node);
            // Replace EVERY price token in the source text.
            var out = src.replace(new RegExp(PRICE_RE.source, 'g'), function(match) {
                var baseUSD = parseFloat(match.replace(/[^\d.]/g, ''));
                if (!isFinite(baseUSD)) return match;
                if (amount && prices[amount]) {
                    var c = parseFloat(prices[amount]);
                    if (isFinite(c)) baseUSD = c;
                }
                return formatCurrency(baseUSD, amount);
            });
            if (out !== node.nodeValue) node.nodeValue = out;
        });
    }

    // ── Footer language switcher (replaces stuck spinner) ───────────
    function ensureFooterLanguageSwitcher() {
        // If real switcher exists and is visible, hook it instead of cloning.
        var real = document.getElementById('language-switcher');
        if (real && real.offsetParent !== null && !real.closest('[hidden]')) {
            // hide any nearby spinner in the same column
            var col = real.closest('.col-sm-6, .col-md-3, footer, .footer-row');
            if (col) col.querySelectorAll('.foundation-web-progress-circle').forEach(function(s) {
                s.style.display = 'none';
            });
            // Reflect persisted locale on the real switcher and intercept changes
            // so picking a language actually translates the page (the original
            // change handler relies on a translation endpoint that is broken in
            // this clone, so it never updates anything).
            if (!real._rbxHooked) {
                real._rbxHooked = true;
                real.setAttribute('data-rbx-locale', '1');
                var saved = getLocale();
                if (saved) {
                    for (var i = 0; i < real.options.length; i++) {
                        if (real.options[i].value === saved) {
                            real.value = saved;
                            break;
                        }
                    }
                }
                real.addEventListener('change', function() {
                    setLocale(real.value);
                }, true);
                real.addEventListener('input', function() {
                    setLocale(real.value);
                }, true);
            }
            return;
        }
        // Find spinner inside a footer-ish container.
        var spinners = document.querySelectorAll('.foundation-web-progress-circle');
        spinners.forEach(function(sp) {
            if (sp._rbxReplaced) return;
            var inFooter = sp.closest('footer') || sp.closest('.footer-row') || sp.closest('.col-sm-6, .col-md-3');
            if (!inFooter) return;
            // Only swap when the surrounding column is small / clearly a language slot.
            var col = sp.closest('.col-sm-6, .col-md-3') || sp.parentElement;
            if (!col) return;
            sp._rbxReplaced = true;
            var wrap = document.createElement('div');
            wrap.className = 'rbx-footer-lang';
            wrap.style.cssText = 'display:flex;align-items:center;justify-content:flex-start;width:100%;';
            var sel = document.createElement('select');
            sel.setAttribute('data-rbx-locale', '1');
            sel.style.cssText = 'background:transparent;color:inherit;border:1px solid rgba(255,255,255,0.25);border-radius:9999px;padding:10px 18px;font-size:14px;min-width:240px;cursor:pointer;appearance:auto;';
            LOCALE_OPTIONS.forEach(function(o) {
                if (!o.v) return; // skip auto in footer
                var opt = document.createElement('option');
                opt.value = o.v;
                opt.textContent = o.label;
                opt.style.color = '#111';
                sel.appendChild(opt);
            });
            var cur = getLocale() || 'en_us';
            sel.value = cur;
            sel.addEventListener('change', function() {
                setLocale(sel.value);
            });
            wrap.appendChild(sel);
            // Replace spinner with our switcher.
            var host = sp.closest('.col-sm-6, .col-md-3') || sp.parentElement;
            if (host && host !== document.body) {
                host.innerHTML = '';
                host.appendChild(wrap);
            } else {
                sp.replaceWith(wrap);
            }
        });
    }
    setInterval(ensureFooterLanguageSwitcher, 1500);
    // Periodically re-apply identity so React re-renders that wipe our injected
    // avatar (broken thumbnail span) get reverted within ~1s.
    setInterval(function() {
        if (document.querySelector('.avatar-card-image, .thumbnail-2d-container.icon-broken')) {
            applyIdentityToPage();
        }
    }, 1000);

    // Debounce translation+price walk to avoid re-running on every observer
    // tick (which thrashes React and triggers thumbnail retry storms).
    var _localisedTimer = null;

    function scheduleLocalisedPatches() {
        if (_localisedTimer) return;
        _localisedTimer = setTimeout(function() {
            _localisedTimer = null;
            try {
                applyTranslations();
            } catch (e) {}
            try {
                applyPricesAndCurrency();
            } catch (e) {}
        }, 180);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────
    function escHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function getRobuxBalance() {
        var v = localStorage.getItem('rbx_balance_v1');
        return v == null ? '0' : String(v);
    }

    function setRobuxBalance(v) {
        var n = String(parseInt(v, 10) || 0);
        localStorage.setItem('rbx_balance_v1', n);
        refreshAllBalanceDisplays();
        try {
            fetch('/api/auth/robux', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ robux: n })
            }).catch(function() {});
        } catch (e) {}
    }

    // Pull the authoritative balance from the server on page load so the
    // localStorage cache reflects MongoDB (per-user, cross-device).
    function syncRobuxBalanceFromServer() {
        try {
            fetch('/api/auth/robux', {
                    credentials: 'same-origin'
                })
                .then(function(r) {
                    return r.ok ? r.json() : null;
                })
                .then(function(d) {
                    if (!d || !d.success) return;
                    var n = String(parseInt(d.robux, 10) || 0);
                    localStorage.setItem('rbx_balance_v1', n);
                    var disp = document.getElementById('cp-balance-display');
                    if (disp) disp.textContent = n;
                    injectRobuxBalance(document);
                    updateLegacyNavRobux();
                })
                .catch(function() {});
        } catch (e) {}
    }
    // Kick off an initial sync once the DOM is ready.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', syncRobuxBalanceFromServer, {
            once: true
        });
    } else {
        syncRobuxBalanceFromServer();
    }

    // ── Single-session enforcement ─────────────────────────────────────────
    // The server stamps each login with a fresh activeSessionToken and kicks
    // any older session on the next /api/auth/status poll. We poll on the
    // customer pages so logging into the same account on Device B causes
    // Device A to redirect to /login within ~10 seconds.
    var _expiryTimer = null;

    function forceLogout(reason) {
        try {
            localStorage.removeItem('rbx_balance_v1');
        } catch (e) {}
        try {
            // Best-effort: tell the server to destroy the session immediately.
            navigator.sendBeacon && navigator.sendBeacon('/api/auth/logout');
        } catch (e) {}
        try {
            location.replace('/login');
        } catch (e) {}
    }

    function scheduleExpiryKick(expiresAtIso) {
        if (_expiryTimer) {
            clearTimeout(_expiryTimer);
            _expiryTimer = null;
        }
        if (!expiresAtIso) return;
        var ms = new Date(expiresAtIso).getTime() - Date.now();
        if (!isFinite(ms)) return;
        if (ms <= 0) {
            forceLogout('expired');
            return;
        }
        // setTimeout caps near 2^31 ms; ignore expiries further than 24 days out.
        if (ms > 2147483000) return;
        _expiryTimer = setTimeout(function() {
            forceLogout('expired');
        }, ms + 500);
    }

    function pollAuthStatus() {
        try {
            fetch('/api/auth/status', {
                    credentials: 'same-origin'
                })
                .then(function(r) {
                    return r.ok ? r.json() : null;
                })
                .then(function(d) {
                    if (!d) return;
                    if (d.authenticated === false) {
                        forceLogout(d.reason || 'unauth');
                        return;
                    }
                    if (d.user && d.user.role !== 'admin' && d.user.expiresAt) {
                        scheduleExpiryKick(d.user.expiresAt);
                    }
                })
                .catch(function() {});
        } catch (e) {}
    }
    // Don't poll on /login or admin pages — those have their own handling.
    var _p = (location.pathname || '').toLowerCase();
    if (_p !== '/login' && _p !== '/signout' && _p.indexOf('/pages/') !== 0) {
        setInterval(pollAuthStatus, 10000);
        // Run once shortly after load as a fast kick on tab focus.
        setTimeout(pollAuthStatus, 2000);
        window.addEventListener('focus', pollAuthStatus);

        // Ping every 8s to keep lastSeen fresh for admin online status
        function sendPing() {
            fetch('/api/auth/ping', { method: 'POST', credentials: 'same-origin' }).catch(function() {});
        }
        setInterval(sendPing, 8000);
        setTimeout(sendPing, 1000);
        window.addEventListener('focus', sendPing);
    }

    // Keep the legacy top navbar #nav-robux-amount in sync with the stored balance.
    function updateLegacyNavRobux() {
        var el = document.getElementById('nav-robux-amount');
        if (!el) return;
        var bal = Number(getRobuxBalance()) || 0;
        var txt = fmtBal(bal);
        if (el.textContent !== txt) el.textContent = txt;
    }

    function refreshAllBalanceDisplays() {
        var n = Number(getRobuxBalance()) || 0;
        var fmt = fmtBal(n);
        // 1) account card hero
        var disp = document.getElementById('cp-balance-display');
        if (disp) disp.textContent = fmt;
        // 2) robux dropdown if open
        var ddAmt = document.querySelector('.rbx-robux-dd-bal-amt');
        if (ddAmt) ddAmt.textContent = fmt;
        // 3) legacy nav
        updateLegacyNavRobux();
        // 4) React balance pill on robux page (font-builder-extended spans near robux icon)
        document.querySelectorAll(
            '.font-builder-extended, [class*="robux-balance"], #navbar-robux-amount, #nav-robux-amount'
        ).forEach(function(el) {
            if (/^[\d,\.]+[KMB]?$/.test((el.textContent || '').trim())) {
                el.textContent = fmt;
            }
        });
        // 5) injectRobuxBalance handles the Send-sheet balance row
        injectRobuxBalance(document);
    }

    function isSettingsPage() {
        return window.location.pathname === '/my/account';
    }

    function fixUrl(url) {
        if (!url) return url;
        return url.replace(/^http:\/\/localhost(?!:\d)/i, TARGET_ORIGIN);
    }

    function fixAnchor(anchor) {
        if (!anchor || anchor.tagName !== 'A') return;
        var href = anchor.getAttribute('href');
        if (!href) return;
        var fixed = fixUrl(href);
        if (fixed !== href) {
            anchor.setAttribute('href', fixed);
        }
    }

    function fixAllAnchors(root) {
        if (!root || !root.querySelectorAll) return;
        root.querySelectorAll('a[href]').forEach(fixAnchor);
    }

    function getTheme() {
        return localStorage.getItem('rbx_theme') || 'dark';
    }

    function applyTheme() {
        var theme = getTheme();
        var de = document.documentElement;
        de.classList.remove('light-theme', 'dark-theme');
        de.classList.add(theme + '-theme');
        de.style.colorScheme = theme;
        if (document.body) {
            document.body.classList.remove('light-theme', 'dark-theme');
            document.body.classList.add(theme + '-theme');
        }
        updateThemeButtons(theme);
    }

    function setTheme(theme) {
        localStorage.setItem('rbx_theme', theme);
        applyTheme();
    }

    function updateThemeButtons(theme) {
        var darkBtn = document.getElementById('pref-dark-btn');
        var lightBtn = document.getElementById('pref-light-btn');
        if (!darkBtn || !lightBtn) return;
        darkBtn.classList.toggle('active', theme === 'dark');
        lightBtn.classList.toggle('active', theme === 'light');
    }

    function ensureStyles() {
        if (document.getElementById(STYLE_ID)) return;
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = [
            '#custom-preferences-card {',
            '  max-width: 920px;',
            '  margin: 0 0 20px;',
            '  border-radius: 18px;',
            '  padding: 0;',
            '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
            '  overflow: hidden;',
            '  box-shadow: 0 8px 28px rgba(0,0,0,0.25);',
            '}',
            'body.dark-theme #custom-preferences-card { background:#181c2a; color:#eef1f8; }',
            'body.light-theme #custom-preferences-card { background:#ffffff; color:#1a1f2c; }',
            '#custom-preferences-card .cp-hero {',
            '  position: relative;',
            '  padding: 22px 24px 18px;',
            '  background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);',
            '  color: #ffffff;',
            '}',
            '#custom-preferences-card .cp-hero-row { display:flex; gap:16px; align-items:center; }',
            '#custom-preferences-card .cp-avatar {',
            '  width: 72px; height: 72px; border-radius:9999px; overflow:hidden;',
            '  background:#2f3b52; border:3px solid rgba(255,255,255,0.25); flex:0 0 auto;',
            '  display:flex; align-items:center; justify-content:center;',
            '}',
            '#custom-preferences-card .cp-avatar img { width:100%; height:100%; object-fit:cover; }',
            '#custom-preferences-card .cp-name { font-size:20px; font-weight:700; line-height:1.1; }',
            '#custom-preferences-card .cp-handle { font-size:13px; opacity:0.85; margin-top:2px; }',
            '#custom-preferences-card .cp-id { font-size:11px; opacity:0.7; margin-top:6px; }',
            '#custom-preferences-card .cp-robux {',
            '  margin-left:auto; display:inline-flex; align-items:center; gap:6px;',
            '  padding:8px 14px; background:rgba(0,0,0,0.25); border-radius:9999px; font-weight:700;',
            '}',
            '#custom-preferences-card .cp-robux::before {',
            '  content:""; width:16px; height:16px;',
            '  background: currentColor;',
            '  -webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27><path d=%27M5 3l2 5-2 5 2 5 5-2 5 2 2-5-2-5 2-5-5 2z%27 fill=%27black%27/></svg>") center/contain no-repeat;',
            '          mask: url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27><path d=%27M5 3l2 5-2 5 2 5 5-2 5 2 2-5-2-5 2-5-5 2z%27 fill=%27black%27/></svg>") center/contain no-repeat;',
            '}',
            '#custom-preferences-card .cp-body { padding:20px 24px; display:flex; flex-direction:column; gap:18px; }',
            '#custom-preferences-card .cp-section-title { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.6px; opacity:0.7; margin-bottom:8px; }',
            '#custom-preferences-card .cp-input-row { display:flex; gap:8px; }',
            '#custom-preferences-card .cp-input {',
            '  flex:1 1 auto; min-width:0; padding:10px 14px; border-radius:10px;',
            '  border:1px solid rgba(120,130,150,0.35); background:transparent; color:inherit;',
            '  font-size:14px; outline:none;',
            '}',
            '#custom-preferences-card .cp-input:focus { border-color:#2563eb; }',
            '#custom-preferences-card .cp-btn {',
            '  padding:10px 16px; border-radius:10px; border:none; cursor:pointer;',
            '  font-size:13px; font-weight:600; background:#2563eb; color:#fff;',
            '}',
            '#custom-preferences-card .cp-btn:hover { filter:brightness(1.1); }',
            '#custom-preferences-card .cp-btn-ghost { background:transparent; color:inherit; border:1px solid rgba(120,130,150,0.35); }',
            '#custom-preferences-card .cp-btn-ghost.active { background:#2563eb; border-color:#2563eb; color:#fff; }',
            '#custom-preferences-card .cp-status { font-size:12px; opacity:0.75; margin-top:6px; min-height:16px; }',
            '#custom-preferences-card .cp-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:10px; }',
            '#custom-preferences-card .cp-friend {',
            '  display:flex; gap:10px; align-items:center; padding:10px;',
            '  border-radius:12px; border:1px solid rgba(120,130,150,0.2);',
            '}',
            '#custom-preferences-card .cp-friend img { width:40px; height:40px; border-radius:9999px; object-fit:cover; background:#2f3b52; }',
            '#custom-preferences-card .cp-friend-name { font-size:13px; font-weight:600; line-height:1.2; }',
            '#custom-preferences-card .cp-friend-handle { font-size:11px; opacity:0.7; }',
            '#custom-preferences-card .cp-row { display:flex; flex-wrap:wrap; gap:10px; align-items:center; }',
            '#custom-preferences-card .cp-balance-input { width:140px; }',
            '#custom-preferences-card .cp-prices-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); gap:10px; }',
            '#custom-preferences-card .cp-price-row { display:flex; flex-direction:column; gap:4px; font-size:12px; opacity:0.85; }',
            '#custom-preferences-card .cp-price-label { font-weight:600; }',
            '#custom-preferences-card .cp-price-input-wrap { display:inline-flex; align-items:center; gap:4px; }',
            '#custom-preferences-card .cp-price-input { width:100%; }',
            '#custom-preferences-card .cp-link {',
            '  display:inline-flex; align-items:center; gap:6px; text-decoration:none; color:inherit;',
            '  padding:8px 12px; border-radius:10px; border:1px solid rgba(120,130,150,0.3); font-size:13px; font-weight:600;',
            '}',
            '#custom-preferences-card .cp-link:hover { border-color:#2563eb; color:#2563eb; }',
            '#react-user-account-base .sg-system-feedback,',
            '#react-user-account-base .alert-system-feedback,',
            '#react-user-account-base .alert.alert-warning { display:none !important; }'
        ].join('\n');
        document.head.appendChild(style);
    }

    // Build avatar URL for a user via local thumbnail proxy (set asynchronously)
    function fetchAvatarUrl(userId) {
        return fetch('/proxy/thumbnails/v1/users/avatar-headshot?userIds=' + encodeURIComponent(userId) + '&size=150x150&format=Png')
            .then(function(r) {
                return r.json();
            })
            .then(function(d) {
                var t = (d.data || [])[0];
                return t ? t.imageUrl : '';
            })
            .catch(function() {
                return '';
            });
    }

    function applyIdentityToPage() {
        var id = window._rbxIdentity || getIdentity();
        // 1) Update profile name slots in page (Roblox displays for the current user)
        document.querySelectorAll('.age-bracket-label-username, .font-caption-header').forEach(function(el) {
            if (el.dataset.rbxIdent !== '1') el.dataset.rbxIdent = '1';
            el.textContent = id.username;
        });
        // 2) Lazy-fetch avatar URL once if missing, then persist + re-apply
        if (!id.avatarUrl && !window._rbxAvatarFetching && id.userId) {
            window._rbxAvatarFetching = true;
            fetchAvatarUrl(id.userId).then(function(img) {
                window._rbxAvatarFetching = false;
                if (!img) return;
                id.avatarUrl = img;
                try {
                    localStorage.setItem(IDENTITY_KEY, JSON.stringify(id));
                } catch (e) {}
                window._rbxIdentity = id;
                applyIdentityToPage();
            });
        }
        // 3) Broken avatar slots -> render real avatar img (fallback to inline SVG)
        var avatarSrc = id.avatarUrl || ('data:image/svg+xml;utf8,' + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
            '<rect width="100" height="100" fill="#393b3d"/>' +
            '<circle cx="50" cy="38" r="18" fill="#9ea1a3"/>' +
            '<rect x="20" y="62" width="60" height="40" rx="20" fill="#9ea1a3"/>' +
            '</svg>'
        ));
        document.querySelectorAll('.avatar-card-image, .thumbnail-2d-container.icon-broken').forEach(function(el) {
            if (el.querySelector('img[data-rbx-ident]')) return;
            el.classList.remove('icon-broken');
            el.innerHTML = '<img data-rbx-ident="1" src="' + avatarSrc + '" alt="' + escHtml(id.username) + '" style="width:100%;height:100%;object-fit:cover;">';
        });
        // 3) Sync card UI if visible
        var nameEl = document.getElementById('cp-name');
        var handleEl = document.getElementById('cp-handle');
        var idEl = document.getElementById('cp-id');
        var avatarEl = document.getElementById('cp-avatar-img');
        if (nameEl) nameEl.textContent = id.displayName || id.username;
        if (handleEl) handleEl.textContent = '@' + id.username;
        if (idEl) idEl.textContent = 'User ID: ' + id.userId;
        if (avatarEl && id.avatarUrl) avatarEl.src = id.avatarUrl;
    }

    function makePreferenceCard() {
        var id = window._rbxIdentity || getIdentity();
        var card = document.createElement('section');
        card.id = CARD_ID;
        card.innerHTML =
            '<div class="cp-hero">' +
            '  <div class="cp-hero-row">' +
            '    <div class="cp-avatar"><img id="cp-avatar-img" src="' + (id.avatarUrl || '') + '" alt=""></div>' +
            '    <div style="flex:1;min-width:0;">' +
            '      <div id="cp-name" class="cp-name">' + escHtml(id.displayName || id.username) + '</div>' +
            '      <div id="cp-handle" class="cp-handle">@' + escHtml(id.username) + '</div>' +
            '      <div id="cp-id" class="cp-id">User ID: ' + escHtml(id.userId) + '</div>' +
            '    </div>' +
            '    <div class="cp-robux"><span id="cp-balance-display">' + escHtml(getRobuxBalance()) + '</span></div>' +
            '  </div>' +
            '</div>' +
            '<div class="cp-body">' +
            '  <div>' +
            '    <div class="cp-section-title">Set Your Roblox Profile</div>' +
            '    <div class="cp-input-row">' +
            '      <input id="cp-username-input" class="cp-input" type="text" placeholder="Type a Roblox username, e.g. mrbeast555">' +
            '      <button id="cp-username-btn" class="cp-btn" type="button">Fetch</button>' +
            '    </div>' +
            '    <div id="cp-username-status" class="cp-status"></div>' +
            '  </div>' +
            '  <div>' +
            '    <div class="cp-section-title">Robux Balance</div>' +
            '    <div class="cp-input-row">' +
            '      <input id="cp-balance-input" class="cp-input cp-balance-input" type="number" min="0" placeholder="0" value="' + escHtml(getRobuxBalance()) + '">' +
            '      <button id="cp-balance-btn" class="cp-btn" type="button">Save</button>' +
            '    </div>' +
            '  </div>' +
            '  <div>' +
            '    <div class="cp-section-title">Theme</div>' +
            '    <div class="cp-row">' +
            '      <button type="button" id="pref-dark-btn" class="cp-btn cp-btn-ghost">Dark</button>' +
            '      <button type="button" id="pref-light-btn" class="cp-btn cp-btn-ghost">Light</button>' +
            '    </div>' +
            '  </div>' +
            '  <div>' +
            '    <div class="cp-section-title">Language</div>' +
            '    <div class="cp-input-row">' +
            '      <select id="cp-locale-select" class="cp-input">' +
            LOCALE_OPTIONS.map(function(o) {
                return '<option value="' + escHtml(o.v) + '"' + (getLocale() === o.v ? ' selected' : '') + '>' + escHtml(o.label) + '</option>';
            }).join('') +
            '      </select>' +
            '      <button id="cp-locale-btn" class="cp-btn" type="button">Apply</button>' +
            '    </div>' +
            '    <div id="cp-locale-status" class="cp-status"></div>' +
            '  </div>' +
            '  <div>' +
            '    <div class="cp-section-title">Currency</div>' +
            '    <div class="cp-input-row">' +
            '      <select id="cp-currency-select" class="cp-input">' +
            CURRENCIES.map(function(c) {
                return '<option value="' + escHtml(c.code) + '"' + (getCurrency().code === c.code ? ' selected' : '') + '>' +
                    escHtml(c.code + ' (' + c.symbol + ') – ' + c.label + ' · 1 USD = ' + c.rate + ' ' + c.code) + '</option>';
            }).join('') +
            '      </select>' +
            '      <button id="cp-currency-btn" class="cp-btn" type="button">Apply</button>' +
            '    </div>' +
            '    <div id="cp-currency-status" class="cp-status">Robux prices are converted from USD using the rate above.</div>' +
            '  </div>' +
            '  <div>' +
            '    <div class="cp-section-title">Custom Robux Prices (base USD)</div>' +
            '    <div class="cp-prices-grid">' +
            PRICE_PACKAGES.map(function(p) {
                var cur = (getCustomPrices()[p.amount] || p.defaultPrice);
                return '<label class="cp-price-row">' +
                    '<span class="cp-price-label">' + Number(p.amount).toLocaleString() + ' R$</span>' +
                    '<span class="cp-price-input-wrap">$<input data-amount="' + p.amount + '" class="cp-input cp-price-input" type="text" inputmode="decimal" value="' + escHtml(cur) + '" placeholder="' + p.defaultPrice + '"></span>' +
                    '</label>';
            }).join('') +
            '    </div>' +
            '    <div class="cp-row" style="margin-top:10px;">' +
            '      <button id="cp-prices-btn" class="cp-btn" type="button">Save Prices</button>' +
            '      <button id="cp-prices-reset" class="cp-btn cp-btn-ghost" type="button">Reset</button>' +
            '    </div>' +
            '    <div id="cp-prices-status" class="cp-status"></div>' +
            '  </div>' +
            '</div>';
        return card;
    }

    function attachCardHandlers() {
        var darkBtn = document.getElementById('pref-dark-btn');
        var lightBtn = document.getElementById('pref-light-btn');
        if (darkBtn) darkBtn.onclick = function() {
            setTheme('dark');
        };
        if (lightBtn) lightBtn.onclick = function() {
            setTheme('light');
        };
        updateThemeButtons(getTheme());

        var balBtn = document.getElementById('cp-balance-btn');
        var balInp = document.getElementById('cp-balance-input');
        if (balBtn && balInp) {
            balBtn.onclick = function() {
                setRobuxBalance(balInp.value);
            };
            balInp.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    setRobuxBalance(balInp.value);
                }
            });
        }

        var userBtn = document.getElementById('cp-username-btn');
        var userInp = document.getElementById('cp-username-input');
        var status = document.getElementById('cp-username-status');

        function setStatus(msg) {
            if (status) status.textContent = msg || '';
        }

        function fetchProfile() {
            var name = (userInp.value || '').trim();
            if (!name) {
                setStatus('Type a username first.');
                return;
            }
            setStatus('Looking up @' + name + '\u2026');
            fetch('/proxy/users/v1/usernames/users', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        usernames: [name],
                        excludeBannedUsers: false
                    })
                })
                .then(function(r) {
                    return r.json();
                })
                .then(function(d) {
                    var u = (d.data || [])[0];
                    if (!u) throw new Error('User not found');
                    var ident = {
                        username: u.name,
                        userId: String(u.id),
                        displayName: u.displayName || u.name,
                        avatarUrl: ''
                    };
                    return fetchAvatarUrl(u.id).then(function(img) {
                        ident.avatarUrl = img;
                        setIdentity(ident);
                        setStatus('Loaded ' + ident.displayName + ' (@' + ident.username + ').');
                    });
                })
                .catch(function(err) {
                    setStatus('Could not load: ' + (err.message || err));
                });
        }
        if (userBtn && userInp) {
            userBtn.onclick = fetchProfile;
            userInp.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    fetchProfile();
                }
            });
        }

        // Language switcher
        var localeSel = document.getElementById('cp-locale-select');
        var localeBtn = document.getElementById('cp-locale-btn');
        var localeStatus = document.getElementById('cp-locale-status');
        if (localeBtn && localeSel) {
            localeBtn.onclick = function() {
                setLocale(localeSel.value);
                if (localeStatus) {
                    localeStatus.textContent = localeSel.value ?
                        'Language set to ' + localeSel.options[localeSel.selectedIndex].text + '.' :
                        'Language reset to auto.';
                }
            };
        }

        // Currency
        var currencySel = document.getElementById('cp-currency-select');
        var currencyBtn = document.getElementById('cp-currency-btn');
        var currencyStatus = document.getElementById('cp-currency-status');
        if (currencyBtn && currencySel) {
            currencyBtn.onclick = function() {
                var code = currencySel.value;
                setCurrency(code);
                var c = findCurrency(code);
                if (currencyStatus) {
                    currencyStatus.textContent = 'Currency set to ' + c.code + ' (' + c.symbol + '). 1 USD = ' + c.rate + ' ' + c.code + '.';
                }
            };
        }

        // Custom prices
        var pricesBtn = document.getElementById('cp-prices-btn');
        var pricesReset = document.getElementById('cp-prices-reset');
        var pricesStatus = document.getElementById('cp-prices-status');
        if (pricesBtn) {
            pricesBtn.onclick = function() {
                var obj = {};
                document.querySelectorAll('.cp-price-input').forEach(function(inp) {
                    var amt = inp.getAttribute('data-amount');
                    var val = (inp.value || '').trim().replace(/[^\d.]/g, '');
                    if (amt && val) obj[amt] = val;
                });
                setCustomPrices(obj);
                if (pricesStatus) pricesStatus.textContent = 'Custom prices saved. Refresh the Buy Robux page to see them.';
            };
        }
        if (pricesReset) {
            pricesReset.onclick = function() {
                setCustomPrices({});
                document.querySelectorAll('.cp-price-input').forEach(function(inp) {
                    var amt = inp.getAttribute('data-amount');
                    var def = PRICE_PACKAGES.find ? PRICE_PACKAGES.find(function(p) {
                        return p.amount === amt;
                    }) : null;
                    if (!def) {
                        for (var i = 0; i < PRICE_PACKAGES.length; i++) {
                            if (PRICE_PACKAGES[i].amount === amt) {
                                def = PRICE_PACKAGES[i];
                                break;
                            }
                        }
                    }
                    if (def) inp.value = def.defaultPrice;
                });
                if (pricesStatus) pricesStatus.textContent = 'Prices reset to defaults.';
            };
        }

        // Logout button — fully sign out (kills server session, clears local cache).
        var logoutBtn = document.getElementById('cp-logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = function() {
                logoutBtn.disabled = true;
                logoutBtn.textContent = 'Logging out\u2026';
                try {
                    localStorage.removeItem('rbx_balance_v1');
                } catch (e) {}
                fetch('/api/auth/logout', {
                        method: 'POST',
                        credentials: 'same-origin'
                    })
                    .catch(function() {})
                    .then(function() {
                        location.replace('/login');
                    });
            };
        }

        // Decorate handlers
        var decFile = document.getElementById('cp-decor-file');
        var decUploadBtn = document.getElementById('cp-decor-upload-btn');
        var decEditBtn = document.getElementById('cp-decor-edit-btn');
        var decClearBtn = document.getElementById('cp-decor-clear-btn');
        var decStatus = document.getElementById('cp-decor-status');

        function setDecStatus(m) {
            if (decStatus) decStatus.textContent = m || '';
        }
        if (decUploadBtn && decFile) {
            decUploadBtn.onclick = function() {
                decFile.click();
            };
            decFile.onchange = function() {
                var f = decFile.files && decFile.files[0];
                if (!f) return;
                if (f.size > 25 * 1024 * 1024) {
                    setDecStatus('File too large (max 25 MB).');
                    return;
                }
                setDecStatus('Uploading\u2026');
                var reader = new FileReader();
                reader.onload = function() {
                    fetch('/api/decorations/upload', {
                            method: 'POST',
                            credentials: 'same-origin',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                dataUrl: reader.result
                            })
                        })
                        .then(function(r) {
                            return r.json();
                        })
                        .then(function(d) {
                            if (!d || !d.success) throw new Error((d && d.message) || 'Upload failed');
                            window.__rbxDecor.add({
                                url: d.url,
                                public_id: d.public_id,
                                w: 160,
                                h: 160
                            });
                            setDecStatus('Uploaded. Drag in Edit mode to position.');
                        })
                        .catch(function(e) {
                            setDecStatus('Upload error: ' + e.message);
                        });
                };
                reader.readAsDataURL(f);
                decFile.value = '';
            };
        }
        if (decEditBtn) {
            decEditBtn.onclick = function() {
                var on = window.__rbxDecor.toggleEdit();
                decEditBtn.textContent = on ? 'Done Editing' : 'Edit Decorate';
                decEditBtn.classList.toggle('active', on);
                setDecStatus(on ? 'Drag to move, corner to resize, X to delete.' : 'Saved.');
            };
        }
        if (decClearBtn) {
            decClearBtn.onclick = function() {
                if (!confirm('Remove ALL decorations?')) return;
                window.__rbxDecor.clearAll();
                setDecStatus('All decorations cleared.');
            };
        }
    }

    function loadFriends(userId) {
        var host = document.getElementById('cp-friends');
        if (!host) return;
        host.innerHTML = '<span class="cp-status">Loading friends\u2026</span>';
        fetch('/proxy/friends/v1/users/' + encodeURIComponent(userId) + '/friends')
            .then(function(r) {
                return r.json();
            })
            .then(function(d) {
                var list = (d.data || []).slice(0, 24);
                if (!list.length) {
                    host.innerHTML = '<span class="cp-status">No friends found.</span>';
                    return;
                }
                var ids = list.map(function(f) {
                    return f.id;
                }).join(',');
                return fetch('/proxy/thumbnails/v1/users/avatar-headshot?userIds=' + ids + '&size=150x150&format=Png')
                    .then(function(r) {
                        return r.json();
                    })
                    .then(function(t) {
                        var map = {};
                        (t.data || []).forEach(function(it) {
                            map[it.targetId] = it.imageUrl;
                        });
                        host.innerHTML = list.map(function(f) {
                            return '<div class="cp-friend">' +
                                '<img src="' + (map[f.id] || '') + '" alt="">' +
                                '<div style="min-width:0;">' +
                                '  <div class="cp-friend-name">' + escHtml(f.displayName || f.name) + '</div>' +
                                '  <div class="cp-friend-handle">@' + escHtml(f.name) + '</div>' +
                                '</div></div>';
                        }).join('');
                    });
            })
            .catch(function() {
                host.innerHTML = '<span class="cp-status">Could not load friends.</span>';
            });
    }

    function ensurePreferencesCard() {
        if (!isSettingsPage()) return;
        if (document.getElementById(CARD_ID)) {
            updateThemeButtons(getTheme());
            return;
        }
        var host =
            document.querySelector('#react-user-account-base') ||
            document.querySelector('#user-account') ||
            document.querySelector('#content');
        if (!host) return;
        ensureStyles();
        host.insertBefore(makePreferenceCard(), host.firstChild);
        fixAllAnchors(host);
        attachCardHandlers();
    }

    function removeUnknownErrorNodes(root) {
        if (!root || root.nodeType !== 1) return;
        var selector =
            '.sg-system-feedback, .alert-system-feedback, .alert.alert-warning, .alert-content, [role="alert"]';
        var candidates = [];

        if (root.matches && root.matches(selector)) {
            candidates.push(root);
        }

        if (root.querySelectorAll) {
            root.querySelectorAll(selector).forEach(function(node) {
                candidates.push(node);
            });
        }

        candidates.forEach(function(node) {
            var text = (node.textContent || '').trim();
            if (text.indexOf(UNKNOWN_ERROR_TEXT) === -1) return;
            var removable =
                node.closest('.sg-system-feedback') ||
                node.closest('.alert-system-feedback') ||
                node.closest('.alert.alert-warning') ||
                node;
            if (removable && removable.parentNode) {
                removable.parentNode.removeChild(removable);
            }
        });
    }

    function injectRobuxBalance(root) {
        if (window._rbxInjectingBalance) return; // prevent re-entry from MutationObserver
        var scope = root || document;
        if (!scope.querySelectorAll) return;
        window._rbxInjectingBalance = true;
        try {
            var bal = getRobuxBalance();
            var balDisp = fmtBal(Number(bal) || 0);
            // Find the Send button icon, walk up to its container row,
            // then find the sibling empty balance div and populate it.
            var sendIcons = scope.querySelectorAll('span[class*="icon-regular-arrow-up-from-line"]');
            sendIcons.forEach(function(icon) {
                var btnContainer = null;
                var node = icon;
                while (node && node !== document.body) {
                    if (node.className && typeof node.className === 'string' && node.className.indexOf('gap-small') !== -1) {
                        btnContainer = node;
                        break;
                    }
                    node = node.parentElement;
                }
                if (!btnContainer) return;
                var row = btnContainer.parentElement;
                if (!row) return;
                var balanceDiv = null;
                for (var i = 0; i < row.children.length; i++) {
                    var child = row.children[i];
                    if (child !== btnContainer && typeof child.className === 'string' && child.className.indexOf('gap-xsmall') !== -1) {
                        balanceDiv = child;
                        break;
                    }
                }
                if (!balanceDiv) return;
                // Dedupe: collect ANY robux icon (any class with both 'icon' and 'robux')
                // and any leaf span/div whose text is a number — keep only the first of each.
                var allIcons = [];
                var allNums = [];
                balanceDiv.querySelectorAll('*').forEach(function(el) {
                    var cn = (typeof el.className === 'string') ? el.className : '';
                    if (/icon[-_]/.test(cn) && /robux/i.test(cn)) allIcons.push(el);
                    if (el.children.length === 0 && /^\s*[\d,]+(?:\.\d+)?[kMB]?\s*$/.test(el.textContent || '')) allNums.push(el);
                });
                if (allIcons.length || allNums.length) {
                    // Only mutate if there's an actual duplicate or wrong number — prevents
                    // an infinite mutation loop with the MutationObserver.
                    var needsWork = allIcons.length > 1 || allNums.length > 1 ||
                        (allNums[0] && allNums[0].textContent !== balDisp);
                    if (!needsWork) return;
                    for (var k = 1; k < allIcons.length; k++) allIcons[k].remove();
                    for (var m = 1; m < allNums.length; m++) allNums[m].remove();
                    if (allNums[0] && allNums[0].textContent !== balDisp) allNums[0].textContent = balDisp;
                    return;
                }
                balanceDiv.innerHTML =
                    '<span role="presentation" class="grow-0 shrink-0 basis-auto icon icon-filled-robux size-[var(--icon-size-large)]"></span>' +
                    '<span class="font-builder-extended content-action-standard text-title-large [font-size:var(--font-size-500)] medium:[font-size:var(--font-size-600)]">' + escHtml(balDisp) + '</span>';
            });

            // Sheet header: inject robux balance before the close (X) button container.
            // Dedupe across ALL siblings of close (X) — keep at most one icon + number.
            var closeContainers = scope.querySelectorAll('.fui-sheet-close-affordance-container');
            closeContainers.forEach(function(closeEl) {
                var parent = closeEl.parentElement;
                if (!parent || typeof parent.className !== 'string' || parent.className.indexOf('gap-xxsmall') === -1) return;

                // Collect all robux icons and number-leaves inside parent (excluding the close button)
                var allIcons = [];
                var allNums = [];
                Array.prototype.forEach.call(parent.querySelectorAll('*'), function(el) {
                    if (closeEl.contains(el)) return;
                    var cn = (typeof el.className === 'string') ? el.className : '';
                    if (/icon[-_]/.test(cn) && /robux/i.test(cn)) allIcons.push(el);
                    if (el.children.length === 0 && /^\s*[\d,]+(?:\.\d+)?[kMB]?\s*$/.test(el.textContent || '')) allNums.push(el);
                });

                if (allIcons.length || allNums.length) {
                    var needsWork = allIcons.length > 1 || allNums.length > 1 ||
                        (allNums[0] && allNums[0].textContent !== balDisp);
                    if (!needsWork) return;
                    for (var k = 1; k < allIcons.length; k++) allIcons[k].remove();
                    for (var m = 1; m < allNums.length; m++) allNums[m].remove();
                    if (allNums[0] && allNums[0].textContent !== balDisp) allNums[0].textContent = balDisp;
                    return;
                }

                // Nothing existed — inject our own pill before close
                var balanceEl = document.createElement('div');
                balanceEl.className = 'flex flex-row items-center gap-xsmall';
                balanceEl.innerHTML =
                    '<span role="presentation" class="grow-0 shrink-0 basis-auto icon icon-regular-robux size-[var(--icon-size-small)]"></span>' +
                    '<span class="text-label-medium content-emphasis">' + escHtml(balDisp) + '</span>';
                parent.insertBefore(balanceEl, closeEl);
            });
        } finally {
            window._rbxInjectingBalance = false;
        }
    }

    // ── User search handler ───────────────────────────────────────────────────
    var _searchTimer = null;

    // Walk up from input to find either #user-search-listbox
    // OR the "No results found" wrapper that React injected
    function findResultsHost() {
        var lb = document.getElementById('user-search-listbox');
        if (lb) return lb;
        var inp = document.querySelector('input[name="user-search"]');
        if (!inp) return null;
        var node = inp.parentElement;
        while (node && node !== document.body) {
            for (var i = 0; i < node.children.length; i++) {
                var child = node.children[i];
                if (child !== inp && (child.textContent || '').indexOf('No results') !== -1) {
                    return child;
                }
            }
            node = node.parentElement;
        }
        return null;
    }

    function clearSearchUI() {
        var lb = document.getElementById('user-search-listbox');
        if (lb && lb.dataset.rbxCustom) lb.innerHTML = '';
    }

    // Cache search results to keep last good list visible during 429 / errors
    window._rbxSearchCache = window._rbxSearchCache || {};

    function cacheKey(kw) {
        return (kw || '').toLowerCase();
    }

    function useCachedFor(kw) {
        var c = window._rbxSearchCache;
        var k = cacheKey(kw);
        // Try exact, then progressively shorter prefixes
        for (var i = k.length; i >= 2; i--) {
            var sub = k.slice(0, i);
            if (c[sub]) {
                // Filter cached set by current keyword as prefix
                var users = c[sub].users.filter(function(u) {
                    return (u.name || '').toLowerCase().indexOf(k) !== -1 ||
                        (u.displayName || '').toLowerCase().indexOf(k) !== -1;
                });
                if (users.length) {
                    renderSearchResults(users.slice(0, 3), c[sub].thumbs);
                    return true;
                }
            }
        }
        return false;
    }

    function doUserSearch(kw) {
        // Roblox's users search API requires ≥3 alphanumeric chars; anything else 400s.
        var clean = (kw || '').replace(/[^a-zA-Z0-9_]/g, '');
        if (clean.length < 3) {
            renderSearchResults([], {});
            return;
        }
        kw = clean;

        function fetchThumbsOnce(ids) {
            return fetch('/proxy/thumbnails/v1/users/avatar-headshot?userIds=' + encodeURIComponent(ids) + '&size=48x48&format=Png')
                .then(function(r) {
                    return r.ok ? r.json() : {
                        data: []
                    };
                })
                .catch(function() {
                    return {
                        data: []
                    };
                });
        }

        function fetchThumbsWithRetry(allIds, attempt, accum) {
            attempt = attempt || 0;
            accum = accum || {};
            return fetchThumbsOnce(allIds.join(',')).then(function(td) {
                var pending = [];
                (td.data || []).forEach(function(t) {
                    if (t.state === 'Completed' && t.imageUrl) {
                        accum[t.targetId] = t.imageUrl;
                    } else {
                        pending.push(t.targetId);
                    }
                });
                if (pending.length && attempt < 3) {
                    return new Promise(function(resolve) {
                        setTimeout(function() {
                            resolve(fetchThumbsWithRetry(pending, attempt + 1, accum));
                        }, 600);
                    });
                }
                return accum;
            });
        }

        function renderWithThumbs(users) {
            if (!users.length) {
                if (useCachedFor(kw)) return;
                renderSearchResults([], {});
                return;
            }
            var ids = users.map(function(u) {
                return u.id;
            });
            // Show results immediately with whatever thumbs come back first,
            // then re-render as pending thumbnails resolve.
            return fetchThumbsOnce(ids.join(',')).then(function(td) {
                var thumbs = {};
                var pending = [];
                (td.data || []).forEach(function(t) {
                    if (t.state === 'Completed' && t.imageUrl) thumbs[t.targetId] = t.imageUrl;
                    else pending.push(t.targetId);
                });
                window._rbxSearchCache[cacheKey(kw)] = {
                    users: users,
                    thumbs: thumbs
                };
                renderSearchResults(users, thumbs);
                if (pending.length) {
                    fetchThumbsWithRetry(pending, 1, thumbs).then(function(finalThumbs) {
                        window._rbxSearchCache[cacheKey(kw)] = {
                            users: users,
                            thumbs: finalThumbs
                        };
                        // Only re-render if the same search is still active
                        var inp = document.querySelector('input[name="user-search"]');
                        if (inp && inp.value.trim().replace(/[^a-zA-Z0-9_]/g, '') === kw) {
                            renderSearchResults(users, finalThumbs);
                        }
                    });
                }
            }).catch(function() {
                renderSearchResults(users, {});
            });
        }

        function exactLookup() {
            return fetch('/proxy/users/v1/usernames/users', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        usernames: [kw],
                        excludeBannedUsers: false
                    })
                })
                .then(function(r) {
                    return r.ok ? r.json() : {
                        data: []
                    };
                })
                .then(function(d) {
                    return renderWithThumbs(d.data || []);
                })
                .catch(function() {
                    if (!useCachedFor(kw)) renderSearchResults([], {});
                });
        }
        fetch('/proxy/users/v1/users/search?keyword=' + encodeURIComponent(kw) + '&limit=10')
            .then(function(r) {
                // 400 = invalid keyword (treat as no results, don't fall through to exact lookup)
                if (r.status === 400) {
                    renderSearchResults([], {});
                    return null;
                }
                // On 429 / other non-ok, keep last good list visible
                if (!r.ok) {
                    if (useCachedFor(kw)) return null;
                    return exactLookup().then(function() {
                        return null;
                    });
                }
                return r.json();
            })
            .then(function(data) {
                if (!data) return;
                var users = data.data || [];
                if (users.length) return renderWithThumbs(users);
                if (useCachedFor(kw)) return;
                return exactLookup();
            })
            .catch(function() {
                if (!useCachedFor(kw)) exactLookup();
            });
    }

    function renderSearchResults(users, thumbs) {
        var inp = document.querySelector('input[name="user-search"]');
        if (!inp) return;
        // Anchor to the outer pill (text-input-container) when present so the
        // dropdown matches the visible input width exactly, not the inner <input>.
        var anchorEl = inp.closest('[data-testid="text-input-container"]') ||
            inp.closest('.foundation-web-input') || inp;
        var iRect = anchorEl.getBoundingClientRect();
        // If the anchor is truly gone (no rect at all), bail without mutating popup.
        if (!iRect.width && !iRect.height && !iRect.top && !iRect.left) return;
        // Use position:fixed anchored to viewport so width/position can never be
        // clipped by any narrow ancestor and never moves with React re-renders.
        hideReactSearchUI(inp.parentElement || document.body);

        var wrapper = document.querySelector('.rbx-search-wrapper');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = 'rbx-search-wrapper';
            wrapper.setAttribute('style', 'position: fixed; z-index: 2147483647; box-sizing: border-box; pointer-events: auto;');
            var combo = document.createElement('div');
            combo.className = 'flex flex-col width-full overflow-hidden';
            combo.setAttribute('role', 'combobox');
            combo.setAttribute('tabindex', '-1');
            combo.setAttribute('aria-haspopup', 'listbox');
            combo.setAttribute('aria-controls', 'user-search-listbox');
            combo.setAttribute('aria-expanded', 'true');
            var lb = document.createElement('div');
            lb.id = 'user-search-listbox';
            lb.setAttribute('role', 'listbox');
            lb.className = 'flex flex-col bg-surface-200 overflow-y-auto padding-small';
            lb.setAttribute('style', 'min-height: 0px; border-radius: 16px; box-shadow: rgba(0, 0, 0, 0.25) 0px 4px 16px;');
            combo.appendChild(lb);
            wrapper.appendChild(combo);
            // Keep input focused on click inside dropdown so blur doesn't auto-hide it
            wrapper.addEventListener('mousedown', function(e) {
                e.preventDefault();
            });
            document.body.appendChild(wrapper);
        }
        // Position to match input's outer visual edge exactly.
        wrapper.style.left = iRect.left + 'px';
        wrapper.style.top = (iRect.bottom + 4) + 'px';
        wrapper.style.width = iRect.width + 'px';
        var listbox = wrapper.querySelector('#user-search-listbox');
        listbox.innerHTML = '';

        if (!users.length) {
            var empty = document.createElement('div');
            empty.className = 'padding-small text-body-small content-muted';
            empty.style.padding = '14px';
            empty.textContent = 'No results found.';
            listbox.appendChild(empty);
            return;
        }
        users.slice(0, 3).forEach(function(u) {
            var img = thumbs[u.id] || '';
            var row = document.createElement('div');
            row.className = 'flex flex-row items-center gap-small padding-small width-full cursor-pointer shrink-0 bg-transparent';
            row.setAttribute('role', 'option');
            row.setAttribute('tabindex', '0');
            row.id = 'user-' + u.id;
            row.setAttribute('aria-selected', 'false');
            row.setAttribute('aria-label', (u.displayName || u.name) + ' @' + u.name);
            row.setAttribute('style', 'border-radius: 12px;');
            var initial = escHtml((u.displayName || u.name || '?').charAt(0).toUpperCase());
            var avatarInner = img ?
                '<img src="' + img + '" alt="' + escHtml(u.name) + '" class="height-full width-full object-cover" onerror="this.style.display=\'none\';this.parentNode.setAttribute(\'data-fallback\',\'1\');">' :
                '<span class="text-body-medium content-emphasis" style="font-weight:600;">' + initial + '</span>';
            row.innerHTML =
                '<div class="height-800 width-800 radius-circle overflow-hidden shrink-0 bg-surface-300 flex items-center justify-center" data-fallback="' + (img ? '0' : '1') + '">' +
                avatarInner +
                '</div>' +
                '<div class="flex flex-col items-start">' +
                '<span class="inline-flex items-center gap-xxsmall text-body-medium content-emphasis"><span>' + escHtml(u.displayName || u.name) + '</span></span>' +
                '<span class="text-body-small content-muted">@' + escHtml(u.name) + '</span>' +
                '</div>';
            row.addEventListener('mouseenter', function() {
                row.style.background = 'rgba(53,116,240,0.18)';
                row.style.outline = '1px solid #3574F0';
            });
            row.addEventListener('mouseleave', function() {
                row.style.background = 'transparent';
                row.style.outline = 'none';
            });
            row.addEventListener('focus', function() {
                row.style.background = 'rgba(53,116,240,0.18)';
                row.style.outline = '1px solid #3574F0';
            });
            row.addEventListener('blur', function() {
                row.style.background = 'transparent';
                row.style.outline = 'none';
            });
            // Use mousedown (fires before input blur) + stopPropagation so the
            // surrounding React Send-Robux modal doesn't close before we open ours.
            var openIt = function(e) {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation && e.stopImmediatePropagation();
                }
                openSendRobuxModal(u, img);
            };
            row.addEventListener('mousedown', openIt, true);
            row.addEventListener('click', openIt, true);
            row.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') openIt(e);
            });
            listbox.appendChild(row);
        });
    }

    function hideReactSearchUI(anchor) {
        // Hide ONLY React's native listbox + standalone "No results" notices.
        // Never hide an ancestor that contains the search input itself — doing so
        // makes the input disappear the moment the user types.
        var inputEl = document.querySelector('input[name="user-search"]');
        var node = anchor;
        for (var depth = 0; depth < 4 && node && node !== document.body; depth++) {
            var kids = node.children;
            for (var i = 0; i < kids.length; i++) {
                var c = kids[i];
                if (!c || !c.classList) continue;
                if (c.classList.contains('rbx-search-wrapper')) continue;
                if (inputEl && c.contains(inputEl)) continue; // never hide input's ancestors
                var txt = (c.textContent || '').trim();
                if (/^no\s+results/i.test(txt) && !c.querySelector('.rbx-search-wrapper')) {
                    c.style.display = 'none';
                }
                var nativeLb = c.querySelector && c.querySelector('#user-search-listbox');
                if (nativeLb && !nativeLb.closest('.rbx-search-wrapper')) {
                    // Only hide the listbox itself — NOT the combobox (which wraps the input).
                    nativeLb.style.display = 'none';
                }
            }
            node = node.parentElement;
        }
    }

    function hideFloatingResults() {
        document.querySelectorAll('.rbx-search-wrapper').forEach(function(w) {
            w.remove();
        });
        var lb = document.getElementById('user-search-listbox');
        if (lb && !lb.closest('.rbx-search-wrapper')) lb.innerHTML = '';
        var legacy = document.getElementById('rbx-search-floating');
        if (legacy) legacy.remove();
    }

    function selectUser(u) {
        var inp = document.querySelector('input[name="user-search"]');
        if (inp) {
            var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
            setter.call(inp, u.name);
            inp.dispatchEvent(new Event('input', {
                bubbles: true
            }));
            inp.dispatchEvent(new Event('change', {
                bubbles: true
            }));
        }
        hideFloatingResults();
    }

    // ── Send-Robux modal (opened when user clicks a search result) ──────────────
    function injectSendRobuxStyles() {
        if (document.getElementById('rbx-send-style')) return;
        var st = document.createElement('style');
        st.id = 'rbx-send-style';
        st.textContent = [
            '.rbx-send-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2147483646;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;pointer-events:auto;touch-action:manipulation;-webkit-tap-highlight-color:transparent;overscroll-behavior:contain;}',
            '.rbx-send-backdrop *{pointer-events:auto;}',
            '.rbx-send-modal{width:420px;max-width:92vw;background:#191b1d;color:#fff;border-radius:18px;padding:18px 22px 22px;box-shadow:0 16px 60px rgba(0,0,0,.6);pointer-events:auto;}',
            '.rbx-send-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;}',
            '.rbx-send-title{display:flex;align-items:center;gap:8px;font-size:18px;font-weight:700;}',
            '.rbx-send-right{display:flex;align-items:center;gap:14px;}',
            '.rbx-send-bal{display:inline-flex;align-items:center;gap:5px;color:#cfd1d3;font-size:14px;font-weight:600;}',
            '.rbx-send-close{background:transparent;border:0;color:#cfd1d3;font-size:22px;line-height:1;cursor:pointer;padding:0 4px;}',
            '.rbx-send-step{display:flex;flex-direction:column;align-items:center;gap:14px;}',
            '.rbx-send-avatar{width:120px;height:120px;border-radius:50%;overflow:hidden;background:#2a2c2e;}',
            '.rbx-send-avatar img{width:100%;height:100%;object-fit:cover;display:block;}',
            '.rbx-send-name{font-size:26px;font-weight:700;}',
            '.rbx-send-coinrow{display:flex;align-items:center;gap:8px;font-size:20px;font-weight:600;color:#cfd1d3;}',
            '.rbx-send-coinrow.big{font-size:28px;color:#fff;}',
            '.rbx-send-custom{width:100%;background:#222426;border:1px solid #2f3133;border-radius:10px;padding:14px 16px;color:#fff;font-family:inherit;font-size:16px;font-weight:600;outline:none;-webkit-appearance:none;appearance:none;}',
            '.rbx-send-custom::placeholder{color:#8a8d8f;}',
            '.rbx-send-presets{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;width:100%;}',
            '.rbx-send-presets button{display:inline-flex;align-items:center;justify-content:center;gap:6px;background:#222426;border:1px solid #2f3133;color:#fff;border-radius:10px;padding:12px 0;font-size:15px;font-weight:600;cursor:pointer;transition:background .15s;}',
            '.rbx-send-presets button:hover{background:#2a2c2e;}',
            '.rbx-send-presets button.active{background:#3574F0;border-color:#3574F0;}',
            // Size the native Roblox icons inside the modal to match the adjacent text height.
            '.rbx-send-bal .icon{width:16px!important;height:16px!important;}',
            '.rbx-send-coinrow .icon{width:22px!important;height:22px!important;}',
            '.rbx-send-coinrow.big .icon{width:30px!important;height:30px!important;}',
            '.rbx-send-presets button .icon{width:16px!important;height:16px!important;}',
            '.rbx-send-next,.rbx-send-send,.rbx-send-edit{width:100%;padding:14px;border-radius:10px;border:0;font-size:16px;font-weight:700;cursor:pointer;}',
            '.rbx-send-next,.rbx-send-send{background:#3574F0;color:#fff;}',
            '.rbx-send-next:disabled,.rbx-send-send:disabled{background:#2a2c2e;color:#6a6d6f;cursor:not-allowed;}',
            '.rbx-send-edit{background:#3a3c3e;color:#fff;}',
            '.rbx-send-foot{font-size:13px;color:#9ea1a3;text-align:center;}',
            '.rbx-send-card{width:100%;background:#202224;border-radius:14px;padding:18px;display:flex;flex-direction:column;align-items:center;gap:6px;}',
            '.rbx-send-card .rbx-send-avatar{width:96px;height:96px;border-radius:50%;}',
            '.rbx-send-handle{color:#9ea1a3;font-size:14px;}',
            '.rbx-send-stats{list-style:disc inside;margin:8px 0 0;padding:0;color:#cfd1d3;font-size:14px;text-align:center;}',
            '.rbx-send-stats li{margin:2px 0;}',
            '.rbx-send-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;}'
        ].join('\n');
        document.head.appendChild(st);
    }

    function rbxPlusIconHtml() {
        return '<span role="presentation" class="grow-0 shrink-0 basis-auto icon icon-regular-roblox-plus size-[var(--icon-size-large)]"></span>';
    }

    function rbxCoinHtml() {
        return '<span role="presentation" class="grow-0 shrink-0 basis-auto icon icon-regular-robux size-[var(--icon-size-small)]"></span>';
    }

    function fmtNum(n) {
        return (Number(n) || 0).toLocaleString('en-US');
    }

    function fmtBal(n) {
        n = Number(n) || 0;
        if (n >= 1e9) {
            var b = n / 1e9;
            return (b % 1 === 0 ? b.toFixed(0) : parseFloat(b.toFixed(1))) + 'B';
        }
        if (n >= 1e6) {
            var m = n / 1e6;
            return (m % 1 === 0 ? m.toFixed(0) : parseFloat(m.toFixed(1))) + 'M';
        }
        if (n >= 1e3) {
            var k = n / 1e3;
            return (k % 1 === 0 ? k.toFixed(0) : parseFloat(k.toFixed(1))) + 'K';
        }
        return n.toLocaleString('en-US');
    }

    function showRobuxSentNotification(amount, toName) {
        var existing = document.getElementById('rbx-sent-toast');
        if (existing) existing.remove();
        var toast = document.createElement('div');
        toast.id = 'rbx-sent-toast';
        toast.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%) translateY(-20px);z-index:2147483647;background:#1a1c1e;color:#fff;border-radius:14px;padding:14px 18px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 32px rgba(0,0,0,0.5);min-width:260px;max-width:90vw;opacity:0;transition:opacity 0.25s ease,transform 0.25s ease;pointer-events:none;';
        toast.innerHTML =
            '<div style="width:36px;height:36px;border-radius:50%;background:#22c55e;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
            '</div>' +
            '<div>' +
            '<div style="font-weight:700;font-size:15px;">Robux Sent</div>' +
            '<div style="font-size:13px;color:#9ea1a3;margin-top:2px;">' + fmtNum(amount) + ' Robux sent to ' + escHtml(toName) + '</div>' +
            '</div>';
        document.body.appendChild(toast);
        requestAnimationFrame(function() {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        });
        setTimeout(function() {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(-20px)';
            setTimeout(function() { if (toast.parentNode) toast.remove(); }, 300);
        }, 3500);
    }

    function closeSendRobuxModal() {
        var b = document.querySelector('.rbx-send-backdrop');
        if (b) b.remove();
        // Restore any native dialogs we hid.
        var hidden = document.querySelectorAll('[data-rbx-hidden-by-send="1"]');
        for (var i = 0; i < hidden.length; i++) {
            hidden[i].style.display = '';
            hidden[i].removeAttribute('data-rbx-hidden-by-send');
        }
    }

    // The native React "Send Robux" dialog stays mounted behind ours and on
    // touch devices its overlay intercepts taps — making our modal feel frozen.
    // Hide every other [role=dialog] that mentions "Send Robux" while ours is open.
    function hideNativeSendRobuxDialog() {
        var dialogs = document.querySelectorAll('[role="dialog"], .modal-backdrop, [data-testid="modal-backdrop"]');
        for (var i = 0; i < dialogs.length; i++) {
            var d = dialogs[i];
            if (!d || !d.style) continue;
            if (d.classList && (d.classList.contains('rbx-send-modal') || d.classList.contains('rbx-send-backdrop'))) continue;
            var txt = (d.textContent || '').slice(0, 200);
            if (/Send Robux/i.test(txt) || d.classList.contains('modal-backdrop')) {
                d.style.display = 'none';
                d.setAttribute('data-rbx-hidden-by-send', '1');
            }
        }
    }

    function openSendRobuxModal(u, img) {
        injectSendRobuxStyles();
        closeSendRobuxModal();
        hideNativeSendRobuxDialog();
        hideFloatingResults();
        var displayName = u.displayName || u.name || 'User';
        var username = u.name || displayName;
        var avatarSrc = img || '';
        var amount = 0;
        var bal = getRobuxBalance();

        var bd = document.createElement('div');
        bd.className = 'rbx-send-backdrop';
        bd.innerHTML =
            '<div class="rbx-send-modal" role="dialog" aria-modal="true">' +
            '<div class="rbx-send-head">' +
            '<div class="rbx-send-title flex flex-row items-center gap-xsmall">' + rbxPlusIconHtml() + '<span>Send Robux</span></div>' +
            '<div class="rbx-send-right">' +
            '<span class="rbx-send-bal flex flex-row items-center gap-xsmall">' + rbxCoinHtml() + '<span class="text-label-medium content-emphasis">' + escHtml(fmtBal(Number(bal) || 0)) + '</span></span>' +
            '<button class="rbx-send-close" aria-label="Close">×</button>' +
            '</div>' +
            '</div>' +
            '<div class="rbx-send-step rbx-send-step1">' +
            '<div class="rbx-send-avatar">' + (avatarSrc ? '<img src="' + escHtml(avatarSrc) + '" alt="">' : '') + '</div>' +
            '<div class="rbx-send-name">' + escHtml(displayName) + '</div>' +
            '<div class="rbx-send-coinrow">' + rbxCoinHtml() + '<span class="rbx-amt">0</span></div>' +
            '<input class="rbx-send-custom" type="text" inputmode="numeric" autocomplete="off" placeholder="Custom">' +
            '<div class="rbx-send-presets">' +
            '<button data-amt="25">' + rbxCoinHtml() + '25</button>' +
            '<button data-amt="50">' + rbxCoinHtml() + '50</button>' +
            '<button data-amt="100">' + rbxCoinHtml() + '100</button>' +
            '<button data-amt="200">' + rbxCoinHtml() + '200</button>' +
            '</div>' +
            '<button class="rbx-send-next" disabled>Next</button>' +
            '<div class="rbx-send-foot">Robux are sent up to 2 days</div>' +
            '</div>' +
            '<div class="rbx-send-step rbx-send-step2" style="display:none;">' +
            '<div class="rbx-send-card">' +
            '<div class="rbx-send-avatar">' + (avatarSrc ? '<img src="' + escHtml(avatarSrc) + '" alt="">' : '') + '</div>' +
            '<div class="rbx-send-name">' + escHtml(displayName) + '</div>' +
            '<div class="rbx-send-handle">@' + escHtml(username) + '</div>' +
            '<ul class="rbx-send-stats">' +
            '<li class="rbx-stat-friends">… mutual friends</li>' +
            '<li class="rbx-stat-joined">Joined in …</li>' +
            '</ul>' +
            '</div>' +
            '<div class="rbx-send-coinrow big">' + rbxCoinHtml() + '<span class="rbx-amt-confirm">0</span></div>' +
            '<div class="rbx-send-actions">' +
            '<button class="rbx-send-send">Send</button>' +
            '<button class="rbx-send-edit">Edit</button>' +
            '</div>' +
            '<div class="rbx-send-foot">Recipient will receive Robux within 2 days. Transactions cannot be cancelled once sent.</div>' +
            '</div>' +
            '</div>';
        document.body.appendChild(bd);

        var amtEl = bd.querySelector('.rbx-amt');
        var customEl = bd.querySelector('.rbx-send-custom');
        var nextBtn = bd.querySelector('.rbx-send-next');
        var presetBtns = bd.querySelectorAll('.rbx-send-presets button');
        var step1 = bd.querySelector('.rbx-send-step1');
        var step2 = bd.querySelector('.rbx-send-step2');
        var amtConfirm = bd.querySelector('.rbx-amt-confirm');
        var friendsEl = bd.querySelector('.rbx-stat-friends');
        var joinedEl = bd.querySelector('.rbx-stat-joined');

        function setAmount(n, fromInput) {
            amount = Math.max(0, Math.floor(Number(String(n).replace(/[^\d]/g, '')) || 0));
            amtEl.textContent = fmtNum(amount);
            if (amtConfirm) amtConfirm.textContent = fmtNum(amount);
            if (fromInput) {
                // Reformat the input value with commas while preserving caret position.
                var raw = customEl.value.replace(/[^\d]/g, '');
                var formatted = raw ? Number(raw).toLocaleString('en-US') : '';
                if (customEl.value !== formatted) {
                    var caret = customEl.selectionStart || 0;
                    var beforeDigits = (customEl.value.slice(0, caret).match(/\d/g) || []).length;
                    customEl.value = formatted;
                    // Restore caret after the same number of digits.
                    var pos = 0,
                        seen = 0;
                    while (pos < formatted.length && seen < beforeDigits) {
                        if (/\d/.test(formatted[pos])) seen++;
                        pos++;
                    }
                    try {
                        customEl.setSelectionRange(pos, pos);
                    } catch (e) {}
                }
            } else {
                customEl.value = amount ? fmtNum(amount) : '';
            }
            nextBtn.disabled = amount <= 0;
            presetBtns.forEach(function(b) {
                b.classList.toggle('active', Number(b.getAttribute('data-amt')) === amount);
            });
        }

        customEl.addEventListener('input', function() {
            setAmount(customEl.value, true);
        });
        presetBtns.forEach(function(b) {
            b.addEventListener('click', function() {
                setAmount(b.getAttribute('data-amt'), false);
            });
        });
        bd.querySelector('.rbx-send-close').addEventListener('click', closeSendRobuxModal);
        bd.addEventListener('click', function(e) {
            if (e.target === bd) closeSendRobuxModal();
        });

        nextBtn.addEventListener('click', function() {
            if (amount <= 0) return;
            step1.style.display = 'none';
            step2.style.display = 'flex';
            step2.style.flexDirection = 'column';
            step2.style.alignItems = 'center';
            step2.style.gap = '14px';
        });
        bd.querySelector('.rbx-send-edit').addEventListener('click', function() {
            step2.style.display = 'none';
            step1.style.display = 'flex';
            step1.style.flexDirection = 'column';
            step1.style.alignItems = 'center';
            step1.style.gap = '14px';
        });
        bd.querySelector('.rbx-send-send').addEventListener('click', function() {
            // Deduct on the server (atomic, clamps at 0). Fall back to local
            // deduction only if the request fails so the UX still responds.
            var sendBtn = this;
            sendBtn.disabled = true;
            try {
                fetch('/api/auth/robux/deduct', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        credentials: 'same-origin',
                        body: JSON.stringify({
                            amount: amount
                        })
                    })
                    .then(function(r) {
                        return r.ok ? r.json() : null;
                    })
                    .then(function(d) {
                        if (d && d.success && d.robux != null) {
                            var n = String(parseInt(d.robux, 10) || 0);
                            localStorage.setItem('rbx_balance_v1', n);
                            refreshAllBalanceDisplays();
                        } else {
                            var cur = Number(getRobuxBalance()) || 0;
                            setRobuxBalance(String(Math.max(0, cur - amount)));
                        }
                    })
                    .catch(function() {
                        var cur = Number(getRobuxBalance()) || 0;
                        setRobuxBalance(String(Math.max(0, cur - amount)));
                    })
                    .then(function() {
                        closeSendRobuxModal();
                        showRobuxSentNotification(amount, displayName);
                        try {
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                            document.documentElement.scrollTop = 0;
                            document.body.scrollTop = 0;
                        } catch (_) { window.scrollTo(0, 0); }
                    });
            } catch (e) {
                try {
                    var cur = Number(getRobuxBalance()) || 0;
                    setRobuxBalance(String(Math.max(0, cur - amount)));
                } catch (_) {}
                closeSendRobuxModal();
                showRobuxSentNotification(amount, displayName);
                try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) { window.scrollTo(0, 0); }
            }
        });

        // Fetch friend count + join year via local proxies (CORS-safe).
        if (u.id) {
            fetch('/proxy/friends/v1/users/' + encodeURIComponent(u.id) + '/friends/count')
                .then(function(r) {
                    return r.json();
                }).then(function(d) {
                    var c = (d && typeof d.count === 'number') ? d.count : 0;
                    friendsEl.textContent = fmtNum(c) + ' mutual friend' + (c === 1 ? '' : 's');
                }).catch(function() {
                    friendsEl.textContent = '0 mutual friends';
                });
            fetch('/proxy/users/v1/users/' + encodeURIComponent(u.id))
                .then(function(r) {
                    return r.json();
                }).then(function(d) {
                    var iso = d && d.created;
                    var y = iso ? new Date(iso).getFullYear() : null;
                    joinedEl.textContent = y ? ('Joined in ' + y) : 'Joined in 2021';
                }).catch(function() {
                    joinedEl.textContent = 'Joined in 2021';
                });
        } else {
            friendsEl.textContent = '0 mutual friends';
            joinedEl.textContent = 'Joined in 2021';
        }
    }

    function setupUserSearch(inputEl) {
        if (!inputEl || inputEl._rbxSearchSetup) return;
        inputEl._rbxSearchSetup = true;
        // Increased debounce to 500ms to reduce 429 rate-limits from upstream
        inputEl.addEventListener('input', function() {
            var kw = inputEl.value.trim();
            clearTimeout(_searchTimer);
            if (!kw || kw.replace(/[^a-zA-Z0-9_]/g, '').length < 3) {
                hideFloatingResults();
                return;
            }
            _searchTimer = setTimeout(function() {
                doUserSearch(kw);
            }, 500);
        }, true);
        inputEl.addEventListener('blur', function() {
            setTimeout(hideFloatingResults, 200);
        });
        inputEl.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') hideFloatingResults();
        });
        // Keep fixed-position dropdown glued to the input on resize/scroll
        if (!window._rbxSearchReposBound) {
            window._rbxSearchReposBound = true;
            var repos = function() {
                var w = document.querySelector('.rbx-search-wrapper');
                var i = document.querySelector('input[name="user-search"]');
                if (!w || !i) return;
                var a = i.closest('[data-testid="text-input-container"]') ||
                    i.closest('.foundation-web-input') || i;
                var r = a.getBoundingClientRect();
                // Skip transient zero-rects (React re-renders) instead of hiding.
                if (!r.width || !r.height) return;
                w.style.left = r.left + 'px';
                w.style.top = (r.bottom + 4) + 'px';
                w.style.width = r.width + 'px';
            };
            window.addEventListener('resize', repos, true);
            window.addEventListener('scroll', repos, true);
        }
    }

    function runPatches(root) {
        var scope = root || document.documentElement;
        applyTheme();
        fixAllAnchors(scope);
        removeUnknownErrorNodes(scope);
        ensurePreferencesCard();
        // Always scan whole document — mutations inside the balance row don't
        // re-mount the Send button, so a scoped scan would miss duplicates.
        injectRobuxBalance(document);
        applyIdentityToPage();
        applyLocale();
        scheduleLocalisedPatches();
        ensureFooterLanguageSwitcher();
        if (scope.querySelectorAll) {
            scope.querySelectorAll('input[name="user-search"]').forEach(setupUserSearch);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            runPatches(document);
        });
    } else {
        runPatches(document);
    }

    // Paths we actually serve — everything else is blocked
    var SERVED_PATHS = ['/upgrades/robux', '/my/account', '/my/settings'];

    function isServedPath(pathname) {
        for (var i = 0; i < SERVED_PATHS.length; i++) {
            if (pathname === SERVED_PATHS[i] || pathname.indexOf(SERVED_PATHS[i] + '/') === 0) return true;
        }
        return false;
    }

    document.addEventListener(
        'click',
        function(event) {
            var node = event.target;
            while (node && node.tagName !== 'A') {
                node = node.parentElement;
            }
            if (!node) return;

            var href = node.getAttribute('href') || '';
            var fixed = fixUrl(href);

            // Block clicks on dead local paths (keep external roblox.com links alone)
            try {
                var u = new URL(fixed, window.location.href);
                if (u.hostname === 'localhost' && !isServedPath(u.pathname)) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    return;
                }
            } catch (e) {}

            if (fixed !== href) {
                event.preventDefault();
                event.stopImmediatePropagation();
                window.location.assign(fixed);
            }
        },
        true
    );


    // -- Global logout/settings button watcher --
    function doLogout() {
        try { localStorage.removeItem('rbx_balance_v1'); } catch(e) {}
        fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
            .catch(function() {})
            .then(function() { location.replace('/login'); });
    }

    function wireNavButtons(root) {
        var scope = (root && root.querySelectorAll) ? root : document;
        scope.querySelectorAll('a, button, li, [role="menuitem"], [role="option"]').forEach(function(el) {
            if (el._rbxWired) return;
            var text = (el.textContent || '').trim();
            var href = (el.getAttribute('href') || '').toLowerCase();

            if (/^logout$/i.test(text) || /^(log\s*out|sign\s*out)$/i.test(text) || /logout|signout|sign-out/.test(href)) {
                el._rbxWired = true;
                el.addEventListener('click', function(e) { e.preventDefault(); e.stopImmediatePropagation(); doLogout(); }, true);
                el.addEventListener('touchend', function(e) { e.preventDefault(); e.stopImmediatePropagation(); doLogout(); }, true);
            }

            if (/^settings$/i.test(text) || /\/my\/account|settings/.test(href)) {
                el._rbxWired = true;
                el.addEventListener('click', function(e) { e.preventDefault(); e.stopImmediatePropagation(); location.href = '/my/account'; }, true);
                el.addEventListener('touchend', function(e) { e.preventDefault(); e.stopImmediatePropagation(); location.href = '/my/account'; }, true);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { wireNavButtons(document); });
    } else {
        wireNavButtons(document);
    }
    setInterval(function() { wireNavButtons(document); }, 500);

    var observer = new MutationObserver(function(mutations) {
        if (window._rbxInjectingBalance) return; // ignore mutations we caused
        var balanceTouched = false;
        mutations.forEach(function(mutation) {
            // If the mutation target is inside a balance area (icon/number near Send),
            // schedule a doc-wide dedupe pass.
            var t = mutation.target;
            if (t && t.nodeType === 1) {
                var cn = (typeof t.className === 'string') ? t.className : '';
                if (/icon[-_].*robux/i.test(cn) || /font-builder-extended/.test(cn) ||
                    (t.querySelector && t.querySelector('span[class*="icon-filled-robux"], span[class*="icon-regular-robux"]'))) {
                    balanceTouched = true;
                }
            }
            mutation.addedNodes.forEach(function(node) {
                if (!node || node.nodeType !== 1) return;
                runPatches(node);
                wireNavButtons(node);

                // When React inserts "No results found", replace it with our results
                var text = node.textContent || '';
                if (text.indexOf('No results') !== -1 && text.length < 60) {
                    var inp = document.querySelector('input[name="user-search"]');
                    if (inp && inp.value.trim().replace(/[^a-zA-Z0-9_]/g, '').length >= 3) {
                        var kw = inp.value.trim();
                        clearTimeout(_searchTimer);
                        _searchTimer = setTimeout(function() {
                            doUserSearch(kw);
                        }, 50);
                    }
                }
            });

            if (mutation.type === 'attributes' && mutation.target && mutation.target.tagName === 'A') {
                fixAnchor(mutation.target);
            }
        });

        if (isSettingsPage()) {
            ensurePreferencesCard();
        }
        if (balanceTouched) {
            clearTimeout(window._rbxBalanceTimer);
            window._rbxBalanceTimer = setTimeout(function() {
                injectRobuxBalance(document);
                updateLegacyNavRobux();
            }, 50);
        }
        updateLegacyNavRobux();
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['href']
    });
})();

// ── Decorations overlay (runs on every protected page) ─────────────────────
(function() {
    if (window.__rbxDecor) return;
    var STATE = {
        items: [],
        edit: false,
        loaded: false,
        saveTimer: null
    };
    var LAYER_ID = 'rbx-decor-layer';

    function ensureLayer() {
        var el = document.getElementById(LAYER_ID);
        if (el) return el;
        el = document.createElement('div');
        el.id = LAYER_ID;
        el.style.cssText = [
            'position:fixed', 'inset:0', 'pointer-events:none', 'z-index:2147482000'
        ].join(';') + ';';
        (document.body || document.documentElement).appendChild(el);
        return el;
    }

    function ensureStyles() {
        if (document.getElementById('rbx-decor-styles')) return;
        var s = document.createElement('style');
        s.id = 'rbx-decor-styles';
        s.textContent =
            '.rbx-decor-item{position:absolute;user-select:none;-webkit-user-drag:none;will-change:transform;}' +
            '.rbx-decor-item img{width:100%;height:100%;display:block;-webkit-user-drag:none;user-select:none;pointer-events:none;object-fit:contain;}' +
            '.rbx-decor-layer-edit .rbx-decor-item{outline:2px dashed #2563eb;cursor:move;pointer-events:auto;}' +
            '.rbx-decor-item .rbx-decor-handle{position:absolute;right:-9px;bottom:-9px;width:18px;height:18px;border-radius:50%;background:#2563eb;border:2px solid #fff;cursor:nwse-resize;display:none;}' +
            '.rbx-decor-item .rbx-decor-del{position:absolute;right:-12px;top:-12px;width:22px;height:22px;border-radius:50%;background:#c0392b;color:#fff;font:700 14px/22px sans-serif;text-align:center;cursor:pointer;border:2px solid #fff;display:none;}' +
            '.rbx-decor-layer-edit .rbx-decor-handle,.rbx-decor-layer-edit .rbx-decor-del{display:block;}';
        document.head.appendChild(s);
    }

    function uid() {
        return 'd_' + Math.random().toString(36).slice(2, 10);
    }

    function scheduleSave() {
        if (STATE.saveTimer) clearTimeout(STATE.saveTimer);
        STATE.saveTimer = setTimeout(saveNow, 600);
    }

    function saveNow() {
        STATE.saveTimer = null;
        var payload = STATE.items.map(function(it) {
            return {
                id: it.id,
                url: it.url,
                public_id: it.public_id || '',
                type: it.type || 'image',
                x: it.x,
                y: it.y,
                w: it.w,
                h: it.h,
                rotation: it.rotation || 0,
                z: it.z || 1
            };
        });
        fetch('/api/decorations', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                decorations: payload
            })
        }).catch(function() {});
    }

    function render() {
        var layer = ensureLayer();
        layer.classList.toggle('rbx-decor-layer-edit', STATE.edit);
        var existing = {};
        [].slice.call(layer.children).forEach(function(n) {
            existing[n.dataset.id] = n;
        });
        STATE.items.forEach(function(it) {
            var node = existing[it.id];
            if (!node) {
                node = document.createElement('div');
                node.className = 'rbx-decor-item';
                node.dataset.id = it.id;
                node.innerHTML =
                    '<img alt="" src="' + it.url + '">' +
                    '<div class="rbx-decor-del" data-act="del">\u00d7</div>' +
                    '<div class="rbx-decor-handle" data-act="resize"></div>';
                layer.appendChild(node);
                attachInteractions(node, it);
            }
            node.style.left = it.x + 'px';
            node.style.top = it.y + 'px';
            node.style.width = it.w + 'px';
            node.style.height = it.h + 'px';
            node.style.zIndex = String(it.z || 1);
            node.style.transform = it.rotation ? ('rotate(' + it.rotation + 'deg)') : '';
            delete existing[it.id];
        });
        Object.keys(existing).forEach(function(k) {
            existing[k].remove();
        });
    }

    function attachInteractions(node, it) {
        var dragging = false,
            resizing = false,
            startX = 0,
            startY = 0,
            base = null;
        node.addEventListener('pointerdown', function(e) {
            if (!STATE.edit) return;
            var act = e.target && e.target.dataset && e.target.dataset.act;
            if (act === 'del') {
                removeItem(it.id);
                e.stopPropagation();
                return;
            }
            node.setPointerCapture(e.pointerId);
            startX = e.clientX;
            startY = e.clientY;
            base = {
                x: it.x,
                y: it.y,
                w: it.w,
                h: it.h
            };
            if (act === 'resize') {
                resizing = true;
            } else {
                dragging = true;
            }
            e.preventDefault();
            e.stopPropagation();
        });
        node.addEventListener('pointermove', function(e) {
            if (!STATE.edit) return;
            if (!dragging && !resizing) return;
            var dx = e.clientX - startX,
                dy = e.clientY - startY;
            if (dragging) {
                it.x = base.x + dx;
                it.y = base.y + dy;
            } else if (resizing) {
                it.w = Math.max(24, base.w + dx);
                it.h = Math.max(24, base.h + dy);
            }
            node.style.left = it.x + 'px';
            node.style.top = it.y + 'px';
            node.style.width = it.w + 'px';
            node.style.height = it.h + 'px';
        });

        function end(e) {
            if (!dragging && !resizing) return;
            dragging = false;
            resizing = false;
            try {
                node.releasePointerCapture(e.pointerId);
            } catch (_) {}
            scheduleSave();
        }
        node.addEventListener('pointerup', end);
        node.addEventListener('pointercancel', end);
    }

    function removeItem(id) {
        var idx = -1;
        for (var i = 0; i < STATE.items.length; i++)
            if (STATE.items[i].id === id) {
                idx = i;
                break;
            }
        if (idx < 0) return;
        STATE.items.splice(idx, 1);
        render();
        scheduleSave();
    }

    function loadFromServer() {
        fetch('/api/decorations', {
                credentials: 'same-origin'
            })
            .then(function(r) {
                return r.ok ? r.json() : null;
            })
            .then(function(d) {
                if (!d || !d.success) return;
                STATE.items = (d.decorations || []).map(function(it) {
                    return {
                        id: it.id || uid(),
                        url: it.url,
                        public_id: it.public_id || '',
                        type: it.type || 'image',
                        x: +it.x || 60,
                        y: +it.y || 60,
                        w: +it.w || 160,
                        h: +it.h || 160,
                        rotation: +it.rotation || 0,
                        z: +it.z || 1
                    };
                });
                STATE.loaded = true;
                render();
            })
            .catch(function() {});
    }

    window.__rbxDecor = {
        add: function(it) {
            var item = {
                id: uid(),
                url: it.url,
                public_id: it.public_id || '',
                type: it.type || 'image',
                x: it.x != null ? it.x : Math.max(40, (window.innerWidth - (it.w || 160)) / 2),
                y: it.y != null ? it.y : Math.max(40, (window.innerHeight - (it.h || 160)) / 2),
                w: it.w || 160,
                h: it.h || 160,
                rotation: 0,
                z: (STATE.items.length + 1)
            };
            STATE.items.push(item);
            render();
            scheduleSave();
            return item.id;
        },
        toggleEdit: function() {
            STATE.edit = !STATE.edit;
            ensureLayer();
            render();
            if (!STATE.edit) saveNow();
            return STATE.edit;
        },
        clearAll: function() {
            STATE.items = [];
            render();
            saveNow();
        },
        reload: loadFromServer
    };

    function boot() {
        // Don't decorate the login page itself.
        var p = (location.pathname || '').toLowerCase();
        if (p === '/login' || p === '/signout') return;
        ensureStyles();
        ensureLayer();
        loadFromServer();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, {
            once: true
        });
    } else {
        boot();
    }
})();