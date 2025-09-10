import React from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';

// Web-specific implementation
const WebMap = ({ region, markers = [], style, onRegionChange, userLocation }) => (
  <View style={[styles.webMapContainer, style]}>
    <Text style={styles.webMapText}>
      Map is not available in web preview
    </Text>
    {region && (
      <Text style={styles.webMapCoords}>
        {`Center: ${region.latitude.toFixed(4)}, ${region.longitude.toFixed(4)}`}
      </Text>
    )}
    {userLocation && (
      <Text style={styles.webMapCoords}>
        {`Your location: ${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}`}
      </Text>
    )}
    {markers.length > 0 && (
      <Text style={styles.webMapCoords}>
        {`${markers.length} ${markers.length === 1 ? 'marker' : 'markers'} visible`}
      </Text>
    )}
  </View>
);

// Native implementation
let NativeMap;
if (Platform.OS !== 'web') {
  try {
    const { default: MapView, Marker: MapMarker, PROVIDER_GOOGLE } = require('react-native-maps');
    NativeMap = ({ region, markers = [], style, onRegionChange, userLocation }) => (
      <MapView
        style={[styles.map, style]}
        provider={PROVIDER_GOOGLE}
        region={region}
        onRegionChange={onRegionChange}
        showsUserLocation={true}
        showsMyLocationButton={true}
        initialRegion={region}
      >
        {markers.map((marker, index) => (
          <MapMarker
            key={index}
            coordinate={marker.coordinate}
            title={marker.title}
            description={marker.description}
            onPress={marker.onPress}
          >
            {marker.children}
          </MapMarker>
        ))}
        
        {userLocation && (
          <MapMarker
            coordinate={userLocation}
            title="Your Location"
            pinColor="#4A6FFF"
          />
        )}
      </MapView>
    );
  } catch (error) {
    console.warn('Error loading react-native-maps:', error);
    NativeMap = WebMap; // Fallback to web version if native loading fails
  }
}

export default function Map({ 
  region, 
  markers = [], 
  style, 
  onRegionChange,
  showsUserLocation = true,
  userLocation = null
}) {
  // Use WebMap on web, NativeMap on native platforms
  const MapComponent = Platform.OS === 'web' ? WebMap : (NativeMap || WebMap);
  return (
    <MapComponent
      region={region}
      markers={markers}
      style={style}
      onRegionChange={onRegionChange}
      userLocation={userLocation}
      showsUserLocation={showsUserLocation}
    />
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  webMapContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  webMapText: {
    fontSize: 16,
    marginBottom: 8,
  },
  webMapCoords: {
    fontSize: 14,
    color: '#666',
  },
});
