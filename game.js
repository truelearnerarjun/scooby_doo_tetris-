// Modern Scooby-Doo themed Tetris


const BLOCK_SIZE = 30;
const COLS = 10, ROWS = 20;

// Colors for pieces
const colors = [
    null,
    '#3AA6A2', // Scooby collar teal
    '#8FD14F', // Shaggy green
    '#FFAA33', // Velma orange
    '#A36CFF', // Daphne purple
    '#FFD84A', // Fred yellow
    '#F06C9B',
    '#3B82F6'
];

// Get canvas contexts
const canvas = document.getElementById('tetris');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');

// Set canvas sizes
canvas.width = COLS * BLOCK_SIZE;
canvas.height = ROWS * BLOCK_SIZE;
nextCanvas.width = 6 * BLOCK_SIZE;
nextCanvas.height = 5 * BLOCK_SIZE;

// Drawing functions
function drawBlock(ctx, x, y, color) {
    const gradient = ctx.createLinearGradient(
        x * BLOCK_SIZE, 
        y * BLOCK_SIZE, 
        (x + 1) * BLOCK_SIZE, 
        (y + 1) * BLOCK_SIZE
    );
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, lightenColor(color, 30));
    
    ctx.fillStyle = gradient;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    
    const padding = 1;
    const radius = 4;
    
    ctx.beginPath();
    ctx.roundRect(
        x * BLOCK_SIZE + padding,
        y * BLOCK_SIZE + padding,
        BLOCK_SIZE - padding * 2,
        BLOCK_SIZE - padding * 2,
        radius
    );
    ctx.fill();
    ctx.stroke();
}

function lightenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 +
        (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255)
    ).toString(16).slice(1);
}

// Increase block size for bigger layout

// const COLS = 10, ROWS = 20;



let isPaused = false;
let isMuted = false;
let lastRandomGifIndex = -1;
let mascotGifTimeout = null;
let lastTime = 0;
let dropCounter = 0;
let dropInterval = 1000;
let score = 0;
// When hovering the volume slider, suppress arrow controls
let hoveringVolumeSlider = false;
// When hovering the speed slider, suppress arrow controls
let hoveringSpeedSlider = false;

// Speed control (levels 1-10)
let speedLevel = 1;
const SPEED_MIN = 1, SPEED_MAX = 10;
// Dynamic speed scaling based on score milestones
let speedScale = 1.0;           // Multiplier applied to base interval
let nextSpeedMilestone = 500;   // Next score at which to speed up by 5%

function updateDropInterval() {
  const base = Math.max(100, 1000 - (speedLevel - 1) * 100); // base ms from level
  const scaled = Math.round(base * speedScale);
  // Floor to avoid becoming too fast
  dropInterval = Math.max(50, scaled);
}

function maybeIncreaseSpeed() {
  // For each 500 points crossed, reduce interval by 5%
  while (score >= nextSpeedMilestone) {
    speedScale *= 0.95; // speed up by 5%
    nextSpeedMilestone += 500;
    updateDropInterval();
    dropCounter = 0; // take effect immediately
  }
}

// Programmatic speed control (for developer use)
function setGameSpeed(level) {
  const lvl = Math.min(SPEED_MAX, Math.max(SPEED_MIN, Number(level) || 1));
  speedLevel = lvl;
  updateDropInterval();
  dropCounter = 0; // take effect immediately
}
function setGameSpeedMs(ms) {
  const v = Math.max(50, Number(ms) || 1000);
  dropInterval = v;
  dropCounter = 0;
}
// Expose to window for external control
if (typeof window !== 'undefined') {
  window.setGameSpeed = setGameSpeed;
  window.setGameSpeedMs = setGameSpeedMs;
}

function createMatrix(w,h){
  const m=[];
  while(h--) m.push(new Array(w).fill(0));
  return m;
}

function createPiece(type){
  switch(type){
    case 'T': return [[0,1,0],[1,1,1],[0,0,0]];
    case 'O': return [[2,2],[2,2]];
    case 'L': return [[0,0,3],[3,3,3],[0,0,0]];
    case 'J': return [[4,0,0],[4,4,4],[0,0,0]];
    case 'I': return [[0,5,0,0],[0,5,0,0],[0,5,0,0],[0,5,0,0]];
    case 'S': return [[0,6,6],[6,6,0],[0,0,0]];
    case 'Z': return [[7,7,0],[0,7,7],[0,0,0]];
  }
}

let pieceBag = [];

function fillPieceBag() {
    const pieces = ['T', 'J', 'L', 'O', 'S', 'Z', 'I'];
    // Shuffle the pieces using Fisher-Yates algorithm
    for (let i = pieces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }
    pieceBag = pieces;
}

function getNextPiece() {
    if (pieceBag.length === 0) {
        fillPieceBag();
    }
    const pieceType = pieceBag.pop();
    return createPiece(pieceType);
}

const arena = createMatrix(COLS, ROWS);
const player = { pos:{x:0,y:0}, matrix:null };

// Mode: control ghost visibility
let showGhost = true;

function draw() {
    // Clear canvas
    ctx.fillStyle = '#061423';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw arena (placed pieces)
    arena.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                drawBlock(ctx, x, y, colors[value]);
            }
        });
    });
    
    // Draw ghost projection of current piece
    if (showGhost) drawGhost();
    
    // Draw current piece
    if (player.matrix) {
        player.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    drawBlock(ctx, x + player.pos.x, y + player.pos.y, colors[value]);
                }
            });
        });
    }
    
    drawNext();
}

function merge(){
  player.matrix.forEach((row,y)=>{
    row.forEach((val,x)=>{
      if(val!==0){
        arena[y+player.pos.y][x+player.pos.x] = val;
      }
    });
  });
}

function collide(){
  const m = player.matrix;
  const o = player.pos;
  for(let y=0;y<m.length;y++){
    for(let x=0;x<m[y].length;x++){
      if(m[y][x]!==0 && (arena[y+o.y] && arena[y+o.y][x+o.x])!==0){
        return true;
      }
    }
  }
  return false;
}

function playerReset(){
  player.matrix = nextPiece.matrix;
  player.pos.y = 0;
  player.pos.x = (COLS/2 | 0) - (player.matrix[0].length/2 | 0);
  if(collide()){
    isPaused = true;
    updateHighScore(score);
    document.getElementById('overlay-title').innerText = 'Game Over';
    document.getElementById('overlay-sub').innerText = 'Looks like we found another mystery...';
    document.getElementById('overlay-resume').classList.add('hidden');
    document.getElementById('overlay-restart').classList.remove('hidden');
    showOverlay();
    document.getElementById('game-over')?.play();
    return;
  }
  // prepare next
  nextPiece.matrix = getNextPiece();
  drawNext();
}

function playerDrop(){
  player.pos.y++;
  if(collide()){
    player.pos.y--;
    merge();
    const app = document.getElementById('app');
    app.classList.add('drop-feedback');
    setTimeout(() => app.classList.remove('drop-feedback'), 150);
    const lines = arenaSweep();
    console.log("Lines cleared:", lines);
    if(lines>0){
      playLineClearSound();
      showRandomMascotGif();
    }
    playerReset();
    updateScore();
  }
  dropCounter = 0;
}

function playerMove(dir){
  player.pos.x += dir;
  if(collide()) player.pos.x -= dir;
}

function rotate(matrix){
  for(let y=0;y<matrix.length;y++){
    for(let x=0;x<y;x++){
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
  }
  matrix.forEach(row=>row.reverse());
}

function playerRotate(){
  rotate(player.matrix);
  const app = document.getElementById('app');
  app.classList.add('rotate-feedback');
  setTimeout(() => app.classList.remove('rotate-feedback'), 150);
  if(collide()){
    player.pos.x++;
    if(collide()){
      player.pos.x -=2;
      if(collide()){
        rotate(player.matrix); rotate(player.matrix); rotate(player.matrix);
        player.pos.x +=1;
      }
    }
  }
}

function arenaSweep(){
  let rowCount=0;
  outer: for(let y=arena.length-1;y>=0;y--){
    for(let x=0;x<arena[y].length;x++){
      if(arena[y][x]===0) continue outer;
    }
    const row = arena.splice(y,1)[0].fill(0);
    arena.unshift(row);
    y++;
    rowCount++;
  }
  if(rowCount>0){
    score += 50 * rowCount * rowCount;
    flashLines();
    // Check and apply milestone-based speed up
    maybeIncreaseSpeed();
  }
  return rowCount;
}

// Add or modify in your arenaSweep function or where you handle line clears
function playLineClearSound() {
    const lineClearSound = document.getElementById('line-clear');
    if (lineClearSound) {
        // Get the current volume slider value but amplify it for line clear
        const globalVolume = document.getElementById('volume-slider').value;
        // Amplify the volume but cap it at 1.0 (maximum volume)
        lineClearSound.volume = Math.min(1.0, globalVolume * 3.0);
        lineClearSound.currentTime = 0; // Reset the sound
        lineClearSound.play().catch(() => {});
    }
}

// Use this function when lines are cleared
// Find where you handle line clears and replace the existing sound code with:


function flashLines(){
  const c = document.createElement('div');
  c.style.position='fixed';
  c.style.left='0'; c.style.top='0'; c.style.right='0'; c.style.bottom='0';
  c.style.pointerEvents='none';
  c.style.background='linear-gradient(90deg, rgba(58,166,162,0.08), rgba(143,209,79,0.06))';
  document.body.appendChild(c);
  setTimeout(()=>document.body.removeChild(c),160);
}

function showRandomMascotGif() {
    console.log("showRandomMascotGif called");
    if (mascotGifTimeout) {
        clearTimeout(mascotGifTimeout);
    }

    const defaultGif = document.getElementById('default-mascot-gif');
    const randomGifs = document.querySelectorAll('.random-gif');
    if (randomGifs.length === 0 || !defaultGif) {
        console.log("No GIFs found");
        return;
    }

    // Hide the default gif and any other visible random gif
    defaultGif.classList.add('hidden');
    randomGifs.forEach(gif => gif.classList.add('hidden'));

    // Show a random gif, different from the last one if possible
    let randomIndex;
    if (randomGifs.length > 1) {
        do {
            randomIndex = Math.floor(Math.random() * randomGifs.length);
        } while (randomIndex === lastRandomGifIndex);
    } else {
        randomIndex = 0;
        
    }
    lastRandomGifIndex = randomIndex;
    console.log("Showing random GIF at index:", randomIndex, "src:", randomGifs[randomIndex].src);

    randomGifs[randomIndex].classList.remove('hidden');

    // After a delay, hide the random gif and show the default one again
    mascotGifTimeout = setTimeout(() => {
        console.log("Reverting to default GIF");
        randomGifs[randomIndex].classList.add('hidden');
        defaultGif.classList.remove('hidden');
    }, 3000); 
}

function updateScore(){ document.getElementById('score').innerText = score; }

function drawNext() {
    // Clear next piece canvas
    nextCtx.fillStyle = '#0A141A';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    
    if (nextPiece.matrix) {
        nextPiece.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    drawBlock(nextCtx, x + 1, y + 1, colors[value]);
                }
            });
        });
    }
}

fillPieceBag();
let nextPiece = { matrix: getNextPiece() };

// Add these at the top with your other state variables
let gameStarted = false;
let mainMenuVisible = true;

// ---- Main Menu Music Helpers (User adds their own URLs) ----
// Array of menu track URLs; user can populate via setMainMenuTracks/addMainMenuTrack
let mainMenuTracks = [];
// Track last picked menu track to avoid immediate repeats
let lastMenuTrack = null;

function setMainMenuTracks(sources) {
  // Usage example (in console or your code): setMainMenuTracks(['assets/audio/menu1.mp3','assets/audio/menu2.ogg']);
  mainMenuTracks = Array.isArray(sources) ? sources.filter(Boolean) : [];
  // Reset last track when list changes
  lastMenuTrack = null;
}
function addMainMenuTrack(src) {
  if (src) mainMenuTracks.push(src);
}
function pickRandomMenuTrack() {
  if (!mainMenuTracks.length) return null;
  if (mainMenuTracks.length === 1) {
    lastMenuTrack = mainMenuTracks[0];
    return lastMenuTrack;
  }
  let pick;
  // Avoid picking the same track back-to-back when we have 2+ tracks
  do {
    pick = mainMenuTracks[Math.floor(Math.random() * mainMenuTracks.length)];
  } while (pick === lastMenuTrack);
  lastMenuTrack = pick;
  return pick;
}
function ensureMenuAudioEl() {
  let el = document.getElementById('menu-music');
  if (!el) {
    el = document.createElement('audio');
    el.id = 'menu-music';
    el.preload = 'auto';
    el.loop = true;
    el.style.display = 'none';
    document.body.appendChild(el);
  }
  // Keep volume/mute in sync with global controls
  const slider = document.getElementById('volume-slider');
  const vol = slider ? Number(slider.value || 0.2) : 0.2;
  el.volume = Math.max(0, Math.min(1, vol));
  el.muted = !!isMuted;
  return el;
}
function playRandomMenuSong() {
  const el = ensureMenuAudioEl();
  const src = pickRandomMenuTrack();
  if (!src) return; // user hasn't added any tracks yet
  try { el.pause(); } catch(_) {}
  try { el.currentTime = 0; } catch(_) {}
  if (el.src !== src) el.src = src;
  el.play().catch(() => {
    const retry = () => {
      el.play().catch(()=>{});
      window.removeEventListener('pointerdown', retry, true);
      
    };
    window.addEventListener('pointerdown', retry, true);
    
  });
}
function stopMenuMusic() {
  const el = document.getElementById('menu-music');
  if (el) {
    try { el.pause(); } catch(_) {}
    try { el.currentTime = 0; } catch(_) {}
  }
}
// Expose simple APIs for the user
if (typeof window !== 'undefined') {
  window.setMainMenuTracks = setMainMenuTracks;
  window.addMainMenuTrack = addMainMenuTrack;
  window.playRandomMenuSong = playRandomMenuSong;
}
// -----------------------------------------------------------

// Add these functions near your other UI functions
function showMainMenu() {
    document.getElementById('main-menu').classList.remove('hidden');
    document.getElementById('how-to-play').classList.add('hidden');
    document.getElementById('app').classList.add('hidden');
    mainMenuVisible = true;
    isPaused = true;

    // Randomly display a GIF
    const gifs = document.querySelectorAll('.gif');
    gifs.forEach(gif => gif.classList.remove('active'));
    const randomIndex = Math.floor(Math.random() * gifs.length);
    gifs[randomIndex].classList.add('active');
    
    // Stop the music when returning to menu
    const music = document.getElementById('music');
    if (music) {
        music.pause();
        music.currentTime = 0;
    }
    // Start randomized menu music if user added tracks
    playRandomMenuSong();
    
    // Reset game state and player position
    playerReset();
}

// Modify startGame function
function startGame() {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('how-to-play').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    mainMenuVisible = false;
    gameStarted = true;
    isPaused = false;

    // Ensure menu music is stopped before gameplay
    stopMenuMusic();
    
    // Start randomized game music using the same track list
    playRandomGameSong();
     
    // Reset game state
    arena.forEach(row => row.fill(0));
    score = 0;
    dropCounter = 0;
    lastTime = 0;
    // Reset dynamic speed scaling
    speedScale = 1.0;
    nextSpeedMilestone = 500;
    // Ensure dropInterval reflects current speed level
    updateDropInterval();
    playerReset();
    updateScore();
    getHighScore();
}

// Add showHowToPlay function
function showHowToPlay() {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('how-to-play').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
}

// Add leaveGame function
function leaveGame() {
    if(confirm('Are you sure you want to leave the game?')) {
        window.close();
    }
}

// Modify your update function
function update(time=0) {
  if(!isPaused && gameStarted) {
    const delta = time - lastTime;
    lastTime = time;
    dropCounter += delta;
    if(dropCounter > dropInterval) {
      playerDrop();
    }
    draw();
  }
  requestAnimationFrame(update);
}

// Replace your start code at the bottom with:
showMainMenu();
update();
getHighScore();

document.addEventListener('keydown', e=>{
  if (isPaused || !gameStarted) return; // Block controls when paused or in menu
  // Ignore arrow keys while hovering the volume or speed slider
  if ((hoveringVolumeSlider || hoveringSpeedSlider) && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowDown')) {
    return;
  }

  if(e.key === 'ArrowLeft') playerMove(-1);
  else if(e.key === 'ArrowRight') playerMove(1);
  else if(e.key === 'ArrowDown') playerDrop();
  else if(e.key === 'q' || e.key === 'Q') playerRotate();
  else if(e.key === 'p' || e.key === 'P') togglePause();
  else if(e.key === ' ') {
    // Hard drop visual feedback
    const app = document.getElementById('app');
    if (app) {
      app.classList.add('hard-drop-feedback');
      setTimeout(() => app.classList.remove('hard-drop-feedback'), 220);
    }
    while(!collide()) player.pos.y++;
    player.pos.y--;
    merge();
    const lines = arenaSweep();
    if (lines > 0) {
        playLineClearSound();
        showRandomMascotGif();
    }
    playerReset();
    updateScore();
  }
});

document.getElementById('pause').addEventListener('click', ()=> togglePause());
document.getElementById('overlay-resume').addEventListener('click', ()=> togglePause(false));
document.getElementById('restart').addEventListener('click', ()=>{
  arena.forEach(row=>row.fill(0));
  score = 0; updateScore(); playerReset(); hideOverlay();
});
document.getElementById('mute').addEventListener('click', ()=> toggleMute());

document.addEventListener('DOMContentLoaded', () => {
    const backButton = document.getElementById('back-to-menu');
    if (backButton) {
        backButton.addEventListener('click', () => {
            backtomenu();
        });
    }
    
    const music = document.getElementById('music');
    const volumeSlider = document.getElementById('volume-slider');
    const speedSlider = document.getElementById('speed-slider');
    const speedValue = document.getElementById('speed-value');
    
    // Set initial volume (0.2 = 20% volume)
    music.volume = 0.2;
    volumeSlider.value = 0.2;
    
    // Initialize speed slider
    if (speedSlider) {
        // Clamp initial level within bounds
        speedLevel = Math.min(SPEED_MAX, Math.max(SPEED_MIN, parseInt(speedSlider.value || '1', 10)));
        updateDropInterval();
        if (speedValue) speedValue.textContent = String(speedLevel);

        // Prevent keyboard interaction and blur after pointer use (like volume slider)
        speedSlider.setAttribute('tabindex', '-1');
        const blockKeys = (e) => {
            const blocked = [
                'ArrowLeft','ArrowRight','ArrowUp','ArrowDown',
                'Home','End','PageUp','PageDown',' ','Enter'
            ];
            if (blocked.includes(e.key)) {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        speedSlider.addEventListener('keydown', blockKeys);
        speedSlider.addEventListener('keyup', blockKeys);
        const blurAfter = () => { setTimeout(() => speedSlider.blur(), 0); };
        speedSlider.addEventListener('pointerup', blurAfter);
        speedSlider.addEventListener('change', blurAfter);
        const enter = () => { hoveringSpeedSlider = true; };
        const leave = () => { hoveringSpeedSlider = false; };
        speedSlider.addEventListener('pointerenter', enter);
        speedSlider.addEventListener('mouseenter', enter);
        speedSlider.addEventListener('pointerleave', leave);
        speedSlider.addEventListener('mouseleave', leave);

        speedSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            if (!Number.isNaN(val)) {
                speedLevel = Math.min(SPEED_MAX, Math.max(SPEED_MIN, val));
                if (speedValue) speedValue.textContent = String(speedLevel);
                updateDropInterval();
                // Reset counter so change takes effect immediately
                dropCounter = 0;
            }
        });
    }
    
    // Make volume slider respond only to pointer/touch, not keyboard
    if (volumeSlider) {
        // Remove from tab order (can't focus via Tab)
        volumeSlider.setAttribute('tabindex', '-1');

        const blockKeys = (e) => {
            const blocked = [
                'ArrowLeft','ArrowRight','ArrowUp','ArrowDown',
                'Home','End','PageUp','PageDown',' ','Enter'
            ];
            if (blocked.includes(e.key)) {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        volumeSlider.addEventListener('keydown', blockKeys);
        volumeSlider.addEventListener('keyup', blockKeys);

        // After pointer interaction, remove focus so further arrow keys don't affect it
        const blurAfter = () => { setTimeout(() => volumeSlider.blur(), 0); };
        volumeSlider.addEventListener('pointerup', blurAfter);
        volumeSlider.addEventListener('change', blurAfter);

        // Track hover to temporarily disable arrow keys for game controls
        const enter = () => { hoveringVolumeSlider = true; };
        const leave = () => { hoveringVolumeSlider = false; };
        volumeSlider.addEventListener('pointerenter', enter);
        volumeSlider.addEventListener('mouseenter', enter);
        volumeSlider.addEventListener('pointerleave', leave);
        volumeSlider.addEventListener('mouseleave', leave);
    }
    const playBtn = document.getElementById('play-btn');
    const modeModal = document.getElementById('mode-modal');
    const modeEasy = document.getElementById('mode-easy');
    const modeMedium = document.getElementById('mode-medium');
    const modeCancel = document.getElementById('mode-cancel');
    const modalBackdrop = modeModal ? modeModal.querySelector('.modal-backdrop') : null;

    const openModeModal = () => { if (modeModal) modeModal.classList.remove('hidden'); };
    const closeModeModal = () => { if (modeModal) modeModal.classList.add('hidden'); };

    if (playBtn && modeModal) {
        playBtn.addEventListener('click', openModeModal);
    }
    if (modeEasy) {
        modeEasy.addEventListener('click', () => { closeModeModal(); startEasyGame(); });
    }
    if (modeMedium) {
        modeMedium.addEventListener('click', () => { closeModeModal(); startMediumGame(); });
    }
    if (modeCancel) {
        modeCancel.addEventListener('click', closeModeModal);
    }
    if (modalBackdrop) {
        modalBackdrop.addEventListener('click', closeModeModal);
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modeModal && !modeModal.classList.contains('hidden')) {
            closeModeModal();
        }
    });

    document.getElementById('overlay-restart').addEventListener('click', ()=> {
        hideOverlay();
        startGame();
    });

    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.addEventListener('keydown', (e) => {
            if (e.key === ' ') {
                e.preventDefault();
            }
        });
    });
});

// Removed stray call with no argument; user should pass a src or use setMainMenuTracks([...])
// addMainMenuTrack();

// Collision test at an arbitrary position (used for ghost)
function collideAt(matrix, pos){
  for(let y=0;y<matrix.length;y++){
    for(let x=0;x<matrix[y].length;x++){
      if(matrix[y][x]!==0 && (arena[y+pos.y] && arena[y+pos.y][x+pos.x])!==0){
        return true;
      }
    }
  }
  return false;
}

function backtomenu() {
    gameStarted = false;
    isPaused = true;
    
    // Handle music
    const music = document.getElementById('music');
    if (music) {
        music.pause();
        music.currentTime = 0;
    }
    // Let showMainMenu() start menu music to avoid double-start
    // playRandomMenuSong();
    
    // Reset game state and player position
    playerReset();
    
    // Show menu
    showMainMenu();
}

// ---- Main Menu Music Helpers (User adds their own URLs) ----
// Array of menu track URLs; user can populate via setMainMenuTracks/addMainMenuTrack
const MENU_TRACKS = [
  '../assets/sounds/ThemeSongs/Scooby_Doo_Hex_Girls_Earth_Wind_and_Fire.mp3',
  '../assets/sounds/ThemeSongs/Scooby_Doo_Hex_Girls_Im_a_Hex_Girl.mp3',
  '../assets/sounds/ThemeSongs/Scooby_Doo_and_The_Witchs_Ghost_Terror_Time_Scooby_Doo_on_Zombie_Island.mp3',
  '../assets/sounds/ThemeSongs/Scooby_Doo_and_The_Witchs_Ghost_The_Ghost_Is_Here.mp3',
  '../assets/sounds/scooby_doo_theme.mp3'
];

setMainMenuTracks(MENU_TRACKS);

// Draw a translucent ghost where the current piece would land
function drawGhost(){
  if (!player.matrix) return;
  const ghostPos = { x: player.pos.x, y: player.pos.y };
  // Move down until collision would occur on the next step
  while (!collideAt(player.matrix, { x: ghostPos.x, y: ghostPos.y + 1 })) {
    ghostPos.y++;
  }
  // If ghost is same as current position, still draw (it will be under the live piece)
  ctx.save();
  ctx.globalAlpha = 0.35; // translucent
  const prevStroke = ctx.strokeStyle;
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  player.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        drawBlock(ctx, x + ghostPos.x, y + ghostPos.y, colors[value]);
      }
    });
  });
  ctx.strokeStyle = prevStroke;
  ctx.restore();
}

function togglePause(force){
  isPaused = (typeof force === 'boolean') ? force : !isPaused;
  if(isPaused){
    document.getElementById('overlay-title').innerText = 'Paused';
    document.getElementById('overlay-sub').innerText = 'Like, take a break man!';
    document.getElementById('overlay-resume').classList.remove('hidden');
    document.getElementById('overlay-restart').classList.add('hidden');
    showOverlay();
    document.getElementById('music')?.pause();
    const pauseSound = document.getElementById('pause-sound');
    if (pauseSound && typeof pauseSound.play === 'function') {
      try { pauseSound.currentTime = 0; } catch(_) {}
      pauseSound.play().catch(() => {});
    }
  } else {
    hideOverlay();
    document.getElementById('music')?.play().catch(()=>{});
    document.getElementById('unpause')?.play().catch(()=>{});
  }
}
function showOverlay(){ document.getElementById('overlay').classList.remove('hidden'); }
function hideOverlay(){ document.getElementById('overlay').classList.add('hidden'); }

document.getElementById('volume-slider').addEventListener('input', (e) => {
    const volume = e.target.value;
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
        audio.volume = volume;
    });
});

function toggleMute(){
  isMuted = !isMuted;
  const muteButton = document.getElementById('mute');
  muteButton.innerHTML = isMuted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
  const audioElements = document.querySelectorAll('audio');
  audioElements.forEach(audio => {
    audio.muted = isMuted;
  });
}

function startEasyGame() {
  // Easy: ghost ON, default speed
  showGhost = true;
  // Default drop interval ~1000ms
  // Prefer using speedLevel mapping if present
  speedLevel = 1;
  speedScale = 1.0;
  nextSpeedMilestone = 500;
  updateDropInterval();
  dropCounter = 0;
  startGame();
}

function startMediumGame() {
  // Medium: ghost OFF, faster speed
  showGhost = false;
  // Faster drop, e.g., ~400ms
  // Prefer using speedLevel mapping if present
  speedLevel = 7; // 1000 - (7-1)*100 = 400ms
  speedScale = 1.0;
  nextSpeedMilestone = 500;
  updateDropInterval();
  dropCounter = 0;
  startGame();
}

// Handle browsers that block autoplay: start the appropriate audio on first gesture
let _audioUnlockInstalled = false;
function installAudioUnlock() {
  if (_audioUnlockInstalled) return;
  _audioUnlockInstalled = true;
  const handler = () => {
    if (mainMenuVisible) {
      // Try to start menu music
      try { playRandomMenuSong(); } catch(_) {}
    } else {
      // Try to start in-game music
      const music = document.getElementById('music');
      if (music) {
        music.play().catch(()=>{});
      }
    }
    window.removeEventListener('pointerdown', handler, true);
    window.removeEventListener('keydown', handler, true);
  };
  window.addEventListener('pointerdown', handler, true);
  window.addEventListener('keydown', handler, true);
}

// Ensure audio starts after the first user gesture (autoplay policy)
installAudioUnlock();

// Use the same tracks for in-game music via the #music element
function playRandomGameSong() {
  const music = document.getElementById('music');
  if (!music) return;
  const src = pickRandomMenuTrack();
  if (!src) return;
  // Ensure volume/mute
  const slider = document.getElementById('volume-slider');
  const vol = slider ? Number(slider.value || 0.2) : 0.2;
  music.volume = Math.max(0, Math.min(1, vol));
  music.muted = !!isMuted;
  music.loop = true;
  try { music.pause(); } catch(_) {}
  try { music.currentTime = 0; } catch(_) {}
  if (music.src !== src) music.src = src;
  music.play().catch(() => {
    const retry = () => {
      music.play().catch(()=>{});
      window.removeEventListener('pointerdown', retry, true);
      window.removeEventListener('keydown', retry, true);
    };
    window.addEventListener('pointerdown', retry, true);
    window.addEventListener('keydown', retry, true);
  });
}

if (typeof window !== 'undefined') {
  window.setMainMenuTracks = setMainMenuTracks;
  window.addMainMenuTrack = addMainMenuTrack;
  window.playRandomMenuSong = playRandomMenuSong;
  window.playRandomGameSong = playRandomGameSong;
}

// Inject minimal CSS for drop animations (soft vs hard) once
function ensureEffectsStyle() {
  if (document.getElementById('effects-style')) return;
  const css = `
  @keyframes rotatePop {
  0%   { transform: rotate(0deg) scale(1); }
  50%  { transform: rotate(4deg) scale(1.015); } /* smaller angle + smaller scale */
  100% { transform: rotate(0deg) scale(1); }
}
.rotate-feedback {
  animation: rotatePop 100ms ease-out; /* shorter duration for quick feel */
  transform-origin: center;
  will-change: transform;
}
  @keyframes hardDropShock {
  0%   { transform: translateY(-3px) scale(1.03); box-shadow: 0 0 0 rgba(255,255,255,0); }
  35%  { transform: translateY(0) scale(0.97); box-shadow: 0 0 12px rgba(255,255,255,0.25); }
  100% { transform: none; box-shadow: 0 0 0 rgba(255,255,255,0); }
}
.hard-drop-feedback {
  animation: hardDropShock 200ms cubic-bezier(.25,.75,.2,1);
  transform-origin: center;
  will-change: transform, box-shadow;
}
  `;
  const style = document.createElement('style');
  style.id = 'effects-style';
  style.textContent = css;
  document.head.appendChild(style);
}

document.addEventListener('DOMContentLoaded', () => {
  // Ensure animation CSS is present
  ensureEffectsStyle();
});

window.pause = () => {
  isPaused = !isPaused;
};
