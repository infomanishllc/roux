/* ======== ROBLOX CLONE - AUTH SYSTEM ======== */

var state = {
    user: null
};
var loginAttempts = 0;
var rateLimitTimer = null;
var sessionValidationInterval = null;

function el(id) {
    return document.getElementById(id);
}

/* ======== DEVICE ID ======== */
function generateDeviceId() {
    var stored = localStorage.getItem('rbx_deviceId');
    if (stored) return stored;
    var id = 'rbx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('rbx_deviceId', id);
    return id;
}

/* ======== PASSWORD TOGGLE ======== */
function togglePasswordVisibility(inputId) {
    enforceSinglePasswordToggle(inputId);
    var input = document.getElementById(inputId);
    var toggleButton = document.querySelector('.password-toggle[data-target="' + inputId + '"]');
    if (!input || !toggleButton) return;
    var isCurrentlyPassword = input.type === 'password';
    var newType = isCurrentlyPassword ? 'text' : 'password';
    input.type = newType;
    setTimeout(function() {
        if (input.type !== newType) input.setAttribute('type', newType);
    }, 10);
    input.setAttribute('data-password-visible', isCurrentlyPassword ? 'true' : 'false');
    toggleButton.setAttribute('aria-label', isCurrentlyPassword ? 'Hide password' : 'Show password');
    var openSegments = toggleButton.querySelectorAll('[data-eye-open]');
    var closedSegments = toggleButton.querySelectorAll('[data-eye-closed]');
    if (openSegments.length > 0 && closedSegments.length > 0) {
        var showClosedEye = isCurrentlyPassword;
        openSegments.forEach(function(s) {
            s.style.display = showClosedEye ? 'none' : '';
        });
        closedSegments.forEach(function(s) {
            s.style.display = showClosedEye ? '' : 'none';
        });
    }
}

function enforceSinglePasswordToggle(inputId) {
    var wrapper = document.querySelector('[data-password-wrapper="' + inputId + '"]');
    if (!wrapper) return;
    var toggles = wrapper.querySelectorAll('.password-toggle');
    if (toggles.length > 1) toggles.forEach(function(b, i) {
        if (i > 0) b.remove();
    });
}

/* ======== LOGIN SYSTEM ======== */
function showLoginModal() {
    el('loginModal').classList.remove('hidden');
    if (el('loginError')) el('loginError').classList.add('hidden');
    el('loginUsername').focus();
    updateLoginAttemptsDisplay();
}

function hideLoginModal() {
    el('loginModal').classList.add('hidden');
    clearRateLimitTimer();
}

function updateLoginAttemptsDisplay() {
    var attemptsDiv = el('loginAttempts');
    var countSpan = el('attemptCount');
    var rateDiv = el('rateLimitTimer');
    if (loginAttempts > 0) {
        attemptsDiv.classList.remove('hidden');
        countSpan.textContent = loginAttempts;
        if (loginAttempts >= 5) {
            rateDiv.classList.remove('hidden');
            startRateLimitCountdown();
        } else {
            rateDiv.classList.add('hidden');
            clearRateLimitTimer();
        }
    } else {
        attemptsDiv.classList.add('hidden');
        rateDiv.classList.add('hidden');
        clearRateLimitTimer();
    }
}

function startRateLimitCountdown() {
    clearRateLimitTimer();
    var remaining = 60;
    var span = el('remainingTime');
    var btn = el('loginButton');
    btn.disabled = true;
    btn.textContent = 'Please wait...';
    rateLimitTimer = setInterval(function() {
        remaining--;
        span.textContent = remaining;
        if (remaining <= 0) {
            clearRateLimitTimer();
            btn.disabled = false;
            btn.textContent = 'Login';
            el('rateLimitTimer').classList.add('hidden');
        }
    }, 1000);
}

function clearRateLimitTimer() {
    if (rateLimitTimer) {
        clearInterval(rateLimitTimer);
        rateLimitTimer = null;
    }
}

async function login(username, password) {
    try {
        var deviceId = generateDeviceId();
        var response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                username: username,
                password: password,
                deviceId: deviceId
            }),
        });
        var data = await response.json();
        if (!response.ok) {
            if (response.status === 429) {
                loginAttempts = 5;
                updateLoginAttemptsDisplay();
            } else {
                loginAttempts++;
                updateLoginAttemptsDisplay();
            }
            var errorText = data.error || data.message || 'Login failed';
            el('loginError').textContent = errorText;
            el('loginError').classList.remove('hidden');
            return false;
        }
        loginAttempts = 0;
        updateLoginAttemptsDisplay();
        localStorage.setItem('rbx_username', username);
        hideLoginModal();
        state.user = data.user;

        if (data.user.role === 'admin') {
            showAdminPanel();
            return true;
        } else {
            // Customer login - redirect to PayPal pages
            if (data.user.expiresAt) {
                showTimeLeftNotification(data.user.expiresAt);
            }
            startPeriodicValidation();
            window.location.href = '/upgrades/robux?ctx=navpopover';
            return true;
        }
    } catch (error) {
        loginAttempts++;
        updateLoginAttemptsDisplay();
        el('loginError').textContent = 'Network error. Please try again.';
        el('loginError').classList.remove('hidden');
        return false;
    }
}

/* ======== TIME LEFT NOTIFICATION ======== */
function showTimeLeftNotification(expiresAt) {
    if (!expiresAt) return;
    var notification = el('timeLeftNotification');
    var timeDisplay = el('timeLeftDisplay');
    if (!notification || !timeDisplay) return;
    var now = new Date();
    var expiry = new Date(expiresAt);
    var timeLeft = expiry - now;
    if (timeLeft <= 0) {
        timeDisplay.textContent = 'Expired';
        return;
    }
    var days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    var hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    var minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    var seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    var timeText = '';
    if (days > 0) timeText = days + 'd ' + hours + 'h ' + minutes + 'm ' + seconds + 's';
    else if (hours > 0) timeText = hours + 'h ' + minutes + 'm ' + seconds + 's';
    else if (minutes > 0) timeText = minutes + 'm ' + seconds + 's';
    else timeText = seconds + 's';
    timeDisplay.textContent = timeText;
    notification.classList.remove('hidden');
    setTimeout(function() {
        notification.style.transform = 'translateX(0)';
        notification.style.opacity = '1';
    }, 10);
    notification.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        closeTimeLeftNotification();
    });
    notification.style.pointerEvents = 'auto';
    var autoClose = setTimeout(function() {
        notification.style.transform = 'translateX(400px)';
        notification.style.opacity = '0';
        setTimeout(function() {
            notification.classList.add('hidden');
            notification.style.transform = '';
            notification.style.opacity = '';
        }, 300);
    }, 8000);
    notification.dataset.timeoutId = autoClose;
}

function closeTimeLeftNotification() {
    var n = el('timeLeftNotification');
    if (n) {
        n.style.transform = 'translateX(400px)';
        n.style.opacity = '0';
        setTimeout(function() {
            n.classList.add('hidden');
            n.style.transform = '';
            n.style.opacity = '';
        }, 300);
    }
}

/* ======== LOGOUT ======== */
async function logout() {
    stopPeriodicValidation();
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
    } catch (e) {}
    localStorage.removeItem('rbx_deviceId');
    localStorage.removeItem('rbx_username');
    loginAttempts = 0;
    updateLoginAttemptsDisplay();
    state.user = null;
    hideAdminPanel();
    if (el('loginUsername')) el('loginUsername').value = '';
    if (el('loginPassword')) el('loginPassword').value = '';
    if (el('loginError')) el('loginError').classList.add('hidden');
    // Redirect to login page
    window.location.href = '/login';
}

function stopPeriodicValidation() {
    if (sessionValidationInterval) {
        clearInterval(sessionValidationInterval);
        sessionValidationInterval = null;
    }
}

function startPeriodicValidation() {
    if (sessionValidationInterval) return;
    sessionValidationInterval = setInterval(async function() {
        try {
            var response = await fetch('/api/auth/status', {
                credentials: 'include'
            });
            var data = await response.json();
            if (!response.ok || !data.authenticated) {
                stopPeriodicValidation();
                state.user = null;
                if (data.reason === 'expired') {
                    sessionStorage.setItem('rbx_logout_reason', 'expired');
                }
                window.location.href = '/login';
            }
        } catch (e) {
            // Ignore transient network issues
        }
    }, 15000);
}

/* ======== AUTH STATUS CHECK ======== */
async function checkAuthStatus() {
    try {
        var reason = sessionStorage.getItem('rbx_logout_reason');
        if (reason === 'expired') {
            sessionStorage.removeItem('rbx_logout_reason');
            showLoginModal();
            var errEl = el('loginError');
            if (errEl) {
                errEl.textContent = 'Account is deactivated. Contact admin';
                errEl.classList.remove('hidden');
            }
            return false;
        }
        var response = await fetch('/api/auth/status', {
            credentials: 'include'
        });
        var data = await response.json();
        if (data.authenticated) {
            state.user = data.user;
            hideLoginModal();
            if (data.user.role === 'admin') {
                stopPeriodicValidation();
                showAdminPanel();
            } else {
                startPeriodicValidation();
                // Customer on login page - redirect to Roblox home
                if (window.location.pathname === '/login') {
                    window.location.href = '/upgrades/robux?ctx=navpopover';
                }
            }
            return true;
        }
    } catch (e) {}
    stopPeriodicValidation();
    showLoginModal();
    return false;
}

/* ======== INIT PASSWORD TOGGLES ======== */
function initPasswordToggles(ids) {
    ids.forEach(function(id) {
        enforceSinglePasswordToggle(id);
        var btn = document.querySelector('.password-toggle[data-target="' + id + '"]');
        if (btn) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                togglePasswordVisibility(id);
            });
        }
    });
}

/* ======== FORMAT TIME LEFT ======== */
function formatTimeLeft(ms) {
    if (ms <= 0) return 'Expired';
    var d = Math.floor(ms / (1000 * 60 * 60 * 24));
    var h = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    var m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    var s = Math.floor((ms % (1000 * 60)) / 1000);
    if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
    if (h > 0) return h + 'h ' + m + 'm ' + s + 's';
    if (m > 0) return m + 'm ' + s + 's';
    return s + 's';
}