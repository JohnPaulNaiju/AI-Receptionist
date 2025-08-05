import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, Alert, TextInput, Dimensions } from 'react-native';
import { View, Text, Colors, Dialog, Button } from 'react-native-ui-lib';
import { collection, query, where, getDocs, doc, getDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../utils';
import { Icon } from '../../components';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { RefreshControl } from 'react-native';

const { width, height } = Dimensions.get('window');

const WishlistsScreen = () => {

    const navigation = useNavigation();
    const [wishlists, setWishlists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newWishlistName, setNewWishlistName] = useState('');

    const fetchWishlists = async () => {
        if (!auth.currentUser) {
            setWishlists([]);
            setLoading(false);
            setRefreshing(false);
            return;
        }

        try {
            setLoading(true);
            const wishlistsRef = collection(db, 'wishlists');
            const q = query(wishlistsRef, where('userId', '==', auth.currentUser.uid));
            const querySnapshot = await getDocs(q);

            const wishlistsData = [];
            for (const doc of querySnapshot.docs) {
                const wishlistData = { id: doc.id, ...doc.data() };
                
                // Get the count of rooms in this wishlist
                const roomsRef = collection(db, 'wishlist_items');
                const roomsQuery = query(roomsRef, where('wishlistId', '==', wishlistData.id));
                const roomsSnapshot = await getDocs(roomsQuery);
                
                wishlistsData.push({
                    ...wishlistData,
                    roomCount: roomsSnapshot.size
                });
            }

            setWishlists(wishlistsData);
        } catch (error) {
            console.log('Error fetching wishlists:', error);
            Alert.alert('Error', 'Failed to load wishlists');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchWishlists();
    };

    // Fetch wishlists when the screen comes into focus
    useFocusEffect(
        React.useCallback(() => {
            fetchWishlists();
            return () => {};
        }, [])
    );

    const handleCreateWishlist = async () => {
        if (!newWishlistName.trim()) {
            Alert.alert('Error', 'Please enter a wishlist name');
            return;
        }

        try {
            await addDoc(collection(db, 'wishlists'), {
                name: newWishlistName.trim(),
                userId: auth.currentUser.uid,
                createdAt: new Date().toISOString()
            });
            setNewWishlistName('');
            setShowCreateDialog(false);
            fetchWishlists();
        } catch (error) {
            console.log('Error creating wishlist:', error);
            Alert.alert('Error', 'Failed to create wishlist');
        }
    };

    const handleDeleteWishlist = async (wishlistId) => {
        Alert.alert(
            'Delete Wishlist',
            'Are you sure you want to delete this wishlist?',
            [
                { text: 'Cancel', style: 'cancel' },
                { 
                    text: 'Delete', 
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // Delete the wishlist
                            await deleteDoc(doc(db, 'wishlists', wishlistId));
                            
                            // Delete all items in the wishlist
                            const itemsRef = collection(db, 'wishlist_items');
                            const q = query(itemsRef, where('wishlistId', '==', wishlistId));
                            const querySnapshot = await getDocs(q);
                            
                            const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
                            await Promise.all(deletePromises);
                            
                            // Update the UI
                            setWishlists(wishlists.filter(item => item.id !== wishlistId));
                        } catch (error) {
                            console.log('Error deleting wishlist:', error);
                            Alert.alert('Error', 'Failed to delete wishlist');
                        }
                    }
                }
            ]
        );
    };

    const renderWishlistItem = ({ item }) => (
        <TouchableOpacity style={styles.wishlistCard} onPress={() => navigation.navigate('WishlistDetails', { wishlistId: item.id, wishlistName: item.name })}>
            <View style={styles.wishlistContent}>
                <View style={styles.wishlistHeader}>
                    <Text style={styles.wishlistTitle}>{item.name}</Text>
                    <TouchableOpacity 
                        onPress={() => handleDeleteWishlist(item.id)}
                        style={styles.deleteButton}
                    >
                        <Icon name="trash-outline" type="ion" size={20} color={Colors.red30} />
                    </TouchableOpacity>
                </View>
                <Text style={styles.wishlistCount}>{item.roomCount} {item.roomCount === 1 ? 'room' : 'rooms'}</Text>
                <Text style={styles.wishlistDate}>Created on {new Date(item.createdAt).toLocaleDateString()}</Text>
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
            <View style={styles.header}>
                <Text style={styles.headerTitle}>My Wishlists</Text>
                <TouchableOpacity style={styles.addButton} onPress={() => setShowCreateDialog(true)}>
                    <Icon name="add" type="ion" size={24} color={Colors.blue} />
                </TouchableOpacity>
            </View>

            <FlatList
            data={wishlists}
            keyExtractor={(item) => item.id}
            renderItem={renderWishlistItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    colors={[Colors.blue]}
                    tintColor={Colors.blue}/>
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Icon name="list" type="ion" size={50} color={Colors.grey50} />
                        <Text text70 grey30 center marginT-10>No wishlists yet</Text>
                        <TouchableOpacity 
                            style={styles.createButton}
                            onPress={() => setShowCreateDialog(true)}
                        >
                            <Text style={styles.createButtonText}>Create Wishlist</Text>
                        </TouchableOpacity>
                    </View>
                }/>

            <Dialog
            statusBarTranslucent
            width={width}
            height={height}
            visible={showCreateDialog}
            onDismiss={() => setShowCreateDialog(false)}>
                <View center width={width} height={height}>
                    <View bg-bg1 br50 width={width * 0.75} padding-16 height={height * 0.24}>
                        <Text style={styles.dialogTitle}>Create New Wishlist</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Wishlist Name"
                            value={newWishlistName}
                            onChangeText={setNewWishlistName}
                            autoFocus
                        />
                        <View style={styles.dialogButtons}>
                            <Button
                                label="Cancel"
                                link
                                color={Colors.grey30}
                                onPress={() => {
                                    setNewWishlistName('');
                                    setShowCreateDialog(false);
                                }}
                            />
                            <Button
                                label="Create"
                                bg-blue
                                style={styles.createDialogButton}
                                onPress={handleCreateWishlist}
                            />
                        </View>
                    </View>
                </View>
            </Dialog>
        </View>

    );

};

const styles = StyleSheet.create({
    container: {
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.white,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingBottom: 20,
    },
    wishlistCard: {
        backgroundColor: Colors.white,
        borderRadius: 12,
        marginBottom: 16,
        overflow: 'hidden',
    },
    wishlistContent: {
        padding: 16,
    },
    wishlistHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    wishlistTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        flex: 1,
        marginRight: 8,
    },
    wishlistCount: {
        fontSize: 14,
        color: Colors.blue,
        marginTop: 4,
    },
    wishlistDate: {
        fontSize: 12,
        color: Colors.grey30,
        marginTop: 4,
    },
    deleteButton: {
        padding: 4,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        marginTop: 40,
    },
    createButton: {
        marginTop: 20,
        backgroundColor: Colors.blue,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    createButtonText: {
        color: Colors.white,
        fontWeight: 'bold',
    },
    dialogTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    input: {
        borderWidth: 1,
        borderColor: Colors.grey50,
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
    },
    dialogButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    createDialogButton: {
        marginLeft: 16,
    },
});

export default WishlistsScreen;