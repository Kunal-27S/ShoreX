import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
  Modal,
  StatusBar,
  ActionSheetIOS,
  RefreshControl,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { auth, firestore } from '../../firebaseConfig';
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  increment,
  onSnapshot,
  query,
  orderBy,
  setDoc,
  limit,
  startAfter,
  getDocs,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import HeaderBar from '../../components/HeaderBar';
import { useTheme } from '../../contexts/ThemeContext';
import { useActionSheet, ActionSheetProvider } from '@expo/react-native-action-sheet';
import { Swipeable } from 'react-native-gesture-handler';
import { PanGestureHandler, State } from 'react-native-gesture-handler';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

function getStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      backgroundColor: colors.card,
    },
    backBtn: {
      marginRight: 8,
      padding: 4,
    },
    partnerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    partnerAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      marginRight: 8,
      backgroundColor: colors.background,
    },
    menuButton: {
      padding: 8,
      position: 'relative',
    },
    dropdownMenu: {
      position: 'absolute',
      top: '100%',
      right: 0,
      backgroundColor: colors.card,
      borderRadius: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
      zIndex: 1000,
      minWidth: 150,
    },
    dropdownOption: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    dropdownOptionText: {
      color: colors.text,
      fontSize: 16,
    },
    dropdownOptionDelete: {
      color: colors.error,
    },
    partnerName: {
      color: colors.text,
      fontSize: 18,
      fontWeight: 'bold',
    },
    messagesList: {
      flex: 1,
      backgroundColor: colors.background,
    },
    messageRow: {
      marginBottom: 12,
      maxWidth: '80%',
      borderRadius: 12,
      padding: 10,
    },
    messageLeft: {
      alignSelf: 'flex-start',
      backgroundColor: colors.card,
      borderBottomLeftRadius: 0,
    },
    messageRight: {
      alignSelf: 'flex-end',
      backgroundColor: colors.primary,
      borderBottomRightRadius: 0,
    },
    messageText: {
      color: colors.text,
      fontSize: 16,
    },
    messageTime: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 4,
      alignSelf: 'flex-end',
    },
    mediaContainer: {
      marginBottom: 6,
      borderRadius: 8,
      overflow: 'hidden',
    },
    messageImage: {
      width: 200,
      height: 200,
      borderRadius: 8,
    },
    messageVideo: {
      width: 200,
      height: 150,
      borderRadius: 8,
      backgroundColor: colors.background,
    },
    videoPoster: {
      borderRadius: 8,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      padding: 8,
      paddingBottom: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    mediaBtn: {
      marginRight: 8,
      padding: 4,
    },
    input: {
      flex: 1,
      color: colors.text,
      fontSize: 16,
      backgroundColor: colors.background,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginRight: 8,
    },
    sendBtn: {
      padding: 4,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    loadingText: {
      color: colors.text,
      fontSize: 16,
      marginTop: 12,
    },
    fullScreenContainer: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    fullScreenImageContainer: {
      flex: 1,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    fullScreenImage: {
      width: screenWidth,
      height: screenHeight,
    },
    closeButton: {
      position: 'absolute',
      top: 50,
      right: 20,
      backgroundColor: colors.overlay,
      borderRadius: 20,
      padding: 8,
      zIndex: 1000,
    },
    replyPreviewContainer: {
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    replyPreviewContent: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 12,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    replyPreviewIcon: {
      marginRight: 8,
      marginTop: 2,
    },
    replyPreviewText: {
      flex: 1,
    },
    replyPreviewLabel: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '600',
      marginBottom: 4,
    },
    replyPreviewMessage: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    replyPreviewClose: {
      marginLeft: 8,
      padding: 4,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    deleteModal: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 32,
      margin: 40,
      minWidth: 300,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 12,
    },
    deleteModalTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 28,
    },
    deleteModalButtons: {
      gap: 12,
    },
    deleteModalButton: {
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 12,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    deleteModalButtonSecondary: {
      backgroundColor: colors.input,
    },
    deleteModalButtonPrimary: {
      backgroundColor: colors.primary,
    },
    deleteModalButtonDestructive: {
      backgroundColor: colors.error,
    },
    deleteModalButtonTextSecondary: {
      color: colors.text,
      fontWeight: '600',
    },
    deleteModalButtonTextPrimary: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 16,
    },
    deleteModalButtonTextDestructive: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 16,
    },
  });
}

const DeleteChatModal = ({ visible, onClose, onDelete, colors, styles }) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onClose}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.deleteModal}>
        <Text style={styles.deleteModalTitle}>
          Are you sure to delete the entire chat?
        </Text>
        <View style={styles.deleteModalButtons}>
          <TouchableOpacity
            style={[styles.deleteModalButton, styles.deleteModalButtonSecondary]}
            onPress={onClose}
          >
            <Text style={styles.deleteModalButtonTextSecondary}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.deleteModalButton, styles.deleteModalButtonDestructive]}
            onPress={onDelete}
          >
            <Text style={styles.deleteModalButtonTextDestructive}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

function ChatWindow() {
  const router = useRouter();
  const { chatId } = useLocalSearchParams();
  const [chatPartner, setChatPartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(false);
  const [lastReadMessageId, setLastReadMessageId] = useState(null);
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const flatListRef = useRef(null);
  const prevContentHeightRef = useRef(0);
  const [pendingScrollAdjust, setPendingScrollAdjust] = useState(false);
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [replyTo, setReplyTo] = useState(null);
  const { showActionSheetWithOptions } = useActionSheet();
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const highlightAnimRefs = useRef({});
  const inputRef = useRef(null);

  const [showDropdown, setShowDropdown] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  const handleOptionsPress = () => {
    setShowDropdown(!showDropdown);
  };

  const handleBlockUser = async () => {
    try {
      // Update chat document for current user to mark as blocked
      const userChatRef = doc(firestore, 'users', auth.currentUser.uid, 'chats', chatId);
      await updateDoc(userChatRef, {
        blocked: true,
        blockedAt: serverTimestamp()
      });
      setIsBlocked(true);
      setShowDropdown(false);
    } catch (error) {
      console.error('Error blocking user:', error);
      Alert.alert('Error', 'Failed to block user. Please try again.');
    }
  };

  const handleUnblockUser = async () => {
    try {
      // Update chat document to remove blocked status
      const userChatRef = doc(firestore, 'users', auth.currentUser.uid, 'chats', chatId);
      await updateDoc(userChatRef, {
        blocked: false,
        blockedAt: null
      });
      setIsBlocked(false);
    } catch (error) {
      console.error('Error unblocking user:', error);
      Alert.alert('Error', 'Failed to unblock user. Please try again.');
    }
  };

  const handleDropdownOptionPress = (option) => {
    setShowDropdown(false);
    switch (option) {
      case 'delete':
        setShowDeleteModal(true);
        break;
      case 'block':
        Alert.alert(
          'Block User',
          'Are you sure you want to block this user? You will no longer receive their messages.',
          [
            {
              text: 'Cancel',
              style: 'cancel'
            },
            {
              text: 'Block',
              onPress: handleBlockUser,
              style: 'destructive'
            }
          ]
        );
        break;
      case 'report':
        Alert.alert('Report', 'This feature will be implemented soon');
        break;
    }
  };

  const handleDeleteChat = async () => {
    try {
      // Get reference to the user's chat and messages
      const userChatRef = doc(firestore, 'users', auth.currentUser.uid, 'chats', chatId);
      const userMessagesRef = collection(firestore, 'users', auth.currentUser.uid, 'chats', chatId, 'messages');
      const messagesSnapshot = await getDocs(userMessagesRef);
      
      // Create a batch write operation
      const batch = writeBatch(firestore);
      
      // Add message deletions to batch
      messagesSnapshot.docs.forEach((document) => {
        batch.delete(document.ref);
      });

      // Mark chat as deleted for current user
      batch.update(userChatRef, {
        deleted: true,
        deletedAt: serverTimestamp()
      });

      // Execute all deletions
      await batch.commit();

      // Close the modal
      setShowDeleteModal(false);

      // Navigate back to chats screen
      router.push('/chats');
    } catch (error) {
      console.error('Error deleting chat:', error);
      Alert.alert('Error', 'Failed to delete chat. Please try again.');
      setShowDeleteModal(false);
    }
  };
  const panXRefs = useRef({}); // Store Animated.Value per message

  const PAGE_SIZE = 30;
  const [lastVisible, setLastVisible] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [allLoaded, setAllLoaded] = useState(false);

  const scrollToBottom = () => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  };

  const scrollToUnreadMessage = () => {
    if (flatListRef.current && messages.length > 0 && lastReadMessageId) {
      const unreadIndex = messages.findIndex(msg => msg.id === lastReadMessageId);
      if (unreadIndex !== -1 && unreadIndex < messages.length - 1) {
        // Scroll to the first unread message (one after the last read)
        flatListRef.current.scrollToIndex({ 
          index: unreadIndex + 1, 
          animated: true,
          viewPosition: 0.1 // Show at top with some padding
        });
        return;
      }
    }
    // If no unread messages found, scroll to bottom
    scrollToBottom();
  };

  const handleImagePress = (imageUrl) => {
    setFullScreenImage(imageUrl);
  };

  const closeFullScreenImage = () => {
    setFullScreenImage(null);
  };

  const handleLongPressMessage = (item) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedMessages([item]);
    }
  };

  const handleMessagePress = (item) => {
    if (isSelectionMode) {
      setSelectedMessages(prev => {
        const isSelected = prev.find(msg => msg.id === item.id);
        if (isSelected) {
          const newSelected = prev.filter(msg => msg.id !== item.id);
          if (newSelected.length === 0) {
            setIsSelectionMode(false);
            return [];
          }
          return newSelected;
        } else {
          return [...prev, item];
        }
      });
    }
  };

  const handleReply = () => {
    if (selectedMessages.length === 1) {
      const messageToReply = selectedMessages[0];
      setReplyTo({
        ...messageToReply,
        sender: messageToReply.senderId === auth.currentUser.uid ? 'user' : 'other',
        senderName: messageToReply.senderName || (messageToReply.senderId === auth.currentUser.uid ? 'You' : chatPartner?.name || 'User')
      });
      setIsSelectionMode(false);
      setSelectedMessages([]);
    }
  };

  const handleDelete = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async (forAll) => {
    const allOwnMessages = selectedMessages.every(msg => msg.senderId === auth.currentUser.uid);
    
    if (forAll && !allOwnMessages) {
      Alert.alert('Error', 'You can only delete for all if all selected messages are yours');
      return;
    }
    
    // Immediately remove messages from UI
    setMessages(prevMessages => {
      const messageIdsToDelete = new Set(selectedMessages.map(msg => msg.id));
      return prevMessages.filter(msg => !messageIdsToDelete.has(msg.id));
    });
    
    // Close modal and exit selection mode immediately
    setShowDeleteModal(false);
    exitSelectionMode();
    
    // Then handle backend deletion in background
    try {
      await deleteMessages(selectedMessages, forAll);
    } catch (error) {
      Alert.alert('Error', 'Failed to delete messages. Please try again.');
    }
  };

  // Migrate existing messages to centralized collection
  const migrateMessagesToCentralized = async () => {
    try {
      // Get all messages from current user's collection
      const userMessagesQuery = query(
        collection(firestore, 'users', auth.currentUser.uid, 'chats', chatId, 'messages'),
        orderBy('timestamp', 'desc')
      );
      const userMessagesSnapshot = await getDocs(userMessagesQuery);
      
      const migrationPromises = [];
      
      for (const messageDoc of userMessagesSnapshot.docs) {
        const messageData = messageDoc.data();
        
        // Check if message already exists in centralized collection
        const centralizedMsgRef = doc(firestore, 'messages', messageDoc.id);
        const centralizedMsgDoc = await getDoc(centralizedMsgRef);
        
        if (!centralizedMsgDoc.exists()) {
          // Add chatId to message data and migrate to centralized collection
          const messageWithChatId = {
            ...messageData,
            chatId: chatId
          };
          
          migrationPromises.push(
            setDoc(centralizedMsgRef, messageWithChatId).catch(error => {
              // Silent error handling for migration
            })
          );
        }
      }
      
      if (migrationPromises.length > 0) {
        await Promise.all(migrationPromises);
      }
      
    } catch (error) {
      // Silent error handling for migration
    }
  };

  // Sync chat document with current message state
  const syncChatDocument = async () => {
    try {
      await updateChatDocument(auth.currentUser.uid, chatId);
    } catch (error) {
      // Silent error handling
    }
  };

  // Update chat document with current unread count and last message
  const updateChatDocument = async (userId, chatId) => {
    try {
      // Get all remaining messages for this user
      const messagesQuery = query(
        collection(firestore, 'users', userId, 'chats', chatId, 'messages'),
        orderBy('timestamp', 'desc')
      );
      const messagesSnapshot = await getDocs(messagesQuery);
      
      if (messagesSnapshot.empty) {
        // No messages left, update chat document accordingly
        const chatRef = doc(firestore, 'users', userId, 'chats', chatId);
        await updateDoc(chatRef, {
          lastMessage: null,
          unreadCount: 0,
          timestamp: serverTimestamp()
        });
        return;
      }
      
      const messages = messagesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Get the last message
      const lastMessage = messages[0]; // Messages are ordered by timestamp desc
      
      // Count unread messages (messages from other user that are not read)
      const unreadCount = messages.filter(msg => 
        msg.senderId !== userId && !msg.read
      ).length;
      
      // Update chat document
      const chatRef = doc(firestore, 'users', userId, 'chats', chatId);
      await updateDoc(chatRef, {
        lastMessage: {
          text: lastMessage.text || '',
          mediaUrl: lastMessage.mediaUrl || '',
          mediaType: lastMessage.mediaType || '',
          senderId: lastMessage.senderId
        },
        unreadCount: unreadCount,
        timestamp: lastMessage.timestamp
      });
      
    } catch (error) {
      // Silent error handling
    }
  };

  const deleteMessages = async (messages, forAll) => {
    try {
      if (forAll) {
        // For "delete for all", we need to delete from the centralized messages collection
        const deletionPromises = [];
        
        for (const message of messages) {
          // Try to delete from centralized messages collection (may not exist for old messages)
          const centralizedMsgRef = doc(firestore, 'messages', message.id);
          deletionPromises.push(
            deleteDoc(centralizedMsgRef).catch(error => {
              // Silent error handling for old messages
            })
          );
          
          // Always delete from both users' collections to ensure immediate UI updates
          const currentUserMsgRef = doc(firestore, 'users', auth.currentUser.uid, 'chats', chatId, 'messages', message.id);
          deletionPromises.push(deleteDoc(currentUserMsgRef));
          
          if (chatPartner?.id) {
            const partnerMsgRef = doc(firestore, 'users', chatPartner.id, 'chats', chatId, 'messages', message.id);
            deletionPromises.push(deleteDoc(partnerMsgRef));
          }
        }
        
        // Wait for all deletions to complete
        await Promise.all(deletionPromises);
        
        // Update chat documents for both users
        await Promise.all([
          updateChatDocument(auth.currentUser.uid, chatId),
          chatPartner?.id ? updateChatDocument(chatPartner.id, chatId) : Promise.resolve()
        ]);
        
      } else {
        // For "delete for me", only delete from current user's collection
        const deletionPromises = [];
        
        for (const message of messages) {
          const userMsgRef = doc(firestore, 'users', auth.currentUser.uid, 'chats', chatId, 'messages', message.id);
          deletionPromises.push(deleteDoc(userMsgRef));
        }
        
        await Promise.all(deletionPromises);
        
        // Update chat document for current user only
        await updateChatDocument(auth.currentUser.uid, chatId);
      }
      
    } catch (err) {
      Alert.alert('Error', 'Failed to delete messages: ' + err.message);
    }
  };

  const exitSelectionMode = () => {
    console.log('exitSelectionMode called');
    setIsSelectionMode(false);
    setSelectedMessages([]);
    // Don't clear replyTo here - we want it to persist after setting it
  };

  const isMessageSelected = (messageId) => {
    return selectedMessages.find(msg => msg.id === messageId);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Force refresh by re-fetching messages
      const messagesQuery = query(
        collection(firestore, 'users', auth.currentUser.uid, 'chats', chatId, 'messages'),
        orderBy('timestamp', 'desc'),
        limit(PAGE_SIZE)
      );
      const snapshot = await getDocs(messagesQuery);
      const newMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        sender: doc.data().senderId === auth.currentUser.uid ? 'user' : 'other',
      }));
      setMessages(newMessages);
      setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
    } catch (error) {
      // Silent error handling
    } finally {
      setRefreshing(false);
    }
  };

  // Test Firebase connectivity
  const testFirebaseConnection = async () => {
    try {
      const testRef = doc(firestore, 'users', auth.currentUser.uid);
      const testDoc = await getDoc(testRef);
      return testDoc.exists();
    } catch (error) {
      return false;
    }
  };

  // Real-time listener for the latest messages
  useEffect(() => {
    if (!auth.currentUser || !chatId) return;
    setLoading(true);
    
    // Test Firebase connection first
    testFirebaseConnection().then(async (isConnected) => {
      if (!isConnected) {
        setLoading(false);
        return;
      }

      // Check if chat is blocked
      const chatRef = doc(firestore, 'users', auth.currentUser.uid, 'chats', chatId);
      const chatDoc = await getDoc(chatRef);
      if (chatDoc.exists()) {
        const chatData = chatDoc.data();
        setIsBlocked(chatData.blocked || false);
      }
      
      // Migrate existing messages to centralized collection
      migrateMessagesToCentralized();
      
      // Sync chat document with current message state
      syncChatDocument();
    });
    
    const messagesQuery = query(
      collection(firestore, 'users', auth.currentUser.uid, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'desc'),
      limit(PAGE_SIZE)
    );
    
    const unsubscribe = onSnapshot(
      messagesQuery, 
      async snapshot => {
        // Get the chat document to check blocked status and time
        const chatDoc = await getDoc(doc(firestore, 'users', auth.currentUser.uid, 'chats', chatId));
        
        const newMessages = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
            sender: doc.data().senderId === auth.currentUser.uid ? 'user' : 'other',
          }))
          .filter(msg => {
            // If chat is blocked, only show messages from before blocking
            if (isBlocked && msg.sender === 'other') {
              const msgTime = msg.timestamp?.toMillis() || 0;
              const blockTime = chatDoc.data().blockedAt?.toMillis() || Infinity;
              return msgTime < blockTime;
            }
            return true;
          });
        
        // Check if message count changed (indicating deletion)
        const messageCountChanged = newMessages.length !== messages.length;
        
      setMessages(newMessages);
      setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      setLoading(false);
        
        // Only sync chat document if message count changed (indicating deletion)
        if (messageCountChanged) {
          syncChatDocument();
        }
      },
      error => {
        setLoading(false);
        // Retry connection after a short delay
        setTimeout(() => {
          // Silent retry
        }, 2000);
      }
    );
    
    return () => unsubscribe();
  }, [auth.currentUser, chatId]);

  // Paginated loading for older messages with scroll retention
  const handleLoadMore = async () => {
    if (!loadingMore && !allLoaded && messages.length > 0 && lastVisible) {
      setLoadingMore(true);
      // Record the current content height before loading more
      if (flatListRef.current) {
        flatListRef.current.measure?.((x, y, width, height, pageX, pageY) => {
          prevContentHeightRef.current = height;
        });
      }
      const messagesQuery = query(
        collection(firestore, 'users', auth.currentUser.uid, 'chats', chatId, 'messages'),
        orderBy('timestamp', 'desc'),
        startAfter(lastVisible),
        limit(PAGE_SIZE)
      );
      const snapshot = await getDocs(messagesQuery);
      const olderMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        sender: doc.data().senderId === auth.currentUser.uid ? 'user' : 'other',
      }));
      setMessages(prev => {
        const existingIds = new Set(prev.map(msg => msg.id));
        const deduped = [...prev, ...olderMessages.filter(msg => !existingIds.has(msg.id))];
        return deduped;
      });
      if (snapshot.docs.length < PAGE_SIZE) {
        setAllLoaded(true);
      }
      setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      setLoadingMore(false);
      setPendingScrollAdjust(true);
    }
  };

  // Adjust scroll position after loading more messages
  const handleContentSizeChange = (w, h) => {
    if (pendingScrollAdjust && flatListRef.current && prevContentHeightRef.current) {
      const heightDiff = h - prevContentHeightRef.current;
      if (heightDiff > 0) {
        flatListRef.current.scrollToOffset({ offset: heightDiff, animated: false });
      }
      setPendingScrollAdjust(false);
    }
  };

  // Handle scrolling after messages are loaded and FlatList is rendered
  const handleOnLayout = () => {
    if (shouldScrollToBottom && messages.length > 0) {
      // Use a small delay to ensure FlatList is fully rendered
      setTimeout(() => {
        if (lastReadMessageId) {
          scrollToUnreadMessage();
        } else {
          scrollToBottom();
        }
        setShouldScrollToBottom(false);
      }, 100);
    }
  };

  // Also handle scrolling when FlatList content size changes
  const handleOnContentSizeChange = () => {
    if (shouldScrollToBottom && messages.length > 0) {
      setTimeout(() => {
        if (lastReadMessageId) {
          scrollToUnreadMessage();
        } else {
          scrollToBottom();
        }
        setShouldScrollToBottom(false);
      }, 50);
    }
  };

  // Restore fetching chat partner info
  useEffect(() => {
    if (!auth.currentUser || !chatId) return;
    const fetchChatPartner = async () => {
      try {
        const chatRef = doc(firestore, 'users', auth.currentUser.uid, 'chats', chatId);
        const chatDoc = await getDoc(chatRef);
        if (chatDoc.exists()) {
          const chatData = chatDoc.data();
          const participantIds = chatData.participants;
          const otherParticipantId = participantIds.find(id => id !== auth.currentUser.uid);
          if (otherParticipantId) {
            const otherUserDoc = await getDoc(doc(firestore, 'users', otherParticipantId));
            if (otherUserDoc.exists()) {
              const otherUserData = otherUserDoc.data();
              setChatPartner({
                name: otherUserData.displayName || 'Anonymous User',
                avatar: otherUserData.photoURL || '',
                id: otherUserDoc.id,
              });
            } else {
              setChatPartner({ name: 'Unknown User', avatar: '' });
            }
          } else {
            setChatPartner({ name: 'Single User Chat', avatar: '' });
          }
        }
      } catch (err) {
        setChatPartner({ name: 'Unknown User', avatar: '' });
      }
    };
    fetchChatPartner();
  }, [auth.currentUser, chatId]);

  // Reset unread count when chat is opened
  useEffect(() => {
    if (!auth.currentUser || !chatId) return;

    const resetUnreadCount = async () => {
      try {
        // Mark messages as read
        const messagesRef = collection(firestore, 'users', auth.currentUser.uid, 'chats', chatId, 'messages');
        const unreadMessages = messages.filter(msg => msg.sender === 'other' && !msg.read);
        
        // Update each unread message to mark as read
        const updatePromises = unreadMessages.map(msg => 
          updateDoc(doc(messagesRef, msg.id), { read: true })
        );
        
        await Promise.all(updatePromises);
        
        // Sync chat document to update unread count and last message
        await updateChatDocument(auth.currentUser.uid, chatId);
      } catch (err) {
        // Silent error handling
      }
    };

    resetUnreadCount();
  }, [auth.currentUser, chatId, messages]);

  // In handleSendMessage, always set senderName to displayName or 'You'
  const handleSendMessage = async () => {
    if (!inputMessage.trim() && !replyTo) return;
    if (isBlocked) {
      Alert.alert('Cannot Send Message', 'You cannot send messages while the contact is blocked.');
      return;
    }
    try {
      const myDisplayName = auth.currentUser.displayName || 'You';
      const messageTimestamp = serverTimestamp();
      const newMessage = {
        text: inputMessage.trim(),
        senderId: auth.currentUser.uid,
        senderName: myDisplayName,
        timestamp: messageTimestamp,
        read: false,
        chatId: chatId, // Add chatId for centralized collection
        ...(replyTo ? { replyTo: {
          id: replyTo.id,
          text: replyTo.text || '',
          mediaUrl: replyTo.mediaUrl || '',
          mediaType: replyTo.mediaType || '',
          senderId: replyTo.senderId,
          senderName: (replyTo.senderId === auth.currentUser.uid)
            ? (replyTo.senderName && replyTo.senderName !== 'Anonymous' ? replyTo.senderName : myDisplayName)
            : (replyTo.senderName || chatPartner?.name || 'User')
        } } : {}),
      };
      
      // First, add to centralized messages collection
      const centralizedMessagesRef = collection(firestore, 'messages');
      const centralizedMessageRef = await addDoc(centralizedMessagesRef, newMessage);
      
      // Check if the recipient has blocked the sender
      const recipientChatRef = doc(firestore, 'users', chatPartner.id, 'chats', chatId);
      const recipientChatDoc = await getDoc(recipientChatRef);
      const isBlockedByRecipient = recipientChatDoc.exists() && recipientChatDoc.data().blocked;

      // Add to current user's collection
      await setDoc(
        doc(firestore, 'users', auth.currentUser.uid, 'chats', chatId, 'messages', centralizedMessageRef.id), 
        newMessage
      );

      // Only add to recipient's collection if they haven't blocked the sender
      if (!isBlockedByRecipient) {
        await setDoc(
          doc(firestore, 'users', chatPartner.id, 'chats', chatId, 'messages', centralizedMessageRef.id), 
          newMessage
        );
      }
      
      // Update current user's chat document
      const currentUserChatRef = doc(firestore, 'users', auth.currentUser.uid, 'chats', chatId);
      await updateDoc(currentUserChatRef, {
        lastMessage: { text: newMessage.text, senderId: auth.currentUser.uid },
        timestamp: messageTimestamp,
      });

      // Only update recipient's chat document if they haven't blocked the sender
      if (!isBlockedByRecipient) {
        const otherUserChatRef = doc(firestore, 'users', chatPartner.id, 'chats', chatId);
        await updateDoc(otherUserChatRef, {
          lastMessage: { text: newMessage.text, senderId: auth.currentUser.uid },
          timestamp: messageTimestamp,
          unreadCount: increment(1)
        });
      }
      setInputMessage('');
      setReplyTo(null);
      
      // Set flag to scroll to bottom after sending message
      setShouldScrollToBottom(true);
    } catch (err) {
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const handleMediaUpload = async () => {
    if (!auth.currentUser || !chatId || !chatPartner) return;
    setUploadingMedia(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        // TODO: Upload asset.uri to Firebase Storage and get download URL
        // For now, just send as image message with local URI
        const messageTimestamp = serverTimestamp();
        const newMessage = {
          text: '',
          mediaUrl: asset.uri,
          mediaType: asset.type === 'video' ? 'video' : 'image',
          senderId: auth.currentUser.uid,
          senderName: auth.currentUser.displayName || 'Anonymous',
          timestamp: messageTimestamp,
          read: false,
          chatId: chatId, // Add chatId for centralized collection
        };
        
        // First, add to centralized messages collection
        const centralizedMessagesRef = collection(firestore, 'messages');
        const centralizedMessageRef = await addDoc(centralizedMessagesRef, newMessage);
        
        // Check if the recipient has blocked the sender
        const recipientChatRef = doc(firestore, 'users', chatPartner.id, 'chats', chatId);
        const recipientChatDoc = await getDoc(recipientChatRef);
        const isBlockedByRecipient = recipientChatDoc.exists() && recipientChatDoc.data().blocked;

        // Add to current user's collection
        await setDoc(
          doc(firestore, 'users', auth.currentUser.uid, 'chats', chatId, 'messages', centralizedMessageRef.id), 
          newMessage
        );

        // Only add to recipient's collection if they haven't blocked the sender
        if (!isBlockedByRecipient) {
          await setDoc(
            doc(firestore, 'users', chatPartner.id, 'chats', chatId, 'messages', centralizedMessageRef.id), 
            newMessage
          );
        }

        // Update current user's chat document
        const currentUserChatRef = doc(firestore, 'users', auth.currentUser.uid, 'chats', chatId);
        await updateDoc(currentUserChatRef, {
          lastMessage: { mediaUrl: asset.uri, mediaType: newMessage.mediaType, senderId: auth.currentUser.uid },
          timestamp: messageTimestamp,
        });

        // Only update recipient's chat document if they haven't blocked the sender
        if (!isBlockedByRecipient) {
          const otherUserChatRef = doc(firestore, 'users', chatPartner.id, 'chats', chatId);
          await updateDoc(otherUserChatRef, {
            lastMessage: { mediaUrl: asset.uri, mediaType: newMessage.mediaType, senderId: auth.currentUser.uid },
            timestamp: messageTimestamp,
            unreadCount: increment(1)
          });
        }
        
        // Set flag to scroll to bottom after sending media
        setShouldScrollToBottom(true);
        
        // Clear reply state after sending media
        setReplyTo(null);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to upload media');
    } finally {
      setUploadingMedia(false);
    }
  };

  // Helper to scroll and animate
  const handleReplyPreviewPress = useCallback((replyToId) => {
    if (!replyToId) return;
    const idx = messages.findIndex(m => m.id === replyToId);
    if (idx !== -1 && flatListRef.current) {
      // FlatList is inverted, so scroll to index from the end
      flatListRef.current.scrollToIndex({ index: idx, animated: true });
      setHighlightedMessageId(replyToId);
      // Animate highlight
      if (highlightAnimRefs.current[replyToId]) {
        highlightAnimRefs.current[replyToId].setValue(0);
        Animated.sequence([
          Animated.timing(highlightAnimRefs.current[replyToId], { toValue: 1, duration: 200, useNativeDriver: false }),
          Animated.timing(highlightAnimRefs.current[replyToId], { toValue: 0, duration: 600, useNativeDriver: false })
        ]).start(() => setHighlightedMessageId(null));
      }
    }
  }, [messages]);

  const renderMessage = ({ item, index }) => {
    const selected = isMessageSelected(item.id);
    // Setup animation ref
    if (!highlightAnimRefs.current[item.id]) {
      highlightAnimRefs.current[item.id] = new Animated.Value(0);
    }
    // Determine highlight color based on theme
    const isDarkTheme = colors.background && (typeof colors.background === 'string') && (colors.background.toLowerCase() === '#000' || colors.background.toLowerCase().includes('1a1a') || colors.background.toLowerCase().includes('222') || colors.background.toLowerCase().includes('121212'));
    const highlightColor = isDarkTheme ? 'rgba(74, 111, 255, 0.32)' : 'rgba(74, 111, 255, 0.12)';

    const highlightBg = highlightAnimRefs.current[item.id].interpolate({
      inputRange: [0, 1],
      outputRange: ['transparent', highlightColor]
    });

    // Helper for reply preview styling
    const renderReplyPreview = () => {
      if (!item.replyTo) return null;
      let replySenderName;
      if (item.replyTo.senderId === auth.currentUser.uid) {
        replySenderName = 'You';
      } else if (item.replyTo.senderName && item.replyTo.senderName !== 'Anonymous') {
        replySenderName = item.replyTo.senderName;
      } else if (chatPartner?.name) {
        replySenderName = chatPartner.name;
      } else {
        replySenderName = 'User';
      }
      return (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleReplyPreviewPress(item.replyTo.id)}
          style={{ marginBottom: 8 }}
        >
          <View style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            backgroundColor: item.sender === 'user' ? '#e6f0ff' : '#f7f7fa',
            borderLeftWidth: 4,
            borderLeftColor: '#4A6FFF',
            borderTopLeftRadius: 10,
            borderTopRightRadius: 10,
            borderBottomRightRadius: 10,
            borderBottomLeftRadius: 4,
            paddingLeft: 10,
            paddingVertical: 8,
            paddingRight: 8,
            minWidth: 120,
            maxWidth: 240,
          }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#4A6FFF', fontWeight: 'bold', fontSize: 12, marginBottom: 2 }} numberOfLines={1}>
                {replySenderName}
              </Text>
              <Text style={{ color: '#333', fontSize: 13, fontStyle: 'italic' }} numberOfLines={2}>
                {item.replyTo.text ? item.replyTo.text : (item.replyTo.mediaType === 'image' ? '📷 Image' : item.replyTo.mediaType === 'video' ? '🎥 Video' : '[Media]')}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    };

    // Setup per-message panX ref
    if (!panXRefs.current[item.id]) {
      panXRefs.current[item.id] = new Animated.Value(0);
    }
    const panX = panXRefs.current[item.id];

    // Only allow left swipe for your messages, right swipe for partner's
    const isUser = item.senderId === auth.currentUser.uid;
    const SWIPE_DIST = 60;

    const onGestureEvent = Animated.event(
      [{ nativeEvent: { translationX: panX } }],
      { useNativeDriver: false }
    );

    const onHandlerStateChange = ({ nativeEvent }) => {
      if (nativeEvent.state === State.END) {
        // For your messages, left swipe; for partner's, right swipe
        if (
          (isUser && nativeEvent.translationX < -SWIPE_DIST) ||
          (!isUser && nativeEvent.translationX > SWIPE_DIST)
        ) {
          // Animate bubble, then spring back and trigger reply
          Animated.sequence([
            Animated.timing(panX, {
              toValue: isUser ? -SWIPE_DIST : SWIPE_DIST,
              duration: 80,
              useNativeDriver: false,
            }),
            Animated.spring(panX, {
              toValue: 0,
              bounciness: 12,
              useNativeDriver: false,
            })
          ]).start();
          // Trigger reply
          setReplyTo({
            ...item,
            sender: isUser ? 'user' : 'other',
            senderName: item.senderName || (isUser ? 'You' : chatPartner?.name || 'User')
          });
          setIsSelectionMode(false);
          setSelectedMessages([]);
          // Optionally focus the input (if you have a ref to it)
          if (inputRef && inputRef.current && inputRef.current.focus) {
            inputRef.current.focus();
          }
        } else {
          // Not enough swipe, just spring back
          Animated.spring(panX, {
            toValue: 0,
            bounciness: 12,
            useNativeDriver: false,
          }).start();
        }
      }
    };

    return (
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        activeOffsetX={isUser ? [-20, 0] : [0, 20]}
        failOffsetY={[-10, 10]}
      >
        <Animated.View style={{ transform: [{ translateX: panX }] }}>
          <TouchableOpacity 
            onLongPress={() => handleLongPressMessage(item)}
            onPress={() => handleMessagePress(item)}
            activeOpacity={0.8}
          >
            <Animated.View style={[
              { marginBottom: 12, alignItems: item.sender === 'user' ? 'flex-end' : 'flex-start' },
              selected && { backgroundColor: 'rgba(74, 111, 255, 0.1)', borderRadius: 8, padding: 4 },
              { backgroundColor: highlightedMessageId === item.id ? highlightBg : undefined }
            ]}>
      {item.timestamp ? (
        <Text style={[styles.messageTime, { textAlign: item.sender === 'user' ? 'right' : 'left', alignSelf: item.sender === 'user' ? 'flex-end' : 'flex-start' }]}> 
          {item.timestamp?.toDate?.().toLocaleTimeString?.([], { hour: '2-digit', minute: '2-digit' }) || ''}
        </Text>
      ) : null}
              <View style={[
                styles.messageRow,
                item.sender === 'user' ? styles.messageRight : styles.messageLeft,
                { paddingTop: item.replyTo ? 0 : 10, paddingBottom: 10, paddingHorizontal: 12, minWidth: 80, maxWidth: '80%' }
              ]}>
                {renderReplyPreview()}
        {item.mediaUrl && (
          <View style={styles.mediaContainer}>
            {item.mediaType === 'image' ? (
              <TouchableOpacity onPress={() => handleImagePress(item.mediaUrl)}>
                <Image 
                  source={{ uri: item.mediaUrl }} 
                  style={styles.messageImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ) : item.mediaType === 'video' ? (
              <Video
                source={{ uri: item.mediaUrl }}
                style={styles.messageVideo}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                isLooping={false}
                shouldPlay={false}
                posterStyle={styles.videoPoster}
              />
            ) : null}
          </View>
        )}
        {item.text ? <Text style={[styles.messageText, item.sender === 'user' && { color: '#fff' }]}>{item.text}</Text> : null}
      </View>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </PanGestureHandler>
  );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading chat...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <View style={[styles.headerRow, { backgroundColor: colors.card }]}>
        {isSelectionMode ? (
          <>
            <TouchableOpacity onPress={exitSelectionMode} style={styles.backBtn}>
              <MaterialIcons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.partnerName, { color: colors.text, flex: 1, textAlign: 'center' }]}>
              {selectedMessages.length} Selected
            </Text>
            <View style={{ flexDirection: 'row' }}>
              {selectedMessages.length === 1 && (
                <TouchableOpacity onPress={handleReply} style={{ marginRight: 16 }}>
                  <MaterialIcons name="reply" size={24} color={colors.primary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleDelete}>
                <MaterialIcons name="delete" size={24} color={colors.error} />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.partnerRow}>
          <Image source={chatPartner?.avatar ? { uri: chatPartner.avatar } : require('../../assets/images/placeholder.png')} style={[styles.partnerAvatar, { backgroundColor: colors.background }]} />
          <TouchableOpacity 
            onPress={() => {
              if (chatPartner?.id) {
                router.push(`/users/${chatPartner.id}`);
              }
            }}
            disabled={!chatPartner?.id}
          >
            <Text style={[styles.partnerName, { color: colors.text }]}>
              {chatPartner?.name || 'Loading...'}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
        <View style={styles.menuButton}>
          <TouchableOpacity onPress={handleOptionsPress}>
            <MaterialIcons name="more-vert" size={24} color={colors.text} />
          </TouchableOpacity>
          {showDropdown && (
            <View style={styles.dropdownMenu}>
              <TouchableOpacity 
                style={styles.dropdownOption}
                onPress={() => handleDropdownOptionPress('delete')}
              >
                <Text style={[styles.dropdownOptionText, styles.dropdownOptionDelete]}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.dropdownOption}
                onPress={() => handleDropdownOptionPress('block')}
              >
                <Text style={styles.dropdownOptionText}>Block</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.dropdownOption}
                onPress={() => handleDropdownOptionPress('report')}
              >
                <Text style={styles.dropdownOptionText}>Report</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
          </>
        )}
      </View>
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        style={[styles.messagesList, { backgroundColor: colors.background }]}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        inverted
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.2}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListFooterComponent={loadingMore && !allLoaded ? (
          <View style={{ alignItems: 'center', padding: 12 }}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ color: colors.textSecondary, marginTop: 4 }}>Loading older messages...</Text>
          </View>
        ) : null}
        initialNumToRender={PAGE_SIZE}
        maxToRenderPerBatch={PAGE_SIZE}
        windowSize={10}
        getItemLayout={(data, index) => ({
          length: 70, // Approximate height of each message
          offset: 70 * index,
          index,
        })}
        onContentSizeChange={handleContentSizeChange}
      />
      
      {/* Reply Preview */}
      {replyTo && (
        <View style={[styles.replyPreviewContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <View style={[styles.replyPreviewContent, { backgroundColor: colors.background, borderLeftColor: colors.primary }]}>
            <MaterialIcons 
              name="reply" 
              size={16} 
              color={colors.primary} 
              style={styles.replyPreviewIcon}
            />
            <View style={styles.replyPreviewText}>
              <Text style={[styles.replyPreviewLabel, { color: colors.primary }]}>
                Replying to {replyTo.sender === 'user' ? 'yourself' : chatPartner?.name || 'Unknown'}
              </Text>
              <Text 
                style={[styles.replyPreviewMessage, { color: colors.textSecondary }]}
                numberOfLines={3}
              >
                {replyTo.text ? replyTo.text : (replyTo.mediaType === 'image' ? '📷 Image' : replyTo.mediaType === 'video' ? '🎥 Video' : '[Media]')}
              </Text>
            </View>
            <TouchableOpacity 
              onPress={() => setReplyTo(null)} 
              style={styles.replyPreviewClose}
            >
              <MaterialIcons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      <View style={[styles.inputRow, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        {isBlocked ? (
          <TouchableOpacity 
            style={[styles.input, { 
              backgroundColor: colors.background,
              justifyContent: 'center',
              alignItems: 'center',
              flexDirection: 'row'
            }]}
            onPress={handleUnblockUser}
          >
            <Text style={{ color: colors.text }}>Contact is blocked. </Text>
            <Text style={{ color: colors.primary }}>Tap to unblock</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity onPress={handleMediaUpload} style={styles.mediaBtn} disabled={uploadingMedia}>
              {uploadingMedia ? <ActivityIndicator size={20} color={colors.text} /> : <MaterialIcons name="attach-file" size={24} color={colors.text} />}
            </TouchableOpacity>
            <TextInput
              ref={inputRef}
              style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
              placeholder="Type a message..."
              placeholderTextColor={colors.placeholder}
              value={inputMessage}
              onChangeText={setInputMessage}
              onSubmitEditing={handleSendMessage}
              editable={!uploadingMedia}
            />
            <TouchableOpacity onPress={handleSendMessage} style={styles.sendBtn} disabled={inputMessage.trim() === '' || uploadingMedia}>
              <MaterialIcons name="send" size={24} color={colors.primary} />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Delete Chat Modal */}
      <DeleteChatModal
        visible={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onDelete={handleDeleteChat}
        colors={colors}
        styles={styles}
      />

      {/* Full Screen Image Modal */}
      <Modal
        visible={fullScreenImage !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={closeFullScreenImage}
      >
        <StatusBar hidden={true} />
        <View style={styles.fullScreenContainer}>
          <TouchableOpacity 
            style={styles.fullScreenImageContainer} 
            onPress={closeFullScreenImage}
            activeOpacity={1}
          >
            <Image
              source={{ uri: fullScreenImage }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={closeFullScreenImage}
          >
            <MaterialIcons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Delete Chat Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowDeleteModal(false)}
        >
          <TouchableOpacity 
            style={styles.deleteModal} 
            activeOpacity={1} 
            onPress={() => {}} // Prevent closing when tapping inside modal
          >
            <Text style={styles.deleteModalTitle}>Are you sure to delete the entire chat?</Text>
            <View style={styles.deleteModalButtons}>
               <TouchableOpacity 
                style={[styles.deleteModalButton, styles.deleteModalButtonDestructive]}
                onPress={handleDeleteChat}
              >
                <Text style={styles.deleteModalButtonTextDestructive}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.deleteModalButton, styles.deleteModalButtonSecondary]}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.deleteModalButtonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
             
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

export default function ChatWindowWrapper(props) {
  return (
    <ActionSheetProvider>
      <ChatWindow {...props} />
    </ActionSheetProvider>
  );
}