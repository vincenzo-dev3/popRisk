"use client";

import { createBaseAccountSDK } from "@base-org/account";
import { useCallback, useEffect, useState, useRef } from "react";
import { baseSepolia } from "viem/chains";
import { encodeFunctionData, parseEther, formatEther } from "viem";

// BalloonGame contract address on Base Sepolia (Latest deployment)
const BALLOON_GAME_ADDRESS = "0xFFD623B4E560d49b0Cd838be2d5C7aFD1D7c58d6";

// BalloonGame contract ABI
const BALLOON_GAME_ABI = [
  {
    inputs: [],
    name: "startGame",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "pumpBalloon",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "collectPoints",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "player", type: "address" }],
    name: "getGameState",
    outputs: [
      { name: "currentRound", type: "uint256" },
      { name: "pumpCount", type: "uint256" },
      { name: "pendingPoints", type: "uint256" },
      { name: "totalScore", type: "uint256" },
      { name: "isActive", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "player", type: "address" }],
    name: "getHighScore",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getLeaderboard",
    outputs: [
      { name: "topPlayers", type: "address[]" },
      { name: "topScores", type: "uint256[]" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Game state interface
interface GameState {
  currentRound: number;
  pumpCount: number;
  pendingPoints: number;
  totalScore: number;
  isActive: boolean;
}

interface LeaderboardEntry {
  address: string;
  score: number;
}

export default function Home() {
  const [provider, setProvider] = useState<ReturnType<
    ReturnType<typeof createBaseAccountSDK>["getProvider"]
  > | null>(null);
  const [connected, setConnected] = useState(false);
  const [universalAddress, setUniversalAddress] = useState<string>("");
  const [subAccountAddress, setSubAccountAddress] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Ready to connect");
  
  // Game state
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [highScore, setHighScore] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [balloonSize, setBalloonSize] = useState(100); // Animation state
  const [isPopping, setIsPopping] = useState(false);
  const [isPumping, setIsPumping] = useState(false);
  const [sessionExpiry, setSessionExpiry] = useState<Date | null>(null);
  const [universalBalance, setUniversalBalance] = useState<string>("0");
  const [subBalance, setSubBalance] = useState<string>("0");
  const [transactionHistory, setTransactionHistory] = useState<Array<{
    type: string;
    hash: string;
    timestamp: Date;
    description: string;
    isBundled?: boolean; // wallet_sendCalls returns bundled transaction ID, not a direct tx hash
  }>>([]);

  // Audio system
  const [audioInitialized, setAudioInitialized] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const pumpBufferRef = useRef<AudioBuffer | null>(null);
  const popBufferRef = useRef<AudioBuffer | null>(null);

  // Initialize SDK with quickstart configuration
  useEffect(() => {
    const initializeSDK = async () => {
      try {
        const sdkInstance = createBaseAccountSDK({
          appName: "Balloon Game",
          appLogoUrl: "https://base.org/logo.png",
          appChainIds: [baseSepolia.id],
          // Quickstart configuration with sub accounts
          subAccounts: {
            creation: "on-connect",
            defaultAccount: "sub",
          },
        });

        const providerInstance = sdkInstance.getProvider();
        setProvider(providerInstance);
        setStatus("🎈 Ready to play! Connect your wallet to start");
      } catch (error) {
        console.error("SDK initialization failed:", error);
        setStatus("SDK initialization failed");
      }
    };

    initializeSDK();
  }, []);

  // Fetch balances
  const fetchBalances = useCallback(async () => {
    if (!provider || !universalAddress || !subAccountAddress) return;

    try {
      // Fetch Universal Account balance
      const universalBalanceHex = await provider.request({
        method: "eth_getBalance",
        params: [universalAddress, "latest"],
      }) as string;
      
      const universalBalanceBigInt = BigInt(universalBalanceHex);
      const universalBalanceEth = formatEther(universalBalanceBigInt);
      setUniversalBalance(parseFloat(universalBalanceEth).toFixed(4));

      // Fetch Sub Account balance
      const subBalanceHex = await provider.request({
        method: "eth_getBalance",
        params: [subAccountAddress, "latest"],
      }) as string;
      
      const subBalanceBigInt = BigInt(subBalanceHex);
      const subBalanceEth = formatEther(subBalanceBigInt);
      setSubBalance(parseFloat(subBalanceEth).toFixed(4));
    } catch (error) {
      console.error("Failed to fetch balances:", error);
    }
  }, [provider, universalAddress, subAccountAddress]);

  // Initialize audio system
  const initAudio = useCallback(() => {
    if (audioInitialized) return;

    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContext();

      // Generate pump sound
      const pumpDuration = 0.4;
      const pumpBuffer = audioContext.createBuffer(1, audioContext.sampleRate * pumpDuration, audioContext.sampleRate);
      const pumpData = pumpBuffer.getChannelData(0);

      for (let i = 0; i < pumpBuffer.length; i++) {
        const t = i / pumpBuffer.length;
        const envelope = Math.sin(t * Math.PI) * 0.5;
        pumpData[i] = (Math.random() * 2 - 1) * envelope;
      }

      // Generate pop sound
      const popDuration = 0.3;
      const popBuffer = audioContext.createBuffer(1, audioContext.sampleRate * popDuration, audioContext.sampleRate);
      const popData = popBuffer.getChannelData(0);

      for (let i = 0; i < popBuffer.length; i++) {
        const t = i / popBuffer.length;
        const envelope = Math.exp(-t * 10);
        popData[i] = (Math.random() * 2 - 1) * envelope;
      }

      audioContextRef.current = audioContext;
      pumpBufferRef.current = pumpBuffer;
      popBufferRef.current = popBuffer;
      setAudioInitialized(true);

      console.log('Audio initialized successfully');
    } catch (e) {
      console.log('Audio initialization error:', e);
    }
  }, [audioInitialized]);

  // Play pump sound
  const playPumpSound = useCallback(() => {
    try {
      if (!audioInitialized || !audioContextRef.current || !pumpBufferRef.current) return;

      const source = audioContextRef.current.createBufferSource();
      source.buffer = pumpBufferRef.current;

      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.value = 0.3;

      source.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      source.start(0);
    } catch (e) {
      console.log('Sound play error:', e);
    }
  }, [audioInitialized]);

  // Play pop sound
  const playPopSound = useCallback(() => {
    try {
      if (!audioInitialized || !audioContextRef.current || !popBufferRef.current) return;

      const source = audioContextRef.current.createBufferSource();
      source.buffer = popBufferRef.current;

      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.value = 0.5;

      source.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      source.start(0);
    } catch (e) {
      console.log('Sound play error:', e);
    }
  }, [audioInitialized]);

  // Fetch game state from contract
  const fetchGameState = useCallback(async (playerAddress: string) => {
    if (!provider) return;

    try {
      const data = encodeFunctionData({
        abi: BALLOON_GAME_ABI,
        functionName: "getGameState",
        args: [playerAddress as `0x${string}`],
      });

      const result = await provider.request({
        method: "eth_call",
        params: [
          {
            to: BALLOON_GAME_ADDRESS,
            data: data,
          },
          "latest",
        ],
      });

      // Parse the result (simplified - in production use a proper decoder)
      console.log("Game state result:", result);
      // TODO: Implement proper decoding
    } catch (error) {
      console.error("Failed to fetch game state:", error);
    }
  }, [provider]);

  // Check session expiry
  useEffect(() => {
    if (!sessionExpiry) return;

    const interval = setInterval(() => {
      if (new Date() > sessionExpiry) {
        setStatus("⏰ Session expired! Please reconnect to continue playing");
        setConnected(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionExpiry]);

  // Refresh balances periodically
  useEffect(() => {
    if (!connected) return;

    // Initial fetch
    fetchBalances();

    // Refresh every 10 seconds
    const interval = setInterval(() => {
      fetchBalances();
    }, 10000);

    return () => clearInterval(interval);
  }, [connected, fetchBalances]);

  const connectWallet = async () => {
    if (!provider) {
      setStatus("Provider not initialized");
      return;
    }

    setLoading(true);
    setStatus("🔗 Connecting wallet and creating sub account...");

    try {
      // With quickstart config, this will automatically create a sub account
      await provider.request({
        method: "wallet_connect",
        params: [],
      });

      const accounts = (await provider.request({
        method: "eth_requestAccounts",
        params: [],
      })) as string[];

      // With defaultAccount: 'sub', the sub account is the first account
      const subAddr = accounts[0];
      const universalAddr = accounts[1];

      setSubAccountAddress(subAddr);
      setUniversalAddress(universalAddr);
      setConnected(true);
      
      // Set 2-hour session expiry
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + 2);
      setSessionExpiry(expiry);
      
      setStatus("✅ Connected! Sub account ready for gasless gaming");

      // Fetch initial data
      await Promise.all([fetchLeaderboard(), fetchBalances()]);
    } catch (error) {
      console.error("Connection failed:", error);
      setStatus(`❌ Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch leaderboard
  const fetchLeaderboard = useCallback(async () => {
    if (!provider) return;

    try {
      const data = encodeFunctionData({
        abi: BALLOON_GAME_ABI,
        functionName: "getLeaderboard",
        args: [],
      });

      await provider.request({
        method: "eth_call",
        params: [
          {
            to: BALLOON_GAME_ADDRESS,
            data: data,
          },
          "latest",
        ],
      });

      // TODO: Decode and set leaderboard
      setLeaderboard([]);
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
    }
  }, [provider]);

  // Start a new game
  const startNewGame = useCallback(async () => {
    if (!provider || !subAccountAddress) {
      setStatus("Not connected or sub account not available");
      return;
    }

    setLoading(true);
    setStatus("🎮 Starting new game...");

    try {
      // Check network
      const chainId = await provider.request({
        method: "eth_chainId",
        params: [],
      });
      
      if (chainId !== `0x${baseSepolia.id.toString(16)}`) {
        setStatus(`❌ Wrong network! Please switch to Base Sepolia (chainId: ${baseSepolia.id})`);
        setLoading(false);
        return;
      }

      // Verify contract exists
      const contractCode = await provider.request({
        method: "eth_getCode",
        params: [BALLOON_GAME_ADDRESS, "latest"],
      }) as string;
      
      if (contractCode === "0x" || contractCode === "0x0") {
        setStatus(`❌ Contract not found at ${BALLOON_GAME_ADDRESS} on Base Sepolia. Please verify the contract address.`);
        setLoading(false);
        return;
      }

      // Check if user already has an active game
      try {
        const checkGameData = encodeFunctionData({
          abi: BALLOON_GAME_ABI,
          functionName: "getGameState",
          args: [subAccountAddress as `0x${string}`],
        });

        const gameStateResult = await provider.request({
          method: "eth_call",
          params: [
            {
              to: BALLOON_GAME_ADDRESS,
              data: checkGameData,
            },
            "latest",
          ],
        }) as string;

        console.log("Current game state result:", gameStateResult);
        
        // Decode the result (5 uint256 values)
        // Each uint256 is 32 bytes (64 hex chars) after the 0x
        const hex = gameStateResult.slice(2); // Remove 0x
        const isActive = parseInt(hex.slice(256, 320), 16) === 1;
        
        if (isActive) {
          const currentRound = parseInt(hex.slice(0, 64), 16);
          const pumpCount = parseInt(hex.slice(64, 128), 16);
          const pendingPoints = parseInt(hex.slice(128, 192), 16);
          const totalScore = parseInt(hex.slice(192, 256), 16);
          
          console.log("Decoded game state:", { currentRound, pumpCount, pendingPoints, totalScore, isActive });
          
          setStatus(`❌ You have an unfinished game! Round ${currentRound}/5, ${totalScore} points. Please finish it before starting a new one.`);
          setLoading(false);
          
          // Load the existing game state into UI
          setGameState({
            currentRound,
            pumpCount,
            pendingPoints,
            totalScore,
            isActive: true,
          });
          setBalloonSize(100 + pumpCount * 20);
          return;
        }
      } catch (checkError) {
        console.log("Could not check game state:", checkError);
      }

      const data = encodeFunctionData({
        abi: BALLOON_GAME_ABI,
        functionName: "startGame",
        args: [],
      });

      const entryFeeWei = parseEther("0.001");
      const entryFeeHex = `0x${entryFeeWei.toString(16)}`;
      
      console.log("=== Transaction Details ===");
      console.log("Entry Fee (Wei):", entryFeeWei.toString());
      console.log("Entry Fee (Hex):", entryFeeHex);
      console.log("From (Sub Account):", subAccountAddress);
      console.log("To (Contract):", BALLOON_GAME_ADDRESS);
      console.log("Chain ID:", baseSepolia.id);
      console.log("========================");

      const callsId = await provider.request({
        method: "wallet_sendCalls",
        params: [
          {
            version: "2.0",
            atomicRequired: true,
            chainId: `0x${baseSepolia.id.toString(16)}`,
            from: subAccountAddress,
            calls: [
              {
                to: BALLOON_GAME_ADDRESS,
                data: data,
                value: entryFeeHex,
              },
            ],
          },
        ],
      });

      const callsIdStr = typeof callsId === 'string' ? callsId : JSON.stringify(callsId);
      setStatus(`🎉 Game started! Transaction: ${callsIdStr.slice(0, 20)}...`);
      
      // Add to transaction history
      setTransactionHistory(prev => [{
        type: "Start Game",
        hash: callsIdStr,
        timestamp: new Date(),
        description: "Started new game - Paid 0.001 ETH entry fee",
        isBundled: true
      }, ...prev]);
      
      // Initialize game state
      setGameState({
        currentRound: 1,
        pumpCount: 0,
        pendingPoints: 0,
        totalScore: 0,
        isActive: true,
      });
      setBalloonSize(100);
      
      // Refresh balances after transaction
      setTimeout(() => {
        setStatus("🎈 Pump the balloon to earn points!");
        fetchBalances();
      }, 2000);
    } catch (error) {
      console.error("Start game failed:", error);
      console.error("Full error object:", JSON.stringify(error, null, 2));
      
      // Better error messages
      let errorMsg = 'Unknown error';
      if (error instanceof Error) {
        errorMsg = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMsg = String((error as any).message);
      }
      
      // Log more details
      console.log("Sub Account:", subAccountAddress);
      console.log("Sub Balance:", subBalance);
      console.log("Universal Balance:", universalBalance);
      
      // Check for common issues
      if (errorMsg.includes('insufficient funds') || errorMsg.includes('Insufficient funds')) {
        setStatus(`❌ Insufficient funds! Universal Account: ${universalBalance} ETH (need ~0.002 ETH)`);
      } else if (errorMsg.includes('execution reverted')) {
        setStatus(`❌ Transaction reverted. Your Universal Account has ${universalBalance} ETH. This might be a contract or network issue.`);
      } else if (errorMsg.includes('user rejected') || errorMsg.includes('User rejected')) {
        setStatus(`❌ Transaction rejected`);
      } else if (errorMsg.includes('Game already active')) {
        setStatus(`❌ You already have an active game! Finish it first.`);
      } else {
        setStatus(`❌ Failed: ${errorMsg.slice(0, 150)}`);
      }
    } finally {
      setLoading(false);
    }
  }, [provider, subAccountAddress]);

  // Pump the balloon
  const pumpBalloon = useCallback(async () => {
    if (!provider || !subAccountAddress || !gameState?.isActive) {
      setStatus("No active game");
      return;
    }

    // Initialize audio on first interaction
    initAudio();

    setLoading(true);
    const newPumpCount = gameState.pumpCount + 1;
    const earnedPoints = 10 * Math.pow(2, newPumpCount - 1);
    
    setStatus(`💨 Pumping... +${earnedPoints} points!`);

    // Play pump sound
    playPumpSound();

    // Animate balloon growing
    const newSize = 100 + newPumpCount * 20;
    setBalloonSize(newSize);

    // Add pumping animation
    setIsPumping(true);
    setTimeout(() => setIsPumping(false), 300);

    try {
      console.log(`=== Pumping: Count ${newPumpCount} ===`);
      const data = encodeFunctionData({
        abi: BALLOON_GAME_ABI,
        functionName: "pumpBalloon",
        args: [],
      });

      // Animate balloon growing
      setBalloonSize(100 + newPumpCount * 20);

      const callsId = (await provider.request({
        method: "wallet_sendCalls",
        params: [
          {
            version: "2.0",
            atomicRequired: true,
            chainId: `0x${baseSepolia.id.toString(16)}`,
            from: subAccountAddress,
            calls: [
              {
                to: BALLOON_GAME_ADDRESS,
                data: data,
                value: "0x0",
              },
            ],
          },
        ],
      })) as string;

      // Add to transaction history
      const txHashStr = typeof callsId === 'string' ? callsId : JSON.stringify(callsId);
      setTransactionHistory(prev => [{
        type: "Pump",
        hash: txHashStr,
        timestamp: new Date(),
        description: `Pumped balloon (Round ${gameState.currentRound}, Pump #${newPumpCount}) +${earnedPoints} points`,
        isBundled: true
      }, ...prev]);
      
      // Update local game state
      setGameState({
        ...gameState,
        pumpCount: newPumpCount,
        pendingPoints: gameState.pendingPoints + earnedPoints,
      });

      setStatus(`✨ Pumped ${newPumpCount} times! Pending: ${gameState.pendingPoints + earnedPoints} points`);
      setLoading(false);
    } catch (error) {
      console.error("Pump failed:", error);
      console.error("Full error object:", JSON.stringify(error, null, 2));
      console.error("Pump count was:", newPumpCount);
      
      // Get error message
      let errorMsg = '';
      if (error instanceof Error) {
        errorMsg = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMsg = String((error as any).message);
      }
      
      // Check if balloon popped (contract uses random probability after pump 3)
      // Don't assume it ALWAYS pops at 3 - check for actual pop errors from contract
      const isPoppedError = errorMsg.toLowerCase().includes("popped") || 
                           errorMsg.toLowerCase().includes("balloon popped") ||
                           errorMsg.toLowerCase().includes("execution reverted") ||
                           errorMsg.toLowerCase().includes("game over");
      
      if (isPoppedError) {
        setIsPopping(true);
        setBalloonSize(0);
        playPopSound();
        setStatus(`💥 BALLOON POPPED! Lost ${gameState.pendingPoints} pending points`);
        
        setTimeout(() => {
          setIsPopping(false);
          setLoading(false);
          
          // Move to next round
          if (gameState.currentRound < 5) {
            setGameState({
              ...gameState,
              currentRound: gameState.currentRound + 1,
              pumpCount: 0,
              pendingPoints: 0,
              isActive: true,
            });
            setBalloonSize(100);
            setStatus(`Round ${gameState.currentRound + 1}/5 - New balloon!`);
          } else {
            setGameState({ ...gameState, isActive: false });
            setStatus(`🏁 Game Over! Final Score: ${gameState.totalScore}`);
          }
        }, 2000);
      } else {
        setStatus(`❌ Pump failed: ${errorMsg.slice(0, 100)}`);
        setLoading(false);
      }
      
      return; // Exit early to prevent finally block from running immediately
    } finally {
      // Only set loading false if we're not in popping animation
      if (!isPopping) {
        setLoading(false);
      }
    }
  }, [provider, subAccountAddress, gameState, initAudio, playPumpSound, playPopSound, isPopping]);

  // Collect points and advance to next round
  const collectPoints = useCallback(async () => {
    console.log("=== Collect Points Called ===");
    console.log("Provider:", !!provider);
    console.log("Sub Account:", subAccountAddress);
    console.log("Game State:", gameState);
    
    if (!provider || !subAccountAddress || !gameState?.isActive) {
      console.log("❌ Collect blocked - missing requirements");
      setStatus("No active game");
      return;
    }
    
    if (gameState.pumpCount === 0) {
      console.log("❌ Collect blocked - no pumps yet");
      setStatus("❌ Pump the balloon first!");
      return;
    }

    setLoading(true);
    setStatus("🏦 Banking your points...");

    try {
      const data = encodeFunctionData({
        abi: BALLOON_GAME_ABI,
        functionName: "collectPoints",
        args: [],
      });

      const callsId = (await provider.request({
        method: "wallet_sendCalls",
        params: [
          {
            version: "2.0",
            atomicRequired: true,
            chainId: `0x${baseSepolia.id.toString(16)}`,
            from: subAccountAddress,
            calls: [
              {
                to: BALLOON_GAME_ADDRESS,
                data: data,
                value: "0x0",
              },
            ],
          },
        ],
      })) as string;

      const newTotalScore = gameState.totalScore + gameState.pendingPoints;
      
      // Add to transaction history
      const txHashStr = typeof callsId === 'string' ? callsId : JSON.stringify(callsId);
      setTransactionHistory(prev => [{
        type: "Collect",
        hash: txHashStr,
        timestamp: new Date(),
        description: `Collected ${gameState.pendingPoints} points (Round ${gameState.currentRound}). Total: ${newTotalScore}`,
        isBundled: true
      }, ...prev]);
      
      setStatus(`✅ Points banked! Total: ${newTotalScore}`);

      // Check if game is complete
      if (gameState.currentRound >= 5) {
        setGameState({
          ...gameState,
          totalScore: newTotalScore,
          isActive: false,
        });
        if (newTotalScore > highScore) {
          setHighScore(newTotalScore);
          setStatus(`🏆 NEW HIGH SCORE: ${newTotalScore}!`);
        } else {
          setStatus(`🏁 Game Complete! Final Score: ${newTotalScore}`);
        }
        await fetchLeaderboard();
      } else {
        // Move to next round
        setGameState({
          ...gameState,
          currentRound: gameState.currentRound + 1,
          pumpCount: 0,
          pendingPoints: 0,
          totalScore: newTotalScore,
        });
        setBalloonSize(100);
        setStatus(`Round ${gameState.currentRound + 1}/5 - New balloon!`);
      }
    } catch (error) {
      console.error("Collect failed:", error);
      setStatus(`❌ Collection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [provider, subAccountAddress, gameState, highScore, fetchLeaderboard]);

  // Fund sub account from universal account
  const fundSubAccount = useCallback(async () => {
    if (!provider || !subAccountAddress || !universalAddress) {
      setStatus("Not connected");
      return;
    }

    setLoading(true);
    setStatus("💰 Sending ETH to Sub Account...");

    try {
      const fundAmount = parseEther("0.01"); // Send 0.01 ETH
      const fundAmountHex = `0x${fundAmount.toString(16)}`;

      // Send ETH from Universal Account to Sub Account
      const txHash = await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: universalAddress,
            to: subAccountAddress,
            value: fundAmountHex,
          },
        ],
      });

      const txHashStr = String(txHash);
      setStatus(`✅ Funded! Sent 0.01 ETH to Sub Account. TX: ${txHashStr.slice(0, 10)}...`);
      
      // Add to transaction history
      setTransactionHistory(prev => [{
        type: "Fund",
        hash: txHashStr,
        timestamp: new Date(),
        description: "Funded Sub Account with 0.01 ETH",
        isBundled: false // This is a direct eth_sendTransaction, has real tx hash
      }, ...prev]);
      
      // Refresh balances after a delay
      setTimeout(() => {
        fetchBalances();
        setStatus("✅ Sub Account funded! You can now play the game.");
      }, 3000);
    } catch (error) {
      console.error("Fund failed:", error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`❌ Failed to fund: ${errorMsg.slice(0, 100)}`);
    } finally {
      setLoading(false);
    }
  }, [provider, subAccountAddress, universalAddress, fetchBalances]);

  // Calculate time remaining in session
  const getTimeRemaining = () => {
    if (!sessionExpiry) return "";
    const now = new Date();
    const diff = sessionExpiry.getTime() - now.getTime();
    if (diff <= 0) return "Expired";
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="container">
      <h1 className="title">🎈 POPRISK</h1>
      <p className="subtitle">
        Push your luck. Don't pop.
      </p>

      {sessionExpiry && (
        <div className="session-timer">
          ⏰ Session: {getTimeRemaining()}
        </div>
      )}

      <div className="card">
        <div className="status-message">{status}</div>

        {!connected ? (
          <button
            onClick={connectWallet}
            disabled={loading || !provider}
            className="button"
          >
            {loading ? "Connecting..." : "🎮 Connect & Play"}
          </button>
        ) : (
          <>
            <div className="account-info">
              <div className="info-row-compact">
                <span className="info-label">Sub Account:</span>
                <span className="info-value-short" title={subAccountAddress}>{subAccountAddress.slice(0, 6)}...{subAccountAddress.slice(-4)}</span>
                <span className="balance-badge">{subBalance} ETH</span>
              </div>
              <div className="info-row-compact">
                <span className="info-label">Universal Account:</span>
                <span className="info-value-short" title={universalAddress}>{universalAddress.slice(0, 6)}...{universalAddress.slice(-4)}</span>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(universalAddress);
                    setStatus(`📋 Copied: ${universalAddress}`);
                  }}
                  className="copy-button"
                  title="Copy full address"
                >
                  📋
                </button>
                <span className="balance-badge balance-universal">{universalBalance} ETH</span>
              </div>
              <div className="info-row-compact">
                <span className="info-label">High Score:</span>
                <span className="info-value-short">{highScore}</span>
            </div>
            </div>

            {!gameState?.isActive ? (
              <div className="game-start">
                <h2 className="section-title">Ready to Play?</h2>
                <p style={{ opacity: 0.9, marginBottom: "16px" }}>
                  Entry fee: 0.001 ETH • 5 Rounds • Pump to win!
                </p>
                
                {parseFloat(subBalance) < 0.002 && (
                  <div style={{ marginBottom: "16px", padding: "12px", background: "rgba(255, 165, 0, 0.2)", borderRadius: "8px", border: "1px solid rgba(255, 165, 0, 0.5)" }}>
                    <p><strong>⚠️ Sub Account needs ETH!</strong></p>
                    <p style={{ fontSize: "0.85rem", marginTop: "8px" }}>
                      Your Sub Account has only {subBalance} ETH. Fund it to start playing!
                    </p>
                    <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                      <button
                        onClick={fundSubAccount}
                        disabled={loading || parseFloat(universalBalance) < 0.015}
                        className="button"
                        style={{ flex: 1, padding: "10px 16px", fontSize: "0.95rem", background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" }}
                      >
                        {loading ? "Sending..." : "💰 Fund Sub Account (0.01 ETH)"}
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(subAccountAddress);
                          setStatus(`📋 Copied: ${subAccountAddress}`);
                        }}
                        className="button"
                        style={{ padding: "10px 16px", fontSize: "0.9rem" }}
                        title="Copy Sub Account address to send ETH manually"
                      >
                        📋
                      </button>
                    </div>
                    {parseFloat(universalBalance) < 0.015 && (
                      <p style={{ fontSize: "0.8rem", marginTop: "8px", opacity: 0.9, color: "#ffcc00" }}>
                        ⚠️ Universal Account needs at least 0.015 ETH to fund Sub Account
                      </p>
                    )}
              </div>
                )}
                
                <button
                  onClick={startNewGame}
                  disabled={loading || parseFloat(subBalance) < 0.002}
                  className="button button-primary"
                >
                  {loading ? "Starting..." : "🎮 Start New Game (0.001 ETH)"}
                </button>
                <div style={{ marginTop: "16px", padding: "12px", background: parseFloat(universalBalance) < 0.005 ? "rgba(255, 68, 68, 0.2)" : "rgba(255, 255, 255, 0.1)", borderRadius: "8px", fontSize: "0.85rem", border: parseFloat(universalBalance) < 0.005 ? "1px solid rgba(255, 68, 68, 0.5)" : "none" }}>
                  {parseFloat(universalBalance) < 0.005 ? (
                    <>
                      <p><strong>⚠️ Low Balance Warning!</strong></p>
                      <p style={{ marginTop: "8px" }}>Your Universal Account has only <strong>{universalBalance} ETH</strong></p>
                      <p style={{ marginTop: "4px" }}>You need at least <strong>0.005 ETH</strong> (0.001 entry + ~0.004 gas)</p>
                    </>
                  ) : (
                    <p><strong>✅ Balance looks good!</strong></p>
                  )}
                  <p style={{ marginTop: "12px" }}><strong>Need more ETH?</strong></p>
                  <p style={{ marginTop: "4px" }}>Get Base Sepolia ETH from the <a href="https://www.coinbase.com/faucets/base-ethereum-goerli-faucet" target="_blank" rel="noopener noreferrer" style={{ color: "#4facfe", textDecoration: "underline" }}>Coinbase Faucet</a></p>
                </div>
              </div>
            ) : (
              <div className="game-active">
                <div className="game-header">
                  <div className="round-indicator">
                    Round {gameState.currentRound}/5
                  </div>
                  <div className="score-display">
                    <div className="score-item">
                      <span className="score-label">Pending</span>
                      <span className="score-value pending">{gameState.pendingPoints}</span>
                    </div>
                    <div className="score-item">
                      <span className="score-label">Banked</span>
                      <span className="score-value banked">{gameState.totalScore}</span>
                    </div>
                  </div>
                </div>

                <div className="balloon-container">
                  <div 
                    className={`balloon ${isPumping ? 'pumping' : ''} ${isPopping ? 'popping' : ''}`}
                    style={{ 
                      '--balloon-scale': balloonSize / 100,
                      opacity: isPopping ? 0 : 1,
                    } as React.CSSProperties & { '--balloon-scale': number }}
                  >
                    <div className="balloon-shine"></div>
                  </div>
                  <div className="pump-counter">
                    PUMPS: {gameState.pumpCount}
                    {gameState.pumpCount >= 3 && (
                      <span className="danger-warning"> ⚠️ DANGER!</span>
                    )}
                  </div>
                </div>

                <div className="game-controls">
                  <button
                    onClick={pumpBalloon}
                    disabled={loading}
                    className="button button-pump"
                  >
                    {loading ? "Pumping..." : "💨 PUMP (+10, 20, 40, 80...)"}
                  </button>

              <button
                    onClick={collectPoints}
                    disabled={loading || gameState.pumpCount === 0}
                    className="button button-collect"
                  >
                    {loading ? "Banking..." : "🏦 Bank Points & Next Round"}
              </button>
                </div>

                <div className="game-info">
                  <p><strong>How to Play:</strong></p>
                  <ul>
                    <li>Pump to earn exponentially more points (10, 20, 40, 80...)</li>
                    <li>After 3 pumps, balloon may POP and lose pending points!</li>
                    <li>Bank points safely to move to next round</li>
                    <li>Complete 5 rounds to finish the game</li>
                  </ul>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {connected && leaderboard.length > 0 && (
        <div className="card leaderboard-card">
          <div className="section-title">🏆 Leaderboard</div>
          <div className="leaderboard">
            {leaderboard.map((entry, index) => (
              <div key={index} className="leaderboard-entry">
                <span className="rank">#{index + 1}</span>
                <span className="address">{entry.address.slice(0, 6)}...{entry.address.slice(-4)}</span>
                <span className="score">{entry.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {connected && transactionHistory.length > 0 && (
      <div className="card">
          <div className="section-title">📜 Transaction History</div>
          <div className="transaction-list">
            {transactionHistory.map((tx, index) => (
              <div key={index} className="transaction-item">
                <div className="transaction-header">
                  <span className={`transaction-type transaction-type-${tx.type.toLowerCase().replace(' ', '-')}`}>
                    {tx.type}
                  </span>
                  <span className="transaction-time">
                    {tx.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <div className="transaction-description">{tx.description}</div>
                <div className="transaction-hash">
                  {tx.isBundled ? (
                    <>
                      <span style={{ opacity: 0.7, fontSize: "0.75rem" }}>Call ID:</span>{" "}
                      <span style={{ 
                        fontFamily: "monospace", 
                        fontSize: "0.75rem",
                        opacity: 0.8,
                        wordBreak: "break-all"
                      }}>
                        {tx.hash.slice(0, 20)}...{tx.hash.slice(-10)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span style={{ opacity: 0.7, fontSize: "0.75rem" }}>TX:</span>{" "}
                      <a 
                        href={`https://sepolia.basescan.org/tx/${tx.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transaction-link"
                      >
                        {tx.hash.slice(0, 10)}...{tx.hash.slice(-8)}
                      </a>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(tx.hash);
                          setStatus(`📋 Copied TX hash: ${tx.hash}`);
                        }}
                        className="copy-tx-button"
                        title="Copy transaction hash"
                      >
                        📋
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          {transactionHistory.length > 5 && (
            <div style={{ marginTop: "12px", textAlign: "center", fontSize: "0.85rem", opacity: 0.8 }}>
              Showing {transactionHistory.length} transaction{transactionHistory.length > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      <div className="card info-card">
        <div className="section-title">About This Game</div>
        <p style={{ lineHeight: "1.6", opacity: 0.9 }}>
          This game uses <strong>Base Sub Accounts</strong> for a seamless gaming experience:
        </p>
        <ul style={{ marginTop: "12px", marginLeft: "20px", lineHeight: "1.8", opacity: 0.9 }}>
          <li><strong>No repeated popups</strong> - Pump balloons without approval spam</li>
          <li><strong>Auto-created sub account</strong> - Created automatically on connect</li>
          <li><strong>2-hour sessions</strong> - Play freely for 2 hours per connection</li>
          <li><strong>Fair randomness</strong> - Smart contract uses block hash for pop probability</li>
          <li><strong>On-chain leaderboard</strong> - All high scores stored permanently</li>
        </ul>
        <div style={{ marginTop: "16px", padding: "12px", background: "rgba(0,0,0,0.2)", borderRadius: "8px" }}>
          <strong>Contract:</strong> <code style={{ fontSize: "0.85rem" }}>{BALLOON_GAME_ADDRESS}</code>
        </div>
      </div>
    </div>
  );
}

