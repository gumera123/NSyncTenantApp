import { StyleSheet, Text, View, useWindowDimensions } from "react-native";

/**
 * Simple bar chart for displaying totals
 */
export default function BarChart({ data, height = 200, barColor = "#24B35A" }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  if (!data || data.length === 0) {
    return <Text style={styles.noData}>No data available</Text>;
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const safeMax = Math.max(maxValue, 4);
  const ticks = [
    safeMax,
    Math.round((safeMax * 3) / 4),
    Math.round(safeMax / 2),
    Math.round(safeMax / 4),
    0,
  ];
  const barSlotWidth = isMobile ? 62 : 88;

  return (
    <View style={[styles.container, { height }]}>
      <View style={styles.yAxis}>
        {ticks.map((tick, index) => (
          <Text
            key={`tick-${index}`}
            style={[styles.yAxisLabel, isMobile && styles.yAxisLabelMobile]}
          >
            {tick}
          </Text>
        ))}
      </View>
      <View style={styles.chart}>
        <View style={styles.gridLines}>
          {ticks.map((_, index) => (
            <View key={`line-${index}`} style={styles.gridLine} />
          ))}
        </View>
        {data.map((item, idx) => {
          const barHeight = (item.value / safeMax) * (height - 46);
          return (
            <View
              key={idx}
              style={[styles.barContainer, { width: barSlotWidth }]}
            >
              <View
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    backgroundColor: barColor,
                    width: isMobile ? 38 : 52,
                  },
                ]}
              />
              <Text
                style={[styles.barLabel, isMobile && styles.barLabelMobile]}
              >
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingLeft: 2,
  },
  yAxis: {
    width: 34,
    justifyContent: "space-between",
    paddingRight: 6,
  },
  yAxisLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
  },
  yAxisLabelMobile: {
    fontSize: 10,
  },
  chart: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-evenly",
    gap: 4,
    position: "relative",
    paddingBottom: 2,
    minHeight: 180,
  },
  gridLines: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 22,
    justifyContent: "space-between",
  },
  gridLine: {
    borderTopWidth: 1,
    borderTopColor: "#dbe2ea",
    borderStyle: "dashed",
  },
  barContainer: {
    alignItems: "center",
    justifyContent: "flex-end",
    flex: 1,
  },
  bar: {
    borderRadius: 4,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    minHeight: 8,
  },
  barLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 6,
    textAlign: "center",
  },
  barLabelMobile: {
    fontSize: 9,
    marginTop: 2,
  },
  noData: {
    color: "#94a3b8",
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 20,
  },
});
