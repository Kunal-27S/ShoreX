 import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function NotificationDetail() {
  const { notificationId } = useLocalSearchParams();
  
  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: '#121212' }}>
      <Text style={{ color: 'white', fontSize: 18 }}>Notification ID: {notificationId}</Text>
      {/* Add your notification details here */}
    </View>
  );
}