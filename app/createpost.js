import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Image, ScrollView, Alert, Switch } from 'react-native';
import { auth, firestore, storage } from '../firebaseConfig';
import { collection, addDoc, doc, getDoc, Timestamp, GeoPoint } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import FooterNav from '../components/FooterNav';
import HeaderBar from '../components/HeaderBar';
import { useTheme } from '../contexts/ThemeContext';

const placeholderImage = require('../assets/images/placeholder.png');

export default function CreatePost() {
  const { colors } = useTheme();
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [duration, setDuration] = useState(12);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [image, setImage] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [sliderWidth, setSliderWidth] = useState(0);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocation(null);
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    })();
  }, []);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      console.log('Image selected:', result.assets[0]);
      setImage(result.assets[0]);
    }
  };

  const handleAddTag = () => {
    if (tagInput && tags.length < 3 && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleDeleteTag = (tagToDelete) => {
    setTags(tags.filter(tag => tag !== tagToDelete));
  };

  const handleSliderPress = (event) => {
    if (sliderWidth === 0) return;
    const { locationX } = event.nativeEvent;
    const percentage = Math.max(0, Math.min(1, locationX / sliderWidth));
    const newDuration = Math.round(1 + percentage * 23); // 1 to 24 hours
    setDuration(newDuration);
  };

  // Upload image to Firebase Storage
  const uploadImageToFirebase = async (imageFile) => {
    try {
      const timestamp = Date.now();
      const filename = `${timestamp}_${imageFile.fileName || 'image.jpg'}`;
      const storagePath = `posts/${auth.currentUser.uid}/${filename}`;
      
      // Create a reference to the file location
      const storageRef = ref(storage, storagePath);
      
      // Convert image to blob
      const response = await fetch(imageFile.uri);
      const blob = await response.blob();
      
      // Upload the file
      const snapshot = await uploadBytes(storageRef, blob);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  // Create verification result notification
  const createVerificationNotification = async (postId, status, reason = null) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      let notificationData = {
        type: status === 'Approved' ? 'post_approved' : 'post_rejected',
        postId: postId,
        timestamp: Timestamp.now(),
        read: false
      };

      if (status === 'Approved') {
        notificationData.message = 'Your post has been approved and is now visible to others.';
      } else {
        notificationData.message = `Your post was rejected: ${reason || 'Content violates community guidelines'}`;
        notificationData.rejectionReason = reason;
      }

      await addDoc(collection(firestore, 'users', user.uid, 'notifications'), notificationData);
    } catch (error) {
      console.error('Error creating verification notification:', error);
    }
  };

  // Trigger content verification
  const triggerContentVerification = async (imageFile, title, caption) => {
    try {
      const formData = new FormData();
      
      // Add image
      const response = await fetch(imageFile.uri);
      const blob = await response.blob();
      formData.append('image', blob, 'image.jpg');
      
      // Add text content
      formData.append('title', title);
      formData.append('caption', caption);

      // Add timeout to the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // Reduced to 10 seconds

      const verificationResponse = await fetch('https://content-verification-g2plvgg63a-el.a.run.app', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (verificationResponse.ok) {
        const result = await verificationResponse.json();
        console.log('Content verification result:', result);
      } else {
        console.warn('Content verification API returned non-OK status:', verificationResponse.status);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn('Content verification request timed out - background service will handle verification');
      } else {
        console.warn('Content verification request failed - background service will handle verification:', error.message);
      }
      // Don't throw error - let the background service handle verification
    }
  };

  const handleSubmit = async () => {
    if (!image || !title || !caption || !location) {
      setError('Please fill in all required fields and select an image.');
      return;
    }
    setLoading(true);
    setError(null);
    setStatusMessage('Preparing post...');
    try {
      // Fetch user profile
      const user = auth.currentUser;
      if (!user) throw new Error('Not signed in');
      const userDocRef = doc(firestore, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      const userData = userDocSnap.exists() ? userDocSnap.data() : null;
      const displayName = userData?.displayName || user.displayName || user.email;
      
      // Upload image to Firebase Storage
      setImageUploading(true);
      setStatusMessage('Uploading image...');
      const imageUrl = await uploadImageToFirebase(image);
      setImageUploading(false);
      
      // Calculate expiration timestamp
      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + duration * 60 * 60 * 1000);
      
      // Create post with pending verification status
      setStatusMessage('Creating post...');
      const newPost = {
        title,
        caption,
        tags,
        duration,
        isAnonymous,
        imageUrl,
        creatorId: user.uid,
        username: isAnonymous ? null : displayName,
        userAvatar: isAnonymous ? null : (userData?.photoURL || user.photoURL || ''),
        createdAt: Timestamp.fromDate(createdAt),
        expiresAt: Timestamp.fromDate(expiresAt),
        location: new GeoPoint(location.lat, location.lng),
        likes: 0,
        likedBy: [],
        eyewitnesses: 0,
        eyewitnessedBy: [],
        commentCount: 0,
        verification_status: 'None',
        text_safe: 'not_processed',
        image_safe: 'not_processed',
        image_ai: 'not_processed',
        is_visible: false,
        retry_count: 0,
        requires_24hr_cooldown: false,
        last_verified: null, // This will be updated by the background service
        verification_requested: Timestamp.now() // Mark when verification was requested
      };

      // Save post to Firebase
      const postRef = await addDoc(collection(firestore, 'posts'), newPost);
      console.log('Post created successfully with ID:', postRef.id);

      // Create notification for pending verification
      setStatusMessage('Setting up notifications...');
      const notificationData = {
        type: 'post_pending',
        postId: postRef.id,
        message: 'New post created. awaiting verification.',
        timestamp: Timestamp.now(),
        read: false
      };

      await addDoc(collection(firestore, 'users', user.uid, 'notifications'), notificationData);

      // Try to trigger content verification (non-blocking)
      setVerifying(true);
      setStatusMessage('Initiating content verification...');
      
      // Use setTimeout to make verification completely non-blocking
      // Note: Network failures are expected and normal - the background verification service will handle verification
      setTimeout(async () => {
        try {
          await triggerContentVerification(image, title, caption);
          console.log('Content verification triggered successfully');
        } catch (err) {
          console.warn('Content verification failed - background service will handle it:', err.message);
          // This is expected behavior - the background verification service will process the post
        }
      }, 100);

      setVerifying(false);
      setLoading(false);
      setStatusMessage('');
      
      Alert.alert(
        'Success', 
        "Your post has been created and is pending verification. You'll be notified once it's approved.",
        [{ text: 'OK', onPress: () => router.push('/home') }]
      );
    } catch (err) {
      console.error('Error creating post:', err);
      setError('Failed to create post. Please try again.');
      setLoading(false);
      setImageUploading(false);
      setVerifying(false);
      setStatusMessage('');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <HeaderBar />
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ padding: 16 }}>
        <Text style={[styles.title, { color: colors.text }]}>Create New Post</Text>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Upload Media</Text>
        <TouchableOpacity style={[styles.imagePicker, { backgroundColor: colors.card }]} onPress={pickImage} disabled={imageUploading || loading}>
          {image ? (
            <Image source={{ uri: image.uri }} style={styles.imagePreview} resizeMode="contain" />
          ) : (
            <View style={styles.imagePickerContent}>
              <MaterialIcons name="camera-alt" size={48} color={colors.placeholder} />
              <Text style={[styles.imagePickerText, { color: colors.placeholder }]}>Pick an image</Text>
            </View>
          )}
        </TouchableOpacity>
       
        {image && (
          <TouchableOpacity onPress={() => setImage(null)} style={styles.removeImageBtn} disabled={loading}>
            <Text style={styles.removeImageText}>Remove Media</Text>
          </TouchableOpacity>
        )}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Add Details</Text>
        
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
          placeholder="Title *"
          placeholderTextColor={colors.placeholder}
          value={title}
          onChangeText={setTitle}
          editable={!loading}
        />
       
        <TextInput
          style={[styles.input, { height: 120, backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
          placeholder="Caption *"
          placeholderTextColor={colors.placeholder}
          value={caption}
          onChangeText={setCaption}
          editable={!loading}
          multiline
        />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Tags (max 3)</Text>
        <View style={styles.tagsRow}>
          <TextInput
            style={[styles.input, { flex: 1, paddingRight: 40, backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholder="Add Tags"
            placeholderTextColor={colors.placeholder}
            value={tagInput}
            onChangeText={setTagInput}
            editable={!loading && tags.length < 3}
          />
          <TouchableOpacity 
            onPress={handleAddTag} 
            disabled={!tagInput || tags.length >= 3 || loading} 
            style={styles.addTagIcon}
          >
            <MaterialIcons name="add" size={24} color={(!tagInput || tags.length >= 3 || loading) ? colors.placeholder : colors.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.tagsListRow}>
          {tags.map(tag => (
            <TouchableOpacity key={tag} style={styles.tagChip} onPress={() => handleDeleteTag(tag)}>
              <Text style={styles.tagText}>{tag} ✕</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Duration ({duration} hours)</Text>
        <View style={styles.sliderContainer}>
          <TouchableOpacity 
            style={[styles.sliderTrack, { backgroundColor: colors.border }]}
            onLayout={(event) => setSliderWidth(event.nativeEvent.layout.width)}
            onPress={handleSliderPress}
            activeOpacity={1}
          >
            <View style={[styles.sliderFill, { backgroundColor: colors.primary, width: `${(duration / 24) * 100}%` }]} />
            <View style={[styles.sliderThumb, { backgroundColor: colors.primary, left: `${Math.max(0, (duration / 24) * 100 - 5)}%` }]} />
          </TouchableOpacity>
          <View style={styles.sliderLabels}>
            <Text style={[styles.sliderLabel, { color: colors.placeholder }]}>1h</Text>
            <Text style={[styles.sliderLabel, { color: colors.placeholder }]}>24h</Text>
          </View>
        </View>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Location</Text>
        <Text style={[styles.label, { color: colors.placeholder }]}>(Auto detected location)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
          value={location ? `Lat: ${location.lat.toFixed(4)}, Lng: ${location.lng.toFixed(4)}` : locationLoading ? 'Fetching...' : 'Location not available'}
          editable={false}
        />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Anonymity</Text>
        <View style={styles.anonRow}>
          <Text style={[styles.anonLabel, { color: colors.placeholder }]}>Post Anonymously</Text>
          <Switch value={isAnonymous} onValueChange={setIsAnonymous} disabled={loading} />
        </View>
        {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}
        {statusMessage && <Text style={[styles.statusMessage, { color: colors.primary }]}>{statusMessage}</Text>}
        <TouchableOpacity 
          style={[styles.button, (!image || !title || !caption || !location || loading) && styles.buttonDisabled]} 
          onPress={handleSubmit} 
          disabled={!image || !title || !caption || !location || loading}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              {imageUploading && <ActivityIndicator color="#fff" size="small" style={styles.loadingSpinner} />}
              {verifying && <ActivityIndicator color="#fff" size="small" style={styles.loadingSpinner} />}
              <Text style={styles.buttonText}>
                {imageUploading ? 'Uploading Image...' : 
                 verifying ? 'Verifying Content...' : 
                 'Creating Post...'}
              </Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Create Post</Text>
          )}
        </TouchableOpacity>
        <View style={styles.bottomPadding} />
      </ScrollView>
      <FooterNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  title: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 16 },
  label: { color: '#ccc', fontSize: 15, marginTop: 10, marginBottom: 4 },
  input: { backgroundColor: '#232323', color: '#fff', borderRadius: 8, padding: 10, fontSize: 16, marginBottom: 8, borderWidth: 1, borderColor: '#333' },
  imagePicker: { 
    backgroundColor: '#232323', 
    borderRadius: 12, 
    height: 180, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 8,
    overflow: 'hidden',
  },
  imagePickerContent: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  imageContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
  },
  imagePickerText: { color: '#aaa', fontSize: 16 },
  imagePreview: { 
    width: '100%', 
    height: '100%', 
    borderRadius: 12,
    backgroundColor: '#000',
    flex: 1,
  },
  removeImageBtn: { alignSelf: 'flex-end', marginBottom: 8 },
  removeImageText: { color: '#e74c3c', fontSize: 14 },
  tagsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  addTagIcon: { position: 'absolute', right: 10, top: 10 },
  tagsListRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  tagChip: { backgroundColor: '#232323', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6, marginBottom: 4 },
  tagText: { color: '#4A6FFF', fontSize: 13 },
  durationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  durationBtn: { backgroundColor: '#232323', borderRadius: 8, padding: 8, marginHorizontal: 8 },
  durationBtnText: { color: '#4A6FFF', fontSize: 18, fontWeight: 'bold' },
  durationValue: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  anonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 12 },
  button: { backgroundColor: '#4A6FFF', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  buttonDisabled: { backgroundColor: '#888' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  error: { color: '#e74c3c', marginTop: 8, marginBottom: 8, textAlign: 'center' },
  statusMessage: { color: '#4A6FFF', marginTop: 8, marginBottom: 8, textAlign: 'center', fontSize: 14 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 20, marginBottom: 8 },
  sliderContainer: { height: 40, marginTop: 8, marginBottom: 8 },
  sliderTrack: {
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    position: 'relative',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#4A6FFF',
    borderRadius: 3,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  sliderThumb: {
    width: 20,
    height: 20,
    backgroundColor: '#4A6FFF',
    borderRadius: 10,
    position: 'absolute',
    top: -7,
    zIndex: 1,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sliderLabel: {
    color: '#aaa',
    fontSize: 12,
  },
  anonLabel: {
    color: '#ccc',
    fontSize: 15,
  },
  bottomPadding: { height: 100 }, // Added bottom padding
  debugText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingSpinner: {
    marginRight: 8,
  },
}); 