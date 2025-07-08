import React, { useState, useEffect, useRef } from 'react';
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
} from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import HeaderBar from '../../components/HeaderBar';
import { useTheme } from '../../contexts/ThemeContext';

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
    },
    partnerAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      marginRight: 8,
      backgroundColor: colors.background,
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
  });
}

export default function ChatWindow() {
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
  const { colors } = useTheme();
  const styles = getStyles(colors);

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

  useEffect(() => {
    if (!auth.currentUser || !chatId) {
      setLoading(false);
      return;
    }

    // Fetch chat partner info and last read message
    const fetchChatData = async () => {
      try {
        const chatRef = doc(firestore, 'users', auth.currentUser.uid, 'chats', chatId);
        const chatDoc = await getDoc(chatRef);
        if (chatDoc.exists()) {
          const chatData = chatDoc.data();
          
          // Set last read message ID
          setLastReadMessageId(chatData.lastReadMessageId || null);
          
          const participantIds = chatData.participants;
          const otherParticipantId = participantIds.find(id => id !== auth.currentUser.uid);
          if (otherParticipantId) {
            const otherUserDoc = await getDoc(doc(firestore, 'users', otherParticipantId));
            if (otherUserDoc.exists()) {
              const otherUserData = otherUserDoc.data();
              setChatPartner({
                name: otherUserData.displayName || otherUserData.email || 'Unknown User',
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

    // Listen for messages
    const messagesRef = query(collection(firestore, 'users', auth.currentUser.uid, 'chats', chatId, 'messages'), orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(messagesRef, snapshot => {
      const messagesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        sender: doc.data().senderId === auth.currentUser.uid ? 'user' : 'other',
      }));
      
      const wasEmpty = messages.length === 0;
      setMessages(messagesData);
      setLoading(false);
      
      // Set flag to scroll when messages are first loaded or when user sends a message
      if (wasEmpty || (messagesData.length > messages.length && 
          messagesData[messagesData.length - 1]?.senderId === auth.currentUser.uid)) {
        setShouldScrollToBottom(true);
      }
    });

    fetchChatData();
    return () => unsubscribe();
  }, [chatId]);

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

  // Reset unread count when chat is opened
  useEffect(() => {
    if (!auth.currentUser || !chatId) return;

    const resetUnreadCount = async () => {
      try {
        const currentUserChatRef = doc(firestore, 'users', auth.currentUser.uid, 'chats', chatId);
        await updateDoc(currentUserChatRef, {
          unreadCount: 0
        });

        // Mark messages as read
        const messagesRef = collection(firestore, 'users', auth.currentUser.uid, 'chats', chatId, 'messages');
        const unreadMessages = messages.filter(msg => msg.sender === 'other' && !msg.read);
        
        // Update each unread message to mark as read
        const updatePromises = unreadMessages.map(msg => 
          updateDoc(doc(messagesRef, msg.id), { read: true })
        );
        
        await Promise.all(updatePromises);
      } catch (err) {
        console.error('Error resetting unread count:', err);
      }
    };

    resetUnreadCount();
  }, [auth.currentUser, chatId, messages]);

  const handleSendMessage = async () => {
    if (inputMessage.trim() === '' || !auth.currentUser || !chatId || !chatPartner) return;
    try {
      const messageText = inputMessage.trim();
      const messageTimestamp = serverTimestamp();
      const newMessage = {
        text: messageText,
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.displayName || 'Anonymous',
        timestamp: messageTimestamp,
        read: false,
      };
      await Promise.all([
        addDoc(collection(firestore, 'users', auth.currentUser.uid, 'chats', chatId, 'messages'), newMessage),
        addDoc(collection(firestore, 'users', chatPartner.id, 'chats', chatId, 'messages'), newMessage)
      ]);
      const currentUserChatRef = doc(firestore, 'users', auth.currentUser.uid, 'chats', chatId);
      await updateDoc(currentUserChatRef, {
        lastMessage: { text: messageText, senderId: auth.currentUser.uid },
        timestamp: messageTimestamp,
      });
      const otherUserChatRef = doc(firestore, 'users', chatPartner.id, 'chats', chatId);
      await updateDoc(otherUserChatRef, {
        lastMessage: { text: messageText, senderId: auth.currentUser.uid },
        timestamp: messageTimestamp,
        unreadCount: increment(1)
      });
      setInputMessage('');
      
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
        };
        await Promise.all([
          addDoc(collection(firestore, 'users', auth.currentUser.uid, 'chats', chatId, 'messages'), newMessage),
          addDoc(collection(firestore, 'users', chatPartner.id, 'chats', chatId, 'messages'), newMessage)
        ]);
        const currentUserChatRef = doc(firestore, 'users', auth.currentUser.uid, 'chats', chatId);
        await updateDoc(currentUserChatRef, {
          lastMessage: { mediaUrl: asset.uri, mediaType: newMessage.mediaType, senderId: auth.currentUser.uid },
          timestamp: messageTimestamp,
        });
        const otherUserChatRef = doc(firestore, 'users', chatPartner.id, 'chats', chatId);
        await updateDoc(otherUserChatRef, {
          lastMessage: { mediaUrl: asset.uri, mediaType: newMessage.mediaType, senderId: auth.currentUser.uid },
          timestamp: messageTimestamp,
          unreadCount: increment(1)
        });
        
        // Set flag to scroll to bottom after sending media
        setShouldScrollToBottom(true);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to upload media');
    } finally {
      setUploadingMedia(false);
    }
  };

  const renderMessage = ({ item }) => (
    <View style={{ marginBottom: 12, alignItems: item.sender === 'user' ? 'flex-end' : 'flex-start' }}>
      {item.timestamp ? (
        <Text style={[styles.messageTime, { textAlign: item.sender === 'user' ? 'right' : 'left', alignSelf: item.sender === 'user' ? 'flex-end' : 'flex-start' }]}> 
          {item.timestamp?.toDate?.().toLocaleTimeString?.([], { hour: '2-digit', minute: '2-digit' }) || ''}
        </Text>
      ) : null}
      <View style={[styles.messageRow, item.sender === 'user' ? styles.messageRight : styles.messageLeft]}>
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
    </View>
  );

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
      </View>
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        style={[styles.messagesList, { backgroundColor: colors.background }]}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        onLayout={handleOnLayout}
        onContentSizeChange={handleOnContentSizeChange}
        removeClippedSubviews={false}
        initialNumToRender={50}
        maxToRenderPerBatch={50}
        windowSize={10}
        getItemLayout={(data, index) => ({
          length: 70, // Approximate height of each message
          offset: 70 * index,
          index,
        })}
      />
      <View style={[styles.inputRow, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity onPress={handleMediaUpload} style={styles.mediaBtn} disabled={uploadingMedia}>
          {uploadingMedia ? <ActivityIndicator size={20} color={colors.text} /> : <MaterialIcons name="attach-file" size={24} color={colors.text} />}
        </TouchableOpacity>
        <TextInput
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
      </View>

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
    </KeyboardAvoidingView>
  );
}