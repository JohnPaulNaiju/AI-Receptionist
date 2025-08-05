import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, Dimensions, RefreshControl, TextInput, Modal, ScrollView } from 'react-native';
import { View, Text, Colors, Card, Avatar, Chip, Slider, Button } from 'react-native-ui-lib';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../../utils';
import { Icon } from '../../components';

const { width } = Dimensions.get('window');

const HomeScreen = ({ navigation }) => {

    const [rooms, setRooms] = useState([]);
    const [filteredRooms, setFilteredRooms] = useState([]);
    const [featuredRooms, setFeaturedRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [userName, setUserName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [filters, setFilters] = useState({
        priceRange: [0, 1000],
        roomTypes: [],
        locations: [],
        amenities: []
    });
    const [availableFilters, setAvailableFilters] = useState({
        roomTypes: [],
        locations: [],
        amenities: []
    });
    const [activeCategory, setActiveCategory] = useState('recommended');
    const [unreadNotifications, setUnreadNotifications] = useState(0);

    const fetchUserData = async () => {
        try {
            if(auth.currentUser){
                const userDoc = await getDocs(query(
                collection(db, 'users'),
                where('uid', '==', auth.currentUser.uid)
                ));
                if (!userDoc.empty) {
                    setUserName(userDoc.docs[0].data().name.split(' ')[0]);
                }
            }
        } catch (error) {
            console.log('Error fetching user data:', error);
        }
    };

    const fetchRooms = async () => {
        try {
            const roomsSnapshot = await getDocs(query(
                collection(db, 'rooms'),
                where('status', '==', 'available'),
                orderBy('price')
            ));
            const roomsData = roomsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Extract available filter options
            const roomTypes = [...new Set(roomsData.map(room => room.type))];
            const locations = [...new Set(roomsData.map(room => room.location).filter(Boolean))];
            const allAmenities = roomsData.flatMap(room => room.amenities || []);
            const amenities = [...new Set(allAmenities)];
            
            setAvailableFilters({
                roomTypes,
                locations,
                amenities
            });
            
            setRooms(roomsData);
            setFilteredRooms(roomsData);
            
            // Set featured rooms
            const featured = roomsData.filter(room => 
                room.type === 'deluxe' || room.type === 'suite'
            ).slice(0, 3);
            setFeaturedRooms(featured);
            
            // Set max price for filter
            const maxPrice = Math.max(...roomsData.map(room => room.price), 1000);
            setFilters(prev => ({...prev, priceRange: [0, maxPrice]}));
        } catch (error) {
            console.log('Error fetching rooms:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };
    
    const applyFilters = () => {
        let result = [...rooms];
        
        // Apply search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            result = result.filter(room => 
                room.name.toLowerCase().includes(query) || 
                (room.description && room.description.toLowerCase().includes(query)) ||
                (room.type && room.type.toLowerCase().includes(query)) ||
                (room.location && room.location.toLowerCase().includes(query))
            );
        }
        
        // Apply price range filter
        result = result.filter(room => 
            room.price >= filters.priceRange[0] && room.price <= filters.priceRange[1]
        );
        
        // Apply room type filter
        if (filters.roomTypes.length > 0) {
            result = result.filter(room => filters.roomTypes.includes(room.type));
        }
        
        // Apply location filter
        if (filters.locations.length > 0) {
            result = result.filter(room => filters.locations.includes(room.location));
        }
        
        // Apply amenities filter
        if (filters.amenities.length > 0) {
            result = result.filter(room => {
                const roomAmenities = room.amenities || [];
                return filters.amenities.every(amenity => roomAmenities.includes(amenity));
            });
        }
        
        // Apply category filter
        if (activeCategory !== 'recommended') {
            switch (activeCategory) {
                case 'popular':
                    result.sort((a, b) => (b.bookingCount || 0) - (a.bookingCount || 0));
                    break;
                case 'trending':
                    result.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
                    break;
                case 'new':
                    result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
                    break;
                default:
                    break;
            }
        }
        
        setFilteredRooms(result);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchUserData(), fetchRooms(), checkUnreadNotifications()]);
        setRefreshing(false);
    };

    useEffect(() => {
        setLoading(true);
        fetchUserData();
        fetchRooms();
        checkUnreadNotifications();
    }, []);
    
    const checkUnreadNotifications = async () => {
        if (!auth.currentUser) return;
        
        try {
            const notificationsRef = collection(db, 'notifications');
            const q = query(
                notificationsRef, 
                where('userId', '==', auth.currentUser.uid),
                where('read', '==', false)
            );
            const querySnapshot = await getDocs(q);
            setUnreadNotifications(querySnapshot.size);
        } catch (error) {
            console.log('Error checking unread notifications:', error);
        }
    };
    
    // Apply filters whenever search query or filters change
    useEffect(() => {
        applyFilters();
    }, [searchQuery, filters, activeCategory]);
    
    const handleSearch = (text) => {
        setSearchQuery(text);
    };
    
    const resetFilters = () => {
        const maxPrice = Math.max(...rooms.map(room => room.price), 1000);
        setFilters({
            priceRange: [0, maxPrice],
            roomTypes: [],
            locations: [],
            amenities: []
        });
        setActiveCategory('recommended');
    };
    
    const toggleRoomTypeFilter = (type) => {
        setFilters(prev => {
            const updatedTypes = prev.roomTypes.includes(type)
                ? prev.roomTypes.filter(t => t !== type)
                : [...prev.roomTypes, type];
            return { ...prev, roomTypes: updatedTypes };
        });
    };
    
    const toggleLocationFilter = (location) => {
        setFilters(prev => {
            const updatedLocations = prev.locations.includes(location)
                ? prev.locations.filter(l => l !== location)
                : [...prev.locations, location];
            return { ...prev, locations: updatedLocations };
        });
    };
    
    const toggleAmenityFilter = (amenity) => {
        setFilters(prev => {
            const updatedAmenities = prev.amenities.includes(amenity)
                ? prev.amenities.filter(a => a !== amenity)
                : [...prev.amenities, amenity];
            return { ...prev, amenities: updatedAmenities };
        });
    };

    const renderRoomCard = ({ item }) => (
        <TouchableOpacity onPress={() => navigation.navigate('RoomDetails', { roomId: item.id })} style={styles.roomCard}>
            <View style={styles.roomCardInner}>
                <Image source={{ uri: item.images && item.images.length > 0 ? item.images[0] : 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1074&q=80' }}
                    style={styles.roomCardImage} resizeMode="cover"/>
                <View style={styles.roomCardContent}>
                    <View style={styles.roomCardHeader}>
                        <Text style={styles.roomCardTitle}>{item.name}</Text>
                        <Text style={styles.roomCardPrice}>${item.price}</Text>
                    </View>
                    <Text style={styles.roomCardLocation}>{item.type}, {item.location || 'Various Locations'}</Text>
                    <View style={styles.roomCardFooter}>
                        <View style={styles.ratingContainer}>
                            <Icon name="star" type="ion" size={14} color="#FFD700" />
                            <Text style={styles.ratingText}>4.8</Text>
                        </View>
                        <TouchableOpacity style={styles.bookmarkButton}>
                            <Icon name="bookmark-outline" type="ion" size={20} color={Colors.grey30} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );

    const renderFeaturedRoom = ({ item }) => (
        <TouchableOpacity onPress={() => navigation.navigate('RoomDetails', { roomId: item.id })} style={styles.featuredCard}>
            <Image style={styles.featuredImage} resizeMode="cover"
            source={{ uri: item.images && item.images.length > 0 ? item.images[0] : 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1074&q=80' }}/>
            <View style={styles.ratingBadge}>
                <Icon name="star" type="ion" size={12} color="#FFFFFF" />
                <Text style={styles.ratingBadgeText}>4.8</Text>
            </View>
            <View style={styles.featuredOverlay}>
                <Text style={styles.featuredTitle}>{item.name}</Text>
                <View style={styles.featuredLocation}>
                    <Text numberOfLines={1} style={styles.featuredLocationText}>{item.location || item.description || 'Various Locations'}</Text>
                </View>
                <Text style={styles.featuredPrice}>${item.price}<Text white style={styles.perNightText}>/per night</Text></Text>
            </View>
        </TouchableOpacity>
    );

    if (loading) {
        return (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.blue} />
        </View>
        );
    }

    return (

        <View flex bg-bg2 useSafeArea style={styles.container}>
            <View style={styles.header}>
                <View row centerV>
                    <Avatar size={40} source={require('../../assets/icon.png')}/>
                    <Text text60 text1 marginL-3>YB Hotels</Text>
                </View>
                <View row centerV>
                    <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Food')}>
                        <Icon name="fast-food-outline" type="ion" size={22} color={Colors.grey30} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={styles.iconButton} 
                        onPress={() => {
                            navigation.navigate('Notifications');
                            // Reset unread count when navigating to notifications
                            setUnreadNotifications(0);
                        }}
                    >
                        <Icon name="notifications-outline" type="ion" size={22} color={Colors.grey30} />
                        {unreadNotifications > 0 && (
                            <View absR marginT-8 marginR-6 style={styles.notificationBadge}>
                                <Text style={styles.notificationBadgeText}>
                                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Bookmarks')}>
                        <Icon name="bookmark-outline" type="ion" size={22} color={Colors.grey30} />
                    </TouchableOpacity>
                    
                </View>
            </View>

            <Text text60 text1 marginL-12 marginB-16>Hello, {userName || 'Guest'} 👋</Text>
            
            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <Icon name="search" type="ion" size={18} color={Colors.grey30} style={styles.searchIcon} />
                    <TextInput
                        placeholder="Search"
                        placeholderTextColor={Colors.grey30}
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={handleSearch}
                    />
                </View>
                <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilterModal(true)}>
                    <Icon name="options-outline" type="ion" size={22} color={Colors.blue} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={filteredRooms}
                keyExtractor={(item) => item.id}
                renderItem={renderRoomCard}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[Colors.blue]}
                        tintColor={Colors.blue}
                    />
                }
                ListHeaderComponent={
                    <>
                        {featuredRooms.length > 0 ? (
                            <View>
                                <Text text1 text60 marginL-12 marginT-8 marginB-16>Featured</Text>
                                <FlatList
                                    data={featuredRooms}
                                    keyExtractor={(item) => `featured-${item.id}`}
                                    renderItem={renderFeaturedRoom}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.featuredList}
                                />
                            </View>
                        ) : null}
                        {featuredRooms.length > 0 ? <Text style={styles.sectionTitle}>Rooms</Text> : null}
                    </>
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Icon name="bed" type="ion" size={50} color={Colors.grey50} />
                        <Text text70 grey30 center marginT-10>
                            {searchQuery.trim() || Object.values(filters).some(f => Array.isArray(f) ? f.length > 0 : false) || 
                             (filters.priceRange[0] > 0 || filters.priceRange[1] < Math.max(...rooms.map(room => room.price), 1000))
                                ? 'No rooms match your search criteria' 
                                : 'No rooms available at the moment'}
                        </Text>
                        {(searchQuery.trim() || Object.values(filters).some(f => Array.isArray(f) ? f.length > 0 : false) || 
                          (filters.priceRange[0] > 0 || filters.priceRange[1] < Math.max(...rooms.map(room => room.price), 1000))) && (
                            <TouchableOpacity style={styles.resetButton} onPress={() => {
                                setSearchQuery('');
                                resetFilters();
                            }}>
                                <Text style={styles.resetButtonText}>Reset Filters</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                }
                contentContainerStyle={styles.listContent}
            />
            
            {/* Filter Modal */}
            <Modal
            statusBarTranslucent
                visible={showFilterModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowFilterModal(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Filter Rooms</Text>
                            <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                                <Icon name="close" type="ion" size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView style={styles.modalBody}>
                            {/* Price Range */}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterTitle}>Price Range</Text>
                                <View style={styles.priceRangeContainer}>
                                    <Text style={styles.priceLabel}>${isNaN(filters.priceRange[0]) ? 0 : Math.round(filters.priceRange[0])}</Text>
                                    <Text style={styles.priceLabel}>${isNaN(filters.priceRange[1]) ? 1000 : Math.round(filters.priceRange[1])}</Text>
                                </View>
                                <View style={styles.sliderContainer}>
                                    <View style={styles.sliderTrack}>
                                        <View style={styles.sliderFilledTrack} />
                                    </View>
                                    <View style={styles.sliderButtonsContainer}>
                                        <Button
                                            label="-"
                                            size={Button.sizes.small}
                                            backgroundColor={Colors.blue}
                                            style={styles.sliderButton}
                                            onPress={() => {
                                                const newMin = Math.max(0, filters.priceRange[0] - 50);
                                                setFilters(prev => ({
                                                    ...prev,
                                                    priceRange: [newMin, prev.priceRange[1]]
                                                }));
                                            }}
                                        />
                                        <Button
                                            label="-"
                                            size={Button.sizes.small}
                                            backgroundColor={Colors.blue}
                                            style={styles.sliderButton}
                                            onPress={() => {
                                                const newMax = Math.max(filters.priceRange[0] + 50, filters.priceRange[1] - 50);
                                                setFilters(prev => ({
                                                    ...prev,
                                                    priceRange: [prev.priceRange[0], newMax]
                                                }));
                                            }}
                                        />
                                        
                                    </View>
                                    <View style={styles.sliderButtonsContainer}>
                                    <Button
                                            label="+"
                                            size={Button.sizes.small}
                                            backgroundColor={Colors.blue}
                                            style={styles.sliderButton}
                                            onPress={() => {
                                                const newMin = Math.min(filters.priceRange[1] - 50, filters.priceRange[0] + 50);
                                                setFilters(prev => ({
                                                    ...prev,
                                                    priceRange: [newMin, prev.priceRange[1]]
                                                }));
                                            }}
                                        />
                                        <Button
                                            label="+"
                                            size={Button.sizes.small}
                                            backgroundColor={Colors.blue}
                                            style={styles.sliderButton}
                                            onPress={() => {
                                                const maxPrice = Math.max(...rooms.map(room => room.price), 1000);
                                                const newMax = Math.min(maxPrice, filters.priceRange[1] + 50);
                                                setFilters(prev => ({
                                                    ...prev,
                                                    priceRange: [prev.priceRange[0], newMax]
                                                }));
                                            }}
                                        />
                                    </View>
                                </View>
                            </View>
                            
                            {/* Room Types */}
                            {availableFilters.roomTypes.length > 0 && (
                                <View style={styles.filterSection}>
                                    <Text style={styles.filterTitle}>Room Type</Text>
                                    <View style={styles.filterChipsContainer}>
                                        {availableFilters.roomTypes.map(type => (
                                            <Chip
                                                key={type}
                                                label={type.charAt(0).toUpperCase() + type.slice(1)}
                                                containerStyle={[
                                                    styles.filterChip,
                                                    filters.roomTypes.includes(type) && styles.activeFilterChip
                                                ]}
                                                labelStyle={filters.roomTypes.includes(type) ? styles.activeFilterChipLabel : styles.filterChipLabel}
                                                onPress={() => toggleRoomTypeFilter(type)}
                                            />
                                        ))}
                                    </View>
                                </View>
                            )}
                            
                            {/* Locations */}
                            {availableFilters.locations.length > 0 && (
                                <View style={styles.filterSection}>
                                    <Text style={styles.filterTitle}>Location</Text>
                                    <View style={styles.filterChipsContainer}>
                                        {availableFilters.locations.map(location => (
                                            <Chip
                                                key={location}
                                                label={location}
                                                containerStyle={[
                                                    styles.filterChip,
                                                    filters.locations.includes(location) && styles.activeFilterChip
                                                ]}
                                                labelStyle={filters.locations.includes(location) ? styles.activeFilterChipLabel : styles.filterChipLabel}
                                                onPress={() => toggleLocationFilter(location)}
                                            />
                                        ))}
                                    </View>
                                </View>
                            )}
                            
                            {/* Amenities */}
                            {availableFilters.amenities.length > 0 && (
                                <View style={styles.filterSection}>
                                    <Text style={styles.filterTitle}>Amenities</Text>
                                    <View style={styles.filterChipsContainer}>
                                        {availableFilters.amenities.map(amenity => (
                                            <Chip
                                                key={amenity}
                                                label={amenity}
                                                containerStyle={[
                                                    styles.filterChip,
                                                    filters.amenities.includes(amenity) && styles.activeFilterChip
                                                ]}
                                                labelStyle={filters.amenities.includes(amenity) ? styles.activeFilterChipLabel : styles.filterChipLabel}
                                                onPress={() => toggleAmenityFilter(amenity)}
                                            />
                                        ))}
                                    </View>
                                </View>
                            )}
                        </ScrollView>
                        
                        <View style={styles.modalFooter}>
                            <Button
                                label="Reset"
                                outline
                                outlineColor={Colors.blue}
                                style={styles.resetFilterButton}
                                onPress={resetFilters}
                            />
                            <Button
                                label="Apply Filters"
                                bg-blue
                                style={styles.applyFilterButton}
                                onPress={() => setShowFilterModal(false)}
                            />
                        </View>
                    </View>
                </View>
            </Modal>
            
            {/* Floating AI Receptionist Button */}
            <TouchableOpacity 
                style={styles.floatingButton}
                onPress={() => navigation.navigate('AIReceptionist')}
                activeOpacity={0.8}
            >
                <View bg-bg1 br100 style={styles.sparkleContainer}>
                    <Icon name="sparkles" type="ion" size={24} color={Colors.blue} />
                </View>
            </TouchableOpacity>
        </View>

    );

};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 15,
    },
    floatingButton: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        zIndex: 999,
    },
    sparkleContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    notificationBadge: {
        position: 'absolute',
        right: -5,
        top: -5,
        backgroundColor: 'red',
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    notificationBadgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },
    sliderContainer: {
        marginVertical: 10,
    },
    sliderTrack: {
        height: 4,
        backgroundColor: Colors.grey70,
        borderRadius: 2,
        marginVertical: 10,
    },
    sliderFilledTrack: {
        height: 4,
        backgroundColor: Colors.blue,
        borderRadius: 2,
        width: '50%',
    },
    sliderButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginVertical: 5,
    },
    sliderButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 15,
    },
    greeting: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    iconButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 5,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.bg1,
        borderRadius: 20,
        paddingHorizontal: 15,
        height: 40,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        height: 40,
        color: Colors.grey10,
        fontSize: 16,
    },
    filterButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    chipContainer: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    chip: {
        marginRight: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.grey70,
        backgroundColor: Colors.white,
        paddingHorizontal: 15,
    },
    activeChip: {
        backgroundColor: Colors.blue,
        borderColor: Colors.blue,
    },
    chipLabel: {
        color: Colors.grey30,
        fontSize: 14,
    },
    activeChipLabel: {
        color: Colors.white,
        fontSize: 14,
    },
    listContent: {
        paddingBottom: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginVertical: 15,
    },
    roomCard: {
        marginBottom: 15,
    },
    roomCardInner: {
        flexDirection: 'row',
        backgroundColor: Colors.white,
        borderRadius: 10,
        overflow: 'hidden',
    },
    roomCardImage: {
        width: 80,
        height: 80,
        borderRadius: 8,
        margin: 8,
    },
    roomCardContent: {
        flex: 1,
        padding: 10,
    },
    roomCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    roomCardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        flex: 1,
    },
    roomCardPrice: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.blue,
    },
    roomCardLocation: {
        fontSize: 14,
        color: Colors.grey30,
        marginTop: 4,
    },
    roomCardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    ratingText: {
        fontSize: 14,
        color: Colors.grey30,
        marginLeft: 4,
    },
    bookmarkButton: {
        padding: 5,
    },
    featuredList: {
        paddingRight: 5,
    },
    featuredCard: {
        width: width * 0.55,
        height: 260,
        marginRight: 15,
        borderRadius: 25,
        overflow: 'hidden',
    },
    featuredImage: {
        width: '100%',
        height: '100%',
    },
    ratingBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: Colors.blue,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    ratingBadgeText: {
        color: Colors.white,
        fontSize: 12,
        fontWeight: 'bold',
        marginLeft: 2,
    },
    featuredOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 15,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    featuredTitle: {
        color: Colors.white,
        fontSize: 18,
        fontWeight: 'bold',
    },
    featuredLocation: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    featuredLocationText: {
        color: Colors.white,
        fontSize: 14,
    },
    featuredPrice: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 4,
    },
    perNightText: {
        fontWeight: 'normal',
        fontSize: 12,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 30,
        height: 300,
    },
    // Modal styles
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: Colors.grey70,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
    },
    modalBody: {
        padding: 20,
    },
    modalFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: Colors.grey70,
    },
    filterSection: {
        marginBottom: 20,
    },
    filterTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    priceRangeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    priceLabel: {
        fontSize: 14,
        color: Colors.grey30,
    },
    slider: {
        height: 40,
    },
    filterChipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    filterChip: {
        marginRight: 8,
        marginBottom: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.grey70,
        backgroundColor: Colors.white,
    },
    activeFilterChip: {
        backgroundColor: Colors.blue,
        borderColor: Colors.blue,
    },
    filterChipLabel: {
        color: Colors.grey30,
        fontSize: 14,
    },
    activeFilterChipLabel: {
        color: Colors.white,
        fontSize: 14,
    },
    resetFilterButton: {
        width: '48%',
    },
    applyFilterButton: {
        width: '48%',
    },
    resetButton: {
        marginTop: 15,
        backgroundColor: Colors.blue,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
    },
    resetButtonText: {
        color: Colors.white,
        fontWeight: 'bold',
    },
});

export default HomeScreen;