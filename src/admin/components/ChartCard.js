import { StyleSheet, Text, View } from "react-native";

export default function ChartCard({
  title,
  rightLabel,
  children,
  subtle = false,
}) {
  return (
    <View style={[styles.card, subtle ? styles.cardSubtle : null]}>
      <View style={styles.headerRow}>
        <Text style={styles.cardTitle}>{title}</Text>
        {rightLabel ? (
          <Text style={styles.rightLabel}>{rightLabel}</Text>
        ) : null}
      </View>
      <View style={styles.chartContainer}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 18,
    marginBottom: 16,
  },
  cardSubtle: {
    backgroundColor: "#f8fafc",
  },
  cardTitle: {
    color: "#071720",
    fontSize: 17,
    fontWeight: "900",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    gap: 8,
  },
  rightLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  chartContainer: {
    justifyContent: "center",
  },
});
