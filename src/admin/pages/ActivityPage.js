import { useMemo, useState } from "react";
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import {
    deleteActivity,
    formatDateTime,
    toMillis,
} from "../services/adminService";

export default function ActivityPage({ activity, onActivityDeleted }) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const filteredActivity = useMemo(() => {
    const fromTime = fromDate
      ? new Date(`${fromDate}T00:00:00`).getTime()
      : null;
    const toTime = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null;

    return activity.filter((item) => {
      const itemTime = toMillis(item.createdAt);

      if (fromTime !== null && itemTime < fromTime) {
        return false;
      }

      if (toTime !== null && itemTime > toTime) {
        return false;
      }

      return true;
    });
  }, [activity, fromDate, toDate]);

  const handleDeleteActivity = async (activityId) => {
    const confirmed =
      typeof window !== "undefined" && typeof window.confirm === "function"
        ? window.confirm("Are you sure you want to delete this activity?")
        : true;

    if (!confirmed) {
      return;
    }

    setDeletingId(activityId);
    setErrorMessage("");

    try {
      await deleteActivity(activityId);
      if (onActivityDeleted) {
        await onActivityDeleted();
      }
    } catch (error) {
      setErrorMessage(error.message || "Failed to delete activity.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <View>
      <Text style={styles.title}>Activity Monitoring</Text>
      <Text style={styles.subtitle}>
        Recent user registrations, task creation, board creation, and
        notifications.
      </Text>

      <View style={styles.filterPanel}>
        <Text style={styles.filterTitle}>Filter by Date</Text>
        <View style={styles.filterRow}>
          <View style={styles.filterField}>
            <Text style={styles.filterLabel}>From</Text>
            <TextInput
              style={styles.dateInput}
              value={fromDate}
              onChangeText={setFromDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={styles.filterField}>
            <Text style={styles.filterLabel}>To</Text>
            <TextInput
              style={styles.dateInput}
              value={toDate}
              onChangeText={setToDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <View style={styles.quickRow}>
          <TouchableOpacity
            style={styles.quickButton}
            onPress={() => {
              const today = new Date().toISOString().slice(0, 10);
              setFromDate(today);
              setToDate(today);
            }}
          >
            <Text style={styles.quickButtonText}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickButton}
            onPress={() => {
              const today = new Date();
              const from = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
              setFromDate(from.toISOString().slice(0, 10));
              setToDate(today.toISOString().slice(0, 10));
            }}
          >
            <Text style={styles.quickButtonText}>Last 7 Days</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickButton, styles.clearButton]}
            onPress={() => {
              setFromDate("");
              setToDate("");
            }}
          >
            <Text style={[styles.quickButtonText, styles.clearButtonText]}>
              Clear
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.filterInfo}>
          Showing {filteredActivity.length} of {activity.length} activities
        </Text>

        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : null}
      </View>

      <View style={styles.panel}>
        {filteredActivity.length === 0 ? (
          <Text style={styles.empty}>
            No activities found for the selected date range.
          </Text>
        ) : (
          filteredActivity.map((item) => (
            <View key={item.id} style={styles.row}>
              <View style={styles.marker} />
              <View style={styles.body}>
                <View style={styles.rowHeader}>
                  <Text style={styles.type}>{item.type}</Text>
                  <Text style={styles.time}>
                    {formatDateTime(item.createdAt)}
                  </Text>
                </View>
                <Text style={styles.itemTitle}>{item.title}</Text>
                {item.detail ? (
                  <Text style={styles.detail}>{item.detail}</Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={[
                  styles.deleteButton,
                  deletingId === item.id && styles.deleteButtonDisabled,
                ]}
                onPress={() => handleDeleteActivity(item.id)}
                disabled={deletingId === item.id}
              >
                <Text style={styles.deleteButtonText}>
                  {deletingId === item.id ? "..." : "✕"}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
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
  filterPanel: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 16,
    marginBottom: 18,
  },
  filterTitle: {
    color: "#071720",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: "row",
    gap: 12,
  },
  filterField: {
    flex: 1,
  },
  filterLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#071720",
    backgroundColor: "#ffffff",
  },
  quickRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    flexWrap: "wrap",
  },
  quickButton: {
    backgroundColor: "#e2e8f0",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  clearButton: {
    backgroundColor: "#071720",
  },
  quickButtonText: {
    color: "#071720",
    fontSize: 12,
    fontWeight: "800",
  },
  clearButtonText: {
    color: "#ffffff",
  },
  filterInfo: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 10,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 12,
    marginTop: 8,
  },
  panel: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 16,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    alignItems: "flex-start",
  },
  marker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    backgroundColor: "#24B35A",
    flexShrink: 0,
  },
  body: {
    flex: 1,
  },
  rowHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  type: {
    color: "#0f172a",
    fontWeight: "900",
  },
  time: {
    color: "#64748b",
    fontSize: 12,
  },
  itemTitle: {
    color: "#071720",
    marginTop: 5,
    fontWeight: "800",
  },
  detail: {
    color: "#64748b",
    marginTop: 3,
  },
  deleteButton: {
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fca5a5",
    borderRadius: 6,
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  deleteButtonDisabled: {
    opacity: 0.7,
  },
  deleteButtonText: {
    color: "#991b1b",
    fontWeight: "900",
    fontSize: 14,
  },
  empty: {
    color: "#64748b",
  },
});
