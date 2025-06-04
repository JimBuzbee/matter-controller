
const _regEx = {
  commandInvoked: /Command .* invoked/,
  deviceTypeList: /"deviceTypeList"\s*\([^)]*\):\s*value\s*=\s*(\[[^\]]*\])/,   // "deviceTypeList" (0x0): value = [{"deviceType":18,"revision":1},{"deviceType":22,"revision":3}]
  attributeChanged: /(\d+): Attribute (\w+|\d+)\/(\d+)\/(\d+)\/(\w+) changed to (\w+)/, // 17148967204303126331: Attribute undefined/3/1029/measuredValue changed to 1340
  attributesForCluster: /Attribute values for cluster\s+(\w+)\s+\((\d+)\/(\d+)\/(-?\d+)\)/,
  clusterClient: /Cluster-Client "([^"]+)".*?\(([^\)]+)\)/,  // 2025-04-13 08:56:27.118 INFO EndpointStructureLogger ⎸       Cluster-Client "OnOff" (0x6) (Features: lighting)
  stateInformationCallback: /^stateInformationCallback Node (\d+) (\S+)/,
  nodeStatus: /Node\s+(\d+):\s+Node Status:\s+(.+?)\s+\((.+?)\)/,
  logLevel: /(?:New Loglevel for Console:"\s*|\s*Current Loglevel for Console:\s*)(\w+)\s*"?/,
  nodeList: /(?=.*"isBatteryPowered")(?=.*"nodeId":"(\d+)")/,
}

let _clusterAttributeCollectionData = null;
let _regExProcessing = [];
let _ws, _logger = console.log;
//----------------------------------------------------------------------------------
function initControllerLibrary(ws, logger) {
  _ws = ws;
  _logger = logger;
  _regExProcessing = [];
}
//----------------------------------------------------------------------------------
function controlOnOffDevice(command, nodeId, endpoint){
  sendCommand(`commands onoff ${command} ${nodeId} ${endpoint}`);
}
//----------------------------------------------------------------------------------
function processLine(text,  rawData) {
  // for all of the regex expressions check and process if there is a match
  for (const element of _regExProcessing) {
    const results = text.match(element.expression);
    if (results) {
      const shouldRemove = element.callback(results, rawData);
      if (shouldRemove) { _regExProcessing.splice(_regExProcessing.indexOf(element), 1); }
    }
  }
}
//----------------------------------------------------------------------------------
function nodeSubscribe(nodeId) {
  sendCommand(`subscribe ${nodeId}`);
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
    _logger(`Sent: ${cmd}\n`, 'sent');
  } else _logger(`WebSocket not connected. Command "${cmd}" skipped.\n`, 'error');
}
function setHueSaturation(nodeId, endpoint, hue, saturation) {
  sendCommand(`commands colorcontrol movetohueandsaturation '{"hue":${hue},"saturation":${saturation},"transitionTime":0,"optionsMask":0, "optionsOverride": false}' ${nodeId} ${endpoint}`);
}
function sendNodeList(nodeId) {
  sendCommand(`node list ${nodeId}`); // note that the node is ignored - we get all nodes, 1 to a line
}
function cleanupNode(nodeId) {
  _regExProcessing = _regExProcessing.filter(element => element.nodeId !== nodeId);
}
function registerRegEx(regEx, callback) {
  if (regEx === undefined) { console.log(`${Date()} Not adding undefined regEx`); console.trace(); return; }
  addObjectToArray(_regExProcessing, { expression: regEx, label: "", callback: callback });
}
function readOnOff(nodeId, endpoint, callback) {
  // Attribute value for onOff 1610017663230155987/1/6/0: true
  const regEx = new RegExp(`Attribute value for onOff ${nodeId}/${endpoint}/6/0: (true|false)`);
  registerRegEx(regEx, (matches) => callback(matches[1]));
  sendCommand(`attributes onoff read onoff ${nodeId} ${endpoint}`);
  return true;
}
function onOnOffChanged(nodeId, endpoint, callback) {
  // 1610017663230155987: Attribute undefined/6/6/onOff changed to false
  const regEx = new RegExp(`${nodeId}: Attribute undefined/${endpoint}/6/onOff changed to (true|false)`);
  registerRegEx(regEx, (matches) => callback(matches[1]));
  return false;
}
function readCurrentLevel(nodeId, endpoint, callback) {
  // 1610017663230155987: Attribute undefined/6/8/currentLevel changed to 107
  const regEx = new RegExp(`Attribute value for currentLevel ${nodeId}/${endpoint}/8/0: (\\d+)`);
  registerRegEx(regEx, (matches) => callback(matches[1]));
  sendCommand(`attributes levelcontrol read currentlevel ${nodeId} ${endpoint}`);
  return true;
}
function onCurrentLevelChanged(nodeId, endpoint, callback) {
  const regEx = new RegExp(`${nodeId}: Attribute undefined/${endpoint}/8/currentLevel changed to (\\d+)`);
  registerRegEx(regEx, (matches) => callback(matches[1]));
  return false;
}
function readHue(nodeId, endpoint, callback) {
  const regEx = new RegExp(`Attribute value for currentHue ${nodeId}/${endpoint}/768/0: (\\d+)`);
  registerRegEx(regEx, (matches) => callback(matches[1]));
  sendCommand(`attributes colorcontrol read currenthue ${nodeId} ${endpoint}`);
  return true;
}
function onCurrentHueChanged(nodeId, endpoint, callback) {
  // 1610017663230155987: Attribute undefined/6/768/currentHue changed to 183
  const regEx = new RegExp(`${nodeId}: Attribute undefined/${endpoint}/768/currentHue changed to (\\d+)`);
  registerRegEx(regEx, (matches) => callback(matches[1]));
  return false;
}
function readCurrentSaturation(nodeId, endpoint, callback) {
  const regEx = new RegExp(`Attribute value for currentSaturation ${nodeId}/${endpoint}/768/1: (\\d+)`);
  registerRegEx(regEx, (matches) => callback(matches[1]));
  sendCommand(`attributes colorcontrol read currentsaturation ${nodeId} ${endpoint}`);
  return true;
}
function onCurrentSaturationChanged(nodeId, endpoint, callback) {
  // 1610017663230155987: Attribute undefined/6/768/currentSaturation changed to 187
  const regEx = new RegExp(`${nodeId}: Attribute undefined/${endpoint}/768/currentSaturation changed to (\\d+)`);
  registerRegEx(regEx, (matches) => callback(matches[1]));
  return false;
}
function onClusterAttributeCollection(callback) {
  // options (15): {"executeIfOff":false,"coupleColorTempToLevel":false}
  // currentLevel (0): 111
  registerRegEx(/^(Done\.)|\s*(.*?)\s*\((\d+)\):\s*(\S+)$/, (matches) => { // use two regex? 
    if (_clusterAttributeCollectionData) {
      if (matches[1] === "Done.") {
        endClusterAttributeCollection(_clusterAttributeCollectionData.cluster);
      } else callback(matches[2], matches[3], matches[4])
    }
  });
}
//----------------------------------------------------------------------------------
function onAttributeChanged(callback) {
  registerRegEx(_regEx.attributeChanged, (matches) => callback(matches[1], matches[3], matches[4], matches[5], matches[6]));
}
function onDeviceTypeListMessasge(callback) {
  registerRegEx(_regEx.deviceTypeList, (matches) => callback(matches[1]));
}
function commandInvoked(callback) {
  registerRegEx(_regEx.commandInvoked, (matches) => callback(matches[1]));
}
function onStateInformationCallback(callback) {
  registerRegEx(_regEx.stateInformationCallback, (matches) => callback(matches[1], matches[2]));
}
function onNodeStatusCallback(callback) {
  registerRegEx(_regEx.nodeStatus, (matches) => callback(matches[1], matches[2], matches[3]));
}
function readLoglevelOnLoglevelchanged(callback) {
  registerRegEx(_regEx.logLevel, (matches) => callback(matches[1]));
  sendCommand('config loglevel get');
}
function readAttributesForCluster(callback) {
  registerRegEx(_regEx.attributesForCluster, (matches) => callback(matches[2], matches[3], matches[1]));
}
function onClusterClientMessage(callback) {
  registerRegEx(_regEx.clusterClient, (matches) => callback(matches[1], +matches[2]));
}
function onNodeList(nodeId, callback) {
  registerRegEx(_regEx.nodeList, (matches, raw) => { if (matches[1] === nodeId) { callback(matches[1], raw); return true; } });
}
function setLevel(nodeId, endpoint, value) {
  sendCommand(`commands levelcontrol movetolevel '{"level":${value},"transitionTime":0, "optionsMask":0, "optionsOverride": false}' ${nodeId} ${endpoint}`);
}
function configLoglevel(level) {
  sendCommand(`config loglevel set ${level}`);
}
function nodeStatus(nodeId) {
  sendCommand(`node status ${nodeId}`);
}
function nodeLog(nodeId, callback) {
  registerRegEx(/INFO\s+PairedNode [^0-9]*(\d+)\*\*\D*/, (matches, text) => { callback(matches[1], text); return true; });
  sendCommand(`node log ${nodeId}`);
}
function readClusterAttributes(nodeId, endpoint, cluster, callback) {

  _clusterAttributeCollectionData = { nodeId, endpoint, cluster, details: [], timeoutId: null, callback: callback };

  sendCommand(`attributes ${cluster.toLowerCase()} read all ${nodeId} ${endpoint}`);

  // "Done." detected and endClusterAttributeCollection called in onClusterAttributeCollection
  onClusterAttributeCollection((attribute, id, value) => {
    _clusterAttributeCollectionData.details.push("  \"" + attribute + " " + id + "\": " +
      ((value[0] === "{" || value[0] === "[") ? JSON.stringify(JSON.parse(value), null, 2) : value)); // try catch needed
    return;
  });
}
function endClusterAttributeCollection(cluster) {
  const detailsText = _clusterAttributeCollectionData.details.join('\n');

  // FIXME - maybe should leave any formatting to tbe done in the callback
  if (detailsText) _clusterAttributeCollectionData.callback(_clusterAttributeCollectionData.nodeId, cluster + "\n" + detailsText);
  _clusterAttributeCollectionData = null;
  // FIXME - For efficiency, need some way to remove custer regex Regex when done
}
//===================== Library =======================================================
