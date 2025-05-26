const idToDevice = {
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

const regEx = {
  commandInvoked: /Command .* invoked/,
  deviceTypeList: /"deviceTypeList"\s*\([^)]*\):\s*value\s*=\s*(\[[^\]]*\])/,   // "deviceTypeList" (0x0): value = [{"deviceType":18,"revision":1},{"deviceType":22,"revision":3}]
  attributeChanged: /(\d+): Attribute (\w+|\d+)\/(\d+)\/(\d+)\/(\w+) changed to (\w+)/,
  attributesForCluster: /Attribute values for cluster\s+(\w+)\s+\((\d+)\/(\d+)\/(-?\d+)\)/,
  clusterClient: /Cluster-Client "([^"]+)".*?\(([^\)]+)\)/,  // 2025-04-13 08:56:27.118 INFO EndpointStructureLogger ⎸       Cluster-Client "OnOff" (0x6) (Features: lighting)
  stateInformationCallback: /^stateInformationCallback Node (\d+) (\S+)/,
  nodeStatus: /Node\s+(\d+):\s+Node Status:\s+(.+?)\s+\((.+?)\)/,
  logLevel: /(?:New Loglevel for Console:"\s*|\s*Current Loglevel for Console:\s*)(\w+)\s*"?/,
  nodeList: /(?=.*"isBatteryPowered")(?=.*"nodeId":"(\d+)")/,
}

let clusterAttributeCollectionData = null;

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
function sendCommand(cmd, outputType = 'sent') {
  if (ws && ws.readyState === WS_STATES.OPEN) {
    ws.send(cmd + '\n');
    appendOutput(domElements.console, `Sent: ${cmd}\n`, outputType);
    //       console.log(`${Date()} %cSent ${cmd}`, 'color: blue;');
  } else appendOutput(domElements.console, `WebSocket not connected. Command "${cmd}" skipped.\n`, 'error');
}
function setHueSaturation(nodeId, endpoint, hue, saturation) {
  sendCommand(`commands colorcontrol movetohueandsaturation '{"hue":${hue},"saturation":${saturation},"transitionTime":0,"optionsMask":0, "optionsOverride": false}' ${nodeId} ${endpoint}`);
}
function sendNodeList(nodeId) {
  sendCommand(`node list ${nodeId}`); // note that the node is ignored - we get all nodes, 1 to a line
}
function registerRegEx(regEx, callback) {
  if (regEx === undefined) { console.log(`${Date()} Not adding undefined regEx`); console.trace(); return; }
  addObjectToArray(regExProcessing, { expression: regEx, label: "", callback: callback });
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
    if (clusterAttributeCollectionData) {
      if (matches[1] === "Done.") {
        endClusterAttributeCollection(clusterAttributeCollectionData.cluster);
      } else callback(matches[2], matches[3], matches[4])
    }
  });
}
//----------------------------------------------------------------------------------
function onAttributeChanged(callback) {
  registerRegEx(regEx.attributeChanged, (matches) => callback(matches[1], matches[3], matches[4], matches[5], matches[6]));
}
function onDeviceTypeListMessasge(callback) {
  registerRegEx(regEx.deviceTypeList, (matches) => callback(matches[1]));
}
function commandInvoked(callback) {
  registerRegEx(regEx.commandInvoked, (matches) => callback(matches[1]));
}
function onStateInformationCallback(callback) {
  registerRegEx(regEx.stateInformationCallback, (matches) => callback(matches[1], matches[2]));
}
function onNodeStatusCallback(callback) {
  registerRegEx(regEx.nodeStatus, (matches) => callback(matches[1], matches[2], matches[3]));
}
function readLoglevelOnLoglevelchanged(callback) {
  registerRegEx(regEx.logLevel, (matches) => callback(matches[1]));
  sendCommand('config loglevel get');
}
function readAttributesForCluster(callback) {
  registerRegEx(regEx.attributesForCluster, (matches) => callback(matches[2], matches[3], matches[1]));
}
function onClusterClientMessage(callback) {
  registerRegEx(regEx.clusterClient, (matches) => callback(matches[1], +matches[2]));
}
function onNodeList(nodeId, callback) {
  registerRegEx(regEx.nodeList, (matches, raw) => { if ( matches[1] === nodeId ){ callback(matches[1], raw); return true;}});
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
  registerRegEx(/INFO\s+PairedNode [^0-9]*(\d+)\*\*\D*/, (matches, text) => { callback(matches[1], text); return true;});
  sendCommand(`node log ${nodeId}`);
}
function readClusterAttributes(nodeId, endpoint, cluster, callback) {

  clusterAttributeCollectionData = { nodeId, endpoint, cluster, details: [], timeoutId: null, callback: callback };

  sendCommand(`attributes ${cluster.toLowerCase()} read all ${nodeId} ${endpoint}`);

  // "Done." detected and endClusterAttributeCollection called in onClusterAttributeCollection
  onClusterAttributeCollection((attribute, id, value) => {
    clusterAttributeCollectionData.details.push("  \"" + attribute + " " + id + "\": " +
      ((value[0] === "{" || value[0] === "[") ? JSON.stringify(JSON.parse(value), null, 2) : value)); // try catch needed
    return;
  });
}
function endClusterAttributeCollection(cluster) {
  const detailsText = clusterAttributeCollectionData.details.join('\n');

  // FIXME - maybe should leave any formatting to tbe done in the callback
  if (detailsText) clusterAttributeCollectionData.callback(clusterAttributeCollectionData.nodeId, cluster + "\n" + detailsText);
  clusterAttributeCollectionData = null;
  // FIXME - For efficiency, need some way to remove custer regex Regex when done
}
//===================== Library =======================================================
