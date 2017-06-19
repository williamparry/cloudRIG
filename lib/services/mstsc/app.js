/* Portions of this file
 *
 * Copyright (c) 2015 Sylvain Peyrefitte
 *
 * This file is part of mstsc.js.
 *
 * mstsc.js is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

var express = require('express');
var http = require('http');
var rdp = require('node-rdpjs');
var argv = require("yargs").argv;
var app = express();

app.use(express.static(__dirname + '/client'));

var server = http.createServer(app).listen(process.env.PORT || 8080, function() {
    
    // Sent back to rdp.js
    console.log("[STARTED]");

    var io = require('socket.io')(server);

    io.on('connection', function(client) {

        var rdpClient = null;

        client.on('infos', function (infos) {

            if (rdpClient) {
                // clean older connection
                rdpClient.close();
            }
            
            rdpClient = rdp.createClient({

                domain : "./", 
                userName : "administrator",
                password : argv.password,
                enablePerf : true,
                autoLogin : true,
                screen : infos.screen,
                locale : infos.locale,
                logLevel : 'ERROR'

            }).on('connect', function () {

                client.emit('rdp-connect');

            }).on('bitmap', function(bitmap) {

                client.emit('rdp-bitmap', bitmap);

            }).on('close', function() {

                client.emit('rdp-close');
                
            }).on('error', function(err) {

                client.emit('rdp-error', err);

            }).connect(argv.publicDNS, infos.port);

        }).on('mouse', function (x, y, button, isPressed) {

            if (!rdpClient)  return;

            rdpClient.sendPointerEvent(x, y, button, isPressed);

        }).on('wheel', function (x, y, step, isNegative, isHorizontal) {

            if (!rdpClient) {
                return;
            }

            rdpClient.sendWheelEvent(x, y, step, isNegative, isHorizontal);

        }).on('scancode', function (code, isPressed) {

            if (!rdpClient) return;

            rdpClient.sendKeyEventScancode(code, isPressed);

        }).on('unicode', function (code, isPressed) {

            if (!rdpClient) return;

            rdpClient.sendKeyEventUnicode(code, isPressed);

        }).on('disconnect', function() {

            rdpClient.close();
            process.exit();

        });

    });

});