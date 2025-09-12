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
import axios from "axios";
import { Github, Settings, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import logo from "./assets/logo-waku.svg";

interface Message {
  payload: string;         // base64
  contentTopic: string;
  timestamp?: string;      // nanoseconds since epoch as string (uint64)
  meta?: string;           // base64
  version?: number;
}

interface Cursor {
  digest: {
    data: string;
  };
  sender_time: number;
  store_time: number;
  pubsub_topic: string;
}

interface ResponseData {
  messages: Message[];
  cursor?: Cursor;
}

interface MessageData {
  message: Message;
  message_hash: string;
}

interface CommunityMetadata {
  name: string;
  contentTopic: string;
}

interface InfoResponse {
  listenAddresses: string[];
  enrUri: string;
}

interface HealthResponse {
  nodeHealth: string;
  protocolsHealth: string[];
}

const SERVICE_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || "http://localhost:8645";

// Simple central error handler
export function handleError(error: any): void {
  let message: string;
  if (error.response) {
    message = `Error: ${error.response.status}\nMessage: ${JSON.stringify(error.response.data)}`;
  } else if (error.request) {
    message = "Error: No response received from server";
  } else {
    message = `Error: ${error.message}`;
  }
  alert(message);
}

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
const decodeBase64Utf8 = (b64: string): string => {
  const bytes = bytesFromBase64(b64);
  return new TextDecoder().decode(bytes);
};

function App() {
  const [newMessage, setNewMessage] = useState("");
  const [username, setUsername] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [community, setCommunity] = useState<CommunityMetadata | undefined>(
    undefined
  );
  const [joinedCommunities, setJoinedCommunities] = useState<
    CommunityMetadata[]
  >([]);
  const [communityName, setCommunityName] = useState("");
  const [apiEndpoint, setApiEndpoint] = useState(SERVICE_ENDPOINT);
  const [nwakuVersion, setNwakuVersion] = useState("");
  const [infoNode, setInfoNode] = useState<InfoResponse>();
  const [health, setHealth] = useState<HealthResponse>();
  const [numPeers, setNumPeers] = useState("");
  const [fromAsset, setFromAsset] = useState("BTC");
  const [fromAmount, setFromAmount] = useState("");
  const [toAsset, setToAsset] = useState("USDC");
  const [toAmount, setToAmount] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateMessage = (e: any) => setNewMessage(e.target.value);

  useEffect(() => {
    const name = GetUser();
    setUsername(name);

    const localCommunity = localStorage.getItem("community");
    console.log("current community", localCommunity);
    setCommunity(localCommunity ? JSON.parse(localCommunity) : undefined);

    const communities = localStorage.getItem("communities");
    if (communities) {
      const parsed = JSON.parse(communities);
      setJoinedCommunities(parsed);
      console.log("joined communities", parsed);
    }
  }, []);

  useEffect(() => {
    const fetchNwakuVersion = async () => {
      try {
        const url = `${apiEndpoint}/debug/v1/version`;
        const response = await axios.get(url);
        console.log("fetchNwakuVersion data:", response.data);
        setNwakuVersion(response.data);
      } catch (error) {
        console.error("Error fetching version:", error);
      }
    };
    fetchNwakuVersion();
  }, [apiEndpoint]);

  useEffect(() => {
    const fetchInfoNode = async () => {
      try {
        const url = `${apiEndpoint}/debug/v1/info`;
        const response = await axios.get<InfoResponse>(url);
        console.log("fetchInfoNode data:", response.data);
        setInfoNode(response.data);
      } catch (error) {
        console.error("Error fetching node info:", error);
      }
    };
    fetchInfoNode();
  }, [apiEndpoint]);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const url = `${apiEndpoint}/health`;
        const response = await axios.get<HealthResponse>(url);
        console.log("fetchHealth data:", response.data);
        setHealth(response.data);
      } catch (error) {
        console.error("Error fetching health:", error);
      }
    };
    fetchHealth();
  }, [apiEndpoint]);

  const fetchAllMessages = async () => {
    try {
      if (!joinedCommunities.length) {
        setMessages([]);
        return;
      }
      const params = new URLSearchParams();
      for (const c of joinedCommunities) {
        params.append("contentTopics", c.contentTopic);
      }
      params.set("includeData", "true");

      const url = `${apiEndpoint}/store/v1/messages?${params.toString()}`;
      const response = await axios.get<ResponseData>(url);
      console.log("fetchAllMessages data:", response.data);
      setMessages(response.data.messages || []);
    } catch (error) {
      console.error("Error fetching all messages:", error);
    }
  };

  useEffect(() => {
    fetchAllMessages();
  }, [joinedCommunities, apiEndpoint]);

  useEffect(() => {
    const fetchNumPeers = async () => {
      try {
        const url = `${apiEndpoint}/admin/v1/peers`;
        const response = await axios.get(url);
        console.log("fetchNumPeers data:", response.data);
        const count = Array.isArray(response.data) ? response.data.length : (response.data?.length ?? 0);
        setNumPeers(String(count));
      } catch (error) {
        console.error("Error fetching peers:", error);
      }
    };
    fetchNumPeers();
  }, [apiEndpoint]);

  const createUser = () => {
    if (usernameInput) {
      localStorage.setItem("username", usernameInput);
      setUsername(usernameInput);
    }
  };

  const GetUser = () => {
    const name = localStorage.getItem("username");
    if (name) {
      return name;
    }
    return "";
  };

  const createCommunity = async (name: string) => {
    if (name === "") {
      toast.error("Community name is empty");
      return;
    }

    // Fix: Use proper content topic format
    let contentTopic: string;
    if (name === "swap-offers") {
      contentTopic = "/swap-offers/1/offer/proto";
    } else {
      // Use the correct 4-part format: /<application>/<version>/<topic-name>/<encoding>
      contentTopic = `/waku/1/${name}/proto`;
    }
    
    const payload: CommunityMetadata = { name, contentTopic };

    // Avoid duplicates
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

  const checkForEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      sendMessage();
    }
  };

  // FIX: Send a single WakuMessage body to /relay/v1/auto/messages (not { messages: […] })
  // Also omit timestamp to avoid deserialization issues on some nodes; the node can set it.
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

    const url = `${apiEndpoint}/relay/v1/auto/messages`;
    const data: Message = {
      payload: encodeBase64Utf8(text),
      contentTopic: community.contentTopic,
      // timestamp intentionally omitted; node will populate
    };

    try {
      console.log("Attempting to send message with data:", data);
      const response = await axios.post(url, data, {
        headers: { "Content-Type": "application/json" },
      });
      console.log("sendMessage response:", response?.status, response?.data);
      if (!customMessage) {
        setNewMessage("");
      }
      toast.success("Message sent");
    } catch (error: any) {
      console.error(
        "Error sending message:",
        error,
        "Server response:",
        error?.response?.data
      );
      toast.error(
        `Error sending message: ${error?.response?.status || ""} ${error?.response?.data ? JSON.stringify(error.response.data) : ""}`
      );
    }
  };

  const sendSwapOffer = () => {
    if (!fromAmount || !toAmount) {
      toast.error("Amounts are required");
      return;
    }
    const offer = {
      fromAsset,
      fromAmount: parseFloat(fromAmount),
      toAsset,
      toAmount: parseFloat(toAmount),
      timestamp: Math.floor(Date.now() / 1000),
    };
    sendMessage(JSON.stringify(offer));
    setFromAmount("");
    setToAmount("");
  };

  const toHexBytes = (bytes: Uint8Array) =>
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");

  const decodeMsg = (index: number, msg: Message) => {
    let payloadText = "";
    let rawBytes: Uint8Array | undefined;

    try {
      rawBytes = bytesFromBase64(msg.payload);
      payloadText = new TextDecoder().decode(rawBytes);
    } catch {
      payloadText = "(unable to decode payload)";
    }

    if (msg.contentTopic.includes("swap-offers")) {
      try {
        const offer = JSON.parse(payloadText);
        return (
          <li key={index}>
            From: {offer.fromAsset} {offer.fromAmount} To: {offer.toAsset} {offer.toAmount}{" "}
            <span className="text-gray-500 text-xs">{formatDate(msg.timestamp)}</span>
          </li>
        );
      } catch {
        return (
          <li key={index}>
            Invalid offer (hex): {rawBytes ? toHexBytes(rawBytes) : "N/A"}{" "}
            <span className="text-gray-500 text-xs">{formatDate(msg.timestamp)}</span>
          </li>
        );
      }
    }

    return (
      <li key={index}>
        {payloadText} <span className="text-gray-500 text-xs">{formatDate(msg.timestamp)}</span>
      </li>
    );
  };

  const logoImage = () => {
    return (
      <div className="flex flex-row items-center gap-2">
        <img src={logo} className="logo w-16" alt="Waku logo" />
      </div>
    );
  };

  const settingsDialog = () => {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon">
            <Settings />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>Configure the API endpoint</DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="endpoint" className="sr-only">
                Endpoint
              </Label>
              <Input
                id="endpoint"
                value={apiEndpoint}
                onChange={(e) => setApiEndpoint(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-start">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const createCommunityDialog = () => {
    return (
      <div className="flex flex-col gap-4 items-center">
        <Input
          value={communityName}
          onChange={(e) => setCommunityName(e.target.value)}
          placeholder="Input the community name"
          autoComplete="off"
          autoCorrect="off"
        />

        <Label className="text-gray-500">
          For example: <span className="underline">waku</span>
        </Label>

        <Button className="w-50" onClick={() => createCommunity(communityName)}>
          Join Community
        </Button>
      </div>
    );
  };

  const formatDate = (timestamp?: string) => {
    try {
      if (!timestamp) return "";
      const ns = BigInt(timestamp);
      const ms = Number(ns / 1000000n);
      const date = new Date(ms);
      return date.toLocaleString();
    } catch {
      return "";
    }
  };

  return (
    <div>
      <div className="absolute right-36 top-16">
        <Label className="text-md">Hello, {username}</Label>
      </div>

      <div className="absolute right-24 top-16">
        <a href="https://github.com/waku-org/waku-frontend" target="_blank">
          <Github />
        </a>
      </div>

      <div className="absolute right-16 top-16">{settingsDialog()}</div>

      <div className="absolute left-16 top-16 flex flex-col">
        <Label className="text-md">
          Health: {health?.nodeHealth === "Ready" ? "🟢" : "🔴"}
        </Label>
        <Label className="text-md">Nwaku Version: {nwakuVersion}</Label>
        <Label className="text-md">Number of Peers: {numPeers}</Label>
        <Label className="text-md">Multiaddress: {infoNode?.listenAddresses}</Label>
        {/*<Label className="text-md">ENR: {infoNode?.enrUri}</Label>*/}
      </div>

      {!username && (
        <div className="flex flex-col gap-5 items-center justify-center h-screen mt-[-60px]">
          {logoImage()}
          <div className="flex flex-col items-center gap-3">
            <Input
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="Enter your username"
              autoComplete="off"
              autoCorrect="off"
            />
            <Button className="w-32" onClick={createUser}>
              Create
            </Button>
          </div>
        </div>
      )}

      {username && joinedCommunities.length === 0 && (
        <div className="flex flex-col gap-5 items-center justify-center h-screen mt-[-60px]">
          {logoImage()}
          {createCommunityDialog()}
        </div>
      )}

      {username && joinedCommunities.length > 0 && (
        <div className="flex md:flex-row flex-col h-screen items-center justify-center gap-10">
          <div className="flex flex-col gap-8 mt-36 md:mt-0">
            <div>
              <h1 className="text-xl font-bold mb-2">Communities</h1>
              <ul>
                {joinedCommunities.map((item, index) => (
                  <li key={index} onClick={() => selectCommunity(index)}>
                    <div className="flex flex-row items-center gap-1">
                      <Label
                        className={
                          item.name === community?.name ? "bg-green-200" : ""
                        }
                      >
                        {item.name}
                      </Label>
                      <X size={18} onClick={deleteCommunity(index)} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {createCommunityDialog()}
          </div>
          <div className="flex flex-col gap-10 items-center justify-center">
            {logoImage()}
            {community && (
              <div className="flex flex-col gap-10 items-center">
                {community.name === "swap-offers" ? (
                  (() => {
                    console.log("Rendering swap form");
                    return (
                      <div className="flex flex-col gap-4 w-full max-w-sm">
                        <Label>From</Label>
                        <Select value={fromAsset} onValueChange={setFromAsset}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select asset" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="BTC">Bitcoin (BTC)</SelectItem>
                            <SelectItem value="USDC">USDC (USDC)</SelectItem>
                            {/* Add more assets as needed */}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          value={fromAmount}
                          onChange={(e) => setFromAmount(e.target.value)}
                          placeholder="0.0"
                        />
                        <Label>To</Label>
                        <Select value={toAsset} onValueChange={setToAsset}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select asset" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="BTC">Bitcoin (BTC)</SelectItem>
                            <SelectItem value="USDC">USDC (USDC)</SelectItem>
                            {/* Add more assets as needed */}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          value={toAmount}
                          onChange={(e) => setToAmount(e.target.value)}
                          placeholder="0.0"
                        />
                        <Button onClick={sendSwapOffer}>Send Offer</Button>
                      </div>
                    );
                  })()
                ) : (
                  (() => {
                    console.log("Rendering text input");
                    return (
                      <div className="flex w-full max-w-sm items-center space-x-2">
                        <Input
                          value={newMessage}
                          onChange={updateMessage}
                          onKeyDown={checkForEnter}
                          placeholder="Type your message here"
                          autoComplete="off"
                          autoCorrect="off"
                        />
                        <Button className="w-32" onClick={() => sendMessage()}>
                          Send
                        </Button>
                      </div>
                    );
                  })()
                )}

                <div>
                  <h1 className="text-xl font-bold mb-2">Message History</h1>
                  <Button variant="outline" onClick={fetchAllMessages}>
                    Refresh
                  </Button>
                  <ScrollArea className="h-[300px] md:w-[650px] rounded-md border p-4 bg-gray-100">
                    <ul className="text-sm flex flex-col gap-1">
                      {messages
                        .filter((msg) => msg.contentTopic === community.contentTopic)
                        .map((msg, index) => decodeMsg(index, msg))}
                    </ul>
                  </ScrollArea>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

