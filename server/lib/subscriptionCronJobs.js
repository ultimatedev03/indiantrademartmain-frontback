import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import {
  sendRenewalReminder,
  markRenewalNotificationSent,
  sendExpirationWarning
} from './notificationService.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Check subscriptions expiring in 7 days and send renewal reminders
 * Runs daily at 2 AM UTC
 */
function checkExpiringSubscriptions() {
  return cron.schedule('0 2 * * *', async () => {
    console.log('🔍 Starting subscription expiration check...');
    
    try {
      // Calculate date range: 7 days from now
      const today = new Date();
      const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

      // Find subscriptions expiring in exactly 7 days (within 24 hours)
      // that haven't had renewal notification sent yet
      const { data: expiringSubscriptions, error } = await supabase
        .from('vendor_plan_subscriptions')
        .select(`
          id,
          vendor_id,
          end_date,
          status,
          plan_id,
          renewal_notification_sent,
          vendor_plans!inner(name)
        `)
        .eq('status', 'ACTIVE')
        .eq('renewal_notification_sent', false)
        .gte('end_date', tomorrow.toISOString())
        .lte('end_date', sevenDaysFromNow.toISOString());

      if (error) {
        console.error('Error fetching expiring subscriptions:', error);
        return;
      }

      if (!expiringSubscriptions || expiringSubscriptions.length === 0) {
        console.log('✅ No subscriptions expiring in 7 days');
        return;
      }

      console.log(`Found ${expiringSubscriptions.length} subscriptions expiring in 7 days`);

      // Send renewal reminders for each expiring subscription
      for (const subscription of expiringSubscriptions) {
        const planName = subscription.vendor_plans?.name || 'Your subscription';
        const expiryDate = subscription.end_date;

        // Send notification
        await sendRenewalReminder(subscription.vendor_id, planName, expiryDate);

        // Mark as notification sent
        await markRenewalNotificationSent(subscription.id);
      }

      console.log(`✅ Sent ${expiringSubscriptions.length} renewal reminder notifications`);
    } catch (error) {
      console.error('Error in checkExpiringSubscriptions:', error);
    }
  });
}

/**
 * Check for already expired subscriptions and send warnings
 * Runs daily at 3 AM UTC (1 hour after renewal reminders)
 */
function checkExpiredSubscriptions() {
  return cron.schedule('0 3 * * *', async () => {
    console.log('⏰ Starting expired subscription check...');
    
    try {
      const today = new Date();

      // Find subscriptions that have expired
      const { data: expiredSubscriptions, error } = await supabase
        .from('vendor_plan_subscriptions')
        .select(`
          id,
          vendor_id,
          end_date,
          status,
          plan_id,
          vendor_plans!inner(name)
        `)
        .eq('status', 'ACTIVE')
        .lt('end_date', today.toISOString());

      if (error) {
        console.error('Error fetching expired subscriptions:', error);
        return;
      }

      if (!expiredSubscriptions || expiredSubscriptions.length === 0) {
        console.log('✅ No expired subscriptions found');
        return;
      }

      console.log(`Found ${expiredSubscriptions.length} expired subscriptions`);

      // Send expiration warnings and mark as expired
      for (const subscription of expiredSubscriptions) {
        const planName = subscription.vendor_plans?.name || 'Your subscription';

        // Send warning notification
        await sendExpirationWarning(subscription.vendor_id, planName);

        // Update subscription status to expired
        const { error: updateError } = await supabase
          .from('vendor_plan_subscriptions')
          .update({ status: 'EXPIRED' })
          .eq('id', subscription.id);

        if (updateError) {
          console.error(`Error updating subscription ${subscription.id}:`, updateError);
          continue;
        }

        // Update vendor lead quota to disable access
        await updateVendorLeadQuotaOnExpiry(subscription.vendor_id);
      }

      console.log(`✅ Processed ${expiredSubscriptions.length} expired subscriptions`);
    } catch (error) {
      console.error('Error in checkExpiredSubscriptions:', error);
    }
  });
}

/**
 * Disable lead access when subscription expires
 * Sets all quotas to 0 and marks as inactive
 */
async function updateVendorLeadQuotaOnExpiry(vendorId) {
  try {
    const { error } = await supabase
      .from('vendor_lead_quota')
      .update({
        daily_used: 0,
        daily_limit: 0,
        weekly_used: 0,
        weekly_limit: 0,
        yearly_used: 0,
        yearly_limit: 0,
        updated_at: new Date().toISOString()
      })
      .eq('vendor_id', vendorId);

    if (error) {
      console.error(`Error updating quota for vendor ${vendorId}:`, error);
      return false;
    }

    console.log(`Lead quota reset for vendor ${vendorId}`);
    return true;
  } catch (error) {
    console.error('Error in updateVendorLeadQuotaOnExpiry:', error);
    return false;
  }
}

/**
 * Initialize all subscription-related cron jobs
 */
export function initializeSubscriptionCronJobs() {
  try {
    console.log('🚀 Initializing subscription cron jobs...');
    
    checkExpiringSubscriptions();
    checkExpiredSubscriptions();
    
    console.log('✅ Subscription cron jobs initialized');
    console.log('   - Expiring subscriptions check: Daily at 2 AM UTC');
    console.log('   - Expired subscriptions check: Daily at 3 AM UTC');
  } catch (error) {
    console.error('Error initializing subscription cron jobs:', error);
  }
}

/**
 * Get summary of upcoming subscription expirations
 * For admin monitoring dashboard
 */
export async function getSubscriptionExpirationSummary() {
  try {
    const today = new Date();
    const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Count subscriptions expiring in 7 days
    const { data: expiringSoon, count: expiringSoonCount } = await supabase
      .from('vendor_plan_subscriptions')
      .select('id', { count: 'exact' })
      .eq('status', 'ACTIVE')
      .gte('end_date', today.toISOString())
      .lte('end_date', sevenDaysFromNow.toISOString());

    // Count subscriptions expiring in 30 days
    const { data: expiringMonth, count: expiringMonthCount } = await supabase
      .from('vendor_plan_subscriptions')
      .select('id', { count: 'exact' })
      .eq('status', 'ACTIVE')
      .gte('end_date', today.toISOString())
      .lte('end_date', thirtyDaysFromNow.toISOString());

    // Count already expired
    const { data: expired, count: expiredCount } = await supabase
      .from('vendor_plan_subscriptions')
      .select('id', { count: 'exact' })
      .eq('status', 'EXPIRED');

    return {
      expiring_in_7_days: expiringSoonCount || 0,
      expiring_in_30_days: expiringMonthCount || 0,
      already_expired: expiredCount || 0
    };
  } catch (error) {
    console.error('Error getting subscription expiration summary:', error);
    return {
      expiring_in_7_days: 0,
      expiring_in_30_days: 0,
      already_expired: 0
    };
  }
}
