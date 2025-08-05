import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, Alert, ActivityIndicator, Image, TouchableOpacity } from 'react-native';
import { View, Text, Colors, Button, Picker, Checkbox } from 'react-native-ui-lib';
import { collection, doc, getDoc, addDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, createRoom } from '../../utils';
import { Icon, Input } from '../../components';
import * as ImagePicker from 'expo-image-picker';

const AddEditRoomScreen = ({ route, navigation }) => {
  const { roomId } = route.params || {};
  const isEditing = !!roomId;

  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    capacity: '',
    type: 'standard',
    status: 'available',
    amenities: [],
    images: []
  });

  const roomTypes = [
    { label: 'Standard', value: 'standard' },
    { label: 'Deluxe', value: 'deluxe' },
    { label: 'Suite', value: 'suite' },
    { label: 'Executive', value: 'executive' },
  ];

  const amenitiesList = [
    { label: 'WiFi', value: 'WiFi' },
    { label: 'TV', value: 'TV' },
    { label: 'Air Conditioning', value: 'Air Conditioning' },
    { label: 'Mini Bar', value: 'Mini Bar' },
    { label: 'Breakfast', value: 'Breakfast' },
    { label: 'Room Service', value: 'Room Service' },
    { label: 'Ocean View', value: 'Ocean View' },
    { label: 'Balcony', value: 'Balcony' },
  ];

  useEffect(() => {
    if (isEditing) {
      fetchRoomData();
    }
    
    // Request camera permissions
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access camera roll is required!');
      }
    })();
  }, [roomId]);

  const fetchRoomData = async () => {
    try {
      setLoading(true);
      const roomDoc = await getDoc(doc(db, 'rooms', roomId));
      
      if (roomDoc.exists()) {
        const roomData = roomDoc.data();
        setFormData({
          name: roomData.name || '',
          description: roomData.description || '',
          price: roomData.price ? roomData.price.toString() : '',
          capacity: roomData.capacity ? roomData.capacity.toString() : '2',
          type: roomData.type || 'standard',
          status: roomData.status || 'available',
          amenities: roomData.amenities || [],
          images: roomData.images || []
        });
      } else {
        Alert.alert('Error', 'Room not found');
        navigation.goBack();
      }
    } catch (error) {
      console.log('Error fetching room data:', error);
      Alert.alert('Error', 'Failed to load room data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const toggleAmenity = (amenity) => {
    setFormData(prev => {
      const amenities = [...prev.amenities];
      
      if (amenities.includes(amenity)) {
        return {
          ...prev,
          amenities: amenities.filter(item => item !== amenity)
        };
      } else {
        return {
          ...prev,
          amenities: [...amenities, amenity]
        };
      }
    });
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled) {
        uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.log('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const uploadImage = async (uri) => {
    try {
      setUploadingImage(true);
      
      // Convert URI to blob
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Generate a unique filename
      const filename = `room_${Date.now()}.jpg`;
      const storageRef = ref(storage, `rooms/${filename}`);
      
      // Upload to Firebase Storage
      await uploadBytes(storageRef, blob);
      
      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);
      
      // Add to form data
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, downloadURL]
      }));
      
      Alert.alert('Success', 'Image uploaded successfully');
    } catch (error) {
      console.log('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Room name is required');
      return false;
    }
    
    if (!formData.description.trim()) {
      Alert.alert('Error', 'Room description is required');
      return false;
    }
    
    if (!formData.price || isNaN(Number(formData.price)) || Number(formData.price) <= 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return false;
    }
    
    if (!formData.capacity || isNaN(Number(formData.capacity)) || Number(formData.capacity) <= 0) {
      Alert.alert('Error', 'Please enter a valid capacity');
      return false;
    }
    
    if (formData.images.length === 0) {
      Alert.alert('Error', 'Please add at least one room image');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    try {
      setLoading(true);
      
      const roomData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: Number(formData.price),
        capacity: Number(formData.capacity),
        type: formData.type,
        status: formData.status,
        amenities: formData.amenities,
        images: formData.images,
      };
      
      if (isEditing) {
        // Update existing room
        await updateDoc(doc(db, 'rooms', roomId), {
          ...roomData,
          updatedAt: new Date().toISOString()
        });
        Alert.alert('Success', 'Room updated successfully');
      } else {
        // Create new room
        const newRoom = createRoom(roomData);
        await addDoc(collection(db, 'rooms'), newRoom);
        Alert.alert('Success', 'Room added successfully');
      }
      
      navigation.goBack();
    } catch (error) {
      console.log('Error saving room:', error);
      Alert.alert('Error', `Failed to ${isEditing ? 'update' : 'add'} room. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

    if (loading && isEditing) {
        return (
            <View flex center>
                <ActivityIndicator size="large" color={Colors.blue} />
            </View>
        );
    }

    return (

        <View flex useSafeArea>
            <Text text50 marginT-60 marginL-16 marginB-16>{isEditing ? 'Edit Room' : 'Add New Room'}</Text>
            <ScrollView style={{ flex: 1, backgroundColor: Colors.bg2 }}>

                <Input 
                marginB-15
                value={formData.name}
                placeholder="Room Name"
                onChange={(text) => handleInputChange('name', text)}/>

                <Input
                marginB-15
                multiline
                maxLength={200}
                value={formData.description}
                placeholder="Room description"
                onChange={(text) => handleInputChange('description', text)}/>

                <Input
                marginB-15
                value={formData.price}
                placeholder="Price per Night"
                keyboardType="numeric"
                onChange={(text) => handleInputChange('price', text)}/>

                <Input
                marginB-15
                value={formData.capacity}
                placeholder="Capacity"
                keyboardType="numeric"
                onChange={(text) => handleInputChange('capacity', text)}/>

                <View width='100%' paddingH-26>

                    <Text text70 text1 marginB-10 style={{ fontWeight: 'bold' }}>Room Type</Text>
                    <Picker
                    value={formData.type}
                    onChange={(value) => handleInputChange('type', value)}
                    placeholder="Select room type"
                    marginB-15>
                        {roomTypes.map((item) => (
                            <Picker.Item key={item.value} value={item.value} label={item.label} />
                        ))}
                    </Picker>

                    <Text text70 text1 marginB-10 style={{ fontWeight: 'bold' }}>Status</Text>
                    <Picker
                        value={formData.status}
                        onChange={(value) => handleInputChange('status', value)}
                        placeholder="Select status"
                        marginB-15>
                        <Picker.Item value="available" label="Available" />
                        <Picker.Item value="maintenance" label="Maintenance" />
                    </Picker>
        
                    <Text text70 text1 marginB-10 style={{ fontWeight: 'bold' }}>Amenities</Text>
                    <View style={styles.amenitiesContainer} marginB-20>
                        {amenitiesList.map((amenity) => (
                        <View key={amenity.value} style={styles.amenityItem}>
                            <Checkbox
                            value={formData.amenities.includes(amenity.value)}
                            onValueChange={() => toggleAmenity(amenity.value)}
                            color={Colors.blue}
                            />
                            <Text text80 marginL-10>{amenity.label}</Text>
                        </View>
                        ))}
                    </View>

                    <Text text70 text1 marginB-10 style={{ fontWeight: 'bold' }}>Room Images</Text>
                    <View style={styles.imagesContainer} marginB-20>
                        {formData.images.map((image, index) => (
                            <View key={index} style={styles.imageContainer}>
                                <Image source={{ uri: image }} style={styles.image} />
                                <TouchableOpacity 
                                style={styles.removeImageBtn} 
                                onPress={() => removeImage(index)}>
                                    <Icon name="close-circle" type="ion" size={24} color={Colors.red} />
                                </TouchableOpacity>
                            </View>
                        ))}

                        <TouchableOpacity 
                        style={styles.addImageBtn} 
                        onPress={pickImage}
                        disabled={uploadingImage}>
                        {uploadingImage ? (
                            <ActivityIndicator size="small" color={Colors.blue} />
                        ) : (
                            <>
                                <Icon name="add-circle" type="ion" size={24} color={Colors.blue} />
                                <Text text80 color={Colors.blue} marginT-5>Add Image</Text>
                            </>
                        )}
                        </TouchableOpacity>
                    </View>
        
                    <Button
                    label={isEditing ? 'Update Room' : 'Add Room'}
                    backgroundColor={Colors.blue}
                    marginV-20
                    onPress={handleSubmit}
                    disabled={loading}/>

                </View>

            </ScrollView>

        </View>

    );

};

const styles = StyleSheet.create({
  halfInput: {
    width: '48%',
  },
  amenitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  amenityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    marginBottom: 10,
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  imageContainer: {
    width: 100,
    height: 100,
    margin: 5,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 12,
  },
  addImageBtn: {
    width: 100,
    height: 100,
    margin: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.blue,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AddEditRoomScreen;
