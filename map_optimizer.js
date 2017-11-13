'use strict';
const fs = require('fs')


//optimizes a map for use with game-server

var json_map_file = process.argv[2];

console.log(typeof json_map_file)

console.log(json_map_file);

var map = require(json_map_file);

//all we're doing is converting the data array into a 2d array and removing any 0s that we find. so each element in the 2d array will look like this
/*
    {
        tile: the tile
        x: x position in canvas
        y: y position in canvas
    }  
    we keep the tiles the same, no conversion there
*/

var new_map = Object.assign({}, map);



var index = 0;

map.layers.forEach((layer, layer_index) => {
    var current_data = [];
    console.log(layer.data);
    for (var i = 0; i < layer.data.length; i++) {
        var tile = layer.data[i];
        if (tile == 0) {
            continue;
        }

        var y = Math.floor(i / map.width);
        var x = i - (y * map.width);

        console.log("layer_index = " + layer_index);

        current_data.push({
            tile: tile, 
            x: x*8,
            y: y*8
        });

        index++;   
    }
    new_map.layers[layer_index].data = current_data;
})

var new_filename = json_map_file.substring(0, json_map_file.lastIndexOf('.')) + '_optimized.json';

fs.writeFile(new_filename, JSON.stringify(new_map), (err) => {
    if (err) {
        console.log(err);
        return;
    }

    console.log('map file converted successfully');
})
