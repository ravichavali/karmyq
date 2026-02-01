import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/services/api";
import { useMessaging } from "@/hooks/useMessaging";

interface Message {
  id: string;
  sender_id: string;
  sender_name?: string;
  content: string;
  created_at: string;
}

interface InlineChatProps {
  matchId: string;
  currentUserId: string;
  otherParticipantName: string;
  onClose?: () => void;
}

export default function InlineChat({
  matchId,
  currentUserId,
  otherParticipantName,
  onClose,
}: InlineChatProps) {
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use the WebSocket messaging hook
  const {
    messages,
    loading,
    connected,
    sendMessage: sendMessageWS,
    refreshMessages,
    startTyping,
    stopTyping,
    isTyping,
    typingUser,
  } = useMessaging({
    matchId,
    conversationId,
    userId: currentUserId,
    enabled: true, // Always enabled for mobile
  });

  // Fetch conversation ID on mount
  useEffect(() => {
    fetchConversation();
  }, [matchId]);

  // Refresh messages when conversationId is available
  useEffect(() => {
    if (conversationId) {
      refreshMessages();
    }
  }, [conversationId, refreshMessages]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const fetchConversation = async () => {
    try {
      // For now, use matchId as conversationId (backend creates conversation from match)
      setConversationId(`match_${matchId}`);
    } catch (error) {
      console.error("Error fetching conversation:", error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);
      stopTyping(); // Stop typing indicator before sending

      await sendMessageWS(newMessage.trim());
      setNewMessage("");

      // Scroll to bottom after sending
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error: any) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (value: string) => {
    setNewMessage(value);

    // Start typing indicator
    if (value.trim()) {
      startTyping();

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing after 1 second of no input
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, 1000);
    } else {
      stopTyping();
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.sender_id === currentUserId;
    const formattedTime = new Date(item.created_at).toLocaleTimeString(
      "en-US",
      {
        hour: "numeric",
        minute: "2-digit",
      },
    );

    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isOwnMessage ? styles.ownBubble : styles.otherBubble,
          ]}
        >
          {!isOwnMessage && item.sender_name && (
            <Text style={styles.senderName}>{item.sender_name}</Text>
          )}
          <Text
            style={
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText
            }
          >
            {item.content}
          </Text>
          <Text style={styles.messageTime}>{formattedTime}</Text>
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Ionicons name="chatbubble-ellipses" size={20} color="#3B82F6" />
        <Text style={styles.headerTitle}>Chat with {otherParticipantName}</Text>
        {connected && (
          <View style={styles.connectedIndicator}>
            <View style={styles.connectedDot} />
          </View>
        )}
      </View>
      {onClose && (
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#6B7280" />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderTypingIndicator = () => {
    if (!isTyping) return null;

    return (
      <View style={styles.typingContainer}>
        <Text style={styles.typingText}>
          {typingUser || otherParticipantName} is typing...
        </Text>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubbles-outline" size={48} color="#D1D5DB" />
      <Text style={styles.emptyStateText}>No messages yet</Text>
      <Text style={styles.emptyStateSubtext}>Start the conversation!</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {renderHeader()}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={
            messages.length === 0 ? styles.emptyList : styles.messagesList
          }
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderTypingIndicator}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#9CA3AF"
          value={newMessage}
          onChangeText={handleTyping}
          multiline
          maxLength={500}
          editable={!sending}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!newMessage.trim() || sending) && styles.sendButtonDisabled,
          ]}
          onPress={handleSendMessage}
          disabled={!newMessage.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="send" size={20} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginLeft: 8,
  },
  connectedIndicator: {
    marginLeft: 8,
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  messagesList: {
    padding: 12,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 4,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: "80%",
  },
  ownMessage: {
    alignSelf: "flex-end",
  },
  otherMessage: {
    alignSelf: "flex-start",
  },
  messageBubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ownBubble: {
    backgroundColor: "#3B82F6",
  },
  otherBubble: {
    backgroundColor: "#E5E7EB",
  },
  senderName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 4,
  },
  ownMessageText: {
    fontSize: 15,
    color: "#FFFFFF",
    lineHeight: 20,
  },
  otherMessageText: {
    fontSize: 15,
    color: "#111827",
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.7)",
    marginTop: 4,
    alignSelf: "flex-end",
  },
  typingContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  typingText: {
    fontSize: 13,
    color: "#6B7280",
    fontStyle: "italic",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  input: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111827",
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#D1D5DB",
  },
});
