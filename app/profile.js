import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, TouchableOpacity, FlatList, Dimensions, ScrollView, Modal, TextInput, Animated, Easing } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { firestore, auth } from '../firebaseConfig';
import { collection, query, where, orderBy, getDocs, doc, getDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { getStorage, ref, deleteObject, uploadBytes, getDownloadURL } from 'firebase/storage';
import { router } from 'expo-router';
import FooterNav from '../components/FooterNav';
import HeaderBar from '../components/HeaderBar';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
const aiStar = require('../assets/images/aistar.png');

const SCREEN_WIDTH = Dimensions.get('window').width;
const placeholderImage = require('../assets/images/placeholder.png');

export default function Profile() {
  const { colors } = useTheme();
  const [userProfile, setUserProfile] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(0); // 0: Active, 1: Expired
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPhoto, setEditPhoto] = useState(null); // local uri
  const [saving, setSaving] = useState(false);
  const [clockAnim] = useState(new Animated.Value(0));

  // Helper function to delete post and all its associated data
  const deletePostCompletely = async (post) => {
    try {
      const batch = writeBatch(firestore);

      // Delete image from storage if it exists
      if (post.imageUrl) {
        try {
          const imageUrl = new URL(post.imageUrl);
          const imagePath = decodeURIComponent(imageUrl.pathname.split('/o/')[1]);
          if (imagePath) {
            const imageRef = ref(storage, imagePath);
            await deleteObject(imageRef);
          }
        } catch (error) {
          console.error('Error deleting post image:', error);
        }
      }

      // Delete all comments
      const commentsSnapshot = await getDocs(
        collection(firestore, 'posts', post.id, 'comments')
      );
      commentsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Delete all likes
      const likesSnapshot = await getDocs(
        collection(firestore, 'posts', post.id, 'likes')
      );
      likesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Delete the post document itself
      batch.delete(doc(firestore, 'posts', post.id));

      // Execute all deletions
      await batch.commit();
      console.log('Post completely deleted:', post.id);
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const user = auth.currentUser;
        if (!user) throw new Error('Not signed in');
        // Fetch profile
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        const profileData = userDocSnap.exists() ? userDocSnap.data() : null;
        setUserProfile(profileData);
        setEditNickname(profileData?.nickname || '');
        setEditBio(profileData?.bio || '');
        setEditPhoto(null); // reset photo picker

        // Fetch posts
        const postsCollectionRef = collection(firestore, 'posts');
        const userPostsQuery = query(postsCollectionRef, where('creatorId', '==', user.uid), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(userPostsQuery);
        
        const posts = [];
        const now = new Date();

        // Process each post
        for (const doc of querySnapshot.docs) {
          const post = { id: doc.id, ...doc.data() };
          const createdAt = post.createdAt?.toDate();
          const totalLifespan = 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds
          
          // Check if post has exceeded its total lifespan (2X hours)
          if (createdAt && (now - createdAt) >= totalLifespan) {
            // Delete the post if it's past its total lifespan
            await deletePostCompletely(post);
          } else {
            // Keep the post if it's still within its lifespan
            posts.push(post);
          }
        }

        setUserPosts(posts);
      } catch (err) {
        setError('Failed to load profile.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.timing(clockAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [clockAnim]);

  // Helper to format time left for active posts
  function formatTimeLeft(expiresAt) {
    if (!expiresAt) return '';
    const now = new Date();
    const expirationDate = expiresAt instanceof Timestamp ? expiresAt.toDate() : new Date(expiresAt);
    const diffMs = expirationDate - now;
    if (diffMs <= 0) return 'Expired';
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) return `${diffMin} min left`;
    const diffHr = Math.ceil(diffMin / 60);
    return `${diffHr} hr${diffHr > 1 ? 's' : ''} left`;
  }

  const isPostActive = (post) => {
    const now = Timestamp.now().toMillis();
    const expirationTime = post.expiresAt?.toMillis();
    return expirationTime && expirationTime > now;
  };

  const shouldDisplayExpiredPost = (post) => {
    const now = Timestamp.now().toMillis();
    const createdAt = post.createdAt?.toMillis();
    const expiresAt = post.expiresAt?.toMillis();
    const durationMillis = post.duration * 60 * 60 * 1000;
    if (!createdAt || !expiresAt || !post.duration) return false;
    const expiredDisplayEndTime = expiresAt + durationMillis;
    const isExpired = now > expiresAt;
    return isExpired && now < expiredDisplayEndTime;
  };

  // Calculate active and expired post counts
  const now = Timestamp.now().toMillis();
  const activePosts = userPosts.filter(post => isPostActive(post)).length;
  const expiredPosts = userPosts.filter(post => shouldDisplayExpiredPost(post)).length;

  // Only show stats for posts that are currently visible (active or expired)
  const visiblePosts = userPosts.filter(post => isPostActive(post) || shouldDisplayExpiredPost(post));

  const filteredPosts = userPosts.filter(post =>
    tab === 0 ? isPostActive(post) : shouldDisplayExpiredPost(post)
  );

  // Stats for visible posts only
  const numPosts = visiblePosts.length;
  const numLikes = visiblePosts.reduce((sum, p) => sum + (p.likes || 0), 0);
  const numWitnesses = visiblePosts.reduce((sum, p) => sum + (p.eyewitnesses || 0), 0);

  if (loading) {
    return <View style={[styles.centered, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }
  if (error) {
    return <View style={[styles.centered, { backgroundColor: colors.background }]}><Text style={[styles.error, { color: colors.error }]}>{error}</Text></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <HeaderBar />
      <FlatList
        data={filteredPosts}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.card, { backgroundColor: colors.card }]} onPress={() => router.push(`/posts/${item.id}`)}>
            <Image
              source={item.imageUrl ? { uri: item.imageUrl } : placeholderImage}
              style={styles.cardImage}
              resizeMode="cover"
            />
            <View style={styles.cardContent}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
              {/* Animated blue clock and time left for active posts */}
              {isPostActive(item) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Animated.View style={{ transform: [{ rotate: clockAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
                    <Icon name="clock-outline" size={18} color="#4A6FFF" />
                  </Animated.View>
                  <Text style={{ color: '#4A6FFF', marginLeft: 6, fontWeight: 'bold', fontSize: 14 }}>{formatTimeLeft(item.expiresAt)}</Text>
                </View>
              )}
              <View style={styles.cardTagsRow}>
                {item.tags?.map(tag => (
                  <View key={tag} style={[styles.cardTag, { backgroundColor: colors.input }]}>
                    <Text style={[styles.cardTagText, { color: colors.primary }]}>{tag}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.cardStatsRow}>
                <Text style={[styles.statText, { color: colors.textTertiary }]}>❤️ {item.likes || 0}</Text>
                <Text style={[styles.statText, { color: colors.textTertiary }]}>💬 {item.commentCount || 0}</Text>
                <Text style={[styles.statText, { color: colors.textTertiary }]}>👁️ {item.eyewitnesses || 0}</Text>
              </View>
              <Text style={[styles.statusText, { color: colors.textTertiary }]}>{isPostActive(item) ? 'Active' : 'Expired'}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListHeaderComponent={
          <View style={{ backgroundColor: colors.background }}>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 }}>
              <TouchableOpacity style={[styles.editProfileBtn, { backgroundColor: colors.card }]} onPress={() => setEditModalVisible(true)}>
                <Text style={[styles.editProfileText, { color: colors.primary }]}>Edit Profile</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.profileHeader}>
              <Image
                source={userProfile?.photoURL ? { uri: userProfile.photoURL } : placeholderImage}
                style={styles.avatar}
              />
              <Text style={[styles.displayName, { color: colors.text }]}>{userProfile?.displayName || 'User'}</Text>
              {userProfile?.nickname && <Text style={[styles.nickname, { color: colors.textTertiary }]}>@{userProfile.nickname}</Text>}
              {auth.currentUser?.email && <Text style={[styles.email, { color: colors.textTertiary }]}>{auth.currentUser.email}</Text>}
              <Text style={[styles.bio, { color: colors.textSecondary }]}>{userProfile?.bio || 'No bio yet'}</Text>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statBox}><Text style={[styles.statValue, { color: colors.text }]}>{numPosts}</Text><Text style={[styles.statLabel, { color: colors.textTertiary }]}>Posts</Text></View>
              <View style={styles.statBox}><Text style={[styles.statValue, { color: colors.text }]}>{numLikes}</Text><Text style={[styles.statLabel, { color: colors.textTertiary }]}>Likes</Text></View>
              <View style={styles.statBox}><Text style={[styles.statValue, { color: colors.text }]}>{numWitnesses}</Text><Text style={[styles.statLabel, { color: colors.textTertiary }]}>Witnesses</Text></View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statBox}><Text style={[styles.statValue, { color: colors.text }]}>{activePosts}</Text><Text style={[styles.statLabel, { color: colors.textTertiary }]}>Active Posts</Text></View>
              <View style={styles.statBox}><Text style={[styles.statValue, { color: colors.text }]}>{expiredPosts}</Text><Text style={[styles.statLabel, { color: colors.textTertiary }]}>Expired Posts</Text></View>
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Posts</Text>
            <View style={styles.tabRow}>
              <TouchableOpacity style={[styles.tab, { backgroundColor: tab === 0 ? colors.primary : colors.card }]} onPress={() => setTab(0)}>
                <Text style={[styles.tabText, { color: tab === 0 ? '#fff' : colors.textTertiary, fontWeight: tab === 0 ? 'bold' : 'normal' }]}>Active Posts</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tab, { backgroundColor: tab === 1 ? colors.primary : colors.card }]} onPress={() => setTab(1)}>
                <Text style={[styles.tabText, { color: tab === 1 ? '#fff' : colors.textTertiary, fontWeight: tab === 1 ? 'bold' : 'normal' }]}>Expired Posts</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textTertiary }]}>No posts found in this category.</Text>}
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
      />
     
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.background + 'CC' }]}> 
          <View style={[styles.modalBox, { backgroundColor: colors.card }]}> 
            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Profile</Text>
            <TouchableOpacity
              style={styles.avatarEditWrap}
              onPress={async () => {
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  allowsEditing: true,
                  aspect: [1, 1],
                  quality: 0.7,
                });
                if (!result.canceled && result.assets && result.assets.length > 0) {
                  setEditPhoto(result.assets[0].uri);
                }
              }}
            >
              <Image
                source={editPhoto ? { uri: editPhoto } : userProfile?.photoURL ? { uri: userProfile.photoURL } : placeholderImage}
                style={styles.avatarEdit}
              />
              <Text style={[styles.changePhotoText, { color: colors.primary }]}>Change Photo</Text>
            </TouchableOpacity>
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
              placeholder="Nickname"
              value={editNickname}
              onChangeText={setEditNickname}
              placeholderTextColor={colors.placeholder}
            />
            <TextInput
              style={[styles.input, { height: 80, backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
              placeholder="Bio"
              value={editBio}
              onChangeText={setEditBio}
              placeholderTextColor={colors.placeholder}
              multiline
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.input }]} onPress={() => setEditModalVisible(false)} disabled={saving}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.saveBtn, { backgroundColor: colors.primary }]}
                onPress={async () => {
                  setSaving(true);
                  try {
                    const user = auth.currentUser;
                    if (!user) throw new Error('Not signed in');
                    let photoURL = userProfile?.photoURL;
                    if (editPhoto) {
                      // Upload to Firebase Storage
                      const storage = getStorage();
                      const ext = editPhoto.split('.').pop();
                      const fileName = `avatar.${ext}`;
                      const storageRef = ref(storage, `users/${user.uid}/profile/${fileName}`);
                      const img = await fetch(editPhoto);
                      const bytes = await img.blob();
                      await uploadBytes(storageRef, bytes);
                      photoURL = await getDownloadURL(storageRef);
                    }
                    const userDocRef = doc(firestore, 'users', user.uid);
                    await updateDoc(userDocRef, {
                      nickname: editNickname,
                      bio: editBio,
                      photoURL,
                    });
                    setUserProfile(prev => ({ ...prev, nickname: editNickname, bio: editBio, photoURL }));
                    setEditModalVisible(false);
                  } catch (e) {
                    alert('Failed to update profile.');
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
              >
                <Text style={[styles.modalBtnText, styles.saveBtnText, { color: '#fff' }]}>{saving ? 'Saving...' : 'Save Changes'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <FooterNav />
     
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/aichat')}
        activeOpacity={0.8}
      >
        <Image source={aiStar} style={{ width: 50, height: 50, resizeMode: 'contain', tintColor: 'white' }} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' },
  error: { color: '#e74c3c', fontSize: 16 },
  profileHeader: { alignItems: 'center', marginBottom: 18 },
  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 8 },
  displayName: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  nickname: { color: '#aaa', fontSize: 15, marginBottom: 4 },
  bio: { color: '#ccc', fontSize: 14, marginBottom: 8, textAlign: 'center' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  statBox: { alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  statLabel: { color: '#aaa', fontSize: 13 },
  tabRow: { flexDirection: 'row', marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 12, backgroundColor: '#232323', borderRadius: 8, marginRight: 8, alignItems: 'center' },
  tabActive: { backgroundColor: '#4A6FFF' },
  tabText: { color: '#ccc', fontSize: 16 },
  tabTextActive: { color: '#fff', fontWeight: 'bold' },
  card: { backgroundColor: '#181818', borderRadius: 16, marginBottom: 18, overflow: 'hidden', flexDirection: 'row', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  cardImage: { width: 100, height: 100, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  cardContent: { flex: 1, padding: 10, justifyContent: 'center' },
  cardTitle: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginBottom: 2 },
  cardTagsRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  cardTag: { backgroundColor: '#232323', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginRight: 6, marginBottom: 4 },
  cardTagText: { color: '#4A6FFF', fontSize: 12 },
  cardStatsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  statText: { color: '#ccc', fontSize: 13, marginRight: 16 },
  statusText: { color: '#aaa', fontSize: 13, marginTop: 4 },
  emptyText: { color: '#aaa', textAlign: 'center', marginTop: 40, fontSize: 16 },
  editProfileBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#232323' },
  editProfileText: { color: '#4A6FFF', fontWeight: 'bold', fontSize: 15 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 8, marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#232323', borderRadius: 16, padding: 24, width: '90%', maxWidth: 340 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  input: { backgroundColor: '#181818', color: '#fff', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16, borderWidth: 1, borderColor: '#333' },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  modalBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8, backgroundColor: '#232323', marginLeft: 8 },
  saveBtn: { backgroundColor: '#4A6FFF' },
  modalBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  saveBtnText: { color: '#fff' },
  email: { color: '#aaa', fontSize: 15, marginBottom: 4 },
  avatarEditWrap: { alignItems: 'center', marginBottom: 16 },
  avatarEdit: { width: 90, height: 90, borderRadius: 45, marginBottom: 4, borderWidth: 2, borderColor: '#4A6FFF' },
  changePhotoText: { color: '#4A6FFF', fontSize: 14, marginBottom: 8 },
  fab: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    backgroundColor: '#4A6FFF',
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 100,
  },
}); 