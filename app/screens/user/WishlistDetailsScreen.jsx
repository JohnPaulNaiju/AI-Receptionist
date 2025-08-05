import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { View, Text, Colors } from 'react-native-ui-lib';
import { collection, query, where, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../utils';
import { Icon } from '../../components';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { RefreshControl } from 'react-native';

const WishlistDetailsScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { wishlistId, wishlistName } = route.params;

    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchWishlistItems = async () => {
        try {
            setLoading(true);
            const itemsRef = collection(db, 'wishlist_items');
            const q = query(itemsRef, where('wishlistId', '==', wishlistId));
            const querySnapshot = await getDocs(q);

            const roomsData = [];
            const roomPromises = querySnapshot.docs.map(async (docSnapshot) => {
                const itemData = { id: docSnapshot.id, ...docSnapshot.data() };
                const roomDocRef = doc(db, 'rooms', itemData.roomId);
                const roomDoc = await getDoc(roomDocRef);
                if (roomDoc.exists()) {
                    roomsData.push({
                        wishlistItemId: itemData.id,
                        ...roomDoc.data(),
                        id: roomDoc.id
                    });
                }
            });

            await Promise.all(roomPromises);
            setRooms(roomsData);
        } catch (error) {
            console.log('Error fetching wishlist items:', error);
            Alert.alert('Error', 'Failed to load wishlist items');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchWishlistItems();
    };

    // Set the header title when the component mounts
    useEffect(() => {
        navigation.setOptions({
            title: wishlistName
        });
    }, [wishlistName]);

    // Fetch wishlist items when the screen comes into focus
    useFocusEffect(
        React.useCallback(() => {
            fetchWishlistItems();
            return () => {};
        }, [wishlistId])
    );

    const handleRemoveFromWishlist = async (wishlistItemId) => {
        try {
            await deleteDoc(doc(db, 'wishlist_items', wishlistItemId));
            setRooms(rooms.filter(item => item.wishlistItemId !== wishlistItemId));
        } catch (error) {
            console.log('Error removing from wishlist:', error);
            Alert.alert('Error', 'Failed to remove from wishlist');
        }
    };

    const renderRoomItem = ({ item }) => (
        <TouchableOpacity 
            style={styles.roomCard}
            onPress={() => navigation.navigate('RoomDetails', { roomId: item.id })}
        >
            <Image 
                source={{ uri: item.images && item.images.length > 0 ? item.images[0] : 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1074&q=80' }}
                style={styles.roomImage}
                resizeMode="cover"
            />
            <View style={styles.roomContent}>
                <View style={styles.roomHeader}>
                    <Text style={styles.roomTitle}>{item.name}</Text>
                    <TouchableOpacity 
                        onPress={() => handleRemoveFromWishlist(item.wishlistItemId)}
                        style={styles.removeButton}
                    >
                        <Icon name="close-circle" type="ion" size={20} color={Colors.red30} />
                    </TouchableOpacity>
                </View>
                <Text style={styles.roomType}>{item.type}, {item.location || 'Various Locations'}</Text>
                <View style={styles.roomFooter}>
                    <Text style={styles.roomPrice}>${item.price}<Text style={styles.perNightText}>/night</Text></Text>
                    <View style={styles.capacityContainer}>
                        <Icon name="people" type="ion" size={16} color={Colors.grey30} />
                        <Text style={styles.capacityText}>{item.capacity}</Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );

    if (loading && !refreshing) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.blue} />
            </View>
        );
    }

    return (
        <View flex bg-bg2 useSafeArea style={styles.container}>
            <FlatList
                data={rooms}
                keyExtractor={(item) => item.wishlistItemId}
                renderItem={renderRoomItem}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[Colors.blue]}
                        tintColor={Colors.blue}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Icon name="bed" type="ion" size={50} color={Colors.grey50} />
                        <Text text70 grey30 center marginT-10>No rooms in this wishlist</Text>
                        <TouchableOpacity 
                            style={styles.browseButton}
                            onPress={() => navigation.navigate('MainTabs', { screen: 'UserHome' })}>
                            <Text style={styles.browseButtonText}>Browse Rooms</Text>
                        </TouchableOpacity>
                    </View>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingBottom: 20,
    },
    roomCard: {
        flexDirection: 'row',
        backgroundColor: Colors.white,
        borderRadius: 12,
        marginBottom: 16,
        overflow: 'hidden',
    },
    roomImage: {
        width: 100,
        height: 100,
    },
    roomContent: {
        flex: 1,
        padding: 12,
    },
    roomHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    roomTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        flex: 1,
        marginRight: 8,
    },
    roomType: {
        fontSize: 14,
        color: Colors.grey30,
        marginTop: 4,
    },
    roomFooter: {
        marginTop: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    roomPrice: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.blue,
    },
    perNightText: {
        fontWeight: 'normal',
        fontSize: 12,
        color: Colors.grey30,
    },
    capacityContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    capacityText: {
        fontSize: 14,
        color: Colors.grey30,
        marginLeft: 4,
    },
    removeButton: {
        padding: 4,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        marginTop: 40,
    },
    browseButton: {
        marginTop: 20,
        backgroundColor: Colors.blue,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    browseButtonText: {
        color: Colors.white,
        fontWeight: 'bold',
    },
});

export default WishlistDetailsScreen;
