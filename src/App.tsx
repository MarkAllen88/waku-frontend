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
import { Settings, X, ArrowUpDown, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
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

// Hoisted components with proper typing
type PriceBarProps = { priceData: PriceData };
const PriceBar = React.memo(({ priceData }: PriceBarProps) => (
  <div className="fixed top-0 left-0 right-0 bg-gray-800 border-b border-gray-700 p-3 z-40">
    <div className="flex justify-center gap-6">
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
));

interface RightSidebarProps {
  username: string;
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  tempUsername: string;
  setTempUsername: (v: string) => void;
  handleSettingsSave: () => void;
  joinedCommunities: CommunityMetadata[];
  community?: CommunityMetadata;
  selectCommunity: (index: number) => void;
  deleteCommunity: (index: number) => (e: React.MouseEvent) => void;
  communityName: string;
  setCommunityName: (v: string) => void;
  createCommunity: () => void;
  isSwapOffers: boolean;
}

const RightSidebar = React.memo((props: RightSidebarProps) => {
  const {
    username, settingsOpen, setSettingsOpen, tempUsername, setTempUsername, handleSettingsSave,
    joinedCommunities, community, selectCommunity, deleteCommunity,
    communityName, setCommunityName, createCommunity, isSwapOffers
  } = props;

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
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-gray-200 hover:bg-gray-700">
                <Settings size={16} />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-800 text-gray-200 border-gray-700">
              <DialogHeader>
                <DialogTitle>Settings</DialogTitle>
                <DialogDescription className="text-gray-400">Configure your preferences</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={tempUsername}
                    onChange={(e) => setTempUsername(e.target.value)}
                    className="bg-gray-700 text-gray-200 border-gray-600 mt-2"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setSettingsOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSettingsSave}>
                  Save
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
          <CardTitle className="text-white text-lg">Communities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-4">
          {joinedCommunities.map((item, index) => (
            <div key={item.contentTopic} className="flex items-center justify-between">
              <Button
                variant={item.name === community?.name ? "default" : "ghost"}
                onClick={() => selectCommunity(index)}
                className={`flex-1 justify-start text-sm ${
                  item.name === community?.name
                    ? "bg-green-600 hover:bg-green-700"
                    : "text-gray-300 hover:bg-gray-700"
                }`}
              >
                {item.name}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={deleteCommunity(index)}
                className="text-gray-400 hover:text-red-400 ml-2 p-1"
              >
                <X size={14} />
              </Button>
            </div>
          ))}
          <div className="pt-2 border-t border-gray-700">
            <Input
              value={communityName}
              onChange={(e) => setCommunityName(e.target.value)}
              placeholder="Community name"
              className="bg-gray-700 border-gray-600 text-white mb-2 text-sm"
            />
            <Button
              onClick={createCommunity}
              className="w-full bg-blue-600 hover:bg-blue-700 text-sm py-2"
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
          <CardTitle className="text-white text-lg">Asset Swap</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label className="text-gray-300 text-sm">From</Label>
            <div className="flex gap-2">
              <Select value={fromAsset} onValueChange={setFromAsset}>
                <SelectTrigger className="w-28 bg-gray-700 border-gray-600 text-white">
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
                className="bg-gray-700 border-gray-600 text-white text-right"
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
            <div className="flex gap-2">
              <Select value={toAsset} onValueChange={setToAsset}>
                <SelectTrigger className="w-28 bg-gray-700 border-gray-600 text-white">
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
                className="bg-gray-700 border-gray-600 text-white text-right"
              />
            </div>
          </div>

          <Button
            onClick={sendSwapOffer}
            className="w-full bg-blue-600 hover:bg-blue-700 font-medium py-2 mt-4"
            disabled={!fromAmount || !toAmount}
          >
            Create Swap Offer
          </Button>
        </CardContent>
      </Card>
    </div>
  );
});

interface SwapOffersProps {
  messages: Message[];
  community?: CommunityMetadata;
  fetchAllMessages: () => void;
}

const SwapOffers = React.memo(({ messages, community, fetchAllMessages }: SwapOffersProps) => {
  const swapOffers = messages
    .filter(msg => msg.contentTopic === community?.contentTopic)
    .map((msg) => {
      try {
        const rawBytes = bytesFromBase64(msg.payload);
        const payloadText = new TextDecoder().decode(rawBytes);
        const offer = JSON.parse(payloadText);
        
        if (!offer.fromAsset || !offer.toAsset || !offer.fromAmount || !offer.toAmount) {
          return null;
        }
        
        const getAssetDisplay = (asset: string) => {
          switch (asset) {
            case 'BTC': return <div className="w-4 h-4 bg-orange-500 rounded-full" />;
            case 'ETH': return <div className="w-4 h-4 bg-gray-400 rounded-full" />;
            case 'USDC': return <div className="w-4 h-4 bg-blue-500 rounded-full" />;
            case 'VERI': return <img src="https://activate.veri.vip/favicon.svg" alt="VERI" className="w-4 h-4" />;
            default: return <div className="w-4 h-4 bg-gray-500 rounded-full" />;
          }
        };
        
        return {
          key: `${msg.timestamp ?? ''}-${offer.fromAsset}-${offer.toAsset}-${offer.fromAmount}-${offer.toAmount}`,
          fromAsset: offer.fromAsset,
          fromAmount: offer.fromAmount,
          toAsset: offer.toAsset,
          toAmount: offer.toAmount,
          timestamp: msg.timestamp,
          rate: (offer.toAmount / offer.fromAmount).toFixed(6),
          fromDisplay: getAssetDisplay(offer.fromAsset),
          toDisplay: getAssetDisplay(offer.toAsset)
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Array<{
      key: string; fromAsset: string; fromAmount: number; toAsset: string; toAmount: number;
      timestamp?: string; rate: string; fromDisplay: JSX.Element; toDisplay: JSX.Element;
    }>;

  return (
    <div className="w-full max-w-lg mx-auto">
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-white text-lg">Swap Offers</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAllMessages}
            className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
          >
            <RefreshCw size={14} className="mr-1" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-4">
          {swapOffers.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">📭</div>
              <h3 className="text-lg font-semibold text-white mb-1">No offers available</h3>
              <p className="text-gray-400 text-sm">Be the first to create a swap offer!</p>
            </div>
          ) : (
            <div className="h-64 overflow-y-auto">
              <div className="space-y-2 pr-2">
                {swapOffers.map(offer => (
                  <div key={offer.key} className="bg-gray-700/30 rounded p-3 border border-gray-600/50">
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
  
  const [nwakuVersion, setNwakuVersion] = useState("");
  const [health, setHealth] = useState<HealthResponse>();
  const [numPeers, setNumPeers] = useState("");
  const [uptime, setUptime] = useState("");
  const [messagesSent, setMessagesSent] = useState(0);
  const [messagesReceived, setMessagesReceived] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tempUsername, setTempUsername] = useState("");
  
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

  // Simple input handlers
  const handleFromAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFromAmount(value);
    if (value) {
      const converted = calculateConversion(value, fromAsset, toAsset);
      setToAmount(converted);
    } else {
      setToAmount("");
    }
  };

  const handleToAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setToAmount(value);
    if (value) {
      const converted = calculateConversion(value, toAsset, fromAsset);
      setFromAmount(converted);
    } else {
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

  // Fetch messages
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
      params.set("pageSize", "100");

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
    if (!communityName.trim()) {
      toast.error("Community name is empty");
      return;
    }

    const contentTopic = communityName === "swap-offers" ? "/swap-offers/1/offer/proto" : `/waku/1/${communityName}/proto`;
    const payload: CommunityMetadata = { name: communityName, contentTopic };

    const exists = joinedCommunities.some((c) => c.contentTopic === payload.contentTopic);
    const joined = exists ? joinedCommunities : [...joinedCommunities, payload];

    setJoinedCommunities(joined);
    localStorage.setItem("communities", JSON.stringify(joined));
    setCommunity(payload);
    localStorage.setItem("community", JSON.stringify(payload));
    setCommunityName("");
  };

  const selectCommunity = (index: number) => {
    const selected = joinedCommunities[index];
    setCommunity(selected);
    localStorage.setItem("community", JSON.stringify(selected));
  };

  const deleteCommunity = (index: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
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
          community={community}
          selectCommunity={selectCommunity}
          deleteCommunity={deleteCommunity}
          communityName={communityName}
          setCommunityName={setCommunityName}
          createCommunity={createCommunity}
          isSwapOffers={community?.name === "swap-offers"}
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
            <Input
              value={communityName}
              onChange={(e) => setCommunityName(e.target.value)}
              placeholder="Enter community name (e.g., swap-offers)"
              className="bg-gray-700 border-gray-600 text-white"
            />
            <Button onClick={createCommunity} className="w-full bg-blue-600 hover:bg-blue-700">
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
              />
            </>
          ) : (
            <div className="w-full max-w-4xl space-y-6">
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
              
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader className="flex flex-row items-center justify-between py-3">
                  <CardTitle className="text-white text-lg">Message History</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchAllMessages}
                    className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                  >
                    <RefreshCw size={14} className="mr-1" />
                    Refresh
                  </Button>
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
