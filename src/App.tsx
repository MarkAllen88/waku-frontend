/**
 * VeTest P2P Chat Application with swap.veri.lol Integration
 * A decentralized chat and swap interface using Waku protocol
 * Features: P2P messaging, private encrypted chat, asset swap offers, reputation system
 */

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import axios from "axios";
import {
  Settings, ArrowUpDown, TrendingUp, TrendingDown, Trash2,
  MessageCircle, Lock, Star, Shield, User, Clock
} from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import React from "react";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Message {
  payload: string;
  contentTopic: string;
  timestamp?: string;
  meta?: string;
  version?: number;
}

interface CommunityMetadata {
  name: string;
  contentTopic: string;
}

interface HealthResponse {
  nodeHealth: string;
  protocolsHealth: string[];
}

interface PriceData {
  bitcoin: { usd: number; usd_24h_change: number };
  ethereum: { usd: number; usd_24h_change: number };
  "usd-coin": { usd: number; usd_24h_change: number };
  veritaseum: { usd: number; usd_24h_change: number };
}

interface ProcessedSwapOffer {
  key: string;
  fromAsset: string;
  fromAmount: number | string;
  toAsset: string;
  toAmount: number | string;
  timestamp?: string;
  rate: string;
  fromDisplay: JSX.Element;
  toDisplay: JSX.Element;
  rawMessage: string;
  isDebugMode: boolean;
  isValidJSON: boolean;
  originalData: any;
  isMyOffer: boolean;
  creatorId?: string;
}

// NEW: Private chat interfaces
interface PrivateChatSession {
  sessionId: string;
  participants: string[];
  contentTopic: string;
  status: 'pending' | 'active' | 'completed';
  tradeOffer?: ProcessedSwapOffer;
  createdAt: number;
  lastActivity: number;
}

interface PrivateMessage {
  messageId: string;
  sessionId: string;
  senderId: string;
  messageType: 'chat' | 'offer' | 'counter_offer' | 'accept' | 'reject';
  content: string;
  timestamp: number;
}

interface TraderReputation {
  userId: string;
  rating: number;
  completedTrades: number;
  totalVolume: number;
  verificationLevel: 'unverified' | 'basic' | 'premium';
  lastUpdated: number;
}

// ============================================================================
// CONSTANTS AND CONFIGURATION
// ============================================================================

const SERVICE_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || "http://localhost:8645";
const BRIDGE_ENDPOINT = import.meta.env.VITE_BRIDGE_ENDPOINT || "http://localhost:8650";
const PRIVATE_CHAT_ENABLED = import.meta.env.VITE_ENABLE_PRIVATE_CHAT === "true";
const ENCRYPTION_ENABLED = import.meta.env.VITE_ENCRYPTION_ENABLED === "true";

const VERIDAO_ORANGE = "#FF8A00";
const MESSAGE_FETCH_DELAY = 1000;
const PRICE_UPDATE_INTERVAL = 30000;
const UPTIME_UPDATE_INTERVAL = 1000;
const REPUTATION_CACHE_TIME = 300000; // 5 minutes

// Default price data for fallback
const DEFAULT_PRICE_DATA: PriceData = {
  bitcoin: { usd: 66420.25, usd_24h_change: 2.34 },
  ethereum: { usd: 3200.50, usd_24h_change: 1.87 },
  "usd-coin": { usd: 1.00, usd_24h_change: 0.01 },
  veritaseum: { usd: 0.1234, usd_24h_change: -3.45 }
};

// ============================================================================
// UTILITY FUNCTIONS (Enhanced)
// ============================================================================

const bytesFromBase64 = (b64: string): Uint8Array =>
  Uint8Array.from(atob(b64), c => c.charCodeAt(0));

const base64FromBytes = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const encodeBase64Utf8 = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  return base64FromBytes(bytes);
};

const formatPrice = (price: number | null | undefined, decimals: number = 2): string => {
  if (price == null) return "0.00";
  return price.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

const formatChange = (change: number | null | undefined): string => {
  if (change == null) return "0.00";
  return (change >= 0 ? '+' : '') + change.toFixed(2);
};

const formatDate = (timestamp?: string | number): string => {
  try {
    if (!timestamp) return "";
    let ms: number;
    if (typeof timestamp === 'string') {
      const ns = BigInt(timestamp);
      ms = Number(ns / 1000000n);
    } else {
      ms = timestamp;
    }
    return new Date(ms).toLocaleString();
  } catch {
    return "";
  }
};

const generateDisplayName = (contentTopic: string): string => {
  try {
    const parts = contentTopic.split('/');
    if (parts.length < 4) return contentTopic;
    
    const app = parts[1];
    const topic = parts[3];
    
    if (app === 'waku' && topic === 'default-content') return 'waku';
    if (app === 'status') return 'status';
    
    if (topic !== 'proto' && topic !== app && topic !== 'default') {
      return `${app}/${topic}`;
    }
    
    return app;
  } catch {
    return contentTopic;
  }
};

const sanitizeCommunityName = (name: string): string => {
  return name.replace(/\s+/g, '-').replace(/[\/\\:*?"<>|]/g, '-');
};

const validateContentTopic = (topic: string): boolean => {
  if (!topic.startsWith('/')) return false;
  const parts = topic.split('/');
  return parts.length === 4 && parts[1] && parts[2] && parts[3];
};

const getAssetDisplay = (asset: string): JSX.Element => {
  const assetUpper = asset.toString().toUpperCase();
  switch (assetUpper) {
    case 'BTC':
    case 'BITCOIN':
      return <div className="w-4 h-4 bg-orange-500 rounded-full" />;
    case 'ETH':
    case 'ETHEREUM':
      return <div className="w-4 h-4 bg-gray-400 rounded-full" />;
    case 'USDC':
    case 'USD':
      return <div className="w-4 h-4 bg-blue-500 rounded-full" />;
    case 'VERI':
    case 'VERITASEUM':
      return <img src="https://activate.veri.vip/favicon.svg" alt="VERI" className="w-4 h-4" />;
    default:
      return <div className="w-4 h-4 bg-gray-500 rounded-full" />;
  }
};

// NEW: Generate secure session ID
const generateSecureId = (): string => {
  return crypto.getRandomValues(new Uint32Array(4)).reduce((acc, val) => acc + val.toString(16), '');
};

// ============================================================================
// NEW COMPONENTS FOR PRIVATE CHAT
// ============================================================================

/**
 * Reputation Display Component
 */
interface ReputationDisplayProps {
  userId: string;
  className?: string;
}

const ReputationDisplay = React.memo(({ userId, className = "" }: ReputationDisplayProps) => {
  const [reputation, setReputation] = useState<TraderReputation | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchReputation = async () => {
      if (!userId || !BRIDGE_ENDPOINT) return;
      
      setLoading(true);
      try {
        const response = await axios.get(`${BRIDGE_ENDPOINT}/api/reputation/${userId}`);
        setReputation(response.data);
      } catch (error) {
        console.error('Error fetching reputation:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReputation();
  }, [userId]);

  if (loading) {
    return <div className={`text-xs text-gray-400 ${className}`}>Loading...</div>;
  }

  if (!reputation) {
    return <div className={`text-xs text-gray-400 ${className}`}>No reputation data</div>;
  }

  const getVerificationIcon = () => {
    switch (reputation.verificationLevel) {
      case 'premium':
        return <Shield className="w-3 h-3 text-green-400" />;
      case 'basic':
        return <Shield className="w-3 h-3 text-blue-400" />;
      default:
        return <User className="w-3 h-3 text-gray-400" />;
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-1">
        {getVerificationIcon()}
        <div className="flex">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              size={10}
              className={i < Math.floor(reputation.rating) ? 'text-yellow-400 fill-current' : 'text-gray-600'}
            />
          ))}
        </div>
      </div>
      <span className="text-xs text-gray-400">
        {reputation.completedTrades} trades
      </span>
    </div>
  );
});

/**
 * Private Chat Window Component
 */
interface PrivateChatWindowProps {
  session: PrivateChatSession;
  currentUserId: string;
  onClose: () => void;
  onSendMessage: (sessionId: string, message: string, messageType: string) => void;
}

const PrivateChatWindow = React.memo(({ session, currentUserId, onClose, onSendMessage }: PrivateChatWindowProps) => {
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get other participant
  const otherParticipant = session.participants.find(p => p !== currentUserId) || "Unknown";

  // Fetch messages for this session
  useEffect(() => {
    const fetchMessages = async () => {
      if (!BRIDGE_ENDPOINT) return;
      
      setLoading(true);
      try {
        const response = await axios.get(
          `${BRIDGE_ENDPOINT}/api/chat/${session.sessionId}/messages?userId=${currentUserId}`
        );
        setMessages(response.data.messages || []);
      } catch (error) {
        console.error('Error fetching chat messages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
    
    // Poll for new messages every 2 seconds
    const interval = setInterval(fetchMessages, 2000);
    return () => clearInterval(interval);
  }, [session.sessionId, currentUserId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    
    onSendMessage(session.sessionId, newMessage, 'chat');
    setNewMessage("");
  };

  return (
    <Card className="bg-gray-800/95 border-gray-700 max-w-md w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Lock size={16} className="text-green-400" />
              Private Chat
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-400">with {otherParticipant}</span>
              <ReputationDisplay userId={otherParticipant} className="text-xs" />
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ×
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        {/* Messages */}
        <ScrollArea className="h-64 mb-4" ref={scrollRef}>
          <div className="space-y-2 pr-2">
            {loading && messages.length === 0 ? (
              <div className="text-center text-gray-400 py-4">Loading messages...</div>
            ) : messages.length === 0 ? (
              <div className="text-center text-gray-400 py-4">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No messages yet</p>
                <p className="text-xs">Start the conversation!</p>
              </div>
            ) : (
              messages.map(message => (
                <div
                  key={message.messageId}
                  className={`p-3 rounded-lg max-w-[80%] ${
                    message.senderId === currentUserId
                      ? "bg-blue-600/20 border-blue-500/30 ml-auto text-right"
                      : "bg-gray-700/50 border-gray-600/30"
                  }`}
                >
                  <div className="text-sm text-white">{message.content}</div>
                  <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Clock size={10} />
                    {formatDate(message.timestamp)}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Trade offer display */}
        {session.tradeOffer && (
          <div className="mb-4 p-3 bg-green-900/20 border border-green-600/30 rounded">
            <div className="text-sm text-green-400 font-medium mb-1">Trade Offer</div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                {session.tradeOffer.fromDisplay}
                <span>{session.tradeOffer.fromAmount} {session.tradeOffer.fromAsset}</span>
              </div>
              <ArrowUpDown size={14} className="text-gray-400" />
              <div className="flex items-center gap-2">
                {session.tradeOffer.toDisplay}
                <span>{session.tradeOffer.toAmount} {session.tradeOffer.toAsset}</span>
              </div>
            </div>
          </div>
        )}

        {/* Message input */}
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder="Type your message..."
            className="bg-gray-700 border-gray-600 text-white text-sm"
          />
          <Button
            onClick={handleSendMessage}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
            disabled={!newMessage.trim()}
          >
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

/**
 * Enhanced Swap Offers with Private Chat Integration
 */
interface EnhancedSwapOffersProps {
  messages: Message[];
  community?: CommunityMetadata;
  debugMode: boolean;
  username: string;
  onStartPrivateChat: (offer: ProcessedSwapOffer) => void;
}

const EnhancedSwapOffers = React.memo(({ messages, community, debugMode, username, onStartPrivateChat }: EnhancedSwapOffersProps) => {
  const [activeTab, setActiveTab] = useState<'all' | 'mine'>('all');
  
  const swapOffers = messages
    .filter(msg => msg.contentTopic === community?.contentTopic)
    .map((msg, index) => processSwapOffer(msg, index, debugMode, username))
    .filter((offer): offer is ProcessedSwapOffer => offer !== null);

  const filteredOffers = activeTab === 'mine'
    ? swapOffers.filter(offer => offer.isMyOffer)
    : swapOffers.filter(offer => !offer.isMyOffer);

  const myOffersCount = swapOffers.filter(o => o.isMyOffer).length;
  const othersOffersCount = swapOffers.filter(o => !o.isMyOffer).length;

  return (
    <div className="w-full max-w-lg mx-auto">
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-xl font-semibold">
                Swap Offers ({filteredOffers.length})
                {debugMode && <span className="text-yellow-400 text-sm ml-2">[DEBUG]</span>}
              </CardTitle>
            </div>
            
            <div className="flex gap-1 bg-gray-700/50 rounded-lg p-1">
              <Button
                variant={activeTab === 'all' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('all')}
                className={`flex-1 text-xs ${
                  activeTab === 'all'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'text-gray-300 hover:bg-gray-600'
                }`}
              >
                All Offers ({othersOffersCount})
              </Button>
              <Button
                variant={activeTab === 'mine' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('mine')}
                className={`flex-1 text-xs ${
                  activeTab === 'mine'
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'text-gray-300 hover:bg-gray-600'
                }`}
              >
                My Offers ({myOffersCount})
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-4">
          {filteredOffers.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">📭</div>
              <h3 className="text-lg font-semibold text-white mb-1">
                {activeTab === 'mine' ? 'No offers created' : 'No offers available'}
              </h3>
              <p className="text-gray-400 text-sm">
                {activeTab === 'mine'
                  ? "Create your first swap offer above"
                  : "No offers from other users found"
                }
              </p>
            </div>
          ) : (
            <div className="h-64 overflow-y-auto">
              <div className="space-y-2 pr-2">
                {filteredOffers.map(offer => (
                  <div
                    key={offer.key}
                    className={`rounded p-3 border ${
                      offer.isMyOffer
                        ? "bg-green-900/20 border-green-600/50"
                        : offer.isDebugMode && !offer.isValidJSON
                        ? "bg-yellow-900/20 border-yellow-600/50"
                        : offer.isDebugMode
                        ? "bg-blue-900/20 border-blue-600/50"
                        : "bg-gray-700/30 border-gray-600/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          {offer.fromDisplay}
                          <span className="font-medium text-white text-sm">
                            {offer.fromAmount} {offer.fromAsset}
                          </span>
                        </div>
                        <ArrowUpDown size={14} className="text-gray-400" />
                        <div className="flex items-center gap-2">
                          {offer.toDisplay}
                          <span className="font-medium text-white text-sm">
                            {offer.toAmount} {offer.toAsset}
                          </span>
                        </div>
                      </div>
                      
                      {/* NEW: Private chat button for other users' offers */}
                      {!offer.isMyOffer && PRIVATE_CHAT_ENABLED && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onStartPrivateChat(offer)}
                          className="text-xs bg-blue-900/20 border-blue-600/50 hover:bg-blue-800/30"
                        >
                          <MessageCircle size={12} className="mr-1" />
                          Chat
                        </Button>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between text-xs">
                      <div className="text-gray-300">Rate: {offer.rate}</div>
                      <div className="text-gray-400">{formatDate(offer.timestamp)}</div>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={offer.isMyOffer ? "default" : "secondary"} className="text-xs">
                        {offer.isMyOffer ? "SENT" : "RECEIVED"}
                      </Badge>
                      {offer.isDebugMode && (
                        <Badge variant={offer.isValidJSON ? "default" : "destructive"} className="text-xs">
                          {offer.isValidJSON ? "JSON" : "RAW"}
                        </Badge>
                      )}
                      {offer.creatorId && !offer.isMyOffer && (
                        <ReputationDisplay userId={offer.creatorId} className="ml-auto" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

// ============================================================================
// MAIN APPLICATION COMPONENT (Enhanced)
// ============================================================================

function App() {
  // ========== EXISTING STATE ==========
  const [newMessage, setNewMessage] = useState("");
  const [username, setUsername] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tempUsername, setTempUsername] = useState("");
  const [debugMode, setDebugMode] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  
  const [community, setCommunity] = useState<CommunityMetadata | undefined>(undefined);
  const [joinedCommunities, setJoinedCommunities] = useState<CommunityMetadata[]>([]);
  const [communityName, setCommunityName] = useState("");
  const [fullContentTopic, setFullContentTopic] = useState("");
  
  const [fromAsset, setFromAsset] = useState("BTC");
  const [fromAmount, setFromAmount] = useState("");
  const [toAsset, setToAsset] = useState("USDC");
  const [toAmount, setToAmount] = useState("");
  const [lastEditedField, setLastEditedField] = useState<'from' | 'to'>('from');
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesSent, setMessagesSent] = useState(0);
  const [messagesReceived, setMessagesReceived] = useState(0);
  
  const [nwakuVersion, setNwakuVersion] = useState("");
  const [health, setHealth] = useState<HealthResponse>();
  const [numPeers, setNumPeers] = useState("");
  const [uptime, setUptime] = useState("");
  const [priceData, setPriceData] = useState<PriceData>(DEFAULT_PRICE_DATA);

  // ========== NEW STATE FOR PRIVATE CHAT ==========
  const [privateChatSessions, setPrivateChatSessions] = useState<Map<string, PrivateChatSession>>(new Map());
  const [activePrivateChats, setActivePrivateChats] = useState<string[]>([]);
  const [bridgeConnected, setBridgeConnected] = useState(false);

  // ========== INITIALIZATION (Enhanced) ==========
  useEffect(() => {
    const name = localStorage.getItem("username") || "";
    setUsername(name);
    setTempUsername(name);
    
    const localCommunity = localStorage.getItem("community");
    setCommunity(localCommunity ? JSON.parse(localCommunity) : undefined);
    
    const communities = localStorage.getItem("communities");
    if (communities) {
      setJoinedCommunities(JSON.parse(communities));
    }
    
    setMessagesSent(parseInt(localStorage.getItem("messagesSent") || "0"));
    setMessagesReceived(parseInt(localStorage.getItem("messagesReceived") || "0"));
    setDebugMode(localStorage.getItem("debugMode") === "true");
    setAdvancedMode(localStorage.getItem("advancedMode") === "true");

    // NEW: Check bridge connectivity
    if (BRIDGE_ENDPOINT && PRIVATE_CHAT_ENABLED) {
      checkBridgeHealth();
    }
  }, []);

  // ========== NEW FUNCTIONS FOR PRIVATE CHAT ==========
  
  const checkBridgeHealth = useCallback(async () => {
    try {
      const response = await axios.get(`${BRIDGE_ENDPOINT}/health`);
      setBridgeConnected(response.status === 200);
    } catch (error) {
      console.error('Bridge health check failed:', error);
      setBridgeConnected(false);
    }
  }, []);

  const createPrivateChat = useCallback(async (offer: ProcessedSwapOffer): Promise<string | null> => {
    if (!BRIDGE_ENDPOINT || !username) return null;

    try {
      const response = await axios.post(`${BRIDGE_ENDPOINT}/api/chat/create`, {
        participants: [username, offer.creatorId || 'unknown'],
        tradeOfferId: offer.key
      });

      const session: PrivateChatSession = {
        sessionId: response.data.sessionId,
        participants: response.data.participants,
        contentTopic: response.data.contentTopic,
        status: response.data.status,
        tradeOffer: offer,
        createdAt: Date.now(),
        lastActivity: Date.now()
      };

      // Update local state
      const newSessions = new Map(privateChatSessions);
      newSessions.set(session.sessionId, session);
      setPrivateChatSessions(newSessions);

      toast.success('Private chat session created');
      return session.sessionId;
    } catch (error) {
      console.error('Error creating private chat:', error);
      toast.error('Failed to create private chat');
      return null;
    }
  }, [BRIDGE_ENDPOINT, username, privateChatSessions]);

  const handleStartPrivateChat = useCallback(async (offer: ProcessedSwapOffer) => {
    const sessionId = await createPrivateChat(offer);
    if (sessionId) {
      setActivePrivateChats(prev => [...prev, sessionId]);
    }
  }, [createPrivateChat]);

  const sendPrivateMessage = useCallback(async (sessionId: string, message: string, messageType: string = 'chat') => {
    if (!BRIDGE_ENDPOINT || !username) return;

    try {
      await axios.post(`${BRIDGE_ENDPOINT}/api/chat/${sessionId}/message`, {
        senderId: username,
        messageType,
        content: message
      });

      // Update last activity
      const session = privateChatSessions.get(sessionId);
      if (session) {
        session.lastActivity = Date.now();
        const newSessions = new Map(privateChatSessions);
        newSessions.set(sessionId, session);
        setPrivateChatSessions(newSessions);
      }

      toast.success('Message sent');
    } catch (error) {
      console.error('Error sending private message:', error);
      toast.error('Failed to send message');
    }
  }, [BRIDGE_ENDPOINT, username, privateChatSessions]);

  const closePrivateChat = useCallback((sessionId: string) => {
    setActivePrivateChats(prev => prev.filter(id => id !== sessionId));
  }, []);

  // ========== EXISTING FUNCTIONS (Price conversion, etc.) ==========
  
  const calculateConversion = useCallback((amount: string, fromAssetType: string, toAssetType: string): string => {
    if (!amount) return "";
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return "";

    const getPrice = (asset: string) => {
      switch (asset) {
        case 'BTC': return priceData.bitcoin.usd;
        case 'ETH': return priceData.ethereum.usd;
        case 'USDC': return priceData["usd-coin"].usd;
        case 'VERI': return priceData.veritaseum.usd;
        default: return 1;
      }
    };

    const fromPrice = getPrice(fromAssetType);
    const toPrice = getPrice(toAssetType);
    const usdValue = numAmount * fromPrice;
    const convertedAmount = usdValue / toPrice;
    const decimals = toAssetType === 'USDC' ? 3 : 5;
    
    return convertedAmount.toFixed(decimals).replace(/\.?0+$/, '');
  }, [priceData]);

  const handleFromAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFromAmount(value);
    setLastEditedField('from');
    
    if (value && (lastEditedField === 'from' || !toAmount)) {
      const converted = calculateConversion(value, fromAsset, toAsset);
      if (converted) {
        setToAmount(converted);
      }
    } else if (!value) {
      setToAmount("");
    }
  }, [lastEditedField, toAmount, calculateConversion, fromAsset, toAsset]);

  const handleToAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setToAmount(value);
    setLastEditedField('to');
    
    if (value && (lastEditedField === 'to' || !fromAmount)) {
      const converted = calculateConversion(value, toAsset, fromAsset);
      if (converted) {
        setFromAmount(converted);
      }
    } else if (!value) {
      setFromAmount("");
    }
  }, [lastEditedField, fromAmount, calculateConversion, toAsset, fromAsset]);

  // ========== DATA FETCHING (Same as before) ==========
  
  const fetchPrices = useCallback(async () => {
    try {
      const response = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,usd-coin,veritaseum&vs_currencies=usd&include_24hr_change=true',
        { timeout: 10000 }
      );
      setPriceData(prevData => ({
        bitcoin: response.data.bitcoin || prevData.bitcoin,
        ethereum: response.data.ethereum || prevData.ethereum,
        "usd-coin": response.data["usd-coin"] || prevData["usd-coin"],
        veritaseum: response.data.veritaseum || prevData.veritaseum
      }));
    } catch (error) {
      console.warn("Failed to fetch prices:", error);
    }
  }, []);

  const fetchSystemData = useCallback(async () => {
    try {
      const [versionRes, healthRes, peersRes] = await Promise.all([
        axios.get(`${SERVICE_ENDPOINT}/debug/v1/version`).catch(() => ({ data: "unknown" })),
        axios.get(`${SERVICE_ENDPOINT}/health`).catch(() => ({ data: { nodeHealth: "unknown" } })),
        axios.get(`${SERVICE_ENDPOINT}/admin/v1/peers`).catch(() => ({ data: [] }))
      ]);
      setNwakuVersion(versionRes.data);
      setHealth(healthRes.data);
      setNumPeers(String(Array.isArray(peersRes.data) ? peersRes.data.length : 0));
    } catch (error) {
      console.error("Error fetching system data:", error);
    }
  }, []);

  const fetchAllMessages = useCallback(async () => {
    try {
      if (!joinedCommunities.length) {
        setMessages([]);
        return;
      }

      const params = new URLSearchParams();
      joinedCommunities.forEach(c => params.append("contentTopics", c.contentTopic));
      params.set("includeData", "true");
      params.set("ascending", "false");
      params.set("pageSize", "200");
      
      const response = await axios.get(`${SERVICE_ENDPOINT}/store/v1/messages?${params.toString()}`);
      const newMessages = response.data.messages || [];
      
      const sortedMessages = newMessages.sort((a: Message, b: Message) => {
        const timeA = a.timestamp ? BigInt(a.timestamp) : BigInt(0);
        const timeB = b.timestamp ? BigInt(b.timestamp) : BigInt(0);
        return Number(timeB - timeA);
      });
      
      setMessages(sortedMessages);
      setMessagesReceived(sortedMessages.length);
      localStorage.setItem("messagesReceived", sortedMessages.length.toString());
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  }, [joinedCommunities]);

  // ========== EFFECTS ==========
  
  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, PRICE_UPDATE_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  useEffect(() => {
    fetchSystemData();
  }, [fetchSystemData]);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      setUptime(`${minutes}m ${seconds}s`);
    }, UPTIME_UPDATE_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchAllMessages();
  }, [fetchAllMessages]);

  // NEW: Check bridge health periodically
  useEffect(() => {
    if (BRIDGE_ENDPOINT && PRIVATE_CHAT_ENABLED) {
      const interval = setInterval(checkBridgeHealth, 30000);
      return () => clearInterval(interval);
    }
  }, [checkBridgeHealth]);

  // ========== ACTION HANDLERS (Same as before + new ones) ==========
  
  const createUser = useCallback(() => {
    if (usernameInput.trim()) {
      localStorage.setItem("username", usernameInput);
      setUsername(usernameInput);
    }
  }, [usernameInput]);

  const createCommunity = useCallback(() => {
    let contentTopic: string;
    let displayName: string;

    if (advancedMode) {
      if (!fullContentTopic.trim()) {
        toast.error("Content topic is empty");
        return;
      }
      
      if (!validateContentTopic(fullContentTopic)) {
        toast.error("Invalid content topic format. Expected: /app/version/topic/encoding");
        return;
      }
      
      contentTopic = fullContentTopic.trim();
      displayName = generateDisplayName(contentTopic);
    } else {
      if (!communityName.trim()) {
        toast.error("Community name is empty");
        return;
      }
      
      const sanitizedName = sanitizeCommunityName(communityName);
      contentTopic = sanitizedName === "swap-offers"
        ? "/swap-offers/1/offer/proto"
        : `/waku/1/${sanitizedName}/proto`;
      displayName = communityName;
    }

    const payload: CommunityMetadata = {
      name: displayName,
      contentTopic
    };

    const exists = joinedCommunities.some((c) => c.contentTopic === payload.contentTopic);
    if (exists) {
      toast.error("Already joined this community");
      return;
    }

    const joined = [...joinedCommunities, payload];
    setJoinedCommunities(joined);
    localStorage.setItem("communities", JSON.stringify(joined));
    setCommunity(payload);
    localStorage.setItem("community", JSON.stringify(payload));
    
    setCommunityName("");
    setFullContentTopic("");
    
    toast.success(`Joined ${displayName}`);
  }, [advancedMode, fullContentTopic, communityName, joinedCommunities]);

  const selectCommunity = useCallback((index: number) => {
    const selected = joinedCommunities[index];
    setCommunity(selected);
    localStorage.setItem("community", JSON.stringify(selected));
  }, [joinedCommunities]);

  const deleteCommunity = useCallback((index: number) => {
    const joined = joinedCommunities.filter((_, i) => i !== index);
    setJoinedCommunities(joined);
    localStorage.setItem("communities", JSON.stringify(joined));
    
    if (joined.length > 0) {
      setCommunity(joined[0]);
      localStorage.setItem("community", JSON.stringify(joined[0]));
    } else {
      setCommunity(undefined);
      localStorage.removeItem("community");
    }
  }, [joinedCommunities]);

  const sendMessage = useCallback(async (customMessage?: string) => {
    if (!community) {
      toast.error("No community selected");
      return;
    }
    
    const text = (customMessage ?? `${username || "Anonymous"}: ${newMessage}`).trim();
    if (!text) {
      toast.error("Message cannot be empty");
      return;
    }

    try {
      await axios.post(`${SERVICE_ENDPOINT}/relay/v1/auto/messages`, {
        payload: encodeBase64Utf8(text),
        contentTopic: community.contentTopic,
      });
      
      if (!customMessage) setNewMessage("");
      
      setMessagesSent(prev => {
        const newSent = prev + 1;
        localStorage.setItem("messagesSent", newSent.toString());
        return newSent;
      });
      
      toast.success("Message sent successfully");
      setTimeout(() => fetchAllMessages(), MESSAGE_FETCH_DELAY);
    } catch (error: any) {
      toast.error(`Error sending message: ${error?.response?.status || "Unknown error"}`);
    }
  }, [community, username, newMessage, fetchAllMessages]);

  const sendSwapOffer = useCallback(() => {
    if (!fromAmount || !toAmount) {
      toast.error("Both amounts are required");
      return;
    }
    
    const offer = {
      fromAsset,
      fromAmount: parseFloat(fromAmount),
      toAsset,
      toAmount: parseFloat(toAmount),
      timestamp: Date.now(),
    };
    
    sendMessage(JSON.stringify(offer));
    setFromAmount("");
    setToAmount("");
  }, [fromAmount, toAmount, fromAsset, toAsset, sendMessage]);

  const swapAssets = useCallback(() => {
    const tempAsset = fromAsset;
    const tempAmount = fromAmount;
    setFromAsset(toAsset);
    setFromAmount(toAmount);
    setToAsset(tempAsset);
    setToAmount(tempAmount);
  }, [fromAsset, fromAmount, toAsset, toAmount]);

  const handleSettingsSave = useCallback(() => {
    if (tempUsername !== username) {
      setUsername(tempUsername);
      localStorage.setItem("username", tempUsername);
      toast.success("Username updated");
    }
    localStorage.setItem("debugMode", debugMode.toString());
    localStorage.setItem("advancedMode", advancedMode.toString());
    setSettingsOpen(false);
  }, [tempUsername, username, debugMode, advancedMode]);

  const getHealthIndicator = useCallback(() => {
    if (!health) return "🔴";
    const nodeHealth = health.nodeHealth?.toLowerCase().trim();
    return ["ready", "ok", "healthy", "up"].includes(nodeHealth) ? "🟢" : "🔴";
  }, [health]);

  // ========== RENDER ==========

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 pb-20">
      {/* Price Bar */}
      {username && joinedCommunities.length > 0 && community?.name === "swap-offers" && (
        <PriceBar priceData={priceData} />
      )}

      {/* Private Chat Windows (NEW) */}
      {PRIVATE_CHAT_ENABLED && activePrivateChats.length > 0 && (
        <div className="fixed bottom-24 right-4 flex flex-col gap-4 z-50 max-h-[70vh] overflow-y-auto">
          {activePrivateChats.map(sessionId => {
            const session = privateChatSessions.get(sessionId);
            if (!session) return null;
            
            return (
              <PrivateChatWindow
                key={sessionId}
                session={session}
                currentUserId={username}
                onClose={() => closePrivateChat(sessionId)}
                onSendMessage={sendPrivateMessage}
              />
            );
          })}
        </div>
      )}

      {/* Right Sidebar */}
      {username && joinedCommunities.length > 0 && (
        <RightSidebar
          username={username}
          settingsOpen={settingsOpen}
          setSettingsOpen={setSettingsOpen}
          tempUsername={tempUsername}
          setTempUsername={setTempUsername}
          handleSettingsSave={handleSettingsSave}
          joinedCommunities={joinedCommunities}
          setJoinedCommunities={setJoinedCommunities}
          community={community}
          selectCommunity={selectCommunity}
          deleteCommunity={deleteCommunity}
          communityName={communityName}
          setCommunityName={setCommunityName}
          createCommunity={createCommunity}
          isSwapOffers={community?.name === "swap-offers"}
          debugMode={debugMode}
          setDebugMode={setDebugMode}
          advancedMode={advancedMode}
          setAdvancedMode={setAdvancedMode}
          fullContentTopic={fullContentTopic}
          setFullContentTopic={setFullContentTopic}
        />
      )}

      {/* Username Setup Screen */}
      {!username && (
        <div className="flex flex-col items-center justify-center min-h-screen gap-6">
          <h1 className="text-2xl font-bold text-white">Welcome to VeTest</h1>
          <div className="space-y-4">
            <Input
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="Enter your username"
              className="bg-gray-700 border-gray-600 text-white"
            />
            <Button onClick={createUser} className="w-full bg-blue-600 hover:bg-blue-700">
              Create Profile
            </Button>
          </div>
        </div>
      )}

      {/* Community Setup Screen */}
      {username && joinedCommunities.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-screen gap-6">
          <h1 className="text-2xl font-bold text-white">Join a Community</h1>
          <div className="space-y-4">
            {advancedMode ? (
              <div className="space-y-2">
                <Label className="text-sm text-gray-400">Full Content Topic</Label>
                <Input
                  value={fullContentTopic}
                  onChange={(e) => setFullContentTopic(e.target.value)}
                  placeholder="/my-app/1/community/proto"
                  className="bg-gray-700 border-gray-600 text-white font-mono"
                />
                <div className="text-xs text-gray-500">
                  Format: /application/version/topic/encoding
                </div>
              </div>
            ) : (
              <Input
                value={communityName}
                onChange={(e) => setCommunityName(e.target.value)}
                placeholder="Enter community name (e.g., swap-offers)"
                className="bg-gray-700 border-gray-600 text-white"
              />
            )}
            
            <Button
              onClick={createCommunity}
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={advancedMode ? !fullContentTopic.trim() : !communityName.trim()}
            >
              Join Community
            </Button>
          </div>
        </div>
      )}

      {/* Main Interface */}
      {username && joinedCommunities.length > 0 && (
        <div className={`flex flex-col items-center p-8 ${community?.name === "swap-offers" ? "pt-20" : "pt-8"} pr-80 space-y-6`}>
          {community?.name === "swap-offers" ? (
            <>
              <SwapInterface
                fromAsset={fromAsset}
                setFromAsset={setFromAsset}
                fromAmount={fromAmount}
                handleFromAmountChange={handleFromAmountChange}
                toAsset={toAsset}
                setToAsset={setToAsset}
                toAmount={toAmount}
                handleToAmountChange={handleToAmountChange}
                swapAssets={swapAssets}
                sendSwapOffer={sendSwapOffer}
              />
              <EnhancedSwapOffers
                messages={messages}
                community={community}
                debugMode={debugMode}
                username={username}
                onStartPrivateChat={handleStartPrivateChat}
              />
            </>
          ) : (
            <div className="w-full max-w-4xl space-y-6">
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader className="flex flex-row items-center justify-between py-3">
                  <CardTitle className="text-white text-lg">Message History</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <ScrollArea className="h-80">
                    <div className="space-y-2">
                      {messages
                        .filter(msg => msg.contentTopic === community.contentTopic)
                        .map((msg, index) => {
                          try {
                            const rawBytes = bytesFromBase64(msg.payload);
                            const payloadText = new TextDecoder().decode(rawBytes);
                            return (
                              <div key={`${msg.timestamp}-${index}`} className="text-gray-200 py-1 text-sm">
                                {payloadText}
                                <span className="text-gray-400 text-xs ml-2">
                                  {formatDate(msg.timestamp)}
                                </span>
                              </div>
                            );
                          } catch {
                            return null;
                          }
                        })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
              
              <div className="flex gap-2 max-w-md mx-auto">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Type your message here"
                  className="bg-gray-700 border-gray-600 text-white"
                />
                <Button onClick={() => sendMessage()} className="bg-blue-600 hover:bg-blue-700">
                  Send
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Enhanced Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-3">
        <div className="flex justify-center">
          <div className="flex gap-6 text-sm text-gray-300">
            <span>Health: {getHealthIndicator()}</span>
            <span>Nwaku: {nwakuVersion}</span>
            <span>Peers: {numPeers}</span>
            <span>Sent: {messagesSent}</span>
            <span>Received: {messagesReceived}</span>
            <span>Uptime: {uptime}</span>
            {PRIVATE_CHAT_ENABLED && (
              <span className={`flex items-center gap-1 ${bridgeConnected ? 'text-green-400' : 'text-red-400'}`}>
                <Lock size={12} />
                Bridge: {bridgeConnected ? '🟢' : '🔴'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Keep existing utility functions and components...
const PriceBar = React.memo(({ priceData }: { priceData: PriceData }) => (
  <>
    <style>{`
      @keyframes scroll {
        0% { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }
      .animate-scroll {
        animation: scroll 30s linear infinite;
      }
    `}</style>
    <div className="fixed top-0 left-0 right-0 bg-gray-800 border-b border-gray-700 p-3 z-40 overflow-hidden">
      <div className="animate-scroll whitespace-nowrap">
        <div className="inline-flex gap-8">
          {[...Array(2)].map((_, setIndex) => (
            <React.Fragment key={setIndex}>
              <PriceItem
                icon={<div className="w-4 h-4 bg-orange-500 rounded-full" />}
                name="Bitcoin"
                price={priceData.bitcoin?.usd}
                change={priceData.bitcoin?.usd_24h_change}
              />
              <PriceItem
                icon={<div className="w-4 h-4 bg-gray-400 rounded-full" />}
                name="Ethereum"
                price={priceData.ethereum?.usd}
                change={priceData.ethereum?.usd_24h_change}
              />
              <PriceItem
                icon={<div className="w-4 h-4 bg-blue-500 rounded-full" />}
                name="USDC"
                price={priceData["usd-coin"]?.usd}
                change={priceData["usd-coin"]?.usd_24h_change}
                decimals={4}
              />
              <PriceItem
                icon={<img src="https://activate.veri.vip/favicon.svg" alt="VERI" className="w-4 h-4" />}
                name="VERI"
                price={priceData.veritaseum?.usd}
                change={priceData.veritaseum?.usd_24h_change}
                decimals={4}
              />
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  </>
));

interface PriceItemProps {
  icon: JSX.Element;
  name: string;
  price?: number;
  change?: number;
  decimals?: number;
}

const PriceItem: React.FC<PriceItemProps> = ({ icon, name, price, change, decimals = 2 }) => (
  <div className="flex items-center gap-3">
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-white font-medium text-sm">{name}</span>
    </div>
    <div className="text-white font-bold">${formatPrice(price, decimals)}</div>
    <div className={`flex items-center gap-1 ${(change || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
      {(change || 0) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      <span className="text-xs">{formatChange(change)}%</span>
    </div>
  </div>
);

// Include all your existing components (RightSidebar, SwapInterface, etc.)
// ... (keeping the same implementations as before)

const processSwapOffer = (msg: Message, index: number, debugMode: boolean, username: string): ProcessedSwapOffer | null => {
  try {
    const rawBytes = bytesFromBase64(msg.payload);
    const payloadText = new TextDecoder().decode(rawBytes);
    
    const isMyOffer = (
      payloadText.includes(`"${username}"`) ||
      payloadText.includes(`"${username}":`) ||
      payloadText.startsWith(`${username}:`) ||
      (payloadText.includes('"fromAsset"') &&
       payloadText.includes('"fromAmount"') &&
       payloadText.includes('"toAsset"') &&
       payloadText.includes('"toAmount"') &&
       payloadText.includes('"timestamp"') &&
       !payloadText.includes('"offer"') &&
       !payloadText.includes('"id"') &&
       !payloadText.includes('"type"') &&
       !payloadText.includes('"maker"') &&
       !payloadText.includes('"clientId"'))
    );
    
    if (debugMode && msg.timestamp) {
      let parsedData: any = null;
      let isValidJSON = false;
      
      try {
        parsedData = JSON.parse(payloadText);
        isValidJSON = true;
      } catch (e) {
        // Not JSON, will use raw text parsing
      }
      
      let fromAsset = "Unknown";
      let toAsset = "Unknown";
      let fromAmount: number | string = "?";
      let toAmount: number | string = "?";
      let creatorId = username;
      
      if (isValidJSON && parsedData) {
        if (parsedData.offer) {
          const offer = parsedData.offer;
          fromAsset = typeof offer.fromAsset === 'object' && offer.fromAsset.symbol
            ? offer.fromAsset.symbol.toString().toUpperCase()
            : offer.fromAsset?.toString().toUpperCase() || "Unknown";
          toAsset = typeof offer.toAsset === 'object' && offer.toAsset.symbol
            ? offer.toAsset.symbol.toString().toUpperCase()
            : offer.toAsset?.toString().toUpperCase() || "Unknown";
          fromAmount = offer.fromAmount !== undefined ? parseFloat(offer.fromAmount.toString()) || offer.fromAmount : "?";
          toAmount = offer.toAmount !== undefined ? parseFloat(offer.toAmount.toString()) || offer.toAmount : "?";
          creatorId = offer.creatorId || parsedData.creatorId || username;
        } else if (parsedData.from && parsedData.to) {
          fromAsset = parsedData.from.asset?.toString().toUpperCase() || "Unknown";
          toAsset = parsedData.to.asset?.toString().toUpperCase() || "Unknown";
          fromAmount = parsedData.from.amount !== undefined ? parseFloat(parsedData.from.amount.toString()) || parsedData.from.amount : "?";
          toAmount = parsedData.to.amount !== undefined ? parseFloat(parsedData.to.amount.toString()) || parsedData.to.amount : "?";
        } else {
          fromAsset = parsedData.fromAsset?.toString().toUpperCase() || "Unknown";
          toAsset = parsedData.toAsset?.toString().toUpperCase() || "Unknown";
          fromAmount = parsedData.fromAmount !== undefined ? parseFloat(parsedData.fromAmount.toString()) || parsedData.fromAmount : "?";
          toAmount = parsedData.toAmount !== undefined ? parseFloat(parsedData.toAmount.toString()) || parsedData.toAmount : "?";
        }
      } else {
        const assetRegex = /(BTC|ETH|USDC|VERI|bitcoin|ethereum|Bitcoin|Ethereum)/gi;
        const foundAssets = payloadText.match(assetRegex);
        if (foundAssets?.length >= 2) {
          fromAsset = foundAssets[0].toUpperCase();
          toAsset = foundAssets[1].toUpperCase();
        } else if (foundAssets?.length === 1) {
          fromAsset = foundAssets[0].toUpperCase();
        }
        
        const numberRegex = /\d+\.?\d*/g;
        const foundNumbers = payloadText.match(numberRegex);
        if (foundNumbers?.length >= 2) {
          fromAmount = parseFloat(foundNumbers[0]) || foundNumbers[0];
          toAmount = parseFloat(foundNumbers[1]) || foundNumbers[1];
        } else if (foundNumbers?.length === 1) {
          fromAmount = parseFloat(foundNumbers[0]) || foundNumbers[0];
        }
      }
      
      const numFromAmount = typeof fromAmount === 'number' ? fromAmount : parseFloat(fromAmount.toString()) || 0;
      const numToAmount = typeof toAmount === 'number' ? toAmount : parseFloat(toAmount.toString()) || 0;
      const rate = (numFromAmount > 0 && numToAmount > 0) ? (numToAmount / numFromAmount).toFixed(4) : 'N/A';
      
      return {
        key: `${msg.timestamp ?? Date.now()}-${index}`,
        fromAsset: fromAsset.toString(),
        fromAmount: fromAmount,
        toAsset: toAsset.toString(),
        toAmount: toAmount,
        timestamp: msg.timestamp,
        rate,
        fromDisplay: getAssetDisplay(fromAsset),
        toDisplay: getAssetDisplay(toAsset),
        rawMessage: payloadText,
        isDebugMode: true,
        isValidJSON,
        originalData: parsedData,
        isMyOffer,
        creatorId: isMyOffer ? username : creatorId
      };
    }
    
    if (!debugMode) {
      let offer;
      try {
        offer = JSON.parse(payloadText);
      } catch {
        return null;
      }
      
      let fromAsset, toAsset, fromAmount, toAmount, creatorId = username;
      
      if (offer.offer) {
        const offerData = offer.offer;
        fromAsset = typeof offerData.fromAsset === 'object' && offerData.fromAsset.symbol
          ? offerData.fromAsset.symbol
          : offerData.fromAsset;
        toAsset = typeof offerData.toAsset === 'object' && offerData.toAsset.symbol
          ? offerData.toAsset.symbol
          : offerData.toAsset;
        fromAmount = offerData.fromAmount;
        toAmount = offerData.toAmount;
        creatorId = offerData.creatorId || offer.creatorId || username;
      } else if (offer.from && offer.to) {
        fromAsset = offer.from.asset;
        toAsset = offer.to.asset;
        fromAmount = offer.from.amount;
        toAmount = offer.to.amount;
      } else {
        fromAsset = offer.fromAsset;
        toAsset = offer.toAsset;
        fromAmount = offer.fromAmount;
        toAmount = offer.toAmount;
      }
      
      if (!fromAsset || !toAsset || (!fromAmount && fromAmount !== 0) || (!toAmount && toAmount !== 0)) {
        return null;
      }
      
      const numFromAmount = parseFloat(fromAmount.toString());
      const numToAmount = parseFloat(toAmount.toString());
      
      return {
        key: `${msg.timestamp ?? Date.now()}-${index}`,
        fromAsset: fromAsset.toString().toUpperCase(),
        fromAmount: numFromAmount,
        toAsset: toAsset.toString().toUpperCase(),
        toAmount: numToAmount,
        timestamp: msg.timestamp,
        rate: numFromAmount > 0 ? (numToAmount / numFromAmount).toFixed(4) : '0',
        fromDisplay: getAssetDisplay(fromAsset.toString()),
        toDisplay: getAssetDisplay(toAsset.toString()),
        rawMessage: payloadText,
        isDebugMode: false,
        isValidJSON: true,
        originalData: offer,
        isMyOffer,
        creatorId: isMyOffer ? username : creatorId
      };
    }
    
    return null;
    
  } catch (error) {
    console.error("Error processing swap offer:", error);
    return null;
  }
};

// Include your existing RightSidebar and SwapInterface components here
// (keeping the same implementations as in your original file)

export default App;
