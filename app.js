const { Client, LocalAuth, MessageMedia  } = require('whatsapp-web.js');
const sqlite3 = require('sqlite3').verbose();
const qrcode = require('qrcode-terminal');

const eCIID = '120363162802059783@g.us'; // Replace with your own eCIID (Deze code is om te testen)

// Create or open the SQLite database
const db = new sqlite3.Database('scores.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the scores database.');
    // Create a table to store scores if it doesn't exist
    db.run(`
      CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user TEXT NOT NULL,
		nickname TEXT,
        score INTEGER NOT NULL
      )
    `);
    db.run(`
    CREATE TABLE IF NOT EXISTS points_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user TEXT NOT NULL,
      points_change INTEGER NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  }
});

const client = new Client({
    authStrategy: new LocalAuth()
});
 
	
client.initialize();	

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
});

client.on('authenticated', () => {
    console.log('AUTHENTICATED');
});

client.on('auth_failure', msg => {
    // Fired if session restore was unsuccessful
    console.error('AUTHENTICATION FAILURE', msg);
});

client.on('ready', () => {
  console.log('Client is ready!');
});

client.on('message', async (msg) => {
  const groupChatId = msg.from.endsWith('@g.us') ? msg.from : null;
  // Alleen antwoorden in eCI groupchat
  if (groupChatId === eCIID) {
    if (msg.body == '!top5') {
      const getScoresWithNicknames = await getTopScoresWithNicknames();
      if (getScoresWithNicknames.length > 0) {
        const scoreMessage = getScoresWithNicknames
          .map(({ nickname, score }) => `${nickname}: ${score}`)
          .join('\n');
        msg.reply(`Scores:\n${scoreMessage}`);
      } else {
        msg.reply('No scores found.');
      }
    } else if (msg.body.startsWith('!setnickname')) {
      const nickname = msg.body.split(' ')[1]; // Extract the nickname from the message

      if (nickname) {
        const user = msg.from.replace('@c.us', ''); // Extracting the user's phone number
        updateNickname(user, nickname);
        msg.reply(`Nickname set! Your nickname is now "${nickname}".`);
      } else {
        msg.reply('Please provide a nickname after the command. For example, `!setnickname MyNickname`.');
      }
    }
    else if (msg.body.startsWith('!nieuw')) {
      const nickname = msg.body.split(' ')[1]; // Extract the nickname from the message

      if (nickname) {
        const user = msg.from.replace('@c.us', ''); // Extracting the user's phone number
        insertNewUser(user, nickname);
        msg.reply(`New user added! Your nickname is "${nickname}" and your score is initialized to 0.`);
      } else {
        msg.reply('Please provide a nickname after the command. For example, `!nieuw MyNickname`.');
      }
    }
      else if (msg.body.includes('#punten')) {
      const user = msg.from.replace('@c.us', ''); // Extracting the user's phone number
      const currentScore = await getScore(user);

      // Check if the message contains a "+" or "-" followed by a number
      const addScoreRegex = /([+-]\d+)/;
      const addScoreMatch = msg.body.match(addScoreRegex);

      if (addScoreMatch) {
        const scoreChange = parseInt(addScoreMatch[1]);
        if (!isNaN(scoreChange)) {
          const newScore = currentScore + scoreChange;
          updateScore(user, newScore);
          msg.reply(`Score updated! Your new score is ${newScore}.`);
        }
      }
    }
  } else {
	  if (msg.body.startsWith('!help')) {
		  msg.reply(`Ik ben Esculaap, ik zorg er voor dat alle punten worden bijgehouden..`);
		  const media = MessageMedia.fromFilePath('./snake.gif');
		  msg.reply(media);
	  }
    
  }
});


function updateNickname(user, nickname) {
  console.log(`Updating nickname for user ${user}. New nickname: ${nickname}`);
  db.run('UPDATE scores SET nickname = (?) WHERE user = (?)', [nickname, user], (err) => {
    if (err) {
      console.error('Error updating nickname:', err.message);
    } else {
      console.log(`Nickname updated for user ${user}. New nickname: ${nickname}`);
    }
  });
}

// Function to get the current score of a user from the database
function getScore(user) {
  return new Promise((resolve, reject) => {
    db.get('SELECT score FROM scores WHERE user = ?', [user], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row ? row.score : 0);
      }
    });
  });
}

function insertNewUser(user, nickname) {
  db.run('INSERT INTO scores (user, nickname, score) VALUES (?, ?, 0)', [user, nickname], (err) => {
    if (err) {
      console.error('Error inserting new user:', err.message);
    } else {
      console.log(`New user added. User: ${user}, Nickname: ${nickname}`);
    }
  });
}

// Function to update the score of a user in the database
function updateScore(user, score) {
  db.run('UPDATE scores SET score = (?) WHERE user = (?)', [score, user], (err) => {
    if (err) {
      console.error('Error updating score:', err.message);
    } else {
      console.log(`Score updated for user ${user}. New score: ${score}`);
    }
  });
}

// Function to get all scores from the database
function getTopScoresWithNicknames() {
  return new Promise((resolve, reject) => {
    db.all('SELECT user, nickname, score FROM scores ORDER BY score DESC LIMIT 5', (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows.map(({ user, nickname, score }) => ({ nickname: nickname || user, score })));
      }
    });
  });
}

// Close the database connection when the process exits
process.on('exit', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed.');
    }
  });
});

function logPointsChange(user, pointsChange) {
  db.run('INSERT INTO points_changes (user, points_change) VALUES (?, ?)', [user, pointsChange], (err) => {
    if (err) {
      console.error('Error logging points change:', err.message);
    } else {
      console.log(`Points change logged for user ${user}. Points Change: ${pointsChange}`);
    }
  });
}
