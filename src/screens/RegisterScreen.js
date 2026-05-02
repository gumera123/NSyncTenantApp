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
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { AUTH_UI_PALETTE as PALETTE } from '../config/uiTokens';
import { normalizeEmail } from '../utils/workspaceInvite';
import NSyncBrand from '../components/ui/nsync-brand';

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const normalizedEmail = normalizeEmail(email);

    if (!name.trim()) {
      Alert.alert('Validation Error', 'Name is required.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Validation Error', 'Valid email is required.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters.');
      return;
    }

    try {
      setLoading(true);
      const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      const user = userCredential.user;

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: name.trim(),
        email: normalizedEmail,
        role: 'Admin',
        workspaceRoleTitle: 'Workspace Owner',
        organizationId: user.uid,
        organizationName: name.trim(),
        homeOrganizationId: user.uid,
        homeOrganizationName: name.trim(),
        workspaceMemberships: [
          {
            organizationId: user.uid,
            organizationName: name.trim(),
            role: 'Admin',
            workspaceRoleTitle: 'Workspace Owner',
            invitedBy: '',
          },
        ],
        invitedBy: '',
        createdAt: serverTimestamp(),
      });

      Alert.alert('Success', 'Account created successfully. You are now signed in.');
    } catch (error) {
      Alert.alert('Registration Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <NSyncBrand subtitle="Create your account to start managing tenant workspaces." />

            <View style={styles.card}>
              <TextInput
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor={PALETTE.mutedInk}
                value={name}
                onChangeText={setName}
                editable={!loading}
              />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={PALETTE.mutedInk}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                editable={!loading}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={PALETTE.mutedInk}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                editable={!loading}
              />

              <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleRegister} disabled={loading}>
                {loading ? <ActivityIndicator color={PALETTE.white} /> : <Text style={styles.buttonText}>Create Account</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.link}>Already have an account? <Text style={styles.linkStrong}>Login</Text></Text>
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
