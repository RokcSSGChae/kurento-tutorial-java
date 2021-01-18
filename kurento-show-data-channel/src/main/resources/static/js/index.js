/*
 * (C) Copyright 2014 Kurento (http://kurento.org/)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

var ws = new WebSocket('wss://' + location.host + '/showdatachannel');
var webRtcPeer;
var state = null;

const I_CAN_START = 0;
const I_CAN_STOP = 1;
const I_AM_STARTING = 2;

var chanId = 0;

function getChannelName () {
	return "TestChannel" + chanId++;
}

window.onload = function() {
	console = new Console();
	console.log("Page loaded ...");
	setState(I_CAN_START);
}

window.onbeforeunload = function() {
	ws.close();
}

ws.onmessage = function(message) {
	var parsedMessage = JSON.parse(message.data);
	console.info('Received message: ' + message.data);

	switch (parsedMessage.id) {
	case 'startResponse':
		startResponse(parsedMessage);
		break;
	case 'error':
		if (state == I_AM_STARTING) {
			setState(I_CAN_START);
		}
		onError("Error message from server: " + parsedMessage.message);
		break;
	case 'iceCandidate':
		webRtcPeer.addIceCandidate(parsedMessage.candidate, function(error) {
			if (error) {
				console.error("Error adding candidate: " + error);
				return;
			}
		});
		break;
	default:
		if (state == I_AM_STARTING) {
			setState(I_CAN_START);
		}
	onError('Unrecognized message', parsedMessage);
	}
}

function start() {
	console.log("Starting...")
	// Disable start button
	setState(I_AM_STARTING);

	var dataChannelSend = document.getElementById('dataChannelSend');
	var dataChannelRecv = document.getElementById('dataChannelRecv');

	var sendButton = document.getElementById('send');
	sendButton.addEventListener("click", function() {
		var data = dataChannelSend.value;
		console.log("Send button pressed. Sending data " + data);
		webRtcPeer.send(data);
		dataChannelSend.value = "";
		receive();
	});

	function onOpen(event) {
		dataChannelSend.disabled = false;
		dataChannelSend.focus();
		$('#send').attr('disabled', false);
	}

	function onClosed(event) {
		dataChannelSend.disabled = true;
		$('#send').attr('disabled', true);
	}
	
	function onMessage(event) {
		console.log("Received data " + event["data"]);
		dataChannelRecv.value = event["data"];
	}

	console.log("Creating WebRtcPeer and generating local sdp offer ...");

	var configuration = {
  		'iceServers': [{
    		'urls': 'turn:117.17.196.61:3478',
    		'username' : 'testuser',
    		'credential' : 'root',
  		}]
	};
	
	var constraints = {
  		audio: true,
  		video: false
	};

	var options = {
			dataChannels : true,
			dataChannelConfig: {
				id : getChannelName(),
				onopen : onOpen,
				onclose : onClosed,
				onmessage : onMessage
			},
			onicecandidate : onIceCandidate,
			configuration : configuration,
			mediaConstraints: constraints
	}

	webRtcPeer = new kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv(options,
			function(error) {
		if (error) {
			return console.error(error);
		}
		webRtcPeer.generateOffer(onOffer);
	});
}

function receive(){
	console.log("Receiving...")
	var dataChannelRecv = document.getElementById('dataChannelRecv');
	
	function onMessage(event) {
		console.log("Received data " + event["data"]);
		dataChannelRecv.value = event["data"];
	}
	
	var configuration = {
  		'iceServers': [{
    		'urls': 'turn:117.17.196.61:3478',
    		'username' : 'testuser',
    		'credential' : 'root',
  		}]
	};

	var options = {
			dataChannels : true,
			dataChannelConfig: {
				id : getChannelName(),
				onmessage : onMessage
			},
			onicecandidate : onIceCandidate,
			configuration : configuration
	}

	webRtcPeer = new kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options,
			function(error) {
		if (error) {
			return console.error(error);
		}
		webRtcPeer.generateOffer(onOfferReceiver);
	});
}

function onOfferReceiver(error, offerSdp) {
	if (error)
		return console.error('Error generating the offer');
	console.info('Invoking SDP offer callback function ' + location.host);
	var message = {
		id : 'receive',
		sdpOffer : offerSdp
	}
	sendMessage(message);
}

function onOffer(error, offerSdp) {
	if (error)
		return console.error("Error generating the offer");
	console.info('Invoking SDP offer callback function ' + location.host);
	var message = {
			id : 'start',
			sdpOffer : offerSdp
	}
	sendMessage(message);
}

function onError(error) {
	console.error(error);
}

function onIceCandidate(candidate) {
	console.log("Local candidate" + JSON.stringify(candidate));

	var message = {
			id : 'onIceCandidate',
			candidate : candidate
	};
	sendMessage(message);
}

function startResponse(message) {
	setState(I_CAN_STOP);
	console.log("SDP answer received from server. Processing ...");

	webRtcPeer.processAnswer(message.sdpAnswer, function(error) {
		if (error)
			return console.error(error);
	});
}

function stop() {
	console.log("Stopping...");
	setState(I_CAN_START);
	if (webRtcPeer) {

		webRtcPeer.dispose();
		webRtcPeer = null;

		var message = {
				id : 'stop'
		}
		sendMessage(message);
	}
}

function setState(nextState) {
	switch (nextState) {
	case I_CAN_START:
		$('#start').attr('disabled', false);
		$("#start").attr('onclick', 'start()');
		$('#stop').attr('disabled', true);
		$("#stop").removeAttr('onclick');
		break;

	case I_CAN_STOP:
		$('#start').attr('disabled', true);
		$('#stop').attr('disabled', false);
		$("#stop").attr('onclick', 'stop()');
		break;

	case I_AM_STARTING:
		$('#start').attr('disabled', true);
		$("#start").removeAttr('onclick');
		$('#stop').attr('disabled', true);
		$("#stop").removeAttr('onclick');
		break;

	default:
		onError("Unknown state " + nextState);
	return;
	}
	state = nextState;
}

function sendMessage(message) {
	var jsonMessage = JSON.stringify(message);
	console.log('Sending message: ' + jsonMessage);
	ws.send(jsonMessage);
}

/**
 * Lightbox utility (to display media pipeline image in a modal dialog)
 */
$(document).delegate('*[data-toggle="lightbox"]', 'click', function(event) {
	event.preventDefault();
	$(this).ekkoLightbox();
});
