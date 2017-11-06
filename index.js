const express = require('express'),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server),
    colors = require('colors'),
    cors = require('cors');

server.listen(process.env.PORT || 3005);

app.use(cors());

var link_direction = 'up';
var players = {};


io.on('connection', (socket) => {
    socket.on('game-start', (user) => {
        console.log('user has connected.');
        player = {
            player: user,
            position: {
                //x: Math.floor(Math.random() * (1920/4)+1),
                //y: Math.floor(Math.random() * (1080/4)+1)
                x: 100,
                y: 100
            },
            status: 5,
            direction: 'up',
            health: 3,
            socket_id: socket.id
            
        }
        players[user] = player;

        //emit the player status to all the clients so that they add it to their array
        io.emit('add-player', players);
    })
    socket.on('disconnect', () => {
        for (var prop in players) {
            if (players.hasOwnProperty(prop)) {
                if (players[prop].socket_id == socket.id) {
                    delete players[prop];

                    io.emit('disconnect', prop);
                }
            }
        }
    })
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

        if (players[data.player]) {
            if (data.direction == players[data.player].direction) {
                players[data.player].status++;
                players[data.player].status = players[data.player].status % 6;

                console.log('player status = ' + players[data.player].status);

                //detect a collision and get new position
                [players[data.player].position, players[data.player].collision] = detect_player_collision(data.player, players[data.player].position, data.direction);

            }
            else {
                delete players[data.player].collision
                //change the character orientation only
                console.log('changing orientation only');
                players[data.player].status = 3;
                players[data.player].direction = data.direction;

                console.log(players[data.player]);
            }
            console.log('__________________ EMITTING _________'.bold)
            console.log(players[data.player].position.x + ', ' + players[data.player].position.y);
            io.emit('position', players[data.player]);
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
            if (is_collision(sword_position, other_position, 6)) {
                players[prop].health -= 0.5;
                players[prop].position = get_position(players[prop].position, players[player].direction, false, true);

                io.emit('collision', {
                    username: prop,
                    player: players[prop]
                });
            }
        }
    }

}

function is_collision(pos1, pos2, tolerance = 5) {
    return Math.abs(pos1.x-pos2.x) < tolerance && Math.abs(pos1.y-pos2.y) < tolerance;
}

function detect_player_collision(player, position, direction) {
    var your_position;


    your_position = get_position(position, direction);


    console.log((position.x + ', ' + position.y).red);
    console.log((your_position.x + ', ' + your_position.y).green);

    for (var prop in players) {

        if (players.hasOwnProperty(prop) && prop != player) {
            var other_position = players[prop].position;

            if (is_collision(your_position, other_position)) {
                console.log('collision detected, pushing link back');
                your_position = get_position(position, direction, true);

                players[player].health -= 0.5;
                players[prop].health -= 0.5;

                players[prop].position = get_position(other_position, direction, false, true);

                io.emit('collision', { 
                    username: prop,
                    player: players[prop]
                });

                return [your_position, true];
            }
        }
    }

    console.log('returning new position');

    return [your_position, false];
}

function get_position(position, direction, detect_collision = false, is_opponent_collision = false) {
    var return_position;

    //used for detecting sword collisions, since it uses the same code as getting the normal position, except displace a little more
    //hope this makes sense to future self
    var displacement = is_opponent_collision ? 3 : 1;

    switch(direction) {
        case 'up':
            return_position = {
                x: position.x,
                y: detect_collision ? position.y+3 : position.y-displacement,
            };
        break;
        case 'down':

            return_position = {
                x: position.x,
                y: detect_collision ? position.y-3 : position.y+displacement,
            };
            

        break;
        case 'left':

            return_position = {
                x: detect_collision ? position.x+3 : position.x-displacement,
                y: position.y
            };   
            

        break;
        case 'right':

            return_position = {
                x: detect_collision ? position.x-3 : position.x+displacement,
                y: position.y
            }; 
            
            
        break;
    }

    return return_position;
}


