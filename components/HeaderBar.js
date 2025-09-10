import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { auth, firestore } from '../firebaseConfig';
import { collection, query, onSnapshot, doc } from 'firebase/firestore';
import { useTheme } from '../contexts/ThemeContext';

const logo = require('../assets/images/logo.png');

export default function HeaderBar() {
  const router = useRouter();
  const { colors } = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    if (!auth.currentUser) return;

    const chatsCollectionRef = collection(firestore, 'users', auth.currentUser.uid, 'chats');
    const chatsQuery = query(chatsCollectionRef);

    const unsubscribeChats = onSnapshot(
      chatsQuery,
      (snapshot) => {
        let count = 0;
        snapshot.docs.forEach((doc) => {
          const chatData = doc.data();
          if (chatData.unreadCount && chatData.unreadCount > 0) {
            count++;
          }
        });
        setUnreadChatCount(count);
      },
      (err) => {
        console.error('Error fetching unread chat count:', err);
      }
    );

    // Listen to user document for notification count
    const userDocRef = doc(firestore, 'users', auth.currentUser.uid);
    const unsubscribeNotifications = onSnapshot(userDocRef, (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        setNotificationCount(userData.notificationCount || 0);
      } else {
        setNotificationCount(0);
      }
    }, (error) => {
      console.error('Error listening to notification count:', error);
      setNotificationCount(0);
    });

    return () => {
      unsubscribeChats();
      unsubscribeNotifications();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.replace('/signin');
    } catch (e) {
      Alert.alert('Logout Failed', e.message || 'Please try again.');
    }
  };

  const handleMenuPress = (action) => {
    setMenuVisible(false);
    switch (action) {
      case 'notifications':
        router.push('/notifications');
        break;
      case 'settings':
        router.push('/settings');
        break;
      case 'logout':
        setLogoutModalVisible(true);
        break;
    }
  };

  const confirmLogout = () => {
    setLogoutModalVisible(false);
    handleLogout();
  };

  return (
    <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      {/* Left: Logo + App Name */}
      <View style={styles.leftRow}>
        <Image source={logo} style={styles.logo} />
        <Text style={[styles.title, { color: colors.text }]}>Ocean Pulse</Text>
      </View>
      {/* Right: 2 icons */}
      <View style={styles.rightRow}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/chats')}>
          <View style={styles.chatIconContainer}>
            <MaterialIcons name="chat" size={26} color={colors.text} />
            {unreadChatCount > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: colors.error }]}>
                <Text style={styles.unreadBadgeText}>
                  {unreadChatCount > 99 ? '99+' : unreadChatCount}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setMenuVisible(true)}>
          <View style={styles.menuIconContainer}>
            <MaterialIcons name="menu" size={26} color={colors.text} />
            {notificationCount > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: colors.error }]}>
                <Text style={styles.unreadBadgeText}>
                  {notificationCount > 99 ? '99+' : notificationCount}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Hamburger Menu Dropdown */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setMenuVisible(false)}
        >
          <View style={[styles.menuContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => handleMenuPress('notifications')}
            >
              <View style={styles.menuItemContent}>
                <MaterialIcons name="notifications" size={20} color={colors.text} />
                <Text style={[styles.menuText, { color: colors.text }]}>Notifications</Text>
                {notificationCount > 0 && (
                  <View style={[styles.menuBadge, { backgroundColor: colors.error }]}>
                    <Text style={styles.menuBadgeText}>
                      {notificationCount > 99 ? '99+' : notificationCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => handleMenuPress('settings')}
            >
              <MaterialIcons name="settings" size={20} color={colors.text} />
              <Text style={[styles.menuText, { color: colors.text }]}>Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => handleMenuPress('logout')}
            >
              <MaterialIcons name="logout" size={20} color={colors.text} />
              <Text style={[styles.menuText, { color: colors.text }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={logoutModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setLogoutModalVisible(false)}
        >
          <View style={[styles.logoutModalContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.logoutModalHeader}>
              <MaterialIcons name="logout" size={24} color={colors.error} />
              <Text style={[styles.logoutModalTitle, { color: colors.text }]}>Confirm Logout</Text>
            </View>
            <Text style={[styles.logoutModalText, { color: colors.textSecondary }]}>
              Are you sure you want to log out? You'll need to sign in again to access your account.
            </Text>
            <View style={styles.logoutModalActions}>
              <TouchableOpacity 
                style={[styles.logoutModalButton, styles.cancelButton, { backgroundColor: colors.border }]} 
                onPress={() => setLogoutModalVisible(false)}
              >
                <Text style={[styles.logoutModalButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.logoutModalButton, styles.logoutButton, { backgroundColor: colors.error }]} 
                onPress={confirmLogout}
              >
                <Text style={[styles.logoutModalButtonText, { color: '#fff' }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#181818',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#232323',
    minHeight: 60,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#fff',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    marginLeft: 16,
    padding: 4,
  },
  chatIconContainer: {
    position: 'relative',
  },
  menuIconContainer: {
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  menuContainer: {
    backgroundColor: '#232323',
    borderRadius: 8,
    marginTop: 80,
    marginRight: 16,
    paddingVertical: 8,
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
  },
  menuBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginLeft: 8,
  },
  menuBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  logoutModalContainer: {
    borderRadius: 12,
    marginTop: 200,
    marginRight: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  logoutModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoutModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  logoutModalText: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  logoutModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  logoutModalButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  confirmButton: {
    backgroundColor: '#FF3B30',
  },
  logoutModalButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 