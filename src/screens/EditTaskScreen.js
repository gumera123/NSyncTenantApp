
import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Alert,
  StyleSheet,
  Platform,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { formatDateToString, parseDateString } from '../utils/dateHelper';
import ConfirmDialog from '../components/ui/confirm-dialog';

export default function EditTaskScreen({ route, navigation }) {
  const { task } = route.params;

  const [title, setTitle] = useState(task.title || '');
  const [description, setDescription] = useState(task.description || '');
  const [status, setStatus] = useState(task.status || 'To Do');
  const [dueDate, setDueDate] = useState(parseDateString(task.dueDate || ''));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [showStatusOptions, setShowStatusOptions] = useState(false);

  const normalizeText = (value) => (value || '').trim();
  const hasTaskChanges = Boolean(
    normalizeText(title) !== normalizeText(task.title) ||
    normalizeText(description) !== normalizeText(task.description) ||
    status !== (task.status || 'To Do') ||
    formatDateToString(dueDate) !== (task.dueDate || '')
  );

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDueDate(selectedDate);
    }
  };

  const handleUpdateTask = async () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Task title is required.');
      return;
    }

    if (!dueDate) {
      Alert.alert('Validation Error', 'Due date is required.');
      return;
    }

    try {
      const taskRef = doc(db, 'tasks', task.id);
      await updateDoc(taskRef, {
        title: title.trim(),
        description: description.trim(),
        status,
        dueDate: formatDateToString(dueDate),
      });

      Alert.alert('Success', 'Task updated successfully.');
      navigation.goBack();
    } catch (error) {
      console.log('Update task error:', error);
      Alert.alert('Error', error.message);
    }
  };

  const handleDeleteTask = async () => {
    setConfirmDialog({
      title: 'Delete Task',
      message: 'Are you sure you want to delete this task?',
      confirmText: 'Delete',
      tone: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'tasks', task.id));
          Alert.alert('Success', 'Task deleted successfully.');
          navigation.goBack();
        } catch (error) {
          console.log('Delete task error:', error);
          Alert.alert('Error', error.message);
        }
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        

        <View style={styles.card}>
          <Text style={styles.label}>Task Title</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Task title" />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Description"
            multiline
          />

          <Text style={styles.label}>Status</Text>
          <View style={styles.pickerWrap}>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setShowStatusOptions((s) => !s)}
              activeOpacity={0.85}
            >
              <Text style={styles.dropdownText}>{status}</Text>
            </TouchableOpacity>

            {showStatusOptions ? (
              <View style={styles.dropdownList}>
                {['To Do', 'In Progress', 'Done'].map((opt, idx, arr) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.dropdownItem, idx === arr.length - 1 ? { borderBottomWidth: 0 } : null]}
                    onPress={() => {
                      setStatus(opt);
                      setShowStatusOptions(false);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>

          <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.dateLabel}>Due date</Text>
            <Text style={styles.dateValue}>{formatDateToString(dueDate)}</Text>
          </TouchableOpacity>

          {showDatePicker ? (
            <DateTimePicker
              value={dueDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
            />
          ) : null}

          {Platform.OS === 'ios' && showDatePicker ? (
            <TouchableOpacity style={styles.doneButton} onPress={() => setShowDatePicker(false)}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryButton, !hasTaskChanges && styles.buttonDisabled]}
            onPress={handleUpdateTask}
            disabled={!hasTaskChanges}
          >
            <Text style={styles.primaryButtonText}>Update Task</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteTask}>
            <Text style={styles.deleteButtonText}>Delete Task</Text>
          </TouchableOpacity>
        </View>

        <ConfirmDialog
          visible={Boolean(confirmDialog)}
          title={confirmDialog?.title}
          message={confirmDialog?.message}
          confirmText={confirmDialog?.confirmText}
          tone={confirmDialog?.tone}
          onCancel={() => setConfirmDialog(null)}
          onConfirm={async () => {
            const action = confirmDialog?.onConfirm;
            setConfirmDialog(null);
            if (action) {
              await action();
            }
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f6f8',
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 14,
    color: '#64748b',
  },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
  },
  label: {
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#dbe1ea',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    marginBottom: 10,
    color: '#0f172a',
  },
  multiline: {
    height: 96,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: '#dbe1ea',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    marginBottom: 10,
    overflow: 'hidden',
  },
  dropdownButton: {
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  dropdownText: {
    color: '#0f172a',
    fontWeight: '600',
  },
  dropdownList: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe1ea',
    borderRadius: 8,
    marginTop: 8,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownItemText: {
    color: '#0f172a',
    fontWeight: '600',
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#dbe1ea',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  dateLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  dateValue: {
    color: '#0f172a',
    fontWeight: '600',
  },
  doneButton: {
    height: 40,
    borderRadius: 10,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  doneButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  primaryButton: {
    height: 48,
    borderRadius: 10,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  deleteButton: {
    height: 48,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#dc2626',
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
