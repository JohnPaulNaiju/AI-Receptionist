import React, { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView, RefreshControl } from 'react-native';
import { View, Text, Colors, Avatar, Card } from 'react-native-ui-lib';
import { doc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../../utils';
import { Icon } from '../../components';
import { useNavigation } from '@react-navigation/native';

const ProfileScreen = () => {

    const navigation = useNavigation();

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchUserProfile();
    }, []);

    const fetchUserProfile = async () => {
        if (!auth.currentUser) return;
        try {
            setLoading(true);
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
            setUser(userDoc.data());
        }
        } catch (error) {
            console.log('Error fetching user profile:', error);
            Alert.alert('Error', 'Failed to load profile information');
        } finally {
            setLoading(false);
        }
    };
    
    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        try {
            await fetchUserProfile();
        } catch (error) {
            console.error('Error refreshing profile:', error);
        } finally {
            setRefreshing(false);
        }
    }, []);

    const handleLogout = async () => {
        Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
            { text: 'Cancel', style: 'cancel' },
            { 
            text: 'Logout', 
            style: 'destructive',
            onPress: async () => {
                try {
                await signOut(auth);
                } catch (error) {
                console.log('Error signing out:', error);
                Alert.alert('Error', 'Failed to logout. Please try again.');
                }
            }
            }
        ]
        );
    };

    if (loading) {
        return (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.blue} />
        </View>
        );
    }

    return (

        <View flex useSafeArea bg-bg2>
            <ScrollView 
                style={{ flex: 1 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[Colors.blue]}
                        tintColor={Colors.blue}
                        title="Refreshing profile..."
                        titleColor={Colors.text1}
                    />
                }
            >
                <View style={styles.profileHeader}>
                    <Avatar
                    size={80}
                    label={user?.name?.charAt(0) || 'U'}
                    backgroundColor={Colors.blue}
                    labelColor={Colors.white}/>
                    <Text text60 bold marginT-10>{user?.name || 'User'}</Text>
                    <Text text80 grey30>{user?.email || ''}</Text>
                </View>

                <View style={styles.cardsContainer}>
                    <Card style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Text text70 bold>Account Information</Text>
                        </View>

                        <View style={styles.cardContent}>
                            <View style={styles.infoRow}>
                                <Icon name="person" type="ion" size={20} color={Colors.blue} style={styles.infoIcon} />
                                <View>
                                    <Text text90 grey30>Full Name</Text>
                                    <Text text80>{user?.name || 'Not provided'}</Text>
                                </View>
                            </View>

                            <View style={styles.infoRow}>
                                <Icon name="mail" type="ion" size={20} color={Colors.blue} style={styles.infoIcon} />
                                <View>
                                    <Text text90 grey30>Email</Text>
                                    <Text text80>{user?.email || 'Not provided'}</Text>
                                </View>
                            </View>
                
                            <View style={styles.infoRow}>
                                <Icon name="call" type="ion" size={20} color={Colors.blue} style={styles.infoIcon} />
                                <View>
                                    <Text text90 grey30>Phone Number</Text>
                                    <Text text80>{user?.phoneNumber || 'Not provided'}</Text>
                                </View>
                            </View>

                            <View style={styles.infoRow}>
                                <Icon name="shield-checkmark" type="ion" size={20} color={Colors.blue} style={styles.infoIcon} />
                                <View>
                                    <Text text90 grey30>Account Type</Text>
                                    <Text text80 capitalize>{user?.role || 'User'}</Text>
                                </View>
                            </View>
                        </View>
                    </Card>

                    <Card style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Text text70 bold>Quick Actions</Text>
                        </View>
                
                        <View style={styles.cardContent}>
                            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('MainTabs', { screen: 'Bookings' })}>
                                <Icon name="calendar" type="ion" size={20} color={Colors.blue} style={styles.actionIcon} />
                                <Text text80>My Bookings</Text>
                                <Icon name="chevron-forward" type="ion" size={20} color={Colors.grey30} style={styles.chevron} />
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('MyComplaints')}>
                                <Icon name="warning" type="ion" size={20} color={Colors.orange30} style={styles.actionIcon} />
                                <Text text80>My Complaints</Text>
                                <Icon name="chevron-forward" type="ion" size={20} color={Colors.grey30} style={styles.chevron} />
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('EditProfile')}>
                                <Icon name="create" type="ion" size={20} color={Colors.green30} style={styles.actionIcon} />
                                <Text text80>Edit Profile</Text>
                                <Icon name="chevron-forward" type="ion" size={20} color={Colors.grey30} style={styles.chevron} />
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.actionButton, styles.lastAction]} onPress={handleLogout}>
                                <Icon name="log-out" type="ion" size={20} color={Colors.red30} style={styles.actionIcon} />
                                <Text text80 red30>Logout</Text>
                                <Icon name="chevron-forward" type="ion" size={20} color={Colors.grey30} style={styles.chevron} />
                            </TouchableOpacity>
                        </View>
                    </Card>
                </View>
            </ScrollView>
        </View>

    );

};

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileHeader: {
        alignItems: 'center',
        paddingVertical: 30,
        backgroundColor: Colors.white,
        borderBottomWidth: 1,
        borderBottomColor: Colors.grey70,
    },
    cardsContainer: {
        padding: 15,
    },
    card: {
        marginBottom: 15,
        borderRadius: 10,
        overflow: 'hidden',
    },
    cardHeader: {
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: Colors.grey70,
    },
    cardContent: {
        padding: 15,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    infoIcon: {
        marginRight: 15,
        width: 25,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.grey70,
    },
    lastAction: {
        borderBottomWidth: 0,
    },
    actionIcon: {
        marginRight: 15,
        width: 25,
    },
    chevron: {
        marginLeft: 'auto',
    },
});

export default ProfileScreen;