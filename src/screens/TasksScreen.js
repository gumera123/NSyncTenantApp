import React, { useEffect, useState, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Animated,
  PanResponder,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

const STATUSES = ['To Do', 'In Progress', 'Done'];

function DraggableTaskCard({
  item,
  navigation,
  getStatusColor,
  onDragStateChange,
  onDropTask,
}) {
  const pan = useRef(new Animated.ValueXY()).current;
  const isDraggingRef = useRef(false);
  const dragEnabledRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isLongPressed, setIsLongPressed] = useState(false);

  const resetDragState = useCallback(() => {
    dragEnabledRef.current = false;
    isDraggingRef.current = false;
    setIsDragging(false);
    setIsLongPressed(false);
    onDragStateChange(null, null);
  }, [onDragStateChange]);

  const animateBack = useCallback(() => {
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
      bounciness: 6,
    }).start();
  }, [pan]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (!dragEnabledRef.current) {
            return false;
          }

          return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
        },
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          if (!dragEnabledRef.current) {
            return false;
          }

          return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
        },
        onPanResponderGrant: () => {
          if (!dragEnabledRef.current) {
            return;
          }

          isDraggingRef.current = true;
          setIsDragging(true);
        },
        onPanResponderMove: (_, gestureState) => {
          if (!isDraggingRef.current) {
            return;
          }

          pan.setValue({ x: gestureState.dx, y: gestureState.dy });
          onDragStateChange(item.id, item.status, gestureState.moveY);
        },
        onPanResponderRelease: async (_, gestureState) => {
          const wasDragging = isDraggingRef.current;

          if (!wasDragging) {
            resetDragState();
            return;
          }

          await onDropTask(item, gestureState);
          animateBack();
          resetDragState();
        },
        onPanResponderTerminate: () => {
          animateBack();
          resetDragState();
        },
      }),
    [animateBack, item, onDragStateChange, onDropTask, pan, resetDragState]
  );

  return (
    <Animated.View
      style={[
        styles.cardWrap,
        {
          transform: pan.getTranslateTransform(),
          zIndex: isDragging ? 20 : 1,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        style={[
          styles.card,
          isDragging || isLongPressed ? styles.cardDragging : null,
        ]}
        onPress={() => navigation.navigate('EditTask', { task: item })}
        onLongPress={() => {
          dragEnabledRef.current = true;
          setIsLongPressed(true);
          onDragStateChange(item.id, item.status);
        }}
        onPressOut={() => {
          if (!isDraggingRef.current) {
            animateBack();
            resetDragState();
          }
        }}
        delayLongPress={250}
        activeOpacity={0.85}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.taskTitle}>{item.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>

        <Text style={styles.taskDescription}>{item.description || 'No description'}</Text>
        <Text style={styles.dueDate}>Due: {item.dueDate}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function TasksScreen({ route, navigation }) {
  const { board } = route.params;
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggingTaskId, setDraggingTaskId] = useState(null);
  const [hoveredStatus, setHoveredStatus] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const sectionRefs = useRef({});

  const fetchTasks = useCallback(async () => {
    if (!auth.currentUser) {
      setTasks([]);
      setLoading(false);
      return;
    }

    try {
      const q = query(
        collection(db, 'tasks'),
        where('boardId', '==', board.id)
      );

      const snapshot = await getDocs(q);
      const taskList = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }));

      setTasks(taskList);
    } catch (error) {
      console.log('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [board.id]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchTasks);
    return unsubscribe;
  }, [navigation, fetchTasks]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: board.title,
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate('AddTask', { board })}>
          <Text style={styles.headerButton}>+ Task</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, board]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'To Do':
        return '#f59e0b';
      case 'In Progress':
        return '#3b82f6';
      case 'Done':
        return '#16a34a';
      default:
        return '#64748b';
    }
  };

  const measureSection = useCallback((status) => {
    const sectionRef = sectionRefs.current[status];

    return new Promise((resolve) => {
      if (!sectionRef?.measureInWindow) {
        resolve(null);
        return;
      }

      sectionRef.measureInWindow((x, y, width, height) => {
        resolve({ status, x, y, width, height });
      });
    });
  }, []);

  const getDropStatusFromPosition = useCallback(
    async (moveY) => {
      const measurements = await Promise.all(STATUSES.map((status) => measureSection(status)));
      const target = measurements.find(
        (section) => section && moveY >= section.y && moveY <= section.y + section.height
      );

      return target?.status ?? null;
    },
    [measureSection]
  );

  const updateTaskStatus = useCallback(async (task, newStatus) => {
    if (!newStatus || newStatus === task.status) {
      return;
    }

    const previousStatus = task.status;
    setUpdatingTaskId(task.id);
    setTasks((currentTasks) =>
      currentTasks.map((currentTask) =>
        currentTask.id === task.id ? { ...currentTask, status: newStatus } : currentTask
      )
    );

    try {
      await updateDoc(doc(db, 'tasks', task.id), {
        status: newStatus,
      });
    } catch (error) {
      console.log('Error updating task status:', error);
      setTasks((currentTasks) =>
        currentTasks.map((currentTask) =>
          currentTask.id === task.id ? { ...currentTask, status: previousStatus } : currentTask
        )
      );
      Alert.alert('Update failed', 'We could not move this task right now. Please try again.');
    } finally {
      setUpdatingTaskId(null);
    }
  }, []);

  const handleDragStateChange = useCallback(
    async (taskId, currentStatus, moveY) => {
      const dragging = Boolean(taskId);
      setDraggingTaskId(taskId);
      setIsDragging(dragging);

      if (!dragging) {
        setHoveredStatus(null);
        return;
      }

      if (typeof moveY === 'number') {
        const targetStatus = await getDropStatusFromPosition(moveY);
        setHoveredStatus(targetStatus ?? currentStatus);
        return;
      }

      setHoveredStatus(currentStatus);
    },
    [getDropStatusFromPosition]
  );

  const handleDropTask = useCallback(
    async (task, gestureState) => {
      const targetStatus = await getDropStatusFromPosition(gestureState.moveY);
      setHoveredStatus(null);

      if (!targetStatus) {
        return;
      }

      await updateTaskStatus(task, targetStatus);
    },
    [getDropStatusFromPosition, updateTaskStatus]
  );

  const renderTaskCard = (item) => (
    <DraggableTaskCard
      key={item.id}
      item={item}
      navigation={navigation}
      getStatusColor={getStatusColor}
      onDragStateChange={handleDragStateChange}
      onDropTask={handleDropTask}
    />
  );

  const renderSection = (title, data) => {
    const isActiveDropZone = hoveredStatus === title && draggingTaskId !== null;

    return (
      <View
        style={[styles.section, isActiveDropZone ? styles.sectionActive : null]}
        key={title}
        ref={(ref) => {
          sectionRefs.current[title] = ref;
        }}
        collapsable={false}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        {data.length > 0 ? (
          data.map(renderTaskCard)
        ) : (
          <View style={[styles.emptyDropZone, isActiveDropZone ? styles.emptyDropZoneActive : null]}>
            <Text style={styles.emptyText}>Drop a task here or add a new one.</Text>
          </View>
        )}
      </View>
    );
  };

  const todoTasks = tasks.filter((task) => task.status === 'To Do');
  const inProgressTasks = tasks.filter((task) => task.status === 'In Progress');
  const doneTasks = tasks.filter((task) => task.status === 'Done');

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        scrollEnabled={!isDragging}
      >
        <View style={styles.titleCard}>
          <Text style={styles.pageTitle}>{board.title}</Text>
          <Text style={styles.pageSubtitle}>Drag task cards into To Do, In Progress, or Done.</Text>
        </View>

        {updatingTaskId ? (
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerText}>Saving task status...</Text>
          </View>
        ) : null}

        {tasks.length === 0 ? (
          <View style={styles.emptyMain}>
            <Text style={styles.emptyMainTitle}>No tasks yet</Text>
            <Text style={styles.emptyMainSubtitle}>Tap + Task to create your first task.</Text>
          </View>
        ) : (
          <>
            {renderSection('To Do', todoTasks)}
            {renderSection('In Progress', inProgressTasks)}
            {renderSection('Done', doneTasks)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f6f8',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  headerButton: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 15,
  },
  titleCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 14,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  pageSubtitle: {
    marginTop: 4,
    color: '#64748b',
  },
  infoBanner: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  infoBannerText: {
    color: '#1d4ed8',
    fontWeight: '600',
  },
  section: {
    marginBottom: 14,
    borderRadius: 14,
    padding: 4,
  },
  sectionActive: {
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#7dd3fc',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  emptyDropZone: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    padding: 16,
  },
  emptyDropZoneActive: {
    borderColor: '#0ea5e9',
    backgroundColor: '#f0f9ff',
  },
  cardWrap: {
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  cardDragging: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    borderColor: '#93c5fd',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  taskDescription: {
    marginTop: 6,
    color: '#64748b',
    lineHeight: 20,
  },
  dueDate: {
    marginTop: 8,
    color: '#334155',
    fontWeight: '600',
    fontSize: 13,
  },
  emptyText: {
    color: '#64748b',
    fontStyle: 'italic',
  },
  emptyMain: {
    alignItems: 'center',
    paddingTop: 16,
  },
  emptyMainTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptyMainSubtitle: {
    marginTop: 6,
    color: '#64748b',
    textAlign: 'center',
  },
});
