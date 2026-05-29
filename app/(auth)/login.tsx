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
import { signIn, toAlbanianError } from '@/lib/auth';
import { supabase, supabaseConfigMissing } from '@/lib/supabase';
import { useTranslation } from '@/lib/i18n';

export default function Login() {
  const { t, lang } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    () => supabaseConfigMissing && Platform.OS !== 'web'
      ? 'Konfigurimi i Supabase mungon në build-in Android.'
      : ''
  );
  const [resetSent, setResetSent] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const router = useRouter();

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError(t('authForgotEnterEmail'));
      return;
    }
    setSendingReset(true);
    setError('');
    try {
      await supabase.auth.resetPasswordForEmail(email.trim());
      setResetSent(true);
    } catch {
      setError(t('authForgotEnterEmail'));
    } finally {
      setSendingReset(false);
    }
  };

  const handleLogin = async () => {
    setError('');
    setResetSent(false);
    if (!email.trim() || !password) {
      setError(t('authFillFields'));
      return;
    }

    setLoading(true);
    try {
      await signIn(email.trim(), password);
      // AuthGuard will handle redirect once SIGNED_IN fires
    } catch (e: any) {
      console.error('[Login] catch:', JSON.stringify({ message: e?.message, code: e?.code, status: e?.status, name: e?.name }));
      setError(toAlbanianError(e?.message ?? '', e?.code));
    } finally {
      setLoading(false);
    }
  };

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
                <TouchableOpacity onPress={() => router.replace('/(auth)/zgjidhplanin' as any)} style={styles.backBtn}>
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
                  <Text style={styles.title}>{t('authWelcome')}</Text>
                  <Text style={styles.subtitle}>{t('authWelcomeSub')}</Text>
                </View>

                <View style={styles.form}>
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
                    placeholder="••••••••"
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
                  />

                  {error ? (
                    <View style={styles.errorBox}>
                      <Ionicons name="alert-circle-outline" size={15} color={C.danger} />
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  ) : null}

                  {resetSent ? (
                    <View style={styles.resetSentBox}>
                      <Ionicons name="checkmark-circle-outline" size={15} color={C.primary} />
                      <Text style={styles.resetSentText}>{t('authForgotSent')}</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={styles.forgotBtn}
                    onPress={handleForgotPassword}
                    disabled={sendingReset}
                  >
                    <Text style={styles.forgotText}>
                      {sendingReset ? t('authForgotSending') : t('authForgotPwQ')}
                    </Text>
                  </TouchableOpacity>

                  <Button onPress={handleLogin} size="lg" fullWidth loading={loading}>
                    {t('authLoginBtn')}
                  </Button>

                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>{lang === 'en' ? 'or' : 'ose'}</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <TouchableOpacity style={[styles.socialBtn, styles.socialBtnDisabled]} activeOpacity={1} disabled>
                    <Ionicons name="logo-google" size={20} color={C.textFaint} />
                    <Text style={[styles.socialText, { color: C.textFaint }]}>{t('authContinueGoogle')}</Text>
                    <View style={styles.soonBadge}>
                      <Text style={styles.soonBadgeText}>{lang === 'en' ? 'SOON' : 'SE SHPEJTI'}</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.registerRow}>
                <Text style={styles.registerText}>{t('authNoAccount').split('?')[0]}? </Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
                  <Text style={styles.registerLink}>{t('authRegisterBtn')}</Text>
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
    width: 64,
    height: 64,
    borderRadius: 20,
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
  resetSentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.primaryBgSubtle,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.primaryBorder,
    padding: 12,
  },
  resetSentText: { flex: 1, fontSize: 13, color: C.primary, lineHeight: 18 },
  forgotBtn: { alignSelf: 'flex-end', marginTop: -8 },
  forgotText: { fontSize: 13, color: C.primary, fontWeight: '500' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: { fontSize: 13, color: C.textMuted },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    backgroundColor: C.elevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  socialText: { fontSize: 15, color: C.text, fontWeight: '600' },
  socialBtnDisabled: { opacity: 0.5 },
  soonBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: C.elevated,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: C.border,
  },
  soonBadgeText: { fontSize: 8, fontWeight: '800', color: C.textFaint, letterSpacing: 0.6 },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  registerText: { fontSize: 14, color: C.textMuted },
  registerLink: { fontSize: 14, color: C.primary, fontWeight: '600' },
});
