import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  ScrollView,
  ActivityIndicator,
  Platform,
  Keyboard,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { AUTH_UI_PALETTE as PALETTE } from '../config/uiTokens';
import { normalizeEmail } from '../utils/workspaceInvite';
import NSyncBrand from '../components/ui/nsync-brand';

const RESET_ERROR_MESSAGES = {
  'auth/invalid-email': 'The email format is invalid.',
  'auth/missing-continue-uri': 'Password reset setup is incomplete in Firebase.',
  'auth/unauthorized-continue-uri': 'Password reset domain is not authorized in Firebase.',
  'auth/too-many-requests': 'Too many reset attempts. Please try again later.',
  'auth/network-request-failed': 'Network error. Please check your connection and try again.',
};

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendResetLink = async () => {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      Alert.alert('Email Required', 'Please enter your account email.');
      return;
    }

    if (!normalizedEmail.includes('@')) {
      Alert.alert('Validation Error', 'Please enter a valid email.');
      return;
    }

    try {
      setSending(true);
      await sendPasswordResetEmail(auth, normalizedEmail);
      Alert.alert('Password Reset Sent', 'If the address belongs to an existing account, a reset link has been sent. If nothing arrives, check spam and make sure you entered the same email used during signup.');
      navigation.goBack();
    } catch (error) {
      const message = RESET_ERROR_MESSAGES[error?.code] || error?.message || 'Unable to send reset email right now.';
      Alert.alert('Reset Failed', message);
      console.log('Password reset failed:', error?.code, error?.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <NSyncBrand subtitle="Reset your password using your account email." />

            <View style={styles.card}>
              <Text style={styles.title}>Forgot Password</Text>

              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={PALETTE.mutedInk}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                editable={!sending}
              />

              <TouchableOpacity
                style={[styles.button, sending && styles.buttonDisabled]}
                onPress={handleSendResetLink}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color={PALETTE.white} />
                ) : (
                  <Text style={styles.buttonText}>Send Reset Link</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={styles.link}>
                  Back to <Text style={styles.linkStrong}>Login</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PALETTE.white,
  },
  keyboard: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: PALETTE.white,
  },
  card: {
    backgroundColor: PALETTE.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: PALETTE.black,
    marginBottom: 12,
  },
  input: {
    height: 50,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.softWhite,
    paddingHorizontal: 14,
    marginBottom: 11,
    color: PALETTE.black,
  },
  button: {
    marginTop: 6,
    height: 50,
    borderRadius: 9,
    backgroundColor: PALETTE.black,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: PALETTE.white,
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  link: {
    textAlign: 'center',
    color: PALETTE.mutedInk,
    fontSize: 14,
  },
  linkStrong: {
    color: PALETTE.green,
    fontWeight: '700',
  },
});
