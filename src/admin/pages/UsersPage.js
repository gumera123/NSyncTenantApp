import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { isAccountDeactivated } from "../../utils/accountStatus";
import AdminTable from "../components/AdminTable";
import { formatDate } from "../services/adminService";

export default function UsersPage({ users }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !term ||
        [user.name, user.email, user.role].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(term),
        );
      const isInactive = isAccountDeactivated(user);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && !isInactive) ||
        (statusFilter === "inactive" && isInactive);

      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter, users]);

  const columns = [
    { key: "name", label: "Name", width: 220 },
    { key: "email", label: "Email", width: 320 },
    {
      key: "createdAt",
      label: "Date Registered",
      width: 180,
      render: (user) => (
        <Text style={styles.cellText}>{formatDate(user.createdAt)}</Text>
      ),
    },
    {
      key: "status",
      label: "Status",
      width: 150,
      render: (user) => (
        <Text
          style={[
            styles.badge,
            isAccountDeactivated(user) ? styles.badgeMuted : styles.badgeActive,
          ]}
        >
          {isAccountDeactivated(user) ? "Inactive" : "Active"}
        </Text>
      ),
    },
  ];

  return (
    <View>
      <Text style={styles.title}>Users</Text>
      <Text style={styles.subtitle}>
        Monitor registered users and account status.
      </Text>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Registered Users</Text>
          <Text style={styles.panelMeta}>{filteredUsers.length} shown</Text>
        </View>

        <View style={styles.toolbar}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name, email, or role"
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
          />
          <View style={styles.filters}>
            {["all", "active", "inactive"].map((item) => (
              <Pressable
                key={item}
                style={[
                  styles.filterButton,
                  statusFilter === item ? styles.filterButtonActive : null,
                ]}
                onPress={() => setStatusFilter(item)}
              >
                <Text
                  style={[
                    styles.filterText,
                    statusFilter === item ? styles.filterTextActive : null,
                  ]}
                >
                  {item[0].toUpperCase() + item.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <AdminTable
          columns={columns}
          rows={filteredUsers}
          emptyText="No users match your filters."
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: "#071720",
    fontSize: 28,
    fontWeight: "900",
  },
  subtitle: {
    color: "#64748b",
    marginTop: 5,
    marginBottom: 18,
  },
  panel: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 16,
  },
  panelHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 14,
  },
  panelTitle: {
    color: "#071720",
    fontSize: 18,
    fontWeight: "900",
  },
  panelMeta: {
    color: "#64748b",
    fontWeight: "700",
  },
  toolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  searchInput: {
    flexGrow: 1,
    flexBasis: 280,
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#dbe1ea",
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    color: "#0f172a",
  },
  filters: {
    flexDirection: "row",
    gap: 8,
  },
  filterButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#dbe1ea",
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  filterButtonActive: {
    backgroundColor: "#071720",
    borderColor: "#071720",
  },
  filterText: {
    color: "#475569",
    fontWeight: "800",
  },
  filterTextActive: {
    color: "#ffffff",
  },
  cellText: {
    color: "#0f172a",
  },
  badge: {
    alignSelf: "flex-start",
    overflow: "hidden",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: "900",
  },
  badgeActive: {
    color: "#166534",
    backgroundColor: "#dcfce7",
  },
  badgeMuted: {
    color: "#991b1b",
    backgroundColor: "#fee2e2",
  },
});
