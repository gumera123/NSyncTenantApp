import React, { useEffect, useState, useLayoutEffect } from 'react';

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';


export default function TasksScreen({ route, navigation }) {
  const { board } = route.params;
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentUserId = auth.currentUser?.uid;

  const fetchTasks = async () => {
    if (!auth.currentUser) {
      setTasks([]);
      setLoading(false);
      return;
    }

    try {
      const q = query(
        collection(db, 'tasks'),
        where('boardId', '==', board.id),
        where('userId', '==', currentUserId)
      );

      const snapshot = await getDocs(q);
      const taskList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setTasks(taskList);
    } catch (error) {
      console.log('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchTasks);
    return unsubscribe;
  }, [navigation, currentUserId, board]);

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

  const todoTasks = tasks.filter((task) => task.status === 'To Do');
  const inProgressTasks = tasks.filter((task) => task.status === 'In Progress');
  const doneTasks = tasks.filter((task) => task.status === 'Done');

  const getStatusColor = (status) => {
  switch (status) {
    case 'To Do':
      return '#f59e0b'; // yellow
    case 'In Progress':
      return '#3b82f6'; // blue
    case 'Done':
      return '#10b981'; // green
    default:
      return '#6b7280';
  }
};

const renderTaskCard = (item) => (
  <TouchableOpacity
    key={item.id}
    style={styles.card}
    onPress={() => navigation.navigate('EditTask', { task: item })}
  >
    <View style={styles.cardHeader}>
      <Text style={styles.taskTitle}>{item.title}</Text>
      <View
        style={[
          styles.statusBadge,
          { backgroundColor: getStatusColor(item.status) },
        ]}
      >
        <Text style={styles.statusText}>{item.status}</Text>
      </View>
    </View>

    <Text style={styles.taskDescription}>
      {item.description || 'No description'}
    </Text>

    <Text style={styles.dueDate}>📅 {item.dueDate}</Text>
  </TouchableOpacity>
);

  const renderSection = (title, data) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {data.length > 0 ? (
        data.map(renderTaskCard)
      ) : (
        <Text style={styles.emptyText}>No tasks here.</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <LinearGradient
          colors={['#ffffff', '#f8f9ff', '#f0f0ff']}
          style={styles.container}
        >
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#7c3aed" />
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <LinearGradient
        colors={['#ffffff', '#f8f9ff', '#f0f0ff']}
        style={styles.container}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <View style={styles.tasksHeader}>
            <Text style={styles.tasksTitle}>{board.title}</Text>
            <Text style={styles.tasksSubtitle}>A clean overview of your current work.</Text>
          </View>
          {tasks.length === 0 ? (
            <Text style={styles.emptyMessage}>
              No tasks yet. Tap + Task to create one.
            </Text>
          ) : (
        <>
          {renderSection('To Do', todoTasks)}
          {renderSection('In Progress', inProgressTasks)}
          {renderSection('Done', doneTasks)}
        </>
      )}
    </ScrollView>
    </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef2ff',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 30,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButton: {
    color: '#7c3aed',
    fontWeight: 'bold',
    fontSize: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    color: '#7c3aed',
  },
  card: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 25,
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  taskDescription: {
    color: '#64748b',
    marginTop: 4,
  },
  dueDate: {
    marginTop: 8,
    color: '#475569',
    fontWeight: '500',
  },
  emptyText: {
    color: '#94a3b8',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  emptyMessage: {
    textAlign: 'center',
    color: '#475569',
    marginTop: 20,
    fontSize: 16,
    lineHeight: 24,
  },
  emptyMain: {
    color: '#64748b',
    fontSize: 16,
  },
  tasksHeader: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 22,
    borderRadius: 28,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 8,
  },
  tasksTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1e293b',
  },
  tasksSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#7c3aed',
    lineHeight: 22,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

statusBadge: {
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: 20,
},

statusText: {
  color: '#fff',
  fontSize: 13,
  fontWeight: '600',
},

});

