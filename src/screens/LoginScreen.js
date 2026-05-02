import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
    collection,
    doc,
    getDocFromServer,
    getDocsFromServer,
    limit,
    query,
    where,
} from "firebase/firestore";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../firebaseConfig";
import NSyncBrand from "../components/ui/nsync-brand";
import { AUTH_UI_PALETTE as PALETTE } from "../config/uiTokens";
import {
    getInactiveAccountMessage,
    isAccountDeactivated,
} from "../utils/accountStatus";
import { normalizeEmail } from "../utils/workspaceInvite";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSocialLoginPress = (provider) => {
    Alert.alert(
      "Coming soon",
      `${provider} sign-in UI is added, but provider setup is not connected yet.`,
    );
  };

  const handleLogin = async () => {
    const normalizedEmail = normalizeEmail(email);

    if (!email.trim()) {
      Alert.alert("Validation Error", "Email is required.");
      return;
    }

    if (!email.includes("@")) {
      Alert.alert("Validation Error", "Please enter a valid email.");
      return;
    }

    if (!password.trim()) {
      Alert.alert("Validation Error", "Password is required.");
      return;
    }

    try {
      setLoading(true);

      const userQuery = query(
        collection(db, "users"),
        where("email", "==", normalizedEmail),
        limit(1),
      );
      const userQuerySnapshot = await getDocsFromServer(userQuery);

      if (userQuerySnapshot.empty) {
        Alert.alert(
          "Account unavailable",
          "This user profile no longer exists or has been removed by the Super Admin.",
        );
        return;
      }

      const [profile] = userQuerySnapshot.docs;
      const profileData = profile.data();

      if (isAccountDeactivated(profileData)) {
        Alert.alert(
          "Account deactivated",
          getInactiveAccountMessage(profileData),
        );
        return;
      }

      const credential = await signInWithEmailAndPassword(
        auth,
        normalizedEmail,
        password,
      );
      const userRef = doc(db, "users", credential.user.uid);
      const userSnapshot = await getDocFromServer(userRef);

      if (!userSnapshot.exists()) {
        await signOut(auth);
        Alert.alert(
          "Account unavailable",
          "This user profile no longer exists.",
        );
        return;
      }

      const userData = userSnapshot.data();

      if (isAccountDeactivated(userData)) {
        await signOut(auth);
        Alert.alert("Account deactivated", getInactiveAccountMessage(userData));
        return;
      }
    } catch (error) {
      Alert.alert("Login Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  const goToSuperAdmin = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.assign("/admin");
    }
  };

  const formContent = (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.shell}>
        <NSyncBrand subtitle="Tenant workspace management" />

        <View style={styles.card}>
          <Text style={styles.title}>Sign in</Text>
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

          <TouchableOpacity
            style={styles.forgotPasswordWrap}
            onPress={() => navigation.navigate("ForgotPassword")}
            disabled={loading}
          >
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => handleSocialLoginPress("Google")}
            activeOpacity={0.88}
          >
            <Ionicons name="logo-google" size={20} color={PALETTE.black} />
            <Text style={styles.socialButtonText}>Sign in with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => handleSocialLoginPress("Facebook")}
            activeOpacity={0.88}
          >
            <Ionicons name="logo-facebook" size={20} color={PALETTE.black} />
            <Text style={styles.socialButtonText}>Sign in with Facebook</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate("Register")}>
            <Text style={styles.link}>
              No account? <Text style={styles.linkStrong}>Register</Text>
            </Text>
          </TouchableOpacity>

          {Platform.OS === "web" ? (
            <TouchableOpacity
              style={styles.adminLinkWrap}
              onPress={goToSuperAdmin}
            >
              <Text style={styles.adminLink}>Super Admin Dashboard</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {Platform.OS === "web" ? (
          formContent
        ) : (
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            {formContent}
          </TouchableWithoutFeedback>
        )}
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
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: PALETTE.white,
  },
  shell: {
    width: "100%",
    maxWidth: 460,
  },
  card: {
    backgroundColor: PALETTE.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    padding: 22,
    shadowColor: "#000000",
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
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
  forgotPasswordWrap: {
    alignSelf: "center",
    marginTop: -2,
    marginBottom: 10,
  },
  forgotPasswordText: {
    color: PALETTE.green,
    fontSize: 13,
    fontWeight: "700",
  },
  button: {
    marginTop: 6,
    height: 50,
    borderRadius: 9,
    backgroundColor: PALETTE.black,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: PALETTE.white,
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.3,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: PALETTE.border,
  },
  dividerText: {
    color: PALETTE.mutedInk,
    fontSize: 12,
    fontWeight: "600",
  },
  socialButton: {
    height: 52,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 10,
  },
  socialButtonText: {
    color: PALETTE.black,
    fontWeight: "600",
    fontSize: 15,
  },
  link: {
    textAlign: "center",
    color: PALETTE.mutedInk,
    fontSize: 14,
  },
  linkStrong: {
    color: PALETTE.green,
    fontWeight: "700",
  },
  adminLinkWrap: {
    alignSelf: "center",
    marginTop: 14,
    paddingVertical: 4,
  },
  adminLink: {
    color: PALETTE.black,
    fontSize: 13,
    fontWeight: "800",
  },
});
