import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { supabase } from '@/lib/supabase';

/** Android channel for new-report alerts; the server sends with this channelId */
export const SOS_CHANNEL = 'sos';

// Show alerts while the app is open too
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let registeredToken: string | null = null;

/**
 * Saves this phone's Expo push token for the signed-in user. Quietly does nothing where push
 * cannot work: emulators, Expo Go on Android (needs a development build), no EAS project yet,
 * or permission declined. The server decides who is alerted (volunteers and admins).
 */
export async function registerForPush(userId: string): Promise<void> {
  try {
    if (!Device.isDevice) return;

    // Android 13+ needs the channel before the permission prompt appears
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(SOS_CHANNEL, {
        name: 'New SOS reports',
        importance: AndroidImportance.HIGH,
      });
    }

    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== 'granted' && current.canAskAgain) status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    registeredToken = token;
    await supabase.from('push_tokens').upsert(
      { token, user_id: userId, platform: Platform.OS === 'ios' ? 'ios' : 'android', updated_at: new Date().toISOString() },
      { onConflict: 'token' }
    );
  } catch (e) {
    // Push is a bonus; the app works without it
    console.warn('Push registration skipped:', e instanceof Error ? e.message : e);
  }
}

/** Call before signing out, so the next person on this phone does not get the last user's alerts */
export async function unregisterPush(): Promise<void> {
  if (!registeredToken) return;
  try {
    await supabase.from('push_tokens').delete().eq('token', registeredToken);
  } catch {
    // Server drops dead tokens on its own when Expo reports them
  }
  registeredToken = null;
}
