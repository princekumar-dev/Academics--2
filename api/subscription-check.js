import { connectToDatabase } from '../lib/mongo.js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    await connectToDatabase()
    
    const { endpoint } = req.body

    if (!endpoint) {
      return res.status(400).json({ success: false, error: 'Endpoint is required' })
    }

    const mongoose = await connectToDatabase()
    const collection = mongoose.connection.db.collection('push_subscriptions')

    const subscription = await collection.findOne({
      'subscription.endpoint': endpoint
    })

    if (!subscription) {
      return res.status(200).json({ success: true, found: false })
    }

    return res.status(200).json({
      success: true,
      found: true,
      userEmail: subscription.userEmail,
      active: subscription.active ?? subscription.status === 'active'
    })

  } catch (error) {
    console.error('Subscription check error:', error)
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to check subscription status' 
    })
  }
}
