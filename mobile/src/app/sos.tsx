import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { CheckCircle2, Clock, MapPin, RotateCcw, X } from 'lucide-react-native';
import { generateCaseId } from '@shared/geo';
import AuthSheet from '@/components/AuthSheet';
import { AppText, Button } from '@/components/ui';
import { API_BASE, supabase } from '@/lib/supabase';
import { useDeviceLocation } from '@/lib/useDeviceLocation';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, size, type as typeScale } from '@/theme/tokens';

type Animal = 'dog' | 'cat' | 'other';
type Emergency = 'hit_and_run' | 'fracture' | 'sick_mange';

// Same options as web SOS
const EMERGENCIES: { id: Emergency; label: string; urgency: 'critical' | 'urgent' | 'moderate'; urgencyLabel: string }[] = [
  { id: 'hit_and_run', label: 'Hit & Run / Bleeding', urgency: 'critical', urgencyLabel: 'Critical' },
  { id: 'fracture', label: 'Fracture / Trapped', urgency: 'urgent', urgencyLabel: 'Urgent' },
  { id: 'sick_mange', label: 'Sick / Severe Mange', urgency: 'moderate', urgencyLabel: 'Moderate' },
];

type Photo = { uri: string; format: 'webp' | 'jpeg' };
type Sent = { shortId: string; time: string; lat: number; lng: number };

export default function SosScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [permission, requestPermission] = useCameraPermissions();
  const location = useDeviceLocation({ autoStart: true, watch: true });

  const cameraRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [animal, setAnimal] = useState<Animal>('dog');
  const [emergency, setEmergency] = useState<Emergency>('hit_and_run');
  const [street, setStreet] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const lookedUp = useRef<{ lat: number; lng: number } | null>(null);

  // Shutter flash: the only motion allowed on the camera screen
  const flash = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.get() }));

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Street name once per ~50 m move, from the same lookup the web app uses
  const coords = location.coords;
  useEffect(() => {
    if (!coords) return;
    const last = lookedUp.current;
    if (last && Math.abs(last.lat - coords.lat) < 0.0005 && Math.abs(last.lng - coords.lng) < 0.0005) return;
    lookedUp.current = { lat: coords.lat, lng: coords.lng };
    fetch(`${API_BASE}/api/geocode/reverse?lat=${coords.lat}&lng=${coords.lng}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.formatted) {
          setAddress(data.formatted);
          setStreet((prev) => prev || data.formatted);
        }
      })
      .catch(() => {});
  }, [coords]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const takePhoto = async () => {
    if (!cameraRef.current || !cameraReady || capturing) return;
    setCapturing(true);
    setError(null);
    if (!reduceMotion) flash.set(withSequence(withTiming(0.9, { duration: 40 }), withTiming(0, { duration: 160 })));
    try {
      const shot = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      // Compress before upload: 1280 px wide, WebP on Android, JPEG on iOS
      const format = Platform.OS === 'android' ? SaveFormat.WEBP : SaveFormat.JPEG;
      const rendered = await ImageManipulator.manipulate(shot.uri, { maxWidth: 1280 }).renderAsync();
      const saved = await rendered.saveAsync({ format, compress: 0.7 });
      setPhoto({ uri: saved.uri, format: format === SaveFormat.WEBP ? 'webp' : 'jpeg' });
    } catch {
      setError('Could not take the photo. Try again.');
    } finally {
      setCapturing(false);
    }
  };

  const dispatch = async () => {
    if (!photo) return;
    // A report without a real GPS fix would send responders to the wrong place
    if (!coords) {
      setError(
        location.status === 'denied'
          ? 'Location is blocked. Allow it for KupKop in your phone settings, then tap Update GPS.'
          : 'Still finding your location. Wait for the GPS lock, then send.'
      );
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setAuthOpen(true);
      return;
    }

    setSending(true);
    setError(null);
    try {
      const userId = session.user.id;
      let shortId = generateCaseId();
      const tier = EMERGENCIES.find((e) => e.id === emergency) ?? EMERGENCIES[0];

      const ext = photo.format === 'webp' ? 'webp' : 'jpg';
      const path = `${userId}/${Date.now()}-${shortId}.${ext}`;
      const bytes = await new File(photo.uri).arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from('live-snaps')
        .upload(path, bytes, { contentType: `image/${photo.format}`, upsert: false });
      if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);
      const {
        data: { publicUrl },
      } = supabase.storage.from('live-snaps').getPublicUrl(path);

      const payload: Record<string, unknown> = {
        reporter_id: userId,
        animal_type: animal,
        emergency_type: emergency,
        urgency: tier.urgency,
        photo_url: publicUrl,
        latitude: coords.lat,
        longitude: coords.lng,
        location_name: street.trim() || address || `Near ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
      };
      if (description.trim()) payload.description = description.trim();

      // Case IDs are 4 random characters; on a clash draw a new one and resend (server sets the timestamp)
      let res = await supabase.from('sos_reports').insert({ ...payload, short_id: shortId });
      for (let retries = 0; retries < 3 && res.error?.code === '23505' && res.error.message?.includes('short_id'); retries++) {
        shortId = generateCaseId();
        res = await supabase.from('sos_reports').insert({ ...payload, short_id: shortId });
      }
      if (res.error) throw new Error(`Could not send the report: ${res.error.message}`);

      setSent({
        shortId,
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        lat: coords.lat,
        lng: coords.lng,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Emergency dispatch failed. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // ---------- Sent ----------
  if (sent) {
    return (
      <ScrollView contentContainerStyle={[styles.center, { paddingBottom: insets.bottom + 24 }]}>
        <View style={[styles.successIcon, { backgroundColor: colors.resolvedBg }]}>
          <CheckCircle2 size={32} color={colors.resolvedFg} />
        </View>
        <AppText variant="display" accessibilityRole="header" style={{ textAlign: 'center' }}>
          Report sent
        </AppText>
        <AppText tone="fgMuted" style={{ textAlign: 'center' }}>
          Nearby volunteers can see it now. Stay at a safe distance if you can.
        </AppText>
        <View style={[styles.summary, { borderColor: colors.border }]}>
          <Row label="Case ID" value={sent.shortId} />
          <Row label="Sent at" value={sent.time} />
          <Row label="Location" value={`${sent.lat.toFixed(5)}, ${sent.lng.toFixed(5)}`} />
        </View>
        <Button label="Ask Rafa for first aid" onPress={() => router.replace('/rafa')} style={{ alignSelf: 'stretch' }} />
        <Button kind="secondary" label="Back to feed" onPress={() => router.replace('/')} style={{ alignSelf: 'stretch' }} />
      </ScrollView>
    );
  }

  // ---------- Review ----------
  if (photo) {
    const gpsLine = address
      ? address
      : coords
        ? `${coords.lat.toFixed(4)}°, ${coords.lng.toFixed(4)}°`
        : location.status === 'denied'
          ? 'Location blocked'
          : location.status === 'off'
            ? 'Phone location is off'
            : 'Finding your location…';

    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
          <View style={styles.reviewHead}>
            <AppText variant="display" accessibilityRole="header">
              Check and send
            </AppText>
            <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Cancel report" style={[styles.iconBtn, { backgroundColor: colors.surfaceMuted }]}>
              <X size={18} color={colors.fg} />
            </Pressable>
          </View>

          <Image source={{ uri: photo.uri }} style={[styles.preview, { backgroundColor: colors.surfaceMuted }]} contentFit="cover" accessibilityLabel="Your photo" />

          <View style={[styles.gpsRow, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <MapPin size={16} color={colors.fgMuted} />
            <View style={{ flex: 1 }}>
              <AppText bold tone={coords ? 'fg' : 'reportedFg'} numberOfLines={2}>
                {gpsLine}
              </AppText>
              <AppText variant="caption" tone="fgMuted">
                {coords ? `Accurate to within ${coords.accuracy} meters` : location.error ?? 'Waiting for GPS'}
              </AppText>
            </View>
            <Button kind="ghost" label="Update GPS" onPress={location.start} />
          </View>

          <View style={{ gap: 6 }}>
            <AppText variant="caption" bold tone="fgMuted">
              Animal
            </AppText>
            <View style={styles.choiceRow}>
              {(['dog', 'cat', 'other'] as const).map((a) => (
                <Choice key={a} label={a[0].toUpperCase() + a.slice(1)} selected={animal === a} onPress={() => setAnimal(a)} />
              ))}
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <AppText variant="caption" bold tone="fgMuted">
              Severity
            </AppText>
            <View style={styles.choiceRow}>
              {EMERGENCIES.map((e) => (
                <Choice
                  key={e.id}
                  label={e.label.split('/')[0].trim()}
                  sub={e.urgencyLabel}
                  subTone={e.urgency === 'critical' ? 'reportedFg' : 'fgMuted'}
                  selected={emergency === e.id}
                  onPress={() => setEmergency(e.id)}
                />
              ))}
            </View>
          </View>

          <Field label="Street or landmark" value={street} onChangeText={setStreet} placeholder="e.g. Aurora Blvd near the gas station" />
          <Field
            label="What you see (optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. Back leg bleeding, still moving"
            multiline
          />

          {error && (
            <AppText variant="caption" tone="reportedFg" accessibilityRole="alert">
              {error}
            </AppText>
          )}

          <Button
            kind="emergency"
            label={sending ? 'Sending…' : coords ? 'Send emergency report' : location.status === 'denied' ? 'Location needed to send' : 'Waiting for GPS…'}
            onPress={dispatch}
            loading={sending}
            disabled={!coords}
          />
          <Button
            kind="secondary"
            label="Retake photo"
            icon={<RotateCcw size={16} color={colors.fg} />}
            onPress={() => setPhoto(null)}
            disabled={sending}
          />
        </ScrollView>

        <AuthSheet
          visible={authOpen}
          title="Sign in to send your report"
          onClose={() => setAuthOpen(false)}
          onSignedIn={() => {
            setAuthOpen(false);
            // Send right away; the photo and choices are still here
            setTimeout(dispatch, 0);
          }}
        />
      </KeyboardAvoidingView>
    );
  }

  // ---------- Camera permission ----------
  if (!permission) return <View style={{ flex: 1, backgroundColor: colors.page }} />;
  if (!permission.granted) {
    return (
      <View style={[styles.center, { flex: 1 }]}>
        <AppText variant="display" accessibilityRole="header" style={{ textAlign: 'center' }}>
          Camera needed
        </AppText>
        <AppText tone="fgMuted" style={{ textAlign: 'center' }}>
          Reports use a live photo only, never the gallery, so responders know it&apos;s real and current.
        </AppText>
        {permission.canAskAgain ? (
          <Button label="Allow camera" onPress={requestPermission} style={{ alignSelf: 'stretch' }} />
        ) : (
          <Button label="Open phone settings" onPress={() => Linking.openSettings()} style={{ alignSelf: 'stretch' }} />
        )}
        <Button kind="secondary" label="Cancel" onPress={close} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }

  // ---------- Camera ----------
  return (
    <View style={{ flex: 1, backgroundColor: colors.camera }}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" onCameraReady={() => setCameraReady(true)} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.onScrim }, flashStyle]} />

      <View style={styles.badges}>
        <Pressable
          onPress={location.start}
          accessibilityRole="button"
          accessibilityLabel="Retry GPS"
          style={[styles.badge, { backgroundColor: colors.scrim }]}
        >
          <MapPin size={14} color={colors.onScrim} />
          <AppText variant="caption" tone="onScrim" numberOfLines={1}>
            {coords
              ? `${coords.lat.toFixed(4)}°, ${coords.lng.toFixed(4)}°`
              : location.status === 'denied'
                ? 'Location blocked'
                : location.status === 'off'
                  ? 'Location is off'
                  : 'Finding GPS…'}
          </AppText>
        </Pressable>
        <View style={[styles.badge, { backgroundColor: colors.scrim }]}>
          <Clock size={14} color={colors.onScrim} />
          <AppText variant="caption" tone="onScrim">
            {clock.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
          </AppText>
        </View>
      </View>

      <View style={[styles.cameraBottom, { paddingBottom: insets.bottom + 24 }]}>
        {error && (
          <AppText variant="caption" tone="onScrim" accessibilityRole="alert" style={{ textAlign: 'center' }}>
            {error}
          </AppText>
        )}
        <AppText tone="onScrim" style={{ textAlign: 'center' }}>
          Point at the animal and tap the button
        </AppText>
        <View style={styles.shutterRow}>
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Cancel report"
            style={[styles.iconBtn, { backgroundColor: colors.scrim }]}
          >
            <X size={20} color={colors.onScrim} />
          </Pressable>
          <Pressable
            onPress={takePhoto}
            disabled={!cameraReady || capturing}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            style={[styles.shutter, { borderColor: colors.onScrim, opacity: cameraReady ? 1 : 0.5 }]}
          >
            <View style={[styles.shutterInner, { backgroundColor: colors.accent }]} />
          </Pressable>
          <View style={styles.iconBtn} />
        </View>
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <AppText tone="fgMuted">{label}</AppText>
      <AppText bold>{value}</AppText>
    </View>
  );
}

function Choice({
  label,
  sub,
  subTone = 'fgMuted',
  selected,
  onPress,
}: {
  label: string;
  sub?: string;
  subTone?: 'fgMuted' | 'reportedFg';
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[
        styles.choice,
        { backgroundColor: selected ? colors.fg : colors.surface, borderColor: selected ? colors.fg : colors.border },
      ]}
    >
      <AppText variant="caption" bold style={{ color: selected ? colors.surface : colors.fg, textAlign: 'center' }}>
        {label}
      </AppText>
      {sub && (
        <AppText variant="caption" bold={subTone === 'reportedFg'} tone={selected ? 'surface' : subTone}>
          {sub}
        </AppText>
      )}
    </Pressable>
  );
}

function Field({
  label,
  multiline,
  ...rest
}: { label: string; multiline?: boolean } & React.ComponentProps<typeof TextInput>) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="caption" bold tone="fgMuted">
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.fgMuted}
        multiline={multiline}
        style={[
          styles.input,
          multiline && { minHeight: 88, textAlignVertical: 'top', paddingTop: 12 },
          { backgroundColor: colors.surface, borderColor: colors.border, color: colors.fg },
        ]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { padding: 24, gap: 16, alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  successIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  summary: { alignSelf: 'stretch', borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: {
    width: size.tap,
    height: size.tap,
    borderRadius: size.tap / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: { height: 220, borderRadius: radius.lg },
  gpsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: radius.md, paddingLeft: 12 },
  choiceRow: { flexDirection: 'row', gap: 8 },
  choice: {
    flex: 1,
    minHeight: size.tap,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  input: { minHeight: size.primary, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 16, fontSize: typeScale.body },
  badges: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, padding: 12 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    minHeight: size.tap,
    borderRadius: radius.full,
    maxWidth: '60%',
  },
  cameraBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 16, paddingHorizontal: 24 },
  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shutter: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 62, height: 62, borderRadius: 31 },
});
