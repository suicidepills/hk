define([
    'phaser',
    'rot',
    'settings',
    'combat-floater'
], function (Phaser, ROT, Settings, CombatFloater) { 
    'use strict';

    // Private vars.
    var game;

    function Entity (_game, x, y, key) {    
        game = _game;

        Phaser.Sprite.call(this, game, x, y, key);

        // A hash of tiles that the monster can see.
        this._visibleTiles = {};

        // The tile that the entity is currently on.
        this.tile = null;

        // Movement tween.
        this.movementTween = null;

        // Identifying information
        this.name = 'Entity';
        // A list of 'types' or words describing this entity.  Example: 'monster', 'door';
        this.tags = {
            passable: true
        }; 
        
        // Stats
        this.health = 100;
        this.maxHealth = this.health;

        // Display combat results as floating text above this entity.
        this.combatFloater = new CombatFloater(game, 0, 0);
        this.addChild(this.combatFloater);

        // Cached reference to map (Phaser.TileMap instance)
        this.level = null;

        // Cached reference to other monsters on the level (Phaser.Group instance)
        this._monsters = null;

        // A Line instance representing the LoS between me and something I'm 
        // trying to see.
        this._losLine = new Phaser.Line();

        // Signals.
        this.events.onMove = new Phaser.Signal();
        this.events.onTeleport = new Phaser.Signal();
        this.events.onAttack = new Phaser.Signal();
        this.events.onDamage = new Phaser.Signal();
        this.events.onDie = new Phaser.Signal();
        this.events.onSee = new Phaser.Signal();
        this.events.onUnsee = new Phaser.Signal();
    }

    Entity.prototype = Object.create(Phaser.Sprite.prototype);
    Entity.prototype.constructor = Entity;

    Entity.prototype.setLevel = function (level) {
        this.level = level;
    };

    Entity.prototype.show = function () {
        if(this.visibilityTween) {
            this.visibilityTween.stop();
        }
        this.visibilityTween = game.add.tween(this);
        this.visibilityTween.to({alpha: 1}, 100, 'Linear', true);
    };

    Entity.prototype.hide = function () {
        if(this.visibilityTween) {
            this.visibilityTween.stop();
        }
        this.visibilityTween = game.add.tween(this);
        this.visibilityTween.to({alpha: 0}, 100, 'Linear', true);
    };
    
    Entity.prototype.canSee = function (target) {
        if(!this.level) return false;
        var los = this._losLine;
        if(arguments.length > 1) {
            los.start.x = this.x;
            los.start.y = this.y;
            los.end.x = arguments[0];
            los.end.y = arguments[1];
        } else {
            los.start.x = this.x;
            los.start.y = this.y;
            los.end.x = target.x;
            los.end.y = target.y;
        }

        //  Use target centers.
        los.start.x += this.level.tileWidth / 2;
        los.start.y += this.level.tileHeight / 2;
        los.end.x += this.level.tileWidth / 2;
        los.end.y += this.level.tileHeight / 2;

        var path = this.level.terrain.getRayCastTiles(los, 4, true);
        if(path.length) return false;
        return true;
    };

    Entity.prototype.moveToward = function (target) {
        var targetPos = new Phaser.Point(),
            slope = new Phaser.Point(),
            targetDir = new Phaser.Point();
        // Given coords instead of target object.
        if(arguments.length > 1) {
            targetPos.x = arguments[0];
            targetPos.y = arguments[1];
        } else {
            // Attempt to use tile property if available.
            targetPos.x = target.tile ? target.tile.x : target.x;
            targetPos.y = target.tile ? target.tile.y : target.y;
        }

        // Calculate slope.
        Phaser.Point.subtract(targetPos, this.tile, slope);
        Phaser.Point.normalize(slope, slope);

        targetDir.x = Math.round(slope.x);
        targetDir.y = Math.round(slope.y);

        var hasMoved;

        // Attempt to move to next position.
        hasMoved = this.move(targetDir);

        // If we couldn't move to our ideal spot, let's find the next best thing.
        // Let's try moving horizontally first.
        if(!hasMoved && slope.x) {
            targetDir.x = Phaser.Math.sign(slope.x);
            targetDir.y = 0;
            hasMoved = this.move(targetDir);
        }

        // Failing that, let's try vertically.
        if(!hasMoved && slope.y) {
            targetDir.x = 0;
            targetDir.y = Phaser.Math.sign(slope.y);
            hasMoved = this.move(targetDir);
        }

        // What about diagonally?
        if(!hasMoved && !slope.x) {
            targetDir.x = 1;
            targetDir.y = Phaser.Math.sign(slope.y);
            hasMoved = this.move(targetDir);
        }
        if(!hasMoved && !slope.x) {
            targetDir.x = -1;
            targetDir.y = Phaser.Math.sign(slope.y);
            hasMoved = this.move(targetDir);
        }
        if(!hasMoved && !slope.y) {
            targetDir.x = Phaser.Math.sign(slope.x);
            targetDir.y = 1;
            hasMoved = this.move(targetDir);
        }
        if(!hasMoved && !slope.y) {
            targetDir.x = Phaser.Math.sign(slope.x);
            targetDir.y = -1;
            hasMoved = this.move(targetDir);
        }
    };
    
    Entity.prototype.updateVision = function () {};

    Entity.prototype.defend = function (victim) {
        // Always fail for now.
        return false;
    };

    Entity.prototype.takeDamage = function (amount, attacker) {
        // Take damage.
        this.health -= amount;

        // Let listeners know that we got a boo-boo :(
        this.events.onDamage.dispatch(this, amount, attacker);

        // Put it in the log.
        console.log(this.name, '[', this.health, '] takes ', amount, ' damage from ', attacker.name, '[', attacker.health, ']');

        // Did we die yet?
        if(this.health<=0) this.die();
    };

    Entity.prototype.die = function () {
        // Let listeners know
        this.events.onDie.dispatch(this);

        // Put it in the log.
        console.log(this.name, ' dies.');
        
        // Aaaaand die.
        this.kill();
    };

    Entity.prototype.move = function (direction, skipAnimation) {
        var newTileX = this.tile.x + direction.x,
            newTileY = this.tile.y + direction.y;

        // If this entity is impassable, let's do some collision detection.
        if(!this.tags.passable) {
            // See if door is blocking the way.
            var door = this.level.containsDoor(newTileX, newTileY);
            if(door && !door.isOpen) {
                door.open();
                return true;
            }

            // See if another monster is blocking the way.
            var monster = this.level.containsMonster(newTileX, newTileY);
            if(monster && monster.tags.passable === false) {
                // If they are, do we want to fight them?
                if(this.reactTo(monster) === 0) {
                    var toHitRoll = this.rollToHitMelee();
                    if(!monster.defend(toHitRoll)) {
                        monster.takeDamage(this.rollForDamage(), this);
                    } else {
                        this.combatFloater.miss();
                        console.log(this.name, ' attacks ', monster.name, 'but misses.');
                    }
                    return true;
                } else {
                    return false;
                }
            }

            // We can't move there if the player is already there.
            if(game.level.containsPlayer(newTileX, newTileY)) return false;
            
            // Do not continue if terrain impassable.
            if(!this.level.isPassable(newTileX, newTileY)) return false;
        }

        var oldTile = this.tile,
            oldTileX = this.tile.x,
            oldTileY = this.tile.y,
            oldX = this.x,
            oldY = this.y,
            newTile = this.level.getTile(newTileX, newTileY);
        
        // Update tile reference (if the new tile exists).
        if(!newTile) {
            return false;
        }

        // If I was on a tile previously, remove me from it.
        if(this.tile) this.tile.remove(this);

        // ...and then add me to the new tile.
        this.tile = newTile;
        this.tile.add(this);

        if(!skipAnimation) {
            this.movementTween = game.add.tween(this);
            this.movementTween.to({
                x: (this.tile.x * this.level.tileWidth),
                y: (this.tile.y * this.level.tileHeight)
            }, Settings.turnPause, null, true);
        } else {
            this.x += (direction.x * this.level.tileWidth);
            this.y += (direction.y * this.level.tileHeight);
        }
        this.events.onMove.dispatch(this, oldTile, this.tile);
        return true;
    };

    Entity.prototype.teleport = function (x, y) {

        if(this.level && this.level.isPassable(x, y)) {
            if(this.tile) this.tile.remove(this);
            this.tile = this.level.getTile(x, y);
            this.tile.add(this);
            this.x = x * this.level.tileWidth;
            this.y = y * this.level.tileHeight;
            return true;
        }
        return false;
    };

    return Entity;
});