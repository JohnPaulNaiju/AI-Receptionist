import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Dimensions, Alert, Platform, Modal } from 'react-native';
import { View, Text, Colors, Button, Card } from 'react-native-ui-lib';
import { doc, getDoc, collection, addDoc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../../utils';
import { calculateTotalPrice, toggleFavorite, isRoomFavorited, addToWishlist } from '../../utils/models';
import { Icon } from '../../components';
import { useRoute, useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';

const { width } = Dimensions.get('window');

const RoomDetailsScreen = () => {

    const route = useRoute();
    const navigation = useNavigation();

    const { roomId } = route.params;

    const [room, setRoom] = useState(null);
    const [loading, setLoading] = useState(true);
    const [checkInDate, setCheckInDate] = useState(new Date());
    const [checkOutDate, setCheckOutDate] = useState(new Date(Date.now() + 86400000));
    const [totalPrice, setTotalPrice] = useState(0);
    const [guestCount, setGuestCount] = useState(1);
    const [bookingLoading, setBookingLoading] = useState(false);
    const [isFavorite, setIsFavorite] = useState(false);
    const [favoriteLoading, setFavoriteLoading] = useState(false);
    
    // Wishlist state
    const [showWishlistModal, setShowWishlistModal] = useState(false);
    const [wishlists, setWishlists] = useState([]);
    const [wishlistLoading, setWishlistLoading] = useState(false);
    
    // Date picker state
    const [showCheckInPicker, setShowCheckInPicker] = useState(false);
    const [showCheckOutPicker, setShowCheckOutPicker] = useState(false);

    useEffect(() => {
        const fetchRoomDetails = async () => {
            try {
                setLoading(true);
                const roomDoc = await getDoc(doc(db, 'rooms', roomId));
                if(roomDoc.exists()) {
                    setRoom({ id: roomDoc.id, ...roomDoc.data() });
                    
                    // Check if room is favorited by the user
                    if (auth.currentUser) {
                        const favorited = await isRoomFavorited(db, auth.currentUser.uid, roomId);
                        setIsFavorite(favorited);
                    }
                } else {
                    Alert.alert('Error', 'Room not found');
                    navigation.goBack();
                }
            }catch (error){
                console.log('Error fetching room details:', error);
                Alert.alert('Error', 'Failed to load room details');
            }finally{
                setLoading(false);
            }
        };
        fetchRoomDetails();
    }, [roomId]);

    useEffect(() => {
        if (room) {
            const price = calculateTotalPrice(checkInDate, checkOutDate, room.price, guestCount);
            setTotalPrice(price);
        }
    }, [checkInDate, checkOutDate, room, guestCount]);

    const handleBookNow = async () => {
        if(!auth.currentUser){
            Alert.alert('Error', 'You must be logged in to book a room');
            return;
        }
        if (checkInDate >= checkOutDate) {
            Alert.alert('Invalid Dates', 'Check-out date must be after check-in date');
            return;
        }
        if (guestCount > room.capacity) {
            Alert.alert('Too Many Guests', `This room can only accommodate ${room.capacity} guests`);
            return;
        }
        try {
            setBookingLoading(true);
            const bookingRef = await addDoc(collection(db, 'bookings'), {
                userId: auth.currentUser.uid,
                roomId: room.id,
                roomName: room.name,
                checkInDate: checkInDate.toISOString(),
                checkOutDate: checkOutDate.toISOString(),
                totalPrice,
                guestCount,
                status: 'pending',
                paymentStatus: 'pending',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            await updateDoc(doc(db, 'rooms', room.id), {
                status: 'booked',
                updatedAt: new Date().toISOString(),
            });

            Alert.alert(
                'Booking Successful',
                'Your booking has been created and is pending confirmation.',
                [{ text: 'OK', onPress: () => navigation.navigate('MainTabs', { screen: 'Bookings' }) }]
            );
        }catch(error){
            console.log('Error creating booking:', error);
            Alert.alert('Error', 'Failed to create booking. Please try again.');
        }finally{
            setBookingLoading(false);
        }
    };

    const decrementGuests = () => {
        if (guestCount > 1) {
            setGuestCount(guestCount - 1);
        }
    };

    const incrementGuests = () => {
        if (room && guestCount < room.capacity) {
            setGuestCount(guestCount + 1);
        }
    };

    const fetchWishlists = async () => {
        if (!auth.currentUser) {
            setWishlists([]);
            return;
        }

        try {
            setWishlistLoading(true);
            const wishlistsRef = collection(db, 'wishlists');
            const q = query(wishlistsRef, where('userId', '==', auth.currentUser.uid));
            const querySnapshot = await getDocs(q);

            const wishlistsData = [];
            querySnapshot.forEach(doc => {
                wishlistsData.push({ id: doc.id, ...doc.data() });
            });

            setWishlists(wishlistsData);
        } catch (error) {
            console.log('Error fetching wishlists:', error);
            Alert.alert('Error', 'Failed to load wishlists');
        } finally {
            setWishlistLoading(false);
        }
    };

    const handleAddToWishlist = async (wishlistId) => {
        if (!auth.currentUser) {
            Alert.alert('Sign In Required', 'Please sign in to add to wishlist');
            return;
        }

        try {
            const result = await addToWishlist(db, wishlistId, roomId);
            if (result.status === 'added') {
                Alert.alert('Success', 'Added to wishlist');
            } else if (result.status === 'exists') {
                Alert.alert('Info', 'This room is already in this wishlist');
            } else {
                Alert.alert('Error', result.message);
            }
            setShowWishlistModal(false);
        } catch (error) {
            console.log('Error adding to wishlist:', error);
            Alert.alert('Error', 'Failed to add to wishlist');
        }
    };

    const handleToggleFavorite = async () => {
        if (!auth.currentUser) {
            Alert.alert('Sign In Required', 'Please sign in to save favorites');
            return;
        }

        try {
            setFavoriteLoading(true);
            const result = await toggleFavorite(db, auth.currentUser.uid, roomId);
            setIsFavorite(result.status === 'added');
            Alert.alert('Success', result.message);
        } catch (error) {
            console.log('Error toggling favorite:', error);
            Alert.alert('Error', 'Failed to update favorites');
        } finally {
            setFavoriteLoading(false);
        }
    };

    const handleOpenWishlistModal = () => {
        fetchWishlists();
        setShowWishlistModal(true);
    };

    if(loading){
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.blue} />
            </View>
        );
    }

    return (

        <View flex useSafeArea bg-bg2>
            <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

                {room.images && room.images.length > 0 ? (
                    <View style={styles.carousel}>
                        <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        style={{ width: '100%' }}>
                            {room.images.map((image, index) => (
                                <View key={`room-image-${index}`} style={{width: Dimensions.get('window').width}}>
                                    <Image 
                                    source={{ uri: image }}
                                    style={styles.carouselImage}
                                    resizeMode="cover"/>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                ) : (
                    <Image 
                    source={{ uri: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1074&q=80' }}
                    style={styles.carouselImage}
                    resizeMode="cover"/>
                )}

                <View style={styles.content}>
                    <View row spread centerV marginB-10>
                        <Text text50 bold style={{flex: 1}}>{room.name}</Text>
                        <View row>
                            <TouchableOpacity 
                                onPress={handleOpenWishlistModal}
                                style={[styles.favoriteButton, {marginRight: 10}]}
                            >
                                <Icon 
                                    name='list' 
                                    type='ion' 
                                    size={22} 
                                    color={Colors.blue} 
                                />
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={handleToggleFavorite}
                                disabled={favoriteLoading}
                                style={styles.favoriteButton}
                            >
                                {favoriteLoading ? (
                                    <ActivityIndicator size='small' color={Colors.blue} />
                                ) : (
                                    <Icon 
                                        name={isFavorite ? 'heart' : 'heart-outline'} 
                                        type='ion' 
                                        size={24} 
                                        color={isFavorite ? Colors.red30 : Colors.grey30} 
                                    />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                    <Text text70R text2 marginB-20>{room.description}</Text>

                    <View row spread marginB-20>
                        <View row centerV>
                            <Icon name="cash" type="ion" size={20} color={Colors.blue} />
                            <Text text70R marginL-5>${room.price}/night</Text>
                        </View>
                        <View row centerV>
                            <Icon name="people" type="ion" size={20} color={Colors.blue} />
                            <Text text70R marginL-5>Max {room.capacity} guests</Text>
                        </View>
                        <View row centerV>
                            <Icon name="home" type="ion" size={20} color={Colors.blue} />
                            <Text text70R marginL-5 capitalize>{room.type}</Text>
                        </View>
                    </View>

                    <Text text60 bold marginB-10>Amenities</Text>
                    <View style={styles.amenitiesContainer}>
                        {room.amenities && room.amenities.map((amenity, index) => (
                            <View key={`amenity-${index}`} style={styles.amenityItem}>
                                <Icon name={getAmenityIcon(amenity)} type="ion" size={18} color={Colors.blue} />
                                <Text text80R text1 marginL-5>{amenity}</Text>
                            </View>
                        ))}
                    </View>

                    <Card style={styles.bookingCard}>
                        <Text text60 bold marginB-15>Book This Room</Text>
                        <View row spread marginB-15>
                            <View style={styles.datePickerContainer}>
                                <Text text80 text1 marginB-5 style={{ fontWeight: 'bold' }}>Check-in Date</Text>
                                <TouchableOpacity 
                                    style={styles.datePicker}
                                    onPress={() => setShowCheckInPicker(true)}
                                >
                                    <Text>{checkInDate.toDateString()}</Text>
                                </TouchableOpacity>
                                {showCheckInPicker && (
                                    <DateTimePicker
                                        testID="checkInDatePicker"
                                        value={checkInDate}
                                        mode="date"
                                        display="default"
                                        minimumDate={new Date()}
                                        onChange={(event, selectedDate) => {
                                            setShowCheckInPicker(Platform.OS === 'ios');
                                            if (selectedDate && event.type !== 'dismissed') {
                                                setCheckInDate(selectedDate);
                                            }
                                        }}
                                    />
                                )}
                            </View>
                            
                            <View style={styles.datePickerContainer}>
                                <Text text80 text1 marginB-5 style={{ fontWeight: 'bold' }}>Check-out Date</Text>
                                <TouchableOpacity 
                                    style={styles.datePicker}
                                    onPress={() => setShowCheckOutPicker(true)}
                                >
                                    <Text>{checkOutDate.toDateString()}</Text>
                                </TouchableOpacity>
                                {showCheckOutPicker && (
                                    <DateTimePicker
                                        testID="checkOutDatePicker"
                                        value={checkOutDate}
                                        mode="date"
                                        display="default"
                                        minimumDate={new Date(checkInDate.getTime() + 86400000)}
                                        onChange={(event, selectedDate) => {
                                            setShowCheckOutPicker(Platform.OS === 'ios');
                                            if (selectedDate && event.type !== 'dismissed') {
                                                setCheckOutDate(selectedDate);
                                            }
                                        }}
                                    />
                                )}
                            </View>
                        </View>

                        <View marginB-20>
                            <Text text80 text1 marginB-5>Number of Guests</Text>
                            <View row centerV>
                                <TouchableOpacity 
                                style={styles.guestButton} 
                                onPress={decrementGuests}
                                disabled={guestCount <= 1}>
                                    <Icon name="remove" type="ion" size={20} color={Colors.blue} />
                                </TouchableOpacity>
                                <Text text70 marginH-15>{guestCount}</Text>
                                <TouchableOpacity 
                                style={styles.guestButton} 
                                onPress={incrementGuests}
                                disabled={room && guestCount >= room.capacity}>
                                    <Icon name="add" type="ion" size={20} color={Colors.blue} />
                                </TouchableOpacity>
                                <Text text80 grey30 marginL-10>Max: {room.capacity}</Text>
                            </View>
                        </View>

                        <View row spread marginB-15>
                            <Text text70>Total Price:</Text>
                            <Text text60 blue bold>${totalPrice}</Text>
                        </View>

                        <Button
                        label={bookingLoading ? '' : 'Book Now'}
                        bg-blue
                        text70
                        white
                        br100
                        style={{ fontWeight: 'bold', height: 50 }}
                        onPress={handleBookNow}
                        disabled={bookingLoading}>
                            {bookingLoading && <ActivityIndicator color={Colors.white} />}
                        </Button>
                    </Card>
                </View>
            </ScrollView>
            <Modal
            statusBarTranslucent
            animationType="slide"
            transparent={true}
            visible={showWishlistModal}
            onRequestClose={() => setShowWishlistModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add to Wishlist</Text>
                            <TouchableOpacity onPress={() => setShowWishlistModal(false)}>
                                <Icon name="close" type="ion" size={24} color={Colors.grey30} />
                            </TouchableOpacity>
                        </View>
                        
                        {wishlistLoading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={Colors.blue} />
                            </View>
                        ) : wishlists.length === 0 ? (
                            <View style={styles.emptyWishlistContainer}>
                                <Icon name="list" type="ion" size={50} color={Colors.grey50} />
                                <Text style={styles.emptyWishlistText}>No wishlists yet</Text>
                                <TouchableOpacity 
                                    style={styles.createWishlistButton}
                                    onPress={() => {
                                        setShowWishlistModal(false);
                                        navigation.navigate('Wishlists');
                                    }}
                                >
                                    <Text style={styles.createWishlistButtonText}>Create Wishlist</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <ScrollView style={styles.wishlistList}>
                                {wishlists.map((wishlist) => (
                                    <TouchableOpacity 
                                        key={wishlist.id} 
                                        style={styles.wishlistItem}
                                        onPress={() => handleAddToWishlist(wishlist.id)}
                                    >
                                        <Icon name="list" type="ion" size={24} color={Colors.blue} />
                                        <Text style={styles.wishlistItemText}>{wishlist.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </View>

    );

};

const getAmenityIcon = (amenity) => {
    const amenityLower = amenity.toLowerCase();
    if (amenityLower.includes('wifi')) return 'wifi';
    if (amenityLower.includes('tv') || amenityLower.includes('television')) return 'tv';
    if (amenityLower.includes('breakfast') || amenityLower.includes('food')) return 'restaurant';
    if (amenityLower.includes('air') || amenityLower.includes('ac')) return 'thermometer';
    if (amenityLower.includes('bath') || amenityLower.includes('tub')) return 'water';
    if (amenityLower.includes('parking')) return 'car';
    if (amenityLower.includes('gym') || amenityLower.includes('fitness')) return 'barbell';
    if (amenityLower.includes('pool') || amenityLower.includes('swim')) return 'water';
    return 'checkmark-circle';
};

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    carousel: {
        height: 250,
    },
    carouselImage: {
        width,
        height: 250,
    },
    content: {
        padding: 15,
    },
    amenitiesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 20,
    },
    amenityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.grey70,
        borderRadius: 20,
        paddingVertical: 6,
        paddingHorizontal: 12,
        marginRight: 10,
        marginBottom: 10,
    },
    bookingCard: {
        padding: 15,
        borderRadius: 10,
        marginVertical: 10,
    },
    datePickerContainer: {
        width: '48%',
    },
    datePicker: {
        borderWidth: 1,
        borderColor: Colors.grey50,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 12,
        justifyContent: 'center',
    },
    guestButton: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: Colors.blue,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bookButton: {
        height: 50,
        borderRadius: 8,
    },
    favoriteButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.white,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.5,
        elevation: 2,
    },
    // Wishlist Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 20,
        paddingBottom: 30,
        maxHeight: '70%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: Colors.grey70,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    wishlistList: {
        marginTop: 15,
    },
    wishlistItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: Colors.grey70,
    },
    wishlistItemText: {
        fontSize: 16,
        marginLeft: 15,
    },
    emptyWishlistContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 30,
    },
    emptyWishlistText: {
        fontSize: 16,
        color: Colors.grey30,
        marginTop: 10,
        marginBottom: 20,
    },
    createWishlistButton: {
        backgroundColor: Colors.blue,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    createWishlistButtonText: {
        color: Colors.white,
        fontWeight: 'bold',
    },
});

export default RoomDetailsScreen;