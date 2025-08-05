import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { View, Text, Colors } from 'react-native-ui-lib';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../utils';
import { Icon } from '../../components';
import { toggleFavorite } from '../../utils/models';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { RefreshControl } from 'react-native';

const BookmarksScreen = () => {
    const navigation = useNavigation();
    const [favorites, setFavorites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchFavorites = async () => {
        if (!auth.currentUser) {
            setFavorites([]);
            setLoading(false);
            setRefreshing(false);
            return;
        }

        try {
            setLoading(true);
            const favoritesRef = collection(db, 'favorites');
            const q = query(favoritesRef, where('userId', '==', auth.currentUser.uid));
            const querySnapshot = await getDocs(q);

            const favoritesData = [];
            const roomPromises = querySnapshot.docs.map(async (docSnapshot) => {
                const favoriteData = { id: docSnapshot.id, ...docSnapshot.data() };
                const roomDocRef = doc(db, 'rooms', favoriteData.roomId);
                const roomDoc = await getDoc(roomDocRef);
                if (roomDoc.exists()) {
                    favoritesData.push({
                        favoriteId: favoriteData.id,
                        ...roomDoc.data(),
                        id: roomDoc.id
                    });
                }
            });

            await Promise.all(roomPromises);
            setFavorites(favoritesData);
        } catch (error) {
            console.log('Error fetching favorites:', error);
            Alert.alert('Error', 'Failed to load favorites');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchFavorites();
    };

    // Fetch favorites when the screen comes into focus
    useFocusEffect(
        React.useCallback(() => {
            fetchFavorites();
            return () => {};
        }, [])
    );

    const handleRemoveFavorite = async (roomId, favoriteId) => {
        try {
            await toggleFavorite(db, auth.currentUser.uid, roomId);
            setFavorites(favorites.filter(item => item.favoriteId !== favoriteId));
        } catch (error) {
            console.log('Error removing favorite:', error);
            Alert.alert('Error', 'Failed to remove from favorites');
        }
    };

    const renderFavoriteItem = ({ item }) => (
        <TouchableOpacity 
            style={styles.favoriteCard}
            onPress={() => navigation.navigate('RoomDetails', { roomId: item.id })}
        >
            <Image 
                source={{ uri: item.images && item.images.length > 0 ? item.images[0] : 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1074&q=80' }}
                style={styles.favoriteImage}
                resizeMode="cover"
            />
            <View style={styles.favoriteContent}>
                <View style={styles.favoriteHeader}>
                    <Text style={styles.favoriteTitle}>{item.name}</Text>
                    <TouchableOpacity 
                        onPress={() => handleRemoveFavorite(item.id, item.favoriteId)}
                        style={styles.removeButton}
                    >
                        <Icon name="heart" type="ion" size={20} color={Colors.red30} />
                    </TouchableOpacity>
                </View>
                <Text style={styles.favoriteType}>{item.type}, {item.location || 'Various Locations'}</Text>
                <View style={styles.favoriteFooter}>
                    <Text style={styles.favoritePrice}>${item.price}<Text style={styles.perNightText}>/night</Text></Text>
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

            <View flex bg-bg2 useSafeArea paddingT-46 style={styles.container}>
                <FlatList
                    data={favorites}
                    keyExtractor={(item) => item.favoriteId}
                    renderItem={renderFavoriteItem}
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
                            <Icon name="heart" type="ion" size={50} color={Colors.grey50} />
                            <Text text70 grey30 center marginT-10>No favorites yet</Text>
                            <TouchableOpacity 
                                style={styles.browseButton}
                                onPress={() => navigation.navigate('MainTabs', { screen: 'UserHome' })}
                            >
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
    favoriteCard: {
        flexDirection: 'row',
        backgroundColor: Colors.white,
        borderRadius: 12,
        marginBottom: 16,
        overflow: 'hidden',
    },
    favoriteImage: {
        width: 100,
        height: '100%',
    },
    favoriteContent: {
        flex: 1,
        padding: 12,
    },
    favoriteHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    favoriteTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        flex: 1,
        marginRight: 8,
    },
    favoriteType: {
        fontSize: 14,
        color: Colors.grey30,
        marginTop: 4,
    },
    favoriteFooter: {
        marginTop: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    favoritePrice: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.blue,
    },
    perNightText: {
        fontWeight: 'normal',
        fontSize: 12,
        color: Colors.grey30,
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

export default BookmarksScreen;
