import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { View, Text, Colors, Button, Card } from 'react-native-ui-lib';
import { collection, query, orderBy, getDocs, doc, updateDoc, getDoc, addDoc, where, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../utils';
import { Image } from 'expo-image';
import { Icon } from '../../components';
import Toast from 'react-native-toast-message';

const FoodScreen = () => {

    const [foods, setFoods] = useState([]);
    const [myOrders, setMyOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTab, setSelectedTab] = useState(0);

    useEffect(() => {
        fetchFoods();
        fetchMyOrders();
    }, []);

    const fetchFoods = async () => {
        try {
            const foodsRef = collection(db, 'foods');
            const q = query(foodsRef, orderBy('rating', 'desc'));
            const querySnapshot = await getDocs(q);
            
            const foodsList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            setFoods(foodsList);
        } catch (error) {
            console.error('Error fetching foods:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMyOrders = async () => {
        try {
            const ordersRef = collection(db, 'orders');
            const q = query(ordersRef, 
                where('userId', '==', auth.currentUser.uid),
                orderBy('orderedAt', 'desc')
            );
            const querySnapshot = await getDocs(q);
            
            const ordersList = [];
            for (const orderDoc of querySnapshot.docs) {
                const orderData = orderDoc.data();
                const foodRef = doc(db, 'foods', orderData.foodId);
                const foodDoc = await getDoc(foodRef);
                if (foodDoc.exists()) {
                    ordersList.push({
                        id: orderDoc.id,
                        ...orderData,
                        food: { id: foodDoc.id, ...foodDoc.data() }
                    });
                }
            }
            
            setMyOrders(ordersList);
        } catch (error) {
            console.error('Error fetching orders:', error);
        }
    };

    const handleOrder = async (food) => {
        try {
            const orderData = {
                userId: auth.currentUser.uid,
                foodId: food.id,
                orderedAt: new Date().toISOString(),
                status: 'pending'
            };

            await addDoc(collection(db, 'orders'), orderData);
            Toast.show({
                type: 'success',
                text1: 'Food ordered successfully!'
            });
            fetchMyOrders(); // Refresh orders list
        } catch (error) {
            console.error('Error placing order:', error);
            Toast.show({
                type: 'error',
                text1: 'Failed to place order'
            });
        }
    };

    const handleDeleteOrder = async (orderId) => {
        try {
            await deleteDoc(doc(db, 'orders', orderId));
            Toast.show({
                type: 'success',
                text1: 'Order deleted successfully'
            });
            fetchMyOrders(); // Refresh orders list
        } catch (error) {
            console.error('Error deleting order:', error);
            Toast.show({
                type: 'error',
                text1: 'Failed to delete order'
            });
        }
    };

    const handleRating = async (foodId, newRating) => {
        try {
            const foodRef = doc(db, 'foods', foodId);
            const foodDoc = await getDoc(foodRef);
            const foodData = foodDoc.data();
            
            // Calculate new rating
            const newRatingCount = foodData.ratingCount + 1;
            const newAverageRating = ((foodData.rating * foodData.ratingCount) + newRating) / newRatingCount;
            
            // Update in Firebase
            await updateDoc(foodRef, {
                rating: newAverageRating,
                ratingCount: newRatingCount
            });
            
            // Update local state
            setFoods(prevFoods => 
                prevFoods.map(food => 
                    food.id === foodId 
                        ? {...food, rating: newAverageRating, ratingCount: newRatingCount}
                        : food
                )
            );
        } catch (error) {
            console.error('Error updating rating:', error);
        }
    };

    const renderStars = (rating) => {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            stars.push(
                <TouchableOpacity key={i} onPress={() => handleRating(item.id, i)}>
                    <Icon 
                        name={i <= rating ? 'star' : 'star-outline'} 
                        type="ion" 
                        size={20} 
                        color={i <= rating ? Colors.yellow30 : Colors.grey30} 
                    />
                </TouchableOpacity>
            );
        }
        return stars;
    };

    const renderOrderItem = ({ item }) => (
        <Card flex marginB-10 padding-10>
            <View row>
                <Image
                    source={{ uri: item.food?.image || 'https://via.placeholder.com/300x200' }}
                    style={styles.orderImage}
                    contentFit="cover"
                />
                <View flex padding-10>
                    <View row spread>
                        <Text text65 color={Colors.text1}>{item.food?.name}</Text>
                        <TouchableOpacity onPress={() => handleDeleteOrder(item.id)}>
                            <Icon name="trash-2" type='feather' size={20} color={Colors.red30} />
                        </TouchableOpacity>
                    </View>
                    <Text text80 color={Colors.text2}>Ordered on: {new Date(item.orderedAt).toLocaleDateString()}</Text>
                    <Text text80 color={Colors.text2}>Status: {item.status}</Text>
                    <View row centerV>
                        <View row>{renderStars(item.food?.rating || 0)}</View>
                        <Text text90 marginL-10>({item.food?.ratingCount || 0} ratings)</Text>
                    </View>
                </View>
            </View>
        </Card>
    );

    const renderFoodItem = ({ item }) => (
        <Card flex marginB-10 padding-10>
            <Image
                source={{ uri: item?.image || 'https://via.placeholder.com/300x200' }}
                style={styles.foodImage}
                contentFit="cover"
            />
            <View padding-10>
                <Text text65 color={Colors.text1}>{item?.name}</Text>
                <Text text80 color={Colors.text2}>{item?.description}</Text>
                <Text text80 color={Colors.text2}>Cuisine: {item?.cuisine}</Text>
                <Text text80 color={Colors.text2}>Price: ₹{item?.price}</Text>
                <View row centerV spread marginT-10>
                    <View row centerV>
                        <View row>{renderStars(item?.rating || 0)}</View>
                        <Text text90 marginL-10>({item?.ratingCount || 0} ratings)</Text>
                    </View>
                    <Button 
                        label="Order"
                        size={Button.sizes.small}
                        backgroundColor={Colors.blue}
                        onPress={() => handleOrder(item)}
                    />
                </View>
            </View>
        </Card>
    );

    if (loading) {
        return (
            <View flex center>
                <ActivityIndicator size="large" color={Colors.blue} />
            </View>
        );
    }

    return (
        <View flex bg-bg2 useSafeArea paddingT-46>
            <View row spread paddingV-10 paddingH-20 backgroundColor={Colors.bg2}>
                <TouchableOpacity 
                    style={[styles.tab, selectedTab === 0 && styles.activeTab]} 
                    onPress={() => setSelectedTab(0)}
                >
                    <Text style={[styles.tabText, selectedTab === 0 && styles.activeTabText]}>Recommendations</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.tab, selectedTab === 1 && styles.activeTab]}
                    onPress={() => setSelectedTab(1)}
                >
                    <Text style={[styles.tabText, selectedTab === 1 && styles.activeTabText]}>My Orders</Text>
                </TouchableOpacity>
            </View>
            <View flex>
                {selectedTab === 0 ? (
                    <FlatList
                        data={foods}
                        renderItem={renderFoodItem}
                        keyExtractor={(item, index) => index.toString()}
                        contentContainerStyle={styles.listContainer}
                    />
                ) : (
                    myOrders.length > 0 ? (
                        <FlatList
                            data={myOrders}
                            renderItem={renderOrderItem}
                            keyExtractor={(item, index) => index.toString()}
                            contentContainerStyle={styles.listContainer}
                        />
                    ) : (
                        <View flex center padding-20>
                            <Icon name="shopping-bag" size={60} color={Colors.grey50} />
                            <Text text60 marginT-20 color={Colors.text2}>No orders yet</Text>
                            <Text text80 marginT-10 center color={Colors.text3}>
                                Your ordered food items will appear here.
                                Browse recommendations and place an order!
                            </Text>
                            <Button
                                label="Browse Recommendations"
                                marginT-30
                                backgroundColor={Colors.blue}
                                onPress={() => setSelectedTab(0)}
                            />
                        </View>
                    )
                )}
            </View>
            <Toast />
        </View>
    );
};

const styles = StyleSheet.create({
    listContainer: {
        padding: 16,
    },
    foodImage: {
        width: '100%',
        height: 200,
        borderRadius: 8,
    },
    orderImage: {
        width: 100,
        height: 100,
        borderRadius: 8,
    },
    tab: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
    },
    activeTab: {
        backgroundColor: Colors.blue,
    },
    tabText: {
        color: Colors.text2,
        fontSize: 16,
    },
    activeTabText: {
        color: Colors.white,
    },
});

export default FoodScreen;
