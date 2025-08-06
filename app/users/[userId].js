import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, TouchableOpacity, FlatList, Dimensions, ScrollView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { firestore, auth } from '../../firebaseConfig';
import { collection, query, where, orderBy, getDocs, doc, getDoc, Timestamp } from 'firebase/firestore';
import FooterNav from '../../components/FooterNav';
import HeaderBar from '../../components/HeaderBar';
import { useTheme } from '../../contexts/ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const placeholderImage = require('../../assets/images/placeholder.png');
const anonymousAvatar = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';

export default function UserProfile() {
  const { colors } = useTheme();
  const { userId } = useLocalSearchParams();
  const [userProfile, setUserProfile] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(0); // 0: Active, 1: Expired
  const [userStats, setUserStats] = useState({ 
    posts: 0, 
    likes: 0, 
    eyewitnesses: 0,
    activePosts: 0,
    expiredPosts: 0 
  });

  // Function to check if a post is expired and should be deleted
  const shouldDeletePost = (post) => {
    const now = Timestamp.now().toMillis();
    const expiresAt = post.expiresAt?.toMillis();
    const durationMillis = post.duration * 60 * 60 * 1000; // Convert duration hours to milliseconds
    const deleteTime = expiresAt + durationMillis; // Time when post should be deleted
    return now > deleteTime;
  };

  // Fetch user's profile data
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      try {
        const userDocRef = doc(firestore, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          setUserProfile(data);
        } else {
          setError('User not found');
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
        setError('Failed to fetch profile data.');
      }
    };

    fetchUserProfile();
  }, [userId]);

  // Fetch user's posts and calculate stats
  useEffect(() => {
    const fetchUserPosts = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      try {
        const postsCollectionRef = collection(firestore, 'posts');
        const userPostsQuery = query(
          postsCollectionRef,
          where('creatorId', '==', userId),
          orderBy('createdAt', 'desc')
        );

        const querySnapshot = await getDocs(userPostsQuery);
        const postsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Process posts
        const now = Timestamp.now().toMillis();
        const processedPosts = [];

        for (const post of postsData) {
          if (!shouldDeletePost(post)) {
            processedPosts.push(post);
          }
        }

        setUserPosts(processedPosts);

        // Calculate stats
        const activePosts = processedPosts.filter(post => 
          post.expiresAt?.toMillis() > now
        ).length;
        const expiredPosts = processedPosts.length - activePosts;
        const totalLikes = processedPosts.reduce((sum, post) => sum + (post.likes || 0), 0);
        const totalEyewitnesses = processedPosts.reduce((sum, post) => sum + (post.eyewitnesses || 0), 0);

        setUserStats({
          posts: processedPosts.length,
          likes: totalLikes,
          eyewitnesses: totalEyewitnesses,
          activePosts,
          expiredPosts
        });

        setLoading(false);
      } catch (err) {
        console.error('Error fetching user posts:', err);
        setError('Failed to fetch posts.');
        setLoading(false);
      }
    };

    fetchUserPosts();
  }, [userId]);

  const isPostActive = (post) => {
    const now = Timestamp.now().toMillis();
    const expirationTime = post.expiresAt?.toMillis();
    return expirationTime && expirationTime > now;
  };

  // Function to check if an expired post should still be displayed
  const shouldDisplayExpiredPost = (post) => {
    const now = Timestamp.now().toMillis();
    const createdAt = post.createdAt?.toMillis();
    const expiresAt = post.expiresAt?.toMillis();
    const durationMillis = post.duration * 60 * 60 * 1000; // Convert duration hours to milliseconds

    if (!createdAt || !expiresAt || !post.duration) return false;

    const expiredDisplayEndTime = expiresAt + durationMillis;
    const isExpired = now > expiresAt;

    return isExpired && now < expiredDisplayEndTime;
  };

  // Filter posts: hide anonymous posts from other users
  const isOwnProfile = auth.currentUser && auth.currentUser.uid === userId;
  const visiblePosts = isOwnProfile ? userPosts : userPosts.filter(post => !post.isAnonymous);
  const filteredPosts = visiblePosts.filter(post =>
    tab === 0 ? isPostActive(post) : shouldDisplayExpiredPost(post)
  );

  // Calculate stats based on visiblePosts
  useEffect(() => {
    const now = Timestamp.now().toMillis();
    // Replace processedPosts with visiblePosts for stats
    const activePosts = visiblePosts.filter(post => 
      post.expiresAt?.toMillis() > now
    ).length;
    const expiredPosts = visiblePosts.length - activePosts;
    const totalLikes = visiblePosts.reduce((sum, post) => sum + (post.likes || 0), 0);
    const totalEyewitnesses = visiblePosts.reduce((sum, post) => sum + (post.eyewitnesses || 0), 0);

    setUserStats({
      posts: visiblePosts.length,
      likes: totalLikes,
      eyewitnesses: totalEyewitnesses,
      activePosts,
      expiredPosts
    });
  }, [userId, userPosts, tab]);

  const handleCardClick = (postId) => {
    router.push(`/posts/${postId}`);
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}> 
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading profile...</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}> 
        <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
      </View>
    );
  }

  // Move all header content into a header component for FlatList
  const renderHeader = () => (
    <>
      <View style={styles.profileHeader}>
        <Image
          source={userProfile?.photoURL ? { uri: userProfile.photoURL } : placeholderImage}
          style={styles.avatar}
        />
        <Text style={[styles.displayName, { color: colors.text }]}>{userProfile?.displayName || 'User'}</Text>
        {userProfile?.nickname && <Text style={[styles.nickname, { color: colors.textTertiary }]}>@{userProfile.nickname}</Text>}
        <Text style={[styles.bio, { color: colors.textSecondary }]}>{userProfile?.bio || 'No bio yet'}</Text>
      </View>
      {/* Stats Section */}
      <View style={styles.statsContainer}>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: colors.text }]}>{userStats.posts}</Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Posts</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: colors.text }]}>{userStats.likes}</Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Likes</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: colors.text }]}>{userStats.eyewitnesses}</Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Witnesses</Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: colors.text }]}>{userStats.activePosts}</Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Active Posts</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: colors.text }]}>{userStats.expiredPosts}</Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Expired Posts</Text>
          </View>
        </View>
      </View>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Posts</Text>
      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, { backgroundColor: tab === 0 ? colors.primary : colors.card }]} onPress={() => setTab(0)}>
          <Text style={[styles.tabText, { color: tab === 0 ? '#fff' : colors.textTertiary, fontWeight: tab === 0 ? 'bold' : 'normal' }]}>Active Posts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, { backgroundColor: tab === 1 ? colors.primary : colors.card }]} onPress={() => setTab(1)}>
          <Text style={[styles.tabText, { color: tab === 1 ? '#fff' : colors.textTertiary, fontWeight: tab === 1 ? 'bold' : 'normal' }]}>Expired Posts</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  // Replace ScrollView with FlatList as the main container
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <HeaderBar />
      <FlatList
        data={filteredPosts}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.card, { backgroundColor: colors.card }]} onPress={() => handleCardClick(item.id)}>
            <Image
              source={item.imageUrl ? { uri: item.imageUrl } : placeholderImage}
              style={styles.cardImage}
              resizeMode="cover"
            />
            <View style={styles.cardContent}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
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
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textTertiary }]}>No posts found in this category.</Text>}
        contentContainerStyle={{ padding: 16, paddingBottom: 64 }}
      />
      <FooterNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' },
  error: { color: '#e74c3c', fontSize: 16 },
  loadingText: { color: '#fff', fontSize: 16, marginTop: 10 },
  profileHeader: { alignItems: 'center', marginBottom: 18 },
  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 8 },
  displayName: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  nickname: { color: '#aaa', fontSize: 15, marginBottom: 4 },
  bio: { color: '#ccc', fontSize: 14, marginBottom: 8, textAlign: 'center' },
  statsContainer: { marginBottom: 18 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  statBox: { alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  statLabel: { color: '#aaa', fontSize: 13 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
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
}); 