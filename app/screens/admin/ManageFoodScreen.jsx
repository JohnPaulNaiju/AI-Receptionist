import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Alert, ToastAndroid, Image } from 'react-native';
import { View, Text, Colors, Card, Button, TouchableOpacity, TextField, Picker } from 'react-native-ui-lib';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { auth, db, storage, formatCurrency } from '../../utils';
import { Icon, Input } from '../../components';
import { useNavigation } from '@react-navigation/native';

const ManageFoodScreen = () => {

  const navigation = useNavigation();

  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);

  const cuisineOptions = [
    { label: 'Indian', value: 'Indian' },
    { label: 'Chinese', value: 'Chinese' },
    { label: 'Italian', value: 'Italian' },
    { label: 'Mexican', value: 'Mexican' },
    { label: 'Thai', value: 'Thai' },
    { label: 'Japanese', value: 'Japanese' },
    { label: 'Continental', value: 'Continental' },
    { label: 'Dessert', value: 'Dessert' },
    { label: 'Beverage', value: 'Beverage' },
  ];

  useEffect(() => {
    fetchFoods();
  }, []);

  const fetchFoods = async () => {
    try {
      setLoading(true);
      const foodsSnapshot = await getDocs(collection(db, 'foods'));
      const foodsList = foodsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setFoods(foodsList);
    } catch (error) {
      console.error('Error fetching foods:', error);
      Alert.alert('Error', 'Failed to load food items');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchFoods();
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadImage = async () => {
    if (!image) return null;
    
    try {
      setUploading(true);
      
      // Convert URI to blob
      const response = await fetch(image);
      const blob = await response.blob();
      
      // Create a reference to upload the file
      const fileName = `foods/${Date.now()}-${Math.random().toString(36).substring(2)}.png`;
      const imageRef = ref(storage, fileName);
      
      // Upload the blob
      await uploadBytes(imageRef, blob);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(imageRef);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const validateForm = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return false;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return false;
    }
    if (!price.trim() || isNaN(parseFloat(price))) {
      Alert.alert('Error', 'Please enter a valid price');
      return false;
    }
    if (!cuisine) {
      Alert.alert('Error', 'Please select a cuisine');
      return false;
    }
    if (!image) {
      Alert.alert('Error', 'Please select an image');
      return false;
    }
    return true;
  };

  const addFood = async () => {
    if (!validateForm()) return;
    
    try {
      setUploading(true);
      
      // Upload image and get URL
      const imageUrl = await uploadImage();
      if (!imageUrl) {
        Alert.alert('Error', 'Failed to upload image');
        return;
      }
      
      // Add food to Firestore
      const foodData = {
        name,
        description,
        price: parseFloat(price),
        cuisine,
        image: imageUrl,
        rating: 0,
        ratingCount: 0,
        createdAt: new Date().toISOString(),
      };
      
      await addDoc(collection(db, 'foods'), foodData);
      
      // Reset form
      setName('');
      setDescription('');
      setPrice('');
      setCuisine('');
      setImage(null);
      setShowAddForm(false);
      
      // Refresh food list
      fetchFoods();
      
      ToastAndroid.show('Food item added successfully', ToastAndroid.SHORT);
    } catch (error) {
      console.error('Error adding food:', error);
      Alert.alert('Error', 'Failed to add food item');
    } finally {
      setUploading(false);
    }
  };

  const deleteFood = async (foodId) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this food item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'foods', foodId));
              fetchFoods();
              ToastAndroid.show('Food item deleted successfully', ToastAndroid.SHORT);
            } catch (error) {
              console.error('Error deleting food:', error);
              Alert.alert('Error', 'Failed to delete food item');
            }
          }
        }
      ]
    );
  };

  const renderFoodItem = (food) => (
    <Card key={food.id} style={styles.foodCard} onPress={() => {}}>
      <View row spread>
        <View flex-3>
          <Text text60 $textDefault numberOfLines={1}>
            {food.name}
          </Text>
          <Text text80 $textDefault marginT-4 numberOfLines={2}>
            {food.description}
          </Text>
          <Text text70 $textDefault marginT-8 style={{color: Colors.blue}}>
            {formatCurrency(food.price)}
          </Text>
          <View row marginT-8>
            <Text text80 $textDefault marginR-4>
              Cuisine: {food.cuisine}
            </Text>
          </View>
        </View>
        <View flex-1 right>
          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={() => deleteFood(food.id)}
          >
            <Icon name="delete" size={20} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>
      {food.image && (
        <Image 
          source={{ uri: food.image }} 
          style={styles.foodImage} 
          resizeMode="cover"
        />
      )}
    </Card>
  );

  const renderAddForm = () => (
    <Card style={styles.formCard}>
      <Text text60 text1 margin-16>Add New Food Item</Text>

      <Input
      w='95%'
      marginT-8
      placeholder="Food Name"
      value={name}
      onChange={setName}/>
      
      <Input
      w='95%'
      marginT-8
       placeholder="Description"
       value={description}
       onChange={setDescription}
       multiline/>

      <Input
      w='95%'
      marginT-8
      placeholder="Price"
      value={price}
      onChange={setPrice}
      keyboardType="numeric"/>
      
      <Picker
      margin-22
      text70R blue
        placeholder="Select Cuisine"
        value={cuisine}
        style={[styles.input, { borderBottomWidth: 0 }]}
      >
        {cuisineOptions.map(option => (
          <Picker.Item key={option.value} value={option.value} label={option.label} onPress={(e) => setCuisine(option.value)}/>
        ))}
      </Picker>
      
      <Button 
      marginH-16
        label="Pick Image" 
        outline
        outlineColor={Colors.blue}
        onPress={pickImage}
        style={styles.button}
      />
      
      {image && (
        <Image 
          source={{ uri: image }} 
          style={[styles.previewImage, { marginHorizontal: 16}]} 
          resizeMode="cover"
        />
      )}
      
      {uploading ? 
      <View center margin-16>
        <ActivityIndicator size="large" color={Colors.blue} />
      </View> :
      <View row spread margin-16>
        <Button 
          label="Cancel" 
          outline
          outlineColor={Colors.red30}
          onPress={() => {
            setShowAddForm(false);
            setName('');
            setDescription('');
            setPrice('');
            setCuisine('');
            setImage(null);
          }}
          style={[styles.button, styles.cancelButton]}
        />
        <Button 
          label="Add Food" 
          backgroundColor={Colors.blue}
          onPress={addFood}
          disabled={uploading}
          style={styles.button}
        />
      </View>}
    </Card>
  );

  return (
    <View flex bg-bg2>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View row spread marginB-16 paddingT-26>
          <Text text50 $textDefault>Food Menu</Text>
          {!showAddForm && (
            <Button 
            bg-blue white
              label="Add Food" 
              backgroundColor={Colors.blue}
              onPress={() => setShowAddForm(true)}
            />
          )}
        </View>
        
        {showAddForm && renderAddForm()}
        
        {loading ? (
          <ActivityIndicator size="large" color={Colors.blue} />
        ) : (
          <View>
            {foods.length === 0 ? (
              <Text text70 $textDefault center marginT-50>
                No food items available. Add some!
              </Text>
            ) : (
              foods.map(food => renderFoodItem(food))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 100,
  },
  foodCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 8,
  },
  foodImage: {
    height: 150,
    borderRadius: 8,
    marginTop: 12,
  },
  formCard: {
    marginBottom: 24,
    borderRadius: 8,
  },
  input: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderColor: Colors.grey50,
  },
  button: {
    minWidth: 120,
  },
  cancelButton: {
    marginRight: 12,
  },
  previewImage: {
    height: 150,
    borderRadius: 8,
    marginTop: 12,
  },
  deleteButton: {
    backgroundColor: Colors.red,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ManageFoodScreen;
