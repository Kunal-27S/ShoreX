import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, Image, Dimensions } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { firestore } from '../../firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';
import { useTheme } from '../../contexts/ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const placeholderImage = require('../../assets/images/placeholder.png');
const anonymousAvatar = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';

function normalizeTag(tag) {
  if (!tag || typeof tag !== 'string') return '';
  let normalized = tag.toLowerCase().trim();
  const suffixes = ['jam', 'alert', 'warning', 'info', 'update', 'news'];
  for (const suffix of suffixes) {
    if (normalized.endsWith(suffix) && normalized.length > suffix.length) {
      normalized = normalized.slice(0, -suffix.length);
      break;
    }
  }
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

function getStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
    error: { color: colors.error, fontSize: 16 },
    title: { color: colors.text, fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
    tagText: { color: colors.primary, fontWeight: 'bold' },
    card: { backgroundColor: colors.card, borderRadius: 16, marginBottom: 18, overflow: 'hidden', shadowColor: colors.shadow, shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
    cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 10 },
    userRow: { flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8 },
    username: { color: colors.text, fontWeight: 'bold', fontSize: 15 },
    cardImage: { width: '100%', height: SCREEN_WIDTH * 0.5, backgroundColor: colors.background },
    cardContent: { padding: 10 },
    cardTitle: { color: colors.text, fontWeight: 'bold', fontSize: 16, marginBottom: 2 },
    cardCaption: { color: colors.textSecondary, fontSize: 14, marginBottom: 6 },
    emptyText: { color: colors.textTertiary, textAlign: 'center', marginTop: 40, fontSize: 16 },
  });
}

export default function TagExplore() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { tag } = useLocalSearchParams();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const postsRef = collection(firestore, 'posts');
        const querySnapshot = await getDocs(postsRef);
        const allPosts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const normalizedSearchTag = normalizeTag(tag);
        const filteredPosts = allPosts.filter(post => {
          if (!post.tags || !Array.isArray(post.tags)) return false;
          return post.tags.some(postTag => {
            if (!postTag || typeof postTag !== 'string') return false;
            const normalizedPostTag = normalizeTag(postTag);
            return normalizedPostTag === normalizedSearchTag;
          });
        });
        setPosts(filteredPosts);
      } catch (err) {
        console.error('Error fetching posts for tag:', err);
        setError('Failed to fetch posts for this tag.');
      } finally {
        setLoading(false);
      }
    })();
  }, [tag]);

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }
  if (error) {
    return <View style={styles.centered}><Text style={styles.error}>{error}</Text></View>;
  }

  return (
    <FlatList
      style={styles.container}
      data={posts}
      keyExtractor={item => item.id}
      ListHeaderComponent={
        <Text style={styles.title}>Posts tagged with <Text style={styles.tagText}>#{tag}</Text></Text>
      }
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => router.push(`/posts/${item.id}`)}>
          <View style={styles.cardHeader}>
            <TouchableOpacity 
              onPress={() => {
                if (!item.isAnonymous && item.creatorId) {
                  router.push(`/users/${item.creatorId}`);
                }
              }}
              disabled={item.isAnonymous || !item.creatorId}
              style={styles.userRow}
            >
              <Image
                source={item.isAnonymous ? { uri: anonymousAvatar } : item.userAvatar ? { uri: item.userAvatar } : placeholderImage}
                style={styles.avatar}
              />
              <Text style={styles.username}>
                {item.isAnonymous ? 'Anonymous' : (item.username || 'User')}
              </Text>
            </TouchableOpacity>
          </View>
          <Image
            source={item.imageUrl ? { uri: item.imageUrl } : placeholderImage}
            style={styles.cardImage}
            resizeMode="cover"
          />
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardCaption} numberOfLines={2}>{item.caption}</Text>
          </View>
        </TouchableOpacity>
      )}
      ListEmptyComponent={<Text style={styles.emptyText}>No posts found for this tag.</Text>}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
    />
  );
} 