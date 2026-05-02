import { useMemo } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import BarChart from "../components/BarChart";
import ChartCard from "../components/ChartCard";
import MetricBox from "../components/MetricBox";
import StatCard from "../components/StatCard";
import { formatDateTime } from "../services/adminService";

export default function DashboardPage({ totals, activity, boardsCount = 0 }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  // Calculate activity trends
  const metricData = useMemo(() => {
    const recentActivity = activity.slice(0, 10);
    const userRegistrations = recentActivity.filter(
      (a) => a.type === "User registration",
    ).length;
    const taskCreations = recentActivity.filter(
      (a) => a.type === "Task creation",
    ).length;
    const boardCreations = recentActivity.filter(
      (a) => a.type === "Workspace board",
    ).length;

    return {
      userRegistrations,
      taskCreations,
      boardCreations,
    };
  }, [activity]);

  return (
    <View>
      <Text style={styles.title}>Dashboard Overview</Text>
      <Text style={styles.subtitle}>
        System-wide snapshot of users, workspaces, and tasks.
      </Text>

      {/* Primary Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard
          label="Total Users"
          value={totals.users}
          icon="people-outline"
        />
        <StatCard
          label="Total Workspaces"
          value={totals.workspaces}
          icon="briefcase-outline"
        />
        <StatCard
          label="Total Tasks"
          value={totals.tasks}
          icon="checkbox-outline"
        />
      </View>

      {/* Key Metrics and Distribution Chart Side by Side (Desktop) or Stacked (Mobile) */}
      <View
        style={[
          styles.metricsAndChartContainer,
          isMobile && styles.metricsAndChartContainerMobile,
        ]}
      >
        {/* Key Metrics */}
        <View
          style={[
            styles.metricsSection,
            isMobile && styles.metricsSectionMobile,
          ]}
        >
          <Text style={styles.sectionTitle}>Key Metrics</Text>
          <MetricBox
            label="Recent Registrations"
            value={metricData.userRegistrations}
            color="#24B35A"
            trendLabel="Last 10 activities"
          />
          <MetricBox
            label="Task Creations"
            value={metricData.taskCreations}
            color="#24B35A"
            trendLabel="In recent activity"
          />
          <MetricBox
            label="Board Creations"
            value={metricData.boardCreations}
            color="#24B35A"
            trendLabel="In recent activity"
          />
        </View>

        {/* Distribution Chart */}
        <View
          style={[styles.chartWrapper, isMobile && styles.chartWrapperMobile]}
        >
          <ChartCard
            title="System Activity Distribution"
            rightLabel="Last 30 days"
          >
            <BarChart
              data={[
                { label: "Users", value: totals.users },
                { label: "Workspaces", value: totals.workspaces },
                { label: "Tasks", value: totals.tasks },
                { label: "Boards", value: boardsCount },
              ]}
              height={isMobile ? 220 : 240}
              barColor="#24B35A"
            />
          </ChartCard>
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {activity.slice(0, 6).map((item) => (
          <View key={item.id} style={styles.activityRow}>
            <View style={styles.dot} />
            <View style={styles.activityBody}>
              <Text style={styles.activityTitle}>{item.title}</Text>
              <Text style={styles.activityMeta}>
                {item.type} • {formatDateTime(item.createdAt)}
              </Text>
            </View>
          </View>
        ))}
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
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginBottom: 14,
  },
  metricsAndChartContainer: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 20,
  },
  metricsAndChartContainerMobile: {
    flexDirection: "column",
  },
  metricsSection: {
    flex: 1,
    minWidth: 280,
  },
  metricsSectionMobile: {
    minWidth: 200,
    marginBottom: 16,
  },
  chartWrapper: {
    flex: 1,
  },
  chartWrapperMobile: {
    flex: 1,
    minHeight: 300,
  },
  section: {
    marginTop: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 16,
  },
  sectionTitle: {
    color: "#071720",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 14,
  },
  activityRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#24B35A",
    marginTop: 5,
  },
  activityBody: {
    flex: 1,
  },
  activityTitle: {
    color: "#0f172a",
    fontWeight: "800",
  },
  activityMeta: {
    color: "#64748b",
    marginTop: 3,
    fontSize: 12,
  },
});
