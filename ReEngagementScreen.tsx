import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DocumentPicker from 'react-native-document-picker';
import {
  reEngagementService,
  LeadData,
  CallResponse,
  BatchImportData,
  LeadStatus,
  CallOutcome,
} from '../services/reEngagementService';

interface ReEngagementScreenProps {
  navigation: any;
}

const ReEngagementScreen: React.FC<ReEngagementScreenProps> = ({ navigation }) => {
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCall, setActiveCall] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadData | null>(null);
  const [showCallHistory, setShowCallHistory] = useState(false);

  // Manual lead form state
  const [newLead, setNewLead] = useState({
    name: '',
    phone: '',
    email: '',
    lastContact: '',
    notes: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
  });

  // Batch import state
  const [batchData, setBatchData] = useState<BatchImportData | null>(null);
  const [importProgress, setImportProgress] = useState(0);

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = useCallback(async () => {
    try {
      setLoading(true);
      const leadsList = await reEngagementService.getLeads();
      setLeads(leadsList);
    } catch (error) {
      console.error('Failed to load leads:', error);
      Alert.alert('Error', 'Failed to load leads. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLeads();
    setRefreshing(false);
  }, [loadLeads]);

  const handleCall = async (lead: LeadData) => {
    try {
      setActiveCall(lead.id);
      
      const response = await reEngagementService.initiateCall(lead.id, {
        pitch: 'reengagement',
        priority: lead.priority,
        previousContacts: lead.callHistory?.length || 0,
      });

      if (response.success) {
        Alert.alert(
          'Call Initiated',
          `Call started successfully. Call ID: ${response.callId}`,
          [{ text: 'OK', onPress: () => loadLeads() }]
        );
      } else {
        Alert.alert('Call Failed', response.error || 'Failed to initiate call');
      }
    } catch (error) {
      console.error('Call initiation failed:', error);
      Alert.alert('Error', 'Failed to start call. Please try again.');
    } finally {
      setActiveCall(null);
    }
  };

  const handleRetryCall = async (leadId: string) => {
    try {
      const response = await reEngagementService.retryCall(leadId);
      
      if (response.success) {
        Alert.alert('Retry Scheduled', 'Call retry has been scheduled according to retry rules.');
        loadLeads();
      } else {
        Alert.alert('Retry Failed', response.error || 'Failed to schedule retry');
      }
    } catch (error) {
      console.error('Retry failed:', error);
      Alert.alert('Error', 'Failed to schedule retry. Please try again.');
    }
  };

  const handleAddLead = async () => {
    if (!newLead.name || !newLead.phone) {
      Alert.alert('Validation Error', 'Name and phone number are required.');
      return;
    }

    try {
      const leadData: Omit<LeadData, 'id' | 'status' | 'createdAt' | 'updatedAt'> = {
        name: newLead.name,
        phone: newLead.phone,
        email: newLead.email || undefined,
        lastContact: newLead.lastContact ? new Date(newLead.lastContact) : undefined,
        notes: newLead.notes || undefined,
        priority: newLead.priority,
        callHistory: [],
        retryCount: 0,
        nextRetryAt: undefined,
      };

      await reEngagementService.addLead(leadData);
      
      setShowAddModal(false);
      setNewLead({
        name: '',
        phone: '',
        email: '',
        lastContact: '',
        notes: '',
        priority: 'medium',
      });
      
      loadLeads();
      Alert.alert('Success', 'Lead added successfully!');
    } catch (error) {
      console.error('Failed to add lead:', error);
      Alert.alert('Error', 'Failed to add lead. Please try again.');
    }
  };

  const handleBatchImport = async () => {
    try {
      const result = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.csv, DocumentPicker.types.xlsx],
      });

      const importData: BatchImportData = {
        fileName: result.name || 'imported_leads',
        fileUri: result.uri,
        fileType: result.type || 'text/csv',
        totalRecords: 0, // Will be calculated by service
      };

      setBatchData(importData);
      setImportProgress(0);

      const response = await reEngagementService.batchImportLeads(
        importData,
        (progress) => setImportProgress(progress)
      );

      if (response.success) {
        Alert.alert(
          'Import Successful',
          `Successfully imported ${response.imported} leads. ${response.errors} errors.`
        );
        setShowBatchModal(false);
        setBatchData(null);
        loadLeads();
      } else {
        Alert.alert('Import Failed', response.error || 'Failed to import leads');
      }
    } catch (error) {
      if (!DocumentPicker.isCancel(error)) {
        console.error('Batch import failed:', error);
        Alert.alert('Error', 'Failed to import leads. Please try again.');
      }
    }
  };

  const getStatusColor = (status: LeadStatus): string => {
    switch (status) {
      case 'new': return '#3B82F6';
      case 'contacted': return '#10B981';
      case 'missed': return '#F59E0B';
      case 'unreachable': return '#EF4444';
      case 'converted': return '#8B5CF6';
      default: return '#6B7280';
    }
  };

  const getStatusIcon = (status: LeadStatus): string => {
    switch (status) {
      case 'new': return 'person-add';
      case 'contacted': return 'call';
      case 'missed': return 'call-outline';
      case 'unreachable': return 'close-circle';
      case 'converted': return 'checkmark-circle';
      default: return 'help-circle';
    }
  };

  const renderLead = ({ item }: { item: LeadData }) => (
    <View style={styles.leadCard}>
      <View style={styles.leadHeader}>
        <View style={styles.leadInfo}>
          <Text style={styles.leadName}>{item.name}</Text>
          <Text style={styles.leadPhone}>{item.phone}</Text>
          {item.email && <Text style={styles.leadEmail}>{item.email}</Text>}
        </View>
        <View style={styles.leadStatus}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Ionicons 
              name={getStatusIcon(item.status) as any} 
              size={12} 
              color="#FFFFFF" 
            />
            <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
          </View>
          <Text style={styles.priorityText}>Priority: {item.priority.toUpperCase()}</Text>
        </View>
      </View>

      {item.notes && (
        <Text style={styles.leadNotes} numberOfLines={2}>{item.notes}</Text>
      )}

      <View style={styles.leadFooter}>
        <View style={styles.leadMeta}>
          {item.lastContact && (
            <Text style={styles.metaText}>
              Last: {item.lastContact.toLocaleDateString()}
            </Text>
          )}
          <Text style={styles.metaText}>
            Calls: {item.callHistory?.length || 0}
          </Text>
          {item.retryCount > 0 && (
            <Text style={styles.metaText}>
              Retries: {item.retryCount}
            </Text>
          )}
        </View>

        <View style={styles.leadActions}>
          {item.callHistory && item.callHistory.length > 0 && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                setSelectedLead(item);
                setShowCallHistory(true);
              }}
            >
              <Ionicons name="time" size={16} color="#8B5CF6" />
            </TouchableOpacity>
          )}

          {(item.status === 'missed' || item.status === 'unreachable') && 
           item.retryCount < 3 && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleRetryCall(item.id)}
            >
              <Ionicons name="refresh" size={16} color="#F59E0B" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.callButton,
              activeCall === item.id && styles.callingButton
            ]}
            onPress={() => handleCall(item)}
            disabled={activeCall === item.id}
          >
            {activeCall === item.id ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="call" size={16} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Loading leads...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Re-Engagement</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowBatchModal(true)}
          >
            <Ionicons name="cloud-upload" size={20} color="#8B5CF6" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add" size={20} color="#8B5CF6" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{leads.length}</Text>
          <Text style={styles.statLabel}>Total Leads</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {leads.filter(l => l.status === 'new').length}
          </Text>
          <Text style={styles.statLabel}>New</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {leads.filter(l => l.status === 'missed').length}
          </Text>
          <Text style={styles.statLabel}>Missed</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {leads.filter(l => l.status === 'converted').length}
          </Text>
          <Text style={styles.statLabel}>Converted</Text>
        </View>
      </View>

      {/* Leads List */}
      <FlatList
        data={leads}
        renderItem={renderLead}
        keyExtractor={(item) => item.id}
        style={styles.leadsList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people" size={64} color="#6B7280" />
            <Text style={styles.emptyTitle}>No Leads Yet</Text>
            <Text style={styles.emptySubtitle}>
              Add leads manually or import from a file
            </Text>
          </View>
        }
      />

      {/* Add Lead Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Lead</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name *</Text>
                <TextInput
                  style={styles.textInput}
                  value={newLead.name}
                  onChangeText={(text) => setNewLead({...newLead, name: text})}
                  placeholder="Enter lead name"
                  placeholderTextColor="#6B7280"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone *</Text>
                <TextInput
                  style={styles.textInput}
                  value={newLead.phone}
                  onChangeText={(text) => setNewLead({...newLead, phone: text})}
                  placeholder="Enter phone number"
                  placeholderTextColor="#6B7280"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.textInput}
                  value={newLead.email}
                  onChangeText={(text) => setNewLead({...newLead, email: text})}
                  placeholder="Enter email address"
                  placeholderTextColor="#6B7280"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Notes</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={newLead.notes}
                  onChangeText={(text) => setNewLead({...newLead, notes: text})}
                  placeholder="Additional notes..."
                  placeholderTextColor="#6B7280"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Priority</Text>
                <View style={styles.priorityButtons}>
                  {(['low', 'medium', 'high'] as const).map((priority) => (
                    <TouchableOpacity
                      key={priority}
                      style={[
                        styles.priorityButton,
                        newLead.priority === priority && styles.priorityButtonActive
                      ]}
                      onPress={() => setNewLead({...newLead, priority})}
                    >
                      <Text style={[
                        styles.priorityButtonText,
                        newLead.priority === priority && styles.priorityButtonTextActive
                      ]}>
                        {priority.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleAddLead}
              >
                <Text style={styles.saveButtonText}>Add Lead</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Batch Import Modal */}
      <Modal visible={showBatchModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Batch Import</Text>
              <TouchableOpacity onPress={() => setShowBatchModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.importDescription}>
                Import leads from CSV or Excel files. Required columns: name, phone
              </Text>

              {batchData && (
                <View style={styles.importProgress}>
                  <Text style={styles.progressText}>
                    Importing: {batchData.fileName}
                  </Text>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { width: `${importProgress}%` }
                      ]} 
                    />
                  </View>
                  <Text style={styles.progressPercent}>{importProgress}%</Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.importButton}
                onPress={handleBatchImport}
                disabled={!!batchData}
              >
                <Ionicons name="document" size={20} color="#FFFFFF" />
                <Text style={styles.importButtonText}>Select File</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Call History Modal */}
      <Modal visible={showCallHistory} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Call History - {selectedLead?.name}
              </Text>
              <TouchableOpacity onPress={() => setShowCallHistory(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedLead?.callHistory?.map((call, index) => (
                <View key={index} style={styles.callHistoryItem}>
                  <View style={styles.callHistoryHeader}>
                    <Text style={styles.callDate}>
                      {call.timestamp.toLocaleDateString()} at{' '}
                      {call.timestamp.toLocaleTimeString()}
                    </Text>
                    <View style={[
                      styles.outcomeBadge,
                      { backgroundColor: 
                        call.outcome === 'answered' ? '#10B981' :
                        call.outcome === 'no_answer' ? '#F59E0B' : '#EF4444'
                      }
                    ]}>
                      <Text style={styles.outcomeBadgeText}>
                        {call.outcome.replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  
                  <Text style={styles.callDuration}>
                    Duration: {call.duration}s | API: {call.apiNumber}
                  </Text>
                  
                  {call.notes && (
                    <Text style={styles.callNotes}>{call.notes}</Text>
                  )}
                </View>
              )) || (
                <Text style={styles.noHistory}>No call history available</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9CA3AF',
    fontSize: 16,
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#1F2937',
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
  },
  leadsList: {
    flex: 1,
    padding: 16,
  },
  leadCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  leadInfo: {
    flex: 1,
  },
  leadName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  leadPhone: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 2,
  },
  leadEmail: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  leadStatus: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
    gap: 4,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  priorityText: {
    color: '#6B7280',
    fontSize: 10,
  },
  leadNotes: {
    color: '#D1D5DB',
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  leadFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leadMeta: {
    flex: 1,
  },
  metaText: {
    color: '#6B7280',
    fontSize: 12,
    marginBottom: 2,
  },
  leadActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#374151',
  },
  callButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 44,
    alignItems: 'center',
  },
  callingButton: {
    backgroundColor: '#6366F1',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1F2937',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  modalBody: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#374151',
    color: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  priorityButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#374151',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  priorityButtonActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  priorityButtonText: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '600',
  },
  priorityButtonTextActive: {
    color: '#FFFFFF',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#374151',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#D1D5DB',
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  importDescription: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  importProgress: {
    marginBottom: 20,
  },
  progressText: {
    color: '#D1D5DB',
    fontSize: 14,
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#374151',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#8B5CF6',
  },
  progressPercent: {
    color: '#8B5CF6',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  importButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  callHistoryItem: {
    backgroundColor: '#374151',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  callHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  callDate: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '500',
  },
  outcomeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  outcomeBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  callDuration: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 8,
  },
  callNotes: {
    color: '#D1D5DB',
    fontSize: 14,
    fontStyle: 'italic',
  },
  noHistory: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
};

export default ReEngagementScreen;
