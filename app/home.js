import React, { useState, useEffect, useCallback } from 'react';
import { ProtectedRoute } from '../ProtectedRoute';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Alert, Image, ScrollView, Dimensions } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth, firestore } from '../firebaseConfig';
import { collection, query, where, orderBy, getDocs, Timestamp, getDoc, doc } from 'firebase/firestore';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Location from 'expo-location';
import { Picker } from '@react-native-picker/picker';
import FooterNav from '../components/FooterNav';
import HeaderBar from '../components/HeaderBar';
import { useTheme } from '../contexts/ThemeContext';
import OnboardingStepper from '../components/OnboardingStepper';
const aiStar = require('../assets/images/aistar.png');


const SCREEN_WIDTH = Dimensions.get('window').width;
const placeholderImage = require('../assets/images/placeholder.png');
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

function normalizeTag(tag) {
  const t = tag.toLowerCase();
  if (t.length > 3 && t.endsWith('s')) return t.slice(0, -1);
  return t;
}

// Add a helper to format how long ago a post was created
function formatTimeAgo(createdAt) {
  if (!createdAt) return '';
  const now = new Date();
  const created = createdAt instanceof Timestamp ? createdAt.toDate() : new Date(createdAt);
  const diffMs = now - created;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec} seconds ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minutes ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr} hours ago`;
}

function Home() {
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [radius, setRadius] = useState('10');
  const [userPreferredRadius, setUserPreferredRadius] = useState('10');
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Fetch user's preferred radius from settings
  useEffect(() => {
    const fetchUserSettings = async () => {
      if (!auth.currentUser) return;
      try {
        const userDocRef = doc(firestore, 'users', auth.currentUser.uid);
        const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.settings?.radius) {
            setUserPreferredRadius(userData.settings.radius);
            setRadius(userData.settings.radius);
          }
        }
    } catch (err) {
        console.error('Error fetching user settings:', err);
    }
  };

    fetchUserSettings();
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Fetch posts
        const postsQuery = query(
          collection(firestore, 'posts'),
          where('expiresAt', '>', Timestamp.now()),
          orderBy('expiresAt', 'desc')
        );
        const querySnapshot = await getDocs(postsQuery);
        const postsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPosts(postsData);
        // Fetch users
        const usersRef = collection(firestore, 'users');
        const usersSnapshot = await getDocs(usersRef);
        setUsers(usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
        setError('Failed to load posts. Please try again.');
      } finally {
        setLoading(false);
    }
    })();
    // Get user location using expo-location
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setUserLocation(null);
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    })();
  }, []);

  useEffect(() => {
    const checkFirstVisit = async () => {
      if (auth.currentUser) {
        try {
          const userDoc = await getDoc(doc(firestore, 'users', auth.currentUser.uid));
          if (userDoc.exists() && !userDoc.data().nickname) {
            setShowOnboarding(true);
          }
        } catch (error) {
          console.error('Error checking first visit:', error);
        }
      }
    };
    checkFirstVisit();
  }, []);

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c; // Distance in km
    return distance;
  };

  // Filtered users for search
  const filteredUsers = users.filter(user => {
    const searchTerm = searchQuery.toLowerCase().trim();
    const displayName = (user.displayName || '').toLowerCase();
    const nickname = (user.nickname || '').toLowerCase();
    return displayName.includes(searchTerm) || nickname.includes(searchTerm);
  });

  const filteredPosts = posts.filter(post => {
    let verification_tag = false;
    let expired_tag = true;

    // ✅ Show only Approved posts
    if (post.verification_status === 'Approved') {
      verification_tag = true;
    }

    // ✅ Exclude expired posts
    const now = Timestamp.now().toMillis();
    const expirationTime = post.expiresAt?.toMillis();
    if (!expirationTime || expirationTime < now) {
      expired_tag = false;
    }

    // ✅ Match tags
    const matchesTags = post.tags?.some(tag => {
      const normalizedPostTag = normalizeTag(tag);
      const normalizedSearchQuery = normalizeTag(searchQuery);
      return normalizedPostTag.includes(normalizedSearchQuery) ||
             normalizedSearchQuery.includes(normalizedPostTag);
    });

    // ✅ Match username or anonymous
    const matchesUsername =
      post.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (post.isAnonymous && searchQuery.toLowerCase() === 'anonymous');

    // ✅ Match title/caption
    let matchesSearch = true;
    if (searchQuery.trim() !== '') {
      matchesSearch =
        post.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.caption?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        matchesTags ||
        matchesUsername;
    }

    // ✅ Match selected tag (from filter chips)
    const matchesTag = !selectedTag ||
      post.tags?.some(tag => {
        const normalizedPostTag = normalizeTag(tag);
        const normalizedSelectedTag = normalizeTag(selectedTag);
        return normalizedPostTag.includes(normalizedSelectedTag) ||
               normalizedSelectedTag.includes(normalizedPostTag);
      });

    // ✅ Match radius
    const matchesRadius =
      !userLocation || !post.location || searchQuery.trim() !== '' || selectedTag
        ? true
        : calculateDistance(
            userLocation.lat,
            userLocation.lng,
            post.location.latitude,
            post.location.longitude
          ) <= parseInt(radius);

    return matchesSearch && matchesTag && matchesRadius && verification_tag && expired_tag;
  });

  const handleCardPress = (postId) => {
    router.push(`/posts/${postId}`);
  };

  const handleTagPress = (tag) => {
    setSelectedTag(tag === selectedTag ? null : tag);
    setSearchQuery('');
  };

  const handleUserClick = (userId) => {
    router.push(`/users/${userId}`);
    setShowSearchResults(false);
    setSearchQuery('');
  };

  const handleSearch = () => {
    if (searchQuery.trim() === '') {
      setShowSearchResults(false);
      return;
    }
    setShowSearchResults(true);
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}> 
        <ActivityIndicator size="large" color={colors.primary} />
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <HeaderBar />
      <OnboardingStepper visible={showOnboarding} onClose={() => setShowOnboarding(false)} />
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16 }}>
        <View style={[styles.searchContainer]}>
          <View style={[styles.searchInputContainer, { backgroundColor: colors.card }]}> 
            <MaterialIcons name="search" size={20} color={colors.placeholder} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search posts, users, or tags..."
              placeholderTextColor={colors.placeholder}
              value={searchQuery}
              onChangeText={text => {
                setSearchQuery(text);
                handleSearch();
              }}
            />
          </View>
        </View>
        <View style={styles.radiusContainer}>
          <Text style={[styles.radiusLabel, { color: colors.textSecondary }]}>Content Radius</Text>
          <View style={[styles.radiusDropdown, { backgroundColor: colors.card }]}> 
            <Picker
              selectedValue={radius}
              onValueChange={(itemValue) => setRadius(itemValue)}
              style={[styles.picker, { color: colors.text, backgroundColor: 'transparent' }]}
            >
              <Picker.Item label="1 km" value="1" />
              <Picker.Item label="3 km" value="3" />
              <Picker.Item label="5 km" value="5" />
              <Picker.Item label="10 km" value="10" />
              <Picker.Item label="20 km" value="20" />
              <Picker.Item label="50 km" value="50" />
            </Picker>
          </View>
          {radius !== userPreferredRadius && (
            <TouchableOpacity
              style={[styles.resetButton, { backgroundColor: colors.primary }]}
              onPress={() => setRadius(userPreferredRadius)}
            >
              <Text style={[styles.resetButtonText, { color: '#fff' }]}>Reset to Default ({userPreferredRadius} km)</Text>
            </TouchableOpacity>
          )}
        </View>
        {!userLocation && (
          <View style={[styles.locationAlert, { backgroundColor: colors.warning + '1A' }]}> 
            <MaterialIcons name="location-off" size={16} color={colors.warning} />
            <Text style={[styles.locationAlertText, { color: colors.warning }]}>Location services are disabled. Enable location services to see posts within your selected radius.</Text>
          </View>
        )}
        {showSearchResults && searchQuery.trim() !== '' && (
          <View style={[styles.searchDropdown, { backgroundColor: colors.card }]}> 
            {/* User Results */}
            {filteredUsers.length > 0 && (
              <View style={styles.dropdownSection}>
                <Text style={[styles.dropdownSectionTitle, { color: colors.textSecondary }]}>Users</Text>
                {filteredUsers.map(user => (
                  <TouchableOpacity 
                    key={user.id} 
                    style={styles.dropdownItem} 
                    onPress={() => handleUserClick(user.id)}
                  >
                    <Image 
                      source={user.photoURL ? { uri: user.photoURL } : { uri: anonymousAvatar }} 
                      style={styles.dropdownAvatar} 
                    />
                    <View style={styles.dropdownItemContent}>
                      <Text style={[styles.dropdownText, { color: colors.text }]}>{user.displayName || 'Anonymous User'}</Text>
                      {user.nickname && <Text style={[styles.dropdownSubText, { color: colors.textTertiary }]}>@{user.nickname}</Text>}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {filteredPosts.length > 0 && (
              <View style={styles.dropdownSection}>
                <Text style={[styles.dropdownSectionTitle, { color: colors.textSecondary }]}>Posts</Text>
                {filteredPosts.slice(0, 3).map(post => (
                  <TouchableOpacity 
                    key={post.id} 
                    style={styles.dropdownItem} 
                    onPress={() => {
                      handleCardPress(post.id);
                      setShowSearchResults(false);
                    }}
                  >
                    <Image
                      source={post.imageUrl ? { uri: post.imageUrl } : placeholderImage} 
                      style={[styles.dropdownPostImage, { backgroundColor: colors.border }]} 
                    />
                    <View style={styles.dropdownItemContent}>
                      <Text style={[styles.dropdownText, { color: colors.text }]}>{post.title}</Text>
                      <Text style={[styles.dropdownSubText, { color: colors.textTertiary }]}>{post.caption?.substring(0, 50)}...</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {filteredUsers.length === 0 && filteredPosts.length === 0 && (
              <View style={styles.noResults}>
                <Text style={[styles.noResultsText, { color: colors.textTertiary }]}>No results found</Text>
              </View>
            )}
          </View>
        )}
        <View style={styles.tagsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['Traffic', 'Events', 'Food', 'Safety', 'Community', 'Alerts', 'News'].map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[styles.tagChip, { backgroundColor: selectedTag === tag ? colors.primary : colors.card }]}
                onPress={() => handleTagPress(tag)}
              >
                <Text style={[styles.tagChipText, { color: selectedTag === tag ? '#fff' : colors.textTertiary, fontWeight: selectedTag === tag ? 'bold' : 'normal' }]}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <View style={styles.postsList}>
          {filteredPosts.map(post => (
            <TouchableOpacity
              key={post.id}
              style={[styles.postCard, { backgroundColor: colors.card }]}
              onPress={() => handleCardPress(post.id)}
            >
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
                  <Text style={[styles.postUsername, { color: colors.text }]}>{post.isAnonymous ? 'Anonymous' : (post.username || 'Unknown User')}</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.postImageContainer, { backgroundColor: colors.border }]}> 
                <Image 
                  source={post.imageUrl ? { uri: post.imageUrl } : placeholderImage} 
                  style={styles.postImage} 
                  resizeMode="contain"
                />
              </View>
              <View style={styles.postContent}>
                <View style={styles.postTitleRow}>
                  <Text style={[styles.postTitle, { color: colors.text }]} numberOfLines={1}>{post.title}</Text>
                  <View style={styles.postTimeContainer}>
                    <MaterialIcons name="access-time" size={12} color={colors.textTertiary} />
                    <Text style={[styles.postTime, { color: colors.textTertiary }]}>{formatTimeAgo(post.createdAt)}</Text>
                  </View>
                </View>
                <Text style={[styles.postCaption, { color: colors.textSecondary }]} numberOfLines={2}>{post.caption}</Text>
                <View style={styles.postTags}>
                  {post.tags?.slice(0, 3).map(tag => (
                    <TouchableOpacity
                      key={tag}
                      style={[styles.postTag, { backgroundColor: selectedTag === tag ? colors.primary : colors.input }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleTagPress(tag);
                      }}
                    >
                      <Text style={[styles.postTagText, { color: selectedTag === tag ? '#fff' : colors.primary, fontWeight: selectedTag === tag ? 'bold' : 'normal' }]}>{tag}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={[styles.postActions, { borderTopColor: colors.border }]}> 
                <View style={styles.postAction}>
                  <MaterialIcons 
                    name={post.likedBy?.includes(auth.currentUser?.uid) ? "favorite" : "favorite-border"} 
                    size={16} 
                    color={post.likedBy?.includes(auth.currentUser?.uid) ? colors.error : colors.textTertiary} 
                  />
                  <Text style={[styles.postActionText, { color: colors.textTertiary }]}>{post.likes || 0}</Text>
                </View>
                <View style={styles.postAction}>
                  <MaterialIcons name="chat-bubble-outline" size={16} color={colors.textTertiary} />
                  <Text style={[styles.postActionText, { color: colors.textTertiary }]}>{post.commentCount || 0}</Text>
                </View>
                <View style={styles.postAction}>
                  <MaterialIcons name="visibility" size={16} color={colors.textTertiary} />
                  <Text style={[styles.postActionText, { color: colors.textTertiary }]}>{post.eyewitnesses || 0}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.bottomPadding} />
      </ScrollView>
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

export default function ProtectedHomeWrapper(props) {
  return (
    <ProtectedRoute>
      <Home {...props} />
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' },
  error: { color: '#e74c3c', fontSize: 16 },
  searchContainer: {
    marginBottom: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#232323',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  radiusContainer: {
    marginBottom: 12,
  },
  radiusLabel: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 8,
  },
  radiusDropdown: {
    backgroundColor: '#232323',
    borderRadius: 12,
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
    color: '#fff',
    fontSize: 16,
    backgroundColor: 'transparent',
  },
  resetButton: {
    backgroundColor: '#4A6FFF',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  locationAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFA7261A',
    borderRadius: 12,
    paddingVertical: 10, 
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  locationAlertText: {
    color: '#FFA726',
    fontSize: 14,
    marginLeft: 8,
  },
  searchDropdown: {
    backgroundColor: '#232323',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    zIndex: 100,
    maxHeight: 300,
  },
  dropdownSection: { 
    padding: 12,
  },
  dropdownSectionTitle: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  dropdownItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1, 
    borderBottomColor: '#333',
  },
  dropdownAvatar: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    marginRight: 12 
  },
  dropdownPostImage: { 
    width: 40, 
    height: 40, 
    borderRadius: 8, 
    marginRight: 12,
    backgroundColor: '#333',
  },
  dropdownItemContent: {
    flex: 1, 
  },
  dropdownText: { 
    color: '#fff', 
    fontSize: 15 
  },
  dropdownSubText: { 
    color: '#aaa', 
    fontSize: 13, 
    marginTop: 2 
  },
  noResults: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noResultsText: {
    color: '#aaa',
    fontSize: 16,
  },
  tagsContainer: {
    marginBottom: 12,
  },
  tagChip: {
    backgroundColor: '#232323',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  tagChipActive: {
    backgroundColor: '#4A6FFF',
  },
  tagChipText: {
    color: '#ccc',
    fontSize: 14,
  },
  tagChipTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  postsList: {
    marginTop: 12,
  },
  postCard: {
    width: '100%', // Full width
    backgroundColor: '#181818',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#232323',
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  postUsername: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  postImageContainer: {
    width: '100%',
    height: SCREEN_WIDTH * 0.6, // Full width image container
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  postImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain', // This will add black bars on sides if needed
  },
  postContent: {
    padding: 12,
  },
  postTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  postTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    flex: 1,
  },
  postTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postTime: {
    color: '#666',
    fontSize: 12,
    marginLeft: 4,
  },
  postCaption: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 8,
  },
  postTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  postTag: {
    backgroundColor: '#232323',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  postTagActive: {
    backgroundColor: '#4A6FFF',
  },
  postTagText: {
    color: '#4A6FFF',
    fontSize: 12,
  },
  postTagTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  postAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postActionText: {
    color: '#666',
    fontSize: 13,
    marginLeft: 4,
  },
  bottomPadding: {
    height: 100, // Adjust height as needed
  },
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