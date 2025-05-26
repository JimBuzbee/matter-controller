# Web-Based Matter Controller Examples

This repository contains examples of Matter Controllers that utilize a web socket to communicate with the [Matter Shell](https://github.com/project-chip/matter.js/tree/main/packages/nodejs-shell) from the [matter.js](https://github.com/project-chip/matter.js) project. All the functionality of the standard matter shell is available, including commissioning devices, controlling devices,  querying device status and capabilities, accepting asynchronous device changes, etc.  The basic strategy is to send standard matter shell commands over a websocket to the matter.js shell, and then capture the results to create or update the user interface in a browser. For details of the matter.js shell capabilities, see the  [Matter Shell project](https://github.com/project-chip/matter.js/tree/main/packages/nodejs-shell) 

Example 1 -  MatterInspector.html
![enter image description here](https://raw.githubusercontent.com/JimBuzbee/matter-controller/main/public/MatterExplorer.png)

Example 2 - index.html
![enter image description here](https://raw.githubusercontent.com/JimBuzbee/matter-controller/main/public/example.png)
## Getting started with the defaults

 - git clone https://github.com/JimBuzbee/matter-controller.git
 - cd matter-controller/
 - npm i
 - npm run webshell
 - Visit http://localhost:3000/MatterInspector,html in your browser
 
Once the webshell server is running, the easiest want to get started with a Matter device, is to use one that has already been commissioned via Google/Apple/Home Assistant/etc. In the appropriate controller, locate the menu for sharing or linking the device with another app. When given a pairing code, enter it in the webshell form.  Once entered, after a short delay a visualization should pop up in the browser user interface. If it does not, check the console for messages.

If you want to commission a Matter device that hasn't already been set up, see the matter.js shell documentation regarding bluetooth libraries for your system, start the webshell with a "--ble" parameter,  and then when entering the paring code in the browser UI, add --ble, e.g. "0123456789  --ble"
 
 ## Details TBD
running...
http options...
pairing and bluetooth capabilities...
basic architecture, limitations, how to extend...
examples, i.e. read attribute, react to attribute change, send command
current limitations - not handling events, color change other than hsv...
designed to be used as starting points for further refinement...*


