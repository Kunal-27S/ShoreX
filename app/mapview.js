import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions, TouchableOpacity, ScrollView, Image, Modal } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { firestore } from '../firebaseConfig';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';
import FooterNav from '../components/FooterNav';
import HeaderBar from '../components/HeaderBar';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
const aiStar = require('../assets/images/aistar.png');

const SCREEN_HEIGHT = Dimensions.get('window').height;
const placeholderImage = require('../assets/images/placeholder.png');

function normalizeTag(tag) {
  const t = tag.toLowerCase();
  if (t.length > 3 && t.endsWith('s')) return t.slice(0, -1);
  return t;
}

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

export default function MapViewScreen() {
  const { colors } = useTheme();
  const [userPosition, setUserPosition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [radius, setRadius] = useState(5);
  const [selectedTags, setSelectedTags] = useState([]);
  const [posts, setPosts] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [locationAccuracy, setLocationAccuracy] = useState(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setUserPosition(null);
        setError('Location permission denied');
        setLoading(false);
        return;
      }
      
      let loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      setUserPosition({ 
        latitude: loc.coords.latitude, 
        longitude: loc.coords.longitude 
      });
      setLocationAccuracy(loc.coords.accuracy);
    })();
    
    // Fetch posts
    (async () => {
      try {
        const postsCollection = collection(firestore, 'posts');
        const postsSnapshot = await getDocs(postsCollection);
        const postsData = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPosts(postsData);
      } catch (err) {
        console.error('Error fetching posts:', err);
        setError('Failed to fetch posts.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleTagPress = (tag) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const filteredPosts = posts.filter(post => {
    // Check if post is expired
    const isExpired = post.expiresAt && post.expiresAt.toDate() < new Date();
    if (isExpired) return false;

    // Only show posts with location
    if (!post.location?.latitude || !post.location?.longitude) return false;

    // Tag filter - using normalized tags
    if (selectedTags.length > 0) {
      const hasSelectedTag = post.tags?.some(tag => {
        const normalizedPostTag = normalizeTag(tag);
        return selectedTags.some(selectedTag => 
          normalizedPostTag === normalizeTag(selectedTag) ||
          normalizedPostTag.includes(normalizeTag(selectedTag)) ||
          normalizeTag(selectedTag).includes(normalizedPostTag)
        );
      });
      if (!hasSelectedTag) return false;
    }

    // Radius filter
    if (userPosition) {
      const distance = calculateDistance(
        userPosition.latitude, 
        userPosition.longitude, 
        post.location.latitude, 
        post.location.longitude
      );
      if (distance > radius) return false;
    }

    return true;
  });

  const handleMarkerPress = (post) => {
    setSelectedPost(post);
  };

  const handleViewDetails = (postId) => {
    setSelectedPost(null);
    router.push(`/posts/${postId}`);
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}> 
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading map...</Text>
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

  const mapCenter = userPosition || (posts.length > 0 && posts[0].location ? 
    { latitude: posts[0].location.latitude, longitude: posts[0].location.longitude } : 
    { latitude: 0, longitude: 0 }
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <HeaderBar />
      <View style={[styles.filterPanel, { backgroundColor: colors.card, borderBottomColor: colors.border, flexShrink: 0 }]}> 
        <Text style={[styles.filterLabel, { color: colors.text }]}>Filter by Tags:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsRow}>
          {['Traffic', 'Events', 'Food', 'Safety', 'Community', 'Alerts', 'News'].map(tag => (
            <TouchableOpacity
              key={tag}
              style={[styles.tagChip, { backgroundColor: selectedTags.includes(tag) ? colors.primary : colors.card }]}
              onPress={() => handleTagPress(tag)}
            >
              <Text style={[styles.tagText, { color: selectedTags.includes(tag) ? '#fff' : colors.textSecondary, fontWeight: selectedTags.includes(tag) ? 'bold' : 'normal' }]}>{tag}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={[styles.filterLabel, { color: colors.text }]}>Radius: {radius} km</Text>
        <Slider
          style={{ width: 200, height: 40 }}
          minimumValue={1}
          maximumValue={50}
          step={1}
          value={radius}
          onValueChange={setRadius}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbStyle={{ backgroundColor: colors.primary }}
        />
        {locationAccuracy && (
          <Text style={[styles.accuracyText, { color: colors.textTertiary }]}>Location accuracy: ±{Math.round(locationAccuracy)}m</Text>
        )}
        <Text style={[styles.postsCount, { color: colors.text }]}>Showing {filteredPosts.length} posts</Text>
      </View>
      
      <View style={{ flex: 1 }}>
        <MapView
          provider="google"
          style={{ flex: 1 }}
          initialRegion={{
            latitude: mapCenter.latitude,
            longitude: mapCenter.longitude,
            latitudeDelta: userPosition ? 0.05 : 0.1,
            longitudeDelta: userPosition ? 0.05 : 0.1,
          }}
          showsUserLocation={!!userPosition}
          showsMyLocationButton={true}
          showsCompass={true}
          showsScale={true}
        >
          {filteredPosts.map(post => (
            <Marker
              key={post.id}
              coordinate={{ 
                latitude: post.location.latitude, 
                longitude: post.location.longitude 
              }}
              onPress={() => handleMarkerPress(post)}
              pinColor={colors.primary}
            >
              <MaterialIcons name="location-on" size={32} color={colors.primary} />
            </Marker>
          ))}
        </MapView>
      </View>
      
      {selectedPost && (
        <Modal
          visible={!!selectedPost}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedPost(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.card }]}> 
              <TouchableOpacity 
                style={[styles.closeButton, { backgroundColor: colors.border }]}
                onPress={() => setSelectedPost(null)}
              >
                <MaterialIcons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Image 
                source={selectedPost.imageUrl ? { uri: selectedPost.imageUrl } : placeholderImage} 
                style={[styles.modalImage, { backgroundColor: colors.background }]}
                resizeMode="contain"
              />
              <Text style={[styles.modalTitle, { color: colors.text }]} numberOfLines={1}>
                {selectedPost.title}
              </Text>
              <View style={styles.modalTags}>
                {selectedPost.tags?.slice(0, 3).map(tag => (
                  <View key={tag} style={[styles.modalTag, { backgroundColor: colors.primary }]}> 
                    <Text style={[styles.modalTagText, { color: '#fff' }]}>{tag}</Text>
                  </View>
                ))}
              </View>
              <Text style={[styles.modalTime, { color: colors.textTertiary }]}>Posted: {selectedPost.createdAt?.toDate().toLocaleString()}</Text>
              {selectedPost.expiresAt && (
                <Text style={[styles.modalExpiry, { color: colors.error }]}>Expires: {formatTimeRemaining(selectedPost.expiresAt)}</Text>
              )}
              <TouchableOpacity 
                style={[styles.modalViewDetailsButton, { backgroundColor: colors.primary }]}
                onPress={() => handleViewDetails(selectedPost.id)}
              >
                <Text style={[styles.modalViewDetailsText, { color: '#fff' }]}>View Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
      
      <FooterNav />
      {/* Floating AI Chat Button */}
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
  filterPanel: { padding: 16, backgroundColor: '#181818', borderBottomWidth: 1, borderBottomColor: '#232323' },
  filterLabel: { color: '#fff', fontWeight: 'bold', marginBottom: 6 },
  tagsRow: { flexDirection: 'row', marginBottom: 8 },
  tagChip: { backgroundColor: '#232323', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 16, marginRight: 8 },
  tagChipSelected: { backgroundColor: '#4A6FFF' },
  tagText: { color: '#ccc', fontSize: 14 },
  tagTextSelected: { color: '#fff', fontWeight: 'bold' },
  map: { flex: 1 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalContent: {
    backgroundColor: '#181818',
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
    padding: 20,
    position: 'relative',
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#000',
  },
  modalTitle: {
    fontWeight: 'bold',
    fontSize: 20,
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  modalTag: {
    backgroundColor: '#4A6FFF',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginRight: 6,
    marginBottom: 6,
  },
  modalTagText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalTime: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 8,
  },
  modalExpiry: {
    color: '#e74c3c',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalViewDetailsButton: {
    backgroundColor: '#4A6FFF',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  modalViewDetailsText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    zIndex: 1,
    backgroundColor: '#333',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#fff',
    fontSize: 16,
  },
  accuracyText: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 8,
  },
  postsCount: {
    color: '#fff',
    fontSize: 14,
    marginTop: 8,
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