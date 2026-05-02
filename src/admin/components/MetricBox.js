import { StyleSheet, Text, View } from "react-native";

/**
 * Stat metric box with trend indicator
 */
export default function MetricBox({
  label,
  value,
  trend = null,
  trendLabel = null,
  color = "#24B35A",
}) {
  const trendIsPositive = trend !== null && trend > 0;

  return (
    <View style={[styles.box, { borderLeftColor: color }]}>
      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.valueRow}>
          <Text style={styles.value}>{value}</Text>
          {trend !== null && (
            <View
              style={[
                styles.trendBadge,
                trendIsPositive ? styles.trendPositive : styles.trendNeutral,
              ]}
            >
              <Text style={styles.trendText}>
                {trendIsPositive ? "↑" : "→"} {Math.abs(trend)}%
              </Text>
            </View>
          )}
        </View>
        {trendLabel && <Text style={styles.trendLabel}>{trendLabel}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: "#ffffff",
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  content: {
    gap: 4,
  },
  label: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  value: {
    color: "#071720",
    fontSize: 28,
    fontWeight: "900",
  },
  trendBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  trendPositive: {
    backgroundColor: "#dcfce7",
  },
  trendNeutral: {
    backgroundColor: "#f1f5f9",
  },
  trendText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#24B35A",
  },
  trendLabel: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 2,
  },
});
