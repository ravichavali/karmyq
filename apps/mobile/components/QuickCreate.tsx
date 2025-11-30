import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Picker } from '@react-native-picker/picker'
import { api } from '@/services/api'

interface Community {
  id: string
  name: string
}

interface QuickCreateProps {
  userId: string
  onRequestCreated?: () => void
}

export default function QuickCreate({ userId, onRequestCreated }: QuickCreateProps) {
  const [description, setDescription] = useState('')
  const [postingMode, setPostingMode] = useState<'all' | 'specific'>('all')
  const [selectedCommunity, setSelectedCommunity] = useState<string>('')
  const [userCommunities, setUserCommunities] = useState<Community[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingCommunities, setLoadingCommunities] = useState(true)

  // Load user's communities on mount
  useEffect(() => {
    loadCommunities()
  }, [])

  const loadCommunities = async () => {
    try {
      setLoadingCommunities(true)
      const response = await api.getCommunities()
      const communities = response.data.data || []
      setUserCommunities(communities)

      // Set first community as default
      if (communities.length > 0) {
        setSelectedCommunity(communities[0].id)
      }
    } catch (error) {
      console.error('Error loading communities:', error)
      Alert.alert('Error', 'Failed to load your communities')
    } finally {
      setLoadingCommunities(false)
    }
  }

  const handleSubmit = async () => {
    // Validation
    if (!description.trim()) {
      Alert.alert('Required', 'Please describe what you need help with')
      return
    }

    if (description.trim().length < 10) {
      Alert.alert('Too Short', 'Please provide more details (at least 10 characters)')
      return
    }

    if (postingMode === 'specific' && !selectedCommunity) {
      Alert.alert('Required', 'Please select a community')
      return
    }

    try {
      setLoading(true)

      await api.createRequest({
        description: description.trim(),
        type: 'general',
        urgency: 'medium',
        post_to_all_communities: postingMode === 'all',
        community_id: postingMode === 'specific' ? selectedCommunity : undefined,
      })

      // Clear form
      setDescription('')
      setPostingMode('all')

      Alert.alert('Success', 'Your request has been posted!')

      // Notify parent to refresh
      if (onRequestCreated) {
        onRequestCreated()
      }
    } catch (error: any) {
      console.error('Error creating request:', error)
      Alert.alert('Error', error.response?.data?.message || 'Failed to create request')
    } finally {
      setLoading(false)
    }
  }

  if (loadingCommunities) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#3B82F6" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="add-circle" size={20} color="#3B82F6" />
        <Text style={styles.title}>What do you need help with?</Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Describe what you need..."
        placeholderTextColor="#9CA3AF"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={500}
        editable={!loading}
      />

      <View style={styles.postingOptions}>
        <TouchableOpacity
          style={styles.radioOption}
          onPress={() => setPostingMode('all')}
          disabled={loading}
        >
          <Ionicons
            name={postingMode === 'all' ? 'radio-button-on' : 'radio-button-off'}
            size={20}
            color={postingMode === 'all' ? '#3B82F6' : '#9CA3AF'}
          />
          <Text style={[styles.radioLabel, postingMode === 'all' && styles.radioLabelActive]}>
            Post to all my communities
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.radioOption}
          onPress={() => setPostingMode('specific')}
          disabled={loading}
        >
          <Ionicons
            name={postingMode === 'specific' ? 'radio-button-on' : 'radio-button-off'}
            size={20}
            color={postingMode === 'specific' ? '#3B82F6' : '#9CA3AF'}
          />
          <Text style={[styles.radioLabel, postingMode === 'specific' && styles.radioLabelActive]}>
            Post to specific community
          </Text>
        </TouchableOpacity>
      </View>

      {postingMode === 'specific' && (
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedCommunity}
            onValueChange={(itemValue) => setSelectedCommunity(itemValue)}
            enabled={!loading}
            style={styles.picker}
          >
            {userCommunities.map((community) => (
              <Picker.Item
                key={community.id}
                label={community.name}
                value={community.id}
              />
            ))}
          </Picker>
        </View>
      )}

      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={loading || !description.trim()}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="send" size={18} color="#FFFFFF" />
            <Text style={styles.submitButtonText}>Post Request</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.helpText}>
        {description.length}/500 characters
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#111827',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  postingOptions: {
    marginBottom: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  radioLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  radioLabelActive: {
    color: '#111827',
    fontWeight: '500',
  },
  pickerContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  helpText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 8,
  },
})
