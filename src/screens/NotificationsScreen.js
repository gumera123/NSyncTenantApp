import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { auth } from '../../firebaseConfig';
import {
  deleteNotificationById,
  deleteAllNotificationsForUser,
  loadUserNotifications,
  markNotificationsAsRead,
  normalizeEmail,
  respondToWorkspaceInvite,
} from '../utils/workspaceInvite';
import TeamChatScreen from './TeamChatScreen';
import ConfirmDialog from '../components/ui/confirm-dialog';

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteResponseLoadingId, setInviteResponseLoadingId] = useState('');
  const [deletingNotificationId, setDeletingNotificationId] = useState('');
  const [clearingAll, setClearingAll] = useState(false);
  const [activeTab, setActiveTab] = useState('notifications');
  const [confirmDialog, setConfirmDialog] = useState(null);

  const currentUserEmail = normalizeEmail(auth.currentUser?.email || '');

  const formatNotificationTime = (createdAt) => {
    const seconds = createdAt?.seconds;

    if (!seconds) {
      return 'Just now';
    }

    return new Date(seconds * 1000).toLocaleString();
  };

  const isPendingInviteNotification = (notification) => {
    const inviteId = notification?.metadata?.inviteId;
    const response = notification?.response;
    const type = notification?.type;
    const invitedEmail = normalizeEmail(notification?.metadata?.invitedEmail || '');

    return (
      type === 'invite_received' &&
      !!inviteId &&
      !response &&
      !!currentUserEmail &&
      invitedEmail === currentUserEmail
    );
  };

  const fetchNotifications = useCallback(async () => {
    if (!auth.currentUser?.uid) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const userNotifications = await loadUserNotifications(auth.currentUser.uid);
      setNotifications(userNotifications);

      const unreadNotificationIds = userNotifications
        .filter((notification) => !notification.isRead)
        .map((notification) => notification.id);

      if (unreadNotificationIds.length > 0) {
        await markNotificationsAsRead(unreadNotificationIds);
        setNotifications((currentNotifications) =>
          currentNotifications.map((notification) =>
            unreadNotificationIds.includes(notification.id)
              ? { ...notification, isRead: true }
              : notification
          )
        );
      }
    } catch (error) {
      console.log('Error fetching notifications:', error);
      Alert.alert('Error', 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications])
  );

  useEffect(() => {
    navigation.setParams({ activeTab });
  }, [navigation, activeTab]);

  const handleInvitationResponse = async (notification, response) => {
    if (!auth.currentUser?.uid) {
      Alert.alert('Error', 'You need to be signed in to respond to invites.');
      return;
    }

    try {
      setInviteResponseLoadingId(notification.id);

      await respondToWorkspaceInvite({
        inviteId: notification?.metadata?.inviteId,
        notificationId: notification.id,
        userUid: auth.currentUser.uid,
        response,
      });

      await fetchNotifications();

      Alert.alert(
        'Invitation updated',
        response === 'accepted'
          ? 'You joined the workspace successfully.'
          : 'You declined the workspace invitation.'
      );
    } catch (error) {
      console.log('Error responding to invitation:', error);
      Alert.alert('Error', error.message);
    } finally {
      setInviteResponseLoadingId('');
    }
  };

  const handleDeleteNotification = async (notification) => {
    if (isPendingInviteNotification(notification)) {
      Alert.alert('Action required', 'Accept or decline this invitation before deleting it.');
      return;
    }

    try {
      setDeletingNotificationId(notification.id);
      await deleteNotificationById(notification.id);
      setNotifications((currentNotifications) =>
        currentNotifications.filter((currentNotification) => currentNotification.id !== notification.id)
      );
    } catch (error) {
      console.log('Error deleting notification:', error);
      Alert.alert('Error', error.message);
    } finally {
      setDeletingNotificationId('');
    }
  };

  const handleClearAllNotifications = () => {
    if (!auth.currentUser?.uid) {
      Alert.alert('Error', 'You need to be signed in to clear notifications.');
      return;
    }

    setConfirmDialog({
      title: 'Clear Notifications',
      message: 'Remove all notifications for your account?',
      confirmText: 'Clear all',
      tone: 'danger',
      onConfirm: async () => {
        try {
          setClearingAll(true);
          await deleteAllNotificationsForUser(auth.currentUser.uid);
          setNotifications([]);
        } catch (error) {
          console.log('Error clearing notifications:', error);
          Alert.alert('Error', error.message);
        } finally {
          setClearingAll(false);
        }
      },
    });
  };

  const renderRightActions = (notification) => (
    <TouchableOpacity
      style={[
        styles.deleteAction,
        deletingNotificationId === notification.id && styles.deleteActionDisabled,
      ]}
      onPress={() => handleDeleteNotification(notification)}
      disabled={deletingNotificationId === notification.id}
    >
      <Ionicons name="trash-outline" size={18} color="#fff" />
      <Text style={styles.deleteActionText}>
        {deletingNotificationId === notification.id ? 'Deleting...' : 'Delete'}
      </Text>
    </TouchableOpacity>
  );

  const renderNotification = ({ item }) => {
    const isPendingInvite = isPendingInviteNotification(item);
    const isBusy = inviteResponseLoadingId === item.id || deletingNotificationId === item.id;

    const content = (
      <View
        style={[
          styles.notificationCard,
          !item.isRead && styles.notificationCardUnread,
        ]}
      >
        <View style={styles.notificationTopRow}>
          <View style={[styles.notificationDot, !item.isRead && styles.notificationDotUnread]} />
          <View style={styles.notificationContent}>
            <Text style={styles.notificationTitle}>{item.title || 'Notification'}</Text>
            <Text style={styles.notificationMessage}>{item.message || ''}</Text>
            <Text style={styles.notificationTime}>{formatNotificationTime(item.createdAt)}</Text>
            {isPendingInvite ? (
              <View style={styles.notificationActionsRow}>
                <TouchableOpacity
                  style={[styles.notificationSecondaryButton, isBusy && styles.buttonDisabled]}
                  onPress={() => handleInvitationResponse(item, 'declined')}
                  disabled={isBusy}
                >
                  <Text style={styles.notificationSecondaryButtonText}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.notificationPrimaryButton, isBusy && styles.buttonDisabled]}
                  onPress={() => handleInvitationResponse(item, 'accepted')}
                  disabled={isBusy}
                >
                  <Text style={styles.notificationPrimaryButtonText}>
                    {inviteResponseLoadingId === item.id ? 'Saving...' : 'Accept'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.swipeHint}>Swipe left to delete</Text>
            )}
          </View>
        </View>
      </View>
    );

    if (isPendingInvite) {
      return content;
    }

    return (
      <Swipeable renderRightActions={() => renderRightActions(item)} overshootRight={false}>
        {content}
      </Swipeable>
    );
  };

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

      {activeTab === 'teamChat' ? (
        <>
          <View style={styles.backHeaderContainer}>
            <TouchableOpacity
              onPress={() => setActiveTab('notifications')}
              activeOpacity={0.7}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.backHeaderTitle}>Team Chat</Text>
            <View style={styles.backButtonPlaceholder} />
          </View>
          <TeamChatScreen />
        </>
      ) : (
        <View style={styles.notificationsWrapper}>
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'notifications' ? styles.tabButtonActive : null]}
              onPress={() => setActiveTab('notifications')}
              activeOpacity={0.85}
            >
              <Ionicons name="notifications" size={18} color={activeTab === 'notifications' ? '#ffffff' : '#64748b'} />
              <Text style={[styles.tabButtonText, activeTab === 'notifications' ? styles.tabButtonTextActive : null]}>Notifications</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'teamChat' ? styles.tabButtonActive : null]}
              onPress={() => setActiveTab('teamChat')}
              activeOpacity={0.85}
            >
              <Ionicons name="chatbubble-outline" size={18} color={activeTab === 'teamChat' ? '#ffffff' : '#64748b'} />
              <Text style={[styles.tabButtonText, activeTab === 'teamChat' ? styles.tabButtonTextActive : null]}>Team Chat</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.container}>
            <View style={styles.headerRow}>
              <View style={styles.headerTextWrap}>
                <Text style={styles.pageTitle}>Notifications</Text>
                <Text style={styles.pageSubtitle}>Workspace updates, invites, and activity.</Text>
              </View>
              {notifications.length > 0 ? (
                <TouchableOpacity
                  style={[styles.clearAllButton, clearingAll && styles.buttonDisabled]}
                  onPress={handleClearAllNotifications}
                  disabled={clearingAll}
                >
                  <Text style={styles.clearAllButtonText}>{clearingAll ? 'Clearing...' : 'Clear all'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id}
              renderItem={renderNotification}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No notifications yet</Text>
                  <Text style={styles.emptySub}>New activity and invitations will show up here.</Text>
                </View>
              }
            />
          </View>
        </View>
      )}

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f6f8',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerTextWrap: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  pageSubtitle: {
    marginTop: 4,
    marginBottom: 14,
    color: '#64748b',
  },
  clearAllButton: {
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff5f5',
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearAllButtonText: {
    color: '#dc2626',
    fontWeight: '700',
    fontSize: 13,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '700',
  },
  emptySub: {
    marginTop: 6,
    color: '#64748b',
    textAlign: 'center',
  },
  notificationCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 14,
    marginBottom: 10,
  },
  notificationCardUnread: {
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
  },
  notificationTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#cbd5e1',
    marginTop: 6,
    marginRight: 12,
  },
  notificationDotUnread: {
    backgroundColor: '#16a34a',
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 16,
  },
  notificationMessage: {
    color: '#475569',
    fontSize: 14,
    marginTop: 6,
    lineHeight: 22,
  },
  notificationTime: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 10,
  },
  notificationActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  notificationPrimaryButton: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationPrimaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  notificationSecondaryButton: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe1ea',
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationSecondaryButtonText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 13,
  },
  deleteAction: {
    width: 104,
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  deleteActionDisabled: {
    opacity: 0.7,
  },
  deleteActionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  swipeHint: {
    marginTop: 12,
    color: '#94a3b8',
    fontSize: 12,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  tabButtonActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  tabButtonTextActive: {
    color: '#ffffff',
  },
  notificationsWrapper: {
    flex: 1,
  },
  backHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  backButton: {
    padding: 6,
  },
  backHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  backButtonPlaceholder: {
    width: 36,
  },
});
