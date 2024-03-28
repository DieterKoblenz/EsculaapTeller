console.error('Starting the Esculaap app. V3.');
const fs = require('fs');
const { Client, LocalAuth, MessageMedia  } = require('whatsapp-web.js');
const sqlite3 = require('sqlite3').verbose();
const qrcode = require('qrcode-terminal');
const path = require('path');
const { readdirSync, readFileSync } = require('fs');
const { join, extname, basename } = require('path');

console.log('Setting environment.');
const groupID = '31625210135-1327525773@g.us';
const debugID = '120363162802059783@g.us'; 
console.log('Group chosen: ', groupID);
//const adminID = process.env.ESADMIN;
const adminID = '31625210135@c.us';
console.log('Admin chosen: ', adminID);
//eCI: 31625210135-1327525773@g.us

console.log('Hello ' + process.env.NAME);

// Create or open the SQLite database
const db = new sqlite3.Database('scores.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the scores database.');
    // Create a table to store scores if it doesn't exist
//    db.run(`
//      CREATE TABLE IF NOT EXISTS scores (
//        id INTEGER PRIMARY KEY AUTOINCREMENT,
//        user TEXT NOT NULL,
//		nickname TEXT,
//        score INTEGER NOT NULL
//      )
//    `);
//    db.run(`
//      CREATE TABLE IF NOT EXISTS points_log (
//        id INTEGER PRIMARY KEY AUTOINCREMENT,
//        user TEXT NOT NULL,
//        score_change INTEGER NOT NULL,
//        chick TEXT,
//        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
//     )
//    `);
  }
});

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox']},
    webVersion: '2.2409.2',
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2409.2.html'
    }
	
});
 
console.log('Initialize Client');

client.initialize();	
console.log('Get QR');
client.on('qr', qr => {
	console.error('QR:');
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
  const text = "Escualap is geladen en klaar voor gebruik ðŸ”«. ";
  client.sendMessage(adminID, text);
  client.sendMessage(debugID, text);
//  client.sendMessage(groupID, text);
});

client.on('message', async (msg) => {
  
  const UserId = msg.author;
  const ChatId = msg.from.endsWith('@g.us') ? msg.from : null;
  const PrivateId = msg.from.endsWith('@c.us') ? msg.from : null;
  const Person = msg['_data']['notifyName'];

  console.log(`User: `, UserId);
  console.log(`Chat: `, ChatId);
  console.log(`Group: `, PrivateId);
  console.log(`Notify: `, Person);
  
  if (ChatId === null){
	  console.log(`Message coming from private chat`);	 		// Public Admin Commands
	  if (msg.body.startsWith('!setnickname')) {
		const nickname = msg.body.split(' ')[1]; // Extract the nickname from the message
		if (nickname) {
			const user = PrivateId; // Extracting the user's phone number
			updateNickname(user, nickname);
			msg.reply(`Nickname aangepast! Je nickname is nu "${nickname}".`);
			} else {
			msg.reply('Please provide a nickname after the command. For example, `!setnickname MyNickname`.');
			}
		} else if (msg.body.startsWith('!log')){
		  const user = msg.from; // Extracting the user's phone number
		  console.log(`Getting log for user ${user}`);
		  const userPointsLog = await getPointsLogForUser(user);
		  if (userPointsLog.length > 0) {
			const logMessage = userPointsLog
				.map(({ score_change, chick, timestamp }) => `Datum: ${timestamp}, Punten: ${score_change}, Chick: ${chick}`)
				.join('\n');
				msg.reply(`Punten logboek:\n${logMessage}`);
			} else {
			msg.reply('No points log found.');
			}
	  } else if (msg.body.startsWith('!setscore')) {
  const score = parseInt(msg.body.split(' ')[1]); // Extract the score from the message
  if (isNaN(score)) {
    msg.reply('Geef het aantal punten dat je nu al hebt. Voorbeeld, `!setscore 10`. Je kan dit Ã©Ã©n keer doen.');
  } else {
    const user = msg.from; // Extracting the user's phone number
    setInitialScore(user, score)
      .then(message => {
        msg.reply(message);
      })
      .catch(err => {
        console.error(err);
        msg.reply('Fout.');
      });
  }
} else if (msg.body.startsWith('!help')){
		  client.sendMessage(msg.from,'Ik ben Esculaap, ik zorg er voor dat alle punten worden bijgehouden..');
		  //const media = MessageMedia.fromFilePath('./snake.mp4');
		  //client.sendMessage(msg.from,media,(sendVideoAsGif=true));
		  client.sendMessage(msg.from,'Er zijn een aantal opdrachten die ik begrijp: \n !setnickname NieuweNaam (Let op, alleen een enkele naam zonder spaties of speciale tekens \n !log (Je krijgt nu alle persoonlijke wijzigingen te zien. Dit is privÃ© voor jou.) \n !help (Dit bericht...)\n !setscore Score (Stel eenmalig je huidige punten aantal in.)');	
		  client.sendMessage(msg.from,'Gebruik van Esculaap is veilig. Alle gegevens zijn enkel via Whatsapp te benaderen en blijven in de groep.');client.sendMessage(msg.from,'Stuur voor eventuele handmatige correcties een bericht naar Jeroen.');	
	  }
	  if(PrivateId === adminID){								// Private Admin Commands
		  console.log(`Privtae message from my owner`);	
	 if (msg.body == '!setup') {
			// Run the setup function when receiving !setup command in the specific group chat
			setupGroupUsers();
			msg.reply('Setup completed! All users in the group are added to the database.');
			}  else if (msg.body.startsWith('!backupdb')) {
    const srcPath = path.join(__dirname, 'scores.db');
    const destPath = path.join(__dirname, 'scores_backup.db');

    // Create a copy of the database file
    fs.copyFile(srcPath, destPath, (err) => {
      if (err) {
        console.error('Error copying database file:', err);
        return;
      }

      console.log('Database file copied successfully');

      // Read the copied database file
      fs.readFile(destPath, (err, data) => {
        if (err) {
          console.error('Error reading copied database file:', err);
          return;
        }

        // Create a media message with the copied database file
        const media = new MessageMedia('application/octet-stream', data.toString('base64'), 'scores_backup.db');

        // Send the media message to the admin
        client.sendMessage(adminID, media)
          .then(() => {
            console.log('Backup database file sent to the admin');
          })
          .catch((err) => {
            console.error('Error sending backup database file to the admin:', err);
          });
      });
    });
  } else if (msg.body.startsWith('!hallo')) {
		console.log(`Hallo`);  
		const text1 = `Hallo eCI, ik ben Esculaap! Mijn belangrijkste functie is om alle Gouden Fallus punten bij te houden. Stuur mij een privÃ© bericht met de tekst !help voor meer informatie. Om je score bij te werken stuur je naar de groepsapp "#punten +/-X naamchick" \n Voorbeeld: #punten +5 linda jansen \n Negatieve punten zijn enkel om correcties door te voeren.`;
		client.sendMessage(groupID, text1);
		const text2 = `Je kunt mij een privÃ© bericht sturen om je naam (!setnickname <naam>) en het aantal punten dat je nu hebt in te stellen (!setscore <aantal punten>).`;
		client.sendMessage(groupID, text2);
				const text3 = `Iedereen kan de !top5 inzien, door !top5 te sturen naar het kanaal.`;
		client.sendMessage(groupID, text3);
// #punten		
	  }  else if (msg.body == '!listusers') {
				console.log("List users");
        listUsers(msg);
      } else if (msg.body == '!clear'){
        deleteAllUsers();
		clearScoreChangeLog();
		const text = "Alle gebruikers en logboek berichten zijn verwijderd.";
		client.sendMessage(debugID, text);
      } 
	  }
  } else if (ChatId !== null){
	  console.log(`Message received on channel ${ChatId} and from ${UserId}`);
  } if (ChatId  === groupID){
	  console.log(`Message was posted in my group channel`);
	  console.log(msg.body);
	  if (msg.body == '!top5') { // TOP 5
	    console.log(`Top 5`);
		const getScoresWithNicknames = await getTopScoresWithNicknames();
		if (getScoresWithNicknames.length > 0) {
			const scoreMessage = getScoresWithNicknames
			.map(({ nickname, score }) => `${nickname}: ${score}`)
			.join('\n');
			client.sendMessage(groupID,`Onze top 5 ðŸ¥‡:\n${scoreMessage}`);
		} else {
			client.sendMessage(groupID,`Geen scores gevonden.`);
		}
// !hallo		
	  } else if (msg.body.startsWith('#punten')) {
      const user = UserId; // Extracting the user's phone number
      console.log(`Punten`);
      console.log(user);
      const currentScore = await getScore(user);

      // Check if the message contains a "+" or "-" followed by a number
      const addScoreRegex = /([+-]\d+)(?:\s(.+))?/;
      const addScoreMatch = msg.body.match(addScoreRegex);

      if (addScoreMatch) {
        const scoreChange = parseInt(addScoreMatch[1]);
        const chick = addScoreMatch[2] || ''; // If no chick text is provided, use an empty string

        if (!isNaN(scoreChange) && scoreChange >= -5 && scoreChange <= 5 && Number.isInteger(scoreChange) && scoreChange != 0) {
          const newScore = currentScore + scoreChange;
          updateScore(user, newScore);
          logPoints(user, scoreChange, chick);
		  if (scoreChange >= 0){
			  msg.reply(`Gefeliciteerd ðŸ’ª! Je nieuwe score is ${newScore}.`);
		  } else if (scoreChange <= 0){
			  msg.reply(`Faalhaas! Je nieuwe score is ${newScore}.`);
		  }
          	  if (msg.hasMedia) {
        const media = await msg.downloadMedia();
		const person = msg['_data']['notifyName'];
		const time = new Date(msg.timestamp * 1000).toISOString().replace(/T/, ' ').replace(/\..+/, '').split(' ')[1].replace(/:/g, '-');
		const date = new Date(msg.timestamp * 1000).toISOString().substring(0, 10);
        const folder = process.cwd() + '/img/'+ '_' + person + '/' + date + '/';
        const filename = folder + time + '_' + msg.id.id + '.' + media.mimetype.split('/')[1];
        fs.mkdirSync(folder, { recursive: true });
        fs.writeFileSync(filename, Buffer.from(media.data, 'base64').toString('binary'), 'binary');
		}
        } else {
          msg.reply('Faalhaas: Je kan enkel hele punten geven tot maximaal 5.');
        }
      } else {
		  msg.reply('Faalhaas: Snap je wel hoe het werkt? Voorbeeld: #punten +1 Janna');
	  }
    } else if (msg.body.startsWith('!setnickname')) {
		const nickname = msg.body.split(' ')[1]; // Extract the nickname from the message
		if (nickname) {
			const user = UserId; // Extracting the user's phone number
			updateNickname(user, nickname);
			msg.reply(`Nickname aangepast! Je nickname is nu "${nickname}".`);
			} else {
			msg.reply('Please provide a nickname after the command. For example, `!setnickname MyNickname`.');
			}
		}
  }
	  if (UserId === adminID){
		  console.log(`Group message from my owner`);
		  if (msg.body == '!setup') {
			// Run the setup function when receiving !setup command in the specific group chat
			setupGroupUsers();
			msg.reply('Setup completed! All users in the group are added to the database.');
			}  else if (msg.body == '!debug') {
        console.log(`TBD`);
      } else   if (msg.body === '!chicks') {
    const baseDir = join(__dirname, 'img');

    // Recursive function to get all image file paths
    function getImageFilePaths(dir) {
      let filePaths = [];
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          filePaths = [...filePaths, ...getImageFilePaths(join(dir, entry.name))];
        } else if (['.jpg', '.jpeg', '.png', '.gif'].includes(extname(entry.name).toLowerCase())) {
          filePaths.push(join(dir, entry.name));
        }
      }

      return filePaths;
    }

    // Get all image file paths
    const imageFilePaths = getImageFilePaths(baseDir);

    // Send each image file to the group
    for (const filePath of imageFilePaths) {
      const data = readFileSync(filePath);
      const media = new MessageMedia('image/jpeg', data.toString('base64'), basename(filePath));

      client.sendMessage(ChatId, media)
        .catch((err) => {
          console.error(`Error sending image file ${filePath} to the group:`, err);
        });
    }
  }
	  } // Einde admin
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
    const chat = await client.getChatById(groupID);
    const groupMembers = chat.participants;
    for (const member of groupMembers) {
      //const user = member.id._serialized.replace('@c.us', ''); // Extracting the user's phone number
      const user = member.id._serialized; // Extracting the user's phone number
      console.log(user);
      const nickname = member.name || member.pushname;
      if (user !== '31853016180@c.us') { // Only insert new user if it's not this specific user
        insertNewUser(user, nickname);
      }
      
    }
  } catch (error) {
    console.error('Error retrieving group members:', error.message);
  }
}

function deleteAllUsers() {
  db.run('DELETE FROM scores', (err) => {
    if (err) {
      console.error('Error deleting all users:', err.message);
    } else {
      console.log('All users deleted.');
    }
  });
}

function clearScoreChangeLog() {
  db.run('DELETE FROM points_log', (err) => {
    if (err) {
      console.error('Error clearing score change log:', err.message);
    } else {
      console.log('Score change log cleared.');
    }
  });
}


function insertNewUser(user, nickname) {
  // First, check if the user exists in the database
  db.get('SELECT * FROM scores WHERE user = ?', user, (err, row) => {
    if (err) {
      console.error('Error querying user:', err.message);
      return;
    }

    if (row) {
      // The user already exists, log a message and do nothing
      console.log(`User already exists. User: ${user}, Nickname: ${nickname}`);
    } else {
      // The user doesn't exist, insert them into the database
      db.run('INSERT INTO scores (user, nickname, score) VALUES (?, ?, 0)', [user, nickname], (err) => {
        if (err) {
          console.error('Error inserting new user:', err.message);
        } else {
          console.log(`New user added. User: ${user}, Nickname: ${nickname}`);
        }
      });
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

// Function to close the database connection
function closeDbAndExit() {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0); // Exit the process
  });
}

// Close the database connection and exit the process on 'SIGINT'
process.on('SIGINT', () => {
  console.log('Received SIGINT. Closing database connection and exiting...');
  closeDbAndExit();
});

// Close the database connection and exit the process on 'SIGTERM'
process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Closing database connection and exiting...');
  closeDbAndExit();
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
  db.all('SELECT user, nickname, score FROM scores', (err, rows) => {
    if (err) {
      console.error('Error retrieving users:', err.message);
    } else {
      console.log('User list');
      const userList = rows.map(({ user, nickname, score }) => 
        `Telefoonnummer: ${user}, Nickname: ${nickname}, Score: ${score}`).join('\n');
      console.log(userList);
      msg.reply(`We hebben de volgende helden:\n${userList}`);
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

function setInitialScore(user, score) {
  return new Promise((resolve, reject) => {
    // Check if the score is an integer and if it's greater than or equal to 0
    if (!Number.isInteger(score) || score < 0) {
      reject('Score moet een geheel getal zijn, gelijk of groter dan 0. 0 hoef je overigens niet in te stellen.');
      return;
    }

    // Check if the user exists in the database
    db.get('SELECT * FROM scores WHERE user = ?', user, (err, row) => {
      if (err) {
        reject('Error querying user:', err.message);
        return;
      }

      // Check if the user's current score is 0
      if (row && row.score !== 0) {
        resolve(`Het is niet gelukt om de score in te stellen voor ${user}. Je score is al >0.`);
        return;
      }

      // Check if there are log entries for the user
      db.get('SELECT * FROM points_log WHERE user = ?', user, (err, row) => {
        if (err) {
          reject('Error querying points log:', err.message);
          return;
        }

        if (row) {
          resolve(`Het is niet gelukt om de score in te stellen voor ${user}. Er is al een score geregistreerd.`);
          return;
        }

        // If all checks pass, set the initial score and create a log entry
        db.run('UPDATE scores SET score = (?) WHERE user = (?)', [score, user], (err) => {
          if (err) {
            reject('Error setting initial score:', err.message);
          } else {
            logPoints(user, score, 'Begin Score');
            resolve(`Top, score is ingesteld voor ${user}. Score: ${score}`);
          }
        });
      });
    });
  });
}

