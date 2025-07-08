import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, ActivityIndicator, Image, TextInput } from 'react-native';
import { auth, firestore, storage } from '../firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import HeaderBar from '../components/HeaderBar';
import FooterNav from '../components/FooterNav';
import { useTheme } from '../contexts/ThemeContext';

const anonymousAvatar = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';

export default function Settings() {
  const { darkMode, toggleTheme, colors } = useTheme();
  const [settings, setSettings] = useState({
    radius: '5',
    theme: 'dark'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(null);

  // Fetch user settings on component mount
  useEffect(() => {
    const fetchSettings = async () => {
      if (!auth.currentUser) {
        setLoading(false);
        return;
      }
      try {
        const userDocRef = doc(firestore, 'users', auth.currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log('Fetched user data:', userData);
          
          if (userData.settings) {
            console.log('Current settings:', userData.settings);
            setSettings(userData.settings);
          }
          
          // Set the current avatar URL from user data
          if (userData.photoURL) {
            setCurrentAvatarUrl(userData.photoURL);
          }
        }
        setLoading(false);
      } catch (err) {
        console.error('Error fetching settings:', err);
        setError('Failed to load settings.');
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // Save settings to Firestore whenever settings state changes
  useEffect(() => {
    if (!auth.currentUser || loading || uploadingAvatar) return;

    const saveSettings = async () => {
      setSaving(true);
      try {
        const userDocRef = doc(firestore, 'users', auth.currentUser.uid);
        await setDoc(userDocRef, { settings: settings }, { merge: true });
        setSaving(false);
      } catch (err) {
        console.error('Error saving settings:', err);
        setSaving(false);
      }
    };

    saveSettings();
  }, [settings, loading, uploadingAvatar]);

  const handleRadiusChange = (newRadius) => {
    setSettings((prev) => ({
      ...prev,
      radius: newRadius,
    }));
  };

  const pickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        // Check file size (5MB limit)
        if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
          setAvatarError('Image size should be less than 5MB');
          return;
        }

        setAvatarFile(asset);
        setAvatarPreviewUrl(asset.uri);
        setAvatarError(null);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      setAvatarError('Failed to pick image');
    }
  };

  const uploadAvatar = async () => {
    if (!avatarFile || !auth.currentUser) return;

    setUploadingAvatar(true);
    setAvatarError(null);

    try {
      // Convert image to blob
      const response = await fetch(avatarFile.uri);
      const blob = await response.blob();
      
      // Create a reference to the file location in Firebase Storage
      const fileExtension = avatarFile.uri.split('.').pop() || 'jpg';
      const fileName = `avatar.${fileExtension}`;
      const storageRef = ref(storage, `users/${auth.currentUser.uid}/profile/${fileName}`);
      
      // Upload the file
      const snapshot = await uploadBytes(storageRef, blob);
      
      // Get the download URL
      const avatarUrl = await getDownloadURL(snapshot.ref);

      // Update user document with the new photo URL
      const userDocRef = doc(firestore, 'users', auth.currentUser.uid);
      await setDoc(userDocRef, { photoURL: avatarUrl }, { merge: true });

      setCurrentAvatarUrl(avatarUrl);
      setAvatarFile(null);
      setAvatarPreviewUrl(null);
      setUploadingAvatar(false);

      Alert.alert('Success', 'Profile picture updated successfully!');

    } catch (err) {
      console.error('Error uploading avatar:', err);
      setAvatarError('Failed to upload avatar. Please try again.');
      setUploadingAvatar(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone. All your posts and data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete Account', 
          style: 'destructive',
          onPress: () => {
            // For now, just sign out and navigate to landing
            // In a real app, you'd implement account deletion logic
            auth.signOut();
            router.push('/');
          }
        }
      ]
    );
  };

  if (!auth.currentUser) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>Please sign in to manage settings.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading settings...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <HeaderBar />
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ padding: 16 }}>
        <Text style={[styles.title, { color: colors.text }]}>
          Settings {saving && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />}
        </Text>

        {/* Profile Picture Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Profile Picture</Text>
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: avatarPreviewUrl || currentAvatarUrl || anonymousAvatar }}
              style={[styles.avatar, { backgroundColor: colors.border }]}
            />
            <View style={styles.avatarActions}>
              <TouchableOpacity 
                style={[styles.button, { backgroundColor: colors.primary }]} 
                onPress={pickAvatar}
                disabled={uploadingAvatar || saving}
              >
                <Text style={[styles.buttonText, { color: styles.button.backgroundColor === colors.primary ? '#fff' : colors.text }]}>Change Picture</Text>
              </TouchableOpacity>
              
              {avatarFile && (
                <>
                  <TouchableOpacity 
                    style={[styles.button, styles.cancelButton, { backgroundColor: colors.secondary }]} 
                    onPress={() => {
                      setAvatarFile(null);
                      setAvatarPreviewUrl(null);
                    }}
                    disabled={uploadingAvatar || saving}
                  >
                    <Text style={[styles.cancelButtonText, { color: styles.cancelButton.backgroundColor === colors.secondary ? '#fff' : colors.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.button, styles.uploadButton, { backgroundColor: colors.success }]}
                    onPress={uploadAvatar}
                    disabled={uploadingAvatar || saving}
                  >
                    {uploadingAvatar ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={[styles.buttonText, { color: styles.button.backgroundColor === colors.success ? '#fff' : colors.text }]}>Upload</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
          {avatarError && (
            <Text style={[styles.errorText, { color: colors.error }]}>{avatarError}</Text>
          )}
        </View>

        {/* Appearance Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Dark Mode</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Switch between light and dark theme</Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={toggleTheme}
              disabled={saving}
              trackColor={colors.switchTrack}
              thumbColor={colors.switchThumb[darkMode ? 'true' : 'false']}
            />
          </View>
        </View>

        {/* Content Radius Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Content Radius</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Visible Content Radius</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Set the maximum distance (in kilometers) for posts in your feed and map view</Text>
            </View>
          </View>
          <View style={styles.radiusContainer}>
            {['1', '3', '5', '10', '20', '50'].map((radius) => (
              <TouchableOpacity
                key={radius}
                style={[
                  styles.radiusButton,
                  { backgroundColor: colors.border },
                  settings.radius === radius && { backgroundColor: colors.primary }
                ]}
                onPress={() => handleRadiusChange(radius)}
                disabled={saving}
              >
                <Text style={[
                  styles.radiusButtonText,
                  { color: colors.textSecondary },
                  settings.radius === radius && { color: '#fff', fontWeight: '600' }
                ]}>
                  {radius} km
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Danger Zone Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.error }]}>Danger Zone</Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.error }]}
            onPress={handleDeleteAccount}
            disabled={saving}
          >
            <Text style={[styles.dangerButtonText, { color: styles.button.backgroundColor === colors.error ? '#fff' : colors.text }]}>Delete Account</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
      <FooterNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center'
  },
  title: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    marginBottom: 24 
  },
  section: { 
    borderRadius: 12, 
    padding: 16, 
    marginBottom: 16 
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginBottom: 16 
  },
  avatarContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 16 
  },
  avatar: { 
    width: 80, 
    height: 80, 
    borderRadius: 40
  },
  avatarActions: { 
    flex: 1, 
    gap: 8 
  },
  settingRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    marginBottom: 8
  },
  settingInfo: { 
    flex: 1 
  },
  settingTitle: { 
    fontSize: 16, 
    fontWeight: '600' 
  },
  settingDescription: { 
    fontSize: 14, 
    marginTop: 2 
  },
  radiusContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 8, 
    marginTop: 8 
  },
  radiusButton: { 
    borderRadius: 8, 
    paddingHorizontal: 16, 
    paddingVertical: 8 
  },
  radiusButtonText: { 
    fontSize: 14 
  },
  button: { 
    borderRadius: 8, 
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    alignItems: 'center' 
  },
  buttonText: { 
    color: '#fff', 
    fontWeight: '600', 
    fontSize: 14 
  },
  cancelButton: { 
    backgroundColor: '#666' 
  },
  cancelButtonText: { 
    color: '#fff', 
    fontWeight: '600', 
    fontSize: 14 
  },
  uploadButton: { 
    backgroundColor: '#34C759' 
  },
  dangerButtonText: { 
    color: '#fff', 
    fontWeight: '600', 
    fontSize: 14 
  },
  errorText: { 
    fontSize: 14, 
    marginTop: 8 
  },
  loadingText: { 
    fontSize: 16, 
    marginTop: 16 
  },
  bottomPadding: { 
    height: 100 
  }
}); 