const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let drawing = false;
let currentColor = 'black';
let currentSize = 2;
let timer;
let countdown;
let gameStarted = false;
let phrasesFetched = false;

const roomId = "{{ room_id }}";
console.log('Connecting to server with roomId:', roomId);
var socket = io.connect('http://' + document.domain + ':' + location.port);

socket.on('connect', function() {
    console.log('Connected to server');
    socket.emit('join', { room_id: roomId });
});

socket.on('message', function(data) {
    if (data.msg === 'Game started') {
        document.getElementById('drawingArea').style.display = 'block';
        document.getElementById('waitingMessage').style.display = 'none';
        document.getElementById('userSelect').style.display = 'none'
        localStorage.setItem('drawings', 0)
        gameStarted = true;
        startTimer(30);
        initializeCanvas()
    }
    if (data.msg === 'Round 1 finished') {
        document.getElementById('drawingArea').style.display = 'none';
    }
    if (data.msg === 'Round 2 started') {
        document.getElementById('phraseInput').style.display = 'block';
    }
    if (data.msg === 'Round 2 finished') {
        document.getElementById('phraseInput').style.display = 'none';
    }
    if (data.msg === 'Round 3 started') {
        phrasesFetched = true
        fetchDistributedPhrases()
        fetchDistributedDrawings()
        document.getElementById('combinationArea').style.display = 'block';
        document.getElementById('round3').style.display = 'block'
    }
    if (data.msg === 'Round 3 finished') {
        document.getElementById('combinationArea').style.display = 'none';
        document.getElementById('round3').style.display = 'none'
    }
    if (data.msg === 'Round 4 started') {
        fetchMatchups()
    }
    if (data.msg === 'Round 4 finished') {
        displayMatchup();
    }
    console.log('Mensagem recebida:', data.msg);
});

function checkGameStatus() {
    fetch(`/room_status/${roomId}`)
        .then(response => response.json())
        .then(data => {
            if (data.started && !gameStarted) {
                gameStarted = true;
                document.getElementById('waitingMessage').style.display = 'none';
                document.getElementById('drawingArea').style.display = 'block';
                startTimer(data.remaining_time);
                localStorage.setItem('drawings', 0)
                initializeCanvas();
            }
            if (data.remaining_time === 0) {
                document.getElementById('drawingArea').style.display = 'none';
            }
            if (data.current_round === 2) {
                document.getElementById('phraseInput').style.display = 'flex';
            }
            if (data.current_round === 3 && !phrasesFetched) {
                phrasesFetched = true
                fetchDistributedPhrases()
                fetchDistributedDrawings()
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

window.onload = () => {
    const savedPlayerId = localStorage.getItem('playerId');
    const savedUsername = localStorage.getItem('username');
    let playerId = savedPlayerId;
    let username = savedUsername;

    checkGameStatus();

    if (playerId && username) {
        joinRoom(playerId, username)
    } else {
        if (!playerId) {
        }
    }
};

function saveUsername(){
    const username = document.getElementById('username').value
    const playerId = localStorage.getItem('playerId')

    localStorage.setItem('username', username)
    joinRoom(playerId, username)
}

function joinRoom(playerId, username) {
    fetch('/join_room', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ room_id: roomId, player_id: playerId, username: username })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Response data:', data);
        if (data.message === 'Player added' || data.message === 'Rejoining...') {
            console.log('Token:', data.token); // O token é o próprio playerId
            console.log(data.message);

            localStorage.setItem('playerId', data.token);
            localStorage.setItem('username', username);
        } else {
            window.location.href = 'https://youtube.com';
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

function initializeCanvas() {
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', stopDrawing);
}

function setColor(color) {
    currentColor = color;
}

function setBrushSize(size) {
    currentSize = size;
}

function setEraser() {
    currentColor = 'white';
}

function startDrawing(event) {
    drawing = true;
    draw(event);
    resetTimer();
}

function draw(event) {
    if (!drawing) return;

    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX || event.touches[0].clientX) - rect.left;
    const y = (event.clientY || event.touches[0].clientY) - rect.top;

    ctx.lineWidth = currentSize;
    ctx.lineCap = 'round';
    ctx.strokeStyle = currentColor;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
}

function stopDrawing() {
    drawing = false;
    ctx.beginPath();
    resetTimer();
}

function exportDrawing() {
    const dataURL = canvas.toDataURL('image/png');
    const playerId = localStorage.getItem('playerId')
    fetch('/upload', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ player_id: playerId, room_id: roomId, image: dataURL })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Erro na resposta do servidor');
        }
        return response.json();
    })
    .then(data => {
        console.log('Success:', data);
        var drawings = localStorage.getItem('drawings');
        if (drawings) {
            drawings = parseInt(drawings);
        } else {
            drawings = 0;
        }

        if (drawings < 3) {
            drawings += 1;
            localStorage.setItem('drawings', drawings);
            clearCanvas();
        } else {
            canvas.style.display = 'none';
        }
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath(); // Reiniciar o caminho para que as novas linhas não se conectem às antigas
}

function resetTimer() {
    clearTimeout(timer);
    timer = setTimeout(exportDrawing, 30000);
}

function startTimer(duration) {
    let timeLeft = duration;
    document.getElementById('timeLeft').textContent = timeLeft;
    countdown = setInterval(() => {
        timeLeft--;
        document.getElementById('timeLeft').textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(countdown);
            exportDrawing();
        }
    }, 1000);
}

function submitPhrase() {
    const phrase = document.getElementById('phrase').value;
    const playerId = localStorage.getItem('playerId')
    if (phrase) {
        fetch('/submit_phrase', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ room_id: roomId, player_id: playerId, phrase: phrase })
        })
        .then(response => response.json())
        .then(data => {
            if (data.message === 'Phrase submitted') {
                document.getElementById('phrase').value = ''; // Limpa o campo de entrada após o envio
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
    } else {
        alert("Por favor, insira uma frase!");
    }
}

function fetchDistributedPhrases() {
    fetch(`/distribute_phrases/${roomId}`)
        .then(response => response.json())
        .then(data => {
            const phraseList = document.getElementById('phraseList');
            const playerId = localStorage.getItem('playerId')
            const phraseSelect = document.getElementById('phraseSelect');
            const round3 = document.getElementById('round3')
            phraseList.innerHTML = '';
            phraseSelect.innerHTML = '';
            if (data[playerId] && data[playerId].length > 0) {
                data[playerId].forEach(phrase => {
                    const li = document.createElement('li');
                    li.textContent = phrase;
                    phraseList.appendChild(li);

                    const option = document.createElement('option');
                    option.value = phrase;
                    option.textContent = phrase;
                    phraseSelect.appendChild(option);
                    round3.appendChild(phraseList)
                });
            } else {
                phraseList.textContent = 'Nenhuma frase atribuída.';
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

function fetchDistributedDrawings() {
    fetch(`/distribute_drawing/${roomId}`)
        .then(response => response.json())
        .then(data => {
            const drawingList = document.getElementById('drawingList');
            const playerId = localStorage.getItem('playerId')
            const imageSelect = document.getElementById('imageSelect');
            const round3 = document.getElementById('round3')
            drawingList.innerHTML = '';
            imageSelect.innerHTML = '';
            if (data[playerId] && data[playerId].length > 0) {
                data[playerId].forEach(url => {
                    const img = document.createElement('img');
                    img.src = url;
                    drawingList.appendChild(img);

                    const option = document.createElement('option');
                    option.value = url;
                    option.textContent = url.substring(url.lastIndexOf('/') + 1); // Use the filename as the display text
                    imageSelect.appendChild(option);
                    round3.appendChild(drawingList)
                });
            } else {
                drawingList.textContent = 'Nenhum desenho atribuído.';
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

function combineSelection() {
    const selectedImage = document.getElementById('imageSelect').value;
    const selectedPhrase = document.getElementById('phraseSelect').value;
    const playerId = localStorage.getItem('playerId')

    if (selectedImage && selectedPhrase) {
        fetch(`/combine/${roomId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ player_id: playerId, image_path: selectedImage, phrase: selectedPhrase })
        })
        .then(response => response.json())
        .then(data => {
            if (data.message === 'Combination saved successfully') {
                alert('Combinação enviada com sucesso!');
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
    } else {
        alert('Por favor, selecione um desenho e uma frase!');
    }
}

async function fetchMatchups() {
    const response = await fetch(`/tournament/${roomId}/matchup`);
    const data = await response.json();
    if (data.matchups) {
        matchups = data.matchups;
        currentMatchupIndex = 0;
        winners = [];
        displayMatchup();
    } else {
        document.getElementById('matchups').innerHTML = '<p>No matchups available</p>';
    }
}

// Function to display a single matchup
function displayMatchup() {
    const matchupsDiv = document.getElementById('matchups');
    matchupsDiv.innerHTML = ''; // Clear previous matchups

    if (currentMatchupIndex < matchups.length) {
        const matchup = matchups[currentMatchupIndex];
        const matchupDiv = document.createElement('div');
        matchupDiv.classList.add('matchup');
        const player1 = matchup.players[0];
        const player2 = matchup.players[1];

        const player1Div = document.createElement('div');
        player1Div.innerHTML = `
            <input type="radio" name="winner" value="${player1}"> Player: ${player1}<br>
            Combinations: ${JSON.stringify(matchup.combinations[0], null, 2)}
        `;
        matchupDiv.appendChild(player1Div);

        if (player2) {
            const player2Div = document.createElement('div');
            player2Div.innerHTML = `
                <input type="radio" name="winner" value="${player2}"> Player: ${player2}<br>
                Combinations: ${JSON.stringify(matchup.combinations[1], null, 2)}
            `;
            matchupDiv.appendChild(player2Div);
        } else {
            const byeDiv = document.createElement('div');
            byeDiv.innerHTML = `<p>Player: ${player1} gets a bye</p>`;
            matchupDiv.appendChild(byeDiv);
        }

        matchupsDiv.appendChild(matchupDiv);
        document.getElementById('sendVote').style.display = 'block';
    } else {
        document.getElementById('sendVote').style.display = 'none';
    }
}

function sendVote() {
    const selectedWinner = document.querySelector('input[name="winner"]:checked');
    if (selectedWinner) {
        currentMatchupIndex++;
    } else {
        alert('Please select a winner before proceeding.');
    }
    const playerId = localStorage.getItem('playerId')
    var vote = selectedWinner.value;
    var data = {
        room_id: roomId,
        player_id: playerId,
        vote: vote
    };
    
    // Envie os dados para o servidor usando fetch
    fetch('/vote', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        console.log(data.message + vote)
    })
    .catch(error => {
        console.error('Error:', error);
    });
}