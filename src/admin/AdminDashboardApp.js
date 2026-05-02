import { onAuthStateChanged, sendPasswordResetEmail } from "firebase/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { auth } from "../../firebaseConfig";
import AdminShell from "./components/AdminShell";
import NSyncLogo from "./components/NSyncLogo";
import ActivityPage from "./pages/ActivityPage";
import DashboardPage from "./pages/DashboardPage";
import UsersPage from "./pages/UsersPage";
import WorkspacesPage from "./pages/WorkspacesPage";
import {
    fetchAdminDashboardData,
    loginSuperAdmin,
    logoutSuperAdmin,
    verifySuperAdminUser,
} from "./services/adminService";

const emptyData = {
  users: [],
  boards: [],
  tasks: [],
  workspaces: [],
  activity: [],
  totals: {
    users: 0,
    workspaces: 0,
    tasks: 0,
  },
};

function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState(
    process.env.EXPO_PUBLIC_SUPER_ADMIN_EMAIL || "",
  );
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetMsg, setResetMsg] = useState("");

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await loginSuperAdmin(email, password);
      onLogin();
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setResetMsg("");
    if (!email.trim()) {
      setError("Please enter the admin email to reset the password.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await sendPasswordResetEmail(auth, email);
      setResetMsg("Password reset email sent — check the inbox.");
    } catch (err) {
      setError(err.message || "Unable to send password reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.loginRoot}>
      <View style={styles.loginPanel}>
        <View style={styles.titleContainer}>
          <NSyncLogo variant="text-only" size="large" />
          <Text style={styles.superAdminText}>Super Admin</Text>
        </View>
        {/* removed explanatory copy - replaced with reset flow */}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {resetMsg ? <Text style={styles.resetMsg}>{resetMsg}</Text> : null}

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Admin email"
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
          editable={!loading}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          style={styles.input}
          editable={!loading}
        />

        <Pressable
          style={[styles.loginButton, loading ? styles.buttonDisabled : null]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.loginButtonText}>Login</Text>
          )}
        </Pressable>

        <View style={styles.resetRow}>
          <Pressable onPress={handleResetPassword} disabled={loading}>
            <Text style={styles.resetLink}>Reset password</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function AdminDashboardApp() {
  const [adminUser, setAdminUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [data, setData] = useState(emptyData);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setAdminUser(null);
        setLoadingAuth(false);
        return;
      }

      const canAccess = await verifySuperAdminUser(currentUser);

      if (!canAccess) {
        await logoutSuperAdmin();
        setAdminUser(null);
        setLoadingAuth(false);
        return;
      }

      setAdminUser(currentUser);
      setLoadingAuth(false);
    });

    return unsubscribe;
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoadingData(true);
      setError("");
      const nextData = await fetchAdminDashboardData();
      setData(nextData);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (adminUser) {
      loadData();
    }
  }, [adminUser, loadData]);

  const currentPage = useMemo(() => {
    if (page === "users") {
      return <UsersPage users={data.users} />;
    }

    if (page === "workspaces") {
      return <WorkspacesPage workspaces={data.workspaces} />;
    }

    if (page === "activity") {
      return (
        <ActivityPage activity={data.activity} onActivityDeleted={loadData} />
      );
    }

    return (
      <DashboardPage
        totals={data.totals}
        activity={data.activity}
        boardsCount={data.boards.length}
      />
    );
  }, [data, page]);

  const handleLogout = async () => {
    await logoutSuperAdmin();
    setAdminUser(null);
    setData(emptyData);
  };

  if (loadingAuth) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#24B35A" />
      </View>
    );
  }

  if (!adminUser) {
    return <AdminLogin onLogin={loadData} />;
  }

  return (
    <AdminShell activePage={page} onNavigate={setPage} onLogout={handleLogout}>
      {error ? <Text style={styles.pageError}>{error}</Text> : null}
      {loadingData ? (
        <View style={styles.loadingPanel}>
          <ActivityIndicator color="#24B35A" />
          <Text style={styles.loadingText}>Loading dashboard data...</Text>
        </View>
      ) : (
        currentPage
      )}
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff", // 60% white
  },
  loginRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    backgroundColor: "#ffffff", // 60% white
  },
  loginPanel: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff", // 60% white
    padding: 22,
    alignItems: "center",
    shadowColor: "#071720", // 30% black shadow
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  titleContainer: {
    marginBottom: 14,
    alignItems: "center",
  },
  superAdminText: {
    color: "#071720", // 30% black
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
    letterSpacing: 0.5,
  },
  loginSubtitle: {
    color: "#64748b",
    marginTop: 5,
    marginBottom: 18,
    textAlign: "center",
  },
  input: {
    alignSelf: "stretch",
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#dbe1ea",
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    marginBottom: 10,
    color: "#0f172a",
  },
  loginButton: {
    alignSelf: "stretch",
    minHeight: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#071720", // 30% black
  },
  loginButtonText: {
    color: "#ffffff", // 60% white
    fontWeight: "900",
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  loginHint: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
  },
  errorText: {
    color: "#991b1b",
    backgroundColor: "#fee2e2",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  profileMenuContainer: {
    position: "relative",
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  profileInfo: {
    alignItems: "flex-end",
  },
  profileName: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 16,
  },
  profileEmail: {
    color: "#64748b",
    fontSize: 12,
  },
  profileAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#ffffff", // 60% white
    borderWidth: 1,
    borderColor: "#071720", // 30% black border
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarText: {
    color: "#071720", // 30% black
    fontWeight: "900",
    fontSize: 18,
  },
  profileDropdown: {
    position: "absolute",
    top: 50,
    right: 0,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#071720",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    minWidth: 140,
    zIndex: 1000,
  },
  menuItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 0,
  },
  menuItemText: {
    color: "#071720",
    fontSize: 14,
    fontWeight: "600",
  },
  pageError: {
    color: "#991b1b",
    backgroundColor: "#fee2e2",
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  loadingPanel: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
  },
  loadingText: {
    color: "#64748b",
    marginTop: 8,
  },
  resetRow: {
    marginTop: 12,
    gap: 10,
    alignItems: "center",
    alignSelf: "stretch",
  },
  resetButton: {
    minHeight: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#24B35A",
    paddingHorizontal: 14,
  },
  resetButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  resetLink: {
    color: "#24B35A",
    fontWeight: "800",
    fontSize: 14,
    textAlign: "center",
  },
  resetNote: {
    color: "#64748b",
    marginTop: 8,
    fontSize: 13,
  },
  resetMsg: {
    color: "#166534",
    backgroundColor: "#dcfce7",
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
});
