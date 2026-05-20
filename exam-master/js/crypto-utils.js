/**
 * 加密工具 — Web Crypto API AES-GCM 加密 DeepSeek API Key
 *
 * 密钥派生自设备指纹（PBKDF2 + canvas fingerprint + navigator 属性）。
 * 加密后的 API Key 存储在 localStorage，仅在需要时解密使用。
 * 浏览器不支持 Web Crypto 时回退到明文 localStorage。
 */

const CryptoUtils = (() => {
  const ALGORITHM = 'AES-GCM';
  const KEY_LENGTH = 256;
  const PBKDF2_ITERATIONS = 200000;
  const SALT_PREFIX = 'exam_system_salt_2026';
  const STORAGE_KEY = 'deepseek_api_key_encrypted';

  let _fingerprint = null;
  let _cryptoKey = null;
  let _ready = false;

  // ── 设备指纹 ──────────────────────────────────────

  /** Canvas 指纹 — 绘制隐藏文字取像素哈希 */
  function _canvasFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 280;
      canvas.height = 60;
      const ctx = canvas.getContext('2d');
      if (!ctx) return 'no-canvas';

      ctx.textBaseline = 'top';
      ctx.font = '14px "Arial"';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('ExamPrep!<canvas>Fingerprint 考试备考', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('ExamPrep!<canvas>Fingerprint 考试备考', 4, 17);

      const data = canvas.toDataURL();
      // 简单哈希 canvas data URL
      let hash = 0;
      for (let i = Math.max(0, data.length - 2000); i < data.length; i++) {
        hash = ((hash << 5) - hash) + data.charCodeAt(i);
        hash |= 0;
      }
      return 'c' + Math.abs(hash).toString(36);
    } catch (e) {
      return 'c-error';
    }
  }

  /** 收集浏览器属性组成指纹 */
  function getFingerprint() {
    if (_fingerprint) return _fingerprint;

    const parts = [
      navigator.userAgent || '',
      navigator.language || '',
      String(screen.colorDepth || 0),
      String(screen.width || 0) + 'x' + String(screen.height || 0),
      String(navigator.hardwareConcurrency || 0),
      navigator.platform || '',
      String(new Date().getTimezoneOffset()),
      _canvasFingerprint(),
    ];

    _fingerprint = parts.join('|');
    return _fingerprint;
  }

  // ── 密钥派生 ──────────────────────────────────────

  /**
   * 从设备指纹派生 AES 密钥（PBKDF2）
   */
  async function _deriveKey(salt) {
    const fp = getFingerprint();
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(fp), 'PBKDF2', false, ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: enc.encode(salt),
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: ALGORITHM, length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // ── 初始化 ────────────────────────────────────────

  /** 预派生密钥（应用启动时调用一次） */
  async function init() {
    if (_ready) return;
    if (!_isSupported()) {
      console.warn('[Crypto] Web Crypto API 不可用，API Key 将明文存储');
      _ready = true;
      return;
    }
    try {
      _cryptoKey = await _deriveKey(SALT_PREFIX);
      _ready = true;
    } catch (e) {
      console.warn('[Crypto] 密钥派生失败:', e.message);
      _ready = true; // 允许回退
    }
  }

  function _isSupported() {
    return !!(typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.encrypt);
  }

  function isReady() { return _ready; }

  // ── 加密/解密 ─────────────────────────────────────

  /**
   * 加密明文密钥
   * @returns {Promise<string|null>} Base64 编码的 IV+ciphertext，失败返回 null
   */
  async function encrypt(plaintext) {
    if (!plaintext) return null;
    if (!_cryptoKey || !_isSupported()) return null;

    try {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const enc = new TextEncoder();
      const ciphertext = await crypto.subtle.encrypt(
        { name: ALGORITHM, iv },
        _cryptoKey,
        enc.encode(plaintext)
      );

      // IV (12 bytes) + ciphertext → Base64
      const combined = new Uint8Array(iv.length + ciphertext.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(ciphertext), iv.length);

      return btoa(String.fromCharCode(...combined));
    } catch (e) {
      console.error('[Crypto] 加密失败:', e.message);
      return null;
    }
  }

  /**
   * 解密密文
   * @returns {Promise<string|null>} 明文密钥，失败返回 null
   */
  async function decrypt(encoded) {
    if (!encoded) return null;
    if (!_cryptoKey || !_isSupported()) return null;

    try {
      const combined = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);

      const decrypted = await crypto.subtle.decrypt(
        { name: ALGORITHM, iv },
        _cryptoKey,
        ciphertext
      );

      return new TextDecoder().decode(decrypted);
    } catch (e) {
      console.error('[Crypto] 解密失败:', e.message);
      return null;
    }
  }

  // ── API Key 存取 ──────────────────────────────────

  /**
   * 安全存储 API Key（加密后写入 localStorage）
   */
  async function storeApiKey(plaintext) {
    if (!plaintext) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('deepseek_api_key'); // 清理旧明文
      return;
    }

    const encrypted = await encrypt(plaintext);
    if (encrypted) {
      // 存储加密版本
      localStorage.setItem(STORAGE_KEY, encrypted);
      // 清理可能存在的旧明文
      localStorage.removeItem('deepseek_api_key');
    } else {
      // 回退：明文存储
      console.warn('[Crypto] 加密不可用，回退明文存储');
      localStorage.setItem('deepseek_api_key', plaintext);
    }
  }

  /**
   * 安全读取 API Key（自动解密）
   * @returns {Promise<string>} 明文 API Key
   */
  async function loadApiKey() {
    // 优先读取加密版本
    const encrypted = localStorage.getItem(STORAGE_KEY);
    if (encrypted) {
      const plaintext = await decrypt(encrypted);
      if (plaintext) return plaintext;
      // 解密失败（可能换了设备），不再回退到旧明文
      console.warn('[Crypto] 解密失败，密钥可能已过期，请重新输入');
      localStorage.removeItem(STORAGE_KEY);
      return '';
    }

    // 兼容：读取旧明文并迁移到加密存储
    const legacy = localStorage.getItem('deepseek_api_key');
    if (legacy) {
      await storeApiKey(legacy);
      return legacy;
    }

    return '';
  }

  /** 判断是否有已存储的密钥 */
  function hasStoredKey() {
    return !!(localStorage.getItem(STORAGE_KEY) || localStorage.getItem('deepseek_api_key'));
  }

  /** 清除存储的密钥 */
  function clearStoredKey() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('deepseek_api_key');
  }

  return {
    init,
    isReady,
    getFingerprint,
    encrypt,
    decrypt,
    storeApiKey,
    loadApiKey,
    hasStoredKey,
    clearStoredKey,
  };
})();
