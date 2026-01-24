import { ObjectId } from 'mongodb'
import { connectToDatabase } from '../lib/mongo.js'

// Helper to map boolean active to status string for backwards compatibility
function computeStatusFromActive(active) {
	return active ? 'active' : 'expired'
}

async function normalizeStatuses(collection) {
	// Set status based on active where missing or inconsistent
	await collection.updateMany(
		{ $or: [ { status: { $exists: false } }, { status: null } ] },
		[ { $set: { status: { $cond: [ '$active', 'active', 'expired' ] }, statusUpdatedAt: new Date() } } ]
	)
}

// Store push subscription
export async function storePushSubscription(subscription, userEmail) {
	const mongoose = await connectToDatabase()
	const db = mongoose.connection.db
	const collection = db.collection('push_subscriptions')

	try {
		console.log(`📝 Storing subscription for ${userEmail}`)
		console.log(`🔗 Endpoint: ${subscription.endpoint.substring(0, 50)}...`)

		// Normalize existing docs to have status
		await normalizeStatuses(collection)

		// CRITICAL: First, deactivate ALL subscriptions for ALL users with this endpoint
		// This ensures no endpoint is active for multiple users
		const existingByEndpoint = await collection.find({
			'subscription.endpoint': subscription.endpoint
		}).toArray()

		if (existingByEndpoint.length > 0) {
			console.log(`🔄 Found ${existingByEndpoint.length} existing subscription(s) for this endpoint`)

			// Deactivate ALL existing subscriptions for this endpoint (across all users)
			await collection.updateMany(
				{ 'subscription.endpoint': subscription.endpoint },
				{
					$set: {
						active: false,
						status: 'expired',
						deactivatedAt: new Date(),
						statusUpdatedAt: new Date(),
						deactivatedReason: 'endpoint_reassigned'
					}
				}
			)

			console.log(`✅ Deactivated all existing subscriptions for this endpoint`)
		}

		// Now deactivate ALL existing subscriptions for this specific user
		// This ensures each user has at most one active subscription
		await collection.updateMany(
			{ userEmail },
			{
				$set: {
					active: false,
					status: 'expired',
					deactivatedAt: new Date(),
					statusUpdatedAt: new Date(),
					deactivatedReason: 'new_subscription_created'
				}
			}
		)

		// Store the new subscription as active
		const result = await collection.insertOne({
			userEmail,
			subscription,
			createdAt: new Date(),
			updatedAt: new Date(),
			active: true,
			status: 'active',
			statusUpdatedAt: new Date()
		})

		console.log(`✅ New subscription created for ${userEmail}`)
		return { success: true, created: true, id: result.insertedId }
	} catch (error) {
		console.error('❌ Error storing push subscription:', error)
		return { success: false, error: error.message }
	}
}

// Remove push subscription (now marks expired instead of deleting)
export async function removePushSubscription(endpoint, userEmail) {
	const mongoose = await connectToDatabase()
	const db = mongoose.connection.db
	const collection = db.collection('push_subscriptions')

	try {
		const res = await collection.updateOne({
			userEmail,
			'subscription.endpoint': endpoint
		}, {
			$set: {
				active: false,
				status: 'expired',
				deactivatedAt: new Date(),
				statusUpdatedAt: new Date(),
				deactivatedReason: 'user_unsubscribe'
			}
		})

		if (res.matchedCount === 0) {
			// fallback to delete if no match
			await collection.deleteOne({ userEmail, 'subscription.endpoint': endpoint })
		}

		return { success: true }
	} catch (error) {
		console.error('Error removing push subscription:', error)
		return { success: false, error: error.message }
	}
}

// Get all active subscriptions for a user
export async function getUserSubscriptions(userEmail) {
	const mongoose = await connectToDatabase()
	const db = mongoose.connection.db
	const collection = db.collection('push_subscriptions')

	try {
		console.log(`🔍 Looking for active subscriptions for: ${userEmail}`)

		// Normalize statuses before querying
		await normalizeStatuses(collection);

		// First ensure subscription integrity
		await ensureSubscriptionIntegrity(collection);

		// CRITICAL FIX: First clean up duplicate and stale subscriptions
		await cleanupSubscriptions(collection);

		// Now get the user's active subscriptions (after cleanup)
		const subscriptions = await collection
			.find({
				userEmail,
				$or: [ { active: true }, { status: 'active' } ]
			})
			.toArray()

		console.log(`📱 Found ${subscriptions.length} active subscription(s) for ${userEmail}`)

		return { success: true, subscriptions }
	} catch (error) {
		console.error('❌ Error getting user subscriptions:', error);
		return { success: false, error: error.message, subscriptions: [] };
	}
}


// Utility function to ensure subscription integrity - no endpoint active for multiple users
async function ensureSubscriptionIntegrity(collection) {
	try {
		console.log('🔒 Ensuring subscription integrity...')

		// Normalize statuses first
		await normalizeStatuses(collection)

		// Get all active subscriptions (by status or flag)
		const activeSubscriptions = await collection.find({ $or: [ { active: true }, { status: 'active' } ] }).toArray();

		// Group by endpoint
		const endpointGroups = {};
		activeSubscriptions.forEach(sub => {
			const endpoint = sub.subscription.endpoint;
			if (!endpointGroups[endpoint]) {
				endpointGroups[endpoint] = [];
			}
			endpointGroups[endpoint].push(sub);
		});

		let integrityIssues = 0;

		// Check each endpoint group
		for (const [endpoint, subscriptions] of Object.entries(endpointGroups)) {
			if (subscriptions.length > 1) {
				console.log(`⚠️  Endpoint ${endpoint.substring(0, 50)}... has ${subscriptions.length} active subscriptions!`);

				// Sort by creation/update time, keep the most recent
				subscriptions.sort((a, b) => {
					const aTime = a.updatedAt || a.createdAt || new Date(0);
					const bTime = b.updatedAt || b.createdAt || new Date(0);
					return bTime - aTime;
				});

				const keepActive = subscriptions[0];
				const toDeactivate = subscriptions.slice(1);

				console.log(`   ✅ Keeping active for: ${keepActive.userEmail}`);
				console.log(`   ❌ Deactivating ${toDeactivate.length} others`);

				for (const sub of toDeactivate) {
					await collection.updateOne(
						{ _id: sub._id },
						{
							$set: {
								active: false,
								status: 'expired',
								statusUpdatedAt: new Date(),
								deactivatedAt: new Date(),
								deactivatedReason: 'integrity_fix_multiple_active'
							}
						}
					);
					integrityIssues++;
				}
			}
		}

		if (integrityIssues > 0) {
			console.log(`🔧 Fixed ${integrityIssues} subscription integrity issues`);
		} else {
			console.log('✅ Subscription integrity OK');
		}

		return true;
	} catch (error) {
		console.error('❌ Error ensuring subscription integrity:', error);
		return false;
	}
}

// Utility function to clean up duplicate and stale subscriptions
async function cleanupSubscriptions(collection) {
	try {
		// Get all subscriptions
		const allSubscriptions = await collection.find({}).toArray();
		
		// Find duplicate endpoints assigned to different users
		const endpoints = new Map(); // Map from endpoint to subscription
		const duplicateEndpoints = new Set();
		
		allSubscriptions.forEach(sub => {
			const endpoint = sub.subscription.endpoint;
			if (endpoints.has(endpoint)) {
				duplicateEndpoints.add(endpoint);
			} else {
				endpoints.set(endpoint, sub);
			}
		});
		
		// If we found duplicates, clean them up
		if (duplicateEndpoints.size > 0) {
			console.log(`⚠️ Found ${duplicateEndpoints.size} duplicate subscription endpoints - cleaning up...`);
			
			for (const endpoint of duplicateEndpoints) {
				// Find all subscriptions with this endpoint
				const subs = allSubscriptions.filter(sub => sub.subscription.endpoint === endpoint);
				
				// First check if any are active
				const activeSubs = subs.filter(sub => sub.active === true || sub.status === 'active');
				
				if (activeSubs.length > 1) {
					// Multiple active subs with same endpoint - keep only the most recent
					activeSubs.sort((a, b) => {
						const aDate = a.updatedAt || a.createdAt;
						const bDate = b.updatedAt || b.createdAt;
						return bDate - aDate;
					});
					
					const mostRecent = activeSubs[0];
					console.log(`✅ Keeping active subscription for ${mostRecent.userEmail} (most recent)`);
					
					// Deactivate all others
					for (let i = 1; i < activeSubs.length; i++) {
						const oldSub = activeSubs[i];
						console.log(`❌ Deactivating duplicate active subscription for ${oldSub.userEmail}`);
						await collection.updateOne(
							{ _id: oldSub._id },
							{ 
								$set: { 
									active: false,
									status: 'expired',
									statusUpdatedAt: new Date(),
									deactivatedAt: new Date(),
									deactivatedReason: 'duplicate_endpoint_cleanup'
								} 
							} 
						);
					}
				} else if (activeSubs.length === 0 && subs.length > 0) {
					// No active subs for this endpoint, but we have multiple inactive ones
					console.log(`ℹ️ Found ${subs.length} inactive subscriptions for endpoint - leaving as is`);
				}
			}
		}
		
		return true;
	} catch (error) {
		console.error('❌ Error cleaning up subscriptions:', error);
		return false;
	}
}

// Get all active subscriptions (for broadcasting)
export async function getAllActiveSubscriptions() {
	const mongoose = await connectToDatabase()
	const db = mongoose.connection.db
	const collection = db.collection('push_subscriptions')

	try {
		// Normalize and ensure integrity
		await normalizeStatuses(collection);
		await ensureSubscriptionIntegrity(collection);

		// First clean up any duplicate/stale subscriptions
		await cleanupSubscriptions(collection);

		const subscriptions = await collection
			.find({ $or: [ { active: true }, { status: 'active' } ] })
			.toArray()

		return { success: true, subscriptions }
	} catch (error) {
		console.error('Error getting all subscriptions:', error)
		return { success: false, error: error.message }
	}
}

// Store notification in database
export async function storeNotification(notification) {
	const mongoose = await connectToDatabase()
	const db = mongoose.connection.db
	const collection = db.collection('notifications')

	try {
		const result = await collection.insertOne({
			...notification,
			createdAt: new Date(),
			read: false
		})

		return { success: true, id: result.insertedId }
	} catch (error) {
		console.error('Error storing notification:', error)
		return { success: false, error: error.message }
	}
}

// Get notifications for a user
export async function getUserNotifications(userEmail, limit = 50) {
	const mongoose = await connectToDatabase()
	const db = mongoose.connection.db
	const collection = db.collection('notifications')

	try {
		const notifications = await collection
			.find({ userEmail })
			.sort({ createdAt: -1 })
			.limit(limit)
			.toArray()

		return { success: true, notifications }
	} catch (error) {
		console.error('Error getting notifications:', error)
		return { success: false, error: error.message }
	}
}

// Mark notification as read
export async function markNotificationAsRead(notificationId) {
	const mongoose = await connectToDatabase()
	const db = mongoose.connection.db
	const collection = db.collection('notifications')

	try {
		await collection.updateOne(
			{ _id: new ObjectId(notificationId) },
			{ $set: { read: true, readAt: new Date() } }
		)

		return { success: true }
	} catch (error) {
		console.error('Error marking notification as read:', error)
		return { success: false, error: error.message }
	}
}
