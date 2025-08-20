import React, { useState, useEffect } from 'react';
import { ProtectedRoute } from '../ProtectedRoute';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, ScrollView, Dimensions, Image } from 'react-native';
import { firestore } from '../firebaseConfig';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { router } from 'expo-router';
import FooterNav from '../components/FooterNav';
import HeaderBar from '../components/HeaderBar';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';
const aiStar = require('../assets/images/aistar.png');

const SCREEN_WIDTH = Dimensions.get('window').width;
const placeholderImage = require('../assets/images/placeholder.png');

function normalizeTag(tag) {
  if (!tag || typeof tag !== 'string') return '';
  
  // Convert to lowercase and trim
  let normalized = tag.toLowerCase().trim();
  
  // Remove common suffixes that might cause variations
  const suffixes = ['jam', 'alert', 'warning', 'info', 'update', 'news'];
  for (const suffix of suffixes) {
    if (normalized.endsWith(suffix) && normalized.length > suffix.length) {
      normalized = normalized.slice(0, -suffix.length);
      break;
    }
  }
  
  // Handle common variations
  const variations = {
    'traffic': 'traffic',
    'event': 'events',
    'food': 'food',
    'safety': 'safety',
    'community': 'community',
    'alert': 'alerts',
    'news': 'news',
    'emergency': 'alerts',
    'accident': 'traffic',
    'road': 'traffic',
    'restaurant': 'food',
    'cafe': 'food',
    'party': 'events',
    'festival': 'events',
    'crime': 'safety',
    'police': 'safety',
    'neighborhood': 'community',
    'local': 'community'
  };
  
  return variations[normalized] || normalized;
}

function Explore() {
  const { colors } = useTheme();
  const [tab, setTab] = useState(0); // 0: Popular, 1: Tags
  const [popularPosts, setPopularPosts] = useState([]);
  const [popularTags, setPopularTags] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingTags, setLoadingTags] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoadingPosts(true);
        const postsRef = collection(firestore, 'posts');
        const q = query(postsRef, orderBy('likes', 'desc'));
        const querySnapshot = await getDocs(q);
        let postsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const numPostsToShow = Math.ceil(postsData.length * 0.2);
        postsData = postsData.slice(0, numPostsToShow);
        setPopularPosts(postsData);
      } catch (err) {
        setError('Failed to fetch popular posts.');
      } finally {
        setLoadingPosts(false);
      }
    })();
    (async () => {
      try {
        setLoadingTags(true);
        const postsRef = collection(firestore, 'posts');
        const querySnapshot = await getDocs(postsRef);
        const tagCounts = {};
        
        querySnapshot.docs.forEach(doc => {
          const post = doc.data();
          if (post.tags && Array.isArray(post.tags)) {
            post.tags.forEach(tag => {
              if (tag && typeof tag === 'string') {
                const normalizedTag = normalizeTag(tag);
                if (normalizedTag) {
                  if (!tagCounts[normalizedTag]) {
                    tagCounts[normalizedTag] = { count: 0, originalTags: new Set() };
                  }
                  tagCounts[normalizedTag].count += 1;
                  tagCounts[normalizedTag].originalTags.add(tag);
                }
              }
            });
          }
        });
        
        const sortedTags = Object.entries(tagCounts)
          .map(([normalizedName, data]) => ({ 
            name: normalizedName, 
            count: data.count,
            originalTags: Array.from(data.originalTags)
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);
        
        setPopularTags(sortedTags);
      } catch (err) {
        console.error('Error fetching popular tags:', err);
        setError('Failed to fetch popular tags.');
      } finally {
        setLoadingTags(false);
      }
    })();
  }, []);

  const handleCardPress = (postId) => {
    router.push(`/posts/${postId}`);
  };

  const handleTagPress = (tagName) => {
    router.push(`/explore/${tagName}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }] }>
      <HeaderBar />
      <View style={{ flex: 1, padding: 16, backgroundColor: colors.background }}>
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tab, { backgroundColor: tab === 0 ? colors.primary : colors.card }]} onPress={() => setTab(0)}>
            <Text style={[styles.tabText, { color: tab === 0 ? '#fff' : colors.textTertiary, fontWeight: tab === 0 ? 'bold' : 'normal' }]}>Posts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, { backgroundColor: tab === 1 ? colors.primary : colors.card }]} onPress={() => setTab(1)}>
            <Text style={[styles.tabText, { color: tab === 1 ? '#fff' : colors.textTertiary, fontWeight: tab === 1 ? 'bold' : 'normal' }]}>Tags</Text>
          </TouchableOpacity>
        </View>
        {tab === 0 && (
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Most Popular Posts</Text>
            {loadingPosts ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 32 }} />
            ) : error ? (
              <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
            ) : popularPosts.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No popular posts found.</Text>
            ) : (
              <FlatList
                data={popularPosts}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={[styles.card, { backgroundColor: colors.card }]} onPress={() => handleCardPress(item.id)}>
                    <View style={[styles.cardImageBox, { backgroundColor: colors.border }]}> 
                      <Image
                        source={item.imageUrl ? { uri: item.imageUrl } : placeholderImage}
                        style={styles.cardImage}
                        resizeMode="cover"
                      />
                    </View>
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
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textTertiary }]}>No posts found.</Text>}
                contentContainerStyle={{ paddingBottom: 32 }}
              />
            )}
          </View>
        )}
        {tab === 1 && (
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Popular Tags</Text>
            {loadingTags ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 32 }} />
            ) : error ? (
              <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
            ) : popularTags.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No popular tags found.</Text>
            ) : (
              <ScrollView contentContainerStyle={styles.tagsContainer}>
                {popularTags.map(tag => (
                  <TouchableOpacity 
                    key={tag.name} 
                    style={[styles.tagChipLarge, { backgroundColor: colors.input }]}
                    onPress={() => handleTagPress(tag.name)}
                  >
                    <Text style={[styles.tagTextLarge, { color: colors.primary }]}>
                      {tag.name.charAt(0).toUpperCase() + tag.name.slice(1)} ({tag.count})
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </View>
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

export default function ProtectedExploreWrapper(props) {
  return (
    <ProtectedRoute>
      <Explore {...props} />
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  tabRow: { flexDirection: 'row', marginBottom: 16, marginTop: 16 },
  tab: { flex: 1, paddingVertical: 12, borderRadius: 8, marginRight: 8, alignItems: 'center' },
  tabActive: { backgroundColor: '#4A6FFF' },
  tabText: { color: '#ccc', fontSize: 16 },
  tabTextActive: { color: '#fff', fontWeight: 'bold' },
  sectionTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  error: { color: '#e74c3c', fontSize: 16, marginTop: 32 },
  emptyText: { color: '#aaa', textAlign: 'center', marginTop: 40, fontSize: 16 },
  card: { backgroundColor: '#181818', borderRadius: 16, marginBottom: 18, overflow: 'hidden', flexDirection: 'row', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  cardImageBox: { width: 100, height: 100, backgroundColor: '#000' },
  cardImage: { width: 100, height: 100, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  cardContent: { flex: 1, padding: 10, justifyContent: 'center' },
  cardTitle: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginBottom: 2 },
  cardTagsRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  cardTag: { backgroundColor: '#232323', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginRight: 6, marginBottom: 4 },
  cardTagText: { color: '#4A6FFF', fontSize: 12 },
  cardStatsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  statText: { color: '#ccc', fontSize: 13, marginRight: 16 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChipLarge: { backgroundColor: '#232323', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 18, marginRight: 8, marginBottom: 8 },
  tagTextLarge: { color: '#4A6FFF', fontSize: 15, fontWeight: 'bold' },
  tagVariations: { color: '#888', fontSize: 12, marginTop: 4 },
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