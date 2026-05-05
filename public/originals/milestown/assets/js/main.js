
//import settings from '../data/settings.json' assert { type: 'json' };
// import { loadMap } from './loadMap.js';
import { loadSplash } from './loadSplash.js';
import { checkMinimumWindowSize } from "./checkWindowSize.js";
// import { generateCharacter } from "./generateCharacter.js";


//let heightValue = settings.windowSize.heightValue
//let widthValue = settings.windowSize.widthValue
// the above are not yet needed


//check window min. window size
window.onresize = checkMinimumWindowSize
checkMinimumWindowSize()

//Loading the map from json in below line and collecting return

loadSplash(document.getElementById("gameContainer"))
// let mapProperties = loadMap(maps.map5)
//console.log(mapProperties)


