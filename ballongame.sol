// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BalloonGame
 * @dev A balloon pumping game where players pay 0.001 ETH to play 5 rounds
 * Players pump balloons to earn points, with increasing risk of popping
 * Compatible with Base sub accounts for gasless, popup-free gaming
 * NOW USES NATIVE ETH - No ERC20 approval needed!
 */
contract BalloonGame is ReentrancyGuard {
    // Constants
    uint256 public constant ENTRY_FEE = 0.001 ether; // 0.001 ETH entry fee
    uint256 public constant MAX_ROUNDS = 5;
    uint256 public constant MIN_PUMPS_BEFORE_POP = 3;
    
    // Game state structure
    struct GameState {
        uint256 currentRound;    // Current round (1-5)
        uint256 pumpCount;       // Number of pumps in current round
        uint256 pendingPoints;   // Points not yet banked
        uint256 totalScore;      // Total banked points
        bool isActive;           // Is game currently active
    }
    
    // Storage
    mapping(address => GameState) public games;
    mapping(address => uint256) public highScores;
    address[] private players; // Track all players for leaderboard
    
    // Events
    event GameStarted(address indexed player, uint256 timestamp);
    event BalloonPumped(
        address indexed player,
        uint256 round,
        uint256 pumpCount,
        uint256 points
    );
    event PointsCollected(
        address indexed player,
        uint256 round,
        uint256 totalScore
    );
    event BalloonPopped(
        address indexed player,
        uint256 round,
        uint256 lostPoints
    );
    event GameCompleted(address indexed player, uint256 finalScore);
    
    /**
     * @dev Constructor - no parameters needed for ETH-based game
     */
    constructor() {
        // No initialization needed - using native ETH
    }
    
    /**
     * @dev Start a new game by paying entry fee in ETH
     * No approval needed - just send ETH with transaction!
     */
    function startGame() external payable nonReentrant {
        require(!games[msg.sender].isActive, "Game already active");
        require(msg.value == ENTRY_FEE, "Incorrect entry fee");
        
        // Track player if first time
        if (games[msg.sender].currentRound == 0) {
            players.push(msg.sender);
        }
        
        // Initialize game state
        games[msg.sender] = GameState({
            currentRound: 1,
            pumpCount: 0,
            pendingPoints: 0,
            totalScore: 0,
            isActive: true
        });
        
        emit GameStarted(msg.sender, block.timestamp);
    }
    
    /**
     * @dev Pump the balloon to earn points
     * Maximum 2 pumps per round - 3rd pump is blocked!
     */
    function pumpBalloon() external {
        GameState storage game = games[msg.sender];
        require(game.isActive, "No active game");
        require(game.currentRound <= MAX_ROUNDS, "Game completed");
        require(game.pumpCount < 2, "Max 2 pumps per round! Collect points to continue.");
        
        // Increment pump count
        game.pumpCount++;
        
        // Calculate points for this pump
        // Formula: 10 * (2^(pumpCount-1))
        // pump 1=10, pump 2=20
        uint256 earnedPoints = 10 * (2 ** (game.pumpCount - 1));
        game.pendingPoints += earnedPoints;
        
        emit BalloonPumped(
            msg.sender,
            game.currentRound,
            game.pumpCount,
            earnedPoints
        );
        
        // No pop check needed - we prevent 3rd pump entirely!
    }
    
    /**
     * @dev Collect pending points and advance to next round
     * Banks points safely before advancing
     */
    function collectPoints() external {
        GameState storage game = games[msg.sender];
        require(game.isActive, "No active game");
        require(game.pumpCount > 0, "Must pump at least once");
        
        // Bank the pending points
        game.totalScore += game.pendingPoints;
        
        emit PointsCollected(
            msg.sender,
            game.currentRound,
            game.totalScore
        );
        
        // Advance to next round or end game
        if (game.currentRound < MAX_ROUNDS) {
            game.currentRound++;
            game.pumpCount = 0;
            game.pendingPoints = 0;
        } else {
            // Game completed successfully
            _endGame(msg.sender);
        }
    }
    
    /**
     * @dev Internal function to check if balloon pops
     * Uses block hash for randomness
     * Balloon ALWAYS pops at 3rd pump (max threshold = 3)
     * @param pumpCount Current number of pumps
     */
    function _checkBalloonPop(uint256 pumpCount) private pure returns (bool) {
        // Always pop at 3 or more pumps
        if (pumpCount >= 3) {
            return true; // 100% pop at 3+ pumps
        }
        
        // Pumps 1-2 are safe
        return false;
    }
    
    /**
     * @dev Internal function to end the game
     * @param player Address of the player
     */
    function _endGame(address player) private {
        GameState storage game = games[player];
        
        // Update high score if new record
        if (game.totalScore > highScores[player]) {
            highScores[player] = game.totalScore;
        }
        
        emit GameCompleted(player, game.totalScore);
        
        // Mark game as inactive
        game.isActive = false;
    }
    
    /**
     * @dev Get game state for a player
     * @param player Address of the player
     */
    function getGameState(address player)
        external
        view
        returns (
            uint256 currentRound,
            uint256 pumpCount,
            uint256 pendingPoints,
            uint256 totalScore,
            bool isActive
        )
    {
        GameState memory game = games[player];
        return (
            game.currentRound,
            game.pumpCount,
            game.pendingPoints,
            game.totalScore,
            game.isActive
        );
    }
    
    /**
     * @dev Get high score for a player
     * @param player Address of the player
     */
    function getHighScore(address player) external view returns (uint256) {
        return highScores[player];
    }
    
    /**
     * @dev Get leaderboard of top 10 players
     * Returns arrays of addresses and scores
     */
    function getLeaderboard()
        external
        view
        returns (address[] memory topPlayers, uint256[] memory topScores)
    {
        uint256 playerCount = players.length;
        uint256 leaderboardSize = playerCount < 10 ? playerCount : 10;
        
        // Create temporary arrays for sorting
        address[] memory tempPlayers = new address[](playerCount);
        uint256[] memory tempScores = new uint256[](playerCount);
        
        // Copy all players and their high scores
        for (uint256 i = 0; i < playerCount; i++) {
            tempPlayers[i] = players[i];
            tempScores[i] = highScores[players[i]];
        }
        
        // Simple bubble sort to get top 10
        for (uint256 i = 0; i < playerCount; i++) {
            for (uint256 j = i + 1; j < playerCount; j++) {
                if (tempScores[j] > tempScores[i]) {
                    // Swap scores
                    uint256 tempScore = tempScores[i];
                    tempScores[i] = tempScores[j];
                    tempScores[j] = tempScore;
                    
                    // Swap addresses
                    address tempPlayer = tempPlayers[i];
                    tempPlayers[i] = tempPlayers[j];
                    tempPlayers[j] = tempPlayer;
                }
            }
        }
        
        // Return top 10
        topPlayers = new address[](leaderboardSize);
        topScores = new uint256[](leaderboardSize);
        
        for (uint256 i = 0; i < leaderboardSize; i++) {
            topPlayers[i] = tempPlayers[i];
            topScores[i] = tempScores[i];
        }
        
        return (topPlayers, topScores);
    }
    
    /**
     * @dev Get contract ETH balance
     * For administrative purposes
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @dev Withdraw ETH from contract (only owner or for specific use)
     * NOTE: Add access control if needed in production
     */
    function withdraw() external {
        payable(msg.sender).transfer(address(this).balance);
    }
}

