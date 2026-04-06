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
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';

export default function BoardsScreen({ navigation }) {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBoard, setSelectedBoard] = useState(null);
  const [showBoardModal, setShowBoardModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const currentUserId = auth.currentUser?.uid;
  const userPhotoUrl = auth.currentUser?.photoURL;
  const userInitial = (auth.currentUser?.displayName || 'U').charAt(0).toUpperCase();

  const fetchBoards = useCallback(async () => {
    if (!auth.currentUser) {
      setBoards([]);
      setLoading(false);
      return;
    }

    try {
      const q = query(
        collection(db, 'boards'),
        where('userId', '==', currentUserId)
      );

      const snapshot = await getDocs(q);
      const boardList = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }));

      setBoards(boardList);
    } catch (error) {
      console.log('Error fetching boards:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  const handleDeleteBoard = async (boardId) => {
    try {
      await deleteDoc(doc(db, 'boards', boardId));
      Alert.alert('Success', 'Board deleted');
      fetchBoards();
    } catch (error) {
      console.log(error);
      Alert.alert('Error', error.message);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchBoards);
    return unsubscribe;
  }, [navigation, currentUserId, fetchBoards]);

  const filteredBoards = boards.filter((board) =>
    board.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    board.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderBoard = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
        setSelectedBoard(item);
        setShowBoardModal(true);
      }}
      activeOpacity={0.7}
    >
      <View style={styles.imageContainer}>
        {item.boardImageUrl ? (
          <Image source={{ uri: item.boardImageUrl }} style={styles.boardImage} />
        ) : (
          <View style={styles.boardImagePlaceholder}>
            <Text style={styles.placeholderText}>No cover</Text>
          </View>
        )}
        <View style={styles.imageOverlay} />
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardTag}>
          <Text style={styles.cardTagText}>Workspace</Text>
        </View>
        <Text style={styles.boardTitle}>{item.title}</Text>
        <Text style={styles.boardDescription}>
          {item.description || 'No description'}
        </Text>
      </View>
    </TouchableOpacity>
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
            <ActivityIndicator size="large" />
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <LinearGradient
        colors={['#f8f9ff', '#eef2ff']}
        style={styles.container}
      >
        <LinearGradient
          colors={['#1e3a8a', '#7c3aed']}
          start={[0, 0]}
          end={[1, 1]}
          style={styles.header}
        >
          <View style={styles.headerLeft}>
            <Text style={styles.pageTitle}>Boards</Text>
            <Text style={styles.pageSubtitle}>Your workspaces</Text>
          </View>
          <TouchableOpacity
            style={styles.profileAvatarWrapper}
            onPress={() => navigation.navigate('Profile')}
          >
            {userPhotoUrl ? (
              <Image
                source={{ uri: userPhotoUrl }}
                style={styles.profileAvatarImage}
              />
            ) : (
              <View style={styles.profileAvatarFallback}>
                <Text style={styles.profileAvatarFallbackText}>{userInitial}</Text>
              </View>
            )}
          </TouchableOpacity>
        </LinearGradient>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('AddBoard')}
          >
            <Text style={styles.actionCardLabel}>New Workspace</Text>
            <Text style={styles.actionCardValue}>Create a board</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => setShowSearch((prev) => !prev)}
          >
            <Text style={styles.actionCardLabel}>Search Boards</Text>
            <Text style={styles.actionCardValue}>Filter your list</Text>
          </TouchableOpacity>
        </View>

        {showSearch && (
          <View style={styles.searchBar}> 
            <TextInput
              style={styles.searchInput}
              placeholder="Search boards..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />
          </View>
        )}

      <FlatList
        data={filteredBoards}
        keyExtractor={(item) => item.id}
        renderItem={renderBoard}
        ListEmptyComponent={
          <View style={styles.emptyWrapper}>
            <Text style={styles.emptyTitle}>No boards found</Text>
            <Text style={styles.emptySubtitle}>
              Create a workspace or clear your search filter.
            </Text>
          </View>
        }
        contentContainerStyle={filteredBoards.length === 0 ? styles.emptyContainer : styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      {/* Board Action Modal */}
      <Modal
        visible={showBoardModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBoardModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowBoardModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{selectedBoard?.title}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setShowBoardModal(false);
                navigation.navigate('Tasks', { board: selectedBoard });
              }}
            >
              <Text style={styles.modalButtonText}>Open</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setShowBoardModal(false);
                navigation.navigate('EditBoard', { board: selectedBoard });
              }}
            >
              <Text style={styles.modalButtonText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.deleteButton]}
              onPress={() => {
                setShowBoardModal(false);
                handleDeleteBoard(selectedBoard.id);
              }}
            >
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowBoardModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef2ff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    padding: 24,
    borderRadius: 32,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  headerLeft: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 16,
    color: '#dbeafe',
    fontWeight: '600',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.12)',
    marginBottom: 18,
    overflow: 'hidden',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 6,
  },
  imageContainer: {
    position: 'relative',
  },
  boardImage: {
    width: '100%',
    height: 120,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
  },
  boardImagePlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: '#ede9fe',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
  },
  placeholderText: {
    color: '#cbd5e1',
    fontSize: 15,
    fontWeight: '500',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(124, 58, 237, 0.14)',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
  },
  cardContent: {
    padding: 18,
  },
  cardTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  cardTagText: {
    color: '#4338ca',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  boardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  boardDescription: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginTop: 8,
  },
  profileAvatarWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  profileAvatarImage: {
    width: '100%',
    height: '100%',
  },
  profileAvatarFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  profileAvatarFallbackText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 14,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 4,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  actionCardLabel: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  actionCardValue: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
  },
  searchBar: {
    marginHorizontal: 16,
    marginBottom: 18,
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  searchInput: {
    fontSize: 16,
    color: '#0f172a',
    padding: 0,
  },
  emptyWrapper: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    minHeight: 320,
  },
  modalHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: '#f8fafc',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  deleteButton: {
    backgroundColor: '#fef2f2',
  },
  deleteButtonText: {
    color: '#dc2626',
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
    marginTop: 12,
  },
  cancelButtonText: {
    color: '#64748b',
  },
});