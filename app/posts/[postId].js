import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, Image, Dimensions, KeyboardAvoidingView, Platform, FlatList, Modal } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { auth, firestore } from '../../firebaseConfig';
import { collection, doc, getDoc, query, orderBy, onSnapshot, addDoc, updateDoc, arrayUnion, arrayRemove, Timestamp, deleteDoc, setDoc, getDocs } from 'firebase/firestore';
import { MaterialIcons } from '@expo/vector-icons';
import HeaderBar from '../../components/HeaderBar';
import FooterNav from '../../components/FooterNav';
import { useTheme } from '../../contexts/ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const placeholderImage = require('../../assets/images/placeholder.png');
const anonymousAvatar = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';

function formatTimeRemaining(expiresAt) {
  if (!expiresAt) return 'Expired';
  const now = new Date();
  const expirationDate = expiresAt instanceof Timestamp ? expiresAt.toDate() : new Date(expiresAt);
  if (!expirationDate || expirationDate < now) return 'Expired';
  const diff = expirationDate.getTime() - now.getTime();
  const diffSec = Math.floor(diff / 1000);
  const days = Math.floor(diffSec / (60 * 60 * 24));
  const hours = Math.floor((diffSec % (60 * 60 * 24)) / (60 * 60));
  const minutes = Math.floor((diffSec % (60 * 60)) / 60);
  const seconds = diffSec % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

// Helper function to create notifications
const createNotification = async (currentUser, recipientId, type, post, additionalData = {}) => {
  if (!currentUser || !post || currentUser.uid === recipientId) {
    return false;
  }

  try {
    // Ensure recipient's user document exists
    const recipientDocRef = doc(firestore, 'users', recipientId);
    const recipientDoc = await getDoc(recipientDocRef);
    if (!recipientDoc.exists()) {
      await setDoc(recipientDocRef, {
        email: post.creatorEmail || '',
        displayName: post.creatorDisplayName || '',
        photoURL: post.creatorPhotoURL || '',
        createdAt: Timestamp.now(),
        notificationCount: 1
      });
    } else {
      await updateDoc(recipientDocRef, {
        notificationCount: (recipientDoc.data().notificationCount || 0) + 1
      });
    }

    // Always fetch sender's Firestore profile for displayName
    let senderDisplayName = 'Anonymous User';
    let senderPhotoURL = '';
    const senderDocRef = doc(firestore, 'users', currentUser.uid);
    const senderDoc = await getDoc(senderDocRef);
    if (senderDoc.exists()) {
      const senderData = senderDoc.data();
      senderDisplayName = senderData.displayName || 'Anonymous User';
      senderPhotoURL = senderData.photoURL || currentUser.photoURL || '';
    } else {
      senderDisplayName = currentUser.displayName || currentUser.email || currentUser.uid || 'Anonymous User';
      senderPhotoURL = currentUser.photoURL || '';
    }

    // Create notification data
    const notificationData = {
      triggeringUserId: currentUser.uid,
      triggeringUserName: senderDisplayName,
      triggeringUserAvatar: senderPhotoURL,
      type,
      message: getNotificationMessage(type),
      postId: post.id,
      postTitle: post.title || 'Untitled',
      postImage: post.imageUrl || '',
      seen: false,
      read: false,
      timestamp: Timestamp.now(),
      ...additionalData
    };

    // Create the notification document
    const notificationsRef = collection(firestore, 'users', recipientId, 'notifications');
    await addDoc(notificationsRef, notificationData);

    return true;
  } catch (error) {
    console.error('Error creating notification:', error);
    return false;
  }
};

// Helper function to get notification message
const getNotificationMessage = (type) => {
  switch (type) {
    case 'like':
      return 'liked your post';
    case 'unlike':
      return 'unliked your post';
    case 'comment':
      return 'commented on your post';
    case 'reply':
      return 'replied to your comment';
    case 'eyewitness':
      return 'marked themselves as an eyewitness on your post';
    case 'remove_eyewitness':
      return 'removed eyewitness status';
    case 'comment_like':
      return 'liked your comment';
    case 'reply_like':
      return 'liked your reply';
    default:
      return 'interacted with your post';
  }
};

// Helper function to find a comment or reply by ID
const findCommentById = (commentsList, id) => {
  for (const comment of commentsList) {
    if (comment.id === id) {
      return comment;
    }
    if (comment.replies && comment.replies.length > 0) {
      const foundInReplies = findCommentById(comment.replies, id);
      if (foundInReplies) {
        return foundInReplies;
      }
    }
  }
  return null;
};

// Helper: Render text with blue @mentions (simple: @ to next space)
const renderTextWithMentions = (text, allUsers, navigation) => {
  if (!text) return null;
  const regex = /(@[^\s]+)/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const mention = match[1];
    const username = mention.slice(1);
    const user = allUsers.find(u => u.displayName === username);
    parts.push(
      <Text
        key={match.index}
        style={{ color: '#4A6FFF' }}
        onPress={() => {
          if (user) navigation.push(`/users/${user.id}`);
        }}
      >
        {mention}
      </Text>
    );
    lastIndex = match.index + mention.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
};

// Comment Item Component
const CommentItem = ({ comment, onReply, onLike, isReply = false, colors, allUsers, navigation }) => {
  const [openReplies, setOpenReplies] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionDropdown, setMentionDropdown] = useState([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const replyInputRef = useRef();

  // Handle @ mention detection in reply input
  const handleReplyInputChange = (text) => {
    setReplyText(text);
    const caret = replyInputRef.current?.selection?.start ?? text.length;
    const match = /@([\w]*)$/.exec(text.slice(0, caret));
    if (match) {
      const query = match[1].toLowerCase();
      if (query.length === 0) {
        setMentionDropdown(allUsers);
        setShowMentionDropdown(true);
        setMentionQuery('');
      } else {
        const filtered = allUsers.filter(u => u.displayName.toLowerCase().includes(query));
        setMentionDropdown(filtered);
        setShowMentionDropdown(true);
        setMentionQuery(query);
      }
    } else {
      setShowMentionDropdown(false);
      setMentionQuery('');
    }
  };

  // Insert selected username into reply input
  const handleSelectMention = (user) => {
    const text = replyText;
    const caret = replyInputRef.current?.selection?.start ?? text.length;
    const before = text.slice(0, caret);
    const after = text.slice(caret);
    const newBefore = before.replace(/@([\w]*)$/, `@${user.displayName} `);
    setReplyText(newBefore + after);
    setShowMentionDropdown(false);
    setMentionQuery('');
    setTimeout(() => replyInputRef.current?.focus(), 10);
  };

  const liked = auth.currentUser && comment.likedBy?.includes(auth.currentUser.uid);

  const handleLikeComment = async () => {
    if (!auth.currentUser) return;
    if (isReply && comment.parentCommentId) {
      await onLike(comment.id, liked, true, comment.parentCommentId);
    } else {
      await onLike(comment.id, liked, false, null);
    }
  };

  const handleReply = async () => {
    if (replyText.trim() === '' || !auth.currentUser) return;
    setReplyLoading(true);
    setReplyText(''); // Clear immediately
    try {
      await onReply(comment.id, replyText.trim());
      // Tagging notification for replies
      const mentionedNames = parseMentions(replyText.trim());
      console.log('Parsed mentions in reply:', mentionedNames);
      await sendTaggingNotifications(auth.currentUser, mentionedNames, allUsers, post, replyText.trim(), 'reply');
    } catch (error) {
      // No error modal
    } finally {
      setOpenReplies(true); // Keep replies expanded after adding a reply
      setReplyLoading(false);
    }
  };

  const handleToggleReplies = () => {
    setOpenReplies(!openReplies);
  };

  return (
    <View style={[styles.commentItem, { backgroundColor: colors.card }, isReply && styles.replyItem]}>
      <View style={styles.commentHeader}>
        <Image 
          source={comment.userAvatar ? { uri: comment.userAvatar } : { uri: anonymousAvatar }} 
          style={styles.commentAvatar} 
        />
        <View style={styles.commentContent}>
          <TouchableOpacity 
            onPress={() => {
              if (comment.senderId) {
                router.push(`/users/${comment.senderId}`);
              }
            }}
            disabled={!comment.senderId}
          >
            <Text style={[styles.commentUsername, { color: colors.text }]}>
              {comment.username}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.commentText, { color: colors.textSecondary, flexWrap: 'wrap' }]}> 
            {renderTextWithMentions(comment.text, allUsers, router)}
          </Text>
          <Text style={[styles.commentTime, { color: colors.textTertiary }]}>
            {comment.timestamp?.toDate().toLocaleString()}
          </Text>
          
          {/* Comment Actions */}
          <View style={styles.commentActions}>
            <TouchableOpacity 
              style={styles.commentAction} 
              onPress={handleLikeComment}
            >
              <MaterialIcons 
                name={liked ? "favorite" : "favorite-border"} 
                size={16} 
                color={liked ? colors.error : colors.textTertiary} 
              />
              <Text style={[styles.commentActionText, { color: liked ? colors.error : colors.textTertiary }]}>
                Like ({comment.likes || 0})
              </Text>
            </TouchableOpacity>
            
            {!isReply && (
              <TouchableOpacity 
                style={styles.commentAction} 
                onPress={() => setOpenReplies(true)}
              >
                <MaterialIcons name="reply" size={16} color={colors.textTertiary} />
                <Text style={[styles.commentActionText, { color: colors.textTertiary }]}>Reply</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Expand/Collapse Arrow - Only show for comments with replies and not replies themselves */}
          {comment.replies?.length > 0 && !isReply && (
            <TouchableOpacity 
              style={[styles.expandButton, { backgroundColor: colors.border }]} 
              onPress={handleToggleReplies}
            >
              <MaterialIcons 
                name={openReplies ? "expand-less" : "expand-more"} 
                size={20} 
                color={colors.textTertiary} 
              />
              <Text style={[styles.expandText, { color: colors.textTertiary }]}>
                {openReplies ? 'Hide' : `Show ${comment.replies.length} repl${comment.replies.length === 1 ? 'y' : 'ies'}`}
              </Text>
            </TouchableOpacity>
          )}

          {/* Reply Input - Only show when expanded and it's a top-level comment */}
          {openReplies && !isReply && (
            <View style={[styles.replyInputContainer, { backgroundColor: colors.card }]}> 
              <TextInput
                ref={replyInputRef}
                style={[styles.replyInput, { color: colors.text }]}
                placeholder="Add a reply..."
                placeholderTextColor={colors.placeholder}
                value={replyText}
                onChangeText={handleReplyInputChange}
                multiline
              />
              {showMentionDropdown && mentionDropdown.length > 0 && (
                <View style={{ position: 'absolute', top: 40, left: 0, right: 0, backgroundColor: colors.card, borderRadius: 8, zIndex: 10, maxHeight: 176, borderWidth: 1, borderColor: colors.border, overflow: 'scroll' }}>
                  {mentionDropdown.slice(0, 6).map(item => (
                    <TouchableOpacity key={item.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 10 }} onPress={() => handleSelectMention(item)}>
                      <Image source={item.photoURL ? { uri: item.photoURL } : { uri: anonymousAvatar }} style={{ width: 28, height: 28, borderRadius: 14, marginRight: 8 }} />
                      <Text style={{ color: colors.text }}>{item.displayName}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View style={styles.replyInputActions}>
                <TouchableOpacity 
                  style={styles.replyCancelButton}
                  onPress={() => {
                    setOpenReplies(false);
                    setReplyText('');
                  }}
                >
                  <Text style={[styles.replyCancelText, { color: colors.primary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.replyPostButton, (replyText.trim() === '' || replyLoading) && styles.replyPostButtonDisabled, { backgroundColor: replyText.trim() === '' || replyLoading ? colors.textTertiary : colors.primary }]} 
                  onPress={handleReply}
                  disabled={replyText.trim() === '' || replyLoading}
                >
                  {replyLoading ? (
                    <ActivityIndicator size="small" color={colors.text} />
                  ) : (
                    <Text style={[styles.replyPostText, { color: '#fff' }]}>Reply</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Render replies - Only show when expanded */}
      {comment.replies && comment.replies.length > 0 && openReplies && (
        <View style={styles.repliesContainer}>
          {comment.replies.map(reply => (
            <CommentItem 
              key={reply.id} 
              comment={{ ...reply, parentCommentId: comment.id }}
              onReply={onReply} 
              onLike={onLike}
              isReply={true}
              colors={colors}
              allUsers={allUsers}
              navigation={navigation}
            />
          ))}
        </View>
      )}
    </View>
  );
};

export default function PostDetail() {
  const { colors } = useTheme();
  const { postId } = useLocalSearchParams();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loadingPost, setLoadingPost] = useState(true);
  const [loadingComments, setLoadingComments] = useState(true);
  const [postError, setPostError] = useState(null);
  const [commentError, setCommentError] = useState(null);
  const [inputComment, setInputComment] = useState('');
  const [liked, setLiked] = useState(false);
  const [eyewitnessed, setEyewitnessed] = useState(false);
  const [actionLoading, setActionLoading] = useState({
    like: false,
    comment: false,
    reply: false,
    eyewitness: false,
  });
  // --- Tagging/Autocomplete state ---
  const [allUsers, setAllUsers] = useState([]); // All users for autocomplete
  const [mentionDropdown, setMentionDropdown] = useState([]); // Filtered users
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const commentInputRef = useRef();
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedReportReason, setSelectedReportReason] = useState('');
  const reportReasons = [
    { key: 'offensive', label: 'Offensive' },
    { key: 'misleading', label: 'Misleading' },
    { key: 'spam', label: 'Spam' },
    { key: 'other', label: 'Other' },
  ];
  const [reportDetails, setReportDetails] = useState('');

  // Fetch all users for autocomplete
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRef = collection(firestore, 'users');
        const querySnapshot = await getDocs(usersRef);
        const users = querySnapshot.docs.map(doc => ({
          id: doc.id,
          displayName: doc.data().displayName || '',
          photoURL: doc.data().photoURL || '',
        }));
        setAllUsers(users);
      } catch (err) {
        console.error('Error fetching users for mentions:', err);
      }
    };
    fetchUsers();
  }, []);

  // Handle @ mention detection in comment input
  const handleCommentInputChange = (text) => {
    setInputComment(text);
    // Find last @ and get the query after it
    const match = /@([\w]*)$/.exec(text.slice(0, commentInputRef.current?.selection?.start ?? text.length));
    if (match) {
      const query = match[1].toLowerCase();
      if (query.length === 0) {
        setMentionDropdown(allUsers);
        setShowMentionDropdown(true);
        setMentionQuery('');
      } else {
        const filtered = allUsers.filter(u => u.displayName.toLowerCase().includes(query));
        setMentionDropdown(filtered);
        setShowMentionDropdown(true);
        setMentionQuery(query);
      }
    } else {
      setShowMentionDropdown(false);
      setMentionQuery('');
    }
  };

  // Insert selected username into comment input
  const handleSelectMention = (user) => {
    // Replace the last @query with @username
    const text = inputComment;
    const caret = commentInputRef.current?.selection?.start ?? text.length;
    const before = text.slice(0, caret);
    const after = text.slice(caret);
    const newBefore = before.replace(/@([\w]*)$/, `@${user.displayName} `);
    setInputComment(newBefore + after);
    setShowMentionDropdown(false);
    setMentionQuery('');
    // Refocus input
    setTimeout(() => commentInputRef.current?.focus(), 10);
  };

  // Add this function to handle post deletion
  const handleDeletePost = async () => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const postRef = doc(firestore, 'posts', post.id);
              await deleteDoc(postRef);
              Alert.alert('Deleted', 'Your post has been deleted.');
              router.push('/home');
            } catch (err) {
              Alert.alert('Error', 'Failed to delete post.');
            }
          }
        }
      ]
    );
  };

  // Fetch post data with real-time listener
  useEffect(() => {
    if (!postId) return;

    const postRef = doc(firestore, 'posts', postId);
    const unsubscribePost = onSnapshot(postRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const postData = { id: docSnap.id, ...docSnap.data() };
          setPost(postData);
          if (auth.currentUser) {
            setLiked(postData.likedBy?.includes(auth.currentUser.uid) || false);
            setEyewitnessed(postData.eyewitnessedBy?.includes(auth.currentUser.uid) || false);
          }
        } else {
          setPostError('Post not found.');
        }
        setLoadingPost(false);
      },
      (err) => {
        console.error('Error fetching post:', err);
        setPostError('Failed to fetch post.');
        setLoadingPost(false);
      }
    );

    return () => unsubscribePost();
  }, [postId]);

  // Fetch comments data with real-time listener
  useEffect(() => {
    if (!postId) return;

    const commentsCollectionRef = collection(firestore, 'posts', postId, 'comments');
    const commentsQuery = query(commentsCollectionRef, orderBy('timestamp', 'asc'));

    const unsubscribeComments = onSnapshot(commentsQuery,
      async (snapshot) => {
        const commentsData = await Promise.all(snapshot.docs.map(async (commentDocSnap) => {
          const comment = { id: commentDocSnap.id, ...commentDocSnap.data() };

          // Fetch comment author's details
          let author = { username: 'Unknown User', userAvatar: '' };
          if (comment.senderId) {
            try {
              const userDocRef = doc(firestore, 'users', comment.senderId);
              const userDocSnap = await getDoc(userDocRef);
              if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                author = {
                  username: userData.displayName || userData.email || 'Unknown User',
                  userAvatar: userData.photoURL || '',
                };
              }
            } catch (err) {
              console.error('Error fetching comment author details:', err);
            }
          }

          return {
            ...comment,
            ...author,
          };
        }));

        setComments(commentsData);
        setLoadingComments(false);
      },
      err => {
        console.error('Error fetching comments:', err);
        setCommentError('Failed to load comments.');
        setLoadingComments(false);
      }
    );

    return () => unsubscribeComments();
  }, [postId]);

  const handleLikePost = async () => {
    if (!auth.currentUser || !post || actionLoading.like) return;

    setActionLoading(prev => ({ ...prev, like: true }));
    try {
      const postRef = doc(firestore, 'posts', post.id);
      const userId = auth.currentUser.uid;

      // Ensure user document exists
      const userDocRef = doc(firestore, 'users', auth.currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          email: auth.currentUser.email || '',
          displayName: auth.currentUser.displayName || '',
          photoURL: auth.currentUser.photoURL || '',
          createdAt: Timestamp.now(),
          notificationCount: 0
        });
      }

      if (liked) {
        // Unlike the post
        await updateDoc(postRef, {
          likes: (post.likes || 0) - 1,
          likedBy: arrayRemove(userId),
        });
        await createNotification(auth.currentUser, post.creatorId, 'unlike', post);
      } else {
        // Like the post
        await updateDoc(postRef, {
          likes: (post.likes || 0) + 1,
          likedBy: arrayUnion(userId),
        });
        await createNotification(auth.currentUser, post.creatorId, 'like', post);
      }
    } catch (err) {
      console.error('Error liking post:', err);
      Alert.alert('Error', 'Failed to update like status');
    } finally {
      setActionLoading(prev => ({ ...prev, like: false }));
    }
  };

  const handleToggleEyewitness = async () => {
    if (!auth.currentUser || !post || actionLoading.eyewitness) return;

    setActionLoading(prev => ({ ...prev, eyewitness: true }));
    try {
      const postRef = doc(firestore, 'posts', post.id);
      const userId = auth.currentUser.uid;

      // Ensure user document exists
      const userDocRef = doc(firestore, 'users', auth.currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          email: auth.currentUser.email || '',
          displayName: auth.currentUser.displayName || '',
          photoURL: auth.currentUser.photoURL || '',
          createdAt: Timestamp.now(),
          notificationCount: 0
        });
      }

      if (eyewitnessed) {
        // Remove eyewitness status
        await updateDoc(postRef, {
          eyewitnesses: (post.eyewitnesses || 0) - 1,
          eyewitnessedBy: arrayRemove(userId),
        });
        await createNotification(auth.currentUser, post.creatorId, 'remove_eyewitness', post);
      } else {
        // Add eyewitness status
        await updateDoc(postRef, {
          eyewitnesses: (post.eyewitnesses || 0) + 1,
          eyewitnessedBy: arrayUnion(userId),
        });
        await createNotification(auth.currentUser, post.creatorId, 'eyewitness', post);
      }
    } catch (err) {
      console.error('Error toggling eyewitness status:', err);
      Alert.alert('Error', 'Failed to update eyewitness status');
    } finally {
      setActionLoading(prev => ({ ...prev, eyewitness: false }));
    }
  };

  // Helper: Find user by displayName
  const findUserByDisplayName = (name) => {
    return allUsers.find(u => u.displayName && u.displayName.toLowerCase() === name.toLowerCase());
  };

  // Helper: Parse @mentions from text
  const parseMentions = (text) => {
    // Only match @username up to the next space or end
    const regex = /@([^\s]+)/g;
    const mentions = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      mentions.push(match[1].trim());
    }
    return mentions;
  };

  // Helper: Send tagging notifications
  const sendTaggingNotifications = async (currentUser, mentionedNames, allUsers, post, contextText, contextType) => {
    const notifiedUserIds = new Set();
    // Fetch the current user's Firestore profile for displayName
    let taggerName = 'Anonymous User';
    try {
      const userDocRef = doc(firestore, 'users', currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        taggerName = userData.displayName || 'Anonymous User';
      } else {
        taggerName = currentUser.displayName || 'Anonymous User';
      }
    } catch (err) {
      taggerName = currentUser.displayName || 'Anonymous User';
    }
    for (const name of mentionedNames) {
      const user = allUsers.find(u => u.displayName && u.displayName.toLowerCase() === name.toLowerCase());
      if (user && user.id !== currentUser.uid && !notifiedUserIds.has(user.id)) {
        let type = 'mention';
        let message = '';
        if (contextType === 'comment') message = `${taggerName} tagged you in a comment.`;
        else if (contextType === 'reply') message = `${taggerName} tagged you in a reply.`;
        else if (contextType === 'post') message = `${taggerName} tagged you in a post.`;
        console.log('Sending tagging notification to', user.displayName, user.id, 'for', contextType);
        await createNotification(currentUser, user.id, type, post, { commentText: contextText, message });
        console.log('Tagging notification sent to', user.displayName, user.id);
        notifiedUserIds.add(user.id);
      }
    }
  };

  // Modified handleAddComment to notify tagged users
  const handleAddComment = async () => {
    if (!auth.currentUser || !inputComment.trim() || actionLoading.comment) return;

    setActionLoading(prev => ({ ...prev, comment: true }));
    try {
      const userDocRef = doc(firestore, 'users', auth.currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      const userData = userDoc.exists() ? userDoc.data() : null;
      const displayName = userData?.displayName || 'Anonymous User';
      
      const commentData = {
        text: inputComment.trim(),
        senderId: auth.currentUser.uid,
        username: displayName,
        userAvatar: auth.currentUser.photoURL,
        timestamp: Timestamp.now(),
        likes: 0,
        likedBy: [],
      };

      const commentsRef = collection(firestore, 'posts', post.id, 'comments');
      await addDoc(commentsRef, commentData);

      const postRef = doc(firestore, 'posts', post.id);
      await updateDoc(postRef, {
        commentCount: (post.commentCount || 0) + 1
      });

      // Create notification for post creator if it's not your own post
      if (post.creatorId !== auth.currentUser.uid) {
        await createNotification(auth.currentUser, post.creatorId, 'comment', post);
      }

      // --- Tagging notification logic ---
      const mentionedNames = parseMentions(inputComment.trim());
      console.log('Parsed mentions in comment:', mentionedNames);
      await sendTaggingNotifications(auth.currentUser, mentionedNames, allUsers, post, inputComment.trim(), 'comment');

      setInputComment('');
    } catch (err) {
      console.error('Error adding comment:', err);
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setActionLoading(prev => ({ ...prev, comment: false }));
    }
  };

  if (loadingPost) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}> 
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading post...</Text>
      </View>
    );
  }

  if (postError) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}> 
        <Text style={[styles.errorText, { color: colors.error }]}>{postError}</Text>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}> 
        <Text style={[styles.errorText, { color: colors.error }]}>Post not found.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <HeaderBar />
      <ScrollView style={[styles.scrollView, { backgroundColor: colors.background }]} contentContainerStyle={styles.scrollContent}>
        {/* Post Card */}
        <View style={[styles.postCard, { backgroundColor: colors.card }]}> 
          {/* User Info */}
          <View style={[styles.postHeader, { backgroundColor: colors.surface }]}> 
            <TouchableOpacity 
              style={styles.userInfoContainer}
              onPress={() => {
                if (!post.isAnonymous && post.creatorId) {
                  router.push(`/users/${post.creatorId}`);
                }
              }}
              disabled={post.isAnonymous || !post.creatorId}
            >
              <Image 
                source={post.isAnonymous ? { uri: anonymousAvatar } : (post.userAvatar ? { uri: post.userAvatar } : { uri: anonymousAvatar })} 
                style={styles.postAvatar} 
              />
              <Text style={[styles.postUsername, { color: colors.text }]}>{post.isAnonymous ? 'Anonymous' : (post.username || 'Unnamed User')}</Text>
            </TouchableOpacity>
            {/* Show delete icon only for post creator, else show report button */}
            {auth.currentUser && post.creatorId === auth.currentUser.uid ? (
              <TouchableOpacity onPress={handleDeletePost} style={{ marginLeft: 'auto', padding: 8 }}>
                <MaterialIcons name="delete-outline" size={24} color={colors.error} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => setReportModalVisible(true)} style={{ marginLeft: 'auto', padding: 8 }}>
                <MaterialIcons name="flag" size={24} color={colors.error} />
              </TouchableOpacity>
            )}
          </View>
          {/* Post Image */}
          <View style={[styles.postImageContainer, { backgroundColor: colors.border }]}> 
            <Image 
              source={post.imageUrl ? { uri: post.imageUrl } : placeholderImage} 
              style={styles.postImage} 
              resizeMode="contain"
            />
          </View>
          {/* Post Content */}
          <View style={styles.postContent}>
            <Text style={[styles.postTitle, { color: colors.text }]}>{post.title}</Text>
            <Text style={[styles.postCaption, { color: colors.textSecondary, flexWrap: 'wrap' }]}> 
              {renderTextWithMentions(post.caption, allUsers, router)}
            </Text>
            {/* Tags */}
            <View style={styles.postTags}>
              {post.tags?.map(tag => (
                <View key={tag} style={[styles.postTag, { backgroundColor: colors.primary }]}> 
                  <Text style={[styles.postTagText, { color: '#fff' }]}>{tag}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.postTime, { color: colors.textTertiary }]}>Posted: {post.createdAt?.toDate().toLocaleString()}</Text>
          </View>
          {/* Post Actions */}
          <View style={[styles.postActions, { borderTopColor: colors.border }]}> 
            <TouchableOpacity 
              style={styles.postAction} 
              onPress={handleLikePost}
              disabled={actionLoading.like}
            >
              {actionLoading.like ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <MaterialIcons 
                  name={liked ? "favorite" : "favorite-border"} 
                  size={24} 
                  color={liked ? colors.error : colors.textTertiary} 
                />
              )}
              <Text style={[styles.postActionText, { color: colors.textTertiary }]}>{post.likes || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.postAction} 
              onPress={handleToggleEyewitness}
              disabled={actionLoading.eyewitness}
            >
              {actionLoading.eyewitness ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <MaterialIcons 
                  name="visibility" 
                  size={24} 
                  color={eyewitnessed ? colors.primary : colors.textTertiary} 
                />
              )}
              <Text style={[styles.postActionText, { color: colors.textTertiary }]}>{post.eyewitnesses || 0}</Text>
            </TouchableOpacity>
            <View style={styles.postAction}>
              <MaterialIcons name="chat-bubble-outline" size={24} color={colors.textTertiary} />
              <Text style={[styles.postActionText, { color: colors.textTertiary }]}>{post.commentCount || 0}</Text>
            </View>
          </View>
        </View>
        {/* Comments Section */}
        <View style={styles.commentsSection}>
          <Text style={[styles.commentsTitle, { color: colors.text }]}>Comments ({comments.length})</Text>
          {/* Comment Input */}
          <View style={[styles.commentInputContainer, { backgroundColor: colors.card }]}> 
            <Image 
              source={auth.currentUser?.photoURL ? { uri: auth.currentUser.photoURL } : { uri: anonymousAvatar }} 
              style={styles.commentInputAvatar} 
            />
            <View style={{ flex: 1 }}>
              <TextInput
                ref={commentInputRef}
                style={[styles.commentInput, { color: colors.text }]}
                placeholder="Add a comment..."
                placeholderTextColor={colors.placeholder}
                value={inputComment}
                onChangeText={handleCommentInputChange}
                multiline
              />
              {showMentionDropdown && mentionDropdown.length > 0 && (
                <View style={{ position: 'absolute', top: 40, left: 0, right: 0, backgroundColor: colors.card, borderRadius: 8, zIndex: 10, maxHeight: 176, borderWidth: 1, borderColor: colors.border, overflow: 'scroll' }}>
                  {mentionDropdown.slice(0, 6).map(item => (
                    <TouchableOpacity key={item.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 10 }} onPress={() => handleSelectMention(item)}>
                      <Image source={item.photoURL ? { uri: item.photoURL } : { uri: anonymousAvatar }} style={{ width: 28, height: 28, borderRadius: 14, marginRight: 8 }} />
                      <Text style={{ color: colors.text }}>{item.displayName}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <TouchableOpacity 
              style={[styles.commentPostButton, (inputComment.trim() === '' || actionLoading.comment) && styles.commentPostButtonDisabled, { backgroundColor: inputComment.trim() === '' || actionLoading.comment ? colors.textTertiary : colors.primary }]} 
              onPress={handleAddComment}
              disabled={inputComment.trim() === '' || actionLoading.comment}
            >
              {actionLoading.comment ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Text style={[styles.commentPostButtonText, { color: '#fff' }]}>Post</Text>
              )}
            </TouchableOpacity>
          </View>
          {loadingComments ? (
            <View style={styles.commentsLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.commentsLoadingText, { color: colors.textTertiary }]}>Loading comments...</Text>
            </View>
          ) : commentError ? (
            <Text style={[styles.commentsError, { color: colors.error }]}>{commentError}</Text>
          ) : comments.length === 0 ? (
            <Text style={[styles.noCommentsText, { color: colors.textTertiary }]}>No comments yet. Be the first to comment!</Text>
          ) : (
            <View style={styles.commentsList}>
              {comments.map(comment => (
                <CommentItem 
                  key={comment.id} 
                  comment={comment} 
                  onReply={async (commentId, text) => {
                    // Firestore update for reply
                    try {
                      const commentRef = doc(firestore, 'posts', post.id, 'comments', commentId);
                      const parentComment = comments.find(c => c.id === commentId);

                      // Fetch sender's Firestore profile for displayName
                      let senderDisplayName = 'Anonymous User';
                      let senderPhotoURL = '';
                      const senderDocRef = doc(firestore, 'users', auth.currentUser.uid);
                      const senderDoc = await getDoc(senderDocRef);
                      if (senderDoc.exists()) {
                        const senderData = senderDoc.data();
                        senderDisplayName = senderData.displayName || 'Anonymous User';
                        senderPhotoURL = senderData.photoURL || auth.currentUser.photoURL || '';
                      } else {
                        senderDisplayName = auth.currentUser.displayName || auth.currentUser.email || auth.currentUser.uid || 'Anonymous User';
                        senderPhotoURL = auth.currentUser.photoURL || '';
                      }

                      await updateDoc(commentRef, {
                        replies: arrayUnion({
                          id: `reply-${Date.now()}`,
                          text: text,
                          senderId: auth.currentUser.uid,
                          username: senderDisplayName,
                          userAvatar: senderPhotoURL,
                          timestamp: Timestamp.now(),
                          likes: 0,
                          likedBy: [],
                        })
                      });
                      const postRef = doc(firestore, 'posts', post.id);
                      await updateDoc(postRef, {
                        commentCount: (post.commentCount || 0) + 1
                      });
                      if (parentComment && parentComment.senderId !== auth.currentUser.uid) {
                        await createNotification(auth.currentUser, parentComment.senderId, 'reply', post);
                      }
                    } catch (err) {
                      // Only show alert if Firestore update fails
                      throw err;
                    }
                    // Notification logic (do not alert user if this fails)
                    try {
                      const mentionedNames = parseMentions(text.trim());
                      console.log('Parsed mentions in reply:', mentionedNames);
                      await sendTaggingNotifications(auth.currentUser, mentionedNames, allUsers, post, text.trim(), 'reply');
                    } catch (err) {
                      console.error('Failed to send tagging notification:', err);
                    }
                  }}
                  onLike={async (commentId, liked, isReply = false, parentCommentId = null) => {
                    if (!isReply) {
                      // Like/unlike a top-level comment
                      const commentRef = doc(firestore, 'posts', post.id, 'comments', commentId);
                      const commentToUpdate = comments.find(c => c.id === commentId);
                      if (commentToUpdate) {
                        if (liked) {
                          await updateDoc(commentRef, {
                            likes: (commentToUpdate.likes || 0) - 1,
                            likedBy: arrayRemove(auth.currentUser.uid),
                          });
                        } else {
                          await updateDoc(commentRef, {
                            likes: (commentToUpdate.likes || 0) + 1,
                            likedBy: arrayUnion(auth.currentUser.uid),
                          });
                          if (commentToUpdate.senderId !== auth.currentUser.uid) {
                            await createNotification(auth.currentUser, commentToUpdate.senderId, 'comment_like', post);
                          }
                        }
                      }
                    } else {
                      // Like/unlike a reply
                      const parentCommentRef = doc(firestore, 'posts', post.id, 'comments', parentCommentId);
                      const parentComment = comments.find(c => c.id === parentCommentId);
                      if (parentComment && parentComment.replies) {
                        const replyIndex = parentComment.replies.findIndex(r => r.id === commentId);
                        if (replyIndex !== -1) {
                          const reply = parentComment.replies[replyIndex];
                          let updatedReply = { ...reply };
                          if (liked) {
                            updatedReply.likes = (reply.likes || 0) - 1;
                            updatedReply.likedBy = (reply.likedBy || []).filter(uid => uid !== auth.currentUser.uid);
                          } else {
                            updatedReply.likes = (reply.likes || 0) + 1;
                            updatedReply.likedBy = [...(reply.likedBy || []), auth.currentUser.uid];
                          }
                          // Update the replies array
                          const updatedReplies = [...parentComment.replies];
                          updatedReplies[replyIndex] = updatedReply;
                          await updateDoc(parentCommentRef, {
                            replies: updatedReplies
                          });
                          // Optionally, send notification to reply author
                          if (!liked && reply.senderId !== auth.currentUser.uid) {
                            await createNotification(auth.currentUser, reply.senderId, 'reply_like', post);
                          }
                        }
                      }
                    }
                  }}
                  colors={colors}
                  allUsers={allUsers}
                  navigation={router}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      <FooterNav />
      {/* Report Modal */}
      <Modal
        visible={reportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#000A', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 24, width: '85%', maxWidth: 340 }}>
            <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 18, marginBottom: 16 }}>Report Post</Text>
            {reportReasons.map(r => (
              <TouchableOpacity
                key={r.key}
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
                onPress={() => setSelectedReportReason(r.key)}
              >
                <MaterialIcons name={selectedReportReason === r.key ? 'radio-button-checked' : 'radio-button-unchecked'} size={20} color={colors.primary} />
                <Text style={{ color: colors.text, marginLeft: 10 }}>{r.label}</Text>
              </TouchableOpacity>
            ))}
            {selectedReportReason === 'other' && (
              <TextInput
                style={{ backgroundColor: colors.input, color: colors.text, borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}
                placeholder="Please specify..."
                placeholderTextColor={colors.placeholder}
                value={reportDetails}
                onChangeText={setReportDetails}
                multiline
              />
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
              <TouchableOpacity onPress={() => setReportModalVisible(false)} style={{ marginRight: 16 }}>
                <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  // No backend yet, just close modal
                  setReportModalVisible(false);
                  setSelectedReportReason('');
                  setReportDetails('');
                  Alert.alert('Reported', 'Thank you for reporting. Our team will review this post.');
                }}
                disabled={!selectedReportReason}
                style={{ opacity: selectedReportReason ? 1 : 0.5 }}
              >
                <Text style={{ color: colors.error, fontWeight: 'bold', fontSize: 15 }}>Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  postCard: {
    backgroundColor: '#181818',
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#232323',
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  postUsername: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  clickableUsername: {
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
    textDecorationColor: '#4A6FFF',
  },
  postImageContainer: {
    width: '100%',
    height: SCREEN_WIDTH * 0.7,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  postContent: {
    padding: 16,
  },
  postTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 8,
  },
  postCaption: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  postTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  postTag: {
    backgroundColor: '#4A6FFF',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  postTagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  postTime: {
    color: '#666',
    fontSize: 12,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  postAction: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 8,
  },
  postActionText: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    backgroundColor: '#232323',
    borderRadius: 20,
    marginBottom: 16,
  },
  commentInputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  commentInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingVertical: 0,
    paddingHorizontal: 0,
    minHeight: 40,
    maxHeight: 100,
    textAlignVertical: 'top',
  },
  commentPostButton: {
    backgroundColor: '#4A6FFF',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentPostButtonDisabled: {
    backgroundColor: '#666',
    opacity: 0.7,
  },
  commentPostButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  commentsSection: {
    marginTop: 8,
  },
  commentsTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  commentsLoading: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  commentsLoadingText: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
  },
  commentsError: {
    color: '#e74c3c',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  noCommentsText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  commentsList: {
    marginTop: 8,
  },
  commentItem: {
    backgroundColor: '#232323',
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
  },
  replyItem: {
    marginLeft: 40, // Indent replies
  },
  commentHeader: {
    flexDirection: 'row',
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentUsername: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
  },
  commentText: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 6,
    lineHeight: 18,
  },
  commentTime: {
    color: '#666',
    fontSize: 12,
  },
  commentActions: {
    flexDirection: 'row',
    marginTop: 8,
  },
  commentAction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  commentActionText: {
    color: '#666',
    fontSize: 12,
    marginLeft: 4,
  },
  commentActionTextLiked: {
    color: '#FF3B30',
  },
  replyInputContainer: {
    backgroundColor: '#232323',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  replyInput: {
    color: '#fff',
    fontSize: 14,
    minHeight: 40,
    maxHeight: 100,
    textAlignVertical: 'top',
  },
  replyInputActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  replyCancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  replyCancelText: {
    color: '#4A6FFF',
    fontSize: 14,
  },
  replyPostButton: {
    backgroundColor: '#4A6FFF',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyPostButtonDisabled: {
    backgroundColor: '#666',
    opacity: 0.7,
  },
  replyPostText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  repliesContainer: {
    marginLeft: 40, // Indent replies
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#333',
    borderRadius: 12,
  },
  expandText: {
    color: '#666',
    fontSize: 12,
    marginLeft: 4,
  },
}); 