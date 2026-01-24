import express from 'express'
import webpush from 'web-push'
import { connectToDatabase } from '../lib/mongo.js'
import {
  storePushSubscription,
  removePushSubscription,
  getUserSubscriptions,
  getAllActiveSubscriptions,
  storeNotification,
  getUserNotifications,
  markNotificationAsRead
} from '../lib/notificationService.js'

const router = express.Router()

// VAPID Keys from environment variables
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BI3ZQwdtuxxYpepMvZjy5xkuzLbnsjG8J1jfBkGMi0AzbhWDocIASZkq6ocisfwCTnYCHuogo_O-PJSuyfGWwkU'
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'hfn59n2ZF4qdGGl1kiuZ_zglStMTBIqN0CxC49jXUMc'

// Configure web-push
webpush.setVapidDetails(
  'mailto:support@msecconnect.edu',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
)

// Subscribe to push notifications (status -> active)
router.post('/subscribe', async (req, res) => {
  try {
    const { subscription, userEmail } = req.body

    if (!subscription || !userEmail) {
      return res.status(400).json({ 
        success: false, 
        message: 'Subscription and userEmail are required'
      })
    }

    const result = await storePushSubscription(subscription, userEmail)

    if (result.success) {
      // Welcome ping (best-effort)
      try {
        await webpush.sendNotification(
          subscription,
          JSON.stringify({
            title: 'MSEC Connect',
            body: '🔔 Notifications enabled! You will receive updates here.',
            icon: '/images/android-chrome-192x192.png',
            badge: '/images/favicon-32x32.png',
            tag: 'welcome',
            data: { url: '/' }
          })
        )
      } catch {}

      res.json({ success: true, message: 'Subscription active' })
    } else {
      res.status(500).json({ success: false, message: 'Failed to store subscription' })
    }
  } catch (error) {
    console.error('Subscribe error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// Deactivate subscription(s) during logout (status -> expired)
router.post('/deactivate', async (req, res) => {
  try {
    const { endpoint, userEmail } = req.body

    if (!userEmail) {
      return res.status(400).json({ success: false, message: 'userEmail is required' })
    }

    const mongoose = await connectToDatabase()
    const db = mongoose.connection.db
    const collection = db.collection('push_subscriptions')

    const filter = endpoint ? { userEmail, 'subscription.endpoint': endpoint } : { userEmail }

    const result = await collection.updateMany(
      filter,
      { $set: { active: false, status: 'expired', statusUpdatedAt: new Date(), deactivatedAt: new Date(), deactivatedReason: 'user_logout' } }
    )

    return res.json({ success: true, modified: result.modifiedCount })
  } catch (error) {
    console.error('Deactivate subscription error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// Unsubscribe from push notifications (specific endpoint -> expired)
router.post('/unsubscribe', async (req, res) => {
  try {
    const { endpoint, userEmail } = req.body

    if (!endpoint || !userEmail) {
      return res.status(400).json({ success: false, message: 'Endpoint and userEmail are required' })
    }

    await removePushSubscription(endpoint, userEmail)

    res.json({ success: true, message: 'Unsubscribed (expired) successfully' })
  } catch (error) {
    console.error('Unsubscribe error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// Send notification to specific user (only active status)
router.post('/send', async (req, res) => {
  try {
    const { userEmail, title, body, url, icon, badge } = req.body

    if (!userEmail || !title || !body) {
      return res.status(400).json({ success: false, message: 'userEmail, title, and body are required' })
    }

    // Get user's subscriptions
    const { subscriptions } = await getUserSubscriptions(userEmail)

    const activeSubs = (subscriptions || []).filter(s => s.active === true || s.status === 'active')
    if (activeSubs.length === 0) {
      return res.status(404).json({ success: false, message: 'No active subscriptions found for this user' })
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: icon || '/images/android-chrome-192x192.png',
      badge: badge || '/images/favicon-32x32.png',
      tag: 'msec-notification',
      data: { url: url || '/' }
    })

    const promises = activeSubs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub.subscription, payload)
        return { success: true, endpoint: sub.subscription.endpoint }
      } catch (error) {
        // Expire invalid subscriptions
        if (error.statusCode === 410 || error.statusCode === 404) {
          await removePushSubscription(sub.subscription.endpoint, userEmail)
        }
        return { success: false, endpoint: sub.subscription.endpoint, error: error.message }
      }
    })

    const results = await Promise.all(promises)

    // Store notification in database
    await storeNotification({ userEmail, title, body, url, icon, badge })

    res.json({ success: true, message: 'Notifications sent', results })
  } catch (error) {
    console.error('Send notification error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// Broadcast notification to all users (only active status)
router.post('/broadcast', async (req, res) => {
  try {
    const { title, body, url, icon, badge } = req.body

    if (!title || !body) {
      return res.status(400).json({ success: false, message: 'title and body are required' })
    }

    const { subscriptions } = await getAllActiveSubscriptions()
    const activeSubs = (subscriptions || []).filter(s => s.active === true || s.status === 'active')

    if (!activeSubs || activeSubs.length === 0) {
      return res.status(404).json({ success: false, message: 'No active subscriptions found' })
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: icon || '/images/android-chrome-192x192.png',
      badge: badge || '/images/favicon-32x32.png',
      tag: 'msec-broadcast',
      data: { url: url || '/' }
    })

    const promises = activeSubs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub.subscription, payload)
        await storeNotification({ userEmail: sub.userEmail, title, body, url, icon, badge, broadcast: true })
        return { success: true }
      } catch (error) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          await removePushSubscription(sub.subscription.endpoint, sub.userEmail)
        }
        return { success: false, error: error.message }
      }
    })

    const results = await Promise.all(promises)
    const successCount = results.filter(r => r.success).length

    res.json({ success: true, message: `Broadcast sent to ${successCount} of ${activeSubs.length} subscribers`, results })
  } catch (error) {
    console.error('Broadcast error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// Get user's notifications
router.get('/user/:email', async (req, res) => {
  try {
    const { email } = req.params
    const limit = parseInt(req.query.limit) || 50

    const result = await getUserNotifications(email, limit)

    if (result.success) {
      res.json({ 
        success: true, 
        notifications: result.notifications 
      })
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to get notifications' 
      })
    }
  } catch (error) {
    console.error('Get notifications error:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    })
  }
})

// Mark notification as read
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params

    const result = await markNotificationAsRead(id)

    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Notification marked as read' 
      })
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to mark notification as read' 
      })
    }
  } catch (error) {
    console.error('Mark as read error:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    })
  }
})

// Get VAPID public key
router.get('/vapid-public-key', (req, res) => {
  res.json({ success: true, publicKey: VAPID_PUBLIC_KEY })
})

// Get notifications for a user (query param)
router.get('/', async (req, res) => {
  try {
    const { userEmail } = req.query
    const limit = parseInt(req.query.limit) || 50

    if (!userEmail) {
      return res.status(400).json({ success: false, message: 'userEmail is required' })
    }

    const result = await getUserNotifications(userEmail, limit)

    if (result.success) {
      res.json({ 
        success: true, 
        notifications: result.notifications 
      })
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to get notifications' 
      })
    }
  } catch (error) {
    console.error('Get notifications error:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    })
  }
})

// Approve or reject staff account request
router.post('/approve-staff', async (req, res) => {
  try {
    const { notificationId, staffId, approved } = req.body

    if (!notificationId || !staffId || approved === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'notificationId, staffId, and approved are required' 
      })
    }

    const mongoose = await connectToDatabase()
    const db = mongoose.connection.db
    const ObjectId = (await import('mongodb')).ObjectId

    // Get the notification to find staff email
    const notifCollection = db.collection('notifications')
    const hodNotification = await notifCollection.findOne({ _id: new ObjectId(notificationId) })
    
    if (!hodNotification) {
      return res.status(404).json({ success: false, message: 'Notification not found' })
    }

    const staffEmail = hodNotification.data?.staffEmail

    // Update HOD's notification status
    await notifCollection.updateOne(
      { _id: new ObjectId(notificationId) },
      { 
        $set: { 
          'data.status': approved ? 'approved' : 'rejected',
          'data.processedAt': new Date(),
          read: true,
          readAt: new Date()
        } 
      }
    )

    // Update staff's own notification
    if (staffEmail) {
      await notifCollection.updateOne(
        { 
          userEmail: staffEmail,
          type: 'staff_account_request',
          'data.staffEmail': staffEmail
        },
        { 
          $set: { 
            'data.status': approved ? 'approved' : 'rejected',
            'data.processedAt': new Date(),
            title: approved ? 'Account Approved' : 'Account Rejected',
            body: approved 
              ? 'Your staff account has been approved by HOD' 
              : 'Your staff account request was rejected',
            read: false  // Keep unread so staff sees the update
          } 
        }
      )
    }

    if (!approved) {
      // Delete the staff account
      const usersCollection = db.collection('users')
      await usersCollection.deleteOne({ _id: new ObjectId(staffId) })
    }

    res.json({ 
      success: true, 
      message: approved ? 'Staff account approved' : 'Staff account rejected' 
    })
  } catch (error) {
    console.error('Approve/reject staff error:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    })
  }
})

export default router
