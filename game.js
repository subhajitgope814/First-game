const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const jumpBtn = document.getElementById('jumpBtn');
const gameOverScreen = document.getElementById('gameOverScreen');
const scoreDisplay = document.getElementById('score');
const highScoreDisplay = document.getElementById('highScore');
const finalScoreDisplay = document.getElementById('finalScore');
const finalHighScoreDisplay = document.getElementById('finalHighScore');
const pauseBtn = document.getElementById('pauseBtn');

let gamePaused = false;

const spritePaths = {
    background: 'assets/background.svg',
    character: 'assets/character.png',
    bubble: 'assets/bubble.svg'
};

const groundLevel = canvas.height - 70;

// Game variables
let gameRunning = false;
let score = 0;
let highScore = Number(localStorage.getItem('highScore') || 0);
highScoreDisplay.textContent = highScore;

// Player object
const player = {
    x: 100,
    y: groundLevel - 64,
    width: 64,
    height: 64,
    velocityY: 0,
    isJumping: false,
    speed: 5,
    jumpPower: 15,
    gravity: 0.6,
    faceRight: true
};

// Background image
const backgroundImage = new Image();
let backgroundImageLoaded = false;
let backgroundScrollX = 0;
const backgroundScrollSpeed = 1.2;
backgroundImage.onload = () => {
    backgroundImageLoaded = true;
};
backgroundImage.onerror = () => {
    console.warn(`Could not load ${spritePaths.background}. Using fallback background drawing.`);
};
backgroundImage.src = spritePaths.background;

// Character image
const playerImage = new Image();
let playerImageLoaded = false;
playerImage.onload = () => {
    playerImageLoaded = true;
};
playerImage.onerror = () => {
    console.warn(`Could not load ${spritePaths.character}. Using fallback player drawing.`);
};
playerImage.src = spritePaths.character;

// Bubble image
const bubbleImage = new Image();
let bubbleImageLoaded = false;
bubbleImage.onload = () => {
    bubbleImageLoaded = true;
};
bubbleImage.onerror = () => {
    console.warn(`Could not load ${spritePaths.bubble}. Using fallback bubble drawing.`);
};
bubbleImage.src = spritePaths.bubble;

// Game arrays
let obstacles = [];
let bubbles = [];
let popTexts = [];

// Game constants
const obstacleWidth = 50;
const obstacleHeight = 60;
const baseObstacleSpeed = 7;
let obstacleSpeed = baseObstacleSpeed;
const obstacleSpawnRate = 100; // frames between obstacles
const bubbleWidth = 42;
const bubbleHeight = 42;
const bubbleSpawnRate = 85; // frames between bubbles
const bubbleScoreValue = 20;

function getObstacleSpawnRate() {
    return obstacleSpawnRate;
}

function getBubbleSpawnRate() {
    return bubbleSpawnRate;
}

function updateHud() {
    scoreDisplay.textContent = score;
}

function addScore(points) {
    score += points;
    updateHud();
}

// MP3 sound effect for eating a bubble
const bubbleEatSound = new Audio('assets/game-sound.mp3');
bubbleEatSound.preload = 'auto';
bubbleEatSound.volume = 0.8;

function playBubbleEatSound() {
    const sound = bubbleEatSound.cloneNode();
    sound.volume = bubbleEatSound.volume;
    sound.play().catch(() => {
        // Ignore autoplay or decode errors; the game still works without audio.
    });
}

// MP3 sound effect for game over
const gameOverSound = new Audio('assets/game-over.mp3');
gameOverSound.preload = 'auto';
gameOverSound.volume = 0.9;

function playGameOverSound() {
    const sound = gameOverSound.cloneNode();
    sound.volume = gameOverSound.volume;
    sound.play().catch(() => {
        // Ignore autoplay or decode errors; the game still works without audio.
    });
}

function announceGameOverScore(isNewHighScore) {
    if (!('speechSynthesis' in window)) {
        return;
    }

    window.speechSynthesis.cancel();
    const message = isNewHighScore
        ? `Game over. Your score is ${score}. New high score. Your high score is ${highScore}.`
        : `Game over. Your score is ${score}. Your high score is ${highScore}.`;

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 0.95;
    utterance.pitch = 0.9;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
}

// Background music MP3
const backgroundMusic = new Audio('assets/background-music.mp3');
backgroundMusic.loop = true;
backgroundMusic.preload = 'auto';
backgroundMusic.volume = 0.35;

function startMusic() {
    backgroundMusic.currentTime = 0;
    backgroundMusic.play().catch(() => {
        // Ignore autoplay restrictions if the browser blocks playback.
    });
}

function stopMusic() {
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0;
}

function resumeMusic() {
    backgroundMusic.play().catch(() => {
        // Ignore autoplay restrictions if the browser blocks playback.
    });
}

// Keyboard input
const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (e.key === ' ') {
        e.preventDefault();
        jumpPlayer();
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

function jumpPlayer() {
    if (!player.isJumping && gameRunning) {
        player.velocityY = -player.jumpPower;
        player.isJumping = true;
    }
}

function updatePlayer() {
    // Horizontal movement
    if ((keys['ArrowLeft'] || keys['a'] || keys['A']) && player.x > 0) {
        player.x -= player.speed;
        player.faceRight = false;
    }
    if ((keys['ArrowRight'] || keys['d'] || keys['D']) && player.x < canvas.width - player.width) {
        player.x += player.speed;
        player.faceRight = true;
    }

    // Gravity and jumping
    player.velocityY += player.gravity;
    player.y += player.velocityY;

    // Ground collision
    if (player.y + player.height >= groundLevel) {
        player.y = groundLevel - player.height;
        player.isJumping = false;
        player.velocityY = 0;
    }
}

function spawnObstacle() {
    obstacles.push({
        x: canvas.width,
        y: groundLevel - obstacleHeight,
        width: obstacleWidth,
        height: obstacleHeight
    });
}

function spawnBubble() {
    const floatHeight = 140 + Math.random() * 100;
    bubbles.push({
        x: canvas.width + 20,
        y: Math.max(30, groundLevel - floatHeight),
        width: bubbleWidth,
        height: bubbleHeight,
        bobPhase: Math.random() * Math.PI * 2,
        bobSpeed: 0.04 + Math.random() * 0.03,
        bobAmount: 4 + Math.random() * 4
    });
}

function updateObstacles() {
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].x -= obstacleSpeed;

        // Remove obstacles that are off screen
        if (obstacles[i].x + obstacles[i].width < 0) {
            obstacles.splice(i, 1);
            addScore(10);
        }
    }
}

function updateBubbles() {
    for (let i = bubbles.length - 1; i >= 0; i--) {
        bubbles[i].x -= obstacleSpeed * 0.92;
        bubbles[i].bobPhase += bubbles[i].bobSpeed;

        // Remove bubbles that are off screen
        if (bubbles[i].x + bubbles[i].width < 0) {
            bubbles.splice(i, 1);
        }
    }
}

function checkCollision() {
    for (let obstacle of obstacles) {
        if (
            player.x < obstacle.x + obstacle.width &&
            player.x + player.width > obstacle.x &&
            player.y < obstacle.y + obstacle.height &&
            player.y + player.height > obstacle.y
        ) {
            endGame();
        }
    }
}

function checkBubbleCollection() {
    for (let i = bubbles.length - 1; i >= 0; i--) {
        const bubble = bubbles[i];
        const bubbleY = bubble.y + Math.sin(bubble.bobPhase || 0) * (bubble.bobAmount || 0);
        if (
            player.x < bubble.x + bubble.width &&
            player.x + player.width > bubble.x &&
            player.y < bubbleY + bubble.height &&
            player.y + player.height > bubbleY
        ) {
            bubbles.splice(i, 1);
            addScore(bubbleScoreValue);
            playBubbleEatSound();
            popTexts.push({
                x: bubble.x + bubble.width / 2,
                y: bubbleY,
                text: '+' + bubbleScoreValue,
                life: 45
            });
        }
    }
}

function drawPlayer() {
    if (playerImageLoaded) {
        ctx.save();
        ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
        ctx.scale(player.faceRight ? -1 : 1, 1);
        ctx.drawImage(playerImage, -player.width / 2, -player.height / 2, player.width, player.height);
        ctx.restore();
        return;
    }

    // Draw the character directly on the canvas so the game does not depend on image files.
    ctx.fillStyle = '#8b5e3c';
    ctx.fillRect(player.x, player.y, player.width, player.height);

    ctx.fillStyle = '#f7d7a3';
    ctx.fillRect(player.x + 10, player.y + 16, 10, 14);
    ctx.fillRect(player.x + 34, player.y + 16, 10, 14);

    ctx.fillStyle = '#1b1010';
    ctx.fillRect(player.x + 17, player.y + 24, 7, 7);
    ctx.fillRect(player.x + 40, player.y + 24, 7, 7);

    ctx.fillStyle = '#241312';
    ctx.fillRect(player.x + 14, player.y + 38, 34, 16);
    ctx.fillStyle = '#f4efe7';
    ctx.fillRect(player.x + 18, player.y + 38, 5, 10);
    ctx.fillRect(player.x + 26, player.y + 38, 5, 10);
    ctx.fillRect(player.x + 34, player.y + 38, 5, 10);
    ctx.fillRect(player.x + 42, player.y + 38, 5, 10);
}

function drawBubble(bubble) {
    const bobY = bubble.y + Math.sin(bubble.bobPhase || 0) * (bubble.bobAmount || 0);

    if (bubbleImageLoaded) {
        ctx.drawImage(bubbleImage, bubble.x, bobY, bubble.width, bubble.height);
        return;
    }

    const radius = bubble.width / 2;
    const centerX = bubble.x + radius;
    const centerY = bobY + radius;

    const bubbleGradient = ctx.createRadialGradient(
        centerX - radius * 0.35,
        centerY - radius * 0.35,
        radius * 0.1,
        centerX,
        centerY,
        radius
    );
    bubbleGradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    bubbleGradient.addColorStop(0.45, 'rgba(180, 245, 255, 0.9)');
    bubbleGradient.addColorStop(1, 'rgba(58, 177, 255, 0.35)');

    ctx.fillStyle = bubbleGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.beginPath();
    ctx.arc(centerX - radius * 0.28, centerY - radius * 0.28, radius * 0.22, 0, Math.PI * 2);
    ctx.fill();
}

function drawBubbles() {
    for (let bubble of bubbles) {
        drawBubble(bubble);
    }
}

function updatePopTexts() {
    for (let i = popTexts.length - 1; i >= 0; i--) {
        popTexts[i].y -= 0.6;
        popTexts[i].life -= 1;
        if (popTexts[i].life <= 0) {
            popTexts.splice(i, 1);
        }
    }
}

function drawPopTexts() {
    ctx.textAlign = 'center';
    for (let pop of popTexts) {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(pop.life / 45, 0)})`;
        ctx.font = 'bold 18px Arial';
        ctx.fillText(pop.text, pop.x, pop.y);
    }
    ctx.textAlign = 'left';
}

function drawObstacles() {
    for (let obstacle of obstacles) {
        // Obstacle body
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

        // Obstacle details
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(obstacle.x + 5, obstacle.y + 5, obstacle.width - 10, obstacle.height - 10);

        // Obstacle eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(obstacle.x + 8, obstacle.y + 15, 8, 8);
        ctx.fillRect(obstacle.x + 34, obstacle.y + 15, 8, 8);
    }
}

function drawGround() {
    if (backgroundImageLoaded) {
        const offset = backgroundScrollX % canvas.width;
        ctx.drawImage(backgroundImage, -offset, 0, canvas.width, canvas.height);
        ctx.drawImage(backgroundImage, canvas.width - offset, 0, canvas.width, canvas.height);
        return;
    }

    const waterGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    waterGradient.addColorStop(0, '#c8f4ff');
    waterGradient.addColorStop(0.32, '#63cff6');
    waterGradient.addColorStop(0.78, '#16a9ea');
    waterGradient.addColorStop(1, '#098bd8');
    ctx.fillStyle = waterGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(0, 0, canvas.width, 120);

    const sandGradient = ctx.createLinearGradient(0, groundLevel, 0, canvas.height);
    sandGradient.addColorStop(0, '#f5e7bf');
    sandGradient.addColorStop(1, '#d8be87');
    ctx.fillStyle = sandGradient;
    ctx.fillRect(0, groundLevel, canvas.width, canvas.height - groundLevel);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(0, groundLevel - 4);
    ctx.bezierCurveTo(140, groundLevel - 22, 250, groundLevel + 10, 400, groundLevel - 5);
    ctx.bezierCurveTo(560, groundLevel - 24, 670, groundLevel + 8, 800, groundLevel - 2);
    ctx.lineTo(800, groundLevel + 8);
    ctx.lineTo(0, groundLevel + 8);
    ctx.closePath();
    ctx.fill();
}

function drawScore() {
    ctx.fillStyle = '#00d4ff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 20, 30);
    ctx.textAlign = 'left';
}

function drawIdleMessage() {
    drawBubble({
        x: canvas.width - 78,
        y: 22,
        width: bubbleWidth,
        height: bubbleHeight
    });

    ctx.fillStyle = 'rgba(10, 20, 40, 0.55)';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Press START to play | Collect bubbles for points', canvas.width / 2, 72);
    ctx.textAlign = 'left';
}

function drawPausedMessage() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, canvas.height / 2 - 60, canvas.width, 120);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2 + 12);
    ctx.font = '16px Arial';
    ctx.fillText('Click RESUME to continue playing', canvas.width / 2, canvas.height / 2 + 44);
    ctx.textAlign = 'left';
}

let spawnCounter = 0;
let bubbleSpawnCounter = 0;

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gameRunning && !gamePaused) {
        backgroundScrollX = (backgroundScrollX + backgroundScrollSpeed) % canvas.width;
        updatePlayer();
        updateObstacles();
        updateBubbles();
        updatePopTexts();
        checkCollision();
        checkBubbleCollection();

        spawnCounter++;
        bubbleSpawnCounter++;

        // Spawn new hazards and collectibles
        if (spawnCounter > getObstacleSpawnRate()) {
            spawnObstacle();
            spawnCounter = 0;
        }

        if (bubbleSpawnCounter > getBubbleSpawnRate()) {
            spawnBubble();
            bubbleSpawnCounter = 0;
        }
    }

    drawGround();
    drawBubbles();
    drawObstacles();
    drawPlayer();
    drawPopTexts();
    drawScore();

    if (gamePaused) {
        drawPausedMessage();
    } else if (!gameRunning) {
        drawIdleMessage();
    }

    requestAnimationFrame(gameLoop);
}

function togglePause() {
    if (!gameRunning) {
        return;
    }

    gamePaused = !gamePaused;
    pauseBtn.textContent = gamePaused ? 'RESUME' : 'PAUSE';

    if (gamePaused) {
        backgroundMusic.pause();
    } else {
        resumeMusic();
    }
}

function startGame() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }

    gameRunning = true;
    gamePaused = false;
    score = 0;
    updateHud();
    obstacles = [];
    bubbles = [];
    popTexts = [];
    spawnCounter = 0;
    bubbleSpawnCounter = 0;
    obstacleSpeed = baseObstacleSpeed;
    backgroundScrollX = 0;
    player.x = 100;
    player.y = groundLevel - player.height;
    player.velocityY = 0;
    player.isJumping = false;
    player.faceRight = true;
    gameOverScreen.classList.remove('show');
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-block';
    pauseBtn.textContent = 'PAUSE';
    startMusic();
}

function endGame() {
    gameRunning = false;
    gamePaused = false;
    pauseBtn.style.display = 'none';
    stopMusic();

    // Update high score
    const isNewHighScore = score > highScore;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('highScore', highScore);
        highScoreDisplay.textContent = highScore;
    }

    // Show game over screen
    finalScoreDisplay.textContent = score;
    finalHighScoreDisplay.textContent = highScore;
    gameOverScreen.classList.add('show');

    playGameOverSound();
    setTimeout(() => {
        if (!gameRunning) {
            announceGameOverScore(isNewHighScore);
        }
    }, 250);
}

// Event listeners
startBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', togglePause);
restartBtn.addEventListener('click', () => {
    startGame();
});

jumpBtn.addEventListener('click', jumpPlayer);

// Initialize
updateHud();
gameLoop();
