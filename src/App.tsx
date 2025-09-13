import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import axios from "axios";
import { Settings, X, ArrowUpDown, TrendingUp, TrendingDown, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import React from "react";

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

const SERVICE_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || "http://localhost:8645";
const VERIDAO_ORANGE = "#FF8A00";

// UTF-8 safe base64 helpers
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

// Helper functions hoisted to module scope
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

const formatDate = (timestamp?: string) => {
  try {
    if (!timestamp) return "";
    const ns = BigInt(timestamp);
    const ms = Number(ns / 1000000n);
    return new Date(ms).toLocaleString();
  } catch {
    return "";
  }
};

// Function to generate display name from content topic
const generateDisplayName = (contentTopic: string): string => {
  try {
    const parts = contentTopic.split('/');
    if (parts.length < 4) return contentTopic;
    
    const app = parts[1];
    const topic = parts[3];
    
    // Special cases for common patterns
    if (app === 'waku' && topic === 'default-content') {
      return 'waku';
    }
    
    if (app === 'status') {
      return 'status';
    }
    
    // For apps with multiple topics (like supercrypto), include the topic name
    if (topic !== 'proto' && topic !== app && topic !== 'default') {
      return `${app}/${topic}`;
    }
    
    // Default: just use the app name
    return app;
  } catch {
    return contentTopic;
  }
};

// Helper function to sanitize community names
const sanitizeCommunityName = (name: string): string => {
  // Replace spaces with dashes first, then handle other problematic characters
  return name.replace(/\s+/g, '-').replace(/[\/\\:*?"<>|]/g, '-');
};

// Helper function to validate content topic format
const validateContentTopic = (topic: string): boolean => {
  if (!topic.startsWith('/')) return false;
  const parts = topic.split('/');
  return parts.length === 4 && parts[1] && parts[2] && parts[3];
};

// Scrolling Price Bar Component with CSS-in-JS fix
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
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-500 rounded-full" />
              <span className="text-white font-medium text-sm">Bitcoin</span>
            </div>
            <div className="text-white font-bold">${formatPrice(priceData.bitcoin?.usd)}</div>
            <div className={`flex items-center gap-1 ${(priceData.bitcoin?.usd_24h_change || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(priceData.bitcoin?.usd_24h_change || 0) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span className="text-xs">{formatChange(priceData.bitcoin?.usd_24h_change)}%</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-400 rounded-full" />
              <span className="text-white font-medium text-sm">Ethereum</span>
            </div>
            <div className="text-white font-bold">${formatPrice(priceData.ethereum?.usd)}</div>
            <div className={`flex items-center gap-1 ${(priceData.ethereum?.usd_24h_change || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(priceData.ethereum?.usd_24h_change || 0) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span className="text-xs">{formatChange(priceData.ethereum?.usd_24h_change)}%</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded-full" />
              <span className="text-white font-medium text-sm">USDC</span>
            </div>
            <div className="text-white font-bold">${formatPrice(priceData["usd-coin"]?.usd, 4)}</div>
            <div className={`flex items-center gap-1 ${(priceData["usd-coin"]?.usd_24h_change || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(priceData["usd-coin"]?.usd_24h_change || 0) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span className="text-xs">{formatChange(priceData["usd-coin"]?.usd_24h_change)}%</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <img src="https://activate.veri.vip/favicon.svg" alt="VERI" className="w-4 h-4" />
              <span className="text-white font-medium text-sm">VERI</span>
            </div>
            <div className="text-white font-bold">${formatPrice(priceData.veritaseum?.usd, 4)}</div>
            <div className={`flex items-center gap-1 ${(priceData.veritaseum?.usd_24h_change || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(priceData.veritaseum?.usd_24h_change || 0) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span className="text-xs">{formatChange(priceData.veritaseum?.usd_24h_change)}%</span>
            </div>
          </div>

          {/* Duplicate content for seamless scroll */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-500 rounded-full" />
              <span className="text-white font-medium text-sm">Bitcoin</span>
            </div>
            <div className="text-white font-bold">${formatPrice(priceData.bitcoin?.usd)}</div>
            <div className={`flex items-center gap-1 ${(priceData.bitcoin?.usd_24h_change || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(priceData.bitcoin?.usd_24h_change || 0) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span className="text-xs">{formatChange(priceData.bitcoin?.usd_24h_change)}%</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-400 rounded-full" />
              <span className="text-white font-medium text-sm">Ethereum</span>
            </div>
            <div className="text-white font-bold">${formatPrice(priceData.ethereum?.usd)}</div>
            <div className={`flex items-center gap-1 ${(priceData.ethereum?.usd_24h_change || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(priceData.ethereum?.usd_24h_change || 0) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span className="text-xs">{formatChange(priceData.ethereum?.usd_24h_change)}%</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded-full" />
              <span className="text-white font-medium text-sm">USDC</span>
            </div>
            <div className="text-white font-bold">${formatPrice(priceData["usd-coin"]?.usd, 4)}</div>
            <div className={`flex items-center gap-1 ${(priceData["usd-coin"]?.usd_24h_change || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(priceData["usd-coin"]?.usd_24h_change || 0) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span className="text-xs">{formatChange(priceData["usd-coin"]?.usd_24h_change)}%</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <img src="https://activate.veri.vip/favicon.svg" alt="VERI" className="w-4 h-4" />
              <span className="text-white font-medium text-sm">VERI</span>
            </div>
            <div className="text-white font-bold">${formatPrice(priceData.veritaseum?.usd, 4)}</div>
            <div className={`flex items-center gap-1 ${(priceData.veritaseum?.usd_24h_change || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(priceData.veritaseum?.usd_24h_change || 0) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span className="text-xs">{formatChange(priceData.veritaseum?.usd_24h_change)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
));

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

  const [usernameChangeConfirmOpen, setUsernameChangeConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [communityToDelete, setCommunityToDelete] = useState<number>(-1);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [dragOverItem, setDragOverItem] = useState<number | null>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);

  // Handle community name change - simplified to just show toast warning
  const handleCommunityNameChange = (value: string) => {
    if (value.includes('/')) {
      toast.info("For custom content topics, please enable Advanced Mode in Settings");
      return;
    }
    setCommunityName(value);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverItem(index);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedItem === null) return;
    
    const newCommunities = [...joinedCommunities];
    const draggedCommunity = newCommunities[draggedItem];
    
    // Remove the dragged item
    newCommunities.splice(draggedItem, 1);
    
    // Insert at new position
    const insertIndex = draggedItem < dropIndex ? dropIndex - 1 : dropIndex;
    newCommunities.splice(insertIndex, 0, draggedCommunity);
    
    // Update state and localStorage
    setJoinedCommunities(newCommunities);
    localStorage.setItem("communities", JSON.stringify(newCommunities));
    
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleUsernameChange = () => {
    if (tempUsername !== username) {
      setUsernameChangeConfirmOpen(true);
    } else {
      handleSettingsSave();
    }
  };

  const confirmUsernameChange = () => {
    setUsernameChangeConfirmOpen(false);
    handleSettingsSave();
  };

  const handleDeleteCommunity = (index: number) => {
    setCommunityToDelete(index);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteCommunity = () => {
    if (communityToDelete >= 0) {
      deleteCommunity(communityToDelete);
    }
    setDeleteConfirmOpen(false);
    setCommunityToDelete(-1);
  };

  // Clear selection when settings dialog opens
  const handleSettingsOpen = (open: boolean) => {
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
  };

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
          <Dialog open={settingsOpen} onOpenChange={handleSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-gray-200 hover:bg-gray-700">
                <Settings size={16} />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-800 text-gray-200 border-gray-700 max-h-[80vh] h-[600px]">
              <DialogHeader>
                <DialogTitle>Settings</DialogTitle>
                <DialogDescription className="text-gray-400">Configure your preferences</DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4">
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
                  {community && (
                    <div>
                      <Label>Current Community Topic</Label>
                      <div className="mt-2 p-2 bg-gray-700/50 rounded border border-gray-600">
                        <code className="text-sm text-green-400">{community.contentTopic}</code>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <Label htmlFor="debug-mode" className="text-sm font-medium">
                      Debug Mode
                    </Label>
                    <input
                      id="debug-mode"
                      type="checkbox"
                      checked={debugMode}
                      onChange={(e) => setDebugMode(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    When enabled, shows all messages with valid timestamps using placeholders for unparseable data.
                  </p>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="advanced-mode" className="text-sm font-medium">
                      Advanced Mode
                    </Label>
                    <input
                      id="advanced-mode"
                      type="checkbox"
                      checked={advancedMode}
                      onChange={(e) => setAdvancedMode(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    When enabled, allows joining communities with custom content topics.
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
                <Button variant="secondary" onClick={() => setSettingsOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUsernameChange}>
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Username Change Confirmation Dialog */}
          <Dialog open={usernameChangeConfirmOpen} onOpenChange={setUsernameChangeConfirmOpen}>
            <DialogContent className="bg-gray-800 text-gray-200 border-gray-700">
              <DialogHeader>
                <DialogTitle>Confirm Username Change</DialogTitle>
                <DialogDescription className="text-gray-400">
                  Are you sure you want to change your username? This may affect your swap offers and message history.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setUsernameChangeConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={confirmUsernameChange} className="bg-orange-600 hover:bg-orange-700">
                  Yes, Change Username
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Community Deletion Confirmation Dialog */}
          <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
            <DialogContent className="bg-gray-800 text-gray-200 border-gray-700">
              <DialogHeader>
                <DialogTitle>Confirm Community Removal</DialogTitle>
                <DialogDescription className="text-gray-400">
                  Are you sure you want to remove "{communityToDelete >= 0 ? joinedCommunities[communityToDelete]?.name : ''}" from your communities?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={confirmDeleteCommunity} className="bg-red-600 hover:bg-red-700">
                  Yes, Remove Community
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <Label className="text-sm">Hello, {username}</Label>
      </div>

      {/* Communities */}
      <Card className="bg-gray-800/50 border-gray-700 w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-xl font-semibold">Communities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-4">
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
                title={item.contentTopic} // Show full content topic on hover
              >
                {item.name}
              </Button>
            </div>
          ))}
          
          <div className="pt-2 border-t border-gray-700">
            {advancedMode ? (
              // Advanced Mode: Full Content Topic Input
              <div className="space-y-2">
                <Label className="text-xs text-gray-400">Full Content Topic</Label>
                <Input
                  value={fullContentTopic}
                  onChange={(e) => setFullContentTopic(e.target.value)}
                  placeholder="/my-app/1/community/proto"
                  className="bg-gray-700 border-gray-600 text-white text-xs font-mono"
                />
                <div className="text-xs text-gray-500">
                  Format: /application/version/topic/encoding
                </div>
              </div>
            ) : (
              // Simple Mode: Community Name Input
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

  return (
    <div className="w-full max-w-lg mx-auto">
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="pb-4">
          <CardTitle className="text-white text-xl font-semibold">Asset Swap</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label className="text-gray-300 text-sm">From</Label>
            <div className="flex gap-3">
              <Select value={fromAsset} onValueChange={setFromAsset}>
                <SelectTrigger className="w-32 bg-gray-700 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="BTC">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-orange-500 rounded-full" />
                      BTC
                    </div>
                  </SelectItem>
                  <SelectItem value="ETH">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-gray-400 rounded-full" />
                      ETH
                    </div>
                  </SelectItem>
                  <SelectItem value="USDC">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full" />
                      USDC
                    </div>
                  </SelectItem>
                  <SelectItem value="VERI">
                    <div className="flex items-center gap-2">
                      <img src="https://activate.veri.vip/favicon.svg" alt="VERI" className="w-3 h-3" />
                      VERI
                    </div>
                  </SelectItem>
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

          <div className="flex justify-center -my-1">
            <Button variant="ghost" size="sm" onClick={swapAssets} className="text-gray-400 hover:text-white hover:bg-gray-700 p-1 h-6">
              <ArrowUpDown size={16} />
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300 text-sm">To</Label>
            <div className="flex gap-3">
              <Select value={toAsset} onValueChange={setToAsset}>
                <SelectTrigger className="w-32 bg-gray-700 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600">
                  <SelectItem value="BTC">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-orange-500 rounded-full" />
                      BTC
                    </div>
                  </SelectItem>
                  <SelectItem value="ETH">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-gray-400 rounded-full" />
                      ETH
                    </div>
                  </SelectItem>
                  <SelectItem value="USDC">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full" />
                      USDC
                    </div>
                  </SelectItem>
                  <SelectItem value="VERI">
                    <div className="flex items-center gap-2">
                      <img src="https://activate.veri.vip/favicon.svg" alt="VERI" className="w-3 h-3" />
                      VERI
                    </div>
                  </SelectItem>
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

          <div className="flex gap-3 mt-4">
            <div className="w-32"></div> {/* Spacer to align with dropdown width */}
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

interface SwapOffersProps {
  messages: Message[];
  community?: CommunityMetadata;
  fetchAllMessages: () => void;
  debugMode: boolean;
  username: string;
}

const SwapOffers = React.memo(({ messages, community, debugMode, username }: SwapOffersProps) => {
  const [activeTab, setActiveTab] = useState<'all' | 'mine'>('all');
  
  // Filter messages for the current community
  const relevantMessages = messages.filter(msg => msg.contentTopic === community?.contentTopic);

  const swapOffers = relevantMessages.map((msg, index) => {
    try {
      const rawBytes = bytesFromBase64(msg.payload);
      const payloadText = new TextDecoder().decode(rawBytes);
      
      // Enhanced offer identification - check multiple patterns
      const isMyOffer = (
        // Check if our username appears in the message at all
        payloadText.includes(`"${username}"`) ||
        // Check for our JSON format with our username
        payloadText.includes(`"${username}":`) ||
        // Check for chat format with our username
        payloadText.startsWith(`${username}:`) ||
        // Check if the message structure suggests it's ours (simple format from our app)
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
      
      // In debug mode, show all messages with valid timestamps
      if (debugMode && msg.timestamp) {
        // Try to parse as JSON, but don't fail if it's not
        let parsedData: any = null;
        let isValidJSON = false;
        
        try {
          parsedData = JSON.parse(payloadText);
          isValidJSON = true;
        } catch (e) {
          // Not JSON, will use raw text parsing
        }
        
        // Extract any asset-like information
        let fromAsset = "Unknown";
        let toAsset = "Unknown";
        let fromAmount: number | string = "?";
        let toAmount: number | string = "?";
        
        if (isValidJSON && parsedData) {
          // Handle different JSON structures
          if (parsedData.offer) {
            // swap.veri.lol format: {"offer": {"fromAsset": {"symbol": "BTC"}, "fromAmount": "0.001"}}
            const offer = parsedData.offer;
            
            // Extract assets - could be nested objects with symbol property
            if (offer.fromAsset) {
              fromAsset = typeof offer.fromAsset === 'object' && offer.fromAsset.symbol
                ? offer.fromAsset.symbol.toString().toUpperCase()
                : offer.fromAsset.toString().toUpperCase();
            }
            if (offer.toAsset) {
              toAsset = typeof offer.toAsset === 'object' && offer.toAsset.symbol
                ? offer.toAsset.symbol.toString().toUpperCase()
                : offer.toAsset.toString().toUpperCase();
            }
            
            // Extract amounts
            if (offer.fromAmount !== undefined && offer.fromAmount !== null) {
              fromAmount = parseFloat(offer.fromAmount.toString()) || offer.fromAmount;
            }
            if (offer.toAmount !== undefined && offer.toAmount !== null) {
              toAmount = parseFloat(offer.toAmount.toString()) || offer.toAmount;
            }
            
          } else if (parsedData.from && parsedData.to) {
            // from/to format: {"from": {"asset": "BTC", "amount": "1"}, "to": {"asset": "USDC", "amount": "9999"}}
            if (parsedData.from.asset) {
              fromAsset = parsedData.from.asset.toString().toUpperCase();
            }
            if (parsedData.to.asset) {
              toAsset = parsedData.to.asset.toString().toUpperCase();
            }
            if (parsedData.from.amount !== undefined && parsedData.from.amount !== null) {
              fromAmount = parseFloat(parsedData.from.amount.toString()) || parsedData.from.amount;
            }
            if (parsedData.to.amount !== undefined && parsedData.to.amount !== null) {
              toAmount = parseFloat(parsedData.to.amount.toString()) || parsedData.to.amount;
            }
            
          } else {
            // Simple format: {"fromAsset": "BTC", "fromAmount": 1, "toAsset": "USDC", "toAmount": 122122}
            if (parsedData.fromAsset) {
              fromAsset = parsedData.fromAsset.toString().toUpperCase();
            }
            if (parsedData.toAsset) {
              toAsset = parsedData.toAsset.toString().toUpperCase();
            }
            if (parsedData.fromAmount !== undefined && parsedData.fromAmount !== null) {
              fromAmount = parseFloat(parsedData.fromAmount.toString()) || parsedData.fromAmount;
            }
            if (parsedData.toAmount !== undefined && parsedData.toAmount !== null) {
              toAmount = parseFloat(parsedData.toAmount.toString()) || parsedData.toAmount;
            }
          }
          
        } else {
          // Try to find asset names in raw text
          const assetRegex = /(BTC|ETH|USDC|VERI|bitcoin|ethereum|Bitcoin|Ethereum)/gi;
          const foundAssets = payloadText.match(assetRegex);
          if (foundAssets && foundAssets.length >= 2) {
            fromAsset = foundAssets[0].toUpperCase();
            toAsset = foundAssets[1].toUpperCase();
          } else if (foundAssets && foundAssets.length === 1) {
            fromAsset = foundAssets[0].toUpperCase();
          }
          
          // Try to find numbers that might be amounts
          const numberRegex = /\d+\.?\d*/g;
          const foundNumbers = payloadText.match(numberRegex);
          if (foundNumbers && foundNumbers.length >= 2) {
            fromAmount = parseFloat(foundNumbers[0]) || foundNumbers[0];
            toAmount = parseFloat(foundNumbers[1]) || foundNumbers[1];
          } else if (foundNumbers && foundNumbers.length === 1) {
            fromAmount = parseFloat(foundNumbers[0]) || foundNumbers[0];
          }
        }
        
        const getAssetDisplay = (asset: string) => {
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
          isMyOffer
        };
      }
      
      // Normal mode logic with same enhanced extraction
      if (!debugMode) {
        let offer;
        try {
          offer = JSON.parse(payloadText);
        } catch {
          return null;
        }
        
        let fromAsset, toAsset, fromAmount, toAmount;
        
        // Same extraction logic as debug mode
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
        
        const getAssetDisplay = (asset: string) => {
          const assetUpper = asset.toString().toUpperCase();
          switch (assetUpper) {
            case 'BTC': return <div className="w-4 h-4 bg-orange-500 rounded-full" />;
            case 'ETH': return <div className="w-4 h-4 bg-gray-400 rounded-full" />;
            case 'USDC': return <div className="w-4 h-4 bg-blue-500 rounded-full" />;
            case 'VERI': return <img src="https://activate.veri.vip/favicon.svg" alt="VERI" className="w-4 h-4" />;
            default: return <div className="w-4 h-4 bg-gray-500 rounded-full" />;
          }
        };
        
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
          isMyOffer
        };
      }
      
      return null;
      
    } catch (error) {
      console.error("Error processing swap offer:", error);
      return null;
    }
  }).filter(Boolean) as Array<{
    key: string; fromAsset: string; fromAmount: number | string; toAsset: string; toAmount: number | string;
    timestamp?: string; rate: string; fromDisplay: JSX.Element; toDisplay: JSX.Element;
    rawMessage: string; isDebugMode: boolean; isValidJSON: boolean; originalData: any; isMyOffer: boolean;
  }>;

  // Filter offers based on active tab - "All" now excludes my offers
  const filteredOffers = activeTab === 'mine'
    ? swapOffers.filter(offer => offer.isMyOffer)
    : swapOffers.filter(offer => !offer.isMyOffer); // Changed: exclude my offers from "All"

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
            
            {/* Tab buttons - Updated labels to reflect new behavior */}
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
                            <span className="text-gray-400">•</span>
                          )}
                          {offer.isDebugMode && (
                            <span className={offer.isValidJSON ? "text-green-400" : "text-yellow-400"}>
                              {offer.isValidJSON ? "JSON" : "RAW"}
                            </span>
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

function App() {
  // State
  const [newMessage, setNewMessage] = useState("");
  const [username, setUsername] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [community, setCommunity] = useState<CommunityMetadata | undefined>(undefined);
  const [joinedCommunities, setJoinedCommunities] = useState<CommunityMetadata[]>([]);
  const [communityName, setCommunityName] = useState("");
  
  const [fromAsset, setFromAsset] = useState("BTC");
  const [fromAmount, setFromAmount] = useState("");
  const [toAsset, setToAsset] = useState("USDC");
  const [toAmount, setToAmount] = useState("");
  const [lastEditedField, setLastEditedField] = useState<'from' | 'to'>('from');
  
  const [nwakuVersion, setNwakuVersion] = useState("");
  const [health, setHealth] = useState<HealthResponse>();
  const [numPeers, setNumPeers] = useState("");
  const [uptime, setUptime] = useState("");
  const [messagesSent, setMessagesSent] = useState(0);
  const [messagesReceived, setMessagesReceived] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tempUsername, setTempUsername] = useState("");
  const [debugMode, setDebugMode] = useState(false);
  
  // Advanced mode state
  const [advancedMode, setAdvancedMode] = useState(false);
  const [fullContentTopic, setFullContentTopic] = useState("");
  
  const [priceData, setPriceData] = useState<PriceData>({
    bitcoin: { usd: 66420.25, usd_24h_change: 2.34 },
    ethereum: { usd: 3200.50, usd_24h_change: 1.87 },
    "usd-coin": { usd: 1.00, usd_24h_change: 0.01 },
    veritaseum: { usd: 0.1234, usd_24h_change: -3.45 }
  });

  // Load initial data
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

  // Calculate conversion without blocking inputs
  const calculateConversion = (amount: string, fromAssetType: string, toAssetType: string) => {
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
  };

  // Updated input handlers that only auto-calculate when not manually overridden
  const handleFromAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFromAmount(value);
    setLastEditedField('from');
    
    // Only auto-calculate if we just edited the 'from' field and 'to' field hasn't been manually edited recently
    if (value && (lastEditedField === 'from' || !toAmount)) {
      const converted = calculateConversion(value, fromAsset, toAsset);
      if (converted) {
        setToAmount(converted);
      }
    } else if (!value) {
      setToAmount("");
    }
  };

  const handleToAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setToAmount(value);
    setLastEditedField('to');
    
    // Only auto-calculate if we just edited the 'to' field and 'from' field hasn't been manually edited recently
    if (value && (lastEditedField === 'to' || !fromAmount)) {
      const converted = calculateConversion(value, toAsset, fromAsset);
      if (converted) {
        setFromAmount(converted);
      }
    } else if (!value) {
      setFromAmount("");
    }
  };

  // Fetch prices
  const fetchPrices = async () => {
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
  };

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, []);

  // System data
  useEffect(() => {
    const fetchData = async () => {
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
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  }, []);

  // Uptime
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      setUptime(`${minutes}m ${seconds}s`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch messages - Updated with improved logging and parameters
  const fetchAllMessages = async () => {
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
  };

  useEffect(() => {
    fetchAllMessages();
  }, [joinedCommunities]);

  // Actions
  const createUser = () => {
    if (usernameInput.trim()) {
      localStorage.setItem("username", usernameInput);
      setUsername(usernameInput);
    }
  };

  const createCommunity = () => {
    let contentTopic: string;
    let displayName: string;

    if (advancedMode) {
      if (!fullContentTopic.trim()) {
        toast.error("Content topic is empty");
        return;
      }
      
      // Validate format
      if (!validateContentTopic(fullContentTopic)) {
        toast.error("Invalid content topic format. Expected: /app/version/topic/encoding");
        return;
      }
      
      contentTopic = fullContentTopic.trim();
      // Generate display name using the helper function
      displayName = generateDisplayName(contentTopic);
    } else {
      if (!communityName.trim()) {
        toast.error("Community name is empty");
        return;
      }
      
      // Sanitize the community name to prevent breaking the content topic format
      const sanitizedName = sanitizeCommunityName(communityName);
      
      contentTopic = sanitizedName === "swap-offers"
        ? "/swap-offers/1/offer/proto"
        : `/waku/1/${sanitizedName}/proto`;
      displayName = communityName; // Keep original name for display
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

    // Add new community to the end (newest)
    const joined = [...joinedCommunities, payload];
    setJoinedCommunities(joined);
    localStorage.setItem("communities", JSON.stringify(joined));
    setCommunity(payload);
    localStorage.setItem("community", JSON.stringify(payload));
    
    // Clear inputs
    setCommunityName("");
    setFullContentTopic("");
    
    toast.success(`Joined ${displayName}`);
  };

  const selectCommunity = (index: number) => {
    const selected = joinedCommunities[index];
    setCommunity(selected);
    localStorage.setItem("community", JSON.stringify(selected));
  };

  const deleteCommunity = (index: number) => {
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
  };

  const sendMessage = async (customMessage?: string) => {
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
      setTimeout(() => fetchAllMessages(), 1000);
    } catch (error: any) {
      toast.error(`Error sending message: ${error?.response?.status || "Unknown error"}`);
    }
  };

  const sendSwapOffer = () => {
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
  };

  const swapAssets = () => {
    const tempAsset = fromAsset;
    const tempAmount = fromAmount;
    setFromAsset(toAsset);
    setFromAmount(toAmount);
    setToAsset(tempAsset);
    setToAmount(tempAmount);
  };

  const handleSettingsSave = () => {
    if (tempUsername !== username) {
      setUsername(tempUsername);
      localStorage.setItem("username", tempUsername);
      toast.success("Username updated");
    }
    localStorage.setItem("debugMode", debugMode.toString());
    localStorage.setItem("advancedMode", advancedMode.toString());
    setSettingsOpen(false);
  };

  const getHealthIndicator = () => {
    if (!health) return "🔴";
    const nodeHealth = health.nodeHealth?.toLowerCase().trim();
    return ["ready", "ok", "healthy", "up"].includes(nodeHealth) ? "🟢" : "🔴";
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 pb-20">
      {/* Price Bar */}
      {username && joinedCommunities.length > 0 && community?.name === "swap-offers" && (
        <PriceBar priceData={priceData} />
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

      {/* Username Setup */}
      {!username && (
        <div className="flex flex-col items-center justify-center min-h-screen gap-6">
          <h1 className="text-2xl font-bold text-white">Welcome to VeriDAO Chat</h1>
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

      {/* Community Setup */}
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
              <SwapOffers
                messages={messages}
                community={community}
                fetchAllMessages={fetchAllMessages}
                debugMode={debugMode}
                username={username}
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

