import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Platform,
  Share,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import * as Print from 'expo-print';
import ReactNativeBlobUtil from 'react-native-blob-util';
// Using React Native's Share API as a safer fallback to avoid runtime
// native-version mismatches with Expo's sharing native module.
import { auth, db } from '../../firebaseConfig';
import { parseDateString } from '../utils/dateHelper';
import { AUTH_UI_PALETTE as PALETTE } from '../config/uiTokens';

const ALL_BOARDS = 'ALL_BOARDS';

function formatReportFileName(boardName) {
  const safeBoardName = (boardName || 'dashboard-report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'dashboard-report';

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${safeBoardName}-report-${timestamp}.pdf`;
}

async function persistReportPdf(sourceUri, boardName) {
  try {
    const destinationFileName = formatReportFileName(boardName);

    if (Platform.OS === 'android') {
      const mediaStoreUri = await ReactNativeBlobUtil.MediaCollection.copyToMediaStore(
        {
          name: destinationFileName,
          parentFolder: 'NSync-Reports',
          mimeType: 'application/pdf',
        },
        'Download',
        sourceUri.replace(/^file:\/\//, '')
      );

      console.log(`PDF persisted to Android Downloads: ${mediaStoreUri}`);
      return mediaStoreUri;
    }

    console.log(`PDF generated locally: ${sourceUri}`);
    return sourceUri;
  } catch (error) {
    console.error('Error persisting PDF to Android Downloads:', error);
    // Return the source URI as fallback if copy fails
    return sourceUri;
  }
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfWeek(date) {
  const dayIndex = date.getDay();
  const daysUntilSunday = (7 - dayIndex) % 7;
  const result = new Date(date);
  result.setDate(result.getDate() + daysUntilSunday);
  return startOfDay(result);
}

function isSameDay(leftDate, rightDate) {
  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
}

function applyDateRangeFilter(taskList, dateRange) {
  // Phase 1 keeps the date-range structure ready while defaulting to no filter.
  if (!dateRange.startDate && !dateRange.endDate) {
    return taskList;
  }

  return taskList.filter((task) => {
    if (!task.dueDate) {
      return false;
    }

    const dueDate = startOfDay(parseDateString(task.dueDate));
    if (dateRange.startDate && dueDate < startOfDay(dateRange.startDate)) {
      return false;
    }

    if (dateRange.endDate && dueDate > startOfDay(dateRange.endDate)) {
      return false;
    }

    return true;
  });
}

function aggregateReportMetrics(taskList, boardTitlesById) {
  const today = startOfDay(new Date());
  const weekEnd = endOfWeek(today);

  const totalTasks = taskList.length;
  const doneTasks = taskList.filter((task) => task.status === 'Done').length;
  const inProgressTasks = taskList.filter((task) => task.status === 'In Progress').length;
  const todoTasks = taskList.filter((task) => task.status === 'To Do').length;

  const overdueTasks = taskList.filter((task) => {
    if (task.status === 'Done' || !task.dueDate) {
      return false;
    }

    const dueDate = startOfDay(parseDateString(task.dueDate));
    return dueDate < today;
  }).length;

  const dueTodayTasks = taskList.filter((task) => {
    if (task.status === 'Done' || !task.dueDate) {
      return false;
    }

    const dueDate = startOfDay(parseDateString(task.dueDate));
    return isSameDay(dueDate, today);
  }).length;

  const dueThisWeekTasks = taskList.filter((task) => {
    if (task.status === 'Done' || !task.dueDate) {
      return false;
    }

    const dueDate = startOfDay(parseDateString(task.dueDate));
    return dueDate >= today && dueDate <= weekEnd;
  }).length;

  const completionRate = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const boardSummaryById = {};

  taskList.forEach((task) => {
    const boardId = task.boardId || 'unknown';
    const boardTitle = boardTitlesById[boardId] || task.boardTitle || 'Untitled Board';

    if (!boardSummaryById[boardId]) {
      boardSummaryById[boardId] = {
        boardId,
        boardTitle,
        total: 0,
        done: 0,
        pending: 0,
      };
    }

    boardSummaryById[boardId].total += 1;

    if (task.status === 'Done') {
      boardSummaryById[boardId].done += 1;
    } else {
      boardSummaryById[boardId].pending += 1;
    }
  });

  const boardSummaries = Object.values(boardSummaryById).sort((left, right) => right.total - left.total);
  const boardMostPending = boardSummaries.reduce((currentTop, boardSummary) => {
    if (!currentTop || boardSummary.pending > currentTop.pending) {
      return boardSummary;
    }

    return currentTop;
  }, null);

  return {
    totalTasks,
    doneTasks,
    inProgressTasks,
    todoTasks,
    completionRate,
    overdueTasks,
    dueTodayTasks,
    dueThisWeekTasks,
    boardSummaries,
    boardMostPending,
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildReportPdfHtml({ generatedAt, selectedBoardName, metrics }) {
  const boardRows = metrics.boardSummaries.length
    ? metrics.boardSummaries.map((boardSummary) => `
      <tr>
        <td>${escapeHtml(boardSummary.boardTitle)}</td>
        <td>${boardSummary.total}</td>
        <td>${boardSummary.done}</td>
        <td>${boardSummary.pending}</td>
      </tr>`).join('')
    : '<tr><td colspan="4">No board data available</td></tr>';

  const isSingleBoardReport = selectedBoardName !== 'All Boards';
  const reportTitle = isSingleBoardReport 
    ? `Dashboard Report: ${escapeHtml(selectedBoardName)}` 
    : 'Dashboard Report: All Boards';
  const reportSubtitle = isSingleBoardReport
    ? `This report shows data for the "${escapeHtml(selectedBoardName)}" board only.`
    : 'This report includes data from all boards in your workspace.';

  const boardSection = isSingleBoardReport
    ? `
        <h2>Board Summary</h2>
        <table>
          <thead>
            <tr>
              <th>Board</th>
              <th>Total Tasks</th>
              <th>Done</th>
              <th>Pending</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${escapeHtml(selectedBoardName)}</td>
              <td>${metrics.totalTasks}</td>
              <td>${metrics.doneTasks}</td>
              <td>${metrics.totalTasks - metrics.doneTasks}</td>
            </tr>
          </tbody>
        </table>`
    : `
        <h2>Board Performance</h2>
        <p>Most Pending Board: ${escapeHtml(metrics.boardMostPending?.boardTitle || 'No board data')}</p>
        <p>Pending Count: ${metrics.boardMostPending?.pending || 0}</p>
        <table>
          <thead>
            <tr>
              <th>Board</th>
              <th>Total Tasks</th>
              <th>Done</th>
              <th>Pending</th>
            </tr>
          </thead>
          <tbody>
            ${boardRows}
          </tbody>
        </table>`;

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
          h1 { margin: 0 0 4px; font-size: 24px; }
          .subtitle { margin: 0 0 12px; font-size: 13px; color: #334155; font-style: italic; }
          .filter-badge { display: inline-block; background: #dbeafe; border: 1px solid #93c5fd; color: #1d4ed8; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-top: 8px; }
          h2 { margin: 20px 0 8px; font-size: 16px; color: #1e293b; }
          p { margin: 0 0 4px; color: #334155; }
          .chip { display: inline-block; padding: 4px 10px; border: 1px solid #cbd5e1; border-radius: 999px; font-size: 12px; margin-top: 8px; }
          .grid { margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; }
          .label { font-size: 12px; color: #64748b; }
          .value { font-size: 20px; font-weight: bold; margin-top: 6px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #e2e8f0; padding: 8px; font-size: 12px; text-align: left; }
          th { background: #f8fafc; }
        </style>
      </head>
      <body>
        <h1>${reportTitle}</h1>
        <p class="subtitle">${reportSubtitle}</p>
        <span class="filter-badge">${isSingleBoardReport ? `FILTERED TO: ${escapeHtml(selectedBoardName).toUpperCase()}` : 'ALL BOARDS'}</span>
        <p>Generated: ${escapeHtml(generatedAt)}</p>

        <h2>Overall Summary</h2>
        <div class="grid">
          <div class="card"><div class="label">Total Tasks</div><div class="value">${metrics.totalTasks}</div></div>
          <div class="card"><div class="label">Completion Rate</div><div class="value">${metrics.completionRate}%</div></div>
          <div class="card"><div class="label">To Do</div><div class="value">${metrics.todoTasks}</div></div>
          <div class="card"><div class="label">In Progress</div><div class="value">${metrics.inProgressTasks}</div></div>
          <div class="card"><div class="label">Done</div><div class="value">${metrics.doneTasks}</div></div>
        </div>

        <h2>Deadline Report</h2>
        <div class="grid">
          <div class="card"><div class="label">Overdue</div><div class="value">${metrics.overdueTasks}</div></div>
          <div class="card"><div class="label">Due Today</div><div class="value">${metrics.dueTodayTasks}</div></div>
          <div class="card"><div class="label">Due This Week</div><div class="value">${metrics.dueThisWeekTasks}</div></div>
        </div>

        ${boardSection}
      </body>
    </html>`;
}

function StatCard({ label, value, helper, tone = 'default' }) {
  return (
    <View style={[styles.statCard, tone === 'success' ? styles.statCardSuccess : null]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {helper ? <Text style={styles.statHelper}>{helper}</Text> : null}
    </View>
  );
}

function ProgressBar({ value, color }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color }]} />
    </View>
  );
}

export default function ReportsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [boardTitlesById, setBoardTitlesById] = useState({});
  const [selectedBoardId, setSelectedBoardId] = useState(ALL_BOARDS);
  const [dateRange, setDateRange] = useState({
    startDate: null,
    endDate: null,
  });
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const fetchReportData = useCallback(async () => {
    if (!auth.currentUser) {
      setTasks([]);
      setBoardTitlesById({});
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userData = userDoc.exists() ? userDoc.data() : null;
      const organizationId = userData?.organizationId || auth.currentUser.uid;

      // Example Firestore query for org-scoped tasks:
      // const tasksByOrgSnapshot = await getDocs(query(collection(db, 'tasks'), where('organizationId', '==', organizationId)));
      const [tasksByOrgSnapshot, legacyTasksSnapshot, boardsByOrgSnapshot, legacyBoardsSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'tasks'), where('organizationId', '==', organizationId))),
        getDocs(query(collection(db, 'tasks'), where('userId', '==', organizationId))),
        getDocs(query(collection(db, 'boards'), where('organizationId', '==', organizationId))),
        getDocs(query(collection(db, 'boards'), where('userId', '==', organizationId))),
      ]);

      const mergedTaskDocs = [...tasksByOrgSnapshot.docs, ...legacyTasksSnapshot.docs];
      const seenTaskIds = new Set();
      const uniqueTasks = [];

      mergedTaskDocs.forEach((docItem) => {
        if (seenTaskIds.has(docItem.id)) {
          return;
        }

        seenTaskIds.add(docItem.id);
        uniqueTasks.push({
          id: docItem.id,
          ...docItem.data(),
        });
      });

      const mergedBoardDocs = [...boardsByOrgSnapshot.docs, ...legacyBoardsSnapshot.docs];
      const seenBoardIds = new Set();
      const titles = {};

      mergedBoardDocs.forEach((docItem) => {
        if (seenBoardIds.has(docItem.id)) {
          return;
        }

        seenBoardIds.add(docItem.id);
        titles[docItem.id] = docItem.data()?.title || 'Untitled Board';
      });

      setTasks(uniqueTasks);
      setBoardTitlesById(titles);
    } catch (error) {
      console.log('Error loading reports data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchReportData();
    }, [fetchReportData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReportData();
  }, [fetchReportData]);

  const boardFilterOptions = useMemo(() => {
    const optionMap = new Map();

    Object.entries(boardTitlesById).forEach(([boardId, boardTitle]) => {
      optionMap.set(boardId, boardTitle || 'Untitled Board');
    });

    tasks.forEach((task) => {
      const boardId = task.boardId || 'unknown';
      if (!optionMap.has(boardId)) {
        optionMap.set(boardId, task.boardTitle || 'Untitled Board');
      }
    });

    const boardOptions = Array.from(optionMap.entries())
      .map(([id, title]) => ({ id, title }))
      .sort((left, right) => left.title.localeCompare(right.title));

    return [{ id: ALL_BOARDS, title: 'All Boards' }, ...boardOptions];
  }, [boardTitlesById, tasks]);

  const filteredTasks = useMemo(() => {
    const boardScopedTasks = selectedBoardId === ALL_BOARDS
      ? tasks
      : tasks.filter((task) => (task.boardId || 'unknown') === selectedBoardId);

    return applyDateRangeFilter(boardScopedTasks, dateRange);
  }, [tasks, selectedBoardId, dateRange]);

  const metrics = useMemo(() => aggregateReportMetrics(filteredTasks, boardTitlesById), [filteredTasks, boardTitlesById]);

  const selectedBoardName = useMemo(() => {
    const selectedOption = boardFilterOptions.find((option) => option.id === selectedBoardId);
    return selectedOption?.title || 'All Boards';
  }, [boardFilterOptions, selectedBoardId]);

  const handleExportPdf = useCallback(async () => {
    try {
      setIsExportingPdf(true);

      const generatedAt = new Date().toLocaleString();
      const html = buildReportPdfHtml({
        generatedAt,
        selectedBoardName,
        metrics,
      });

      const { uri: tempUri } = await Print.printToFileAsync({ html, base64: false });
      console.log('PDF generated at temp location:', tempUri);

      const savedUri = await persistReportPdf(tempUri, selectedBoardName);
      console.log('PDF persisted to:', savedUri);

      // React Native Share accepts either file:// or content:// URIs on Android.
      const fileUri = savedUri.startsWith('file://') || savedUri.startsWith('content://')
        ? savedUri
        : `file://${savedUri}`;
      
      try {
        await Share.share({
          title: 'Dashboard Report',
          message: 'Please find the dashboard report attached.',
          url: fileUri,
          failOnCancel: false, // Don't error if user cancels share dialog
        });

        // No user-facing modal; just log success (keeps UI clean)
        console.log('Report shared or saved at:', savedUri);
      } catch (shareErr) {
        // Share may fail or be cancelled; user can find file manually
        console.log('Share action failed or cancelled:', shareErr);
        console.log('Report saved at (fallback):', savedUri);
      }
    } catch (error) {
      console.error('Error exporting report PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'Could not generate the report PDF. Please try again.';
      console.error('Export failed:', errorMessage);
    } finally {
      setIsExportingPdf(false);
    }
  }, [metrics, selectedBoardName]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PALETTE.green} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <TouchableOpacity
          style={[styles.exportButton, isExportingPdf ? styles.exportButtonDisabled : null]}
          onPress={handleExportPdf}
          activeOpacity={0.88}
          disabled={isExportingPdf}
        >
          <Text style={styles.exportButtonText}>{isExportingPdf ? 'Generating PDF...' : `Export ${selectedBoardId === ALL_BOARDS ? 'All Boards' : selectedBoardName} Report`}</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Filters</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {boardFilterOptions.map((boardOption) => {
              const isActive = boardOption.id === selectedBoardId;

              return (
                <TouchableOpacity
                  key={boardOption.id}
                  style={[styles.filterChip, isActive ? styles.filterChipActive : null]}
                  onPress={() => setSelectedBoardId(boardOption.id)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.filterChipText, isActive ? styles.filterChipTextActive : null]} numberOfLines={1}>
                    {boardOption.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Date range UI (Phase 2) removed */}
        </View>

        <View style={styles.grid}>
          <StatCard label="Total Tasks" value={metrics.totalTasks} />
          <StatCard label="Completed" value={metrics.doneTasks} helper={`${metrics.completionRate}% completion`} tone="success" />
          <StatCard label="In Progress" value={metrics.inProgressTasks} />
          <StatCard label="To Do" value={metrics.todoTasks} />
        </View>

        <View style={styles.alertRow}>
          <View style={[styles.alertCard, styles.alertCardWarning]}>
            <Text style={styles.alertLabel}>Overdue</Text>
            <Text style={styles.alertValue}>{metrics.overdueTasks}</Text>
          </View>
          <View style={[styles.alertCard, styles.alertCardNeutral]}>
            <Text style={styles.alertLabel}>Due Today</Text>
            <Text style={styles.alertValue}>{metrics.dueTodayTasks}</Text>
          </View>
          <View style={[styles.alertCard, styles.alertCardInfo]}>
            <Text style={styles.alertLabel}>Due This Week</Text>
            <Text style={styles.alertValue}>{metrics.dueThisWeekTasks}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status Distribution</Text>

          <View style={styles.rowItem}>
            <View style={styles.rowItemHeader}>
              <Text style={styles.rowItemLabel}>Done</Text>
              <Text style={styles.rowItemValue}>{metrics.doneTasks}</Text>
            </View>
            <ProgressBar value={metrics.totalTasks ? (metrics.doneTasks / metrics.totalTasks) * 100 : 0} color="#16a34a" />
          </View>

          <View style={styles.rowItem}>
            <View style={styles.rowItemHeader}>
              <Text style={styles.rowItemLabel}>In Progress</Text>
              <Text style={styles.rowItemValue}>{metrics.inProgressTasks}</Text>
            </View>
            <ProgressBar value={metrics.totalTasks ? (metrics.inProgressTasks / metrics.totalTasks) * 100 : 0} color="#3b82f6" />
          </View>

          <View style={styles.rowItem}>
            <View style={styles.rowItemHeader}>
              <Text style={styles.rowItemLabel}>To Do</Text>
              <Text style={styles.rowItemValue}>{metrics.todoTasks}</Text>
            </View>
            <ProgressBar value={metrics.totalTasks ? (metrics.todoTasks / metrics.totalTasks) * 100 : 0} color="#f59e0b" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Board Breakdown</Text>
          <View style={styles.boardHighlight}>
            <Text style={styles.boardHighlightLabel}>Most Pending Board</Text>
            <Text style={styles.boardHighlightTitle}>
              {metrics.boardMostPending ? metrics.boardMostPending.boardTitle : 'No board data'}
            </Text>
            <Text style={styles.boardHighlightValue}>
              {metrics.boardMostPending ? `${metrics.boardMostPending.pending} pending tasks` : '0 pending tasks'}
            </Text>
          </View>

          {metrics.boardSummaries.length ? (
            metrics.boardSummaries.map((board) => {
              const boardCompletionRate = board.total ? Math.round((board.done / board.total) * 100) : 0;

              return (
                <View key={board.boardId} style={styles.boardRow}>
                  <View style={styles.boardRowHeader}>
                    <Text style={styles.boardTitle} numberOfLines={1}>{board.boardTitle}</Text>
                    <Text style={styles.boardMeta}>{board.done}/{board.total} done</Text>
                  </View>
                  <ProgressBar value={boardCompletionRate} color="#15803d" />
                  <Text style={styles.boardFooter}>
                    {board.pending ? `${board.pending} pending` : 'All tasks done'}
                  </Text>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No task data yet</Text>
              <Text style={styles.emptySubtitle}>Create boards and tasks to start generating reports.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Export feedback modal removed to avoid intrusive messages after export */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: PALETTE.softWhite,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 120,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: PALETTE.black,
  },
  subtitle: {
    marginTop: 4,
    color: PALETTE.mutedInk,
    marginBottom: 14,
  },
  exportButton: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    backgroundColor: PALETTE.black,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 2,
  },
  exportButtonDisabled: {
    opacity: 0.7,
  },
  exportButtonText: {
    color: PALETTE.white,
    fontWeight: '700',
    fontSize: 13,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '48.5%',
    minHeight: 96,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.white,
    padding: 12,
  },
  statCardSuccess: {
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
  },
  statLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  statValue: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: '800',
    color: PALETTE.black,
  },
  statHelper: {
    marginTop: 6,
    color: '#15803d',
    fontWeight: '600',
    fontSize: 12,
  },
  alertRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  alertCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  alertCardWarning: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  alertCardInfo: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  alertCardNeutral: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
  },
  alertLabel: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 12,
  },
  alertValue: {
    marginTop: 6,
    color: '#0f172a',
    fontSize: 26,
    fontWeight: '800',
  },
  section: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.white,
    padding: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: PALETTE.black,
    marginBottom: 10,
  },
  filterRow: {
    gap: 8,
    paddingBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    maxWidth: 170,
  },
  filterChipActive: {
    backgroundColor: PALETTE.black,
    borderColor: PALETTE.black,
  },
  filterChipText: {
    color: '#334155',
    fontWeight: '600',
    fontSize: 12,
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  dateRangeHint: {
    marginTop: 2,
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
  },
  rowItem: {
    marginBottom: 10,
  },
  rowItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  rowItemLabel: {
    color: '#334155',
    fontWeight: '600',
  },
  rowItemValue: {
    color: '#0f172a',
    fontWeight: '700',
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  boardRow: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#f8fafc',
  },
  boardHighlight: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  boardHighlightLabel: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '700',
  },
  boardHighlightTitle: {
    marginTop: 4,
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 14,
  },
  boardHighlightValue: {
    marginTop: 4,
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  boardRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  boardTitle: {
    flex: 1,
    color: PALETTE.black,
    fontWeight: '700',
  },
  boardMeta: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 12,
  },
  boardFooter: {
    marginTop: 8,
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 14,
    backgroundColor: '#f8fafc',
  },
  emptyTitle: {
    color: PALETTE.black,
    fontWeight: '700',
  },
  emptySubtitle: {
    marginTop: 4,
    color: '#64748b',
  },
});
