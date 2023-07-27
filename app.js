const fs = require('fs');
const { Client, LocalAuth, MessageMedia  } = require('whatsapp-web.js');
const sqlite3 = require('sqlite3').verbose();
const qrcode = require('qrcode-terminal');

const eCIID = '120363162802059783@g.us'; // Replace with your own eCIID (Deze code is om te testen)
const authorizedUserPhoneNumber = '31625210135@c.us';

//const groupID = process.env.GROUPID;
const groupID = '120363162802059783@g.us'; // Replace with your own eCIID (Deze code is om te testen)
//const adminID = process.env.ADMINID;
const adminID = '31625210135@c.us';

console.error('Starting the Esculaap app.');

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
      CREATE TABLE IF NOT EXISTS points_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user TEXT NOT NULL,
        score_change INTEGER NOT NULL,
        chick TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
});

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-setuid-sandbox']}
	
});
 
console.log('Initialize Client');

client.initialize();	
console.log('Get QR');
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
  const Userid = msg.author;
  const ChatId = msg.from.endsWith('@g.us') ? msg.from : null;
  const isAuthorizedUser = msg.from === authorizedUserPhoneNumber;
  console.log(`Message received on channel ${ChatId} and from ${Userid}`);
  console.log(msg);
  // Alleen antwoorden in eCI groupchat
  if (ChatId === eCIID) {
    if (msg.body == '!top5') {
      const getScoresWithNicknames = await getTopScoresWithNicknames();
      if (getScoresWithNicknames.length > 0) {
        const scoreMessage = getScoresWithNicknames
          .map(({ nickname, score }) => `${nickname}: ${score}`)
          .join('\n');
        msg.reply(`Onze top 5 🥇:\n${scoreMessage}`);
      } else {
        msg.reply('No scores found.');
      }
    } else if (msg.body.startsWith('!setnickname')) {
      const nickname = msg.body.split(' ')[1]; // Extract the nickname from the message

      if (nickname) {
        const user = Userid; // Extracting the user's phone number
        updateNickname(user, nickname);
        msg.reply(`Nickname set! Your nickname is now "${nickname}".`);
      } else {
        msg.reply('Please provide a nickname after the command. For example, `!setnickname MyNickname`.');
      }
    }
	else if (msg.body.startsWith('!hallo')) {
		msg.reply(`Hallo, ik ben Esculaap! Mijn belangrijkste functie is om alle punten bij te houden. Stuur mij een privé bericht met de tekst !help voor meer informatie.`);
	}
    else if (msg.body.startsWith('!nieuw')) {
      const nickname = msg.body.split(' ')[1]; // Extract the nickname from the message

      if (nickname) {
        const user = Userid; // Extracting the user's phone number
        insertNewUser(user, nickname);
        msg.reply(`New user added! Your nickname is "${nickname}" and your score is initialized to 0.`);
      } else {
        msg.reply('Please provide a nickname after the command. For example, `!nieuw MyNickname`.');
      }
    }

	 else if (msg.body == '!setup' && isAuthorizedUser) {
      // Run the setup function when receiving !setup command in the specific group chat
      setupGroupUsers();
      msg.reply('Setup completed! All users in the group are added to the database.');
    }
	 else if (msg.body == '!listusers' && isAuthorizedUser) {
      // List all users in the database with their nickname and phone number
      listUsers(msg);
    }
      else if (msg.body.startsWith('#punten')) {
      const user = Userid; // Extracting the user's phone number
      const currentScore = await getScore(user);

      // Check if the message contains a "+" or "-" followed by a number
      const addScoreRegex = /([+-]\d+)(?:\s(.+))?/;
      const addScoreMatch = msg.body.match(addScoreRegex);

      if (addScoreMatch) {
        const scoreChange = parseInt(addScoreMatch[1]);
        const chick = addScoreMatch[2] || ''; // If no chick text is provided, use an empty string

        if (!isNaN(scoreChange)) {
          const newScore = currentScore + scoreChange;
          updateScore(user, newScore);
          logPoints(user, scoreChange, chick);
          msg.reply(`Congratulations! Your new score is ${newScore}.`);
        }
      }
	  if (msg.hasMedia) {
        const media = await msg.downloadMedia();
		const person = msg['_data']['notifyName'];
		const time = new Date(msg.timestamp * 1000).toISOString().replace(/T/, ' ').replace(/\..+/, '').split(' ')[1].replaceAll(':', '-')
		const date = new Date(msg.timestamp * 1000).toISOString().substring(0, 10);
        const folder = process.cwd() + '/img/'+ '_' + person + '/' + date + '/';
        const filename = folder + time + '_' + msg.id.id + '.' + media.mimetype.split('/')[1];
        fs.mkdirSync(folder, { recursive: true });
        fs.writeFileSync(filename, Buffer.from(media.data, 'base64').toString('binary'), 'binary');
		}
    }
  } else {
	  if (msg.body.startsWith('!help')) {
		  client.sendMessage(msg.from,'Ik ben Esculaap, ik zorg er voor dat alle punten worden bijgehouden..');
//		  const media = MessageMedia.fromFilePath('./snake.gif');
//		  client.sendMessage(msg.from,media,(sendVideoAsGif=true));
		  client.sendMessage(msg.from,'Er zijn een aantal opdrachten die ik begrijp: \n !setnickname MyNickname');	
	  }
	  else if (msg.body.startsWith('!log')){
		  const user = msg.from; // Extracting the user's phone number
		  console.log(`Getting log for user ${user}`);
		  const userPointsLog = await getPointsLogForUser(user);
		  if (userPointsLog.length > 0) {
			const logMessage = userPointsLog
				.map(({ score_change, chick, timestamp }) => `Datum: ${timestamp}, Punten: ${score_change}, Chick: ${chick}`)
				.join('\n');
				msg.reply(`Points Log:\n${logMessage}`);
			} else {
			msg.reply('No points log found.');
			}
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

async function setupGroupUsers() {
  try {
    const groupMembers = await client.getGroupMembers(specificGroupChatId);
    for (const member of groupMembers) {
      const user = member.id._serialized.replace('@c.us', ''); // Extracting the user's phone number
      const nickname = member.name || member.pushname;
      insertNewUser(user, nickname);
    }
  } catch (error) {
    console.error('Error retrieving group members:', error.message);
  }
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

function logPoints(user, scoreChange, chick) {
  db.run(
    'INSERT INTO points_log (user, score_change, chick) VALUES (?, ?, ?)',
    [user, scoreChange, chick],
    (err) => {
      if (err) {
        console.error('Error logging points:', err.message);
      } else {
        console.log(`Points logged for user ${user}. Score change: ${scoreChange}, Chick: ${chick}`);
      }
    }
  );
}

function listUsers(msg) {
  db.all('SELECT user, nickname FROM scores', (err, rows) => {
    if (err) {
      console.error('Error retrieving users:', err.message);
    } else {
      const userList = rows.map(({ user, nickname }) => `User: ${user}, Nickname: ${nickname}`).join('\n');
      msg.reply(`List of users:\n${userList}`);
    }
  });
}

function getPointsLogForUser(user) {
  return new Promise((resolve, reject) => {
    db.all('SELECT score_change, chick, timestamp FROM points_log WHERE user = ? ORDER BY timestamp', [user], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}
