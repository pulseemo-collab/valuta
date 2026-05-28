import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { C, GRADIENTS } from '@/constants/colors';
import { signUp, toAlbanianError } from '@/lib/auth';
import { supabaseConfigMissing } from '@/lib/supabase';
import { useTranslation } from '@/lib/i18n';

export default function Register() {
  const { t, lang } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    // Show immediately on native if Supabase env vars were not baked into the build
    () => supabaseConfigMissing && Platform.OS !== 'web'
      ? 'Konfigurimi i Supabase mungon në build-in Android.'
      : ''
  );
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleRegister = async () => {
    setError('');

    if (!email.trim() || !password) {
      setError(t('authFillFields'));
      return;
    }
    if (password.length < 6) {
      setError(lang === 'en' ? 'Password must be at least 6 characters.' : 'Fjalëkalimi duhet të ketë të paktën 6 karaktere.');
      return;
    }

    setLoading(true);
    try {
      const data = await signUp(email.trim(), password, name.trim() || undefined);

      if (!data.session) {
        // Email confirmation required
        setSuccess(true);
      }
      // If session exists, AuthGuard will redirect via SIGNED_IN event
    } catch (e: any) {
      console.error('[Register] catch:', JSON.stringify({ message: e?.message, code: e?.code, status: e?.status, name: e?.name }));
      setError(toAlbanianError(e?.message ?? '', e?.code));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <LinearGradient colors={GRADIENTS.hero} style={styles.root}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.successOuter}>
            <View style={styles.inner}>
              <View style={styles.glassCard}>
                <View style={styles.successContainer}>
                  <View style={styles.successIconWrap}>
                    <LinearGradient
                      colors={GRADIENTS.emeraldBlue}
                      style={styles.successIcon}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Ionicons name="mail-unread-outline" size={36} color={C.white} />
                    </LinearGradient>
                  </View>
                  <Text style={styles.successTitle}>{t('authCheckEmail')}</Text>
                  <Text style={styles.successDesc}>
                    {lang === 'en' ? 'We sent a confirmation link to' : 'Të dërguam një link konfirmimi tek'}{'\n'}
                    <Text style={styles.successEmail}>{email.trim()}</Text>
                    {'\n\n'}{t('authConfirmSent')}
                  </Text>
                  <TouchableOpacity
                    style={styles.backToLoginBtn}
                    onPress={() => router.replace('/(auth)/login')}
                  >
                    <Text style={styles.backToLoginText}>{t('authBackToLogin')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={GRADIENTS.hero} style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.inner}>
              <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                  <Ionicons name="chevron-back" size={22} color={C.textSub} />
                </TouchableOpacity>
              </View>

              <View style={styles.glassCard}>
                <View style={styles.titleSection}>
                  <LinearGradient
                    colors={GRADIENTS.emeraldBlue}
                    style={styles.logoBox}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.logoLetter}>V</Text>
                  </LinearGradient>
                  <Text style={styles.title}>{t('authRegTitle')}</Text>
                  <Text style={styles.subtitle}>{t('authRegSub')}</Text>
                </View>

                <View style={styles.form}>
                  <Input
                    label={t('authFullName')}
                    placeholder="Andi Kelmendi"
                    value={name}
                    onChangeText={(v) => { setName(v); setError(''); }}
                    autoCapitalize="words"
                    leftIcon={<Ionicons name="person-outline" size={18} color={C.textMuted} />}
                  />

                  <Input
                    label={t('authEmail')}
                    placeholder="emri@shembull.al"
                    value={email}
                    onChangeText={(v) => { setEmail(v); setError(''); }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    leftIcon={<Ionicons name="mail-outline" size={18} color={C.textMuted} />}
                  />

                  <Input
                    label={t('authPassword')}
                    placeholder={lang === 'en' ? 'Minimum 6 characters' : 'Minimum 6 karaktere'}
                    value={password}
                    onChangeText={(v) => { setPassword(v); setError(''); }}
                    secureTextEntry={!showPass}
                    leftIcon={<Ionicons name="lock-closed-outline" size={18} color={C.textMuted} />}
                    rightIcon={
                      <Ionicons
                        name={showPass ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color={C.textMuted}
                      />
                    }
                    onRightIconPress={() => setShowPass(!showPass)}
                    hint={lang === 'en' ? 'At least 6 characters' : 'Të paktën 6 karaktere'}
                  />

                  {error ? (
                    <View style={styles.errorBox}>
                      <Ionicons name="alert-circle-outline" size={15} color={C.danger} />
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  ) : null}

                  <View style={styles.terms}>
                    <Ionicons name="information-circle-outline" size={15} color={C.textMuted} />
                    <Text style={styles.termsText}>
                      {t('authAcceptTerms')}{' '}
                      <Text style={styles.termsLink}>{t('authTermsLink')}</Text>
                      {lang === 'en' ? ' and ' : ' dhe '}{' '}
                      <Text style={styles.termsLink}>{t('authPrivacyLink')}</Text>
                    </Text>
                  </View>

                  <Button onPress={handleRegister} size="lg" fullWidth loading={loading}>
                    {t('authRegisterBtn')}
                  </Button>
                </View>
              </View>

              <View style={styles.loginRow}>
                <Text style={styles.loginText}>{t('authHasAccount').split('?')[0]}? </Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                  <Text style={styles.loginLink}>{t('authLoginBtn')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
    alignItems: 'center',
  },
  successOuter: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  inner: { width: '100%', maxWidth: 480 },
  header: { paddingTop: 8, paddingBottom: 16 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glassCard: {
    backgroundColor: C.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.borderGlassStrong,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 15,
  },
  titleSection: { alignItems: 'center', paddingBottom: 28, gap: 10 },
  logoBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  logoLetter: { fontSize: 32, fontWeight: '800', color: C.white },
  title: { fontSize: 26, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: C.textSub, textAlign: 'center' },
  form: { gap: 16 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.dangerBgSubtle,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.dangerBorder,
    padding: 12,
  },
  errorText: { flex: 1, fontSize: 13, color: C.danger, lineHeight: 18 },
  terms: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: C.elevated,
    borderRadius: 10,
    padding: 12,
    alignItems: 'flex-start',
  },
  termsText: { flex: 1, fontSize: 12, color: C.textMuted, lineHeight: 18 },
  termsLink: { color: C.primary, fontWeight: '600' },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  loginText: { fontSize: 14, color: C.textMuted },
  loginLink: { fontSize: 14, color: C.primary, fontWeight: '600' },

  // Success screen
  successContainer: {
    alignItems: 'center',
    gap: 20,
    paddingVertical: 8,
  },
  successIconWrap: {
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: { fontSize: 26, fontWeight: '800', color: C.text, letterSpacing: -0.5, textAlign: 'center' },
  successDesc: { fontSize: 15, color: C.textSub, textAlign: 'center', lineHeight: 24 },
  successEmail: { color: C.primary, fontWeight: '600' },
  backToLoginBtn: {
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    backgroundColor: C.primaryBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.primaryBorder,
  },
  backToLoginText: { fontSize: 15, fontWeight: '700', color: C.primary },
});
