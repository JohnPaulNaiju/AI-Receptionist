import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { View, Text, Colors, Card } from 'react-native-ui-lib';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db, auth } from '../../utils';
import { Icon } from '../../components';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { RefreshControl } from 'react-native';

const MyComplaintsScreen = () => {
    const navigation = useNavigation();
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchComplaints = async () => {
        if (!auth.currentUser) {
            setComplaints([]);
            setLoading(false);
            setRefreshing(false);
            return;
        }

        try {
            setLoading(true);
            const complaintsRef = collection(db, 'complaints');
            const q = query(
                complaintsRef, 
                where('userId', '==', auth.currentUser.uid),
                orderBy('createdAt', 'desc')
            );
            const querySnapshot = await getDocs(q);

            const complaintsData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt ? new Date(doc.data().createdAt) : new Date()
            }));

            setComplaints(complaintsData);
        } catch (error) {
            console.log('Error fetching complaints:', error);
            Alert.alert('Error', 'Failed to load complaints');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchComplaints();
    };

    // Fetch complaints when the screen comes into focus
    useFocusEffect(
        React.useCallback(() => {
            fetchComplaints();
            return () => {};
        }, [])
    );

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'pending':
                return Colors.orange30;
            case 'in progress':
                return Colors.blue;
            case 'resolved':
                return Colors.green30;
            case 'rejected':
                return Colors.red30;
            default:
                return Colors.grey30;
        }
    };

    const renderComplaintItem = ({ item }) => (
        <Card style={styles.complaintCard}>
            <View style={styles.complaintHeader}>
                <View style={styles.complaintTitleContainer}>
                    <Text style={styles.complaintTitle}>{item.title}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                        <Text style={styles.statusText}>{item.status || 'Pending'}</Text>
                    </View>
                </View>
                <Text style={styles.dateText}>
                    {item.createdAt.toLocaleDateString()} at {item.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
            <View style={styles.complaintContent}>
                <Text style={styles.complaintDescription}>{item.description}</Text>
                {item.roomId && (
                    <View style={styles.roomInfo}>
                        <Icon name="bed" type="ion" size={16} color={Colors.blue} />
                        <Text style={styles.roomText}>Room: {item.roomName || item.roomId}</Text>
                    </View>
                )}
                {item.response && (
                    <View style={styles.responseContainer}>
                        <Text style={styles.responseLabel}>Response:</Text>
                        <Text style={styles.responseText}>{item.response}</Text>
                    </View>
                )}
            </View>
        </Card>
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
                <Text style={styles.headerTitle}>My Complaints</Text>
                <TouchableOpacity 
                    style={styles.addButton}
                    onPress={() => navigation.navigate('RegisterComplaint')}
                >
                    <Icon name="add" type="ion" size={24} color={Colors.blue} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={complaints}
                keyExtractor={(item) => item.id}
                renderItem={renderComplaintItem}
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
                        <Icon name="warning" type="ion" size={50} color={Colors.grey50} />
                        <Text text70 grey30 center marginT-10>No complaints yet</Text>
                        <TouchableOpacity 
                            style={styles.registerButton}
                            onPress={() => navigation.navigate('RegisterComplaint')}
                        >
                            <Text style={styles.registerButtonText}>Register Complaint</Text>
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
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.text,
    },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.bg1,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingBottom: 20,
    },
    complaintCard: {
        marginBottom: 16,
        borderRadius: 12,
        overflow: 'hidden',
    },
    complaintHeader: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.grey70,
    },
    complaintTitleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    complaintTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        flex: 1,
        marginRight: 8,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        color: Colors.white,
        fontSize: 12,
        fontWeight: 'bold',
    },
    dateText: {
        fontSize: 12,
        color: Colors.grey30,
    },
    complaintContent: {
        padding: 16,
    },
    complaintDescription: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 12,
    },
    roomInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    roomText: {
        fontSize: 14,
        color: Colors.blue,
        marginLeft: 8,
    },
    responseContainer: {
        marginTop: 12,
        padding: 12,
        backgroundColor: Colors.grey70,
        borderRadius: 8,
    },
    responseLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    responseText: {
        fontSize: 14,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    registerButton: {
        marginTop: 20,
        backgroundColor: Colors.blue,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 24,
    },
    registerButtonText: {
        color: Colors.white,
        fontWeight: 'bold',
    },
});

export default MyComplaintsScreen;
