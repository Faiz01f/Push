/**
 * DiziPush Client SDK
 * Lightweight JavaScript SDK for web push notifications
 * Version: 1.0.0
 */

(function(window, document) {
  'use strict';

  // Default configuration
  const DEFAULT_CONFIG = {
    apiUrl: '/api',
    serviceWorkerUrl: '/sw.js',
    vapidPublicKey: null,
    debug: false,
    autoPrompt: false,
    promptDelay: 3000,
    trackingEnabled: true,
    retryAttempts: 3,
    retryDelay: 1000
  };

  /**
   * DiziPush SDK Class
   */
  class DiziPush {
    constructor(config = {}) {
      this.config = { ...DEFAULT_CONFIG, ...config };
      this.registration = null;
      this.subscription = null;
      this.isSupported = this.checkSupport();
      this.isInitialized = false;
      this.subscribers = new Set();
      this.eventQueue = [];
      
      this.log('DiziPush SDK initialized', this.config);
      
      if (this.isSupported) {
        this.init();
      } else {
        this.log('Push notifications not supported');
      }
    }

    /**
     * Check if push notifications are supported
     */
    checkSupport() {
      if (!('serviceWorker' in navigator)) {
        this.log('Service Worker not supported');
        return false;
      }

      if (!('PushManager' in window)) {
        this.log('Push messaging not supported');
        return false;
      }

      if (!('Notification' in window)) {
        this.log('Notifications not supported');
        return false;
      }

      return true;
    }

    /**
     * Initialize the SDK
     */
    async init() {
      if (this.isInitialized) {
        return this;
      }

      try {
        // Register service worker
        this.registration = await this.registerServiceWorker();
        
        // Get existing subscription if any
        this.subscription = await this.registration.pushManager.getSubscription();
        
        // Set up message listener
        this.setupMessageListener();
        
        // Auto-detect user information
        await this.detectUserInfo();
        
        // Auto prompt if configured
        if (this.config.autoPrompt && this.config.promptDelay > 0) {
          setTimeout(() => this.prompt(), this.config.promptDelay);
        }
        
        this.isInitialized = true;
        this.log('DiziPush SDK ready');
        
        // Notify subscribers
        this.emit('ready', { subscription: this.subscription });
        
        return this;
      } catch (error) {
        this.log('Initialization failed:', error);
        this.emit('error', { type: 'initialization', error });
        throw error;
      }
    }

    /**
     * Register service worker
     */
    async registerServiceWorker() {
      const registration = await navigator.serviceWorker.register(
        this.config.serviceWorkerUrl,
        { scope: '/' }
      );

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
      
      // Send configuration to service worker
      this.sendMessageToSW({
        type: 'UPDATE_CONFIG',
        payload: {
          apiUrl: this.config.apiUrl,
          projectId: this.config.projectId,
          trackingEnabled: this.config.trackingEnabled,
          debug: this.config.debug
        }
      });

      this.log('Service worker registered:', registration);
      return registration;
    }

    /**
     * Set up message listener for service worker communication
     */
    setupMessageListener() {
      navigator.serviceWorker.addEventListener('message', (event) => {
        const { type, data } = event.data;
        
        switch (type) {
          case 'NOTIFICATION_CLICK':
            this.emit('notificationClick', data);
            if (data.url && data.url !== window.location.href) {
              window.location.href = data.url;
            }
            break;
            
          default:
            this.log('Unknown message from SW:', type, data);
        }
      });
    }

    /**
     * Prompt user for notification permission
     */
    async prompt(options = {}) {
      if (!this.isSupported) {
        throw new Error('Push notifications not supported');
      }

      const {
        message = 'Enable notifications to get the latest updates!',
        allowButton = 'Allow',
        blockButton = 'Block',
        showCustomUI = true
      } = options;

      try {
        // Check current permission
        let permission = Notification.permission;
        
        if (permission === 'denied') {
          this.log('Notifications are blocked');
          this.emit('permissionDenied', { reason: 'blocked' });
          return false;
        }

        if (permission === 'granted') {
          // Already granted, just subscribe
          return await this.subscribe();
        }

        // Show custom UI if enabled
        if (showCustomUI && permission === 'default') {
          const userChoice = await this.showCustomPrompt(message, allowButton, blockButton);
          if (!userChoice) {
            this.emit('permissionDenied', { reason: 'user_dismissed' });
            return false;
          }
        }

        // Request permission
        permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
          this.log('Permission granted');
          this.track('permission_granted');
          this.emit('permissionGranted');
          
          return await this.subscribe();
        } else {
          this.log('Permission denied');
          this.track('permission_denied');
          this.emit('permissionDenied', { reason: 'user_denied' });
          return false;
        }
      } catch (error) {
        this.log('Error requesting permission:', error);
        this.emit('error', { type: 'permission', error });
        return false;
      }
    }

    /**
     * Show custom permission prompt UI
     */
    showCustomPrompt(message, allowButton, blockButton) {
      return new Promise((resolve) => {
        // Create custom prompt elements
        const overlay = document.createElement('div');
        overlay.className = 'dizipush-prompt-overlay';
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          z-index: 10000;
          display: flex;
          justify-content: center;
          align-items: center;
        `;

        const prompt = document.createElement('div');
        prompt.className = 'dizipush-prompt';
        prompt.style.cssText = `
          background: white;
          padding: 24px;
          border-radius: 8px;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
          max-width: 400px;
          margin: 20px;
          text-align: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        const icon = document.createElement('div');
        icon.innerHTML = '🔔';
        icon.style.cssText = 'font-size: 48px; margin-bottom: 16px;';

        const messageElement = document.createElement('p');
        messageElement.textContent = message;
        messageElement.style.cssText = `
          color: #333;
          font-size: 16px;
          line-height: 1.5;
          margin: 0 0 24px 0;
        `;

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; gap: 12px; justify-content: center;';

        const allowBtn = document.createElement('button');
        allowBtn.textContent = allowButton;
        allowBtn.style.cssText = `
          background: #007cba;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        `;

        const blockBtn = document.createElement('button');
        blockBtn.textContent = blockButton;
        blockBtn.style.cssText = `
          background: #f1f1f1;
          color: #333;
          border: none;
          padding: 12px 24px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        `;

        // Event handlers
        allowBtn.onclick = () => {
          document.body.removeChild(overlay);
          resolve(true);
        };

        blockBtn.onclick = () => {
          document.body.removeChild(overlay);
          resolve(false);
        };

        overlay.onclick = (e) => {
          if (e.target === overlay) {
            document.body.removeChild(overlay);
            resolve(false);
          }
        };

        // Assemble UI
        buttonContainer.appendChild(allowBtn);
        buttonContainer.appendChild(blockBtn);
        prompt.appendChild(icon);
        prompt.appendChild(messageElement);
        prompt.appendChild(buttonContainer);
        overlay.appendChild(prompt);
        document.body.appendChild(overlay);

        // Auto-dismiss after 30 seconds
        setTimeout(() => {
          if (document.body.contains(overlay)) {
            document.body.removeChild(overlay);
            resolve(false);
          }
        }, 30000);
      });
    }

    /**
     * Subscribe to push notifications
     */
    async subscribe(userInfo = {}) {
      if (!this.registration) {
        throw new Error('Service worker not registered');
      }

      if (!this.config.vapidPublicKey) {
        throw new Error('VAPID public key not configured');
      }

      try {
        // Create subscription
        this.subscription = await this.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(this.config.vapidPublicKey)
        });

        this.log('Push subscription created:', this.subscription);

        // Send subscription to server
        const subscriberData = await this.sendSubscriptionToServer(this.subscription, userInfo);
        
        this.emit('subscribed', { 
          subscription: this.subscription, 
          subscriber: subscriberData 
        });

        this.track('subscribe', { 
          endpoint: this.subscription.endpoint 
        });

        return this.subscription;
      } catch (error) {
        this.log('Subscription failed:', error);
        this.emit('error', { type: 'subscription', error });
        throw error;
      }
    }

    /**
     * Unsubscribe from push notifications
     */
    async unsubscribe() {
      if (!this.subscription) {
        this.log('No active subscription to unsubscribe');
        return true;
      }

      try {
        // Unsubscribe from push manager
        const success = await this.subscription.unsubscribe();
        
        if (success) {
          // Notify server
          await this.notifyServerOfUnsubscribe(this.subscription.endpoint);
          
          this.subscription = null;
          this.log('Unsubscribed successfully');
          
          this.emit('unsubscribed');
          this.track('unsubscribe');
          
          return true;
        }
        
        return false;
      } catch (error) {
        this.log('Unsubscribe failed:', error);
        this.emit('error', { type: 'unsubscribe', error });
        throw error;
      }
    }

    /**
     * Get current subscription status
     */
    async getSubscription() {
      if (!this.registration) {
        return null;
      }

      this.subscription = await this.registration.pushManager.getSubscription();
      return this.subscription;
    }

    /**
     * Check if user is subscribed
     */
    async isSubscribed() {
      const subscription = await this.getSubscription();
      return !!subscription;
    }

    /**
     * Track custom events
     */
    track(eventType, eventData = {}) {
      if (!this.config.trackingEnabled) {
        return;
      }

      const event = {
        type: eventType,
        timestamp: Date.now(),
        url: window.location.href,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
        ...eventData
      };

      this.log('Tracking event:', event);

      // Send to service worker for handling
      this.sendMessageToSW({
        type: 'TRACK_EVENT',
        payload: {
          event: eventType,
          data: event
        }
      });
    }

    /**
     * Add event listener
     */
    on(event, callback) {
      if (!this.subscribers.has(event)) {
        this.subscribers.set(event, new Set());
      }
      this.subscribers.get(event).add(callback);
    }

    /**
     * Remove event listener
     */
    off(event, callback) {
      if (this.subscribers.has(event)) {
        this.subscribers.get(event).delete(callback);
      }
    }

    /**
     * Emit event to subscribers
     */
    emit(event, data) {
      if (this.subscribers.has(event)) {
        this.subscribers.get(event).forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            this.log('Event callback error:', error);
          }
        });
      }
    }

    /**
     * Send subscription to server
     */
    async sendSubscriptionToServer(subscription, userInfo) {
      const subscriptionData = {
        endpoint: subscription.endpoint,
        p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')),
        auth: this.arrayBufferToBase64(subscription.getKey('auth')),
        ...this.getUserInfo(),
        ...userInfo
      };

      const response = await this.fetchWithRetry(`${this.config.apiUrl}/subscribers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(subscriptionData)
      });

      if (!response.ok) {
        throw new Error(`Failed to send subscription: ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    }

    /**
     * Notify server of unsubscribe
     */
    async notifyServerOfUnsubscribe(endpoint) {
      try {
        await this.fetchWithRetry(`${this.config.apiUrl}/subscribers/unsubscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ endpoint })
        });
      } catch (error) {
        this.log('Failed to notify server of unsubscribe:', error);
      }
    }

    /**
     * Detect and return user information
     */
    async detectUserInfo() {
      const info = this.getUserInfo();
      
      // Try to get more precise location if geolocation is available
      if ('geolocation' in navigator) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 5000,
              enableHighAccuracy: false
            });
          });
          
          info.latitude = position.coords.latitude;
          info.longitude = position.coords.longitude;
        } catch (error) {
          // Geolocation failed, use IP-based detection
          try {
            const geoResponse = await fetch('https://ipapi.co/json/');
            const geoData = await geoResponse.json();
            
            info.country = geoData.country;
            info.region = geoData.region;
            info.city = geoData.city;
            info.timezone = geoData.timezone;
          } catch (geoError) {
            this.log('Geolocation detection failed:', geoError);
          }
        }
      }
      
      return info;
    }

    /**
     * Get basic user information
     */
    getUserInfo() {
      const ua = navigator.userAgent;
      const screen = window.screen;
      
      return {
        browser: this.detectBrowser(),
        browserVersion: this.detectBrowserVersion(),
        os: this.detectOS(),
        device: this.detectDevice(),
        deviceType: this.detectDeviceType(),
        locale: navigator.language || navigator.userLanguage,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screenWidth: screen.width,
        screenHeight: screen.height,
        colorDepth: screen.colorDepth,
        cookieEnabled: navigator.cookieEnabled,
        onlineStatus: navigator.onLine
      };
    }

    /**
     * Browser detection
     */
    detectBrowser() {
      const ua = navigator.userAgent;
      if (ua.includes('Firefox')) return 'Firefox';
      if (ua.includes('Chrome') && !ua.includes('Edge')) return 'Chrome';
      if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
      if (ua.includes('Edge')) return 'Edge';
      if (ua.includes('Opera')) return 'Opera';
      return 'Unknown';
    }

    /**
     * Browser version detection
     */
    detectBrowserVersion() {
      const ua = navigator.userAgent;
      const browser = this.detectBrowser();
      
      let match;
      switch (browser) {
        case 'Chrome':
          match = ua.match(/Chrome\/([0-9.]+)/);
          break;
        case 'Firefox':
          match = ua.match(/Firefox\/([0-9.]+)/);
          break;
        case 'Safari':
          match = ua.match(/Version\/([0-9.]+)/);
          break;
        case 'Edge':
          match = ua.match(/Edge\/([0-9.]+)/);
          break;
        case 'Opera':
          match = ua.match(/Opera\/([0-9.]+)/);
          break;
      }
      
      return match ? match[1] : 'Unknown';
    }

    /**
     * Operating system detection
     */
    detectOS() {
      const ua = navigator.userAgent;
      if (ua.includes('Windows')) return 'Windows';
      if (ua.includes('Mac OS X')) return 'macOS';
      if (ua.includes('Linux')) return 'Linux';
      if (ua.includes('Android')) return 'Android';
      if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
      return 'Unknown';
    }

    /**
     * Device detection
     */
    detectDevice() {
      const ua = navigator.userAgent;
      if (ua.includes('iPhone')) return 'iPhone';
      if (ua.includes('iPad')) return 'iPad';
      if (ua.includes('Android')) return 'Android';
      return 'Desktop';
    }

    /**
     * Device type detection
     */
    detectDeviceType() {
      const ua = navigator.userAgent;
      if (ua.includes('Mobile') || ua.includes('Android')) return 'MOBILE';
      if (ua.includes('Tablet') || ua.includes('iPad')) return 'TABLET';
      return 'DESKTOP';
    }

    /**
     * Send message to service worker
     */
    sendMessageToSW(message) {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage(message);
      }
    }

    /**
     * Fetch with retry logic
     */
    async fetchWithRetry(url, options = {}, attempts = this.config.retryAttempts) {
      try {
        const response = await fetch(url, options);
        return response;
      } catch (error) {
        if (attempts > 1) {
          this.log(`Fetch failed, retrying in ${this.config.retryDelay}ms...`, error);
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
          return this.fetchWithRetry(url, options, attempts - 1);
        }
        throw error;
      }
    }

    /**
     * Convert VAPID key to Uint8Array
     */
    urlBase64ToUint8Array(base64String) {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);

      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    }

    /**
     * Convert ArrayBuffer to base64
     */
    arrayBufferToBase64(buffer) {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary);
    }

    /**
     * Logging utility
     */
    log(...args) {
      if (this.config.debug) {
        console.log('[DiziPush]', ...args);
      }
    }
  }

  // Expose DiziPush globally
  window.DiziPush = DiziPush;

  // Auto-initialize if config is present
  if (window.DIZIPUSH_CONFIG) {
    window.dizipush = new DiziPush(window.DIZIPUSH_CONFIG);
  }

})(window, document);