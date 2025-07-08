import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image, RefreshControl } from 'react-native';
import { auth, firestore } from '../firebaseConfig';
import { collection, query, orderBy, onSnapshot, doc, getDoc, setDoc, deleteDoc, Timestamp, writeBatch, updateDoc } from 'firebase/firestore';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import HeaderBar from '../components/HeaderBar';
import FooterNav from '../components/FooterNav';
import { useTheme } from '../contexts/ThemeContext';

const anonymousAvatar = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';

const getNotificationIcon = (type) => {
  switch (type) {
    case 'like':
      return { name: 'favorite', color: '#FF3B30' };
    case 'unlike':
      return { name: 'favorite-border', color: '#666' };
    case 'comment':
      return { name: 'chat-bubble', color: '#4A6FFF' };
    case 'reply':
      return { name: 'reply', color: '#FF9500' };
    case 'eyewitness':
      return { name: 'visibility', color: '#34C759' };
    case 'remove_eyewitness':
      return { name: 'visibility-off', color: '#666' };
    case 'comment_like':
      return { name: 'favorite', color: '#FF3B30' };
    case 'reply_like':
      return { name: 'favorite', color: '#FF3B30' };
    case 'post_pending':
      return { name: 'schedule', color: '#FF9500' };
    case 'post_approved':
      return { name: 'check-circle', color: '#34C759' };
    case 'post_rejected':
      return { name: 'cancel', color: '#FF3B30' };
    case 'tag_match':
      return { name: 'local-offer', color: '#34C759' };
    default:
      return { name: 'notifications', color: '#666' };
  }
};

const getNotificationText = (notification) => {
  const userName = notification.triggeringUserName || 'Anonymous User';
  switch (notification.type) {
    case 'like':
      return `${userName} liked your post`;
    case 'unlike':
      return `${userName} unliked your post`;
    case 'comment':
      return `${userName} commented on your post`;
    case 'reply':
      return `${userName} replied to your comment`;
    case 'eyewitness':
      return `${userName} marked themselves as an eyewitness on your post`;
    case 'remove_eyewitness':
      return `${userName} removed eyewitness status`;
    case 'comment_like':
      return `${userName} liked your comment`;
    case 'reply_like':
      return `${userName} liked your reply`;
    case 'post_pending':
      return `New post created. awaiting verification.`;
    case 'post_approved':
      return notification.message || 'Your post has been approved and is now visible to others.';
    case 'post_rejected':
      return notification.message || 'Your post was rejected due to content violations.';
    case 'tag_match':
      return `${userName} created a post with your subscribed tags (${notification.matchedTags?.join(', ')}) within ${notification.distance}km`;
    default:
      return `${userName} interacted with your post`;
  }
};

const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else if (days < 7) {
    return `${days}d ago`;
  } else {
    return date.toLocaleDateString();
  }
};

function getStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      color: colors.text,
      fontSize: 24,
      fontWeight: 'bold',
    },
    deleteAllButton: {
      backgroundColor: colors.error,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    deleteAllText: {
      color: colors.onError,
      fontSize: 14,
      fontWeight: 'bold',
    },
    loadingText: {
      color: colors.text,
      fontSize: 16,
      marginTop: 12,
    },
    errorText: {
      color: colors.error,
      fontSize: 16,
      textAlign: 'center',
    },
    errorSubtext: {
      color: colors.textSecondary,
      fontSize: 14,
      textAlign: 'center',
      marginTop: 8,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: 16,
      marginTop: 12,
    },
    notificationsList: {
      flex: 1,
    },
    notificationsContent: {
      padding: 16,
    },
    notificationItem: {
      backgroundColor: colors.card,
      borderRadius: 12,
      marginBottom: 12,
      padding: 16,
      shadowColor: colors.shadow,
      shadowOpacity: 0.1,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },
    unreadNotification: {
      backgroundColor: colors.input,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    notificationContent: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    notificationHeader: {
      position: 'relative',
      marginRight: 12,
    },
    notificationAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    notificationIcon: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      backgroundColor: colors.background,
      borderRadius: 10,
      width: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    notificationText: {
      flex: 1,
    },
    notificationMessage: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 4,
    },
    notificationTime: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    deleteButton: {
      padding: 8,
      marginLeft: 8,
    },
  });
}

export default function Notifications() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    console.log('Starting notifications setup for user:', auth.currentUser.uid);
    setError(null);

    const setupNotifications = async () => {
      try {
        // First, check if the user document exists
        const userDocRef = doc(firestore, 'users', auth.currentUser.uid);
        const userDoc = await getDoc(userDocRef);

        console.log('User document check:', {
          exists: userDoc.exists(),
          userId: auth.currentUser.uid
        });

        if (!userDoc.exists()) {
          console.log('Creating user document for:', auth.currentUser.uid);
          await setDoc(userDocRef, {
            email: auth.currentUser.email,
            displayName: auth.currentUser.displayName || 'Anonymous User',
            photoURL: auth.currentUser.photoURL || '',
            createdAt: Timestamp.now(),
            notificationCount: 0
          });
        }

        // Set up the notifications listener
        const notificationsRef = collection(userDocRef, 'notifications');
        const notificationsQuery = query(
          notificationsRef,
          orderBy('timestamp', 'desc')
        );

        console.log('Setting up notifications listener for path:', `users/${auth.currentUser.uid}/notifications`);

        const unsubscribe = onSnapshot(
          notificationsQuery,
          async (snapshot) => {
            try {
              console.log('Received notifications snapshot:', {
                count: snapshot.docs.length,
                docs: snapshot.docs.map(doc => ({
                  id: doc.id,
                  type: doc.data().type,
                  timestamp: doc.data().timestamp?.toDate()
                }))
              });
              
              const notificationsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              }));

              // Calculate unread count
              const unreadCount = notificationsData.filter(n => !n.read).length;
              
              // Update user document with current unread count
              await updateDoc(userDocRef, {
                notificationCount: unreadCount
              });

              console.log('Processed notifications:', notificationsData);
              setNotifications(notificationsData);
              setLoading(false);
              setError(null);
              
            } catch (err) {
              console.error('Error processing notifications:', err);
              console.error('Full error details:', {
                error: err.message,
                code: err.code,
                stack: err.stack
              });
              setError('Error processing notifications. Please try again.');
              setLoading(false);
            }
          },
          (err) => {
            console.error('Error in notifications listener:', err);
            console.error('Full listener error details:', {
              error: err.message,
              code: err.code,
              stack: err.stack
            });
            setError('Error loading notifications. Please try again.');
            setLoading(false);
          }
        );

        return unsubscribe;
      } catch (err) {
        console.error('Error setting up notifications:', err);
        console.error('Full setup error details:', {
          error: err.message,
          code: err.code,
          stack: err.stack
        });
        setError('Error setting up notifications. Please try again.');
        setLoading(false);
        return () => {};
      }
    };

    let unsubscribe;
    setupNotifications().then(unsub => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) {
        console.log('Cleaning up notifications listener');
        unsubscribe();
      }
    };
  }, []);

  const handleNotificationPress = async (notification) => {
    try {
      if (notification.postId) {
        const userDocRef = doc(firestore, 'users', auth.currentUser.uid);
        const notificationRef = doc(
          firestore,
          'users',
          auth.currentUser.uid,
          'notifications',
          notification.id
        );

        // Mark as read first if not already read
        if (!notification.read) {
          await updateDoc(notificationRef, { read: true });
        }

        // Delete the notification
        await deleteDoc(notificationRef);
        console.log('Automatically deleted notification:', notification.id);
        
        // Then navigate to the post
        router.push(`/posts/${notification.postId}`);
      }
    } catch (error) {
      console.error('Error handling notification click:', error);
    }
  };

  const handleDeleteNotification = async (notificationId, event) => {
    event.stopPropagation();
    try {
      const notificationRef = doc(
        firestore,
        'users',
        auth.currentUser.uid,
        'notifications',
        notificationId
      );

      await deleteDoc(notificationRef);
      console.log('Deleted notification:', notificationId);
    } catch (err) {
      console.error('Error deleting notification:', err);
      Alert.alert('Error', 'Failed to delete notification');
    }
  };

  const handleDeleteAllNotifications = async () => {
    Alert.alert(
      'Delete All Notifications',
      'Are you sure you want to delete all notifications? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              const batch = writeBatch(firestore);
              
              // Add all notifications to the batch
              notifications.forEach(notification => {
                const notificationRef = doc(
                  firestore,
                  'users',
                  auth.currentUser.uid,
                  'notifications',
                  notification.id
                );
                batch.delete(notificationRef);
              });

              // Commit the batch
              await batch.commit();
              console.log('Deleted all notifications');
            } catch (err) {
              console.error('Error deleting all notifications:', err);
              Alert.alert('Error', 'Failed to delete all notifications. Please try again.');
            }
          }
        }
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // The onSnapshot listener will automatically refresh the data
    setTimeout(() => setRefreshing(false), 1000);
  };

  const renderNotification = ({ item: notification }) => {
    const icon = getNotificationIcon(notification.type);
    
    return (
      <TouchableOpacity
        style={[styles.notificationItem, !notification.read && styles.unreadNotification]}
        onPress={() => handleNotificationPress(notification)}
      >
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Image 
              source={notification.triggeringUserAvatar ? { uri: notification.triggeringUserAvatar } : { uri: anonymousAvatar }} 
              style={styles.notificationAvatar} 
            />
            <View style={styles.notificationIcon}>
              <MaterialIcons name={icon.name} size={20} color={icon.color} />
            </View>
          </View>
          
          <View style={styles.notificationText}>
            <Text style={styles.notificationMessage}>
              {getNotificationText(notification)}
            </Text>
            <Text style={styles.notificationTime}>
              {formatTimestamp(notification.timestamp)}
            </Text>
          </View>
          
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={(e) => handleDeleteNotification(notification.id, e)}
          >
            <MaterialIcons name="delete-outline" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (!auth.currentUser) {
    return (
      <View style={styles.container}>
        <HeaderBar />
        <View style={styles.centered}>
          <Text style={styles.errorText}>Please sign in to view notifications</Text>
        </View>
        <FooterNav />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <HeaderBar />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
        <FooterNav />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderBar />
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        {notifications.length > 0 && (
          <TouchableOpacity
            style={styles.deleteAllButton}
            onPress={handleDeleteAllNotifications}
          >
            <Text style={[styles.deleteAllText, { color: '#fff' }]}>Delete All</Text>
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorSubtext}>Please try refreshing the page.</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centered}>
          <MaterialIcons name="notifications-none" size={64} color={colors.textSecondary} />
          <Text style={styles.emptyText}>No notifications yet</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          style={styles.notificationsList}
          contentContainerStyle={styles.notificationsContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        />
      )}
      <FooterNav />
    </View>
  );
} 