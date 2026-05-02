import { Ionicons } from "@expo/vector-icons";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from "react-native";

const navItems = [
  { key: "dashboard", label: "Dashboard", icon: "grid-outline" },
  { key: "users", label: "Users", icon: "people-outline" },
  { key: "workspaces", label: "Workspaces", icon: "briefcase-outline" },
  { key: "activity", label: "Activity", icon: "pulse-outline" },
];

export default function AdminShell({
  activePage,
  children,
  onNavigate,
  onLogout,
}) {
  const { width } = useWindowDimensions();
  const isCompact = width < 820;

  return (
    <View style={[styles.root, isCompact ? styles.rootCompact : null]}>
      <View style={[styles.sidebar, isCompact ? styles.sidebarCompact : null]}>
        <View style={styles.brandWrap}>
          <View style={styles.brandRow}>
            <View style={styles.brandBadge}>
              <Text style={styles.brandBadgeText}>N</Text>
            </View>
            <View>
              <Text style={styles.brandText}>
                <Text style={styles.brandWhite}>N</Text>
                <Text style={styles.brandGreen}>S</Text>
                <Text style={styles.brandWhite}>ync</Text>
              </Text>
              <Text style={styles.brandSub}>Super Admin</Text>
            </View>
          </View>
        </View>

        <View style={[styles.nav, isCompact ? styles.navCompact : null]}>
          {navItems.map((item) => {
            const isActive = activePage === item.key;

            return (
              <Pressable
                key={item.key}
                onPress={() => onNavigate(item.key)}
                style={[
                  styles.navItem,
                  isCompact ? styles.navItemCompact : null,
                  isActive ? styles.navItemActive : null,
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={19}
                  color={isActive ? "#24B35A" : "#cbd5e1"}
                />
                <Text
                  style={[
                    styles.navText,
                    isActive ? styles.navTextActive : null,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[styles.logoutButton, isCompact ? styles.logoutCompact : null]}
          onPress={onLogout}
        >
          <Ionicons name="log-out-outline" size={18} color="#991b1b" />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#ffffff", // 60% white
  },
  rootCompact: {
    flexDirection: "column",
  },
  sidebar: {
    width: 250,
    backgroundColor: "#020817",
    borderRightWidth: 1,
    borderRightColor: "#0f172a",
    padding: 18,
    shadowColor: "#020817",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 1,
  },
  sidebarCompact: {
    width: "100%",
    borderRightWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#0f172a",
    padding: 12,
  },
  brandWrap: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  brandBadge: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
  },
  brandBadgeText: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 29,
  },
  brandText: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  brandWhite: {
    color: "#f8fafc",
  },
  brandGreen: {
    color: "#24B35A",
  },
  brandSub: {
    color: "#cbd5e1",
    marginTop: 2,
    fontSize: 16,
    fontWeight: "500",
  },
  nav: {
    gap: 8,
  },
  navCompact: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  navItem: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(2, 8, 23, 0.8)",
  },
  navItemCompact: {
    flexGrow: 1,
    minWidth: 145,
  },
  navItemActive: {
    backgroundColor: "#1f2937",
    borderLeftWidth: 3,
    borderLeftColor: "#24B35A",
  },
  navText: {
    color: "#e2e8f0",
    fontWeight: "600",
    fontSize: 18,
  },
  navTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  logoutButton: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginTop: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: "#2b1117",
    borderWidth: 1,
    borderColor: "#3f1821",
  },
  logoutCompact: {
    marginTop: 10,
    alignSelf: "flex-start",
  },
  logoutText: {
    color: "#ef4444",
    fontWeight: "800",
  },
  content: {
    flex: 1,
    backgroundColor: "#ffffff", // 60% white
  },
  contentInner: {
    padding: 22,
    paddingBottom: 48,
  },
});
