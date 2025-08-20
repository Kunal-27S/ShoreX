import React, { useState, useEffect } from 'react';
import { ProtectedRoute } from '../ProtectedRoute';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { auth, firestore } from '../firebaseConfig';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  where,
  getDocs,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import FooterNav from '../components/FooterNav';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
const aiStar = require('../assets/images/aistar.png');

function getStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 20,
    },
    searchContainer: {
      marginBottom: 20,
    },
    searchInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.input,
      borderRadius: 12,
      paddingHorizontal: 12,
      marginBottom: 8,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 16,
      paddingVertical: 12,
    },
    searchLoader: {
      marginLeft: 8,
    },
    searchHelper: {
      fontSize: 12,
      color: colors.textSecondary,
      marginLeft: 4,
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingBottom: 50,
    },
    searchResultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.card,
      borderRadius: 12,
      marginBottom: 8,
    },
    chatItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.card,
      borderRadius: 12,
      marginBottom: 8,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      marginRight: 12,
    },
    chatAvatarContainer: {
      position: 'relative',
    },
    badge: {
      position: 'absolute',
      top: -1,
      right: 8,
      backgroundColor: colors.error,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    badgeText: {
      color: colors.onError,
      fontSize: 12,
      fontWeight: 'bold',
    },
    searchResultText: {
      flex: 1,
    },
    searchResultName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    searchResultNickname: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 2,
    },
    chatContent: {
      flex: 1,
    },
    chatName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    chatLastMessage: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
    },
    chatTime: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      color: colors.text,
      fontSize: 16,
      marginTop: 12,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    noResultsText: {
      color: colors.textSecondary,
      fontSize: 16,
      textAlign: 'center',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 32,
    },
    fab: {
      position: 'absolute',
      bottom: 80,
      right: 20,
      backgroundColor: colors.primary,
      width: 70,
      height: 70,
      borderRadius: 35,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 6,
      shadowColor: colors.shadow,
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      zIndex: 100,
    },
  });
}

function ChatsPage() {
  const router = useRouter();
  const [chats, setChats] = useState([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [initiatingChat, setInitiatingChat] = useState(false);
  const { colors } = useTheme();
  const styles = getStyles(colors);

  useEffect(() => {
    if (!auth.currentUser) {
      setLoadingChats(false);
      return;
    }

    const chatsCollectionRef = collection(firestore, 'users', auth.currentUser.uid, 'chats');
    const chatsQuery = query(chatsCollectionRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(
      chatsQuery,
      async (snapshot) => {
        const chatsData = await Promise.all(snapshot.docs.map(async (chatDocSnap) => {
          const chat = { id: chatDocSnap.id, ...chatDocSnap.data() };

          // Check if the chat has any messages
          const messagesRef = collection(firestore, 'users', auth.currentUser.uid, 'chats', chat.id, 'messages');
          const messagesSnapshot = await getDocs(messagesRef);
          
          // Skip this chat if it has no messages
          if (messagesSnapshot.empty) {
            return null;
          }

          let otherUser = { name: 'Unknown User', avatar: '' };
          if (chat.otherUserId) {
            try {
              const userDocRef = doc(firestore, 'users', chat.otherUserId);
              const userDocSnap = await getDoc(userDocRef);
              if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                otherUser = {
                  name: userData.displayName || 'Anonymous User',
                  avatar: userData.photoURL || '',
                };
              }
            } catch (err) {
              console.error('Error fetching other user details:', err);
            }
          }

          return {
            ...chat,
            user: otherUser,
          };
        }));

        // Filter out null values (chats with no messages) and set the remaining chats
        const filteredChatsData = chatsData.filter(chat => chat !== null);
        setChats(filteredChatsData);
        setLoadingChats(false);
      },
      err => {
        console.error('Error fetching chats:', err);
        setLoadingChats(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleSearch = async () => {
    if (searchTerm.trim() === '') {
      setSearchResults([]);
      return;
    }

    setLoadingSearch(true);
    try {
      const usersRef = collection(firestore, 'users');
      const querySnapshot = await getDocs(usersRef);
      const users = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      const searchTermLower = searchTerm.toLowerCase().trim();
      const filteredUsers = users.filter(user => {
        const displayName = (user.displayName || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        return (user.id !== auth.currentUser.uid) && 
               (displayName.includes(searchTermLower) || 
                email.includes(searchTermLower));
      });

      setSearchResults(filteredUsers);
    } catch (err) {
      console.error('Error searching users:', err);
    } finally {
      setLoadingSearch(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim() !== '') {
        handleSearch();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleUserClick = async (otherUser) => {
    if (!auth.currentUser || !otherUser || initiatingChat) return;

    setInitiatingChat(true);
    try {
      const chatsRef = collection(firestore, 'users', auth.currentUser.uid, 'chats');
      const existingChatQuery = query(chatsRef, where('otherUserId', '==', otherUser.id));
      const existingChatSnapshot = await getDocs(existingChatQuery);

      if (!existingChatSnapshot.empty) {
        const existingChatId = existingChatSnapshot.docs[0].id;
        router.push(`/chats/${existingChatId}`);
        return;
      }

      const newChatId = [auth.currentUser.uid, otherUser.id].sort().join('_');

      const currentUserChatData = {
        otherUserId: otherUser.id,
        participants: [auth.currentUser.uid, otherUser.id],
        createdAt: serverTimestamp(),
        timestamp: serverTimestamp(),
        lastMessage: null,
        unreadCount: 0
      };

      const otherUserChatData = {
        otherUserId: auth.currentUser.uid,
        participants: [auth.currentUser.uid, otherUser.id],
        createdAt: serverTimestamp(),
        timestamp: serverTimestamp(),
        lastMessage: null,
        unreadCount: 0
      };

      await setDoc(
        doc(firestore, 'users', auth.currentUser.uid, 'chats', newChatId), 
        currentUserChatData
      );

      await setDoc(
        doc(firestore, 'users', otherUser.id, 'chats', newChatId), 
        otherUserChatData
      );

      router.push(`/chats/${newChatId}`);
    } catch (err) {
      console.error('Error initiating chat:', err);
      Alert.alert('Error', 'Failed to start chat');
    } finally {
      setInitiatingChat(false);
    }
  };

  const handleChatClick = (chatId) => {
    router.push(`/chats/${chatId}`);
  };

  const renderSearchResult = ({ item }) => (
    <TouchableOpacity 
      style={styles.searchResultItem} 
      onPress={() => handleUserClick(item)}
      disabled={initiatingChat}
    >
      <Image 
        source={item.photoURL ? { uri: item.photoURL } : require('../assets/images/placeholder.png')} 
        style={styles.avatar}
      />
      <View style={styles.searchResultText}>
        <Text style={styles.searchResultName}>{item.displayName || 'Anonymous User'}</Text>
        {item.nickname && <Text style={styles.searchResultNickname}>@{item.nickname}</Text>}
      </View>
    </TouchableOpacity>
  );

  const renderChatItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.chatItem} 
      onPress={() => handleChatClick(item.id)}
    >
      <View style={styles.chatAvatarContainer}>
        <Image 
          source={item.user.avatar ? { uri: item.user.avatar } : require('../assets/images/placeholder.png')} 
          style={styles.avatar}
        />
        {item.unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={[styles.badgeText, { color: '#fff' }]}>{item.unreadCount}</Text>
          </View>
        )}
      </View>
      <View style={styles.chatContent}>
        <Text style={styles.chatName}>{item.user.name}</Text>
        <Text style={styles.chatLastMessage} numberOfLines={1}>
          {item.lastMessage ? (
            item.lastMessage.mediaType ? (
              item.lastMessage.mediaType === 'image' ? '📷 Image' : '🎥 Video'
            ) : (
              item.lastMessage.text || 'No messages yet.'
            )
          ) : (
            'No messages yet.'
          )}
        </Text>
      </View>
      <Text style={styles.chatTime}>
        {item.timestamp?.toDate().toLocaleString() || ''}
      </Text>
    </TouchableOpacity>
  );

  const displaySearchResults = searchTerm.trim() !== '' || loadingSearch;

  if (loadingChats) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading chats...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Chats</Text>

        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <MaterialIcons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search users to chat"
              placeholderTextColor={colors.textSecondary}
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
            {loadingSearch && (
              <ActivityIndicator size="small" color={colors.primary} style={styles.searchLoader} />
            )}
          </View>
          <Text style={styles.searchHelper}>Search by name</Text>
        </View>

        {displaySearchResults ? (
          loadingSearch ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              renderItem={renderSearchResult}
              keyExtractor={(item) => item.id}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.centerContainer}>
              <Text style={styles.noResultsText}>No users found for this search term.</Text>
            </View>
          )
        ) : (
          chats.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No chats yet</Text>
              <Text style={styles.emptySubtitle}>
                Use the search bar above to find users and start chatting
              </Text>
            </View>
          ) : (
            <FlatList
              data={chats}
              renderItem={renderChatItem}
              keyExtractor={(item) => item.id}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )
        )}
      </View>

      <FooterNav />
      {/* Floating AI Chat Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/aichat')}
        activeOpacity={0.8}
      >
        <Image source={aiStar} style={{ width: 50, height: 50, resizeMode: 'contain', tintColor: '#fff' }} />
      </TouchableOpacity>
    </View>
  );
}

export default function ProtectedChatsPageWrapper(props) {
  return (
    <ProtectedRoute>
      <ChatsPage {...props} />
    </ProtectedRoute>
  );
}