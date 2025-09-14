/**
 * VeTest P2P Chat Application
 * A decentralized chat and swap interface using Waku protocol
 * Features: P2P messaging, asset swap offers, community management, price tracking
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
import axios from "axios";
import { Settings, ArrowUpDown, TrendingUp, TrendingDown, Trash2 } from "lucide-react";
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
}

// ============================================================================
// CONSTANTS AND CONFIGURATION
// ============================================================================

const SERVICE_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || "http://localhost:8645";
const VERIDAO_ORANGE = "#FF8A00";
const MESSAGE_FETCH_DELAY = 1000; // Delay after sending message before refetch
const PRICE_UPDATE_INTERVAL = 30000; // 30 seconds
const UPTIME_UPDATE_INTERVAL = 1000; // 1 second

// Default price data for fallback
const DEFAULT_PRICE_DATA: PriceData = {
  bitcoin: { usd: 66420.25, usd_24h_change: 2.34 },
  ethereum: { usd: 3200.50, usd_24h_change: 1.87 },
  "usd-coin": { usd: 1.00, usd_24h_change: 0.01 },
  veritaseum: { usd: 0.1234, usd_24h_change: -3.45 }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * UTF-8 safe base64 encoding/decoding utilities
 */
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

/**
 * Format price with specified decimal places
 */
const formatPrice = (price: number | null | undefined, decimals: number = 2): string => {
  if (price == null) return "0.00";
  return price.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

/**
 * Format price change percentage with sign
 */
const formatChange = (change: number | null | undefined): string => {
  if (change == null) return "0.00";
  return (change >= 0 ? '+' : '') + change.toFixed(2);
};

/**
 * Format timestamp from nanoseconds to human readable
 */
const formatDate = (timestamp?: string): string => {
  try {
    if (!timestamp) return "";
    const ns = BigInt(timestamp);
    const ms = Number(ns / 1000000n);
    return new Date(ms).toLocaleString();
  } catch {
    return "";
  }
};

/**
 * Generate display name from content topic
 */
const generateDisplayName = (contentTopic: string): string => {
  try {
    const parts = contentTopic.split('/');
    if (parts.length < 4) return contentTopic;
    
    const app = parts[1];
    const topic = parts[3];
    
    // Special cases for common patterns
    if (app === 'waku' && topic === 'default-content') return 'waku';
    if (app === 'status') return 'status';
    
    // For apps with multiple topics, include the topic name
    if (topic !== 'proto' && topic !== app && topic !== 'default') {
      return `${app}/${topic}`;
    }
    
    return app;
  } catch {
    return contentTopic;
  }
};

/**
 * Sanitize community names for content topic format
 */
const sanitizeCommunityName = (name: string): string => {
  return name.replace(/\s+/g, '-').replace(/[\/\\:*?"<>|]/g, '-');
};

/**
 * Validate content topic format
 */
const validateContentTopic = (topic: string): boolean => {
  if (!topic.startsWith('/')) return false;
  const parts = topic.split('/');
  return parts.length === 4 && parts[1] && parts[2] && parts[3];
};

/**
 * Get asset display component based on asset type
 */
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

/**
 * Parse amount safely from various input types
 */
const parseAmount = (value: any): number => {
  if (typeof value === 'number') {
    return isFinite(value) ? value : 0;
  }
  
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isFinite(parsed) ? parsed : 0;
  }
  
  if (value && typeof value === 'object' && value.amount !== undefined) {
    return parseAmount(value.amount);
  }
  
  return 0;
};

/**
 * Calculate exchange rate between two amounts
 */
const calculateRate = (fromAmount: number, toAmount: number, fromAsset: string, toAsset: string): string => {
  if (!fromAmount || !toAmount || !isFinite(fromAmount) || !isFinite(toAmount) || fromAmount <= 0) {
    return 'N/A';
  }
  
  const rate = toAmount / fromAmount;
  if (!isFinite(rate)) {
    return 'N/A';
  }
  
  // Format rate with appropriate decimals based on magnitude
  let decimals = 4;
  if (rate >= 1000) decimals = 2;
  else if (rate >= 100) decimals = 3;
  else if (rate < 0.0001) decimals = 8;
  
  return rate.toFixed(decimals);
};

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * Scrolling Price Bar Component
 * Displays real-time cryptocurrency prices with 24h changes
 */
type PriceBarProps = { priceData: PriceData };
const PriceBar = React.memo(({ priceData }: PriceBarProps) => (
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
          {/* Render price items twice for seamless scroll */}
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

/**
 * Individual price item component
 */
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

/**
 * Right Sidebar Component
 * Contains user settings, community management, and configuration options
 */
interface RightSidebarProps {
  username: string;
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  tempUsername: string;
  setTempUsername: (v: string) => void;
  handleSettingsSave: () => void;
  joinedCommunities: CommunityMetadata[];
  setJoinedCommunities: (communities: CommunityMetadata[]) => void;
  community?: CommunityMetadata;
  selectCommunity: (index: number) => void;
  deleteCommunity: (index: number) => void;
  communityName: string;
  setCommunityName: (v: string) => void;
  createCommunity: () => void;
  isSwapOffers: boolean;
  debugMode: boolean;
  setDebugMode: (v: boolean) => void;
  advancedMode: boolean;
  setAdvancedMode: (v: boolean) => void;
  fullContentTopic: string;
  setFullContentTopic: (v: string) => void;
}

const RightSidebar = React.memo((props: RightSidebarProps) => {
  const {
    username, settingsOpen, setSettingsOpen, tempUsername, setTempUsername, handleSettingsSave,
    joinedCommunities, setJoinedCommunities, community, selectCommunity, deleteCommunity,
    communityName, setCommunityName, createCommunity, isSwapOffers, debugMode, setDebugMode,
    advancedMode, setAdvancedMode, fullContentTopic, setFullContentTopic
  } = props;

  // Local state for dialog management
  const [usernameChangeConfirmOpen, setUsernameChangeConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [communityToDelete, setCommunityToDelete] = useState<number>(-1);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [dragOverItem, setDragOverItem] = useState<number | null>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handle community name change with validation
   */
  const handleCommunityNameChange = useCallback((value: string) => {
    if (value.includes('/')) {
      toast.info("For custom content topics, please enable Advanced Mode in Settings");
      return;
    }
    setCommunityName(value);
  }, [setCommunityName]);

  /**
   * Drag and drop handlers for community reordering
   */
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverItem(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDragOverItem(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedItem === null) return;
    
    const newCommunities = [...joinedCommunities];
    const draggedCommunity = newCommunities[draggedItem];
    
    // Remove the dragged item and insert at new position
    newCommunities.splice(draggedItem, 1);
    const insertIndex = draggedItem < dropIndex ? dropIndex - 1 : dropIndex;
    newCommunities.splice(insertIndex, 0, draggedCommunity);
    
    // Update state and localStorage
    setJoinedCommunities(newCommunities);
    localStorage.setItem("communities", JSON.stringify(newCommunities));
    
    setDraggedItem(null);
    setDragOverItem(null);
  }, [draggedItem, joinedCommunities, setJoinedCommunities]);

  /**
   * Username change handlers
   */
  const handleUsernameChange = useCallback(() => {
    if (tempUsername !== username) {
      setUsernameChangeConfirmOpen(true);
    } else {
      handleSettingsSave();
    }
  }, [tempUsername, username, handleSettingsSave]);

  const confirmUsernameChange = useCallback(() => {
    setUsernameChangeConfirmOpen(false);
    handleSettingsSave();
  }, [handleSettingsSave]);

  /**
   * Community deletion handlers
   */
  const handleDeleteCommunity = useCallback((index: number) => {
    setCommunityToDelete(index);
    setDeleteConfirmOpen(true);
  }, []);

  const confirmDeleteCommunity = useCallback(() => {
    if (communityToDelete >= 0) {
      deleteCommunity(communityToDelete);
    }
    setDeleteConfirmOpen(false);
    setCommunityToDelete(-1);
  }, [communityToDelete, deleteCommunity]);

  /**
   * Settings dialog handler with input focus management
   */
  const handleSettingsOpen = useCallback((open: boolean) => {
    setSettingsOpen(open);
    if (open) {
      // Clear selection after dialog opens
      setTimeout(() => {
        if (usernameInputRef.current) {
          usernameInputRef.current.setSelectionRange(
            usernameInputRef.current.value.length,
            usernameInputRef.current.value.length
          );
        }
      }, 100);
    }
  }, [setSettingsOpen]);

  return (
    <div className={`fixed right-4 ${isSwapOffers ? "top-16" : "top-4"} flex flex-col items-end gap-4 z-30 w-64`}>
      {/* Header */}
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <img src="https://activate.veri.vip/favicon.svg" alt="Ve Logo" className="h-6 w-6" />
            <div className="w-px h-5 bg-gray-400" />
            <div className="text-lg font-semibold">
              <span style={{ color: VERIDAO_ORANGE }}>Ve</span>
              <span className="text-white">Test</span>
            </div>
          </div>
          
          {/* Settings Dialog */}
          <Dialog open={settingsOpen} onOpenChange={handleSettingsOpen}>
            <Button variant="ghost" size="sm" className="text-gray-200 hover:bg-gray-700" onClick={() => handleSettingsOpen(true)}>
              <Settings size={16} />
            </Button>
            <DialogContent className="bg-gray-800 text-gray-200 border-gray-700 max-h-[80vh] h-[600px]">
              <DialogHeader>
                <DialogTitle>Settings</DialogTitle>
                <DialogDescription className="text-gray-400">Configure your preferences</DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4">
                  {/* Username Setting */}
                  <div>
                    <Label htmlFor="username">Username</Label>
                    <Input
                      ref={usernameInputRef}
                      id="username"
                      value={tempUsername}
                      onChange={(e) => setTempUsername(e.target.value)}
                      className="bg-gray-700 text-gray-200 border-gray-600 mt-2"
                    />
                  </div>
                  
                  {/* Current Community Display */}
                  {community && (
                    <div>
                      <Label>Current Community Topic</Label>
                      <div className="mt-2 p-2 bg-gray-700/50 rounded border border-gray-600">
                        <code className="text-sm text-green-400">{community.contentTopic}</code>
                      </div>
                    </div>
                  )}
                  
                  {/* Debug Mode Toggle */}
                  <div className="flex items-center justify-between">
                    <Label htmlFor="debug-mode" className="text-sm font-medium">Debug Mode</Label>
                    <input
                      id="debug-mode"
                      type="checkbox"
                      checked={debugMode}
                      onChange={(e) => setDebugMode(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    Shows all messages with valid timestamps using placeholders for unparseable data.
                  </p>
                  
                  {/* Advanced Mode Toggle */}
                  <div className="flex items-center justify-between">
                    <Label htmlFor="advanced-mode" className="text-sm font-medium">Advanced Mode</Label>
                    <input
                      id="advanced-mode"
                      type="checkbox"
                      checked={advancedMode}
                      onChange={(e) => setAdvancedMode(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    Allows joining communities with custom content topics.
                  </p>

                  {/* Community Management Section */}
                  <div className="pt-4 border-t border-gray-600">
                    <Label className="text-sm font-medium mb-3 block">Manage Communities (Drag to Reorder)</Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {joinedCommunities.map((item, index) => (
                        <div
                          key={item.contentTopic}
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragEnd={handleDragEnd}
                          onDrop={(e) => handleDrop(e, index)}
                          className={`flex items-center justify-between p-2 bg-gray-700/50 rounded cursor-move transition-colors ${
                            draggedItem === index ? 'opacity-50' : ''
                          } ${
                            dragOverItem === index ? 'bg-blue-600/20 border-blue-500/50 border' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <div className="text-gray-500">⋮⋮</div>
                            <span className="text-sm text-gray-300 flex-1 truncate" title={item.contentTopic}>
                              {item.name}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCommunity(index)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-900/20 p-1"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setSettingsOpen(false)}>Cancel</Button>
                <Button onClick={handleSettingsSave}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Confirmation Dialogs */}
          <Dialog open={usernameChangeConfirmOpen} onOpenChange={setUsernameChangeConfirmOpen}>
            <DialogContent className="bg-gray-800 text-gray-200 border-gray-700">
              <DialogHeader>
                <DialogTitle>Confirm Username Change</DialogTitle>
                <DialogDescription className="text-gray-400">
                  Are you sure you want to change your username? This may affect your swap offers and message history.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setUsernameChangeConfirmOpen(false)}>Cancel</Button>
                <Button onClick={confirmUsernameChange} className="bg-orange-600 hover:bg-orange-700">
                  Yes, Change Username
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
            <DialogContent className="bg-gray-800 text-gray-200 border-gray-700">
              <DialogHeader>
                <DialogTitle>Confirm Community Removal</DialogTitle>
                <DialogDescription className="text-gray-400">
                  Are you sure you want to remove "{communityToDelete >= 0 ? joinedCommunities[communityToDelete]?.name : ''}" from your communities?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
                <Button onClick={confirmDeleteCommunity} className="bg-red-600 hover:bg-red-700">
                  Yes, Remove Community
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <Label className="text-sm">Hello, {username}</Label>
      </div>

      {/* Communities Card */}
      <Card className="bg-gray-800/50 border-gray-700 w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-xl font-semibold">Communities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-4">
          {/* Community List */}
          {joinedCommunities.map((item, index) => (
            <div key={item.contentTopic} className="flex items-center">
              <Button
                variant={item.name === community?.name ? "default" : "ghost"}
                onClick={() => selectCommunity(index)}
                className={`flex-1 justify-start text-sm ${
                  item.name === community?.name
                    ? "bg-green-600 hover:bg-green-700"
                    : "text-gray-300 hover:bg-gray-700"
                }`}
                title={item.contentTopic}
              >
                {item.name}
              </Button>
            </div>
          ))}
          
          {/* Add Community Section */}
          <div className="pt-2 border-t border-gray-700">
            {advancedMode ? (
              <div className="space-y-2">
                <Label className="text-xs text-gray-400">Full Content Topic</Label>
                <Input
                  value={fullContentTopic}
                  onChange={(e) => setFullContentTopic(e.target.value)}
                  placeholder="/my-app/1/community/proto"
                  className="bg-gray-700 border-gray-600 text-white text-xs font-mono"
                />
                <div className="text-xs text-gray-500">Format: /application/version/topic/encoding</div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs text-gray-400">Community Name</Label>
                <Input
                  value={communityName}
                  onChange={(e) => handleCommunityNameChange(e.target.value)}
                  placeholder="Community name"
                  className="bg-gray-700 border-gray-600 text-white text-sm"
                />
                <div className="text-xs text-gray-500">
                  Will create: /waku/1/{sanitizeCommunityName(communityName) || "name"}/proto
                </div>
              </div>
            )}

            <Button
              onClick={createCommunity}
              className="w-full bg-blue-600 hover:bg-blue-700 text-sm py-2 mt-2"
              disabled={advancedMode ? !fullContentTopic.trim() : !communityName.trim()}
            >
              Join Community
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

/**
 * Asset Swap Interface Component
 * Handles creation of swap offers with price conversion
 */
interface SwapInterfaceProps {
  fromAsset: string;
  setFromAsset: (v: string) => void;
  fromAmount: string;
  handleFromAmountChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  toAsset: string;
  setToAsset: (v: string) => void;
  toAmount: string;
  handleToAmountChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  swapAssets: () => void;
  sendSwapOffer: () => void;
}

const SwapInterface = React.memo((props: SwapInterfaceProps) => {
  const {
    fromAsset, setFromAsset, fromAmount, handleFromAmountChange,
    toAsset, setToAsset, toAmount, handleToAmountChange,
    swapAssets, sendSwapOffer
  } = props;

  // Asset options for select dropdowns
  const assetOptions = [
    { value: "BTC", icon: <div className="w-3 h-3 bg-orange-500 rounded-full" />, label: "BTC" },
    { value: "ETH", icon: <div className="w-3 h-3 bg-gray-400 rounded-full" />, label: "ETH" },
    { value: "USDC", icon: <div className="w-3 h-3 bg-blue-500 rounded-full" />, label: "USDC" },
    { value: "VERI", icon: <img src="https://activate.veri.vip/favicon.svg" alt="VERI" className="w-3 h-3" />, label: "VERI" }
  ];

  return (
    <div className="w-full max-w-lg mx-auto">
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="pb-4">
          <CardTitle className="text-white text-xl font-semibold">Asset Swap</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* From Section */}
          <div className="space-y-2">
            <Label className="text-gray-300 text-sm">From</Label>
            <div className="flex gap-3">
              <Select value={fromAsset} onValueChange={setFromAsset}>
                <SelectTrigger className="w-32 bg-gray-700 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  {assetOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        {option.icon}
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="text"
                inputMode="decimal"
                value={fromAmount}
                onChange={handleFromAmountChange}
                placeholder="0.0"
                className="flex-1 bg-gray-700 border-gray-600 text-white text-right"
              />
            </div>
          </div>

          {/* Swap Button */}
          <div className="flex justify-center -my-1">
            <Button variant="ghost" size="sm" onClick={swapAssets} className="text-gray-400 hover:text-white hover:bg-gray-700 p-1 h-6">
              <ArrowUpDown size={16} />
            </Button>
          </div>

          {/* To Section */}
          <div className="space-y-2">
            <Label className="text-gray-300 text-sm">To</Label>
            <div className="flex gap-3">
              <Select value={toAsset} onValueChange={setToAsset}>
                <SelectTrigger className="w-32 bg-gray-700 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  {assetOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        {option.icon}
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="text"
                inputMode="decimal"
                value={toAmount}
                onChange={handleToAmountChange}
                placeholder="0.0"
                className="flex-1 bg-gray-700 border-gray-600 text-white text-right"
              />
            </div>
          </div>

          {/* Create Offer Button */}
          <div className="flex gap-3 mt-4">
            <div className="w-32"></div>
            <Button
              onClick={sendSwapOffer}
              className="flex-1 bg-blue-600 hover:bg-blue-700 font-medium py-2"
              disabled={!fromAmount || !toAmount}
            >
              Create Swap Offer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

/**
 * Process swap offer message into structured data
 */
const processSwapOffer = (msg: Message, index: number, debugMode: boolean, username: string): ProcessedSwapOffer | null => {
  try {
    const rawBytes = bytesFromBase64(msg.payload);
    const payloadText = new TextDecoder().decode(rawBytes);
    
    // Enhanced offer identification
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
    
    // Debug mode: show all messages with valid timestamps
    if (debugMode && msg.timestamp) {
      let parsedData: any = null;
      let isValidJSON = false;
      
      try {
        parsedData = JSON.parse(payloadText);
        isValidJSON = true;
      } catch (e) {
        // Not JSON, will use raw text parsing
      }
      
      // Extract asset information
      let fromAsset = "Unknown";
      let toAsset = "Unknown";
      let fromAmount: number | string = "?";
      let toAmount: number | string = "?";
      
      if (isValidJSON && parsedData) {
        // Handle different JSON structures
        if (parsedData.offer) {
          const offer = parsedData.offer;
          fromAsset = typeof offer.fromAsset === 'object' && offer.fromAsset.symbol
            ? offer.fromAsset.symbol.toString().toUpperCase()
            : offer.fromAsset?.toString().toUpperCase() || "Unknown";
          toAsset = typeof offer.toAsset === 'object' && offer.toAsset.symbol
            ? offer.toAsset.symbol.toString().toUpperCase()
            : offer.toAsset?.toString().toUpperCase() || "Unknown";
          fromAmount = parseAmount(offer.fromAmount);
          toAmount = parseAmount(offer.toAmount);
        } else if (parsedData.from && parsedData.to) {
          fromAsset = parsedData.from.asset?.toString().toUpperCase() || "Unknown";
          toAsset = parsedData.to.asset?.toString().toUpperCase() || "Unknown";
          fromAmount = parseAmount(parsedData.from.amount);
          toAmount = parseAmount(parsedData.to.amount);
        } else {
          fromAsset = parsedData.fromAsset?.toString().toUpperCase() || "Unknown";
          toAsset = parsedData.toAsset?.toString().toUpperCase() || "Unknown";
          fromAmount = parseAmount(parsedData.fromAmount);
          toAmount = parseAmount(parsedData.toAmount);
        }
      } else {
        // Try to find asset names in raw text
        const assetRegex = /(BTC|ETH|USDC|VERI|bitcoin|ethereum|Bitcoin|Ethereum)/gi;
        const foundAssets = payloadText.match(assetRegex);
        if (foundAssets?.length >= 2) {
          fromAsset = foundAssets[0].toUpperCase();
          toAsset = foundAssets[1].toUpperCase();
        } else if (foundAssets?.length === 1) {
          fromAsset = foundAssets[0].toUpperCase();
        }
        
        // Try to find numbers that might be amounts
        const numberRegex = /\d+\.?\d*/g;
        const foundNumbers = payloadText.match(numberRegex);
        if (foundNumbers?.length >= 2) {
          fromAmount = parseAmount(foundNumbers[0]);
          toAmount = parseAmount(foundNumbers[1]);
        } else if (foundNumbers?.length === 1) {
          fromAmount = parseAmount(foundNumbers[0]);
        }
      }
      
      const numFromAmount = typeof fromAmount === 'number' ? fromAmount : parseAmount(fromAmount);
      const numToAmount = typeof toAmount === 'number' ? toAmount : parseAmount(toAmount);
      const rate = calculateRate(numFromAmount, numToAmount, fromAsset, toAsset);
      
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
        isMyOffer
      };
    }
    
    // Normal mode: only valid JSON offers
    if (!debugMode) {
      let offer;
      try {
        offer = JSON.parse(payloadText);
      } catch {
        return null;
      }
      
      let fromAsset, toAsset, fromAmount, toAmount;
      
      // Extract data based on JSON structure
      if (offer.offer) {
        const offerData = offer.offer;
        fromAsset = typeof offerData.fromAsset === 'object' && offerData.fromAsset.symbol
          ? offerData.fromAsset.symbol
          : offerData.fromAsset;
        toAsset = typeof offerData.toAsset === 'object' && offerData.toAsset.symbol
          ? offerData.toAsset.symbol
          : offerData.toAsset;
        fromAmount = parseAmount(offerData.fromAmount);
        toAmount = parseAmount(offerData.toAmount);
      } else if (offer.from && offer.to) {
        fromAsset = offer.from.asset;
        toAsset = offer.to.asset;
        fromAmount = parseAmount(offer.from.amount);
        toAmount = parseAmount(offer.to.amount);
      } else {
        fromAsset = offer.fromAsset;
        toAsset = offer.toAsset;
        fromAmount = parseAmount(offer.fromAmount);
        toAmount = parseAmount(offer.toAmount);
      }
      
      if (!fromAsset || !toAsset || !fromAmount || !toAmount) {
        return null;
      }
      
      const rate = calculateRate(fromAmount, toAmount, fromAsset.toString(), toAsset.toString());
      
      return {
        key: `${msg.timestamp ?? Date.now()}-${index}`,
        fromAsset: fromAsset.toString().toUpperCase(),
        fromAmount: fromAmount,
        toAsset: toAsset.toString().toUpperCase(),
        toAmount: toAmount,
        timestamp: msg.timestamp,
        rate,
        fromDisplay: getAssetDisplay(fromAsset.toString()),
        toDisplay: getAssetDisplay(toAsset.toString()),
        rawMessage: payloadText,
        isDebugMode: false,
        isValidJSON: true,
        originalData: offer,
        isMyOffer
      };
    }
    
    return null;
    
  } catch (error) {
    console.error("Error processing swap offer:", error);
    return null;
  }
};

/**
 * Swap Offers Display Component
 * Shows filtered swap offers with tabs for "All" and "My Offers"
 */
interface SwapOffersProps {
  messages: Message[];
  community?: CommunityMetadata;
  debugMode: boolean;
  username: string;
}

const SwapOffers = React.memo(({ messages, community, debugMode, username }: SwapOffersProps) => {
  const [activeTab, setActiveTab] = useState<'all' | 'mine'>('all');
  
  // Process messages into swap offers
  const swapOffers = messages
    .filter(msg => msg.contentTopic === community?.contentTopic)
    .map((msg, index) => processSwapOffer(msg, index, debugMode, username))
    .filter((offer): offer is ProcessedSwapOffer => offer !== null);

  // Filter offers based on active tab
  const filteredOffers = activeTab === 'mine'
    ? swapOffers.filter(offer => offer.isMyOffer)
    : swapOffers.filter(offer => !offer.isMyOffer);

  // Count offers for tab labels
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
            
            {/* Tab buttons */}
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
                    <div className="flex items-center justify-between">
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
                      <div className="text-right">
                        <div className="text-gray-300 text-sm">Rate: {offer.rate}</div>
                        <div className="text-gray-400 text-xs">{formatDate(offer.timestamp)}</div>
                        <div className="flex items-center gap-1 text-xs">
                          {offer.isMyOffer ? (
                            <span className="text-green-400">SENT</span>
                          ) : (
                            <span className="text-blue-400">RECEIVED</span>
                          )}
                          {offer.isDebugMode && (
                            <>
                              <span className="text-gray-400">•</span>
                              <span className={offer.isValidJSON ? "text-green-400" : "text-yellow-400"}>
                                {offer.isValidJSON ? "JSON" : "RAW"}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
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
// MAIN APPLICATION COMPONENT
// ============================================================================

function App() {
  // ========== STATE MANAGEMENT ==========
  
  // User and UI state
  const [newMessage, setNewMessage] = useState("");
  const [username, setUsername] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tempUsername, setTempUsername] = useState("");
  const [debugMode, setDebugMode] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  
  // Community management state
  const [community, setCommunity] = useState<CommunityMetadata | undefined>(undefined);
  const [joinedCommunities, setJoinedCommunities] = useState<CommunityMetadata[]>([]);
  const [communityName, setCommunityName] = useState("");
  const [fullContentTopic, setFullContentTopic] = useState("");
  
  // Swap interface state
  const [fromAsset, setFromAsset] = useState("BTC");
  const [fromAmount, setFromAmount] = useState("");
  const [toAsset, setToAsset] = useState("USDC");
  const [toAmount, setToAmount] = useState("");
  
  // Message and system state
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesSent, setMessagesSent] = useState(0);
  const [messagesReceived, setMessagesReceived] = useState(0);
  
  // System info state
  const [nwakuVersion, setNwakuVersion] = useState("");
  const [health, setHealth] = useState<HealthResponse>();
  const [numPeers, setNumPeers] = useState("");
  const [uptime, setUptime] = useState("");
  const [priceData, setPriceData] = useState<PriceData>(DEFAULT_PRICE_DATA);

  // ========== INITIALIZATION ==========
  
  /**
   * Load initial data from localStorage
   */
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
  }, []);

  // ========== PRICE CONVERSION LOGIC ==========
  
  /**
   * Calculate conversion between assets using current price data
   */
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

  /**
   * Handle from amount input with auto-conversion
   */
  const handleFromAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFromAmount(value);
    
    // Only auto-calculate if the 'to' field is empty
    if (value && !toAmount) {
      const converted = calculateConversion(value, fromAsset, toAsset);
      if (converted) {
        setToAmount(converted);
      }
    } else if (!value) {
      setToAmount("");
    }
  }, [toAmount, calculateConversion, fromAsset, toAsset]);

  /**
   * Handle to amount input with auto-conversion
   */
  const handleToAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setToAmount(value);
    
    // Only auto-calculate if the 'from' field is empty
    if (value && !fromAmount) {
      const converted = calculateConversion(value, toAsset, fromAsset);
      if (converted) {
        setFromAmount(converted);
      }
    } else if (!value) {
      setFromAmount("");
    }
  }, [fromAmount, calculateConversion, toAsset, fromAsset]);

  // ========== DATA FETCHING ==========
  
  /**
   * Fetch cryptocurrency prices from CoinGecko API
   */
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

  /**
   * Fetch system information (version, health, peers)
   */
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

  /**
   * Fetch all messages for joined communities
   */
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
      
      // Sort messages by timestamp (newest first)
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
  
  // Initialize price fetching
  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, PRICE_UPDATE_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  // Initialize system data fetching
  useEffect(() => {
    fetchSystemData();
  }, [fetchSystemData]);

  // Initialize uptime tracking
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

  // Fetch messages when communities change
  useEffect(() => {
    fetchAllMessages();
  }, [fetchAllMessages]);

  // ========== ACTION HANDLERS ==========
  
  /**
   * Create user profile
   */
  const createUser = useCallback(() => {
    if (usernameInput.trim()) {
      localStorage.setItem("username", usernameInput);
      setUsername(usernameInput);
    }
  }, [usernameInput]);

  /**
   * Create and join a new community
   */
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

    // Add new community and update storage
    const joined = [...joinedCommunities, payload];
    setJoinedCommunities(joined);
    localStorage.setItem("communities", JSON.stringify(joined));
    setCommunity(payload);
    localStorage.setItem("community", JSON.stringify(payload));
    
    // Clear inputs
    setCommunityName("");
    setFullContentTopic("");
    
    toast.success(`Joined ${displayName}`);
  }, [advancedMode, fullContentTopic, communityName, joinedCommunities]);

  /**
   * Select a community from the list
   */
  const selectCommunity = useCallback((index: number) => {
    const selected = joinedCommunities[index];
    setCommunity(selected);
    localStorage.setItem("community", JSON.stringify(selected));
  }, [joinedCommunities]);

  /**
   * Delete a community from the list
   */
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

  /**
   * Send a message to the current community
   */
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

  /**
   * Send a swap offer message
   */
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

  /**
   * Swap the from and to assets and amounts
   */
  const swapAssets = useCallback(() => {
    const tempAsset = fromAsset;
    const tempAmount = fromAmount;
    setFromAsset(toAsset);
    setFromAmount(toAmount);
    setToAsset(tempAsset);
    setToAmount(tempAmount);
  }, [fromAsset, fromAmount, toAsset, toAmount]);

  /**
   * Save settings and update localStorage
   */
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

  /**
   * Get health indicator emoji based on node health
   */
  const getHealthIndicator = useCallback(() => {
    if (!health) return "🔴";
    const nodeHealth = health.nodeHealth?.toLowerCase().trim();
    return ["ready", "ok", "healthy", "up"].includes(nodeHealth) ? "🟢" : "🔴";
  }, [health]);

  // ========== RENDER ==========

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 pb-20">
      {/* Price Bar - only show for swap-offers community */}
      {username && joinedCommunities.length > 0 && community?.name === "swap-offers" && (
        <PriceBar priceData={priceData} />
      )}

      {/* Right Sidebar - show when user has communities */}
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
            /* Swap Interface */
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
              <SwapOffers
                messages={messages}
                community={community}
                debugMode={debugMode}
                username={username}
              />
            </>
          ) : (
            /* Chat Interface */
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

      {/* Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-3">
        <div className="flex justify-center">
          <div className="flex gap-6 text-sm text-gray-300">
            <span>Health: {getHealthIndicator()}</span>
            <span>Nwaku: {nwakuVersion}</span>
            <span>Peers: {numPeers}</span>
            <span>Sent: {messagesSent}</span>
            <span>Received: {messagesReceived}</span>
            <span>Uptime: {uptime}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
