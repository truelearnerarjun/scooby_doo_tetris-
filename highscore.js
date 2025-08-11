let highScore = 0;

function getHighScore() {
    const savedHighScore = localStorage.getItem('scoobyTetrisHighScore');
    if (savedHighScore) {
        highScore = parseInt(savedHighScore, 10);
        const highScoreElement = document.getElementById('high-score');
        if (highScoreElement) {
            highScoreElement.innerText = highScore;
        }
    }
}

function updateHighScore(score) {
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('scoobyTetrisHighScore', highScore);
        const highScoreElement = document.getElementById('high-score');
        if (highScoreElement) {
            highScoreElement.innerText = highScore;
        }
    }
}
