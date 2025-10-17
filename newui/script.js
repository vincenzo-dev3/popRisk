// Game state
let currentRound = 1;
let totalRounds = 5;
let pumpCount = 0;
let roundScore = 0;
let totalScore = 0;
let balloonSize = 1.0;
let popThreshold = 0;
let isPopped = false;

// DOM elements (will be initialized after DOM loads)
let balloon;
let pumpBtn;
let collectBtn;
let pumpCountDisplay;
let roundCountDisplay;
let totalScoreDisplay;
let statusMessage;
let particlesContainer;
let container;

// Audio elements
let audioInitialized = false;

// Initialize audio
function initAudio() {
    if (audioInitialized) return;
    
    try {
        // Create pump sound using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
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
        
        // Store buffers
        window.pumpBuffer = pumpBuffer;
        window.popBuffer = popBuffer;
        window.audioContext = audioContext;
        
        audioInitialized = true;
        console.log('Audio initialized successfully');
    } catch (e) {
        console.log('Audio initialization error:', e);
    }
}

// Play pump sound
function playPumpSound() {
    try {
        if (!audioInitialized) return;
        const source = window.audioContext.createBufferSource();
        source.buffer = window.pumpBuffer;
        
        const gainNode = window.audioContext.createGain();
        gainNode.gain.value = 0.3;
        
        source.connect(gainNode);
        gainNode.connect(window.audioContext.destination);
        source.start(0);
        console.log('Pump sound played');
    } catch (e) {
        console.log('Sound play error:', e);
    }
}

// Play pop sound
function playPopSound() {
    try {
        if (!audioInitialized) return;
        const source = window.audioContext.createBufferSource();
        source.buffer = window.popBuffer;
        
        const gainNode = window.audioContext.createGain();
        gainNode.gain.value = 0.5;
        
        source.connect(gainNode);
        gainNode.connect(window.audioContext.destination);
        source.start(0);
        console.log('Pop sound played');
    } catch (e) {
        console.log('Sound play error:', e);
    }
}

// Set a random pop threshold
function setRandomThreshold() {
    // Random threshold between 8 and 25 pumps
    popThreshold = Math.floor(Math.random() * 18) + 8;
    console.log('Pop threshold set to:', popThreshold);
}

// Show status message
function showMessage(message) {
    statusMessage.textContent = message;
    statusMessage.classList.add('show');
    setTimeout(() => {
        statusMessage.classList.remove('show');
    }, 2000);
}

// Create explosion particles
function createExplosion() {
    const rect = balloon.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Create multiple particles
    const particleCount = 30;
    const colors = ['#0052FF', '#0A84FF', '#5B8DEE', '#FFFFFF'];
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        // Random angle and distance
        const angle = (Math.PI * 2 * i) / particleCount;
        const distance = 100 + Math.random() * 200;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        
        particle.style.left = centerX + 'px';
        particle.style.top = centerY + 'px';
        particle.style.background = colors[Math.floor(Math.random() * colors.length)];
        particle.style.setProperty('--tx', tx + 'px');
        particle.style.setProperty('--ty', ty + 'px');
        
        particlesContainer.appendChild(particle);
        
        // Remove particle after animation
        setTimeout(() => {
            particle.remove();
        }, 1000);
    }
}

// Pump the balloon
function pumpBalloon() {
    console.log('=== PUMP CLICKED ===');
    console.log('Current state - isPopped:', isPopped, 'pumpCount:', pumpCount, 'balloonSize:', balloonSize);
    
    if (isPopped) {
        console.log('BLOCKED: Balloon is already popped');
        return;
    }
    
    // Increment counter and calculate score
    pumpCount++;
    roundScore = pumpCount * 10; // 10 points per pump
    pumpCountDisplay.textContent = pumpCount;
    console.log('Pump count updated to:', pumpCount, 'Round score:', roundScore);
    
    // Play pump sound
    playPumpSound();
    
    // Increase balloon size
    balloonSize += 0.2;
    console.log('Balloon size increased to:', balloonSize);
    
    // Apply the transform
    balloon.style.transform = `scale(${balloonSize})`;
    console.log('Transform applied:', balloon.style.transform);
    
    // Add pumping animation class
    balloon.classList.add('pumping');
    setTimeout(() => {
        balloon.classList.remove('pumping');
    }, 300);
    
    // Warning messages as balloon gets bigger
    if (pumpCount > popThreshold - 5 && pumpCount < popThreshold) {
        showMessage('DANGER! 💀');
        container.classList.add('shake');
        setTimeout(() => container.classList.remove('shake'), 300);
    } else if (pumpCount > popThreshold - 10 && pumpCount < popThreshold) {
        showMessage('GETTING BIG! ⚠️');
    }
    
    // Check if balloon should pop
    if (pumpCount >= popThreshold) {
        console.log('THRESHOLD REACHED! Popping balloon...');
        setTimeout(() => {
            popBalloon();
        }, 300);
    }
    
    console.log('=== PUMP COMPLETE ===');
}

// Collect points
function collectPoints() {
    console.log('=== COLLECT CLICKED ===');
    
    if (isPopped || pumpCount === 0) {
        console.log('BLOCKED: Nothing to collect');
        return;
    }
    
    // Add round score to total
    totalScore += roundScore;
    totalScoreDisplay.textContent = totalScore;
    
    showMessage(`✅ COLLECTED ${roundScore} POINTS!`);
    console.log('Collected:', roundScore, 'Total:', totalScore);
    
    // Move to next round
    setTimeout(() => {
        nextRound();
    }, 1500);
}

// Pop the balloon
function popBalloon() {
    if (isPopped) {
        console.log('Already popped, ignoring');
        return;
    }
    
    console.log('=== POPPING BALLOON ===');
    isPopped = true;
    
    // Play pop sound
    playPopSound();
    
    // Add popping animation
    balloon.classList.add('popping');
    
    // Create explosion effect
    createExplosion();
    
    // Shake the screen
    container.classList.add('shake');
    
    // Show message - lost all points from this round
    showMessage(`💥 POPPED! LOST ${roundScore} POINTS!`);
    
    // Disable buttons temporarily
    pumpBtn.disabled = true;
    collectBtn.disabled = true;
    
    // Move to next round after animation
    setTimeout(() => {
        nextRound();
    }, 2000);
}

// Move to next round
function nextRound() {
    console.log('=== NEXT ROUND ===');
    
    // Check if game is over
    if (currentRound >= totalRounds) {
        endGame();
        return;
    }
    
    // Increment round
    currentRound++;
    roundCountDisplay.textContent = `${currentRound}/${totalRounds}`;
    
    // Reset round state
    isPopped = false;
    pumpCount = 0;
    roundScore = 0;
    balloonSize = 1.0;
    
    pumpCountDisplay.textContent = pumpCount;
    balloon.style.transform = 'scale(1)';
    balloon.style.opacity = '1';
    balloon.classList.remove('popping');
    container.classList.remove('shake');
    
    pumpBtn.disabled = false;
    collectBtn.disabled = false;
    
    // Set new random threshold
    setRandomThreshold();
    
    showMessage(`🎈 ROUND ${currentRound}!`);
    console.log('Round reset complete!');
}

// End game
function endGame() {
    console.log('=== GAME OVER ===');
    showMessage(`🎉 FINAL SCORE: ${totalScore} POINTS!`);
    
    // Disable buttons
    pumpBtn.disabled = true;
    collectBtn.disabled = true;
    
    // Reset game after showing final score
    setTimeout(() => {
        resetGame();
    }, 4000);
}

// Reset the entire game
function resetGame() {
    console.log('=== RESETTING GAME ===');
    currentRound = 1;
    totalScore = 0;
    isPopped = false;
    pumpCount = 0;
    roundScore = 0;
    balloonSize = 1.0;
    
    roundCountDisplay.textContent = `${currentRound}/${totalRounds}`;
    pumpCountDisplay.textContent = pumpCount;
    totalScoreDisplay.textContent = totalScore;
    balloon.style.transform = 'scale(1)';
    balloon.style.opacity = '1';
    balloon.classList.remove('popping');
    container.classList.remove('shake');
    
    pumpBtn.disabled = false;
    collectBtn.disabled = false;
    
    // Set new random threshold
    setRandomThreshold();
    
    showMessage('NEW GAME! 🎈');
    console.log('Full game reset complete!');
}

// Initialize everything when DOM is ready
function initGame() {
    console.log('=== INITIALIZING GAME ===');
    
    // Get DOM elements
    balloon = document.getElementById('balloon');
    pumpBtn = document.getElementById('pumpBtn');
    collectBtn = document.getElementById('collectBtn');
    pumpCountDisplay = document.getElementById('pumpCount');
    roundCountDisplay = document.getElementById('roundCount');
    totalScoreDisplay = document.getElementById('totalScore');
    statusMessage = document.getElementById('statusMessage');
    particlesContainer = document.getElementById('particles');
    container = document.querySelector('.container');
    
    console.log('DOM Elements loaded:', {
        balloon: !!balloon,
        pumpBtn: !!pumpBtn,
        collectBtn: !!collectBtn,
        pumpCountDisplay: !!pumpCountDisplay,
        roundCountDisplay: !!roundCountDisplay,
        totalScoreDisplay: !!totalScoreDisplay
    });
    
    if (!balloon || !pumpBtn || !collectBtn) {
        console.error('ERROR: Could not find required DOM elements!');
        return;
    }
    
    // Event listeners
    pumpBtn.addEventListener('click', function() {
        console.log('>>> Pump button clicked!');
        initAudio();
        pumpBalloon();
    });
    
    collectBtn.addEventListener('click', function() {
        console.log('>>> Collect button clicked!');
        initAudio();
        collectPoints();
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !isPopped) {
            e.preventDefault();
            console.log('>>> Space key pressed!');
            initAudio();
            pumpBalloon();
        } else if (e.code === 'Enter' && !isPopped) {
            e.preventDefault();
            console.log('>>> Enter key pressed!');
            initAudio();
            collectPoints();
        }
    });
    
    // Initialize game
    setRandomThreshold();
    showMessage('🎈 ROUND 1 - START!');
    console.log('🎈 PopRisk loaded! Click PUMP to start playing.');
    console.log('=== INITIALIZATION COMPLETE ===');
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}
