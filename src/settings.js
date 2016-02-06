define([
    'phaser',
    'rot'
], function (Phaser, ROT) { 
    'use strict';

    return {
        map: {
            width: 80,
            height: 40,
            tile: {
                width: 32,
                height: 32
            }
        },
        stage: {
            width: 1000,
            height: 800
        }
    };
});