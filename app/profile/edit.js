import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

export default function EditProfile() {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>{'< Back'}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Edit Profile</Text>
      {/* Add form fields for editing profile info here */}
      <Text style={styles.placeholder}>Profile editing form coming soon...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 24 },
  backBtn: { marginBottom: 16 },
  backText: { color: '#4A6FFF', fontSize: 16 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  placeholder: { color: '#aaa', fontSize: 16, marginTop: 32 },
}); 