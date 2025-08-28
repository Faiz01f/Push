/**
 * DiziPush Service Worker
 * Handles push notifications, background sync, and caching
 */

const CACHE_NAME = 'dizipush-sw-v1'
const NOTIFICATION_CACHE = 'dizipush-notifications-v1'

// Configuration (will be dynamically replaced by the server)
const DIZIPUSH_CONFIG = {
  apiUrl: 'https://your-domain.com/api',
  projectId: 'proj_123',
  trackingEnabled: true,
  debug: false
}

/**
 * Install event - Cache essential resources
 */
self.addEventListener('install', (event) => {
  log('Service worker installing...')
  
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then(cache => {
        return cache.addAll([
          '/icons/notification-icon.png',
          '/icons/notification-badge.png'
        ]).catch(error => {
          log('Cache installation failed:', error)
          // Don't fail installation if caching fails
        })
      }),
      self.skipWaiting()
    ])
  )
})

/**
 * Activate event - Clean up old caches
 */
self.addEventListener('activate', (event) => {
  log('Service worker activating...')
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && cacheName !== NOTIFICATION_CACHE) {
              log('Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      }),
      // Take control of all clients
      self.clients.claim()
    ])
  )
})

/**
 * Push event - Handle incoming push notifications
 */
self.addEventListener('push', (event) => {
  log('Push event received:', event)
  
  if (!event.data) {
    log('Push event has no data')
    return
  }
  
  let data
  try {
    data = event.data.json()
  } catch (error) {
    log('Failed to parse push data:', error)
    return
  }
  
  log('Push data:', data)
  
  event.waitUntil(
    handlePushNotification(data)
      .then(() => {
        log('Push notification handled successfully')
        return trackEvent('notification_received', data)
      })
      .catch(error => {
        log('Error handling push notification:', error)
      })
  )
})

/**
 * Notification click event - Handle notification interactions
 */
self.addEventListener('notificationclick', (event) => {
  log('Notification click event:', event)
  
  const notification = event.notification
  const action = event.action
  const data = notification.data || {}
  
  notification.close()
  
  event.waitUntil(
    handleNotificationClick(action, data)
      .then(() => {
        return trackEvent('notification_click', {
          action: action || 'default',
          campaignId: data.campaignId,
          url: data.url
        })
      })
      .catch(error => {
        log('Error handling notification click:', error)
      })
  )
})

/**
 * Notification close event - Track notification dismissals
 */
self.addEventListener('notificationclose', (event) => {
  log('Notification close event:', event)
  
  const data = event.notification.data || {}
  
  event.waitUntil(
    trackEvent('notification_close', {
      campaignId: data.campaignId
    }).catch(error => {
      log('Error tracking notification close:', error)
    })
  )
})

/**
 * Message event - Handle messages from main thread
 */
self.addEventListener('message', (event) => {
  log('Message received:', event.data)
  
  const { type, payload } = event.data
  
  switch (type) {
    case 'TRACK_EVENT':
      trackEvent(payload.event, payload.data)
      break
      
    case 'UPDATE_CONFIG':
      Object.assign(DIZIPUSH_CONFIG, payload)
      break
      
    case 'GET_SUBSCRIPTION':
      self.registration.pushManager.getSubscription().then(subscription => {
        event.ports[0].postMessage({
          type: 'SUBSCRIPTION_RESULT',
          subscription: subscription
        })
      })
      break
      
    default:
      log('Unknown message type:', type)
  }
})

/**
 * Background sync event - Handle offline actions
 */
self.addEventListener('sync', (event) => {
  log('Background sync event:', event.tag)
  
  if (event.tag === 'dizipush-events') {
    event.waitUntil(syncPendingEvents())
  }
})

/**
 * Handle push notification display
 */
async function handlePushNotification(data) {
  const {
    title,
    body,
    icon = '/icons/notification-icon.png',
    image,
    badge = '/icons/notification-badge.png',
    actions = [],
    tag,
    requireInteraction = false,
    silent = false,
    timestamp = Date.now(),
    url,
    campaignId,
    projectId,
    data: customData = {}
  } = data
  
  // Validate required fields
  if (!title || !body) {
    throw new Error('Notification must have title and body')
  }
  
  // Check for existing notification with same tag
  if (tag) {
    const existingNotifications = await self.registration.getNotifications({ tag })
    existingNotifications.forEach(notification => notification.close())
  }
  
  // Prepare notification options
  const notificationOptions = {
    body,
    icon,
    badge,
    tag,
    requireInteraction,
    silent,
    timestamp,
    data: {
      url,
      campaignId,
      projectId,
      ...customData
    },
    actions: actions.map(action => ({
      action: action.action,
      title: action.title,
      icon: action.icon || icon
    }))
  }
  
  // Add image if provided
  if (image) {
    notificationOptions.image = image
  }
  
  // Show notification
  await self.registration.showNotification(title, notificationOptions)
  
  // Cache notification for offline access
  await cacheNotification(data)
  
  log('Notification displayed:', title)
}

/**
 * Handle notification click actions
 */
async function handleNotificationClick(action, data) {
  const { url, campaignId } = data
  
  let targetUrl = url || '/'
  
  // Handle specific actions
  switch (action) {
    case 'save':
      // Save for later (could store in IndexedDB)
      await saveNotificationForLater(data)
      return
      
    case 'dismiss':
      // Just close, no further action
      return
      
    case 'later':
      // Remind later (schedule notification)
      await scheduleReminder(data)
      return
      
    default:
      // Default action - open URL
      break
  }
  
  // Add tracking parameters to URL
  if (campaignId && targetUrl !== '/') {
    const urlObj = new URL(targetUrl)
    urlObj.searchParams.set('utm_source', 'push')
    urlObj.searchParams.set('utm_medium', 'notification')
    urlObj.searchParams.set('utm_campaign', campaignId)
    targetUrl = urlObj.toString()
  }
  
  // Try to focus existing tab or open new one
  const clients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  })
  
  // Look for existing tab with same origin
  for (const client of clients) {
    if (client.url.indexOf(self.location.origin) === 0) {
      await client.focus()
      client.postMessage({
        type: 'NOTIFICATION_CLICK',
        url: targetUrl,
        campaignId
      })
      return
    }
  }
  
  // No existing tab found, open new window
  await self.clients.openWindow(targetUrl)
}

/**
 * Track events to analytics
 */
async function trackEvent(eventType, eventData = {}) {
  if (!DIZIPUSH_CONFIG.trackingEnabled) {
    return
  }
  
  const event = {
    type: eventType,
    timestamp: Date.now(),
    projectId: DIZIPUSH_CONFIG.projectId,
    data: eventData
  }
  
  log('Tracking event:', event)
  
  try {
    // Try to send immediately
    await sendEvent(event)
  } catch (error) {
    log('Failed to send event immediately, queuing for sync:', error)
    
    // Queue for background sync
    await queueEventForSync(event)
    
    // Register for background sync
    if ('serviceWorker' in self && 'sync' in window.ServiceWorkerRegistration.prototype) {
      await self.registration.sync.register('dizipush-events')
    }
  }
}

/**
 * Send event to server
 */
async function sendEvent(event) {
  const response = await fetch(`${DIZIPUSH_CONFIG.apiUrl}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(event)
  })
  
  if (!response.ok) {
    throw new Error(`Failed to send event: ${response.status}`)
  }
}

/**
 * Queue event for background sync
 */
async function queueEventForSync(event) {
  const db = await openDB()
  const transaction = db.transaction(['events'], 'readwrite')
  const store = transaction.objectStore('events')
  
  await store.add({
    ...event,
    queued: true,
    queuedAt: Date.now()
  })
}

/**
 * Sync pending events
 */
async function syncPendingEvents() {
  try {
    const db = await openDB()
    const transaction = db.transaction(['events'], 'readwrite')
    const store = transaction.objectStore('events')
    
    const events = await store.getAll()
    const queuedEvents = events.filter(event => event.queued)
    
    log('Syncing queued events:', queuedEvents.length)
    
    for (const event of queuedEvents) {
      try {
        await sendEvent(event)
        await store.delete(event.id)
        log('Synced event:', event.type)
      } catch (error) {
        log('Failed to sync event:', event.type, error)
      }
    }
  } catch (error) {
    log('Error syncing events:', error)
  }
}

/**
 * Cache notification for offline access
 */
async function cacheNotification(notificationData) {
  try {
    const cache = await caches.open(NOTIFICATION_CACHE)
    const cacheKey = `notification-${notificationData.campaignId || Date.now()}`
    
    const response = new Response(JSON.stringify(notificationData), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=86400' // 24 hours
      }
    })
    
    await cache.put(cacheKey, response)
  } catch (error) {
    log('Failed to cache notification:', error)
  }
}

/**
 * Save notification for later access
 */
async function saveNotificationForLater(data) {
  const db = await openDB()
  const transaction = db.transaction(['saved'], 'readwrite')
  const store = transaction.objectStore('saved')
  
  await store.add({
    ...data,
    savedAt: Date.now()
  })
  
  log('Notification saved for later')
}

/**
 * Schedule reminder notification
 */
async function scheduleReminder(data) {
  // This would require additional implementation
  // For now, just log the action
  log('Reminder scheduled for:', data.title)
  
  // Could use IndexedDB to store reminders and check periodically
  // Or integrate with browser's native scheduling if available
}

/**
 * Open IndexedDB for local storage
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('DiziPushDB', 1)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      
      // Create events store
      if (!db.objectStoreNames.contains('events')) {
        const eventsStore = db.createObjectStore('events', { 
          keyPath: 'id', 
          autoIncrement: true 
        })
        eventsStore.createIndex('timestamp', 'timestamp', { unique: false })
        eventsStore.createIndex('type', 'type', { unique: false })
      }
      
      // Create saved notifications store
      if (!db.objectStoreNames.contains('saved')) {
        const savedStore = db.createObjectStore('saved', { 
          keyPath: 'id', 
          autoIncrement: true 
        })
        savedStore.createIndex('savedAt', 'savedAt', { unique: false })
      }
    }
  })
}

/**
 * Logging utility
 */
function log(...args) {
  if (DIZIPUSH_CONFIG.debug) {
    console.log('[DiziPush SW]', ...args)
  }
}

/**
 * Error handling for uncaught errors
 */
self.addEventListener('error', (event) => {
  log('Service worker error:', event.error)
})

self.addEventListener('unhandledrejection', (event) => {
  log('Service worker unhandled rejection:', event.reason)
})

// Log service worker start
log('DiziPush Service Worker loaded')

// Keep service worker alive with periodic heartbeat
setInterval(() => {
  log('Service worker heartbeat')
}, 30000) // 30 seconds