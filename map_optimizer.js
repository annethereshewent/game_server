'use strict';
const fs = require('fs')


//optimizes a map for use with game-server

var json_map_file = process.argv[2];

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
    for (var i = 0; i < layer.data.length; i++) {
        var tile = layer.data[i];
        if (tile == 0) {
            continue;
        }

        var tileset_index = getTilesetIndex(tile);

        var current_tile = tile-map.tilesets[tileset_index].firstgid;

        var sprite_y = Math.floor(current_tile / map.tilesets[tileset_index].columns);
        var sprite_x = current_tile - (sprite_y * map.tilesets[tileset_index].columns);

        var canvas_y = Math.floor()

        var y = Math.floor(i / map.width);
        var x = i - (y * map.width);

        current_data.push({
            tile: tile, 
            canvas_x: x*8,
            canvas_y: y*8,
            sprite_x: sprite_x*8,
            sprite_y: sprite_y*8,
            tileset: tileset_index
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
});



function getTilesetIndex(tile) {
    for (var i = map.tilesets.length-1; i >= 0; i--) {
        if (tile >=  map.tilesets[i].firstgid) {
            return i;
        }
        if (i == 0) {
            return 0;
        }
    }
}
