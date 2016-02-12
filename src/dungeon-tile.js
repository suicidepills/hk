define([
    'phaser',
    'rot', 
], function (Phaser, ROT, StateMachine) { 
    'use strict';

    // Private vars.
    var game;

    function DungeonTile (layer, type, x, y, width, height) {    
        game = layer.game;

        Phaser.Tile.call(this, layer, type, x, y, width, height);

        this.contents = [];

        // Signals

    }

    DungeonTile.prototype = Object.create(Phaser.Tile.prototype);
    DungeonTile.prototype.constructor = DungeonTile;

    DungeonTile.prototype.add = function (entity) {
        var index = this.contents.indexOf(entity);
        if(index === -1) {
            if(this.alpha === 1) entity.show();
            else entity.hide();
            this.contents.push(entity);

            // If this tile contains an impassable object, then it is impassable.
            //if(entity.tags.passable) this.setCollision(false, false, false, false);
            //else this.setCollision(true, true, true, true);
        }
    };

    DungeonTile.prototype.remove = function (entity) {
        var index = this.contents.indexOf(entity);
        if(index !== -1) this.contents.splice(index, 1);
        // if(this.length === 0) this.setCollision(false, false, false, false);
    };

    DungeonTile.prototype.contains = function (entity) {
        for(var i=0; i<this.contents.length-1; i++) {
            if(this.contents[i] === entity) return true;
        }
        return false;
    };

    DungeonTile.prototype.containsType = function (type) {
        for(var i=0; i<this.contents.length-1; i++) {
            if(this.contents[i].tags[type]) return true;
        }
        return false;
    };

    DungeonTile.prototype.getAll = function (type, output) {
        output = output || [];
        for(var i=0; i<this.contents.length-1; i++) {
            if(this.contents[i].tags[type]) output.push(this.contents[i]);
        }
        return output;
    };

    DungeonTile.prototype.hide = function () {
        this.alpha = 0.5;
        for(var i=0; i<this.contents.length; i++) {
            this.contents[i].hide();
        }
    };

    DungeonTile.prototype.show = function () {
        this.alpha = 1;
        for(var i=0; i<this.contents.length; i++) {
            this.contents[i].show();
        }
    };

    return DungeonTile;
});