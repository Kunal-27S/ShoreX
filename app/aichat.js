import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, FlatList, StyleSheet, Alert, Image } from 'react-native';
import * as Location from 'expo-location';
import { auth } from '../firebaseConfig';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../contexts/ThemeContext';

const AI_IMAGE = require('../assets/images/onboarding/step3-3.png');
const API_BASE_URL = 'https://chatbot-g2plvgg63a-el.a.run.app'; // Same as web

function getStyles(colors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: 'bold',
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      marginRight: 10,
      backgroundColor: colors.background,
    },
    clearButton: {
      padding: 8,
    },
    clearButtonText: {
      color: colors.primary,
      fontSize: 14,
    },
    messagesContainer: {
      padding: 16,
      paddingBottom: 80,
    },
    bubble: {
      marginBottom: 0,
      padding: 12,
      maxWidth: '80%',
      alignSelf: 'flex-start',
      backgroundColor: colors.card,
    },
    userBubble: {
      backgroundColor: colors.primary,
      alignSelf: 'flex-end',
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 0,
    },
    botBubble: {
      backgroundColor: colors.card,
      alignSelf: 'flex-start',
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 16,
    },
    bubbleText: {
      color: colors.text,
      fontSize: 16,
    },
    timestamp: {
      color: colors.textSecondary,
      fontSize: 11,
      marginBottom: 2,
      textAlign: 'left',
    },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    input: {
      flex: 1,
      backgroundColor: colors.background,
      color: colors.text,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 16,
      marginRight: 8,
    },
    sendButton: {
      backgroundColor: colors.primary,
      borderRadius: 20,
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    sendButtonText: {
      color: colors.text,
      fontWeight: 'bold',
      fontSize: 16,
    },
    infoText: {
      color: colors.textTertiary,
      fontSize: 13,
      textAlign: 'center',
      marginVertical: 4,
    },
    errorText: {
      color: colors.error,
      fontSize: 13,
      textAlign: 'center',
      marginVertical: 4,
    },
    typingIndicatorContainer: {
      alignItems: 'flex-start',
      marginLeft: 16,
      marginBottom: 8,
    },
    typingIndicator: {
      fontSize: 16,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
  });
}

export default function AIChatScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [isLocationLoading, setIsLocationLoading] = useState(true);
  const [error, setError] = useState(null);
  const flatListRef = useRef(null);

  // Get user location on mount
  useEffect(() => {
    (async () => {
      setIsLocationLoading(true);
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setUserLocation({ latitude: 22.560768, longitude: 88.375296 }); // Default: Kolkata
          setMessages(prev => [...prev, { text: "I couldn't access your precise location, so I'm using Kolkata as the default location. Some location-based features might be limited. You can still ask me general questions!", sender: 'bot', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
        } else {
          let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
          setMessages(prev => [...prev, { text: "Hello! I can help you with weather information, maps, and general questions. Your location has been detected for better assistance.", sender: 'bot', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
        }
      } catch (e) {
        setUserLocation({ latitude: 22.560768, longitude: 88.375296 });
        setMessages(prev => [...prev, { text: "Geolocation is not supported or failed. Using Kolkata as default location. I can still help with general questions!", sender: 'bot', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      }
      setIsLocationLoading(false);
    })();
  }, []);

  // Load chat history after location is set
  useEffect(() => {
    if (userLocation && !isLocationLoading) {
      loadConversationHistory();
    }
  }, [userLocation, isLocationLoading]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  // Show 'Typing...' as a message bubble after user message
  useEffect(() => {
    if (isLoading) {
      // Add 'Typing...' bubble if not already present
      if (!messages.some(m => m.sender === 'bot' && m.text === 'Typing...')) {
        setMessages(prev => [...prev, { text: 'Typing...', sender: 'bot', timestamp: '' }]);
      }
    } else {
      // Remove 'Typing...' bubble if present
      if (messages.some(m => m.sender === 'bot' && m.text === 'Typing...')) {
        setMessages(prev => prev.filter(m => !(m.sender === 'bot' && m.text === 'Typing...')));
      }
    }
  }, [isLoading]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !userLocation || isLocationLoading) return;
    const userMsg = { text: inputMessage, sender: 'user', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        question: userMsg.text,
        lat: userLocation.latitude,
        long: userLocation.longitude,
      });
      if (auth.currentUser?.uid) params.append('user_id', auth.currentUser.uid);
      const response = await fetch(`${API_BASE_URL}/chat?${params.toString()}`, { method: 'POST' });
      if (!response.ok) throw new Error('Server error');
      const data = await response.json();
      if (data && data.response) {
        setMessages(prev => [...prev, { text: data.response, sender: 'bot', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (e) {
      setMessages(prev => [...prev, { text: `❌ ${e.message || 'An unexpected error occurred.'}`, sender: 'bot', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChatHistory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/user/history`, { method: 'DELETE', credentials: 'include' });
      if (!response.ok) throw new Error('Failed to clear history');
      setMessages([{ text: 'Chat history has been cleared. How can I help you today?', sender: 'bot', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    } catch (e) {
      setMessages(prev => [...prev, { text: '❌ Failed to clear chat history. Please try again.', sender: 'bot', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    }
  };

  const loadConversationHistory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/user/history`, { credentials: 'include' });
      if (!response.ok) return;
      const data = await response.json();
      if (data.status === 'success' && data.history) {
        const loaded = [];
        for (const entry of data.history) {
          if (entry.role === 'user') loaded.push({ text: entry.parts[0].text, sender: 'user', timestamp: 'Previous' });
          else if (entry.role === 'model') loaded.push({ text: entry.parts[0].text, sender: 'bot', timestamp: 'Previous' });
        }
        if (loaded.length > 0) {
          setMessages(prev => [
            ...loaded,
            { text: '--- Previous conversation loaded ---', sender: 'bot', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
            ...prev
          ]);
        }
      }
    } catch {}
  };

  const renderItem = ({ item }) => (
    <View style={{ marginBottom: 12, alignItems: item.sender === 'user' ? 'flex-end' : 'flex-start' }}>
      {item.timestamp ? (
        <Text style={styles.timestamp}>{item.timestamp}</Text>
      ) : null}
      <View style={[styles.bubble, item.sender === 'user' ? styles.userBubble : styles.botBubble]}>
        <Text style={[styles.bubbleText, item.sender === 'user' && { color: '#fff' }]}>{item.text}</Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image source={AI_IMAGE} style={styles.avatar} />
          <Text style={styles.headerTitle}>AI Assistant</Text>
        </View>
        <TouchableOpacity onPress={clearChatHistory} style={styles.clearButton}>
          <Icon name="trash-can-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={(_, i) => i.toString()}
        contentContainerStyle={styles.messagesContainer}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />
      {isLocationLoading && <Text style={styles.infoText}>📍 Getting your location...</Text>}
      {error && <Text style={styles.errorText}>{error}</Text>}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor={colors.placeholder}
          value={inputMessage}
          onChangeText={setInputMessage}
          onSubmitEditing={handleSendMessage}
          editable={!isLoading && !isLocationLoading}
        />
        <TouchableOpacity onPress={handleSendMessage} disabled={!inputMessage.trim() || isLoading || isLocationLoading} style={styles.sendButton}>
          <Text style={[styles.sendButtonText, { color: '#fff' }]}>Send</Text>
        </TouchableOpacity>
      </View>
      {userLocation && !isLocationLoading && (
        <Text style={styles.infoText}>📍 Location detected: {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}</Text>
      )}
    </KeyboardAvoidingView>
  );
} 