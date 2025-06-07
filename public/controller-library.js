/*
* @license
* Copyright 2022-2025 Matter.js Authors
* SPDX-License-Identifier: Apache-2.0
*/

const MatterControllerLibrary = (function () {

  const _idToDevice = {
    0x0011: "Power Source",
    0x0012: "OTA Requestor",
    0x0013: "Bridged Node",
    0x0014: "OTA Provider",
    0x0016: "Root Node",
    0x0510: "Electrical Sensor",
    0x050D: "Device Energy Management",
    0x0100: "On/Off Light",
    0x0101: "Dimmable Light",
    0x010C: "Color Temperature Light",
    0x010D: "Extended Color Light",
    0x010A: "On/Off Plug-in Unit",
    0x010B: "Dimmable Plug-In Unit",
    0x0303: "Pump",
    0x0042: "Water Valve",
    0x0103: "On/Off Light Switch",
    0x0104: "Dimmer Switch",
    0x0105: "Color Dimmer Switch",
    0x0840: "Control Bridge",
    0x0304: "Pump Controller",
    0x000F: "Generic Switch",
    0x0015: "Contact Sensor",
    0x0106: "Light Sensor",
    0x0107: "Occupancy Sensor",
    0x0302: "Temperature Sensor",
    0x0305: "Pressure Sensor",
    0x0306: "Flow Sensor",
    0x0307: "Humidity Sensor",
    0x0850: "On/Off Sensor",
    0x0076: "Smoke CO Alarm",
    0x002C: "Air Quality Sensor",
    0x0041: "Water Freeze Detector",
    0x0043: "Water Leak Detector",
    0x0044: "Rain Sensor",
    0x000A: "Door Lock",
    0x000B: "Door Lock Controller",
    0x0202: "Window Covering",
    0x0203: "Window Covering Controller",
    0x0301: "Thermostat",
    0x002B: "Fan",
    0x002D: "Air Purifier",
    0x0028: "Basic Video Player",
    0x0023: "Casting Video Player",
    0x0022: "Speaker",
    0x0024: "Content App",
    0x0029: "Casting Video Client",
    0x002A: "Video Remote Control",
    0x0027: "Mode Select",
    0x000E: "Aggregator",
    0x0074: "Robotic Vacuum Cleaner",
    0x0070: "Refrigerator",
    0x0071: "Temperature Controlled Cabinet",
    0x0072: "Room Air Conditioner",
    0x0073: "Laundry Washer",
    0x0075: "Dishwasher",
    0x0077: "Cook Surface",
    0x0078: "Cooktop",
    0x0079: "Microwave Oven",
    0x007A: "Extractor Hood",
    0x007B: "Oven",
    0x007C: "Laundry Dryer",
    0x050C: "EVSE"
  };

  const _regEx = {
    onCommandInvoked: /Command .* invoked/,
    deviceTypeList: /"deviceTypeList"\s*\([^)]*\):\s*value\s*=\s*(\[[^\]]*\])/,   // "deviceTypeList" (0x0): value = [{"deviceType":18,"revision":1},{"deviceType":22,"revision":3}]
    attributeChanged: /(\d+): Attribute (\w+|\d+)\/(\d+)\/(\d+)\/(\w+) changed to (\w+)/, // 17148967204303126331: Attribute undefined/3/1029/measuredValue changed to 1340
    attributesForCluster: /Attribute values for cluster\s+(\w+)\s+\((\d+)\/(\d+)\/(-?\d+)\)/,
    clusterClient: /Cluster-Client "([^"]+)".*?\(([^\)]+)\)/,  // 2025-04-13 08:56:27.118 INFO EndpointStructureLogger ⎸       Cluster-Client "OnOff" (0x6) (Features: lighting)
    stateInformationCallback: /^stateInformationCallback Node (\d+) (\S+)/,
    nodeStatus: /Node\s+(\d+):\s+Node Status:\s+(.+?)\s+\((.+?)\)/,
    logLevel: /Current Loglevel for Console:\s*(\w+)/, // Current Loglevel for Console: error
    onLogLevel: /New Loglevel for Console:"\s*(\w+)"/, // New Loglevel for Console:" warn"
  }

  let _clusterAttributeCollectionData = null;
  let _regExProcessing = [];
  let _ws, _logger = console.log;

  function initControllerLibrary(ws, logger) {
    _ws = ws;
    _logger = logger;
    _regExProcessing = [];
  }
  function controlOnOffDevice(command, nodeId, endpoint) {
    sendCommand(`commands onoff ${command} ${nodeId} ${endpoint}`);
  }
  function idToDevice(id) {
    return _idToDevice[id] ? _idToDevice[id] : "Unknown ";
  }

  function processLine(line) {
    // for all of the regex expressions check and process if there is a match
    for (const element of _regExProcessing) {
      const results = line.match(element.expression);
      if (results) {
        const shouldRemove = element.callback(results, line);
        if (shouldRemove) { _regExProcessing.splice(_regExProcessing.indexOf(element), 1); }
      }
    }
  }
  function nodeSubscribe(nodeId) {
    sendCommand(`subscribe ${nodeId}`);
  }
  function matterShellHelp(command, callback) {
    if (command.endsWith("help")) {
      _registerRegEx(new RegExp(`\n\nCommands:\n`), (matches, rawData) => callback(rawData));

      sendCommand(command);
    } else console.log(`${command} not a help command. Ignoring`); // FIXME - need to do better
  }
  function unpairNode(nodeId) {
    sendCommand(`commission unpair ${nodeId}`);
  }
  function initializeNodes() {
    sendCommand('node connect');
  }
  function commissionNode(pairingCode) {
    sendCommand(`commission pair --pairing-code ${pairingCode}`); // "code" could also include --ble
  }
  function sendCommand(cmd) {
    if (_ws && _ws.readyState === WebSocket.OPEN) {
      _ws.send(cmd + '\n');
      if (_logger) _logger(`Sent: ${cmd}\n`, 'sent');
    } else if (_logger) _logger(`WebSocket not connected. Command "${cmd}" skipped.\n`, 'error');
  }
  function setHueSaturation(nodeId, endpoint, hue, saturation) {
    sendCommand(`commands colorcontrol movetohueandsaturation '{"hue":${hue},"saturation":${saturation},"transitionTime":0,"optionsMask":0, "optionsOverride": false}' ${nodeId} ${endpoint}`);
  }
  function sendNodeList(nodeId, callback) {
    const regEx = new RegExp(`^{"nodeId":"${nodeId}",`); // {"nodeId":"16435665865033782361",
    _registerRegEx(regEx, (matches, rawData) => { callback(rawData); return true; }, { nodeId: nodeId });

    sendCommand(`node list ${nodeId}`); // note that the node is ignored - we get all nodes, 1 to a line
  }
  function cleanupNode(nodeId) {
    _regExProcessing = _regExProcessing.filter(element => element.nodeId !== nodeId);
  }
  function _registerRegEx(regEx, callback, options = {}) { // Added options parameter
    if (regEx === undefined) {
      console.log(`${Date()} Not adding undefined regEx`);
      console.trace();
      return;
    }
    const regExObject = {
      expression: regEx,
      label: options.label || "", // You can also use options for label if needed
      callback: callback
    };

    if (options.nodeId) { // If a nodeId is provided in options, add it
      regExObject.nodeId = options.nodeId;
    }

    _addObjectToArray(_regExProcessing, regExObject);
  }
  function xxx_registerRegEx(regEx, callback) {
    if (regEx === undefined) { console.log(`${Date()} Not adding undefined regEx`); console.trace(); return; }
    _addObjectToArray(_regExProcessing, { expression: regEx, label: "", callback: callback });
  }
  function readOnOff(nodeId, endpoint, callback) {
    // Attribute value for onOff 1610017663230155987/1/6/0: true
    const regEx = new RegExp(`Attribute value for onOff ${nodeId}/${endpoint}/6/0: (true|false)`);
    _registerRegEx(regEx, (matches) => { callback(matches[1]); return true; }, { nodeId: nodeId });
    sendCommand(`attributes onoff read onoff ${nodeId} ${endpoint}`);
  }
  function onOnOffChanged(nodeId, endpoint, callback) {
    // 1610017663230155987: Attribute undefined/6/6/onOff changed to false
    const regEx = new RegExp(`${nodeId}: Attribute undefined/${endpoint}/6/onOff changed to (true|false)`);
    _registerRegEx(regEx, (matches) => callback(matches[1]), { nodeId: nodeId });
  }
  function readCurrentLevel(nodeId, endpoint, callback) {
    // 1610017663230155987: Attribute undefined/6/8/currentLevel changed to 107
    const regEx = new RegExp(`Attribute value for currentLevel ${nodeId}/${endpoint}/8/0: (\\d+)`);
    _registerRegEx(regEx, (matches) => { callback(matches[1]); return true; }, { nodeId: nodeId });
    sendCommand(`attributes levelcontrol read currentlevel ${nodeId} ${endpoint}`);
  }
  function onCurrentLevelChanged(nodeId, endpoint, callback) {
    const regEx = new RegExp(`${nodeId}: Attribute undefined/${endpoint}/8/currentLevel changed to (\\d+)`);
    _registerRegEx(regEx, (matches) => callback(matches[1]), { nodeId: nodeId });
  }
  function readHue(nodeId, endpoint, callback) {
    const regEx = new RegExp(`Attribute value for currentHue ${nodeId}/${endpoint}/768/0: (\\d+)`);
    _registerRegEx(regEx, (matches) => { callback(matches[1]); return true; }, { nodeId: nodeId });
    sendCommand(`attributes colorcontrol read currenthue ${nodeId} ${endpoint}`);
  }
  function onCurrentHueChanged(nodeId, endpoint, callback) {
    // 1610017663230155987: Attribute undefined/6/768/currentHue changed to 183
    const regEx = new RegExp(`${nodeId}: Attribute undefined/${endpoint}/768/currentHue changed to (\\d+)`);
    _registerRegEx(regEx, (matches) => callback(matches[1]), { nodeId: nodeId });
  }
  function readCurrentSaturation(nodeId, endpoint, callback) {
    const regEx = new RegExp(`Attribute value for currentSaturation ${nodeId}/${endpoint}/768/1: (\\d+)`);
    _registerRegEx(regEx, (matches) => { callback(matches[1]); return true; }, { nodeId: nodeId });
    sendCommand(`attributes colorcontrol read currentsaturation ${nodeId} ${endpoint}`);
  }
  function onCurrentSaturationChanged(nodeId, endpoint, callback) {
    // 1610017663230155987: Attribute undefined/6/768/currentSaturation changed to 187
    const regEx = new RegExp(`${nodeId}: Attribute undefined/${endpoint}/768/currentSaturation changed to (\\d+)`);
    _registerRegEx(regEx, (matches) => callback(matches[1]), { nodeId: nodeId });
  }

  function readClusterAttributes(nodeId, endpoint, cluster, callback) {

    // if there's not already a read in process
    if (!_clusterAttributeCollectionData) {
      _clusterAttributeCollectionData = { nodeId, endpoint, cluster, details: [], timeoutId: null, callback: callback };

      sendCommand(`attributes ${cluster.toLowerCase()} read all ${nodeId} ${endpoint}`);

      // "Done." detected and endClusterAttributeCollection called in onClusterAttributeCollection
      _onClusterAttributeCollection((attribute, id, value) => {
        _clusterAttributeCollectionData.details.push("  \"" + attribute + " " + id + "\": " +
          ((value[0] === "{" || value[0] === "[") ? JSON.stringify(JSON.parse(value), null, 2) : value)); // try catch needed
        return;
      });
      return true;
    } else return false; // only let one read be active at a time -- FIXME, could do better, not sure it's worth it though..
  }
  function _onClusterAttributeCollection(callback) {
    // options (15): {"executeIfOff":false,"coupleColorTempToLevel":false}
    // currentLevel (0): 111
    _registerRegEx(/^(Done\.)|\s*(.*?)\s*\((\d+)\):\s*(\S+)$/, (matches) => { // use two regex? 
      if (_clusterAttributeCollectionData) {
        if (matches[1] === "Done.") {
          _endClusterAttributeCollection(_clusterAttributeCollectionData.cluster);
          return true;
        } else callback(matches[2], matches[3], matches[4])
      } else return true;
    });
  }

  function _endClusterAttributeCollection(cluster) {
    const detailsText = _clusterAttributeCollectionData.details.join('\n');

    // FIXME - maybe should leave any formatting to tbe done in the callback
    if (detailsText) _clusterAttributeCollectionData.callback(_clusterAttributeCollectionData.nodeId, cluster + "\n" + detailsText);
    _clusterAttributeCollectionData = null;
  }

  function onAttributeChanged(callback) {
    _registerRegEx(_regEx.attributeChanged, (matches) => callback(matches[1], matches[3], matches[4], matches[5], matches[6]));
  }
  function onDeviceTypeListMessasge(callback) {
    _registerRegEx(_regEx.deviceTypeList, (matches) => callback(matches[1]));
  }
  function onCommandInvoked(callback) {
    _registerRegEx(_regEx.onCommandInvoked, (matches) => callback(matches[1]));
  }
  function onStateInformationCallback(callback) {
    _registerRegEx(_regEx.stateInformationCallback, (matches) => callback(matches[1], matches[2]));
  }
  function onNodeStatusCallback(callback) {
    _registerRegEx(_regEx.nodeStatus, (matches) => callback(matches[1], matches[2], matches[3]));
  }
  function readLoglevel(callback) {
    _registerRegEx(_regEx.logLevel, (matches) => { callback(matches[1]); return true; });
    sendCommand('config loglevel get');
  }
  function onLoglevelchanged(callback) {
    _registerRegEx(_regEx.onLogLevel, (matches) => callback(matches[1]));
  }
  function readAttributesForCluster(callback) {
    _registerRegEx(_regEx.attributesForCluster, (matches) => callback(matches[2], matches[3], matches[1]));
  }
  function onClusterClientMessage(callback) {
    _registerRegEx(_regEx.clusterClient, (matches) => callback(matches[1], +matches[2]));
  }
  function setLevel(nodeId, endpoint, value) {
    sendCommand(`commands levelcontrol movetolevel '{"level":${value},"transitionTime":0, "optionsMask":0, "optionsOverride": false}' ${nodeId} ${endpoint}`);
  }
  function configLoglevel(level) {
    sendCommand(`config loglevel set ${level}`);
  }
  function nodeStatus(nodeId) {
    // this command can result in a number of different messages arriving asynchronously
    sendCommand(`node status ${nodeId}`);
  }
  function nodeLog(nodeId, callback) {
    _registerRegEx(/INFO\s+PairedNode [^0-9]*(\d+)\*\*\D*/, (matches, text) => { callback(matches[1], text); return true; }, { nodeId: nodeId });
    sendCommand(`node log ${nodeId}`);
  }

  function _addObjectToArray(array, newObject) {
    const exists = array.some(obj => { return obj.expression.source === newObject.expression.source && obj.expression.flags === newObject.expression.flags; });
    if (!exists) array.push(newObject);
  }

  return {
    idToDevice: idToDevice,
    initControllerLibrary: initControllerLibrary,
    controlOnOffDevice: controlOnOffDevice,
    processLine: processLine,
    nodeSubscribe: nodeSubscribe,
    matterShellHelp: matterShellHelp,
    unpairNode: unpairNode,
    initializeNodes: initializeNodes,
    commissionNode: commissionNode,
    sendCommand: sendCommand,
    setHueSaturation: setHueSaturation,
    sendNodeList: sendNodeList,
    cleanupNode: cleanupNode,
    readOnOff: readOnOff,
    onOnOffChanged: onOnOffChanged,
    readCurrentLevel: readCurrentLevel,
    onCurrentLevelChanged: onCurrentLevelChanged,
    readHue: readHue,
    onCurrentHueChanged: onCurrentHueChanged,
    readCurrentSaturation: readCurrentSaturation,
    onCurrentSaturationChanged: onCurrentSaturationChanged,
    onAttributeChanged: onAttributeChanged,
    onDeviceTypeListMessasge: onDeviceTypeListMessasge,
    onCommandInvoked: onCommandInvoked,
    onStateInformationCallback: onStateInformationCallback,
    onNodeStatusCallback: onNodeStatusCallback,
    onLoglevelchanged: onLoglevelchanged,
    readLoglevel: readLoglevel,
    readAttributesForCluster: readAttributesForCluster,
    onClusterClientMessage: onClusterClientMessage,
    setLevel: setLevel,
    configLoglevel: configLoglevel,
    nodeStatus: nodeStatus,
    nodeLog: nodeLog,
    readClusterAttributes: readClusterAttributes
  }
})();
