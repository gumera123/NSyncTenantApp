import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { collection, getDocs, query, where, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { createWorkspaceInvite } from '../utils/workspaceInvite';

export default function BoardsScreen({ navigation }) {
  const [boards, setBoards] = useState([]);
  const [favoriteBoards, setFavoriteBoards] = useState({});
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Member');
  const [inviteLoading, setInviteLoading] = useState(false);

  const currentUserId = auth.currentUser?.uid;
  const normalizedRole = (userData?.role || '').trim().toLowerCase();
  const isWorkspaceOwner = (userData?.organizationId || '') === (currentUserId || '');
  const isAdmin = normalizedRole === 'admin' || isWorkspaceOwner;
  const workspaceTitle =
    userData?.organizationName?.trim() ||
    userData?.teamName?.trim() ||
    userData?.name?.trim() ||
    'Workspace';

  const fetchBoards = useCallback(async () => {
    if (!auth.currentUser) {
      setBoards([]);
      setLoading(false);
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userProfile = userDoc.exists() ? userDoc.data() : null;
      const organizationId = userProfile?.organizationId || auth.currentUser.uid;

      const [workspaceBoardsSnapshot, legacyBoardsSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'boards'), where('organizationId', '==', organizationId))),
        getDocs(query(collection(db, 'boards'), where('userId', '==', organizationId))),
      ]);

      const mergedBoards = [...workspaceBoardsSnapshot.docs, ...legacyBoardsSnapshot.docs];
      const uniqueBoards = [];
      const seenBoardIds = new Set();

      mergedBoards.forEach((docItem) => {
        if (seenBoardIds.has(docItem.id)) {
          return;
        }

        seenBoardIds.add(docItem.id);
        uniqueBoards.push({
          id: docItem.id,
          ...docItem.data(),
        });
      });

      setBoards(uniqueBoards);
    } catch (error) {
      console.log('Error fetching boards:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCurrentUserData = useCallback(async () => {
    if (!auth.currentUser) {
      setUserData(null);
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        setUserData(userDoc.data());
      }
    } catch (error) {
      console.log('Error fetching current user:', error);
    }
  }, []);

  const handleDeleteBoard = async (boardId) => {
    try {
      await deleteDoc(doc(db, 'boards', boardId));
      Alert.alert('Success', 'Board deleted.');
      fetchBoards();
    } catch (error) {
      console.log(error);
      Alert.alert('Error', error.message);
    }
  };

  const handleDeleteBoardWithConfirm = (board) => {
    Alert.alert(
      'Delete Board',
      `Are you sure you want to delete "${board.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDeleteBoard(board.id),
        },
      ]
    );
  };

  useEffect(() => {
    Promise.all([fetchBoards(), fetchCurrentUserData()]).catch((error) => {
      console.log('Error loading boards home data:', error);
    });

    const unsubscribe = navigation.addListener('focus', async () => {
      await Promise.all([fetchBoards(), fetchCurrentUserData()]);
    });
    return unsubscribe;
  }, [navigation, fetchBoards, fetchCurrentUserData]);

  const handleInviteMember = async () => {
    if (!auth.currentUser || !isAdmin) {
      Alert.alert('Admin Only', 'Only workspace admins can send invitations.');
      return;
    }

    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return;
    }

    try {
      setInviteLoading(true);

      await createWorkspaceInvite({
        invitedEmail: inviteEmail,
        role: inviteRole,
        invitedByUid: auth.currentUser.uid,
        invitedByName: userData?.name || '',
        organizationId: userData?.organizationId || auth.currentUser.uid,
        organizationName: userData?.organizationName || userData?.name || 'Workspace',
      });

      setInviteEmail('');
      setInviteRole('Member');
      setShowInviteModal(false);
      Alert.alert('Success', 'Invitation sent.');
    } catch (error) {
      console.log('Error inviting member:', error);
      Alert.alert('Error', error.message);
    } finally {
      setInviteLoading(false);
    }
  };

  const filteredBoards = boards.filter((board) => {
    const title = board.title?.toLowerCase() || '';
    const description = board.description?.toLowerCase() || '';
    const queryText = searchQuery.toLowerCase();
    return title.includes(queryText) || description.includes(queryText);
  });

  const sortedBoards = [...filteredBoards].sort((left, right) => {
    const leftFavorite = favoriteBoards[left.id] ? 1 : 0;
    const rightFavorite = favoriteBoards[right.id] ? 1 : 0;

    if (leftFavorite !== rightFavorite) {
      return rightFavorite - leftFavorite;
    }

    const leftTitle = (left.title || '').toLowerCase();
    const rightTitle = (right.title || '').toLowerCase();
    return leftTitle.localeCompare(rightTitle);
  });

  const toggleFavorite = (boardId) => {
    setFavoriteBoards((currentFavorites) => ({
      ...currentFavorites,
      [boardId]: !currentFavorites[boardId],
    }));
  };

  const renderBoard = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('Tasks', { board: item })}
      activeOpacity={0.85}
    >
      <View style={styles.cardImageColumn}>
        {item.boardImageUrl ? (
          <Image source={{ uri: item.boardImageUrl }} style={styles.boardImage} />
        ) : (
          <View style={styles.boardImagePlaceholder}>
            <Ionicons name="layers-outline" size={30} color="#111827" />
          </View>
        )}
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.boardTitle} numberOfLines={1}>{item.title}</Text>

        <Text style={styles.boardDescription} numberOfLines={2}>
          {item.description || 'Workspace overview and task tracking.'}
        </Text>

        <View style={styles.actionRow}>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity
              style={[styles.favoriteButton, favoriteBoards[item.id] && styles.favoriteButtonActive]}
              onPress={() => toggleFavorite(item.id)}
            >
              <Ionicons 
                name={favoriteBoards[item.id] ? 'bookmark' : 'bookmark-outline'} 
                size={18} 
                color={favoriteBoards[item.id] ? '#ffffff' : '#111827'} 
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('EditBoard', { board: item })}>
              <Ionicons name="create-outline" size={18} color="#111827" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconButton, styles.deleteIconButton]}
              onPress={(event) => {
                event.stopPropagation();
                handleDeleteBoardWithConfirm(item);
              }}
            >
              <Ionicons name="trash-outline" size={18} color="#dc2626" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.primaryAction} onPress={() => navigation.navigate('Tasks', { board: item })}>
            <Text style={styles.primaryActionText}>Open Board</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

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
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.pageTitle}>{workspaceTitle}</Text>
            <Text style={styles.pageSubtitle}>Your workspaces</Text>
          </View>

          <TouchableOpacity
            style={styles.searchIconButton}
            onPress={() => setShowSearchInput((currentValue) => !currentValue)}
            activeOpacity={0.85}
          >
            <Ionicons name="search-outline" size={20} color="#111827" />
          </TouchableOpacity>
        </View>

        {showSearchInput ? (
          <TextInput
            style={styles.searchInput}
            placeholder="Search boards"
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
        ) : null}

        <TouchableOpacity style={styles.inviteButton} onPress={() => setShowInviteModal(true)}>
          <Ionicons name="person-add-outline" size={17} color="#ffffff" />
          <Text style={styles.inviteButtonText}>Invite Members</Text>
        </TouchableOpacity>

        <FlatList
          data={sortedBoards}
          keyExtractor={(item) => item.id}
          renderItem={renderBoard}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No boards found</Text>
              <Text style={styles.emptySub}>Create a board or adjust your search query.</Text>
            </View>
          }
          contentContainerStyle={sortedBoards.length === 0 ? styles.emptyContainer : styles.listContent}
          showsVerticalScrollIndicator={false}
        />

        <Modal
          visible={showInviteModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowInviteModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Invite Member</Text>

              <Text style={styles.modalLabel}>Registered Member Email</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="member@example.com"
                placeholderTextColor="#94a3b8"
                value={inviteEmail}
                onChangeText={setInviteEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!inviteLoading}
              />

              <Text style={styles.modalLabel}>Role</Text>
              <View style={styles.modalPickerWrap}>
                <Picker
                  selectedValue={inviteRole}
                  onValueChange={(value) => setInviteRole(value)}
                  enabled={!inviteLoading}
                >
                  <Picker.Item label="Member" value="Member" />
                  <Picker.Item label="Manager" value="Manager" />
                  <Picker.Item label="Editor" value="Editor" />
                  <Picker.Item label="Viewer" value="Viewer" />
                </Picker>
              </View>

              <TouchableOpacity
                style={[styles.modalPrimaryButton, inviteLoading && styles.modalPrimaryButtonDisabled]}
                onPress={handleInviteMember}
                disabled={inviteLoading}
              >
                <Text style={styles.modalPrimaryButtonText}>{inviteLoading ? 'Sending...' : 'Send Invite'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalClose} onPress={() => setShowInviteModal(false)}>
                <Text style={styles.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
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
    paddingBottom: 112,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  pageSubtitle: {
    marginTop: 4,
    color: '#64748b',
  },
  searchIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#dbe1ea',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInput: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbe1ea',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    marginBottom: 12,
    color: '#0f172a',
  },
  inviteButton: {
    height: 44,
    borderRadius: 10,
    backgroundColor: '#111827',
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  inviteButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    marginBottom: 12,
    flexDirection: 'row',
    minHeight: 154,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardImageColumn: {
    width: 118,
    position: 'relative',
  },
  boardImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  boardImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  placeholderText: {
    color: '#64748b',
    fontSize: 13,
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  boardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  boardDescription: {
    marginTop: 4,
    color: '#64748b',
    lineHeight: 19,
    fontSize: 13,
  },
  actionRow: {
    marginTop: 12,
    gap: 8,
  },
  quickActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  favoriteButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#dbe1ea',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteButtonActive: {
    borderColor: '#111827',
    backgroundColor: '#111827',
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#dbe1ea',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteIconButton: {
    borderColor: '#fecaca',
    backgroundColor: '#fff5f5',
  },
  primaryAction: {
    height: 38,
    borderRadius: 19,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  imageBadge: {
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
  },
  modalClose: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#64748b',
    fontWeight: '600',
  },
  modalLabel: {
    color: '#0f172a',
    fontWeight: '600',
    marginBottom: 6,
  },
  modalInput: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbe1ea',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    marginBottom: 10,
    color: '#0f172a',
  },
  modalPickerWrap: {
    borderWidth: 1,
    borderColor: '#dbe1ea',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    marginBottom: 10,
    overflow: 'hidden',
  },
  modalPrimaryButton: {
    height: 44,
    borderRadius: 10,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  modalPrimaryButtonDisabled: {
    opacity: 0.7,
  },
  modalPrimaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
