import { useState, useEffect, useRef, useCallback } from "react";
import { AppState, AppStateStatus } from "react-native";
import { io, Socket } from "socket.io-client";
import * as SecureStore from "expo-secure-store";
import { api } from "@/services/api";
import { API_CONFIG } from "@/config/api";

const MESSAGING_SERVICE_URL = API_CONFIG.MESSAGING_URL;

interface Message {
  id: string;
  sender_id: string;
  sender_name?: string;
  content: string;
  created_at: string;
}

interface UseMessagingOptions {
  matchId: string;
  conversationId: string | null;
  userId: string;
  enabled: boolean; // Only connect when chat is expanded
}

interface UseMessagingReturn {
  messages: Message[];
  loading: boolean;
  connected: boolean;
  sendMessage: (content: string) => Promise<void>;
  refreshMessages: () => Promise<void>;
  startTyping: () => void;
  stopTyping: () => void;
  isTyping: boolean;
  typingUser: string | null;
}

export function useMessaging({
  matchId,
  conversationId,
  userId,
  enabled,
}: UseMessagingOptions): UseMessagingReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Get token from SecureStore
  const getToken = useCallback(async () => {
    try {
      return await SecureStore.getItemAsync("token");
    } catch (error) {
      console.error("Error getting token:", error);
      return null;
    }
  }, []);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        // App came to foreground - reconnect socket
        console.log("App came to foreground - reconnecting socket");
        if (enabled && conversationId && socketRef.current) {
          socketRef.current.connect();
        }
      } else if (nextAppState.match(/inactive|background/)) {
        // App went to background - disconnect socket to save battery
        console.log("App went to background - disconnecting socket");
        if (socketRef.current) {
          socketRef.current.disconnect();
        }
      }

      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [enabled, conversationId]);

  // Initialize Socket.IO connection
  useEffect(() => {
    if (!enabled || !conversationId) {
      return;
    }

    let isMounted = true;

    const initSocket = async () => {
      const token = await getToken();
      if (!token || !isMounted) {
        console.error("No authentication token found");
        return;
      }

      // Create socket connection with JWT authentication
      const socket = io(MESSAGING_SERVICE_URL, {
        auth: {
          token,
        },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });

      socketRef.current = socket;

      // Connection events
      socket.on("connect", () => {
        console.log("WebSocket connected:", socket.id);
        if (isMounted) {
          setConnected(true);
          // Join the conversation room
          socket.emit("join_conversation", conversationId);
        }
      });

      socket.on("disconnect", () => {
        console.log("WebSocket disconnected");
        if (isMounted) {
          setConnected(false);
        }
      });

      socket.on("connect_error", (error) => {
        console.error("WebSocket connection error:", error.message);
        if (isMounted) {
          setConnected(false);
        }
      });

      // Message events
      socket.on("new_message", (message: Message) => {
        console.log("New message received:", message);
        if (isMounted) {
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === message.id)) {
              return prev;
            }
            return [...prev, message];
          });
        }
      });

      // Typing events
      socket.on("user_typing", (data: { userId: string; userName: string }) => {
        console.log("User typing:", data.userName);
        if (isMounted) {
          setIsTyping(true);
          setTypingUser(data.userName);

          // Clear existing timeout
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }

          // Auto-clear typing indicator after 3 seconds
          typingTimeoutRef.current = setTimeout(() => {
            if (isMounted) {
              setIsTyping(false);
              setTypingUser(null);
            }
          }, 3000);
        }
      });

      socket.on("user_stop_typing", () => {
        if (isMounted) {
          setIsTyping(false);
          setTypingUser(null);

          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
        }
      });

      // Error events
      socket.on("message_error", (data: { error: string }) => {
        console.error("Message error:", data.error);
      });

      socket.on("error", (data: { error: string }) => {
        console.error("Socket error:", data.error);
      });
    };

    initSocket();

    // Cleanup
    return () => {
      isMounted = false;
      if (socketRef.current) {
        if (conversationId) {
          socketRef.current.emit("leave_conversation", conversationId);
        }
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [enabled, conversationId, getToken]);

  // Fetch initial messages (REST)
  const refreshMessages = useCallback(async () => {
    if (!matchId) return;

    try {
      setLoading(true);
      const response = await api.getMatchMessages(matchId);
      setMessages(response.data.data?.messages || []);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  // Load messages on mount
  useEffect(() => {
    if (enabled && matchId) {
      refreshMessages();
    }
  }, [enabled, matchId, refreshMessages]);

  // Send message via WebSocket (with REST fallback)
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      const socket = socketRef.current;

      if (socket && socket.connected && conversationId) {
        // Send via WebSocket
        socket.emit("send_message", {
          conversationId,
          content: content.trim(),
        });
      } else {
        // Fallback to REST API
        try {
          await api.sendMatchMessage(matchId, content.trim(), userId);
          // Refresh messages to show the sent message
          await refreshMessages();
        } catch (error) {
          console.error("Error sending message:", error);
          throw error;
        }
      }
    },
    [conversationId, matchId, userId, refreshMessages],
  );

  // Typing indicators
  const startTyping = useCallback(() => {
    const socket = socketRef.current;
    if (socket && socket.connected && conversationId) {
      socket.emit("typing", {
        conversationId,
        userId,
      });
    }
  }, [conversationId, userId]);

  const stopTyping = useCallback(() => {
    const socket = socketRef.current;
    if (socket && socket.connected && conversationId) {
      socket.emit("stop_typing", {
        conversationId,
      });
    }
  }, [conversationId, userId]);

  return {
    messages,
    loading,
    connected,
    sendMessage,
    refreshMessages,
    startTyping,
    stopTyping,
    isTyping,
    typingUser,
  };
}
