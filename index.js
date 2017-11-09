const express = require('express'),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server),
    colors = require('colors'),
    MongoClient = require('mongodb').MongoClient,
    cors = require('cors');

server.listen(process.env.PORT || 3005);

app.use(cors());



var link_direction = 'up';
var players = {};


io.on('connection', (socket) => {
    socket.on('game-start', (user) => {
        console.log('user has connected.');

        //get user from mongodb if they exist
        find_player(user, (player) => {
            if (player) {
                players[user] = player;
                players[user].socket_id = socket.id;
            }
            else {
                //use the default player settings, this is a new player
                var player = {
                    player: user,
                    position: {
                        x: 11,
                        y: 11
                    },
                    status: 5,
                    direction: 'up',
                    health: 3,
                    max_health: 3,
                    socket_id: socket.id   
                }

                players[user] = player;
            }
            
            //emit the player status to all the clients so that they add it to their array
            io.emit('add-player', players);
        })

        
        
    })
    socket.on('disconnect', () => {
        for (var prop in players) {
            if (players.hasOwnProperty(prop)) {
                if (players[prop].socket_id == socket.id) {
                    
                    savePlayerInfo(prop, () => { 
                        delete players[prop];
                        io.emit('disconnect', prop);
                    });
                }
            }
        }
    });

    socket.on('charge-sword', (player) => {
        socket.broadcast.emit('charge-sword', player);
    });

    socket.on('player-message', (message) => {

    });

    socket.on('use-sword', (player) => {
        //detect a collision, see if you hit anybody, if so, emit a collision to that person
        if (players[player]) {
            detect_sword_collision(player);
            socket.broadcast.emit('use-sword', player)
        }
    })

    socket.on('move-link', (data) => {

        console.log('received move-link event, data = ');
        console.log(data);

        if (data.charging_sword != undefined) {
            players[data.player].charging_sword = data.charging_sword;
        }

        if (players[data.player]) {
            if (data.direction == players[data.player].direction) {
                players[data.player].status++;
                players[data.player].status = players[data.player].status % 6;

                //detect a collision and get new position for player
                detect_player_collision(data.player, data.direction);
            }
            else {
                delete players[data.player].collision
                //change the character orientation only
                console.log('changing orientation only');
                players[data.player].status = 3;
                players[data.player].direction = data.direction;
            }


            if (players[data.player]) {
                //if the player is still alive and no collisions occured then emit new position

                //change the direction of link to one of the four directions if it's a diagonal. we can just check if the prefix is "north" or "south"

                io.emit('position', players[data.player]);
            }
        }
    })
})


function detect_sword_collision(player) {
    var your_position = players[player].position;

    var sword_position = get_position(your_position, players[player].direction);

    console.log(sword_position);
    console.log('the above and below better be '.bold + "different".rainbow.bold)
    console.log(players[player].position);


    for (var prop in players) {
        if (players.hasOwnProperty(prop) && prop != player) {
            var other_position = players[prop].position;
            if (is_collision(sword_position, other_position, 25)) {
                players[prop].health -= 0.5;

                if (players[prop].health <= 0.0) {
                    
                    console.log('prop = ' + prop + ", should be a-cool-girl");
                    

                    reset_player_stats(prop);

                    var username = prop;

                    savePlayerInfo(username, () => {
                        delete players[username];
                        io.emit('player_death', username);
                    });
                }
                else {
                    players[prop].position = get_position(players[prop].position, players[player].direction, false, true);

                    io.emit('collision', {
                        username: prop,
                        player: players[prop]
                    });    
                }


                
            }
        }
    }

}

function is_collision(pos1, pos2, tolerance = 15) {
    return Math.abs(pos1.x-pos2.x) < tolerance && Math.abs(pos1.y-pos2.y) < tolerance;
}

function savePlayerInfo(player, callback) {
    console.log("saving player info for " + player);
    //first check to make sure that the user exists in DB. if it does, then do an update, otherwise, insert
    if (players[player]) {
        if (players[player].socket_id) {
            delete players[player].socket_id;
        }
        if (players[player].collision) {
            delete players[player].collision
        }
        connect_db((db) => {
            db.collection('players').find({
                'player': player
            })
            .toArray((err, players) => {
                console.log(players);
                if (players.length) {
                    //do an update
                    console.log("updating player....");
                    updatePlayer(db, player, (results) => { 
                        //console.log(results);
                        callback();
                    });
                }
                else {
                    console.log("inserting player....");
                    insertPlayer(db, player, (results) => {
                        //console.log(results);
                        callback();
                    });
                }
            })
        })
    }
}

function updatePlayer(db, player, callback) {
    db.collection('players').update({
        player: player
    }, { 
        $set: players[player]
    }, (err, results) => {
        if (err) {
            console.log(err);

            callback(err);
        }
        else {
            callback(results)
        }
    });
}

function insertPlayer(db, player, callback) {
    db.collection('players').insert(players[player], (err, results) => {
        if (err) {
            callback(err);
        }
        else {
            callback(results);
        }
    })
}


function connect_db(callback) {
    MongoClient.connect(process.env.NODE_DATABASE_URL, function(err, db) {
        if (!err) {
            console.log('connected to database successfully')
            callback(db);
        } 
        else  {
            console.log(err)
        }
    })

}

function find_player(player, callback) {
    connect_db((db) => {
        db.collection('players').find({ 'player': player})
        .toArray((err, players) => {
            callback(players[0]);
        })
    })
}

function detect_player_collision(player, direction) {
    var your_position;

    var collision = false;


    your_position = get_position(players[player].position, direction);


    console.log((players[player].position.x + ', ' + players[player].position.y).red);
    console.log((your_position.x + ', ' + your_position.y).green);

    for (var prop in players) {

        if (players.hasOwnProperty(prop) && prop != player) {
            var other_position = players[prop].position;

            if (is_collision(your_position, other_position)) {
                collision = true;
                players[player].health -= 0.5;
                players[prop].health -= 0.5;

                if (players[prop].health <= 0.0) {
                    
                    
                    //reset position and health to defaults since person died
                    reset_player_stats(prop);

                    console.log('prop = ' + prop + "(should be groovy-comrade)"); 

                    savePlayerInfo(prop, () => { 
                        delete players[prop]
                        io.emit('player_death', prop);
                    });
                }
                else {
                    players[prop].position = get_position(other_position, direction, false, true);

                    io.emit('collision', { 
                        username: prop,
                        player: players[prop]
                    });
                }

                if (players[player].health <= 0.0) {
                    console.log('player died, emitting death event');
                    
                    

                    reset_player_stats(player);

                    savePlayerInfo(player, () => { 
                        delete players[player];
                        io.emit('player_death', player);
                    });
                }
                else {
                    console.log('collision detected, pushing link back');
                    players[player].position = get_position(players[player].position, direction, true);
                    players[player].collision = true;
                }
                break;
            }
        }
    }

    console.log('returning new position');
    if (!collision) {
        delete players[player].collision;
        players[player].position = your_position;
    }
    
}

function reset_player_stats(player) {
    //reset position and health to defaults since person died
    players[player].health = players[player].max_health;
    players[player].position.x = 100;
    players[player].position.y = 100;
    delete players[player].collision;
}

function get_position(position, direction, detect_collision = false, is_opponent_collision = false) {
    var return_position;

    //used for detecting sword collisions, since it uses the same code as getting the normal position, except displace a little more
    //hope this makes sense to future self
    var displacement = is_opponent_collision ? 6 : 1;

    switch(direction) {
        case 'up':
            return_position = {
                x: position.x,
                y: detect_collision ? position.y+6 : position.y-displacement,
            };
        break;
        case 'down':

            return_position = {
                x: position.x,
                y: detect_collision ? position.y-6 : position.y+displacement,
            };
            

        break;
        case 'left':

            return_position = {
                x: detect_collision ? position.x+6 : position.x-displacement,
                y: position.y
            };   
            

        break;
        case 'right':

            return_position = {
                x: detect_collision ? position.x-6 : position.x+displacement,
                y: position.y
            };   
        break;
        case 'northwest':
            console.log('northwest detected');
            return_position = {
                x: detect_collision ? position.x+6 : position.x-displacement,
                y: detect_collision ? position.y+6 : position.y-displacement
            }

        break;
        case 'northeast':
            return_position = {
                x: detect_collision ? position.x-6 : position.x+displacement,
                y: detect_collision ? position.y+6 : position.y-displacement
            }

        break;
        case 'southwest':
            return_position = {
                x: detect_collision ? position.x+6 : position.x-displacement,
                y: detect_collision ? position.y-6 : position.y+displacement
            }
        break;
        case 'southeast':
            return_position = {
                x: detect_collision ? position.x-6 : position.x+displacement,
                y: detect_collision ? position.y-6 : position.y+displacement
            }
        break;
    }

    return return_position;
}


